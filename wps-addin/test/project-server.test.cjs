const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const collection=require('../src/collection.js'),project=require('../src/project.js'),{createServer}=require('../dev/server.cjs');
function sample(){
 const values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['000123','水管','DN50','m','0.1']];
 const input={metadata:{originalPath:'C:\\samples\\a.xlsx',originalName:'a.xlsx',copyPath:'C:\\copies\\a.xlsx',fingerprint:'a'.repeat(64)},
  snapshot:{name:'a.xlsx',path:'C:\\samples\\a.xlsx',fingerprint:'a'.repeat(64),
   sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
 return project.create(collection.add(collection.create(),[input]),false);
}
test('project endpoints keep the local session gate and store records inside the configured directory',async t=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-project-api-'));
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(folder,'private'),projectDirectory:path.join(folder,'projects')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const headers={'content-type':'application/json','x-rfq-import-token':token};
 const request=(route,data,h=headers)=>fetch(origin+'/api/project/'+route,{method:'POST',headers:h,body:JSON.stringify(data)});
 assert.equal((await request('save',{project:sample()},{})).status,403);
 assert.equal((await request('list',{}, {...headers,origin:'https://other.example'})).status,403);
 assert.equal((await fetch(origin+'/api/project/list')).status,405);
 const saved=sample();
 const stored=await request('save',{project:saved});assert.equal(stored.status,200);
 const receipt=await stored.json();assert.equal(receipt.path,path.join(folder,'projects',saved.projectId+'.json'));
 const loaded=await(await request('load',{projectId:saved.projectId})).json();
 assert.deepEqual(loaded.project,saved);
 const listed=await(await request('list',{})).json();
 assert.equal(listed.projects.length,1);assert.equal(listed.projects[0].projectId,saved.projectId);
 assert.equal((await(await request('load',{projectId:'missing-record'})).json()).project,null);
 assert.equal((await request('load',{projectId:'../escape'})).status,400);
 assert.equal((await request('save',{project:{...saved,schemaVersion:99}})).status,400);
 const folders=await fs.readdir(folder);
 assert.deepEqual(folders.sort(),['projects'],'项目记录只落在配置目录内');
 assert.deepEqual((await fs.readdir(path.join(folder,'projects'))).sort(),[saved.projectId+'.json']);
});
