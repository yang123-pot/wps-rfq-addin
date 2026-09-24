const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {validate}=require('../src/project.js');
const ID=/^[a-z0-9-]{8,64}$/;
function createProjectStore({directory}){
 const root=path.resolve(directory);
 function fileOf(id){
  if(typeof id!=='string'||!ID.test(id))throw Error('项目编号无效，已停止读写。');
  return path.join(root,id+'.json');
 }
 async function save(project){
  const check=validate(project);
  if(!check.ok)throw Error('项目记录不完整或版本不支持：'+check.errors.join('；'));
  const target=fileOf(project.projectId);
  await fs.mkdir(root,{recursive:true});
  const temporary=path.join(root,'.'+project.projectId+'.tmp-'+crypto.randomBytes(6).toString('hex'));
  const text=JSON.stringify(project,null,2);
  try{
   await fs.writeFile(temporary,text,{flag:'wx'});
   const readback=await fs.readFile(temporary,'utf8');
   if(readback!==text)throw Error('写入内容与项目记录不一致。');
   const parsed=JSON.parse(readback);
   const verified=validate(parsed);
   if(!verified.ok)throw Error('写入校验失败：'+verified.errors.join('；'));
   await fs.rename(temporary,target);
  } catch(error){
   try{await fs.rm(temporary,{force:true});}catch(_){}
   throw Error('项目保存失败，已保留上一版：'+error.message);
  }
  return {path:target,bytes:Buffer.byteLength(text)};
 }
 async function load(id){
  const file=fileOf(id);
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
   try{record=await load(id);}catch(_){continue;}
   if(!record)continue;
   items.push({projectId:record.projectId,name:record.name,revision:record.revision,updatedAt:record.updatedAt,
    mergeIdentical:record.mergeIdentical,sourceCount:(record.sources||[]).length,
    stages:Object.keys(record.stages||{}).reduce(function(out,stage){out[stage]=record.stages[stage].state;return out;},{})});
  }
  return items.sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});
 }
 return {directory:root,save:save,load:load,list:list};
}
module.exports={createProjectStore};
