'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {patchWorkbook}=require('./xlsx-views.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function validatePlan(plan){
 if(!Array.isArray(plan)||!plan.length||plan.length>1000)throw Error('文件冻结计划无效。');
 const names=new Set();let frozen=0;
 const result=plan.map(item=>{
  if(!item||typeof item.name!=='string'||!item.name||item.name.length>31||/[\[\]:*?\/\\\x00-\x1f]/.test(item.name)||names.has(item.name.toLowerCase()))throw Error('文件冻结工作表名重复或无效。');
  names.add(item.name.toLowerCase());if(item.freeze==null)return {name:item.name,freeze:null};
  const {row,column}=item.freeze;
  if(!Number.isSafeInteger(row)||row<1||row>1048576||!Number.isSafeInteger(column)||column<1||column>16384||(row===1&&column===1))throw Error('文件冻结位置无效。');
  frozen++;return {name:item.name,freeze:{row,column}};
 });
 if(!frozen)throw Error('文件冻结计划没有冻结区域。');return result;
}
async function freezeFile(stagePath,plan){
 const info=await fs.lstat(stagePath);if(!info.isFile()||info.size<4||info.size>256*1024*1024)throw Error('冻结暂存文件类型或大小无效。');
 const original=await fs.readFile(stagePath),before=digest(original),id=crypto.randomBytes(12).toString('hex'),directory=path.dirname(stagePath),
  temporary=path.join(directory,'rfq-layout-'+id+'.xlsx');
 let owned=false;
 try{
  const result=patchWorkbook(original,plan);
  const handle=await fs.open(temporary,'wx');owned=true;
  try{await handle.writeFile(result.bytes);}finally{await handle.close();}
  if(!result||result.sheets!==plan.filter(s=>s.freeze).length)throw Error('冻结写入回执不完整，未发布。');
  if(digest(await fs.readFile(stagePath))!==before)throw Error('暂存文件在冻结处理期间发生变化，未替换。');
  const bytes=await fs.readFile(temporary),sha256=digest(bytes);
  await fs.rename(temporary,stagePath);
  return {sha256,sheets:result.sheets};
 }finally{if(owned)await fs.rm(temporary,{force:true}).catch(()=>{});}
}
module.exports={validatePlan,freezeFile};
