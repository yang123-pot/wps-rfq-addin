const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {writeFileAtomic}=require('./atomic-file.cjs');
// 纯状态逻辑在src/split-state.js里，页面与Node共用，避免两份实现漂移。
const state=require('../src/split-state.js');
const planModel=require('../src/split-plan.js');
const SCHEMA_VERSION=state.SCHEMA_VERSION,STATES=state.STATES,ID_PATTERN=state.ID_PATTERN;
const validate=state.validate,summarize=state.summarize,create=state.create,mark=state.mark,
 reconcile=state.reconcile,pending=state.pending,blocked=state.blocked;
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function revisionConflict(){
 const error=Error('拆分回执版本冲突：已被其他窗口更新，请重新读取回执后再保存。');
 error.code='REVISION_CONFLICT';
 return error;
}
function receiptKey(projectId,batchId){
 if(typeof projectId!=='string'||!ID_PATTERN.test(projectId))throw Error('拆分回执项目编号无效。');
 if(typeof batchId!=='string'||!ID_PATTERN.test(batchId))throw Error('拆分回执批次编号无效。');
 return projectId+'__'+batchId+'.json';
}
function createSplitStore({directory}={}){
 if(typeof directory!=='string'||!directory.trim())throw Error('拆分回执目录无效，已停止读写。');
 const root=path.resolve(directory);
 let writes=Promise.resolve();
 function fileOf(projectId,batchId){return path.join(root,receiptKey(projectId,batchId));}
 async function readRecord(file){
  let raw;
  try{raw=await fs.readFile(file,'utf8');}
  catch(error){
   if(error.code==='ENOENT')return null;
   throw Error('读取拆分回执失败：'+error.message);
  }
  let parsed;
  try{parsed=JSON.parse(raw);}
  catch(error){throw Error('拆分回执已损坏，原文件未改动：'+error.message);}
  const check=validate(parsed);
  if(!check.ok)throw Error('拆分回执不完整或版本不支持：'+check.errors.join('；'));
  return parsed;
 }
 async function load(projectId,batchId){return readRecord(fileOf(projectId,batchId));}
 function save(receipt,options){
  const request=options&&typeof options==='object'?options:{};
  const check=validate(receipt);
  if(!check.ok)return Promise.reject(Error('拆分回执不完整：'+check.errors.join('；')));
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)
   return Promise.reject(Error('保存拆分回执需要有效版本号，原文件未改动。'));
  const target=fileOf(receipt.projectId,receipt.batchId);
  const run=writes.catch(function(){}).then(async function(){
   const current=await readRecord(target),currentRevision=current?current.revision:0;
   if(currentRevision!==request.expectedRevision)throw revisionConflict();
   const next=Object.assign({},receipt,{revision:currentRevision+1,updatedAt:new Date().toISOString()});
   const verified=validate(next);
   if(!verified.ok)throw Error('拆分回执不完整：'+verified.errors.join('；'));
   try{
    await writeFileAtomic(target,JSON.stringify(next,null,2),function(readback){
     const saved=validate(JSON.parse(readback));
     if(!saved.ok)throw Error('写入校验失败：'+saved.errors.join('；'));
    });
   }catch(error){throw Error('拆分回执保存失败，已保留上一版：'+error.message);}
   return {path:target,revision:next.revision,receipt:next};
  });
  writes=run.catch(function(){});
  return run;
 }
 async function inspectTarget(target){
  let info;
  try{info=await fs.lstat(target);}
  catch(error){
   if(error.code==='ENOENT')return {target:target,exists:false,sha256:null,bytes:0};
   throw Error('无法检查拆分目标：'+target+'（'+error.message+'）');
  }
  if(!info.isFile())throw Error('拆分目标不是文件：'+target);
  if(info.size>256*1024*1024)throw Error('拆分目标过大，未核对：'+target);
  const bytes=await fs.readFile(target);
  return {target:target,exists:true,sha256:digest(bytes),bytes:bytes.length};
 }
 function sameReceipt(left,right){
  if(!left||!right)return false;
  const fields=['projectId','batchId','inputKey','generationSha256','outputDirectory'];
  if(fields.some(function(field){return left[field]!==right[field];}))return false;
  return JSON.stringify(left.files||[])===JSON.stringify(right.files||[]);
 }
 function alignReceipt(receipt,built){
  const byId={};
  receipt.files.forEach(function(file){byId[file.fileId]=file;});
  return built.files.every(function(file){
   const current=byId[file.fileId];
   return current&&String(current.target).toLowerCase()===String(file.target).toLowerCase();
  })&&receipt.files.length===built.files.length&&
   String(receipt.outputDirectory||'').replace(/[\\/]+$/,'').toLowerCase()===String(built.directory||'').replace(/[\\/]+$/,'').toLowerCase();
 }
 // prepare：核总簿SHA、当前内容键、输出目录、全部目标；按项目＋批次读回执。
 // 首次准备若已有同名目标先阻断；已有回执时按文件实况核对，允许只续作未完成项。
 async function prepare(input){
  const source=input&&typeof input==='object'?input:{};
  const projectId=String(source.projectId||''),batchId=String(source.batchId||''),
   targetDirectory=String(source.targetDirectory||''),generation=source.generation||null;
  if(!ID_PATTERN.test(projectId))throw Error('拆分准备缺少有效项目编号。');
  if(!ID_PATTERN.test(batchId))throw Error('拆分准备缺少有效批次编号。');
  if(!generation||!generation.modelSnapshot)throw Error('拆分准备缺少总询价工作簿快照。');
  const built=planModel.build({model:generation.modelSnapshot,generation:generation,
   targetDirectory:targetDirectory,currentKey:source.currentKey});
  const conflicts=built.conflicts.slice();
  try{
   const folder=await fs.stat(targetDirectory);
   if(!folder.isDirectory())conflicts.push({code:'output-not-directory',message:'输出位置不是文件夹：'+targetDirectory});
  }catch(error){
   conflicts.push({code:'output-directory-missing',message:'输出文件夹不存在或无法访问：'+targetDirectory});
  }
  try{
   const book=await inspectTarget(generation.target);
   if(!book.exists)conflicts.push({code:'generation-missing',message:'总询价工作簿不存在，请重新生成后再拆分。'});
   else if(book.sha256!==String(generation.sha256||'').toLowerCase())
    conflicts.push({code:'generation-sha-mismatch',message:'总询价工作簿已被外部修改，请重新生成后再拆分。'});
  }catch(error){conflicts.push({code:'generation-unreadable',message:error.message});}
  const previous=await load(projectId,batchId);
  if(previous&&!alignReceipt(previous,built))
   throw Error('该批次回执与当前拆分清单不一致，请更换批次或输出目录后重试。');
  const checks=[];
  for(const file of built.files){
   try{checks.push(Object.assign({fileId:file.fileId},await inspectTarget(file.target)));}
   catch(error){conflicts.push({code:'target-unreadable',fileId:file.fileId,message:error.message});}
  }
  if(!previous){
   const existing=checks.filter(function(check){return check.exists;});
   existing.forEach(function(check){
    conflicts.push({code:'target-exists',fileId:check.fileId,message:'目标文件已存在，绝不覆盖：'+check.target});
   });
  }
  const checkedPlan=Object.assign({},built,{conflicts:conflicts,canPublish:built.canPublish&&conflicts.length===0});
  if(!previous&&conflicts.length)return {plan:checkedPlan,receipt:null,revision:0,canPublish:false};
  let receipt=previous||create(built,generation.sha256,{projectId:projectId,batchId:batchId});
  if(previous)receipt=reconcile(receipt,checks);
  if(!sameReceipt(previous,receipt)){
   const expectedRevision=previous?previous.revision:0;
   const saved=await save(receipt,{expectedRevision:expectedRevision});
   receipt=saved.receipt;
  }
  const summary=summarize(receipt);
  const canPublish=checkedPlan.canPublish&&summary.needsVerification.length===0;
  return {plan:checkedPlan,receipt:receipt,revision:receipt.revision,canPublish:canPublish,summary:summary};
 }
 return {directory:root,fileNameFor:receiptKey,load:load,save:save,prepare:prepare,
  inspectTarget:inspectTarget};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,STATES:STATES,ID_PATTERN:ID_PATTERN,
 fileNameFor:receiptKey,validate:validate,summarize:summarize,create:create,mark:mark,
 reconcile:reconcile,pending:pending,blocked:blocked,createSplitStore:createSplitStore};
