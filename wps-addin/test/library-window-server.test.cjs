const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../dev/server.cjs');
test('window API authenticates bounded reads and atomic commands; compact endpoint has no audit history',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'library-window-api-')),server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(dir,'imports'),libraryDirectory:path.join(dir,'library')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/taskpane.html')).text(),token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const call=(route,data={},auth=true)=>fetch(origin+'/api/library/'+route,{method:'POST',headers:{'content-type':'application/json',...(auth?{'x-rfq-import-token':token}:{})},body:JSON.stringify(data)});
 assert.equal((await call('window/page',{},false)).status,403);
 assert.equal((await call('window/page')).status,200);assert.equal((await call('window/summary')).status,200);
 const recommendations=await call('window/page',{kind:'recommendations',pageSize:10});assert.equal(recommendations.status,200);const cards=await recommendations.json();assert.ok(cards.items.length<=10);assert.equal(cards.history,undefined);
 assert.equal((await call('window/mutate',{expectedRevision:0,operation:{type:'add',name:'测试分类'}})).status,200);
 assert.equal((await call('window/mutate',{expectedRevision:0,operation:{type:'add',name:'冲突分类'}})).status,409);
 const index=await(await call('classify-index')).json();assert.equal(index.revision,1);assert.deepEqual(index.memory.history,[]);
 assert.equal((await call('window/page',{page:-1})).status,400);
});
