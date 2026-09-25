const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {validate:validateLibrary}=require('../src/category-library.js');
const {validate:validateMemory,create:createMemory}=require('../src/category-memory.js');
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
 let bundled=defaults||null,writes=Promise.resolve();
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
  try{text=await fs.readFile(target,'utf8');}
  catch(error){
   if(error.code==='ENOENT')return null;
   throw Error('读取分类库状态失败：'+error.message);
  }
  let parsed;
  try{parsed=JSON.parse(text);}
  catch(error){throw Error('分类库状态已损坏，原文件未改动：'+error.message);}
  return assertValidPackage(parsed);
 }
 async function load(){
  const stored=await readDisk();
  if(!stored)return fresh();
  return {...stored,persisted:true};
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
   const next={schemaVersion:SCHEMA_VERSION,revision:currentRevision+1,library:library,memory:memory,
    updatedAt:new Date().toISOString()};
   await fs.mkdir(root,{recursive:true});
   const temporary=path.join(root,'.'+FILE_NAME+'.tmp-'+crypto.randomBytes(6).toString('hex'));
   const text=JSON.stringify(next,null,2);
   try{
    await fs.writeFile(temporary,text,{flag:'wx'});
    const readback=await fs.readFile(temporary,'utf8');
    if(readback!==text)throw Error('写入内容与分类库状态不一致。');
    assertValidPackage(JSON.parse(readback));
    await fs.rename(temporary,target);
   }catch(error){
    try{await fs.rm(temporary,{force:true});}catch(_){}
    throw Error('分类库保存失败，已保留上一版：'+error.message);
   }
   return {revision:next.revision,path:target,bytes:Buffer.byteLength(text),updatedAt:next.updatedAt};
  });
  writes=run.catch(function(){});
  return run;
 }
 return {directory:root,path:target,load:load,save:save};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,FILE_NAME:FILE_NAME,createLibraryStore:createLibraryStore,validatePackage:validatePackage};
