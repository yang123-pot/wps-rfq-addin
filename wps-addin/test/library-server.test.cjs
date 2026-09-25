const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../dev/server.cjs');
const defaults=require('../rules/defaults.json'),memoryLib=require('../src/category-memory.js');
test('library endpoints sit behind the local session gate and report conflicts as 409',async t=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-library-api-'));
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(folder,'private'),
  projectDirectory:path.join(folder,'projects'),libraryDirectory:path.join(folder,'library')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const headers={'content-type':'application/json','x-rfq-import-token':token};
 const request=(route,data,h=headers)=>fetch(origin+'/api/library/'+route,{method:'POST',headers:h,body:JSON.stringify(data)});
 assert.equal((await request('load',{}, {})).status,403);
 assert.equal((await request('load',{}, {...headers,origin:'https://other.example'})).status,403);
 assert.equal((await fetch(origin+'/api/library/load')).status,405);
 const loaded=await(await request('load',{})).json();
 assert.equal(loaded.revision,0);assert.equal(loaded.persisted,false);
 assert.deepEqual(loaded.library,defaults);
 const memory=memoryLib.learn(loaded.memory,{categoryId:'water-valve',confirmedAt:'2026-09-25T00:00:00.000Z'},
  {item:{name:'水管',feature:'DN50',unit:'m'}});
 const saved=await request('save',{expectedRevision:0,library:loaded.library,memory:memory});
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).revision,1);
 const conflict=await request('save',{expectedRevision:0,library:loaded.library,memory:memory});
 assert.equal(conflict.status,409);
 assert.match((await conflict.json()).error,/版本|冲突/);
 assert.equal((await request('save',{expectedRevision:1,library:{version:'x',categories:[],rules:[]},memory:memory})).status,400);
 const after=await(await request('load',{})).json();
 assert.equal(after.revision,1);
 assert.equal(after.persisted,true);
 assert.equal(after.memory.memories.length,1);
 assert.deepEqual((await fs.readdir(path.join(folder,'library'))).sort(),['library-state.json']);
});
