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
test('saves, loads and lists a project with the same content',async t=>{
 const {store}=await fixture(t),saved=sample();
 const written=await store.save(saved);
 assert.equal(written.path,path.join(store.directory,saved.projectId+'.json'));
 assert.deepEqual(await store.load(saved.projectId),saved);
 const items=await store.list();
 assert.equal(items.length,1);assert.equal(items[0].projectId,saved.projectId);assert.equal(items[0].name,saved.name);
 assert.equal(items[0].revision,saved.revision);assert.equal(items[0].sourceCount,1);
 assert.equal(await store.load('missing-record'),null);
 const entries=await fs.readdir(store.directory);
 assert.deepEqual(entries.filter(name=>name.includes('tmp')),[]);
});
test('rejects unsupported or damaged records on load without deleting them',async t=>{
 const {store}=await fixture(t),saved=sample();
 await store.save(saved);
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
 await store.save(saved);
 const file=path.join(store.directory,saved.projectId+'.json'),before=await fs.readFile(file,'utf8');
 await assert.rejects(store.save({...saved,schemaVersion:99}),/版本|不完整/);
 await assert.rejects(store.save({...saved,projectId:'../escape'}),/编号/);
 assert.equal(await fs.readFile(file,'utf8'),before);
 const entries=await fs.readdir(store.directory);
 assert.deepEqual(entries.filter(name=>name.includes('tmp')),[]);
});
test('project records stay inside the configured directory',async t=>{
 const {store,root}=await fixture(t),saved=sample();
 await store.save(saved);
 const entries=await fs.readdir(root);
 assert.deepEqual(entries,['projects']);
});
