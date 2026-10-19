// 真实页面及项目服务；仅WPS宿主替换。防止来源问题弹窗只报错、不带用户到修正位置。
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const collection=require('../src/collection.js'),project=require('../src/project.js'),review=require('../src/review.js');
const {createProjectStore}=require('../dev/project-store.cjs');
async function run(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-source-issue-'));
 const dirs={importDirectory:path.join(root,'copies'),projectDirectory:path.join(root,'projects'),
  libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers'),splitDirectory:path.join(root,'splits')};
 await fs.mkdir(dirs.importDirectory,{recursive:true});
 let c=collection.create();
 for(const [index,folder] of ['clean','a','b'].entries()){
  const originalPath=path.join(root,folder,'清单.xlsx'),copyPath=path.join(dirs.importDirectory,folder+'.xlsx');
  const bytes=Buffer.from('source issue fixture '+folder),fingerprint=crypto.createHash('sha256').update(bytes).digest('hex');
  await fs.mkdir(path.dirname(originalPath),{recursive:true});await fs.writeFile(originalPath,bytes);await fs.writeFile(copyPath,bytes);
  const values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量']];
  for(let i=3;i<=26;i++)values.push([String(i),'水表','规格'+i,'个',index&&i===26?'待核实':'1']);
  const snapshot={name:'清单.xlsx',path:originalPath,fingerprint,sheets:[{name:'安装',startRow:1,startColumn:1,rowCount:26,columnCount:5,values}]};
  c=collection.add(c,[{metadata:{originalPath,copyPath,originalName:snapshot.name,fingerprint},snapshot}]);
 }
 const saved=project.create(c,false,{projectId:'p-source-issue'});saved.name='来源问题定位测试';
 const store=createProjectStore({directory:dirs.projectDirectory});await store.save(saved,{expectedRevision:0});
 const removal=project.create({entries:[c.entries[1]]},false,{projectId:'p-source-remove'});removal.name='移除来源测试';await store.save(removal,{expectedRevision:0});
 const originalPath=path.join(root,'continuation.xlsx'),copyPath=path.join(dirs.importDirectory,'continuation.xlsx'),bytes=Buffer.from('two continuation lines');
 await fs.writeFile(originalPath,bytes);await fs.writeFile(copyPath,bytes);
 const fingerprint=crypto.createHash('sha256').update(bytes).digest('hex');
 const snapshot={name:'continuation.xlsx',path:originalPath,fingerprint,sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:6,columnCount:5,
  values:[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','阀门','首段','个','2'],
   ['','','第一条续行','',''],['','','第二条续行','',''],['002','水表','水表首段','个','1']]}]};
 const record=review.setDecision(snapshot,review.create(snapshot),{kind:'continuation',sheet:'给排水',row:4,targetRow:3});
 const continuation=project.create(collection.add(collection.create(),[{metadata:{originalPath,copyPath,originalName:snapshot.name,fingerprint},snapshot,record}]),false,{projectId:'p-source-continuation'});
 continuation.name='连续续行测试';await store.save(continuation,{expectedRevision:0});
 const server=createServer({root:path.resolve(__dirname,'..'),...dirs});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:768}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(()=>{window.Application={ActiveWorkbook:null,AutomationSecurity:1,Workbooks:{Count:0}};});
  // 仅替代WPS预览写簿边界；页面、解析、核对、项目与错误处理均运行产品代码。
  await page.route('**/src/export-host.js*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text())+'\nRfqExportHost.showPreview=function(){return {};};'});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  await page.locator('#aux-section > summary').click();await page.locator('#refresh-projects').click();
  await page.locator('#project-list li').filter({hasText:saved.name}).getByRole('button',{name:'打开',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('project-message').textContent.includes('已恢复项目p-source-issue'));
  await page.locator('#simple-mode-toggle').click();
  await page.locator('#simple-primary').click();
  const dialog=page.getByRole('alertdialog');
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('button',{name:'去核对来源',exact:true}).count(),1,'阻断弹窗必须有直接修正入口');
  assert.equal(await dialog.locator('li').count(),2,'不同目录的同名文件、同一单元格问题不能被合并丢失');
  assert.match(await dialog.textContent(),/E26/);
  if(process.env.RFQ_SOURCE_ISSUE_EVIDENCE){await fs.mkdir(process.env.RFQ_SOURCE_ISSUE_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.RFQ_SOURCE_ISSUE_EVIDENCE,'01-source-error.png')});}
  await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();
  assert.equal(await page.locator('#assistant-problem').isVisible(),true,'关闭弹窗后仍保留问题摘要');
  assert.equal(await page.locator('#simple-duplicate-merge').isChecked(),false,'关闭弹窗不改变整理方式');
  await page.locator('#simple-primary').click();
  await dialog.getByRole('button',{name:'去核对来源',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-review-field')==='quantity');
  assert.equal(await page.locator('#preview-mode').inputValue(),'issues');
  assert.match(await page.locator('#page-summary').textContent(),/2 \/ /,'问题不在第一页时应自动翻到对应页');
  const target=page.locator('#preview-list .source-problem-target');
  assert.equal(await target.count(),1);assert.match(await target.textContent(),/第 26 行/);
  assert.equal(await page.locator('#imported-books .selected-file .source').textContent(),path.join(root,'a','清单.xlsx'),'按完整路径选正确文件，不能仅按同名文件名匹配');
  assert.equal(await page.locator('#confirm-merge').isDisabled(),true,'导航到问题不能当作已经解决');
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),1);
  if(process.env.RFQ_SOURCE_ISSUE_EVIDENCE)await page.screenshot({path:path.join(process.env.RFQ_SOURCE_ISSUE_EVIDENCE,'02-source-correction.png')});
  await target.locator('[data-review-field="quantity"]').fill('5');
  await target.getByRole('button',{name:'确认本行核对',exact:true}).click();
  assert.equal(await page.locator('#confirm-merge').isDisabled(),true,'仍有另一来源的异常时继续阻断');
  assert.match(await page.locator('#assistant-problem').textContent(),/还有 1 处来源问题/,'摘要数量随真实修正更新');
  assert.equal(await page.locator('#simple-primary').isVisible(),true,'修正完成后直接回到原位主按钮，不能让用户再寻找返回入口');
  await page.locator('#simple-primary').click();
  assert.match(await dialog.textContent(),/还有 1 处来源问题/);
  await dialog.getByRole('button',{name:'去核对来源',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-review-field')==='quantity');
  assert.equal(await page.locator('#imported-books .selected-file .source').textContent(),path.join(root,'b','清单.xlsx'));
  await target.locator('[data-review-field="quantity"]').fill('6');
  await target.getByRole('button',{name:'确认本行核对',exact:true}).click();
  assert.equal(await page.locator('#confirm-merge').isEnabled(),true,'两处真实修正完成后才解除来源阻断');
  assert.equal(await page.locator('#assistant-problem').isHidden(),true,'真实修正全部完成后清除旧摘要');
  assert.equal(await page.locator('#simple-primary').isVisible(),true);
  if(process.env.RFQ_SOURCE_ISSUE_EVIDENCE)await page.screenshot({path:path.join(process.env.RFQ_SOURCE_ISSUE_EVIDENCE,'03-return-to-primary.png')});
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),1,'来源修正不冒充分类确认或自动推进');
  assert.equal((await store.load(saved.projectId)).revision,1,'定位和修正不静默覆盖已保存项目');
  async function reopen(next){
   await page.locator('#simple-mode-toggle').click();await page.locator('#refresh-projects').click();
   await page.locator('#project-list li').filter({hasText:next.name}).getByRole('button',{name:'打开',exact:true}).click();
   await page.waitForFunction(id=>document.getElementById('project-message').textContent.includes('已恢复项目'+id),next.projectId);
   await page.locator('#simple-mode-toggle').click();await page.locator('#simple-primary').click();
  }
  await reopen(continuation);await dialog.getByRole('button',{name:'去核对来源',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.closest('.continuation-form'));
  const pendingRow=await page.evaluate(()=>document.activeElement.closest('.continuation-form').querySelector('strong').textContent);
  const pending=target.locator('.continuation-form').filter({hasText:'第 5 行特征续行'});
  await pending.locator('input').fill('6');await pending.getByRole('button',{name:'确认第 5 行归属',exact:true}).click();
  assert.equal(await page.locator('#confirm-merge').isEnabled(),true,'剩余续行真实确认后解除阻断');
  await reopen(removal);await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();
  await page.locator('#simple-mode-toggle').click();await page.locator('#imported-books li').getByRole('button',{name:'移除此文件',exact:true}).click();
  await page.locator('#simple-mode-toggle').click();
  assert.equal(await page.locator('#imported-books li').count(),0);
  const emptySummaryHidden=await page.locator('#assistant-problem').isHidden();
  assert.deepEqual({pendingRow,emptySummaryHidden},{pendingRow:'第 5 行特征续行 · 待确认',emptySummaryHidden:true},'应定位未确认续行，并在移除全部来源后清除旧问题摘要');
  assert.deepEqual(errors,[]);
  if(process.env.RFQ_SOURCE_ISSUE_SCREEN)await page.screenshot({path:process.env.RFQ_SOURCE_ISSUE_SCREEN,fullPage:true});
  console.log('ui-source-issue PASS');
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('rfq-source-issue-'))throw Error('Unexpected cleanup target');
  await fs.rm(root,{recursive:true,force:true});
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
