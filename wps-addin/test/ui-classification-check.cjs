const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-classification-')),files=[path.join(root,'一号.xlsx'),path.join(root,'二号.xls')];
 await fs.writeFile(files[0],'first file');await fs.writeFile(files[1],'second file');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(({files,root})=>{
   window.__copies=[];window.__written=[];window.__books={};
   window.__root=String(root).replace(/\\/g,'/').toLowerCase()+'/';
   const nativeFetch=window.fetch;
   window.fetch=async function(...args){
    const response=await nativeFetch(...args);
    if(String(args[0])==='/api/import/prepare'&&response.ok){
     const data=await response.clone().json();
     if(Array.isArray(data.files))window.__copies=data.files;
    }
    return response;
   };
   const materialRows={
    '一号.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.1']],
    '二号.xls':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.2'],['002','水龙头','DN15','个','1']]
   };
   function sheetFor(path,name){
    window.__books[path]=window.__books[path]||{};
    if(!window.__books[path][name]){
     const original=(window.__copies.filter(item=>item.copyPath===path)[0]||{}).originalName;
     const seed=materialRows[original]||Array.from({length:3},()=>['','','','','']);
     window.__books[path][name]={values:seed.map(row=>row.slice()),cells:{}};
    }
    const store=window.__books[path][name];
    return {Name:name,
     UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:store.values[0].length},Value2:store.values},
     Cells:{Item(row,column){return {NumberFormat:'',
      get Value2(){const value=store.cells[row+':'+column];return value===undefined?null:value;},
      set Value2(value){store.cells[row+':'+column]=value;
       window.__written.push({path:path,sheet:name,row:row,column:column,value:value});},
      get HasFormula(){return false;}};}}};
   }
   function bookFor(path,readOnly){
    const book={FullName:path,ReadOnly:!!readOnly,
     Worksheets:{Count:1,Item(name){return sheetFor(path,typeof name==='string'?name:'给排水');}},
     Activate(){app.ActiveWorkbook=this;},Save(){},Close(){}};
    return book;
   }
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
    Workbooks:{Count:1,Item(){return previous;},Open(file,links,readOnly){
     if(files.includes(file))throw Error('original was opened');
     const isMerged=String(file).replace(/\\/g,'/').toLowerCase().startsWith(window.__root);
     if(!isMerged&&!window.__copies.some(item=>item.copyPath===file))throw Error('unknown copy');
     return bookFor(file,readOnly);
    }}};
   window.Application=app;window.__files=files;
  },{files,root});
  await page.exposeFunction('__writeExportFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  // R3：先选合并并确认“确认选择，开始自动分类”，确认前不给任何建议；过渡期的分类面板在辅助功能里。
  await page.locator('#aux-section > summary').click();
  assert.doesNotMatch(await page.locator('#classification-list').innerText(),/水龙头|水阀门/,'确认选择前不得给出分类建议');
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 3'));
  assert.equal(await page.locator('#write-classification').innerText(),'写入工作副本');
  assert.match(await page.locator('#classification-list').innerText(),/水龙头/);
  assert.match(await page.locator('#classification-list').innerText(),/无可靠匹配/,'无命中行必须显示无可靠匹配');
  assert.match(await page.locator('#classification-list').innerText(),/水阀门/,'水龙头行应给出水阀门建议与依据');
  assert.match(await page.locator('#classification-list').innerText(),/用户已确认/);

  assert.equal(await page.locator('#write-classification').isDisabled(),true,'未全确认时写入按钮禁用');
  await page.evaluate(()=>{document.querySelector('#write-classification').disabled=false;});
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('未写入工作副本'));
  assert.match(await page.locator('#classification-message').innerText(),/还有3行未确认分类/);
  assert.equal(await page.evaluate(()=>window.__written.length),0);

  const rows=page.locator('#classification-list > li');
  assert.equal(await rows.count(),3);
  await rows.nth(2).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 2'));
  await rows.nth(0).locator('select').selectOption('no-inquiry');
  await rows.nth(0).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  await page.locator('#classification-list > li').nth(1).locator('select').selectOption('no-inquiry');
  await page.locator('#classification-list > li').nth(1).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  assert.equal(await page.locator('#write-classification').isDisabled(),false);
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('已把'));
  const written=await page.evaluate(()=>window.__written.map(item=>item.value));
  assert.equal(written.filter(value=>value==='水阀门｜完全匹配｜已确认').length,1);
  assert.equal(written.filter(value=>value==='无需询价｜无可靠匹配｜已确认').length,1,'该材料首次确认时还没有习惯记忆，按无可靠匹配写入');
  assert.equal(written.filter(value=>value==='无需询价｜完全匹配｜已确认').length,1,'同一材料再次确认时命中已保存的本机习惯记忆');
  assert.equal(written.filter(value=>value==='分类备注｜匹配度｜核对状态').length,2,'每张工作表写一次列标题');
  const headersWritten=await page.evaluate(()=>window.__written.filter(item=>item.value==='分类备注｜匹配度｜核对状态')
   .map(item=>item.sheet+':'+item.row+':'+item.column).sort());
  assert.deepEqual(headersWritten,['给排水:2:6','给排水:2:6'],'列标题必须落在识别出的表头行');
  const rowsWritten=await page.evaluate(()=>window.__written.filter(item=>item.value!=='分类备注｜匹配度｜核对状态')
   .map(item=>item.sheet+':'+item.row+':'+item.column).sort());
  assert.deepEqual(rowsWritten,['给排水:3:6','给排水:3:6','给排水:4:6'],'按原行号写入表末列');
  assert.equal(await page.evaluate(()=>window.__books[window.__copies[0].copyPath]['给排水'].values[2][4]),'0.1','原有单元格不得被改写');
  const firstWriteCount=await page.evaluate(()=>window.__written.length);
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('未写入工作副本'));
  assert.match(await page.locator('#classification-message').innerText(),/已有内容/);
  assert.equal(await page.evaluate(()=>window.__written.length),firstWriteCount,'重复写入不得覆盖或部分写入');
  await page.evaluate(()=>{
   window.__copies.forEach(copy=>{window.__books[copy.copyPath]['给排水'].cells={};});
   window.__books[window.__copies[1].copyPath]['给排水'].cells['3:6']='用户已有分类';
   window.__written.length=0;
  });
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('用户已有分类')||
   document.querySelector('#classification-message').textContent.includes('已有内容'));
  assert.match(await page.locator('#classification-message').innerText(),/已完成1行.*其余未完成/,'多份副本发生部分写入时必须报告实际进度');
  assert.equal(await page.evaluate(()=>window.__written.length),2,'第一份副本已实际写入标题和一行分类');

  await page.locator('#classification-list > li').first().locator('button').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  assert.equal(await page.locator('#write-classification').isDisabled(),true,'撤销后重新阻断');
  await page.locator('#classification-list > li').first().locator('select').selectOption('no-inquiry');
  await page.locator('#classification-list > li').first().locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#project-status').innerText(),/导入与合并：已确认/,'明确确认预览后导入与合并阶段必须置为已确认');
  // R5起“表内审核”只由成果表内整表一次确认决定；辅助功能里的逐行确认是过渡工具，不再代表该阶段完成。
  assert.match(await page.locator('#project-status').innerText(),/表内审核：未完成/,
   '逐行确认不得取代图03的整表一次确认');
  assert.match(await page.locator('#project-status').innerText(),/整表审核确认/,
   '阶段说明必须写明仍未整表确认，避免误以为已完成');
  await page.locator('#classification-list > li').first().locator('button').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  await page.locator('#classification-list > li').first().locator('select').selectOption('no-inquiry');
  await page.locator('#classification-list > li').first().locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#project-status').innerText(),/表内审核：未完成/,
   '逐行全部确认后仍必须等成果表整表确认');
  await page.reload();
  await page.locator('#aux-section > summary').click();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  assert.match(await page.locator('#classification-progress').innerText(),/已确认 3/,'分类确认应随项目一起恢复');
  assert.match(await page.locator('#project-status').innerText(),/表内审核：未完成/,
   '恢复项目后仍需在成果表内整表一次确认');
  assert.match(await page.locator('#project-status').innerText(),/分类工作簿：未完成/,
   '分类工作簿尚未实现时不得因旧分类确认而误报完成');
  assert.equal(await page.locator('#write-classification').isDisabled(),false);
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#merge-summary').textContent.includes('预览 2 项'));
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  assert.equal(await page.locator('#write-classification').innerText(),'写入合并清单','合并模式应明确真实写入目标');
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await page.evaluate(()=>{window.__written.length=0;});
  await page.evaluate(()=>{document.querySelector('#write-classification').disabled=false;});
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('请先在“另存内部清单”按合并模式另存'));
  assert.match(await page.locator('#classification-message').innerText(),/^未写入合并清单。/);
  assert.equal(await page.evaluate(()=>window.__written.length),0,'没有合并表时不得写入');
  let mergedTarget=path.join(root,'合并分类.xlsx');
  await page.evaluate(target=>{
   window.__mergedTarget=target;
   window.Application.GetSaveAsFilename=()=>target;
   window.RfqExportHost.write=async(app,model,stage)=>{window.__exportedModel=model;await window.__writeExportFixture(stage);};
   window.__written.length=0;
  },mergedTarget);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('另存成功'));
  await page.locator('#workflow-nav .workflow-step-button[data-stage="import"]').click();
  await page.locator('#imported-books > li').nth(1).getByRole('button',{name:'移除此文件'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===1);
  await page.evaluate(()=>{window.__written.length=0;});
  await page.evaluate(()=>{document.querySelector('#write-classification').disabled=false;});
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>/来源.*变化|已把/.test(document.querySelector('#classification-message').textContent));
  assert.match(await page.locator('#classification-message').innerText(),/来源.*变化.*重新另存/,'旧合并表不得接受新来源集合的分类');
  assert.equal(await page.evaluate(()=>window.__written.length),0,'来源改变后必须在打开旧合并表前阻断');
  await page.evaluate(file=>{window.__files=[file];},files[1]);
  await page.locator('#workflow-nav .workflow-step-button[data-stage="import"]').click();
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  mergedTarget=path.join(root,'合并分类-重新另存.xlsx');
  await page.evaluate(target=>{window.Application.GetSaveAsFilename=()=>target;},mergedTarget);
  await page.locator('#export-workbook').click();
  await page.waitForFunction(()=>document.querySelector('#export-message').textContent.includes('合并分类-重新另存.xlsx'));
  await page.evaluate(()=>{window.__written.length=0;});
  let releaseVerify,verifyStarted;
  const started=new Promise(resolve=>{verifyStarted=resolve;});
  await page.route('**/api/export/verify',async route=>{
   verifyStarted();await new Promise(resolve=>{releaseVerify=resolve;});await route.continue();
  });
  console.log('DEBUG before merged write:',await page.locator('#write-classification').isDisabled(),
   await page.locator('#classification-message').innerText(),'|',await page.locator('#classification-progress').innerText());
  await page.locator('#write-classification').click();
  await started;
  await page.locator('#workflow-nav .workflow-step-button[data-stage="import"]').click();
  await page.locator('#merge-identical').uncheck();
  assert.equal(await page.locator('#write-classification').innerText(),'写入工作副本');
  releaseVerify();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('已变化'));
  assert.equal(await page.evaluate(()=>window.__written.length),0,'校验期间改动合并选择不得写入旧计划');
  await page.unroute('**/api/export/verify');
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await fs.writeFile(mergedTarget,'changed after export');
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('发生变化'));
  assert.equal(await page.evaluate(()=>window.__written.length),0,'合并表被外部修改时必须在打开前阻断');
  await fs.writeFile(mergedTarget,Buffer.from([0x50,0x4b,3,4,1,2]));
  await page.locator('#write-classification').click();
  await page.waitForFunction(()=>document.querySelector('#classification-message').textContent.includes('合并表'));
  const mergedWrites=await page.evaluate(()=>window.__written.slice());
  assert.equal(mergedWrites.every(item=>item.path===mergedTarget),true,'合并列只写入插件另存出的合并表');
  assert.deepEqual(mergedWrites.map(item=>item.sheet+':'+item.row+':'+item.column+':'+item.value).sort(),
   ['清单:1:9:分类备注｜匹配度｜核对状态','清单:2:9:无需询价｜完全匹配｜已确认','清单:3:9:水阀门｜完全匹配｜已确认'],
   '合并表按组顺序写在第9列（8列清单之后），原工作表不被写入');
  assert.equal(mergedWrites.every(item=>item.path.toLowerCase().indexOf('copies')<0),true,'合并模式不得写回工作副本');
  assert.deepEqual(errors,[]);
  console.log('PASS: 分类建议含依据、未全确认阻断写入、逐行确认/撤销、按原行号写入工作副本表末列且不改原值、确认随项目恢复、合并模式写入合并表。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
