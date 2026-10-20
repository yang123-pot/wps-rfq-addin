const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('../dev/server.cjs'),{createProjectStore}=require('../dev/project-store.cjs'),{createSplitStore}=require('../dev/split-store.cjs'),{createLibraryStore}=require('../dev/library-store.cjs');
const projectModel=require('../src/project.js'),sample=require('./fixtures/workflow-v3-sample.cjs');
test('learning endpoint requires persisted verified split, checks real bytes, learns all confirmed rows once',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'learn-project-')),projectDirectory=path.join(dir,'projects'),splitDirectory=path.join(dir,'splits'),libraryDirectory=path.join(dir,'library');
 const projects=createProjectStore({directory:projectDirectory}),splits=createSplitStore({directory:splitDirectory}),library=createLibraryStore({directory:libraryDirectory,defaults:sample.library});await library.save({...(await library.load()),expectedRevision:0});
 let p=projectModel.create(sample.buildCollection(),false);p.review={schemaVersion:1,inputKey:'review-key',revision:1,confirmedAt:'now',rows:[{rowId:'row-1',name:'水泵',feature:'DN50',unit:'台',categoryId:'pump',categoryName:'水泵'}]};p.matching={schemaVersion:1,inputKey:'review-key'};p.generation={schemaVersion:1,inputKey:'generation-key',sha256:'a'.repeat(64)};
 await projects.save(p,{expectedRevision:0});
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(dir,'imports'),projectDirectory,splitDirectory,libraryDirectory});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/library.html')).text(),token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const call=async revision=>fetch(origin+'/api/library/learn-project',{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify({expectedRevision:revision,expectedProjectRevision:(await projects.load(p.projectId)).revision,projectId:p.projectId,reviewInputKey:'review-key',reviewRevision:1,reviewConfirmedAt:'now'})});
 assert.equal((await call(1)).status,400);assert.equal((await library.load()).memory.memories.length,0);
 const target=path.join(dir,'output.xlsx'),bytes=Buffer.from('verified test output');await fs.writeFile(target,bytes);const sha=crypto.createHash('sha256').update(bytes).digest('hex');
 const receipt={schemaVersion:1,projectId:p.projectId,batchId:'batch-test-01',revision:0,inputKey:'generation-key',generationSha256:'a'.repeat(64),outputDirectory:dir,files:[{fileId:'file-1',target,state:'succeeded',sha256:sha,verifiedBy:'publish'}]};
 const result=await splits.save(receipt,{expectedRevision:0});p=await projects.load(p.projectId);p.split=result.receipt;p.stages.split.state='ready';await projects.save(p,{expectedRevision:p.revision});
 let response=await call(1);assert.equal(response.status,200,await response.clone().text());assert.equal((await library.load()).memory.memories.length,1);
 response=await call(2);assert.equal(response.status,200);assert.equal((await response.json()).alreadySaved,true);assert.equal((await library.load()).revision,2);
 await fs.writeFile(target,'externally changed');assert.equal((await call(2)).status,400);assert.equal((await library.load()).revision,2);
});

async function verifiedFixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'learn-race-')),projectDirectory=path.join(dir,'projects'),splitDirectory=path.join(dir,'splits'),libraryDirectory=path.join(dir,'library');
 const projects=createProjectStore({directory:projectDirectory}),splits=createSplitStore({directory:splitDirectory}),library=createLibraryStore({directory:libraryDirectory,defaults:sample.library});
 await library.save({...await library.load(),expectedRevision:0});
 const p=projectModel.create(sample.buildCollection(),false);
 p.review={schemaVersion:1,inputKey:'review-key',revision:1,confirmedAt:'time1',rows:[{rowId:'row-1',name:'水泵',feature:'DN50',unit:'台',categoryId:'pump',categoryName:'水泵'}]};
 p.matching={schemaVersion:1,inputKey:'review-key'};p.generation={schemaVersion:1,inputKey:'generation-key',sha256:'a'.repeat(64)};
 const target=path.join(dir,'output.xlsx'),bytes=Buffer.from('verified fixture');await fs.writeFile(target,bytes);
 const receipt={schemaVersion:1,projectId:p.projectId,batchId:'batch-test-01',revision:0,inputKey:'generation-key',generationSha256:'a'.repeat(64),outputDirectory:dir,files:[{fileId:'file-1',target,state:'succeeded',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),verifiedBy:'publish'}]};
 p.split=(await splits.save(receipt,{expectedRevision:0})).receipt;p.stages.split.state='ready';await projects.save(p,{expectedRevision:0});
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(dir,'imports'),projectDirectory,splitDirectory,libraryDirectory});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/library.html')).text(),token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const call=(route,data)=>fetch(origin+'/api/'+route,{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(data)});
 const input={expectedRevision:1,expectedProjectRevision:1,projectId:p.projectId,reviewInputKey:'review-key',reviewRevision:1,reviewConfirmedAt:'time1'};
 return {projects,splits,library,target,call,input,p:await projects.load(p.projectId)};
}
for(const change of ['project','receipt'])test('learning rejects '+change+' changes made during asynchronous output SHA checks',async t=>{
 const f=await verifiedFixture(t),readFile=fs.readFile;let release,entered;
 const gate=new Promise(r=>release=r),reading=new Promise(r=>entered=r);
 fs.readFile=async function(file,...args){if(String(file)===f.target){entered();await gate;}return readFile.call(this,file,...args);};
 let pending;
 try{
  pending=f.call('library/learn-project',f.input);await reading;
  if(change==='project'){
   const newer=structuredClone(f.p);newer.review.revision=2;newer.review.confirmedAt='time2';newer.stages.split.state='stale';
   assert.equal((await f.call('project/save',{project:newer,expectedRevision:f.p.revision})).status,200);
  }else{
   const newer=structuredClone(f.p.split);newer.files[0].state='failed';
   assert.equal((await f.call('split/save',{receipt:newer,expectedRevision:newer.revision})).status,200);
  }
  release();const response=await pending;assert.equal(response.status,409,await response.clone().text());
  assert.equal((await f.library.load()).revision,1);assert.equal((await f.library.load()).memory.memories.length,0);
 }finally{release();if(pending)await pending;fs.readFile=readFile;}
});
test('learning binds the complete confirmation identity including confirmedAt',async t=>{
 const f=await verifiedFixture(t);const response=await f.call('library/learn-project',{...f.input,reviewConfirmedAt:'different-confirmation'});
 assert.equal(response.status,400);assert.equal((await f.library.load()).revision,1);
});
for(const first of ['saved','skipped'])test('lost '+first+' project-save response cannot let a stale client reverse the library decision',async t=>{
 const f=await verifiedFixture(t),route=first==='saved'?'learn-project':'skip-project';
 assert.equal((await f.call('library/'+route,f.input)).status,200);
 const before=await f.library.load(),persisted={...f.p,learning:{schemaVersion:1,status:first,reviewKey:require('../src/deferred-learning.js').key(f.p.review)}};
 assert.equal((await f.call('project/save',{project:persisted,expectedRevision:f.p.revision})).status,200);
 // The browser never received this project save response and still has revision 1.
 const opposite=await f.call('library/'+(first==='saved'?'skip-project':'learn-project'),{...f.input,expectedRevision:before.revision});
 assert.equal(opposite.status,409);assert.deepEqual(await f.library.load(),before);
 assert.equal((await f.projects.load(f.p.projectId)).learning.status,first);
});
