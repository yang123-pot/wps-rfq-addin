const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const store=require('../dev/split-store.cjs');
const PROJECT='p-split-0001',BATCH='b-split-0001',OTHER='b-split-0002';
const plan={inputKey:'ck1-split',files:[{fileId:'file-a',sheetId:'sheet-a',name:'a.xlsx',target:'C:\\out\\a.xlsx'},
 {fileId:'file-b',sheetId:'sheet-b',name:'b.xlsx',target:'C:\\out\\b.xlsx'}]};
const sha='a'.repeat(64),shaOther='b'.repeat(64);
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
 const confirmed=store.reconcile(reverted,[{fileId:'file-b',exists:true,sha256:sha}]);
 assert.deepEqual(store.summarize(confirmed).succeeded.map(file=>file.fileId),['file-b'],'核对一致后可以确认成功');
 const unrecorded=store.reconcile(store.create(plan,sha,{projectId:PROJECT,batchId:BATCH}),
  [{fileId:'file-a',exists:true,sha256:shaOther},{fileId:'file-b',exists:false}]);
 assert.deepEqual(store.summarize(unrecorded).needsVerification.map(file=>file.fileId),['file-a'],
  '发布响应丢失但回执仍是pending时，文件存在必须标待核对');
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
