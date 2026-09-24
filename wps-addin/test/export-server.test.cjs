const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../dev/server.cjs');
test('export endpoints require the local session and publish only server-issued stages without overwrite',async t=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-export-api-')),server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(folder,'private')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const headers={'content-type':'application/json','x-rfq-import-token':token};
 const request=(route,data,h=headers)=>fetch(origin+'/api/export/'+route,{method:'POST',headers:h,body:JSON.stringify(data)});
 assert.equal((await request('prepare',{},{})).status,403);assert.equal((await request('prepare',{}, {...headers,origin:'https://other.example'})).status,403);
 assert.equal((await fetch(origin+'/api/export/prepare')).status,405);
 const response=await request('prepare',{target:path.join(folder,'result.xlsx')});assert.equal(response.status,200);const p=await response.json();
 await fs.writeFile(p.stagePath,Buffer.from([0x50,0x4b,3,4,1,2]));
 const committed=await request('commit',{ticket:p.ticket});assert.equal(committed.status,200);const result=await committed.json();assert.equal(result.target,p.target);
 assert.equal((await request('commit',{ticket:p.ticket})).status,200);
 assert.equal((await request('prepare',{target:p.target})).status,400);
 assert.equal((await request('commit',{ticket:'bad',stagePath:p.target})).status,400);
});
