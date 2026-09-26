const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-export-')),files=[path.join(root,'一号.xlsx'),path.join(root,'二号.xls')];
 await fs.writeFile(files[0],'first file');await fs.writeFile(files[1],'second file');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:380,height:900}}),errors=[],flags={acceptConfirm:true};
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async dialog=>{ try{ if(dialog.type()==='confirm'&&!flags.acceptConfirm)await dialog.dismiss(); else await dialog.accept(); }catch(e){ errors.push('dialog:'+e.message); } });
  await page.addInitScript(({files})=>{
   window.__copyNames={};window.__saveTarget=null;window.__exportCalls=[];window.__opened=[];window.__closed=[];
   const nativeFetch=window.fetch;
   window.fetch=async function(...args){
    const url=String(args[0]);
    if(url.indexOf('/api/export/')===0||url.indexOf('/api/export/')>0){
     let body=null;try{body=JSON.parse(args[1]&&args[1].body||'{}');}catch(e){}
     window.__exportCalls.push({url:url,body:body});
    }
    const response=await nativeFetch(...args);
    if(url==='/api/import/prepare'&&response.ok){
     const data=await response.clone().json();
     if(Array.isArray(data.files))data.files.forEach(m=>{window.__copyNames[m.copyPath]=m.originalName;});
    }
    return response;
   };
   const materialRows={
    '一号.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.1']],
    '二号.xls':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.2'],['002','阀门','DN50','个','1']]
   };
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},GetSaveAsFilename(){return window.__saveTarget;},
    Workbooks:{Count:1,Item(){return previous;},Open(file,links,readOnly){
     if(files.includes(file))throw Error('original was opened');
     const name=window.__copyNames[file];
     if(!name)throw Error('unknown copy');
     window.__opened.push({file,links,readOnly});
     const values=materialRows[name];
     const sheet={Name:'给排水',UsedRange:{Row:1,Column:1,Rows:{Count:values.length},Columns:{Count:5},Value2:values}};
     const book={Name:name,FullName:file,Worksheets:{Count:1,Item(){return sheet;}},Activate(){app.ActiveWorkbook=this;},Close(save){window.__closed.push(save);}};
     app.ActiveWorkbook=book;return book;
    }}};
   window.Application=app;window.__files=files;
  },{files});
  await page.exposeFunction('__writeExportFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.locator('#aux-section > summary').click();
  await page.evaluate(()=>{
   window.RfqExportHost.write=async(app,model,stage)=>{window.__exportedModel=model;if(window.__writeFails)throw Error('合成写入失败');await window.__writeExportFixture(stage);};
  });
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  assert.equal(await page.locator('#export-workbook').isDisabled(),false,'导入有效后应可另存');
  assert.match(await page.locator('#merge-summary').innerText(),/3.*3/);
  const exportCalls=()=>page.evaluate(()=>window.__exportCalls.length);
  const commitCalls=()=>page.evaluate(()=>window.__exportCalls.filter(c=>c.url.indexOf('/api/export/commit')>=0).length);
  const message=()=>page.locator('#export-message').innerText();

  flags.acceptConfirm=false;
  await page.locator('#export-workbook').click();
  assert.match(await message(),/取消/);
  assert.equal(await exportCalls(),0,'取消确认不得发起另存请求');

  flags.acceptConfirm=true;
  await page.evaluate(()=>{window.__saveTarget=false;});
  await page.locator('#export-workbook').click();
  assert.match(await message(),/取消选择保存位置/);
  assert.equal(await exportCalls(),0,'取消位置不得发起另存请求');

  await page.evaluate(async root=>{window.__writeFails=true;window.__saveTarget=root+'\\写入失败.xlsx';},root);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('合成写入失败'));
  assert.equal(await commitCalls(),0,'写入失败不得提交');
  assert.equal(await page.locator('#imported-books > li').count(),2,'失败后集合必须保留');
  assert.equal(await fs.stat(path.join(root,'写入失败.xlsx')).then(()=>true,()=>false),false);

  await page.evaluate(root=>{window.__writeFails=false;window.__saveTarget=root+'\\拒绝提交.xlsx';},root);
  let rejects=0;
  const reject=async route=>{rejects++;await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'合成拒绝'})});};
  await page.route('**/api/export/commit',reject);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('合成拒绝'));
  assert.equal(rejects,1);
  await page.unroute('**/api/export/commit',reject);
  assert.equal(await fs.stat(path.join(root,'拒绝提交.xlsx')).then(()=>true,()=>false),false,'提交被拒绝不得发布目标');

  await page.evaluate(root=>{window.__saveTarget=root+'\\响应丢失重试.xlsx';},root);
  let commitAttempts=0,aborts=0;
  const abort=async route=>{commitAttempts++;if(commitAttempts===1){aborts++;await route.abort('failed');}else await route.continue();};
  await page.route('**/api/export/commit',abort);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('另存成功'));
  await page.unroute('**/api/export/commit',abort);
  assert.equal(aborts,1,'首次提交应模拟响应丢失');
  assert.equal(commitAttempts,2,'响应丢失后应使用同一票据重试一次');
  assert.equal((await fs.readFile(path.join(root,'响应丢失重试.xlsx')))[0],0x50);
  assert.equal(await page.evaluate(()=>window.__exportedModel.outputCount),3,'未勾选时必须分别保留');

  await page.evaluate(root=>{window.__saveTarget=root+'\\合并.xlsx';},root);
  await page.locator('#merge-identical').check();
  assert.match(await page.locator('#merge-summary').innerText(),/3.*2/);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('另存成功'));
  assert.equal(await page.evaluate(()=>window.__exportedModel.outputCount),2);
  assert.equal(await page.evaluate(()=>window.__exportedModel.sheets[0].values.find(r=>r[2]==='水管')[5]),'0.3');
  assert.equal(await page.evaluate(()=>window.__exportedModel.sheets[1].values.length),4,'来源明细应为表头加3条');

  await page.evaluate(root=>{window.__saveTarget=root+'\\再次分离.xlsx';},root);
  await page.locator('#merge-identical').uncheck();
  assert.match(await page.locator('#merge-summary').innerText(),/3.*3/);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('另存成功'));
  assert.equal(await page.evaluate(()=>window.__exportedModel.outputCount),3);
  assert.equal(await page.evaluate(()=>window.__exportedModel.mode),'separate');
  assert.equal((await fs.readFile(path.join(root,'合并.xlsx')))[0],0x50);
  assert.equal((await fs.readFile(path.join(root,'再次分离.xlsx')))[0],0x50);
  assert.equal(await page.evaluate(()=>window.__opened.every(entry=>entry.readOnly===true&&entry.links===0)),true);
  assert.ok(!(await page.evaluate(()=>window.__opened)).some(entry=>files.includes(entry.file)),'不得打开原件');
  assert.equal(await page.evaluate(()=>window.__closed.every(save=>save===false)),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: 侧栏另存取消/位置取消/写入失败/提交拒绝/响应丢失重试/合并2条/切回分离3条，模型与目标文件一致。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
