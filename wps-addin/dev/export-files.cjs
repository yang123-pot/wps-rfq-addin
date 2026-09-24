const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {constants}=require('node:fs');
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
async function absent(file){try{await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return;throw e;}throw Error('目标文件已存在，请使用新文件名，禁止覆盖。');}
function createExportStore({directory}){
 const tickets=new Map(),root=path.resolve(directory);
 async function prepare(target){
  if(typeof target!=='string'||target.length>4096||!path.isAbsolute(target)||path.extname(target).toLowerCase()!=='.xlsx'||/[<>:"|?*]|[. ]$/.test(path.basename(target)))throw Error('请选择有效的新xlsx绝对路径。');
  const parent=await fs.realpath(path.dirname(target)),destination=path.join(parent,path.basename(target));
  if(!(await fs.stat(parent)).isDirectory())throw Error('保存目录不存在。');
  await absent(destination);
  for(const [id,entry] of tickets)if(Date.now()-entry.created>3600000)tickets.delete(id);
  if(tickets.size>=100)throw Error('另存会话过多，请重启开发服务后重试。');
  await fs.mkdir(root,{recursive:true});const folder=await fs.mkdtemp(path.join(root,'export-'));
  const ticket=crypto.randomBytes(24).toString('hex'),stagePath=path.join(folder,'rfq-'+crypto.randomUUID()+'.xlsx');
  tickets.set(ticket,{created:Date.now(),target:destination,stagePath,busy:false,result:null});
  return {ticket,target:destination,stagePath};
 }
 async function commit(ticket){
  const entry=tickets.get(ticket);if(!entry||Date.now()-entry.created>3600000)throw Error('另存会话已失效，请重新选择位置。');
  if(entry.busy)throw Error('文件正在另存，请稍后检查结果。');entry.busy=true;
  try{
   if(entry.result){
    if(digest(await fs.readFile(entry.target))!==entry.result.sha256)throw Error('已另存文件发生变化，请检查目标文件。');
    return entry.result;
   }
   let bytes;try{
    const info=await fs.lstat(entry.stagePath);
    if(!info.isFile()||info.size<4||info.size>256*1024*1024)throw Error('暂存文件类型或大小不符合限制。');
    bytes=await fs.readFile(entry.stagePath);
   }catch(e){throw Error('无法读取WPS暂存文件：'+e.message);}
   if(!bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4])))throw Error('暂存文件不是xlsx容器，未另存。');
   const sha256=digest(bytes);
   try{await fs.copyFile(entry.stagePath,entry.target,constants.COPYFILE_EXCL);}
   catch(e){if(e.code==='EEXIST')throw Error('目标文件已存在，未覆盖，请使用新文件名。');throw Error('目标文件写入失败：'+e.message);}
   if(digest(await fs.readFile(entry.target))!==sha256)throw Error('另存文件校验失败，请检查目标文件；未确认保存成功。');
   entry.result={target:entry.target,sha256,bytes:bytes.length};return entry.result;
  }finally{entry.busy=false;}
 }
 async function verify(ticket,target,sha256){
  const entry=tickets.get(ticket);
  if(!entry||Date.now()-entry.created>3600000||!entry.result)throw Error('另存会话已失效，请重新另存内部清单。');
  if(target!==entry.target)throw Error('另存目标与回执不一致，未写入。');
  if(sha256!==entry.result.sha256)throw Error('另存回执不一致，未写入。');
  if(digest(await fs.readFile(entry.target))!==sha256)throw Error('已另存文件发生变化，未写入分类列。');
  return {target:entry.target,sha256:entry.result.sha256};
 }
 return {prepare,commit,verify};
}
module.exports={createExportStore};
