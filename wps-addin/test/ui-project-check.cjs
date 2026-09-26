const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-project-')),files=[path.join(root,'一号.xlsx'),path.join(root,'二号.xls')];
 await fs.writeFile(files[0],'first file');await fs.writeFile(files[1],'second file');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:380,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const install=async()=>{
   await page.addInitScript(({files})=>{
    window.__copyNames={};
    const nativeFetch=window.fetch;
    window.fetch=async function(...args){
     const response=await nativeFetch(...args);
     if(String(args[0])==='/api/import/prepare'&&response.ok){
      const data=await response.clone().json();
      if(Array.isArray(data.files))data.files.forEach(m=>{window.__copyNames[m.copyPath]=m.originalName;});
     }
     return response;
    };
    const materialRows={
     '一号.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.1']],
     '二号.xls':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.2']]
    };
    const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
    const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
     Workbooks:{Count:1,Item(){return previous;},Open(file){
      if(files.includes(file))throw Error('original was opened');
      const name=window.__copyNames[file];if(!name)throw Error('unknown copy');
      const values=materialRows[name];
      const sheet={Name:'给排水',UsedRange:{Row:1,Column:1,Rows:{Count:values.length},Columns:{Count:5},Value2:values}};
      const book={Name:name,FullName:file,Worksheets:{Count:1,Item(){return sheet;}},Activate(){app.ActiveWorkbook=this;},Close(){}};
      app.ActiveWorkbook=book;return book;
     }}};
    window.Application=app;window.__files=files;
   },{files});
  };
  await install();
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.locator('#aux-section > summary').click();
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.locator('#merge-identical').check();
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  const saved=await fs.readdir(path.join(root,'projects'));
  assert.equal(saved.length,1);assert.match(saved[0],/^p-[a-z0-9-]+\.json$/);
  assert.match(await page.locator('#project-status').innerText(),/版本 1/);
  assert.equal(await page.locator('#project-list > li').count(),1,'保存后列表应出现该项目');
  const stored=JSON.parse(await fs.readFile(path.join(root,'projects',saved[0]),'utf8'));
  assert.equal(stored.mergeIdentical,true);assert.equal(stored.sources.length,2);
  assert.match(String(stored.mergeKey),/^ck2-[0-9a-f]{16}$/,'项目记录必须保存本次确认的合并预览键');
  assert.equal(stored.schemaVersion,2,'项目记录必须写入v2结构');
  assert.match(await page.locator('#project-status').innerText(),/导入与合并：已确认（已导入2份清单，合并选择已确认）/,
   '明确确认预览后导入与合并阶段必须按真实确认置为已确认');
  const statusText=await page.locator('#project-status').innerText();
  const stageLabels={import:'导入与合并',matching:'自动分类',review:'表内审核',categories:'分类工作簿',brands:'品牌汇总'};
  Object.keys(stageLabels).forEach(stage=>{
   const state=stored.stages[stage].state,text=state==='ready'?'已确认':state==='stale'?'已过期':'未完成';
   assert.ok(statusText.includes(stageLabels[stage]+'：'+text),'侧栏进度必须与项目记录一致：'+stageLabels[stage]);
  });
  await page.locator('#workflow-nav .workflow-step-button[data-stage="import"]').click();
  await page.locator('#merge-identical').uncheck();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('确认选择后才能进入自动分类'));
  assert.equal(await page.locator('#confirm-merge').innerText(),'确认选择，开始自动分类','合并方式变化后原确认必须失效');
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  assert.equal(await page.evaluate(()=>window.RfqProjectUI===undefined),false);

  await fs.rm(path.join(root,'copies'),{recursive:true,force:true});
  await page.reload();
  await page.locator('#aux-section > summary').click();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  assert.match(await page.locator('#project-message').innerText(),new RegExp('已恢复项目'+stored.projectId),
   '恢复提示应显示实际项目编号');
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  assert.match(await page.locator('#project-message').innerText(),/重建2份工作副本/,'副本缺失时应按原件SHA重建');
  assert.equal(await page.locator('#merge-identical').isChecked(),true,'合并选择应随项目恢复');
  assert.match(await page.locator('#merge-summary').innerText(),/2.*1/);
  assert.ok((await page.locator('#project-status').innerText()).includes(stored.projectId),'状态应显示已恢复的项目编号');
  await fs.writeFile(files[0],'changed original bytes');
  await fs.rm(path.join(root,'copies'),{recursive:true,force:true});
  await page.reload();
  await page.locator('#aux-section > summary').click();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('旧进度不能沿用'));
  assert.equal(await page.locator('#imported-books > li').count(),0,'原件变化时不得沿用旧记录');
  assert.equal(await page.locator('#project-status').innerText().then(text=>text.includes('尚未保存项目记录')),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: 侧栏保存项目写入本机项目库，刷新后可从列表恢复来源、合并选择与阶段状态。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});