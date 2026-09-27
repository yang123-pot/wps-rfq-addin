// R10（图07）：一键拆分、持久回执与失败续作。用真实页面/本机服务/暂存发布，模拟宿主只负责WPS写入接口。
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const inquiryModel=require('../src/inquiry-model.js');
const SPLIT_NAMES=sample.expectations.splitFiles.slice();
const SHOT=process.env.RFQ_UI_SPLIT_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_SPLIT_EVIDENCE;
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function generationFixture(){
 const preview=collection.preview(sample.buildCollection(),true);
 const categoryByMaterial={'水泵':'pump','阀门':'valve','送风机':'fan','排风机':'fan','充电桩配电箱':'ev-charger','钢索':'no-inquiry'};
 const decisions=preview.groups.map(function(group){
  return {rowId:group.id,categoryId:categoryByMaterial[group.name],categoryName:group.name};
 });
 const categories=sample.expectations.categories.map(function(item){
  return {categoryId:item.categoryId,categoryName:item.categoryName,rowCount:item.rows,
   mode:item.mode==='separate-brands'?'per-brand':'synthesize',groups:item.groups};
 });
 const model=inquiryModel.build({brands:categories,groups:preview.groups,classification:{decisions:decisions},
  header:{projectName:'示例园区',company:'示例建设公司',contact:'测试员',phone:'示例联系方式',address:''},
  inputKey:'ck2-'+'a'.repeat(16)});
 model.inputKey='ck2-'+'a'.repeat(16);
 return {model:model,categories:categories};
}
async function run(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-split-')),outputDirectory=path.join(root,'询价输出');
 await fs.mkdir(outputDirectory,{recursive:true});
 const splitDirectory=path.join(root,'splits'),projectDirectory=path.join(root,'projects'),copies=path.join(root,'copies');
 const generationBytes=Buffer.from([0x50,0x4b,3,4,1,2,3,4,5]),generationTarget=path.join(root,'示例园区_询价总表.xlsx');
 await fs.writeFile(generationTarget,generationBytes);
 const fixture=generationFixture(),generation={inputKey:fixture.model.inputKey,target:generationTarget,
  sha256:digest(generationBytes),sheetIds:fixture.model.sheets.map(function(sheet){return sheet.sheetId;}),
  modelSnapshot:fixture.model};
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:copies,projectDirectory:projectDirectory,
  splitDirectory:splitDirectory});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',function(error){errors.push(error.message);});
  await page.addInitScript(function(){
   const emptySheet={Name:'Sheet1',UsedRange:{Row:1,Column:1,Rows:{Count:1},Columns:{Count:1},Value2:[[1]]}};
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Worksheets:{Count:1,Item(){return emptySheet;}},
    Activate(){window.Application.ActiveWorkbook=this;}};
   window.Application={ActiveWorkbook:previous,AutomationSecurity:1,Workbooks:{Count:1,Item(){return previous;}},
    GetSaveAsFilename(){throw Error('R10不得调用系统另存对话框');},GetOpenFilename(){throw Error('R10不得调用系统打开对话框');}};
   window.__splitWrites=[];window.__receipts=[];window.__openedFolder='';
  });
  await page.exposeFunction('__writeSplitFixture',async function(stagePath,payload){
   await fs.writeFile(stagePath,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  await page.evaluate(function(args){
   ['split-message','split-status','split-directory','split-directory-label','split-preview','split-run','split-retry','split-open']
    .forEach(function(id){const old=document.getElementById(id),clone=old.cloneNode(true);old.parentNode.replaceChild(clone,old);});
   window.__splitGeneration=args.generation;window.__splitOutput=args.outputDirectory;
   window.RfqPathPicker.open=function(options){window.__picker=options;options.onConfirm([window.__splitOutput]);return {close(){}};};
   window.RfqBrandHost.write=async function(app,book,stagePath){
    const sheet=book.sheets[0];
    window.__splitWrites.push({stagePath:stagePath,name:sheet.name,hasLayout:!!sheet.layout,
     columns:sheet.values[sheet.values.length-sheet.layout.metadata.headerRow],
     values:sheet.values.slice(sheet.layout.metadata.headerRow).map(function(row){return row.slice(0,10);})});
    if(window.__failSynthetic&&sheet.name==='阀门_合成询价'){window.__failSynthetic=false;throw Error('模拟第二份失败');}
    await window.__writeSplitFixture(stagePath,sheet.name);
   };
   window.Application.Shell=function(command){window.__openedFolder=command;};
   window.__splitPanel=window.RfqSplitUI.create({application:window.Application,
    context:function(){return {inputKey:window.__splitGeneration.inputKey};},
    generation:function(){return window.__splitGeneration;},projectId:function(){return 'p-split-ui-0001';},
    onReceipt:function(receipt){window.__receipts.push(receipt);}});
   window.__splitPanel.restore(null);
  },{generation:generation,outputDirectory:outputDirectory});
  await page.locator('#workflow-nav .workflow-step-button[data-stage="split"]').click();
  await page.evaluate(function(){document.getElementById('split-directory').click();});
  await page.waitForFunction(function(){return /计划 5 个文件/.test(document.getElementById('split-status').textContent)&&
   !document.getElementById('split-run').disabled;});
  await page.evaluate(function(){window.__failSynthetic=true;document.getElementById('split-run').click();});
  await page.waitForFunction(function(){return /拆分完成4份，失败1份/.test(document.getElementById('split-message').textContent)&&
   window.__splitWrites.length===5;});
  assert.deepEqual((await fs.readdir(outputDirectory)).sort(),SPLIT_NAMES.slice(0,2).concat(SPLIT_NAMES.slice(3)).sort(),
   '失败该份未发布，其余四份真实落盘');
  const beforeRetry=await page.evaluate(function(){return window.__splitWrites.map(function(item){return item.name;});});
  assert.deepEqual(beforeRetry,['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电']);
  await page.locator('.rfq-split-result button').click();
  await page.evaluate(function(){document.getElementById('split-retry').click();});
  await page.waitForFunction(function(){return /完成5份，失败0份/.test(document.getElementById('split-message').textContent)&&
   window.__splitWrites.length===6;});
  if(SHOT){await fs.mkdir(path.dirname(SHOT),{recursive:true});await page.screenshot({path:SHOT,fullPage:true});}
  if(EVIDENCE){
   await fs.mkdir(EVIDENCE,{recursive:true});
   const evidence=await page.evaluate(function(){return {message:document.getElementById('split-message').textContent,
    status:document.getElementById('split-status').textContent,directory:document.getElementById('split-directory-label').textContent,
    writes:window.__splitWrites.map(function(item){return {name:item.name,hasLayout:item.hasLayout,values:item.values};}),
    receipt:window.__splitPanel.receipt(),openedFolder:window.__openedFolder};});
   await fs.writeFile(path.join(EVIDENCE,'split-result.json'),JSON.stringify(evidence,null,2));
  }
  assert.deepEqual((await fs.readdir(outputDirectory)).sort(),SPLIT_NAMES.slice().sort(),'重试后5个图07文件名全部存在');
  const writes=await page.evaluate(function(){return window.__splitWrites;});
  assert.deepEqual(writes.map(function(item){return item.name;}),
   ['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电','阀门_合成询价'],
   '重试只补做失败的一份，不重复写已成功文件');
  assert.equal(writes.every(function(item){return item.hasLayout;}),true,'每份独立xlsx保留图06版式/抬头布局');
  assert.equal(writes.every(function(item){return item.values.every(function(row){return row.length===10;});}),true,
   '公开清单仍是10列，不复制内部追溯页');
  assert.equal(writes.some(function(item){return item.values.some(function(row){return row.indexOf('内部追溯')>=0;});}),false);
  await page.locator('.rfq-split-result button').click();
  await page.evaluate(function(){document.getElementById('split-open').click();});
  await page.waitForFunction(function(){return /explorer\.exe/.test(window.__openedFolder||'');});
  assert.match(await page.evaluate(function(){return window.__openedFolder;}),/询价输出/,'打开输出文件夹指向实际目录');
  const receiptCount=await page.evaluate(function(){return window.__receipts.length;});
  assert.equal(receiptCount>0,true,'每次回执变化都请求项目记录保存');
  const receiptFiles=await fs.readdir(splitDirectory);
  assert.equal(receiptFiles.length,1,'按项目＋批次只写一份回执');
  // 外部改写已成功文件：刷新后必须转待核对，不能沿用旧成功，也不能直接重试覆盖。
  await fs.writeFile(path.join(outputDirectory,SPLIT_NAMES[0]),'外部改写');
  await page.evaluate(function(){window.__splitPanel.refresh();});
  await page.waitForFunction(function(){return /待核对 1/.test(document.getElementById('split-status').textContent);});
  if(EVIDENCE)await fs.writeFile(path.join(EVIDENCE,'split-blocked.json'),JSON.stringify(
   await page.evaluate(function(){return {message:document.getElementById('split-message').textContent,
    status:document.getElementById('split-status').textContent,runDisabled:document.getElementById('split-run').disabled,
    retryDisabled:document.getElementById('split-retry').disabled};}),null,2));
  assert.equal(await page.locator('#split-run').isDisabled(),true);
  assert.equal(await page.locator('#split-retry').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS(R10): 图07一键拆分——5份独立询价文件与图07文件名一致，逐份重开核/SHA回执、失败只续作未完成、外部改写转待核对不覆盖，分类簿/汇总表保留，打开输出文件夹指向实际目录。');
 }finally{
  await browser.close();
  await new Promise(resolve=>{server.close(resolve);if(typeof server.closeAllConnections==='function')server.closeAllConnections();});
  await fs.rm(root,{recursive:true,force:true});
 }
}
run().catch(function(error){console.error(error);process.exitCode=1;});
