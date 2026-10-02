const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {createExportStore}=require('../dev/export-files.cjs');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-export-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,store:createExportStore({directory:path.join(root,'staging')}),target:path.join(root,'清单.xlsx')};}
const zip=Buffer.from([0x50,0x4b,0x03,0x04,1,2,3,4]);
test('prepares a new target, publishes exact bytes and supports idempotent result checks',async t=>{
 const {store,target,root}=await fixture(t),p=await store.prepare(target);assert.notEqual(p.stagePath,target);
 await fs.writeFile(p.stagePath,zip);const result=await store.commit(p.ticket);
 assert.deepEqual(await fs.readFile(target),zip);assert.equal(result.bytes,zip.length);assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(await store.commit(p.ticket),result);
 assert.deepEqual(await store.verify(p.ticket,target,result.sha256),{target,sha256:result.sha256});
 await assert.rejects(store.verify('unknown',target,result.sha256),/会话/);
 await assert.rejects(store.verify(p.ticket,path.join(root,'other.xlsx'),result.sha256),/目标/);
 await assert.rejects(store.verify(p.ticket,target,'0'.repeat(64)),/回执/);
 await fs.writeFile(target,'user changed');await assert.rejects(store.commit(p.ticket),/变化/);
 await assert.rejects(store.verify(p.ticket,target,result.sha256),/变化/);
});
test('rejects existing target including a race after preparation and never overwrites it',async t=>{
 const {store,target}=await fixture(t),p=await store.prepare(target);await fs.writeFile(p.stagePath,zip);await fs.writeFile(target,'existing');
 await assert.rejects(store.commit(p.ticket),/存在/);assert.equal(await fs.readFile(target,'utf8'),'existing');
 await assert.rejects(store.prepare(target),/存在/);
});
test('invalid destinations, tickets and incomplete stage files cannot be published',async t=>{
 const {store,target,root}=await fixture(t);
 for(const name of ['relative.xlsx',path.join(root,'out.xls'),path.join(root,'no-directory','out.xlsx'),path.join(root,'bad:name.xlsx')])await assert.rejects(store.prepare(name));
 await assert.rejects(store.commit('unknown'),/会话/);const p=await store.prepare(target);
 await assert.rejects(store.commit(p.ticket),/暂存/);await fs.writeFile(p.stagePath,'not xlsx');await assert.rejects(store.commit(p.ticket),/xlsx/);
 assert.equal(await fs.stat(target).then(()=>true,()=>false),false);
});
test('相邻暂存把链接基准放在最终目录：唯一命名、独占发布、成功后不留临时文件',async t=>{
 const {store,target,root}=await fixture(t);
 const first=await store.prepare(target,{adjacent:true});
 assert.equal(path.dirname(first.stagePath),path.dirname(target),'暂存文件必须与最终汇总表同目录');
 assert.match(path.basename(first.stagePath),/^\.清单\.xlsx\.tmp-[0-9a-f]{12}\.xlsx$/,'相邻暂存使用唯一隐藏名');
 assert.equal(first.stagePath.startsWith(path.join(root,'staging')),false,'相邻暂存不得落在中心暂存目录');
 const secondTarget=path.join(root,'另一份.xlsx'),second=await store.prepare(secondTarget,{adjacent:true});
 assert.notEqual(first.stagePath,second.stagePath,'同一目录并发暂存必须唯一');
 await fs.writeFile(first.stagePath,zip);
 const result=await store.commit(first.ticket);
 assert.deepEqual(await fs.readFile(target),zip);
 assert.equal(await fs.stat(first.stagePath).then(()=>true,()=>false),false,'发布成功后不得留下相邻临时文件');
 assert.deepEqual(await store.verify(first.ticket,target,result.sha256),{target,sha256:result.sha256});
 await fs.writeFile(second.stagePath,zip);
 await fs.writeFile(secondTarget,'existing','utf8');
 await assert.rejects(store.commit(second.ticket),/存在/,'相邻暂存同样禁止覆盖已有目标');
 assert.equal(await fs.readFile(secondTarget,'utf8'),'existing');
 await assert.rejects(store.prepare(target,{adjacent:true}),/存在/);
});
test('相邻暂存失败时保留临时文件便于排查，且不会创建中心暂存目录',async t=>{
 const {store,target,root}=await fixture(t),p=await store.prepare(target,{adjacent:true});
 await fs.writeFile(p.stagePath,'not xlsx');
 await assert.rejects(store.commit(p.ticket),/xlsx/);
 assert.ok(await fs.stat(p.stagePath),'失败时保留暂存文件供排查');
 assert.equal(await fs.stat(path.join(root,'staging')).then(()=>true,()=>false),false,'相邻模式不建中心暂存目录');
});
// R12真机遗留观察①：生成失败/取消必须在成果目录里清掉本次点号暂存，已发布的成功不得被"丢弃"。
test('失败或取消后discard清掉本次相邻暂存，已发布则拒绝丢弃',async t=>{
 const {store,target}=await fixture(t);
 const aborted=await store.prepare(target,{adjacent:true});
 await fs.writeFile(aborted.stagePath,zip);
 assert.deepEqual(await store.discard(aborted.ticket),{discarded:true});
 assert.equal(await fs.stat(aborted.stagePath).then(()=>true,()=>false),false,'取消后不得留下点号临时文件');
 assert.deepEqual(await store.discard('unknown'),{discarded:false,reason:'unknown-ticket'});
 const done=await store.prepare(target,{adjacent:true});
 await fs.writeFile(done.stagePath,zip);
 const result=await store.commit(done.ticket);
 assert.deepEqual(await store.discard(done.ticket),{discarded:false,reason:'already-published'});
 assert.deepEqual(await fs.readFile(target),zip);
 assert.equal(result.bytes,zip.length);
});
// R12-B复现①：discard先删票据再判published，会让已经发布的成果在discard后verify失败，清理因此可能误伤成功成果。
test('published discard preserves verification',async t=>{
 const {store,target}=await fixture(t),p=await store.prepare(target,{adjacent:true});
 await fs.writeFile(p.stagePath,zip);const result=await store.commit(p.ticket);
 assert.deepEqual(await store.discard(p.ticket),{discarded:false,reason:'already-published'},'已发布票据必须被判为already-published');
 assert.deepEqual(await store.verify(p.ticket,target,result.sha256),{target,sha256:result.sha256},'discard后已发布票据仍必须能verify');
 assert.deepEqual(await fs.readFile(target),zip,'已发布成果不得被清理破坏');
});
// R12-B复现②：陈旧清理只按mtime会删掉11分钟前写入、但仍在1小时有效票据内的活跃暂存，破坏后续发布。
test('stale sweep preserves active ticket',async t=>{
 const {store,target,root}=await fixture(t),active=await store.prepare(target,{adjacent:true});
 await fs.writeFile(active.stagePath,zip);
 const elevenMinutesAgo=new Date(Date.now()-11*60*1000);
 await fs.utimes(active.stagePath,elevenMinutesAgo,elevenMinutesAgo);
 await store.prepare(path.join(root,'另一份.xlsx'),{adjacent:true});
 assert.equal(await fs.stat(active.stagePath).then(()=>true,()=>false),true,'1小时内有效票据的活跃暂存不得因mtime较旧被清理');
 const result=await store.commit(active.ticket);
 assert.deepEqual(await fs.readFile(target),zip,'活跃暂存仍在时必须能正常独占发布');
 assert.deepEqual(await store.verify(active.ticket,target,result.sha256),{target,sha256:result.sha256});
});
// R12-B：正在提交（busy）的票据不得被discard删掉暂存，否则会破坏独占发布与幂等结果。
test('busy discard keeps the in-flight stage',async t=>{
 const {store,target}=await fixture(t),p=await store.prepare(target,{adjacent:true});
 await fs.writeFile(p.stagePath,zip);
 const committing=store.commit(p.ticket);
 assert.deepEqual(await store.discard(p.ticket),{discarded:false,reason:'busy'},'提交中的票据必须被判为busy且不清暂存');
 const result=await committing;
 assert.deepEqual(await fs.readFile(target),zip,'busy时未清理，提交仍应成功独占发布');
 assert.deepEqual(await store.verify(p.ticket,target,result.sha256),{target,sha256:result.sha256});
});
// R12-B：清理只认真实登记过所有权的暂存；用户同名文件与无所有权证明的同名残留一律不动，并如实报告。
test('cleanup preserves user files and reports unowned same-name residue',async t=>{
 const {store,target,root}=await fixture(t);
 const residue=path.join(root,'.清单.xlsx.tmp-0123456789ab.xlsx');
 const old=new Date(Date.now()-2*3600000);
 await fs.writeFile(residue,zip);await fs.utimes(residue,old,old);
 const prepared=await store.prepare(target,{adjacent:true});
 assert.equal(await fs.stat(residue).then(()=>true,()=>false),true,'无所有权证明的同名残留必须保守保留');
 assert.ok(prepared.staleCleanup&&prepared.staleCleanup.preserved>=1,'保守保留的残留要报告，而不是静默删除或静默忽略');
 assert.deepEqual(await fs.readFile(residue),zip,'用户同名残留内容不得被改写');
 await fs.writeFile(target,'用户自己放的同名文件','utf8');
 await assert.rejects(store.prepare(target,{adjacent:true}),/存在/,'目标已存在必须继续拒绝');
 assert.equal(await fs.readFile(target,'utf8'),'用户自己放的同名文件','用户同名文件不得被覆盖');
});
// R12-B：只有本进程登记过所有权、票据已失效（>1小时）且足够陈旧的残留才清理；服务重启后无登记不得靠mtime删除。
test('只有登记过所有权且票据失效的陈旧暂存才被清理，服务重启后同名残留保守保留',async t=>{
 const {store,target,root}=await fixture(t),real=Date.now();
 t.mock.timers.enable({apis:['Date'],now:real});
 const abandoned=await store.prepare(target,{adjacent:true});
 await fs.writeFile(abandoned.stagePath,zip);
 const elevenMinutesAgo=new Date(real-11*60*1000);
 await fs.utimes(abandoned.stagePath,elevenMinutesAgo,elevenMinutesAgo);
 t.mock.timers.setTime(real+61*60*1000);
 const next=await store.prepare(target,{adjacent:true});
 assert.equal(await fs.stat(abandoned.stagePath).then(()=>true,()=>false),false,'本进程登记过且票据失效的陈旧暂存应被清理');
 assert.ok(next.staleCleanup&&next.staleCleanup.removed>=1,'真实清理要计数');
 const restarted=createExportStore({directory:path.join(root,'staging')});
 const leftover=path.join(root,'.清单.xlsx.tmp-fedcba987654.xlsx');
 await fs.writeFile(leftover,zip);await fs.utimes(leftover,elevenMinutesAgo,elevenMinutesAgo);
 const afterRestart=await restarted.prepare(target,{adjacent:true});
 assert.equal(await fs.stat(leftover).then(()=>true,()=>false),true,'服务重启后无所有权证明的同名残留不得靠mtime删除');
 assert.ok(afterRestart.staleCleanup&&afterRestart.staleCleanup.preserved>=1,'重启后保守保留的残留要报告');
});
// R12-B：清理只看同目标的暂存；其他目标的点号暂存和不匹配插件命名规则的普通文件一律不动。
test('cleanup never touches other-target stages or non-matching plain files',async t=>{
 const {store,target,root}=await fixture(t);
 const other=path.join(root,'.另一份.xlsx.tmp-0123456789ab.xlsx');
 const plain=path.join(root,'清单.xlsx.tmp-0123456789ab.xlsx');
 const old=new Date(Date.now()-3600000);
 for(const file of [other,plain]){await fs.writeFile(file,zip);await fs.utimes(file,old,old);}
 await store.prepare(target,{adjacent:true});
 assert.equal(await fs.stat(other).then(()=>true,()=>false),true,'其他目标名的暂存不得清理');
 assert.equal(await fs.stat(plain).then(()=>true,()=>false),true,'不匹配插件命名规则的普通文件不得清理');
});
// R12-B：写入失败（目录在prepare后被移除）必须拒绝，不产生半成品，也不影响已发布成果。
test('write failure keeps the stage unpublished and never leaves a half-written target',async t=>{
 const {store,target,root}=await fixture(t),folder=path.join(root,'成果批次'),nested=path.join(folder,'水泵.xlsx');
 const p=await store.prepare(nested,{createParent:true,adjacent:true});
 await fs.writeFile(p.stagePath,zip);
 await fs.rm(folder,{recursive:true,force:true});
 await assert.rejects(store.commit(p.ticket),/写入失败|暂存|ENOENT/,'目标目录不可用时必须拒绝写入');
 assert.equal(await fs.stat(nested).then(()=>true,()=>false),false,'失败时不得留下半成品目标');
 assert.deepEqual(await store.discard(p.ticket),{discarded:true},'未发布票据可被安全清理');
});
// R6：分类工作簿目录（成果批次/分类工作簿）由插件按需创建，仍然禁止覆盖已有目标。
test('createParent只在显式要求时创建目标目录，已有目标仍然拒绝覆盖',async t=>{
 const {store,root}=await fixture(t),folder=path.join(root,'成果批次','分类工作簿'),target=path.join(folder,'水泵.xlsx');
 await assert.rejects(store.prepare(target),/目录|ENOENT/,'未要求时不得擅自创建目录');
 const prepared=await store.prepare(target,{createParent:true});
 assert.equal(await fs.stat(folder).then(info=>info.isDirectory(),()=>false),true,'按需创建分类工作簿目录');
 await fs.writeFile(prepared.stagePath,zip);
 const result=await store.commit(prepared.ticket);
 assert.deepEqual(await fs.readFile(target),zip);
 await assert.rejects(store.prepare(target,{createParent:true}),/存在/);
 await assert.rejects(store.prepare(path.join(folder,'坏:名字.xlsx'),{createParent:true}),/绝对路径/);
 assert.equal(result.bytes,zip.length);
});
// R6：重启后按记录SHA核对已发布文件，不依赖内存票据；外部改写必须能被发现。
test('inspect按记录SHA核对已发布文件，可发现缺失与外部改写',async t=>{
 const {store,target,root}=await fixture(t),p=await store.prepare(target);
 const missing=await store.inspect(target,'a'.repeat(64));
 assert.deepEqual(missing,{target,exists:false,sha256:null,bytes:0,matches:false});
 await fs.writeFile(p.stagePath,zip);const result=await store.commit(p.ticket);
 const ok=await store.inspect(target,result.sha256);
 assert.deepEqual(ok,{target,exists:true,sha256:result.sha256,bytes:zip.length,matches:true});
 assert.equal((await store.inspect(target,'b'.repeat(64))).matches,false,'记录SHA不一致必须报出');
 assert.equal((await store.inspect(target)).matches,null,'未给期望SHA时只做现状核对');
 await fs.writeFile(target,'user changed');
 assert.equal((await store.inspect(target,result.sha256)).matches,false,'外部改写后不得沿用旧成功');
 await assert.rejects(store.inspect(path.join(root,'out.xls')),/绝对路径/);
 await assert.rejects(store.inspect('relative.xlsx'),/绝对路径/);
});
// R12-J 补强：只读目标目录必须在“写第一份”之前就明确拒绝，不产生任何目标文件，权限恢复后照常可用。
test('R12-J：目标目录不可写时prepare先拒绝且不创建任何文件',{skip:process.platform!=='win32'},async t=>{
 const {store,root}=await fixture(t),directory=path.join(root,'只读输出'),target=path.join(directory,'水泵.xlsx');
 await fs.mkdir(directory,{recursive:true});
 const lock=()=>execFileSync('icacls',[directory,'/deny','*S-1-1-0:(WD,AD,DC,DE)'],{encoding:'utf8'});
 const unlock=()=>execFileSync('icacls',[directory,'/remove:d','*S-1-1-0'],{encoding:'utf8'});
 lock();
 try{
  await assert.rejects(store.prepare(target),/不可写/,'只读目录必须在prepare阶段就拒绝，而不是等到逐份发布');
  assert.deepEqual(await fs.readdir(directory),[],'拒绝时不得在只读目录里留下任何文件');
 }finally{unlock();}
 const prepared=await store.prepare(target);
 assert.ok(prepared.ticket,'权限恢复后同一目标可以正常准备');
 await fs.writeFile(prepared.stagePath,zip);
 assert.deepEqual(await fs.readFile((await store.commit(prepared.ticket)).target),zip);
});
