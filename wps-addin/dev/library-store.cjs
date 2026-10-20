const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {writeFileAtomic}=require('./atomic-file.cjs');
const {validate:validateLibrary}=require('../src/category-library.js');
const {validate:validateMemory,create:createMemory}=require('../src/category-memory.js');
const operations=require('../src/library-operations.js'),query=require('./library-query.cjs');
const SCHEMA_VERSION=1,FILE_NAME='library-state.json';

function revisionConflict(message){
 const error=Error(message||'分类库版本冲突：已被其他窗口更新，请重新加载后再保存。');
 error.code='REVISION_CONFLICT';
 return error;
}
function validatePackage(state){
 const errors=[];
 if(!state||typeof state!=='object'||Array.isArray(state))return {ok:false,errors:['分类库状态不是有效对象。']};
 if(state.schemaVersion!==SCHEMA_VERSION)errors.push('分类库状态版本不支持：'+String(state.schemaVersion));
 if(!Number.isSafeInteger(state.revision)||state.revision<0)errors.push('分类库状态版本号无效。');
 if(state.library==null)errors.push('分类库状态缺少分类库。');
 else validateLibrary(state.library).errors.forEach(function(message){errors.push('分类库：'+message);});
 if(state.memory==null)errors.push('分类库状态缺少习惯记忆。');
 else validateMemory(state.memory).errors.forEach(function(message){errors.push('习惯记忆：'+message);});
 return {ok:errors.length===0,errors:errors};
}
function assertValidPackage(state){
 const check=validatePackage(state);
 if(!check.ok)throw Error('分类库状态不完整或版本不支持：'+check.errors.join('；'));
 return state;
}

function createLibraryStore({directory,defaults}={}){
 if(typeof directory!=='string'||!directory.trim())throw Error('分类库目录无效，已停止读写。');
 const root=path.resolve(directory),target=path.join(root,FILE_NAME);
 let bundled=defaults||null,writes=Promise.resolve(),cached=null,cacheKey=null,index=null;
 async function defaultLibrary(){
  if(bundled)return JSON.parse(JSON.stringify(bundled));
  const text=await fs.readFile(path.join(__dirname,'..','rules','defaults.json'),'utf8');
  bundled=JSON.parse(text);
  return JSON.parse(JSON.stringify(bundled));
 }
 async function fresh(){
  const library=await defaultLibrary(),check=validateLibrary(library);
  if(!check.ok)throw Error('默认分类库不可用：'+check.errors.join('；'));
  return {schemaVersion:SCHEMA_VERSION,revision:0,library:library,memory:createMemory(),updatedAt:null,persisted:false};
 }
 async function readDisk(){
  let text;
  let key;
  try{const stat=await fs.stat(target);key=[stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');
   if(cached&&key===cacheKey)return cached;
   text=await fs.readFile(target,'utf8');}
  catch(error){
   if(error.code==='ENOENT'){cached=null;cacheKey=null;index=null;return null;}
   throw Error('读取分类库状态失败：'+error.message);
  }
  let parsed;
  try{parsed=JSON.parse(text);}
  catch(error){throw Error('分类库状态已损坏，原文件未改动：'+error.message);}
  cached=assertValidPackage(parsed);cacheKey=key;index=null;return cached;
 }
 async function load(){
  const stored=await readDisk();
  if(!stored)return fresh();
  return {...JSON.parse(JSON.stringify(stored)),persisted:true};
 }
 async function snapshot(){return (await readDisk())||fresh();}
 async function writeNext(current,library,memory){
  const next={schemaVersion:SCHEMA_VERSION,revision:current.revision+1,library,memory,updatedAt:new Date().toISOString()};
  assertValidPackage(next);
  const text=JSON.stringify(next,null,2);
  try{await writeFileAtomic(target,text,function(readback){assertValidPackage(JSON.parse(readback));});}
  catch(error){throw Error('分类库保存失败，已保留上一版：'+error.message);}
  cached=null;cacheKey=null;index=null;
  return {revision:next.revision,path:target,bytes:Buffer.byteLength(text),updatedAt:next.updatedAt};
 }
 function mutate(request){
  if(!Number.isSafeInteger(request?.expectedRevision)||request.expectedRevision<0)return Promise.reject(Error('修改分类库需要有效版本号。'));
  const input=JSON.parse(JSON.stringify(request));
  const run=writes.catch(function(){}).then(async()=>{
   const current=await snapshot();if(current.revision!==input.expectedRevision)throw revisionConflict();
   const next=operations.apply(current,input.operation);return writeNext(current,next.library,next.memory);
  });writes=run.catch(function(){});return run;
 }
 function save(input){
  const request=input&&typeof input==='object'?input:{};
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)
   return Promise.reject(Error('保存分类库需要有效版本号。'));
  let library,memory;
  try{
   const libraryCheck=validateLibrary(request.library);
   if(!libraryCheck.ok)throw Error('分类库不完整：'+libraryCheck.errors.join('；'));
   if(!request.memory)throw Error('保存分类库需要习惯记忆。');
   const memoryCheck=validateMemory(request.memory);
   if(!memoryCheck.ok)throw Error('习惯记忆不完整：'+memoryCheck.errors.join('；'));
   library=JSON.parse(JSON.stringify(request.library));
   memory=JSON.parse(JSON.stringify(request.memory));
  }catch(error){return Promise.reject(error);}
  const run=writes.catch(function(){}).then(async function(){
   const current=await readDisk();
   const currentRevision=current?current.revision:0;
   if(currentRevision!==request.expectedRevision)throw revisionConflict();
   return writeNext({revision:currentRevision},library,memory);
  });
  writes=run.catch(function(){});
  return run;
 }
 return {directory:root,path:target,load:load,save:save,mutate,
  summary:async()=>query.summary(await snapshot()),page:async q=>query.page(await snapshot(),q),
  classifyIndex:async()=>{const s=await snapshot();if(!index||index.revision!==s.revision)index=query.classifyIndex(s);return index;},
  preview:async q=>{const s=await snapshot();return {revision:s.revision,...operations.previewMerge(s,q.sourceIds,q.targetId)};},
  similar:async q=>{const s=await snapshot();return {revision:s.revision,items:operations.similar(s,q.categoryId)};},
  detail:async q=>{const s=await snapshot(),m=s.memory.memories.find(x=>x.id===q.memoryId);if(!m)throw Error('学习经验不存在。');return {revision:s.revision,item:m};}};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,FILE_NAME:FILE_NAME,createLibraryStore:createLibraryStore,validatePackage:validatePackage};
