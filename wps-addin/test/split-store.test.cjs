const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const store=require('../dev/split-store.cjs');
const plan={inputKey:'ck1-split',files:[{fileId:'file-a',target:'C:\\out\\a.xlsx'},{fileId:'file-b',target:'C:\\out\\b.xlsx'}]};
const sha='a'.repeat(64),shaOther='b'.repeat(64);
test('a receipt starts pending and tracks per-file outcomes',()=>{
 const receipt=store.create(plan,sha);
 assert.equal(receipt.schemaVersion,1);
 assert.deepEqual(receipt.files.map(file=>file.state),['pending','pending']);
 assert.deepEqual(store.summarize(receipt).pending.map(file=>file.fileId),['file-a','file-b']);
 let next=store.mark(receipt,'file-a','succeeded',shaOther);
 next=store.mark(next,'file-b','failed','目标被占用');
 const summary=store.summarize(next);
 assert.deepEqual(summary.succeeded.map(file=>file.fileId),['file-a']);
 assert.deepEqual(summary.failed.map(file=>file.fileId),['file-b']);
 assert.equal(summary.done,false);
 assert.equal(summary.succeeded[0].sha256,shaOther);
 assert.deepEqual(store.pending(next).map(file=>file.fileId),['file-b']);
 assert.throws(()=>store.mark(next,'file-c','succeeded',sha),/没有这个文件/);
});
test('restart reconciliation skips verified files, reverts missing ones and flags rewritten ones',()=>{
 let receipt=store.mark(store.mark(store.create(plan,sha),'file-a','succeeded',shaOther),'file-b','succeeded',sha);
 const after=store.reconcile(receipt,[
  {fileId:'file-a',exists:true,sha256:shaOther},
  {fileId:'file-b',exists:true,sha256:'c'.repeat(64)}]);
 const summary=store.summarize(after);
 assert.deepEqual(summary.succeeded.map(file=>file.fileId),['file-a'],'SHA一致的成功文件被跳过');
 assert.deepEqual(summary.needsVerification.map(file=>file.fileId),['file-b']);
 assert.match(summary.needsVerification[0].error,/外部改写/);
 const reverted=store.reconcile(after,[{fileId:'file-a',exists:false}]);
 assert.equal(store.summarize(reverted).pending.length,1);
 const confirmed=store.reconcile(reverted,[{fileId:'file-b',exists:true,sha256:sha}]);
 assert.deepEqual(store.summarize(confirmed).succeeded.map(file=>file.fileId),['file-b'],'核对一致后可以确认成功');
});
test('receipts persist atomically in their own directory and refuse damaged content',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-split-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const created=store.createSplitStore({directory:dir});
 assert.equal(await created.load(),null);
 const receipt=store.mark(store.create(plan,sha),'file-a','succeeded',shaOther);
 const saved=await created.save(receipt);
 assert.equal(saved.path,path.join(dir,store.FILE_NAME));
 const reloaded=await created.load();
 assert.equal(store.summarize(reloaded).succeeded.length,1);
 await assert.rejects(created.save(Object.assign({},receipt,{schemaVersion:9})),/版本不支持|回执不完整/);
 await fs.writeFile(saved.path,'{"broken"');
 await assert.rejects(created.load(),/损坏/);
 assert.deepEqual((await fs.readdir(dir)).filter(name=>name.includes('tmp')),[]);
});
