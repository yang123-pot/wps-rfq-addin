const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createLibraryStore}=require('../dev/library-store.cjs');
test('recommendations page is revision-cached, bounded, persistent and invalidated by external same-revision edits',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'recommendations-store-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const defaults={version:'test',categories:[{id:'a',name:'阀门'},{id:'b',name:'水阀门'},{id:'c',name:'线缆'},{id:'d',name:'电线电缆'},{id:'no-inquiry',name:'无需询价'}],rules:[]},store=createLibraryStore({directory:dir,defaults});
 await store.save({...await store.load(),expectedRevision:0});
 const first=await store.page({kind:'recommendations',pageSize:10});assert.equal(first.total,2);assert.equal(first.items.length,2);assert.equal(first.revision,1);
 assert.equal((await store.page({kind:'recommendations'})).items[0],first.items[0],'unchanged revision reuses the computed card');
 const pair=first.items.find(p=>p.categories[0].id==='a');
 await store.mutate({expectedRevision:1,operation:{type:'keep-separate',categoryIds:['a','b'],evidenceKey:pair.evidenceKey}});
 assert.equal((await store.page({kind:'recommendations'})).total,1);
 await assert.rejects(store.mutate({expectedRevision:1,operation:{type:'keep-separate',categoryIds:['a','b'],evidenceKey:pair.evidenceKey}}),e=>e.code==='REVISION_CONFLICT');
 const reopened=createLibraryStore({directory:dir});assert.equal((await reopened.page({kind:'recommendations'})).total,1);
 let state=await reopened.load();state.library.categories.find(c=>c.id==='d').name='压缩机';
 await fs.writeFile(store.path,JSON.stringify(state));assert.equal((await store.page({kind:'recommendations'})).total,0,'same-revision external edit invalidates candidate cache');
 state.library.categories.find(c=>c.id==='b').name='给水阀门';await fs.writeFile(store.path,JSON.stringify(state));
 assert.equal((await store.page({kind:'recommendations'})).total,1,'changed evidence makes the dismissed pair eligible again');
 const page=await store.page({kind:'recommendations',pageSize:1000});assert.equal(page.pageSize,50);assert.equal(page.history,undefined);
});
