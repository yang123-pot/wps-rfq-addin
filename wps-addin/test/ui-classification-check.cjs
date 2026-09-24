const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-classification-')),files=[path.join(root,'一号.xlsx'),path.join(root,'二号.xls')];
 await fs.writeFile(files[0],'first file');await fs.writeFile(files[1],'second file');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),projectDirectory:path.join(root,'projects')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({files})=>{
   window.__copies=[];window.__written=[];window.__books={};
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
   function bookFor(path,readOnly){
    const name='给排水';
    window.__books[path]=window.__books[path]||{};
    if(!window.__books[path][name]){
     const original=(window.__copies.filter(item=>item.copyPath===path)[0]||{}).originalName;
     if(!materialRows[original])throw Error('unknown copy '+path);
     window.__books[path][name]={values:materialRows[original].map(row=>row.slice()),cells:{}};
    }
    const store=window.__books[path][name];
    const sheet={Name:name,
     UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:store.values[0].length},Value2:store.values},
     Cells:{Item(row,column){return {NumberFormat:'',
      get Value2(){const value=store.cells[row+':'+column];return value===undefined?null:value;},
      set Value2(value){store.cells[row+':'+column]=value;
       window.__written.push({path:path,sheet:name,row:row,column:column,value:value});},
      get HasFormula(){return false;}};}}};
    return {FullName:path,ReadOnly:!!readOnly,Worksheets:{Count:1,Item(){return sheet;}},
     Activate(){app.ActiveWorkbook=this;},Save(){},Close(){}};
   }
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
    Workbooks:{Count:1,Item(){return previous;},Open(file,links,readOnly){
     if(files.includes(file))throw Error('original was opened');
     if(!window.__copies.some(item=>item.copyPath===file))throw Error('unknown copy');
     return bookFor(file,readOnly);
    }}};
   window.Application=app;window.__files=files;
  },{files});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 3'));
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
  assert.equal(written.filter(value=>value==='无需询价｜无可靠匹配｜已确认').length,2);
  assert.equal(written.filter(value=>value==='分类备注｜匹配度｜核对状态').length,2,'每张工作表写一次列标题');
  const rowsWritten=await page.evaluate(()=>window.__written.filter(item=>item.value!=='分类备注｜匹配度｜核对状态')
   .map(item=>item.sheet+':'+item.row+':'+item.column).sort());
  assert.deepEqual(rowsWritten,['给排水:3:6','给排水:3:6','给排水:4:6'],'按原行号写入表末列');
  assert.equal(await page.evaluate(()=>window.__books[window.__copies[0].copyPath]['给排水'].values[2][4]),'0.1','原有单元格不得被改写');

  await page.locator('#classification-list > li').first().locator('button').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  assert.equal(await page.locator('#write-classification').isDisabled(),true,'撤销后重新阻断');
  await page.locator('#classification-list > li').first().locator('select').selectOption('no-inquiry');
  await page.locator('#classification-list > li').first().locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  await page.reload();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  assert.match(await page.locator('#classification-progress').innerText(),/已确认 3/,'分类确认应随项目一起恢复');
  assert.equal(await page.locator('#write-classification').isDisabled(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: 分类建议含依据、未全确认阻断写入、逐行确认/撤销、按原行号写入工作副本表末列且不改原值、确认随项目保存恢复。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
