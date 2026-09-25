const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {create:createHeader,validate:validateHeader}=require('../src/inquiry-header.js');
const SCHEMA_VERSION=1,FILE_NAME='header-templates.json';
function revisionConflict(){
 const error=Error('抬头模板版本冲突：已被其他窗口更新，请重新加载后再保存。');
 error.code='REVISION_CONFLICT';
 return error;
}
function validatePackage(state){
 const errors=[];
 if(!state||typeof state!=='object'||Array.isArray(state))return {ok:false,errors:['抬头模板不是有效对象。']};
 if(state.schemaVersion!==SCHEMA_VERSION)errors.push('抬头模板版本不支持：'+String(state.schemaVersion));
 if(!Number.isSafeInteger(state.revision)||state.revision<0)errors.push('抬头模板版本号无效。');
 if(!Array.isArray(state.templates))errors.push('抬头模板缺少模板列表。');
 else state.templates.forEach(function(template,index){
  const at='第'+(index+1)+'个模板';
  if(!template||typeof template!=='object'){errors.push(at+'无效。');return;}
  if(typeof template.templateId!=='string'||!template.templateId)errors.push(at+'缺少标识。');
  if(typeof template.name!=='string'||!template.name)errors.push(at+'缺少名称。');
  const check=validateHeader(Object.assign({schemaVersion:SCHEMA_VERSION},template.header||{}));
  if(!check.ok)errors.push(at+'抬头不完整：'+check.errors.join('；'));
 });
 return {ok:errors.length===0,errors:errors};
}
function createHeaderStore({directory}={}){
 if(typeof directory!=='string'||!directory.trim())throw Error('抬头模板目录无效，已停止读写。');
 const root=path.resolve(directory),target=path.join(root,FILE_NAME);
 let writes=Promise.resolve();
 async function readDisk(){
  let text;
  try{text=await fs.readFile(target,'utf8');}
  catch(error){
   if(error.code==='ENOENT')return null;
   throw Error('读取抬头模板失败：'+error.message);
  }
  let parsed;
  try{parsed=JSON.parse(text);}
  catch(error){throw Error('抬头模板已损坏，原文件未改动：'+error.message);}
  const check=validatePackage(parsed);
  if(!check.ok)throw Error('抬头模板不完整或版本不支持：'+check.errors.join('；'));
  return parsed;
 }
 async function load(){
  const stored=await readDisk();
  if(!stored)return {schemaVersion:SCHEMA_VERSION,revision:0,templates:[],persisted:false};
  return Object.assign({},stored,{persisted:true});
 }
 function save(input){
  const request=input&&typeof input==='object'?input:{};
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)
   return Promise.reject(Error('保存抬头模板需要有效版本号。'));
  let templates;
  try{
   if(!Array.isArray(request.templates))throw Error('抬头模板缺少模板列表。');
   templates=request.templates.map(function(template,index){
    if(!template||typeof template!=='object')throw Error('第'+(index+1)+'个模板无效。');
    if(typeof template.name!=='string'||!template.name.trim())throw Error('第'+(index+1)+'个模板缺少名称。');
    const header=createHeader();
    Object.keys(header).forEach(function(key){if(key!=='schemaVersion'&&template.header&&template.header[key]!=null)header[key]=String(template.header[key]);});
    const check=validateHeader(header);
    if(!check.ok)throw Error('第'+(index+1)+'个模板抬头不完整：'+check.errors.join('；'));
    return {templateId:String(template.templateId||('t-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8))),
     name:template.name.trim(),header:header,updatedAt:template.updatedAt||new Date().toISOString()};
   });
  }catch(error){return Promise.reject(error);}
  const run=writes.catch(function(){}).then(async function(){
   const current=await readDisk();
   const currentRevision=current?current.revision:0;
   if(currentRevision!==request.expectedRevision)throw revisionConflict();
   const next={schemaVersion:SCHEMA_VERSION,revision:currentRevision+1,templates:templates,
    updatedAt:new Date().toISOString()};
   await fs.mkdir(root,{recursive:true});
   const temporary=path.join(root,'.'+FILE_NAME+'.tmp-'+crypto.randomBytes(6).toString('hex'));
   const text=JSON.stringify(next,null,2);
   try{
    await fs.writeFile(temporary,text,{flag:'wx'});
    const readback=await fs.readFile(temporary,'utf8');
    if(readback!==text)throw Error('写入内容与抬头模板不一致。');
    const verified=validatePackage(JSON.parse(readback));
    if(!verified.ok)throw Error('写入校验失败：'+verified.errors.join('；'));
    await fs.rename(temporary,target);
   }catch(error){
    try{await fs.rm(temporary,{force:true});}catch(_){}
    throw Error('抬头模板保存失败，已保留上一版：'+error.message);
   }
   return {revision:next.revision,path:target,bytes:Buffer.byteLength(text),updatedAt:next.updatedAt};
  });
  writes=run.catch(function(){});
  return run;
 }
 return {directory:root,path:target,load:load,save:save};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,FILE_NAME:FILE_NAME,createHeaderStore:createHeaderStore,validatePackage:validatePackage};
