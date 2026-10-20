// R10（图07）：一键拆分、持久回执与失败续作。用真实页面/本机服务/暂存发布，模拟宿主只负责WPS写入接口。
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const inquiryModel=require('../src/inquiry-model.js');
const xlsxFixture=require('./fixtures/xlsx-container.cjs');
const SPLIT_NAMES=sample.expectations.splitFiles.slice(),TOTAL_NAME='示例园区_询价总表_完整文件.xlsx',
 NO_INQUIRY_NAME='示例园区_无需询价.xlsx';
const SHOT=process.env.RFQ_UI_SPLIT_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_SPLIT_EVIDENCE;
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function columnName(index){let name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
function mergeAddresses(layout){
 return ((layout&&layout.merges)||[]).map(function(item){
  return columnName(item.column)+item.row+':'+columnName(item.column+(item.columnSpan||1)-1)+(item.row+(item.rowSpan||1)-1);});
}
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
  const noInquiry={categoryId:'no-inquiry',categoryName:'无需询价',sheetName:'无需询价',splitFileName:NO_INQUIRY_NAME,
   rows:[{rowId:'no-inquiry-row-1',index:'1',code:'GS-001',name:'钢索',feature:'规格C',unit:'m',quantity:'10',
    scopeId:'combined',sourceIds:[],categoryId:'no-inquiry',categoryName:'无需询价',skip:true,note:'无需询价'}]};
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
   window.__existingBooks={};window.__openCalls=[];window.__closedOwned=0;
   window.Application={ActiveWorkbook:previous,AutomationSecurity:1,Workbooks:{Count:1,Item(){return previous;},
    Open(file,links,readonly){
     window.__openCalls.push({file:file,links:links,readonly:readonly,security:window.Application.AutomationSecurity});
     const spec=window.__existingBooks[String(file).toLowerCase()];
     if(!spec)throw Error('模拟宿主未登记已有文件：'+file);
     const merges={};(spec.merges||[]).forEach(function(address){merges[address]=true;});
     function rangeFor(address){
      return {HasFormula:false,get MergeCells(){return merges[address]===true;},
       get Value2(){return spec.values.map(function(row){return row.slice();});},
       Font:{},Interior:{},Validation:{Type:null,Formula1:null},Hyperlinks:{Count:0},
       Rows:{AutoFit(){}},Merge(){merges[address]=true;}};
     }
     const sheet={Name:spec.name,Range:rangeFor,
      Activate(){window.Application.ActiveWindow=spec.freeze||{};},
      Columns:{Item(i){return {Hidden:(spec.hidden||[]).indexOf(i)>=0};}}};
     const book={FullName:file,Worksheets:{get Count(){return 1;},
       Item(i){return typeof i==='number'?sheet:(sheet.Name===i?sheet:undefined);}},
      Close(save){if(save)throw Error('核对已有文件必须只读关闭');window.__closedOwned++;
       window.Application.ActiveWorkbook=previous;},
      Activate(){window.Application.ActiveWorkbook=book;}};
     return book;
    }},
    GetSaveAsFilename(){throw Error('R10不得调用系统另存对话框');},GetOpenFilename(){throw Error('R10不得调用系统打开对话框');}};
   window.__splitWrites=[];window.__receipts=[];window.__openedFolder='';
  });
  await page.exposeFunction('__writeSplitFixture',async function(stagePath,payload){
   await fs.writeFile(stagePath,xlsxFixture.workbook(payload));});
  await require('./assistant-test-ui.cjs').acknowledgeProblems(page);
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  assert.match(await page.locator('#split-note').innerText(),/无需询价.*完整总表/,
   '第7步说明必须同时标明无需询价文件和拆分前完整总表');
  await page.evaluate(function(args){
   ['split-message','split-status','split-directory','split-directory-label','split-preview','split-run','split-retry','split-open']
    .forEach(function(id){const old=document.getElementById(id),clone=old.cloneNode(true);old.parentNode.replaceChild(clone,old);});
   window.__splitGeneration=args.generation;window.__splitOutput=args.outputDirectory;window.__splitNoInquiry=args.noInquiry;
   window.__nativeFolderShows=0;window.__nativeCancel=false;window.__webPickerShows=0;
   window.RfqPathPicker.open=function(){window.__webPickerShows++;throw Error('第7步不能回退网页目录树');};
   window.Application.FileDialog=function(type){
    if(this!==window.Application||type!==4)throw Error('原生目录选择调用归属或类型错误');
    return {Title:'',InitialFileName:'',Show(){window.__nativeFolderShows++;return window.__nativeCancel?0:-1;},
     SelectedItems:{Item(){return window.__splitOutput;}}};
   };
   window.RfqBrandHost.write=async function(app,book,stagePath,settings){
    const sheet=book.sheets[0];
    window.__splitWrites.push({stagePath:stagePath,name:sheet.name,hasLayout:!!sheet.layout,
     columns:sheet.values[sheet.values.length-sheet.layout.metadata.headerRow],
     values:sheet.values.slice(sheet.layout.metadata.headerRow).map(function(row){return row.slice(0,10);})});
    if(window.__failSynthetic&&sheet.name==='阀门_合成询价'){window.__failSynthetic=false;throw Error('模拟第二份失败');}
    await window.__writeSplitFixture(stagePath,book.sheets);
    if(settings&&settings.finalizeFreeze)await settings.finalizeFreeze();
   };
   window.Application.Shell=function(command){window.__openedFolder=command;};
   window.__splitPanel=window.RfqSplitUI.create({application:window.Application,
    context:function(){return {inputKey:window.__splitGeneration.inputKey,noInquiry:window.__splitNoInquiry};},
    generation:function(){return window.__splitGeneration;},projectId:function(){return 'p-split-ui-0001';},
    onReceipt:function(receipt){window.__receipts.push(receipt);}});
   window.__splitPanel.restore(null);
  },{generation:generation,outputDirectory:outputDirectory,noInquiry:noInquiry});
  await page.locator('#workflow-nav .workflow-step-button[data-stage="split"]').click();
  assert.equal(await page.locator('#stage-panel-split #split-directory').count(),1,
   '图07目录选择与一键拆分必须属于第七步主面板');
  assert.equal(await page.locator('#stage-panel-split #split-run').isVisible(),true,
   '进入第七步直接显示拆分主操作，无需展开辅助功能');
  await page.evaluate(function(){delete window.__splitGeneration.modelSnapshot.layoutVersion;window.__splitPanel.refresh();});
  assert.equal(await page.locator('#split-run').isDisabled(),true,'旧式总表不能直接在第7步拆分');
  assert.match(await page.locator('#split-status').innerText(),/重新生成|请先生成/);
  await page.evaluate(function(){window.__splitGeneration.modelSnapshot.layoutVersion=RfqInquiryModel.LAYOUT_VERSION;window.__splitPanel.refresh();});
  assert.doesNotMatch(await page.locator('#stage-panel-split').innerText(),/将在 R10 开发包实现/,
   '已实现拆分不可继续展示未实现占位说明');
  await page.evaluate(function(){document.getElementById('split-directory').click();});
  await page.waitForFunction(function(){return /计划 7 个文件/.test(document.getElementById('split-status').textContent)&&
   !document.getElementById('split-run').disabled;});
  assert.equal(await page.evaluate(()=>window.__nativeFolderShows),1,'详细第7步直接调用原生目录选择器');
  const selectedBeforeCancel=await page.evaluate(()=>window.__splitPanel.directory());
  await page.evaluate(async()=>{window.__nativeCancel=true;await window.__splitPanel.chooseDirectory();});
  assert.equal(await page.evaluate(()=>window.__splitPanel.directory()),selectedBeforeCancel,'简版原生取消保留已选输出目录');
  assert.equal(await page.evaluate(()=>window.__nativeFolderShows),2);
  await page.evaluate(async()=>{delete window.Application.FileDialog;await window.__splitPanel.chooseDirectory();});
  assert.equal(await page.evaluate(()=>window.__webPickerShows),0,'宿主不可用时不静默回退网页目录树');
  assert.match(await page.locator('#split-message').textContent(),/原生.*文件夹/);
  assert.equal(await page.evaluate(()=>window.__splitPanel.directory()),selectedBeforeCancel,'原生失败仍保留现有目录');
  await page.evaluate(function(){window.__failSynthetic=true;document.getElementById('split-run').click();});
  await page.waitForFunction(function(){return /拆分完成6份，失败1份/.test(document.getElementById('split-message').textContent)&&
   window.__splitWrites.length===6;});
  assert.deepEqual((await fs.readdir(outputDirectory)).sort(),SPLIT_NAMES.slice(0,2).concat(SPLIT_NAMES.slice(3),
   [NO_INQUIRY_NAME,TOTAL_NAME]).sort(),'失败该份未发布，其余供应商件、无需询价和完整总表真实落盘');
  const beforeRetry=await page.evaluate(function(){return window.__splitWrites.map(function(item){return item.name;});});
  assert.deepEqual(beforeRetry,['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电','无需询价']);
  await page.locator('.rfq-split-result button').click();
  await page.evaluate(function(){document.getElementById('split-retry').click();});
  await page.waitForFunction(function(){return /完成7份，失败0份/.test(document.getElementById('split-message').textContent)&&
   window.__splitWrites.length===7;});
  if(SHOT){await fs.mkdir(path.dirname(SHOT),{recursive:true});await page.screenshot({path:SHOT,fullPage:true});}
  if(EVIDENCE){
   await fs.mkdir(EVIDENCE,{recursive:true});
   const evidence=await page.evaluate(function(){return {message:document.getElementById('split-message').textContent,
    status:document.getElementById('split-status').textContent,directory:document.getElementById('split-directory-label').textContent,
    writes:window.__splitWrites.map(function(item){return {name:item.name,hasLayout:item.hasLayout,values:item.values};}),
    receipt:window.__splitPanel.receipt(),openedFolder:window.__openedFolder};});
   await fs.writeFile(path.join(EVIDENCE,'split-result.json'),JSON.stringify(evidence,null,2));
  }
  assert.deepEqual((await fs.readdir(outputDirectory)).sort(),SPLIT_NAMES.concat([NO_INQUIRY_NAME,TOTAL_NAME]).sort(),
   '五个供应商文件、无需询价清单及完整总表共七件全部存在');
  assert.deepEqual(await fs.readFile(path.join(outputDirectory,TOTAL_NAME)),generationBytes,'完整总表逐字节不变');
  const writes=await page.evaluate(function(){return window.__splitWrites;});
  assert.deepEqual(writes.map(function(item){return item.name;}),
   ['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电','无需询价','阀门_合成询价'],
   '重试只补做失败的一份，不重复写已成功文件');
  assert.equal(writes.every(function(item){return item.hasLayout;}),true,'每份独立xlsx保留图06版式/抬头布局');
  assert.equal(writes.every(function(item){return item.values.every(function(row){return row.length===10;});}),true,
   '公开清单仍是10列，不复制内部追溯页');
  const noInquiryWrite=writes.filter(function(item){return item.name==='无需询价';})[0];
  assert.ok(noInquiryWrite,'无需询价必须单独生成一个文件');
  assert.equal(noInquiryWrite.values[0][1],'GS-001');
  assert.equal(noInquiryWrite.values[0][9],'无需询价','无需询价文件备注明确，供后续复核');
  assert.equal(writes.some(function(item){return item.values.some(function(row){return row.indexOf('内部追溯')>=0;});}),false);
  await page.locator('.rfq-split-result button').click();
  await page.evaluate(function(){document.getElementById('split-open').click();});
  await page.waitForFunction(function(){return /explorer\.exe/.test(window.__openedFolder||'');});
  assert.match(await page.evaluate(function(){return window.__openedFolder;}),/询价输出/,'打开输出文件夹指向实际目录');
  // 真机Application没有Shell/ShellExecute；WPS加载项壳服务在OAAssist对象上。
  await page.evaluate(function(){
   delete window.Application.Shell;
   window.Application.OAAssist={ShellExecute:function(url,params){window.__openedViaOA={url:url,params:params};}};
   document.getElementById('split-open').click();
  });
  assert.deepEqual(await page.evaluate(function(){return window.__openedViaOA||null;}),
   {url:'explorer.exe',params:'"'+outputDirectory+'"'},
   '没有Application.Shell时通过WPS OAAssist打开实际中文目录');
  const receiptCount=await page.evaluate(function(){return window.__receipts.length;});
  assert.equal(receiptCount>0,true,'每次回执变化都请求项目记录保存');
  const receiptFiles=await fs.readdir(splitDirectory);
  assert.equal(receiptFiles.length,1,'按项目＋批次只写一份回执');
  // 关闭/重开结果窗口不改变状态：回执在服务端，多次refresh后逐文件状态必须一致。
  const doneStates=await page.evaluate(function(){return window.__splitPanel.receipt().files.map(function(file){
   return file.fileId+':'+file.state+':'+file.verifiedBy;});});
  const writesBeforeReopen=await page.evaluate(function(){return window.__splitWrites.length;});
  await page.evaluate(function(){document.getElementById('split-run').click();});
  await page.waitForFunction(function(){return !!document.querySelector('.rfq-split-result');});
  await page.locator('.rfq-split-result button').click();
  await page.evaluate(function(){window.__splitPanel.refresh();});
  await page.waitForFunction(function(){return /完成 7/.test(document.getElementById('split-status').textContent);});
  const afterReopen=await page.evaluate(function(){return window.__splitPanel.receipt().files.map(function(file){
   return file.fileId+':'+file.state+':'+file.verifiedBy;});});
  assert.deepEqual(afterReopen,doneStates,'关闭/重开结果窗口和refresh都不改变逐文件状态');
  assert.equal(await page.evaluate(function(){return window.__splitWrites.length;}),writesBeforeReopen,
   '重开结果窗口不重复写已成功文件');
  // 外部改写已成功文件：刷新后必须转待核对，不能沿用旧成功，也不能直接重试覆盖。
  const firstTarget=path.join(outputDirectory,SPLIT_NAMES[0]);
  await fs.writeFile(firstTarget,'外部改写');
  const externalBytes=await fs.readFile(firstTarget);
  await page.evaluate(function(){window.__splitPanel.refresh();});
  await page.waitForFunction(function(){return /待核对 1/.test(document.getElementById('split-status').textContent);});
  if(EVIDENCE)await fs.writeFile(path.join(EVIDENCE,'split-blocked.json'),JSON.stringify(
   await page.evaluate(function(){return {message:document.getElementById('split-message').textContent,
    status:document.getElementById('split-status').textContent,runDisabled:document.getElementById('split-run').disabled,
    retryDisabled:document.getElementById('split-retry').disabled};}),null,2));
  assert.equal(await page.locator('#split-run').isDisabled(),true,'待核对存在时一键拆分不发布');
  assert.equal(await page.locator('#split-retry').isDisabled(),false,'显式核对入口必须可用');
  // 同名异内容：逐值核对不通过时保持待核对，且绝不覆盖原文件。
  const expectedSheet=fixture.model.sheets.filter(function(sheet){return sheet.name==='水泵_青源';})[0];
  const wrongValues=expectedSheet.values.map(function(row,index){
   return index===expectedSheet.values.length-1?row.map(function(value,column){return column===5?'999':value;}):row.slice();});
  await page.evaluate(function(args){
   window.__existingBooks[args.target.toLowerCase()]={name:args.name,values:args.values,merges:args.merges,hidden:[],
    freeze:{FreezePanes:true,SplitRow:6,SplitColumn:0}};
  },{target:firstTarget,name:expectedSheet.name,values:wrongValues,merges:mergeAddresses(expectedSheet.layout)});
  await page.evaluate(function(){document.getElementById('split-retry').click();});
  await page.waitForFunction(function(){return /待核对1份/.test(document.getElementById('split-message').textContent)&&
   (window.__openCalls||[]).length>0;});
  assert.equal(await page.evaluate(function(){return window.__splitPanel.receipt().files[0].state;}),'needs-verification');
  assert.equal(await page.evaluate(function(){return window.__splitPanel.receipt().files[0].verifiedBy;}),null);
  assert.deepEqual(await fs.readFile(firstTarget),externalBytes,'核对不通过时原文件保持不变');
  // F5：公开值及SHA相同，但冻结在A2而不是水泵单品牌表的A7，仍须保持待核对。
  await page.evaluate(function(args){
   window.__existingBooks[args.target.toLowerCase()]={name:args.name,values:args.values,merges:args.merges,hidden:[],
    freeze:{FreezePanes:true,SplitRow:1,SplitColumn:0}};
  },{target:firstTarget,name:expectedSheet.name,values:expectedSheet.values,merges:mergeAddresses(expectedSheet.layout)});
  await page.evaluate(function(){document.getElementById('split-retry').click();});
  await page.waitForFunction(function(){return /冻结位置读回不一致/.test(
   window.__splitPanel.receipt().files[0].error||'')&&!document.getElementById('split-retry').disabled;});
  assert.equal(await page.evaluate(function(){return window.__splitPanel.receipt().files[0].state;}),'needs-verification');
  assert.equal(await page.evaluate(function(){return window.__splitPanel.receipt().files[0].verifiedBy;}),null);
  assert.deepEqual(await fs.readFile(firstTarget),externalBytes,'冻结差异核对失败也不得覆盖原文件');
  // 内容逐值一致、冻结正确且SHA稳定：显式核对通过后才记为成功（verifiedBy=content-check）。
  await page.evaluate(function(args){
   window.__existingBooks[args.target.toLowerCase()]={name:args.name,values:args.values,merges:args.merges,hidden:[],
    freeze:{FreezePanes:true,SplitRow:6,SplitColumn:0}};
  },{target:firstTarget,name:expectedSheet.name,values:expectedSheet.values,merges:mergeAddresses(expectedSheet.layout)});
  await page.evaluate(function(){document.getElementById('split-retry').click();});
  await page.waitForFunction(function(){return /完成7份，失败0份/.test(document.getElementById('split-message').textContent)&&
   !/待核对/.test(document.getElementById('split-status').textContent);});
  const verified=await page.evaluate(function(){return window.__splitPanel.receipt().files[0];});
  assert.equal(verified.state,'succeeded');
  assert.equal(verified.verifiedBy,'content-check','只有显式内容核对才把已有文件记成功');
  assert.equal(verified.sha256,digest(externalBytes),'记录的是核对时的实际SHA');
  if(EVIDENCE)await fs.writeFile(path.join(EVIDENCE,'split-verified.json'),JSON.stringify(
   await page.evaluate(function(){return {message:document.getElementById('split-message').textContent,
    status:document.getElementById('split-status').textContent,receipt:window.__splitPanel.receipt(),
    openCalls:window.__openCalls,closedOwned:window.__closedOwned};}),null,2));
  assert.equal(await page.evaluate(function(){return window.__closedOwned>=2;}),true,'核对打开的文件只读关闭');
  assert.deepEqual(errors,[]);
  console.log('PASS(R12-E): 图07一键拆分——5份独立询价文件且失败只续作；待核对文件重复刷新/重启不自动成功，'+
   '同名异内容保持待核对且不覆盖，显式逐值核对通过后才按实际SHA记成功；分类簿/汇总表保留，打开输出文件夹指向实际目录。');
 }finally{
  await browser.close();
  await new Promise(resolve=>{server.close(resolve);if(typeof server.closeAllConnections==='function')server.closeAllConnections();});
  await fs.rm(root,{recursive:true,force:true});
 }
}
run().catch(function(error){console.error(error);process.exitCode=1;});
