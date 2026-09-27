const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('../dev/server.cjs');
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
async function closeServer(server){
 if(!server||!server.listening)return;
 const done=new Promise(resolve=>server.close(resolve));
 if(typeof server.closeAllConnections==='function')server.closeAllConnections();
 await done;
}
function model(){
 return {inputKey:'ck1-split-server',schemaVersion:1,sheets:[
  {sheetId:'sheet-a',kind:'inquiry',categoryName:'水泵',brand:'青源',supplier:'华川设备',
   values:[['标题'],['序号','项目名称'],['1','水泵']],layout:{headerRow:2,metadata:{headerRow:2}}},
  {sheetId:'sheet-b',kind:'inquiry',categoryName:'阀门',brand:'通达 / 海岳',supplier:'多供应商',
   values:[['标题'],['序号','项目名称'],['1','阀门']],layout:{headerRow:2,metadata:{headerRow:2}}},
  {sheetId:'sheet-x',kind:'internal',name:'内部追溯',values:[['不拆分']]}]};
}
async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-split-api-'));
 const splitDirectory=path.join(root,'splits'),outputDirectory=path.join(root,'out');
 await fs.mkdir(outputDirectory,{recursive:true});
 const generationTarget=path.join(root,'示例园区_询价总表.xlsx'),bytes=Buffer.from([0x50,0x4b,3,4,1,2,3,4]);
 await fs.writeFile(generationTarget,bytes);
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'private'),
  splitDirectory:splitDirectory});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const headers={'content-type':'application/json','x-rfq-import-token':token};
 const request=(route,data,h)=>fetch(origin+'/api/split/'+route,{method:'POST',headers:h||headers,body:JSON.stringify(data||{})});
 const context={root,outputDirectory,generationTarget,bytes,server,origin,token,headers,request};
 t.after(async()=>{await closeServer(context.server);if(context.server!==server)await closeServer(server);
  await fs.rm(root,{recursive:true,force:true});});
 return context;
}
function generation(context){
 return {inputKey:'ck1-split-server',target:context.generationTarget,sha256:digest(context.bytes),
  sheetIds:['sheet-a','sheet-b'],modelSnapshot:model()};
}
test('split prepare isolates by project and batch, verifies generation and all targets',async t=>{
 const context=await setup(t);
 const result=await context.request('prepare',{projectId:'p-split-0001',batchId:'b-split-0001',
  generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory});
 assert.equal(result.status,200);
 const prepared=await result.json();
 assert.equal(prepared.canPublish,true);
 assert.deepEqual(prepared.plan.files.map(file=>file.name),['水泵_华川设备.xlsx','阀门_多供应商.xlsx']);
 assert.equal(prepared.plan.files.length,2,'只拆分kind=inquiry，不含内部追溯页');
 assert.deepEqual(prepared.receipt.files.map(file=>file.state),['pending','pending']);
 assert.equal(prepared.receipt.revision,1);
 assert.equal((await context.request('prepare',{projectId:'p-split-0002',batchId:'b-split-0002',
  generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory})).status,200);
 const saved=await context.request('save',{receipt:Object.assign({},prepared.receipt,{revision:1}),
  expectedRevision:1});
 assert.equal(saved.status,200,'save按expectedRevision原子更新');
 const stale=await context.request('save',{receipt:prepared.receipt,expectedRevision:1});
 assert.equal(stale.status,409,'旧版本号写入冲突');
});
test('restart reconciliation skips verified files, retries only unfinished, and blocks external rewrites',async t=>{
 const context=await setup(t),projectId='p-split-0003',batchId='b-split-0003';
 const first=await(await context.request('prepare',{projectId,batchId,generation:generation(context),
  currentKey:'ck1-split-server',targetDirectory:context.outputDirectory})).json();
 const fileA=first.plan.files[0],fileB=first.plan.files[1];
 await fs.writeFile(fileA.target,context.bytes);
 let receipt=first.receipt;
 receipt=require('../src/split-state.js').mark(receipt,fileA.fileId,'succeeded',digest(context.bytes));
 const saved=await(await context.request('save',{receipt,expectedRevision:first.revision})).json();
 assert.equal(saved.revision,2);
 // 模拟服务重启：同一回执目录重新建服务，prepare/load都必须读回磁盘状态。
 await closeServer(context.server);
 const restarted=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(context.root,'private'),
  splitDirectory:path.join(context.root,'splits')});
 await new Promise(resolve=>restarted.listen(0,'127.0.0.1',resolve));
 context.server=restarted;
 const origin='http://127.0.0.1:'+restarted.address().port,html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const headers={'content-type':'application/json','x-rfq-import-token':token};
 context.request=(route,data,h)=>fetch(origin+'/api/split/'+route,{method:'POST',headers:h||headers,body:JSON.stringify(data||{})});
 const afterRestart=await(await context.request('prepare',{projectId,batchId,generation:generation(context),
  currentKey:'ck1-split-server',targetDirectory:context.outputDirectory})).json();
 assert.equal(afterRestart.summary.succeeded.length,1,'重启后成功文件按SHA跳过');
 assert.deepEqual(afterRestart.receipt.files.filter(file=>file.state!=='succeeded').map(file=>file.fileId),[fileB.fileId],
  '只续作未完成文件');
 await fs.writeFile(fileA.target,Buffer.from('外部改写'));
 const rewritten=await(await context.request('prepare',{projectId,batchId,generation:generation(context),
  currentKey:'ck1-split-server',targetDirectory:context.outputDirectory})).json();
 assert.equal(rewritten.canPublish,false);
 assert.deepEqual(rewritten.receipt.files.filter(file=>file.state==='needs-verification').map(file=>file.fileId),[fileA.fileId]);
 // 发布响应丢失：回执仍在pending但目标已出现，也必须标待核对而不是覆盖。
 let unrecorded=rewritten.receipt;
 unrecorded=require('../src/split-state.js').reconcile(unrecorded,[{fileId:fileB.fileId,exists:true,sha256:digest(context.bytes)}]);
 assert.equal(unrecorded.files.filter(file=>file.fileId===fileB.fileId)[0].state,'needs-verification');
});
test('a pre-existing target with no receipt is blocked, and split API keeps the local token gate',async t=>{
 const context=await setup(t),existing=path.join(context.outputDirectory,'水泵_华川设备.xlsx');
 await fs.writeFile(existing,'already here');
 const blocked=await(await context.request('prepare',{projectId:'p-split-0004',batchId:'b-split-0004',
  generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory})).json();
 assert.equal(blocked.canPublish,false);
 assert.equal(blocked.receipt,null);
 assert.match(blocked.plan.conflicts.map(item=>item.code).join('；'),/target-exists/);
 assert.equal((await context.request('load',{projectId:'p-split-0004',batchId:'b-split-0004'},
  {'content-type':'application/json'})).status,403);
});
