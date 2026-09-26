const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const collection=require('../src/collection.js'),project=require('../src/project.js'),{createProjectStore}=require('../dev/project-store.cjs');
function sample(){
 const values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['000123','水管','DN50','m','0.1']];
 const input={metadata:{originalPath:'C:\\samples\\a.xlsx',originalName:'a.xlsx',copyPath:'C:\\copies\\a.xlsx',fingerprint:'a'.repeat(64)},
  snapshot:{name:'a.xlsx',path:'C:\\samples\\a.xlsx',fingerprint:'a'.repeat(64),
   sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
 return project.create(collection.add(collection.create(),[input]),false);
}
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-project-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,store:createProjectStore({directory:path.join(root,'projects')})};}
test('saves, loads and lists a v2 project with a persisted revision',async t=>{
 const {store}=await fixture(t),saved=sample();
 const written=await store.save(saved,{expectedRevision:0});
 assert.equal(written.path,path.join(store.directory,saved.projectId+'.json'));
 assert.equal(written.revision,1,'初始revision=0，保存成功后递增为1');
 const loaded=await store.load(saved.projectId);
 assert.deepEqual(loaded,Object.assign({},saved,{revision:1}));
 const items=await store.list();
 assert.equal(items.length,1);assert.equal(items[0].projectId,saved.projectId);assert.equal(items[0].name,saved.name);
 assert.equal(items[0].revision,1);assert.equal(items[0].schemaVersion,2);assert.equal(items[0].sourceCount,1);
 assert.equal(await store.load('missing-record'),null);
 const entries=await fs.readdir(store.directory);
 assert.deepEqual(entries.filter(function(name){return name.includes('tmp');}),[]);
});
test('rejects unsupported or damaged records on load without deleting them',async t=>{
 const {store}=await fixture(t),saved=sample();
 await store.save(saved,{expectedRevision:0});
 const file=path.join(store.directory,saved.projectId+'.json');
 await fs.writeFile(file,JSON.stringify({...saved,schemaVersion:99}));
 await assert.rejects(store.load(saved.projectId),/版本/);
 assert.ok(await fs.stat(file));
 await fs.writeFile(file,'{"broken"');
 await assert.rejects(store.load(saved.projectId),/损坏/);
 assert.ok(await fs.stat(file));
 await assert.rejects(store.load('../escape'),/编号/);
});
test('a failed save keeps the previous record and leaves no temporary file',async t=>{
 const {store}=await fixture(t),saved=sample();
 await store.save(saved,{expectedRevision:0});
 const file=path.join(store.directory,saved.projectId+'.json'),before=await fs.readFile(file,'utf8');
 await assert.rejects(store.save({...saved,schemaVersion:99},{expectedRevision:1}),/版本|不完整/);
 await assert.rejects(store.save({...saved,projectId:'../escape'},{expectedRevision:1}),/编号/);
 await assert.rejects(store.save(saved,{}),/版本号/,'缺少expectedRevision必须拒绝保存');
 assert.equal(await fs.readFile(file,'utf8'),before);
 const entries=await fs.readdir(store.directory);
 assert.deepEqual(entries.filter(function(name){return name.includes('tmp');}),[]);
});
test('an old expectedRevision is refused as a conflict and the draft is not written',async t=>{
 const {store}=await fixture(t),saved=sample();
 await store.save(saved,{expectedRevision:0});
 const file=path.join(store.directory,saved.projectId+'.json'),before=await fs.readFile(file,'utf8');
 await assert.rejects(store.save(saved,{expectedRevision:0}),function(error){return error.code==='REVISION_CONFLICT';});
 assert.equal(await fs.readFile(file,'utf8'),before,'版本冲突时不得覆盖磁盘内容');
 const loaded=await store.load(saved.projectId);
 assert.equal((await store.save(loaded,{expectedRevision:1})).revision,2,'带上最新版本号即可继续保存');
});
test('project records stay inside the configured directory',async t=>{
 const {store,root}=await fixture(t),saved=sample();
 await store.save(saved,{expectedRevision:0});
 const entries=await fs.readdir(root);
 assert.deepEqual(entries,['projects']);
});
test('a project with an unknown internal version is refused and kept on disk',async t=>{
 const {store}=await fixture(t),saved=sample(),file=path.join(store.directory,saved.projectId+'.json');
 await store.save(saved,{expectedRevision:0});
 const future=Object.assign({},saved,{revision:1,classification:{schemaVersion:2,revision:1,decisions:[]}});
 await fs.writeFile(file,JSON.stringify(future,null,2));
 await assert.rejects(store.load(saved.projectId),/内部版本不支持/);
 assert.ok(await fs.stat(file),'拒绝恢复时不得删除旧项目文件');
 assert.match(await fs.readFile(file,'utf8'),/"schemaVersion":\s*2/);
});
test('a v1 record stays readable and is only continued through a v2 copy',async t=>{
 const {store}=await fixture(t),saved=sample();
 await store.save(saved,{expectedRevision:0});
 const loaded=await store.load(saved.projectId);
 const stages={};
 ['import','review','merge','classification','brand','generation','split'].forEach(function(stage,index){
  stages[stage]={state:index===0?'ready':'missing',revision:index===0?1:null,updatedAt:null,detail:null};});
 const legacy={schemaVersion:1,projectId:loaded.projectId,name:loaded.name,createdAt:loaded.createdAt,
  updatedAt:loaded.updatedAt,revision:1,mergeIdentical:loaded.mergeIdentical,stages:stages,sources:loaded.sources,
  mergeKey:null,review:null,classification:null,assignments:null,header:null,generation:null,split:null,history:[]};
 const file=path.join(store.directory,saved.projectId+'.json');
 await fs.writeFile(file,JSON.stringify(legacy,null,2));
 const read=await store.load(saved.projectId);
 assert.equal(read.schemaVersion,1,'v1记录必须仍可读取');
 assert.equal((await store.list())[0].schemaVersion,1);
 const upgraded=project.upgradeV1(read,{projectId:'p-upgraded1'});
 const receipt=await store.save(upgraded,{expectedRevision:0});
 assert.equal(receipt.revision,1);
 assert.equal((await store.load('p-upgraded1')).fromProjectId,saved.projectId);
 assert.equal((await store.load(saved.projectId)).schemaVersion,1,'v1原文件必须保留不改动');
});
