const fs=require('node:fs/promises'),path=require('node:path');
const {writeFileAtomic}=require('./atomic-file.cjs');
const {validate}=require('../src/project.js');
const ID=/^[a-z0-9-]{8,64}$/;
function revisionConflict(message){
 const error=Error(message||'项目版本冲突：已被其他窗口保存，请重新打开后再保存。');
 error.code='REVISION_CONFLICT';
 return error;
}
function createProjectStore({directory}){
 const root=path.resolve(directory);
 let writes=Promise.resolve();
 function fileOf(id){
  if(typeof id!=='string'||!ID.test(id))throw Error('项目编号无效，已停止读写。');
  return path.join(root,id+'.json');
 }
 async function readRecord(file){
  let text;
  try{text=await fs.readFile(file,'utf8');}
  catch(error){
   if(error.code==='ENOENT')return null;
   throw Error('读取项目记录失败：'+error.message);
  }
  let parsed;
  try{parsed=JSON.parse(text);}
  catch(error){throw Error('项目记录已损坏，原文件未改动：'+error.message);}
  const check=validate(parsed);
  if(!check.ok)throw Error('项目记录版本不支持或字段缺失：'+check.errors.join('；'));
  return parsed;
 }
 async function load(id){
  return readRecord(fileOf(id));
 }
 // 保存用expectedRevision做乐观锁：初始revision=0，成功递增；旧版本号写入409并保留草稿。
 function save(project,options){
  const request=options&&typeof options==='object'?options:{};
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)
   return Promise.reject(Error('保存项目需要有效版本号，原文件未改动。'));
  try{
   const check=validate(project);
   if(!check.ok)throw Error('项目记录不完整或版本不支持：'+check.errors.join('；'));
  }catch(error){return Promise.reject(error);}
  const target=fileOf(project.projectId);
  const run=writes.catch(function(){}).then(async function(){
   const current=await readRecord(target);
   const currentRevision=current?current.revision:0;
   if(currentRevision!==request.expectedRevision)throw revisionConflict();
   const next=Object.assign({},project,{revision:currentRevision+1});
   const checked=validate(next);
   if(!checked.ok)throw Error('项目记录不完整或版本不支持：'+checked.errors.join('；'));
   const text=JSON.stringify(next,null,2);
   try{
    await writeFileAtomic(target,text,function(readback){
     const verified=validate(JSON.parse(readback));
     if(!verified.ok)throw Error('写入校验失败：'+verified.errors.join('；'));
    });
   }catch(error){
    throw Error('项目保存失败，已保留上一版：'+error.message);
   }
   return {path:target,bytes:Buffer.byteLength(text),revision:next.revision};
  });
  writes=run.catch(function(){});
  return run;
 }
 async function list(){
  let names;
  try{names=await fs.readdir(root);}
  catch(error){
   if(error.code==='ENOENT')return [];
   throw Error('读取项目目录失败：'+error.message);
  }
  const items=[];
  for(const name of names){
   if(!name.endsWith('.json')||name.startsWith('.'))continue;
   const id=name.slice(0,-5);
   if(!ID.test(id))continue;
   let record;
   try{record=await readRecord(path.join(root,name));}catch(_){continue;}
   if(!record)continue;
   items.push({projectId:record.projectId,name:record.name,revision:record.revision,updatedAt:record.updatedAt,
    schemaVersion:record.schemaVersion,fromProjectId:record.fromProjectId||null,
    mergeIdentical:record.mergeIdentical,sourceCount:(record.sources||[]).length,
    stages:Object.keys(record.stages||{}).reduce(function(out,stage){out[stage]=record.stages[stage].state;return out;},{})});
  }
  return items.sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});
 }
 return {directory:root,save:save,load:load,list:list};
}
module.exports={createProjectStore,revisionConflict};
