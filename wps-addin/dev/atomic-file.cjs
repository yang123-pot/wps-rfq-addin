const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
// Windows上如果目标文件正好被别的句柄打开（例如侧栏正在读同一份数据），rename会报EPERM/EACCES/EBUSY。
// 这种情况通常是短时的，退避重试即可；重试仍失败就保留上一版并如实报错。
const RETRY_CODES=['EPERM','EACCES','EBUSY','ENOTEMPTY'],DEFAULT_ATTEMPTS=12,MAX_BACKOFF=250;
async function replaceWithRetry(temporary,target,attempts){
 const total=attempts||DEFAULT_ATTEMPTS;
 for(let index=1;index<=total;index++){
  try{await fs.rename(temporary,target);return;}
  catch(error){
   if(RETRY_CODES.indexOf(error.code)<0||index===total)throw error;
   await new Promise(function(resolve){setTimeout(resolve,Math.min(25*index,MAX_BACKOFF));});
  }
 }
}
async function writeFileAtomic(target,text,verify){
 const directory=path.dirname(target);
 await fs.mkdir(directory,{recursive:true});
 const temporary=path.join(directory,'.'+path.basename(target)+'.tmp-'+crypto.randomBytes(6).toString('hex'));
 try{
  await fs.writeFile(temporary,text,{flag:'wx'});
  const readback=await fs.readFile(temporary,'utf8');
  if(readback!==text)throw Error('写入内容与预期不一致。');
  if(verify)verify(readback);
  await replaceWithRetry(temporary,target);
 }catch(error){
  try{await fs.rm(temporary,{force:true});}catch(_){}
  throw error;
 }
 return target;
}
module.exports={writeFileAtomic:writeFileAtomic,replaceWithRetry:replaceWithRetry,RETRY_CODES:RETRY_CODES.slice()};
