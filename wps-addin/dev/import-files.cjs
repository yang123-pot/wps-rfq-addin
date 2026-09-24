const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
function key(value){return path.resolve(value).replace(/\\/g,'/').toLowerCase();}
function inside(parent,child){return key(child).startsWith(key(parent)+'/');}

async function prepareFiles(paths,{directory,existing=[],maxFileBytes=64*1024*1024,maxBatchBytes=256*1024*1024}) {
  if(!Array.isArray(paths)||!paths.length||paths.length>20) throw new Error('每批请选择1至20个xls/xlsx文件。');
  if(!Array.isArray(existing)||existing.length>100) throw new Error('已导入文件列表无效或超过100份。');
  const root=path.resolve(directory), identities=new Set(), fingerprints=new Set();
  existing.forEach(m=>{
    if(!m||typeof m.originalPath!=='string'||!path.isAbsolute(m.originalPath)||!/^[a-f\d]{64}$/i.test(m.fingerprint)) throw new Error('已导入文件标识无效。');
    identities.add(key(m.originalPath));fingerprints.add(m.fingerprint.toLowerCase());
  });
  const staged=[];let total=0;
  for(const input of paths){
    if(typeof input!=='string'||input.length>4096||!path.isAbsolute(input)) throw new Error('请选择有效的文件绝对路径。');
    if(!['.xls','.xlsx'].includes(path.extname(input).toLowerCase())) throw new Error('只支持xls/xlsx清单文件。');
    let originalPath,handle;
    try {
      originalPath=await fs.realpath(input);
      if(inside(root,originalPath)) throw new Error('不能将插件工作副本再次作为原件导入。');
      if(identities.has(key(originalPath))) throw new Error('重复导入同一路径：'+path.basename(originalPath));
      handle=await fs.open(originalPath,'r');
      const before=await handle.stat();
      if(!before.isFile()||before.size===0||before.size>maxFileBytes) throw new Error('文件类型或大小不符合限制：'+path.basename(originalPath));
      total+=before.size;if(total>maxBatchBytes) throw new Error('本批文件总大小超过限制。');
      const buffer=Buffer.alloc(before.size+1);let size=0;
      while(size<buffer.length){const r=await handle.read(buffer,size,buffer.length-size,null);if(!r.bytesRead)break;size+=r.bytesRead;}
      const after=await handle.stat();
      if(size!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino) throw new Error('文件在复制准备时发生变化，请保存后重试。');
      const bytes=buffer.subarray(0,size),fingerprint=crypto.createHash('sha256').update(bytes).digest('hex');
      if(fingerprints.has(fingerprint)) throw new Error('重复导入相同文件内容：'+path.basename(originalPath));
      identities.add(key(originalPath));fingerprints.add(fingerprint);
      staged.push({bytes,originalPath,originalName:path.basename(originalPath),fingerprint});
    } catch(error) {throw new Error('无法读取“'+path.basename(input)+'”：'+error.message);}
    finally {if(handle)await handle.close();}
  }
  await fs.mkdir(root,{recursive:true});
  const batch=await fs.mkdtemp(path.join(root,'import-'));
  try {
    const files=[];
    for(let i=0;i<staged.length;i++){
      const {bytes,...meta}=staged[i],folder=path.join(batch,String(i+1));await fs.mkdir(folder);
      // WPS refuses simultaneous books with equal basenames, even in different folders.
      const copyPath=path.join(folder,'rfq-'+crypto.randomUUID()+path.extname(meta.originalName));await fs.writeFile(copyPath,bytes,{flag:'wx'});
      files.push({...meta,copyPath});
    }
    await fs.writeFile(path.join(batch,'manifest.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),files},null,2),{flag:'wx'});
    return files;
  } catch(error) {
    if(inside(root,batch)&&path.basename(batch).startsWith('import-')) await fs.rm(batch,{recursive:true,force:true});
    throw new Error('工作副本创建失败：'+error.message);
  }
}
async function restoreCopy(meta,{directory,maxFileBytes=64*1024*1024}){
  if(!meta||typeof meta.originalPath!=='string'||!path.isAbsolute(meta.originalPath)||
    typeof meta.copyPath!=='string'||!path.isAbsolute(meta.copyPath)||!/^[a-f\d]{64}$/i.test(meta.fingerprint||''))
    throw new Error('项目来源标识无效，无法检查工作副本。');
  const root=path.resolve(directory);
  try{const info=await fs.lstat(meta.copyPath);if(info.isFile())return {copyPath:meta.copyPath,rebuilt:false,fingerprint:meta.fingerprint};}
  catch(error){if(error.code!=='ENOENT')throw new Error('检查工作副本失败：'+error.message);}
  let originalPath;
  try{originalPath=await fs.realpath(meta.originalPath);}
  catch(_){throw new Error('原件不存在或无法读取，请重新导入：'+path.basename(meta.originalPath));}
  const handle=await fs.open(originalPath,'r');
  try{
    const before=await handle.stat();
    if(!before.isFile()||before.size===0||before.size>maxFileBytes)throw new Error('原件类型或大小不符合限制，未重建副本。');
    const buffer=Buffer.alloc(before.size+1);let size=0;
    while(size<buffer.length){const read=await handle.read(buffer,size,buffer.length-size,null);if(!read.bytesRead)break;size+=read.bytesRead;}
    const after=await handle.stat();
    if(size!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino)
      throw new Error('原件在重建副本时发生变化，请保存后重试。');
    const bytes=buffer.subarray(0,size),fingerprint=crypto.createHash('sha256').update(bytes).digest('hex');
    if(fingerprint!==meta.fingerprint.toLowerCase())throw new Error('原件内容已变化，与保存项目时不一致；旧进度不能沿用，请重新导入。');
    await fs.mkdir(root,{recursive:true});
    const batch=await fs.mkdtemp(path.join(root,'rebuild-'));
    const copyPath=path.join(batch,'rfq-'+crypto.randomUUID()+path.extname(String(meta.originalName||originalPath)));
    try{await fs.writeFile(copyPath,bytes,{flag:'wx'});}
    catch(error){await fs.rm(batch,{recursive:true,force:true});throw error;}
    return {copyPath,rebuilt:true,fingerprint};
  } finally {await handle.close();}
}
module.exports={prepareFiles,restoreCopy};
