const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {constants}=require('node:fs');
const {validatePlan,freezeFile}=require('./file-freeze.cjs');
const {readStructure}=require('./xlsx-views.cjs');
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
async function absent(file){try{await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return;throw e;}throw Error('目标文件已存在，请使用新文件名，禁止覆盖。');}
// 相邻暂存清理：提交成功立即删；提交前失败、宿主仍占用或提交失败时，由下一次同目标prepare兜底清理足够陈旧的残留。
// 只匹配本插件自己的隐藏命名（.<同名>.tmp-<12位十六进制>.xlsx），绝不碰用户文件或其他进程的临时文件。
// 删除必须同时满足：命名匹配、本进程登记过所有权、无活跃票据、足够陈旧；服务重启后内存登记丢失，
// 同命名文件一律保守保留并在结果里报告，绝不单靠mtime删除。
const STALE_STAGE_AGE_MS=600000,STAGE_MARK='.tmp-';
function isStaleStageName(name,base){
 if(typeof name!=='string'||name.charAt(0)!=='.')return false;
 var body=name.slice(1);
 if(body.slice(0,base.length)!==base)return false;
 if(body.slice(base.length,base.length+STAGE_MARK.length)!==STAGE_MARK)return false;
 var tail=body.slice(base.length+STAGE_MARK.length);
 if(!/^[0-9a-f]{12}\.xlsx$/i.test(tail))return false;
 return true;
}
// R12-J 补强：目标目录不可写（只读目录/只读卷）时，必须在准备阶段就明确拒绝，而不是等到逐份
// commit 才逐个失败。只创建一个隐藏探测文件并立即删除，不写任何目标文件，也不留下半成品。
async function assertWritableDirectory(destination){
 const parent=path.dirname(destination),base=path.basename(destination);
 for(let attempt=0;attempt<3;attempt++){
  const probe=path.join(parent,'.'+base+'.wchk-'+crypto.randomBytes(6).toString('hex')+'.tmp');
  let handle=null;
  try{handle=await fs.open(probe,'wx');}
  catch(error){
   if(error.code==='EEXIST')continue;
   throw Error('保存目录不可写，未写入任何文件：'+parent+'（'+String(error.code||error.message)+'）');
  }
  try{await handle.close();}catch(_){/* 关闭失败不影响判定 */}
  try{await fs.rm(probe,{force:true});}catch(_){/* 探测文件残留不影响结果 */}
  return;
 }
 throw Error('保存目录不可写，未写入任何文件：'+parent+'（探测文件名连续冲突）');
}
function createExportStore({directory,copyRoot}){
 const tickets=new Map(),owned=new Map(),root=path.resolve(directory),sourceRoot=copyRoot?path.resolve(copyRoot):null;
 function within(rootPath,targetPath){
  const relative=path.relative(rootPath,targetPath);
  return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
 }
 // 只有在本进程prepare里登记过的相邻暂存路径才算“可证明属于本插件”的残留。
 function ownStage(stagePath){owned.set(path.resolve(stagePath),Date.now());}
 function releaseStage(stagePath){owned.delete(path.resolve(stagePath));}
 function activeStagePaths(){var set=new Set();for(var entry of tickets.values())if(!entry.result)set.add(path.resolve(entry.stagePath));return set;}
 // 删除后必须核对文件确实不存在，否则不得报告“已删除”；删除失败的临时文件不影响已发布成功。
 async function removeStage(stagePath){
  try{await fs.rm(stagePath,{force:true});}catch(_){/* rm失败继续按实际存在性判定 */}
  try{await fs.lstat(stagePath);}catch(e){if(e.code==='ENOENT'){releaseStage(stagePath);return true;}return false;}
  return false;
 }
 // 清理接收活跃路径集合：活跃票据（1小时内未发布）的暂存永远保留，mtime再旧也不覆盖所有权。
 async function sweepStaleStages(parent,base,active){
  var report={removed:0,preserved:0,failed:0},names;
  try{names=await fs.readdir(parent);}catch(_){return report;}
  var now=Date.now();
  for(var index=0;index<names.length;index++){
   if(!isStaleStageName(names[index],base))continue;
   var file=path.join(parent,names[index]),key=path.resolve(file);
   if(!owned.has(key)){report.preserved++;continue;}
   if(active.has(key))continue;
   var info;
   try{info=await fs.lstat(file);}
   catch(e){if(e.code==='ENOENT'){releaseStage(file);continue;}report.failed++;continue;}
   if(!info.isFile()||now-info.mtimeMs<STALE_STAGE_AGE_MS)continue;
   if(await removeStage(file))report.removed++;else report.failed++;
  }
  return report;
 }
 async function prepare(target,options){
  if(typeof target!=='string'||target.length>4096||!path.isAbsolute(target)||path.extname(target).toLowerCase()!=='.xlsx'||/[<>:"|?*]|[. ]$/.test(path.basename(target)))throw Error('请选择有效的新xlsx绝对路径。');
  const settings=options&&typeof options==='object'?options:{};
  const freezePlan=settings.freezePlan==null?null:validatePlan(settings.freezePlan);
  // R6：分类工作簿目录（成果批次/分类工作簿）由插件创建，只在显式要求且目标不存在时才建目录。
  if(settings.createParent===true)await fs.mkdir(path.dirname(target),{recursive:true});
  const parent=await fs.realpath(path.dirname(target)),destination=path.join(parent,path.basename(target));
  if(!(await fs.stat(parent)).isDirectory())throw Error('保存目录不存在。');
  await absent(destination);
  await assertWritableDirectory(destination);
  for(const [id,entry] of tickets)if(Date.now()-entry.created>3600000)tickets.delete(id);
  if(tickets.size>=100)throw Error('另存会话过多，请重启开发服务后重试。');
  // 带相对超链接的汇总表必须在最终目录里的唯一相邻暂存生成，否则地址基准会落在中心暂存目录，整目录搬移后链接失效。
  const adjacent=settings.adjacent===true;
  let stagePath,staleCleanup;
  if(adjacent){
   const report=await sweepStaleStages(parent,path.basename(destination),activeStagePaths());
   if(report.removed||report.preserved||report.failed)staleCleanup=report;
   stagePath=path.join(parent,'.'+path.basename(destination)+'.tmp-'+crypto.randomBytes(6).toString('hex')+'.xlsx');
   if(path.dirname(stagePath)!==parent)throw Error('相邻暂存路径越出目标目录，已停止。');
   await absent(stagePath);
   ownStage(stagePath);
  } else {
   await fs.mkdir(root,{recursive:true});const folder=await fs.mkdtemp(path.join(root,'export-'));
   stagePath=path.join(folder,'rfq-'+crypto.randomUUID()+'.xlsx');
  }
  const ticket=crypto.randomBytes(24).toString('hex');
  tickets.set(ticket,{created:Date.now(),target:destination,stagePath,busy:false,result:null,adjacent,freezePlan,freezeResult:null});
  let copiedFrom=null;
  if(settings.copyFrom!=null){
   if(!sourceRoot)throw Error('当前服务未启用来源审核副本复制。');
   if(typeof settings.copyFrom!=='string'||!path.isAbsolute(settings.copyFrom)||
      !/\.(?:xlsx?)$/i.test(settings.copyFrom))throw Error('来源审核副本原文件路径无效。');
   const source=await fs.realpath(settings.copyFrom),rootReal=await fs.realpath(sourceRoot);
   if(!within(rootReal,source))throw Error('来源审核副本只能复制本次导入的工作副本。');
   const info=await fs.stat(source);
   if(!info.isFile()||info.size<4||info.size>256*1024*1024)throw Error('来源审核副本原文件类型或大小不符合限制。');
   try{await fs.copyFile(source,stagePath,constants.COPYFILE_EXCL);}
   catch(error){tickets.delete(ticket);releaseStage(stagePath);throw Error('来源审核副本基础文件复制失败：'+error.message);}
   copiedFrom=source;
  }
  const prepared={ticket,target:destination,stagePath};
  if(copiedFrom)prepared.copiedFrom=copiedFrom;
  if(staleCleanup)prepared.staleCleanup=staleCleanup;
  return prepared;
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
   if(entry.freezePlan){
    if(!entry.freezeResult)throw Error('暂存文件尚未完成文件层冻结，未发布。');
    if(sha256!==entry.freezeResult.sha256)throw Error('冻结后的暂存文件发生变化，未发布。');
   }
   try{await fs.copyFile(entry.stagePath,entry.target,constants.COPYFILE_EXCL);}
   catch(e){if(e.code==='EEXIST')throw Error('目标文件已存在，未覆盖，请使用新文件名。');throw Error('目标文件写入失败：'+e.message);}
   if(digest(await fs.readFile(entry.target))!==sha256)throw Error('另存文件校验失败，请检查目标文件；未确认保存成功。');
   entry.result={target:entry.target,sha256,bytes:bytes.length};
   // 已成功发布并校验，就不能因为清理暂存失败（Windows上宿主可能仍占用）把成功报成失败；残留交给下次prepare清理。
   if(entry.adjacent)await removeStage(entry.stagePath);
   return entry.result;
  }finally{entry.busy=false;}
 }
 // Only a live unpublished server-issued stage may be processed; no caller-supplied file path.
 async function freeze(ticket){
  const entry=tickets.get(ticket);if(!entry||Date.now()-entry.created>3600000)throw Error('另存会话已失效。');
  if(entry.result)throw Error('文件已发布，禁止改写冻结。');
  if(entry.busy)throw Error('暂存文件正在处理。');
  if(!entry.freezePlan)throw Error('该会话未登记文件冻结计划。');
  entry.busy=true;
  try{
   if(entry.freezeResult){if(digest(await fs.readFile(entry.stagePath))!==entry.freezeResult.sha256)throw Error('冻结后的暂存文件发生变化。');return entry.freezeResult;}
   entry.freezeResult=await freezeFile(entry.stagePath,entry.freezePlan);return entry.freezeResult;
  }finally{entry.busy=false;}
 }
 // 失败/取消后由调用方显式清理本次相邻暂存。结构化结果先判 published/busy：
 // 已发布成果与正在独占发布的票据绝不清理（清不掉时如实报告，不虚报已删除）。
 async function discard(ticket){
  const entry=tickets.get(ticket);
  if(!entry)return {discarded:false,reason:'unknown-ticket'};
  if(entry.result)return {discarded:false,reason:'already-published'};
  if(entry.busy)return {discarded:false,reason:'busy'};
  tickets.delete(ticket);
  if(await removeStage(entry.stagePath))return {discarded:true};
  return {discarded:false,reason:'cleanup-failed',stagePath:entry.stagePath};
 }
 async function verify(ticket,target,sha256){
  const entry=tickets.get(ticket);
  if(!entry||Date.now()-entry.created>3600000||!entry.result)throw Error('另存会话已失效，请重新另存内部清单。');
  if(target!==entry.target)throw Error('另存目标与回执不一致，未写入。');
  if(sha256!==entry.result.sha256)throw Error('另存回执不一致，未写入。');
  if(digest(await fs.readFile(entry.target))!==sha256)throw Error('已另存文件发生变化，未写入分类列。');
  return {target:entry.target,sha256:entry.result.sha256};
 }
 // 重启后按记录SHA核对已经发布的文件：不依赖内存票据，已发布未记账（needs-verification）也用同一入口。
 async function inspect(target,expected,options){
  if(typeof target!=='string'||target.length>4096||!path.isAbsolute(target)||path.extname(target).toLowerCase()!=='.xlsx')
   throw Error('请提供有效的xlsx绝对路径。');
  let info;try{info=await fs.lstat(target);}
  catch(e){if(e.code==='ENOENT')return {target,exists:false,sha256:null,bytes:0,matches:false};throw e;}
  if(!info.isFile())throw Error('目标不是文件，未核对。');
  if(info.size>256*1024*1024)throw Error('目标文件过大，未核对。');
  const bytes=await fs.readFile(target),sha256=digest(bytes);
  const result={target,exists:true,sha256,bytes:bytes.length,
   matches:typeof expected==='string'&&expected?sha256===expected.toLowerCase():null};
  if(options&&options.structure===true)result.sheets=readStructure(bytes);
  return result;
 }
 return {prepare,freeze,commit,verify,inspect,discard};
}
module.exports={createExportStore};
