const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {writeFileAtomic}=require('./atomic-file.cjs');
// 纯状态逻辑在src/split-state.js里，页面与Node共用，避免两份实现漂移。
const state=require('../src/split-state.js');
const planModel=require('../src/split-plan.js');
const SCHEMA_VERSION=state.SCHEMA_VERSION,STATES=state.STATES,ID_PATTERN=state.ID_PATTERN;
const validate=state.validate,summarize=state.summarize,create=state.create,mark=state.mark,
 demoteUnproven=state.demoteUnproven,reconcile=state.reconcile,pending=state.pending,blocked=state.blocked;
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
  // 旧回执里没有内容核对证明的succeeded保守降为待核对，避免“曾经记过成功”被直接沿用。
  return demoteUnproven(parsed);
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
 // 回执必须绑定同一份来源内容键和同一版总询价工作簿；内容键/总簿变化一律另起批次，不沿用旧成功记录。
 return String(receipt.inputKey||'')===String(built.inputKey||'')&&
  String(receipt.generationSha256||'').toLowerCase()===String(built.generationSha256||'').toLowerCase()&&
  built.files.every(function(file){
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
  let previous=await load(projectId,batchId),upgraded=false;
  if(previous&&!alignReceipt(previous,built)){
   // 旧版批次只缺新增完整总表时补一条pending，保留原供应商文件及证明，不能借迁移接受其他差异。
   const complete=built.files.find(file=>file.kind==='complete-workbook');
   if(complete&&!previous.files.some(file=>file.fileId===complete.fileId)){
    const extra=create({inputKey:built.inputKey,directory:built.directory,files:[complete]},generation.sha256,{projectId,batchId}).files[0];
    const candidate={...previous,files:previous.files.concat(extra)};
    if(alignReceipt(candidate,built)){previous=candidate;upgraded=true;}
   }
   if(!upgraded)throw Error('该批次回执与当前拆分清单不一致，请更换批次或输出目录后重试。');
  }
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
  if(upgraded||!sameReceipt(previous,receipt)){
   const expectedRevision=previous?previous.revision:0;
   const saved=await save(receipt,{expectedRevision:expectedRevision});
   receipt=saved.receipt;
  }
  const summary=summarize(receipt);
  const canPublish=checkedPlan.canPublish&&summary.needsVerification.length===0;
  // 待核对文件不允许被当成成功发布，但必须允许用户对已有文件发起显式内容核对（核对通过才记账成功）。
  const canVerify=checkedPlan.canPublish&&summary.needsVerification.length>0;
  return {plan:checkedPlan,receipt:receipt,revision:receipt.revision,canPublish:canPublish,
   canVerify:canVerify,summary:summary};
 }
 // 只复制已准备批次绑定的完整总表。使用核过SHA的同一份字节写入，避免源路径在核验与复制间变化；目标独占创建。
 async function copyComplete(input){
  const source=input||{},generation=source.generation;
  if(!generation||!generation.modelSnapshot)throw Error('请先生成并校验完整询价总表。');
  const built=planModel.build({model:generation.modelSnapshot,generation,targetDirectory:source.targetDirectory,currentKey:source.currentKey});
  const record=await load(source.projectId,source.batchId);
  if(!record||!alignReceipt(record,built))throw Error('完整总表与已准备的批次回执不一致，请重新准备拆分。');
  if(!built.canPublish)throw Error(built.conflicts.map(item=>item.message).join('；'));
  const file=built.files.find(item=>item.kind==='complete-workbook');
  if(!file||!path.isAbsolute(file.target)||!path.isAbsolute(generation.target))throw Error('完整总表路径无效。');
  const actual=await inspectTarget(generation.target);
  if(!actual.exists||actual.sha256!==String(generation.sha256).toLowerCase())throw Error('完整总表不存在或已被修改，请重新生成后再导出。');
  const bytes=await fs.readFile(generation.target);
  if(bytes.length<4||bytes.length>256*1024*1024||!bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4]))||digest(bytes)!==generation.sha256.toLowerCase())
   throw Error('完整总表内容已变化或不是有效xlsx，未导出。');
  if(source.verifyOnly===true){
   const existing=await inspectTarget(file.target);
   if(!existing.exists)throw Error('完整总表副本不存在，请重试未完成文件。');
   if(existing.sha256!==actual.sha256)throw Error('完整总表副本与拆分前完整文件不一致，原文件保留，未覆盖。');
   return {target:file.target,sha256:existing.sha256,bytes:existing.bytes};
  }
  const stage=path.join(path.dirname(file.target),'.rfq-complete-'+crypto.randomUUID()+'.tmp');
  let handle=null,owned=false;
  try{
   handle=await fs.open(stage,'wx');owned=true;await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
   if(digest(await fs.readFile(stage))!==actual.sha256)throw Error('完整总表暂存校验失败，未发布。');
   // 同目录硬链接原子且独占：并发同名文件不会被替换，磁盘写满也不会留下半个最终文件。
   await fs.link(stage,file.target);
  }catch(error){
   if(error.code==='EEXIST')throw Error('完整总表同名文件已存在，未覆盖，请更换文件夹或核对已有文件。');
   throw Error('完整总表导出失败，请检查可用空间或更换本机文件夹后重试：'+error.message);
  }finally{
   if(handle)await handle.close().catch(function(){});
   if(owned)await fs.rm(stage,{force:true}).catch(function(){});
  }
  const result=await inspectTarget(file.target);
  if(result.sha256!==actual.sha256)throw Error('完整总表副本校验失败，未确认成功。');
  return {target:file.target,sha256:result.sha256,bytes:result.bytes};
 }
 return {directory:root,fileNameFor:receiptKey,load:load,save:save,prepare:prepare,
  inspectTarget:inspectTarget,copyComplete:copyComplete};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,STATES:STATES,ID_PATTERN:ID_PATTERN,
 fileNameFor:receiptKey,validate:validate,summarize:summarize,create:create,mark:mark,
 demoteUnproven:demoteUnproven,reconcile:reconcile,pending:pending,blocked:blocked,
 createSplitStore:createSplitStore};
