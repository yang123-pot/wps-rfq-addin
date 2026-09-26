const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
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
