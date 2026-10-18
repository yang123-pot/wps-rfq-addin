const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('../dev/server.cjs');
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
async function closeServer(server){
 if(!server||!server.listening)return;
 const done=new Promise(resolve=>server.close(resolve));
 if(typeof server.closeAllConnections==='function')server.closeAllConnections();
 await done;
}
async function reattach(context,server){
 await closeServer(context.server);
 context.server=server;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 context.request=(route,data,h)=>fetch(origin+'/api/split/'+route,{method:'POST',
  headers:h||{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(data||{})});
 return context;
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
test('完整总表复制接口保持本机会话鉴权，并校验已准备的原总表字节',async t=>{
 const context=await setup(t),payload={projectId:'p-total-api-01',batchId:'b-total-api-01',generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory};
 assert.equal((await context.request('copy-complete',payload,{'content-type':'application/json'})).status,403);
 assert.equal((await fetch(context.origin+'/api/split/copy-complete')).status,405);
 assert.equal((await context.request('copy-complete',payload)).status,400,'没有准备回执不得复制');
 await context.request('prepare',payload);const response=await context.request('copy-complete',payload);assert.equal(response.status,200);
 const result=await response.json();assert.deepEqual(await fs.readFile(result.target),context.bytes);
 assert.equal((await context.request('copy-complete',payload)).status,400,'重复发布绝不覆盖');
 assert.equal((await context.request('copy-complete',{...payload,verifyOnly:true})).status,200);
});
test('split prepare isolates by project and batch, verifies generation and all targets',async t=>{
 const context=await setup(t);
 const result=await context.request('prepare',{projectId:'p-split-0001',batchId:'b-split-0001',
  generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory});
 assert.equal(result.status,200);
 const prepared=await result.json();
 assert.equal(prepared.canPublish,true);
 assert.deepEqual(prepared.plan.files.filter(file=>file.kind==='inquiry').map(file=>file.name),['水泵_华川设备.xlsx','阀门_多供应商.xlsx']);
 assert.equal(prepared.plan.files.length,3,'两份询价拆分页加一份完整总表，不单独拆分内部追溯页');
 assert.deepEqual(prepared.receipt.files.map(file=>file.state),['pending','pending','pending']);
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
 assert.deepEqual(afterRestart.receipt.files.filter(file=>file.state!=='succeeded').map(file=>file.fileId),[fileB.fileId,'complete-workbook'],
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
// R12-E：发布响应丢失后，目标已存在但回执仍是pending；连续prepare与一次服务重启都只能待核对，不能凭空成功。
test('R12-E unrecorded target stays needs-verification across repeated prepare and restart',async t=>{
 const context=await setup(t),projectId='p-split-unrecorded',batchId='b-split-unrecorded',
  payload=()=>({projectId,batchId,generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory});
 const first=await(await context.request('prepare',payload())).json();
 const fileA=first.plan.files[0],bytes=Buffer.from('published but receipt write lost');
 await fs.writeFile(fileA.target,bytes);
 for(let round=1;round<=3;round++){
  const again=await(await context.request('prepare',payload())).json(),state=again.receipt.files.filter(file=>file.fileId===fileA.fileId)[0];
  assert.equal(state.state,'needs-verification','第'+round+'次prepare仍必须待核对');
  assert.equal(state.sha256,null,'观察到的SHA不能写进经核对的SHA');
  assert.equal(state.observedSha256,digest(bytes),'观察SHA与经核对SHA分开记录');
  assert.equal(again.summary.done,false,'未做内容核对前不得报done');
  assert.equal(again.canPublish,false,'待核对文件不得被当成成功发布');
  assert.equal(again.canVerify,true,'允许发起显式内容核对');
 }
 await reattach(context,createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(context.root,'private'),
  splitDirectory:path.join(context.root,'splits')}));
 const afterRestart=await(await context.request('prepare',payload())).json(),restarted=afterRestart.receipt.files.filter(file=>file.fileId===fileA.fileId)[0];
 assert.equal(restarted.state,'needs-verification');
 assert.equal(restarted.sha256,null);
 assert.equal(afterRestart.summary.done,false);
});
// R12-E：save遇到409时，服务端回执保持待核对，不能因为一次“核对通过”的写入就宣布成功。
test('R12-E save 409 keeps the unrecorded target unverified',async t=>{
 const context=await setup(t),projectId='p-split-409',batchId='b-split-409',
  payload=()=>({projectId,batchId,generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory}),
  state=require('../src/split-state.js');
 const first=await(await context.request('prepare',payload())).json(),fileA=first.plan.files[0];
 const bytes=Buffer.from('unrecorded but content matches nothing yet');
 await fs.writeFile(fileA.target,bytes);
 const prepared=await(await context.request('prepare',payload())).json();
 assert.equal(prepared.receipt.files.filter(file=>file.fileId===fileA.fileId)[0].state,'needs-verification');
 const claimed=state.mark(prepared.receipt,fileA.fileId,'succeeded',digest(bytes),{proof:'content-check'});
 const conflict=await context.request('save',{receipt:claimed,expectedRevision:Math.max(0,prepared.revision-1)});
 assert.equal(conflict.status,409,'陈旧版本号必须冲突');
 const loaded=await(await context.request('load',{projectId,batchId})).json(),
  persisted=loaded.receipt.files.filter(file=>file.fileId===fileA.fileId)[0];
 assert.equal(persisted.state,'needs-verification','409后磁盘回执仍是待核对');
 assert.equal(persisted.sha256,null);
 assert.equal(loaded.receipt.revision,prepared.revision);
});
// R12-E：总簿或来源内容键变化使旧批次失效，旧成功件不得被沿用。
test('R12-E changed total workbook or inputKey never reuses an old success record',async t=>{
 const context=await setup(t),projectId='p-split-stale',batchId='b-split-stale',
  payload=()=>({projectId,batchId,generation:generation(context),currentKey:'ck1-split-server',targetDirectory:context.outputDirectory}),
  state=require('../src/split-state.js');
 const first=await(await context.request('prepare',payload())).json(),fileA=first.plan.files[0];
 await fs.writeFile(fileA.target,context.bytes);
 const success=state.mark(first.receipt,fileA.fileId,'succeeded',digest(context.bytes),{proof:'content-check'});
 await context.request('save',{receipt:success,expectedRevision:first.revision});
 // 内容键变化：同一批次不能静默换来源。
 const changedModel=model();changedModel.inputKey='ck2-changed';
 const changed=await context.request('prepare',{projectId,batchId,currentKey:'ck2-changed',targetDirectory:context.outputDirectory,
  generation:{inputKey:'ck2-changed',target:context.generationTarget,sha256:digest(context.bytes),sheetIds:['sheet-a','sheet-b'],
   modelSnapshot:changedModel}});
 assert.equal(changed.status,400,'来源键变化必须阻断该批次');
 assert.match(await changed.text(),/不一致|重新生成/);
 // 总簿SHA变化：即使来源键没变，也不能沿用旧成功。
 await fs.writeFile(context.generationTarget,Buffer.from('外部改写后的总表'));
 const rewritten=await(await context.request('prepare',payload())).json();
 assert.equal(rewritten.canPublish,false);
 assert.equal(rewritten.summary.done,false);
 assert.match(rewritten.plan.conflicts.map(item=>item.code).join('；'),/generation-sha-mismatch|不一致/);
});
