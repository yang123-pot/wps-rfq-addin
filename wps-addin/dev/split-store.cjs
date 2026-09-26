const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {writeFileAtomic}=require('./atomic-file.cjs');
// 纯逻辑在src/split-state.js里，页面与Node共用一份，避免两份实现漂移。
const state=require('../src/split-state.js');
const SCHEMA_VERSION=state.SCHEMA_VERSION,FILE_NAME='split-receipts.json',STATES=state.STATES;
const validate=state.validate,summarize=state.summarize,create=state.create,mark=state.mark,
 reconcile=state.reconcile,pending=state.pending;
function createSplitStore({directory}={}){
 if(typeof directory!=='string'||!directory.trim())throw Error('拆分回执目录无效，已停止读写。');
 const root=path.resolve(directory),target=path.join(root,FILE_NAME);
 let writes=Promise.resolve();
 async function readDisk(){
  let raw;
  try{raw=await fs.readFile(target,'utf8');}
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
 async function load(){return readDisk();}
 function save(receipt){
  const check=validate(receipt);
  if(!check.ok)return Promise.reject(Error('拆分回执不完整：'+check.errors.join('；')));
  const run=writes.catch(function(){}).then(async function(){
   const text=JSON.stringify(receipt,null,2);
   try{
    await writeFileAtomic(target,text,function(readback){
     const verified=validate(JSON.parse(readback));
     if(!verified.ok)throw Error('写入校验失败：'+verified.errors.join('；'));
    });
   }catch(error){
    throw Error('拆分回执保存失败，已保留上一版：'+error.message);
   }
   return {path:target,bytes:Buffer.byteLength(text),updatedAt:receipt.updatedAt||null};
  });
  writes=run.catch(function(){});
  return run;
 }
 return {directory:root,path:target,load:load,save:save};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,FILE_NAME:FILE_NAME,STATES:STATES,validate:validate,summarize:summarize,
 create:create,mark:mark,reconcile:reconcile,pending:pending,createSplitStore:createSplitStore};
