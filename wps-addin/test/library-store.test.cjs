const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createLibraryStore,FILE_NAME}=require('../dev/library-store.cjs');
const defaults=require('../rules/defaults.json'),memoryLib=require('../src/category-memory.js');
async function folder(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-library-store-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
function grown(state){
 const memory=memoryLib.learn(state.memory,{categoryId:'water-valve',confirmedAt:'2026-09-25T00:00:00.000Z'},{item:{name:'水管',feature:'DN50',unit:'m'}});
 return {library:state.library,memory:memory};
}
test('an untouched directory reports the bundled defaults at revision zero without writing',async t=>{
 const dir=await folder(t),store=createLibraryStore({directory:dir});
 const state=await store.load();
 assert.equal(state.revision,0);
 assert.equal(state.persisted,false);
 assert.deepEqual(state.library,defaults);
 assert.deepEqual(state.memory.memories,[]);
 assert.deepEqual(await fs.readdir(dir),[]);
});
test('saving is atomic, versioned and readable back through the same package',async t=>{
 const dir=await folder(t),store=createLibraryStore({directory:dir,defaults:defaults});
 const start=await store.load();
 const receipt=await store.save(Object.assign({expectedRevision:0},grown(start)));
 assert.equal(receipt.revision,1);
 assert.equal(receipt.path,path.join(dir,FILE_NAME));
 const reloaded=await store.load();
 assert.equal(reloaded.revision,1);
 assert.equal(reloaded.persisted,true);
 assert.equal(reloaded.memory.memories.length,1);
 assert.deepEqual(reloaded.library,defaults);
 assert.deepEqual((await fs.readdir(dir)).sort(),[FILE_NAME]);
 const again=await store.save(Object.assign({expectedRevision:1},grown(reloaded)));
 assert.equal(again.revision,2);
 assert.equal((await store.load()).revision,2);
});
test('a stale revision is rejected with a conflict and never overwrites the newer package',async t=>{
 const dir=await folder(t),store=createLibraryStore({directory:dir,defaults:defaults});
 const start=await store.load();
 await store.save(Object.assign({expectedRevision:0},grown(start)));
 await assert.rejects(store.save(Object.assign({expectedRevision:0},grown(start))),/版本|冲突/);
 const conflict=await store.save(Object.assign({expectedRevision:0},grown(start))).catch(error=>error);
 assert.equal(conflict.code,'REVISION_CONFLICT');
 assert.equal((await store.load()).revision,1);
});
test('invalid payloads, broken json and future schemas are refused instead of overwriting',async t=>{
 const dir=await folder(t),store=createLibraryStore({directory:dir,defaults:defaults});
 const start=await store.load();
 await assert.rejects(store.save({expectedRevision:0,library:{version:'x',categories:[],rules:[]},memory:start.memory}),/分类库不完整/);
 await assert.rejects(store.save({expectedRevision:0,library:start.library,memory:null}),/习惯记忆/);
 await assert.rejects(store.save({expectedRevision:-1,library:start.library,memory:start.memory}),/版本号/);
 assert.deepEqual(await fs.readdir(dir),[]);
 const file=path.join(dir,FILE_NAME);
 await fs.writeFile(file,'{"schemaVersion":1,"revision',{flag:'wx'});
 const before=await fs.readFile(file,'utf8');
 await assert.rejects(store.load(),/损坏/);
 await assert.rejects(store.save(Object.assign({expectedRevision:1},grown(start))),/损坏/);
 assert.equal(await fs.readFile(file,'utf8'),before);
 await fs.writeFile(file,JSON.stringify({schemaVersion:99,revision:5,library:defaults,memory:start.memory}),'utf8');
 await assert.rejects(store.load(),/版本不支持/);
});
test('two concurrent saves at the same revision cannot both win',async t=>{
 const dir=await folder(t),store=createLibraryStore({directory:dir,defaults:defaults});
 const start=await store.load();
 const results=await Promise.allSettled([
  store.save(Object.assign({expectedRevision:0},grown(start))),
  store.save(Object.assign({expectedRevision:0},grown(start)))
 ]);
 assert.equal(results.filter(item=>item.status==='fulfilled').length,1);
 assert.equal(results.filter(item=>item.status==='rejected').length,1);
 assert.equal((await store.load()).revision,1);
});
test('a rejected write leaves no temporary files behind',async t=>{
 const dir=await folder(t),store=createLibraryStore({directory:dir,defaults:defaults});
 const start=await store.load();
 await store.save(Object.assign({expectedRevision:0},grown(start)));
 await store.save(Object.assign({expectedRevision:0},grown(start))).catch(()=>{});
 assert.deepEqual((await fs.readdir(dir)).sort(),[FILE_NAME]);
});
