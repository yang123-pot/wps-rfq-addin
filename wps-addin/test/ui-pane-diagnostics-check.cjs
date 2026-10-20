const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),{createProbeServer}=require('../dev/probe-server.cjs');

async function until(reportPath,predicate){
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  // 服务端写入不是原子的，读到半份JSON时按“还没好”处理，避免把测试竞态当成产品缺陷。
  const data=await fs.readFile(reportPath,'utf8').then(
   text=>{try{return JSON.parse(text);}catch(_){return {reports:[]};}},()=>({reports:[]}));
  if(predicate(data.reports))return data.reports;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('侧栏诊断报告没有到达');
}

(async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-pane-diag-'));
 const reportPath=path.join(folder,'reports.json');
 const server=createProbeServer({root:path.resolve(__dirname,'..'),reportPath,
  probeConfig:{token:'pane-test-token',outputPath:path.join(folder,'probe.xlsx')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 // 系统可能随机分配到Chromium默认拦截的端口（例如6667），这里显式放行本次实际端口。
 const browser=await chromium.launch({channel:'msedge',headless:true,
  args:['--explicitly-allowed-ports='+server.address().port]});
 try{
  const page=await browser.newPage({viewport:{width:420,height:600}});
  const origin='http://127.0.0.1:'+server.address().port;
  await require('./assistant-test-ui.cjs').acknowledgeProblems(page);
  await page.goto(origin+'/taskpane.html?mode=detail');
  await page.locator('header').click();
  await page.mouse.wheel(0,400);
  const reports=await until(reportPath,items=>items.some(item=>item.stage==='pane-ready')&&
   items.some(item=>item.stage==='pane-event'&&item.event==='click')&&
   items.some(item=>item.stage==='pane-event'&&item.event==='wheel'));
  const ready=reports.find(item=>item.stage==='pane-ready');
  const click=reports.find(item=>item.stage==='pane-event'&&item.event==='click');
  const wheel=reports.find(item=>item.stage==='pane-event'&&item.event==='wheel');
  assert.equal(ready.readyState,'complete');
  assert.match(ready.paneSession,/^[a-f0-9]{16}$/);
  assert.equal(click.paneSession,ready.paneSession);
  assert.equal(click.eventTarget,'HEADER');
  assert.equal(typeof click.importCount,'number');
  assert.equal(typeof click.scrollHeight,'number');
  assert.equal(typeof click.headerTop,'number');
  assert.equal(click.mergeChecked,false);
  assert.equal(click.mergePreviewCount,null);
  assert.equal(click.event,'click');
  assert.equal(wheel.paneSession,ready.paneSession);
  const before=reports.filter(item=>item.stage==='pane-event'&&item.event==='wheel').length;
  await page.evaluate(()=>{for(let i=0;i<30;i++)window.dispatchEvent(new WheelEvent('wheel',{bubbles:true}));});
  await page.waitForTimeout(500);
  const after=JSON.parse(await fs.readFile(reportPath,'utf8')).reports.filter(item=>item.stage==='pane-event'&&item.event==='wheel').length;
  assert.ok(after-before<=1,'一批滚轮事件最多新增一次探针请求');
  assert.equal((await(await fetch(origin+'/dev/pane-diagnostics.js')).status),200);
  console.log('PASS: 探针模式记录侧栏 DOM 几何、导入数量和输入事件。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(folder,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
