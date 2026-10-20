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
 const call=revision=>fetch(origin+'/api/library/learn-project',{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify({expectedRevision:revision,projectId:p.projectId,reviewInputKey:'review-key',reviewRevision:1})});
 assert.equal((await call(1)).status,400);assert.equal((await library.load()).memory.memories.length,0);
 const target=path.join(dir,'output.xlsx'),bytes=Buffer.from('verified test output');await fs.writeFile(target,bytes);const sha=crypto.createHash('sha256').update(bytes).digest('hex');
 const receipt={schemaVersion:1,projectId:p.projectId,batchId:'batch-test-01',revision:0,inputKey:'generation-key',generationSha256:'a'.repeat(64),outputDirectory:dir,files:[{fileId:'file-1',target,state:'succeeded',sha256:sha,verifiedBy:'publish'}]};
 const result=await splits.save(receipt,{expectedRevision:0});p=await projects.load(p.projectId);p.split=result.receipt;p.stages.split.state='ready';await projects.save(p,{expectedRevision:p.revision});
 let response=await call(1);assert.equal(response.status,200,await response.clone().text());assert.equal((await library.load()).memory.memories.length,1);
 response=await call(2);assert.equal(response.status,200);assert.equal((await response.json()).alreadySaved,true);assert.equal((await library.load()).revision,2);
 await fs.writeFile(target,'externally changed');assert.equal((await call(2)).status,400);assert.equal((await library.load()).revision,2);
});
