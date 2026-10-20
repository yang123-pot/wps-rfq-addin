const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const store=require('../dev/split-store.cjs');
const PROJECT='p-split-0001',BATCH='b-split-0001',OTHER='b-split-0002';
const plan={inputKey:'ck1-split',files:[{fileId:'file-a',sheetId:'sheet-a',name:'a.xlsx',target:'C:\\out\\a.xlsx'},
 {fileId:'file-b',sheetId:'sheet-b',name:'b.xlsx',target:'C:\\out\\b.xlsx'}]};
const sha='a'.repeat(64),shaOther='b'.repeat(64);
function digest(value){return crypto.createHash('sha256').update(value).digest('hex');}
function inquiryModel(key){
 return {inputKey:key,sheets:[{sheetId:'sheet-a',kind:'inquiry',categoryName:'水泵',brand:'青源',supplier:'华川设备',
  values:[['示例园区 水泵询价表'],['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
   ['1','FM-001','水泵','DN50','台','2','青源','','','']],
  layout:{headerRow:2,metadata:{headerRow:2,profile:'inquiry-sheet'}}}]};
}
async function splitFixture(t,prefix){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),prefix));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const output=path.join(root,'out');await fs.mkdir(output,{recursive:true});
 const generationTarget=path.join(root,'示例园区_询价总表.xlsx'),generationBytes=Buffer.from([0x50,0x4b,3,4,9,9]);
 await fs.writeFile(generationTarget,generationBytes);
 return {root:root,output:output,generationTarget:generationTarget,generationBytes:generationBytes,
  generation:function(key){return {inputKey:key,target:generationTarget,sha256:digest(generationBytes),modelSnapshot:inquiryModel(key)};}};
}
test('a receipt starts pending and tracks per-file outcomes by project and batch',()=>{
 const receipt=store.create(plan,sha,{projectId:PROJECT,batchId:BATCH});
 assert.equal(receipt.schemaVersion,1);
 assert.equal(receipt.projectId,PROJECT);
 assert.equal(receipt.batchId,BATCH);
 assert.equal(receipt.revision,0,'新回执初始版本为0，保存后递增');
 assert.deepEqual(receipt.files.map(file=>file.state),['pending','pending']);
 assert.deepEqual(store.summarize(receipt).pending.map(file=>file.fileId),['file-a','file-b']);
 let next=store.mark(receipt,'file-a','succeeded',shaOther);
 next=store.mark(next,'file-b','failed','目标被占用');
 const summary=store.summarize(next);
 assert.deepEqual(summary.succeeded.map(file=>file.fileId),['file-a']);
 assert.deepEqual(summary.failed.map(file=>file.fileId),['file-b']);
 assert.equal(summary.done,false);
 assert.equal(summary.succeeded[0].sha256,shaOther);
 assert.deepEqual(store.pending(next).map(file=>file.fileId),['file-b'],'只重试未完成项，不重跑成功项');
 assert.deepEqual(store.blocked(next),[]);
 assert.throws(()=>store.mark(next,'file-c','succeeded',sha),/没有这个文件/);
});
test('restart reconciliation skips verified files, reverts missing ones and flags rewritten or unrecorded files',()=>{
 let receipt=store.mark(store.mark(store.create(plan,sha,{projectId:PROJECT,batchId:BATCH}),'file-a','succeeded',shaOther),'file-b','succeeded',sha);
 const after=store.reconcile(receipt,[
  {fileId:'file-a',exists:true,sha256:shaOther},
  {fileId:'file-b',exists:true,sha256:'c'.repeat(64)}]);
 const summary=store.summarize(after);
 assert.deepEqual(summary.succeeded.map(file=>file.fileId),['file-a'],'SHA一致的成功文件被跳过');
 assert.deepEqual(summary.needsVerification.map(file=>file.fileId),['file-b']);
 assert.match(summary.needsVerification[0].error,/外部改写/);
 assert.deepEqual(store.pending(after).map(file=>file.fileId),[],'外部改写文件不能直接重试覆盖');
 const reverted=store.reconcile(after,[{fileId:'file-a',exists:false}]);
 assert.equal(store.summarize(reverted).pending.length,1);
 // R12-E：仅凭“SHA又和旧值一样”不能恢复成功，必须走显式内容核对（mark带证明）。
 const reconciled=store.reconcile(reverted,[{fileId:'file-b',exists:true,sha256:sha}]);
 assert.deepEqual(store.summarize(reconciled).needsVerification.map(file=>file.fileId),['file-b'],
  'reconcile只能把不一致标成待核对，不能自己提升成功');
 const confirmed=store.mark(reconciled,'file-b','succeeded',sha,{proof:'content-check'});
 assert.deepEqual(store.summarize(confirmed).succeeded.map(file=>file.fileId),['file-b'],'显式内容核对通过后才认成功');
 const unrecorded=store.reconcile(store.create(plan,sha,{projectId:PROJECT,batchId:BATCH}),
  [{fileId:'file-a',exists:true,sha256:shaOther},{fileId:'file-b',exists:false}]);
 assert.deepEqual(store.summarize(unrecorded).needsVerification.map(file=>file.fileId),['file-a'],
  '发布响应丢失但回执仍是pending时，文件存在必须标待核对');
 assert.equal(unrecorded.files[0].sha256,null,'观察到的SHA不能当成经核对的SHA');
 assert.equal(unrecorded.files[0].observedSha256,shaOther,'观察SHA单独记录，供SHA变化检测使用');
});
// R12-E核心失效：pending存在文件时连续核对/重启不能凭空变成功。
test('unrecorded target stays unverified after repeated checks',async t=>{
 const fx=await splitFixture(t,'rfq-split-unrecorded-'),key='ck1-unrecorded';
 const project='p-unrecorded-01',batch='b-unrecorded-01',target=path.join(fx.output,'水泵_华川设备.xlsx');
 const first=await store.createSplitStore({directory:fx.root}).prepare({projectId:project,batchId:batch,
  generation:fx.generation(key),currentKey:key,targetDirectory:fx.output});
 assert.equal(first.receipt.files[0].state,'pending');
 assert.equal(first.receipt.files[0].target,target);
 const bytes=Buffer.from('publish response lost: file exists but receipt still pending');
 await fs.writeFile(target,bytes);
 let prepared=first;
 for(let round=1;round<=3;round++){
  prepared=await store.createSplitStore({directory:fx.root}).prepare({projectId:project,batchId:batch,
   generation:fx.generation(key),currentKey:key,targetDirectory:fx.output});
  assert.equal(prepared.receipt.files[0].state,'needs-verification','第'+round+'次连续核对仍必须待核对');
  assert.equal(prepared.summary.done,false,'未做内容核对前不得报全部完成');
 }
 assert.equal(prepared.canPublish,false,'待核对存在时不得把该文件当成功发布');
 assert.equal(prepared.receipt.files[0].sha256,null,'经核对的SHA必须为空');
 assert.equal(prepared.receipt.files[0].verifiedBy,null);
 assert.equal(prepared.receipt.files[0].observedSha256,digest(bytes),'只记录观察到的SHA，与经核对SHA分开');
});
test('legacy succeeded receipt without verification proof is conservatively demoted',async t=>{
 const fx=await splitFixture(t,'rfq-split-legacy-'),key='ck1-legacy';
 const created=store.createSplitStore({directory:fx.root});
 const legacy=store.mark(store.create({inputKey:key,files:[{fileId:'file-a',sheetId:'sheet-a',name:'a.xlsx',target:'C:\\out\\a.xlsx'}]},
  digest(fx.generationBytes),{projectId:PROJECT,batchId:BATCH}),'file-a','succeeded',shaOther);
 delete legacy.files[0].verifiedBy;
 delete legacy.files[0].verifiedAt;
 await fs.writeFile(path.join(fx.root,store.fileNameFor(PROJECT,BATCH)),JSON.stringify(legacy));
 const loaded=await created.load(PROJECT,BATCH);
 assert.equal(loaded.files[0].state,'needs-verification','旧回执没有核对证明时保守待核对');
 assert.equal(loaded.files[0].sha256,null);
 assert.equal(loaded.files[0].observedSha256,shaOther);
});
test('explicit verification proof is the only thing reconcile treats as verified success',()=>{
 const verified=store.mark(store.create(plan,sha,{projectId:PROJECT,batchId:BATCH}),'file-a','succeeded',shaOther,{proof:'content-check'});
 assert.equal(verified.files[0].verifiedBy,'content-check');
 const kept=store.reconcile(verified,[{fileId:'file-a',exists:true,sha256:shaOther}]);
 assert.equal(store.summarize(kept).succeeded.length,1,'有证明且SHA一致的成功件仍被跳过，不重复写文件');
 const rewritten=store.reconcile(verified,[{fileId:'file-a',exists:true,sha256:'d'.repeat(64)}]);
 assert.equal(rewritten.files[0].state,'needs-verification');
 assert.equal(rewritten.files[0].sha256,null,'外部改写后必须丢掉旧的经核对SHA');
 const back=store.reconcile(rewritten,[{fileId:'file-a',exists:true,sha256:shaOther}]);
 assert.equal(back.files[0].state,'needs-verification','拿回旧SHA也不能自动恢复成功');
});
test('receipts persist atomically per project and batch, reject stale revisions and damaged content',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-split-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const created=store.createSplitStore({directory:dir});
 assert.equal(await created.load(PROJECT,BATCH),null);
 const receipt=store.mark(store.create(plan,sha,{projectId:PROJECT,batchId:BATCH}),'file-a','succeeded',shaOther);
 const saved=await created.save(receipt,{expectedRevision:0});
 assert.equal(saved.path,path.join(dir,store.fileNameFor(PROJECT,BATCH)));
 assert.equal(saved.revision,1);
 const reloaded=await created.load(PROJECT,BATCH);
 assert.equal(store.summarize(reloaded).succeeded.length,1);
 assert.equal(await created.load(PROJECT,OTHER),null,'不同批次互不串回执');
 await assert.rejects(created.save(receipt,{expectedRevision:0}),function(error){return error.code==='REVISION_CONFLICT';});
 await assert.rejects(created.save(Object.assign({},receipt,{schemaVersion:9}),{expectedRevision:1}),/版本不支持|回执不完整/);
 await fs.writeFile(saved.path,'{"broken"');
 await assert.rejects(created.load(PROJECT,BATCH),/损坏/);
 assert.deepEqual((await fs.readdir(dir)).filter(name=>name.includes('tmp')),[]);
});
