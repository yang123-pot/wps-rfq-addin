const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');

async function until(reportPath,predicate){
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  const data=await fs.readFile(reportPath,'utf8').then(JSON.parse,()=>({reports:[]}));
  if(predicate(data.reports))return data.reports;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('侧栏诊断报告没有到达');
}

(async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-pane-diag-'));
 const reportPath=path.join(folder,'reports.json');
 const server=createServer({root:path.resolve(__dirname,'..'),reportPath,
  probeConfig:{token:'pane-test-token',outputPath:path.join(folder,'probe.xlsx')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:600}});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.locator('header').click();
  const reports=await until(reportPath,items=>items.some(item=>item.stage==='pane-ready')&&
   items.some(item=>item.stage==='pane-event'&&item.event==='click'));
  const ready=reports.find(item=>item.stage==='pane-ready');
  const click=reports.find(item=>item.stage==='pane-event'&&item.event==='click');
  assert.equal(ready.readyState,'complete');
  assert.equal(typeof click.importCount,'number');
  assert.equal(typeof click.scrollHeight,'number');
  assert.equal(typeof click.headerTop,'number');
  assert.equal(click.event,'click');
  assert.equal((await(await fetch(origin+'/dev/pane-diagnostics.js')).status),200);
  console.log('PASS: 探针模式记录侧栏 DOM 几何、导入数量和输入事件。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(folder,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
