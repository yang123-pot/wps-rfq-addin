// R9（图06）：第6步“品牌与供应商带入询价表”的端到端检查。
// 走真实七步链路：导入→合并确认→整表确认→4份分类工作簿→生成汇总表→读回品牌→生成总询价工作簿。
// 模拟宿主只负责WPS写入接口；分类库、项目库、导出暂存/发布/SHA走真实服务端。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const reviewModel=require('../src/classification-review-model.js');
const brandModel=require('../src/brand-model.js');
const inquiryModel=require('../src/inquiry-model.js');
const xlsxFixture=require('./fixtures/xlsx-container.cjs');
const SHOT=process.env.RFQ_UI_INQUIRY_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_INQUIRY_EVIDENCE;

const DRAIN=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['SB-001','水泵','DN50','台','1'],['SB-002','水泵','DN65','台','1'],['FM-001','阀门','DN50','个','20'],
 ['FM-002','阀门','DN65','个','12'],['GS-001','钢索','规格C','m','10']];
const MEP=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['','给排水','','',''],['SB-101','水泵','DN50','台','1'],['SB-102','水泵','DN65','台','2'],
 ['','暖通','','',''],['FJ-101','送风机','规格A','台','2'],['FJ-102','排风机','规格B','台','3'],
 ['','强电','','',''],['CD-101','充电桩配电箱','充电桩配套','台','1']];
const REVIEW_VALUES=(function(){
 const preview=collection.preview(sample.buildCollection(),true);
 const result=reviewModel.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01',mergeAllWorkbooks:true});
 return reviewModel.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values;
}());
const CONFLICT_ROW=REVIEW_VALUES.findIndex(function(row){return row[1]==='充电桩配电箱';})+1;
// 第6.1节样例填写：水泵2组按品牌分别生成(2份)、阀门2组合成(1份)、风机/充电桩各1份，合计5份。
const SUMMARY_FILLS=[
 {mode:'per-brand',groups:[{brand:'青源',supplier:'华川设备'},{brand:'恒流',supplier:'启明机电'}]},
 {mode:'synthesize',groups:[{brand:'通达',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}]},
 {mode:'synthesize',groups:[{brand:'瑞风',supplier:'瑞风设备'}]},
 {mode:'synthesize',groups:[{brand:'驰电',supplier:'远程电气'}]}];
function fillSummaryGrid(model,fills){
 const values=model.values.map(function(row){return row.slice();}),spec=brandModel.summaryLayoutFor(model.layout);
 fills.forEach(function(fill,index){
  const row=spec.firstRow+index;
  (fill.groups||[]).forEach(function(group,groupIndex){
   if(spec.name==='combined')values[row-1][spec.groups[groupIndex][0]-1]='品牌：'+group.brand+'\n供应商：'+group.supplier;
   else{values[row-1][spec.groups[groupIndex][0]-1]=group.brand;values[row-1][spec.groups[groupIndex][1]-1]=group.supplier;}
  });
  values[row-1][spec.modeColumn-1]=fill.mode?brandModel.summaryModeLabel(fill.mode):'';
 });
 return values;
}
function initScript(context){
 const {files,reviewTarget}=context;
 window.__copies=[];window.__openBooks=[];window.__stores={};window.__categoryWrites=[];
 window.__summaryModels=[];window.__inquiryBooks=[];window.__summaryOpened=[];
 const nativeFetch=window.fetch;
 window.fetch=async function(){
  const response=await nativeFetch.apply(null,arguments);
  if(String(arguments[0])==='/api/import/prepare'&&response.ok){
   const data=await response.clone().json();
   if(Array.isArray(data.files))window.__copies=data.files;
  }
  return response;
 };
 const grids={'给排水清单.xlsx':{sheet:'给排水',values:context.drain},'机电清单.xlsx':{sheet:'机电安装',values:context.mep}};
 function seededReview(){try{return JSON.parse(window.localStorage.getItem('rfq-summary-review')||'null');}catch(_){return null;}}
 function storeFor(file){
  if(window.__stores[file])return window.__stores[file];
  const copy=window.__copies.filter(function(item){return item.copyPath===file;})[0];
  const name=copy?copy.originalName:(String(file)===String(reviewTarget)?'示例园区_分类审核成果.xlsx':null);
  const grid=name?grids[name]:null;
  const values=grid?grid.values.map(function(row){return row.slice();})
   :(String(file)===String(reviewTarget)?((seededReview()||context.reviewValues).map(function(row){return row.slice();}))
    :Array.from({length:5},function(){return ['','','','',''];}));
  window.__stores[file]={sheet:grid?grid.sheet:'分类审核成果',values:values,cells:{}};
  return window.__stores[file];
 }
 function sheetFor(file,requested){
  const store=storeFor(file);
  return {Name:typeof requested==='string'?requested:store.sheet,
   UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:store.values[0].length},Value2:store.values},
   Activate(){window.__activeSheet={file: file,name:this.Name};},
   Cells:{Item(row,column){return {NumberFormat:'',
    get Value2(){const value=store.cells[row+':'+column];return value===undefined?(store.values[row-1]||[])[column-1]:value;},
    set Value2(value){store.cells[row+':'+column]=value;},
    get HasFormula(){return false;},Select(){window.__selectedCell={file: file,sheet:typeof requested==='string'?requested:store.sheet,row,column};}};}}};
 }
 function openBook(file,readOnly){
  const book={FullName:file,ReadOnly:!!readOnly,
   Worksheets:{Count:1,Item(requested){return sheetFor(file,requested);}},
   Activate(){app.ActiveWorkbook=book;},Save(){book.saved=true;},
   Close(){window.__openBooks=window.__openBooks.filter(function(item){return item!==book;});}};
  window.__openBooks.push(book);
  return book;
 }
 const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
 const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
  Workbooks:{get Count(){return 1+window.__openBooks.length;},
   Item(index){return index===1?previous:window.__openBooks[index-2];},
   Open(file,links,readOnly){
    if(files.includes(file))throw Error('original was opened');
    const known=window.__copies.some(function(item){return item.copyPath===file;})||String(file).startsWith(context.root);
    if(!known)throw Error('unknown book: '+file);
    return window.__openBooks.filter(function(item){return item.FullName===file;})[0]||openBook(file,readOnly);
   }}};
 window.Application=app;window.__files=files;
 window.__setCell=function(row,column,value){storeFor(reviewTarget).cells[row+':'+column]=value;};
 window.__seedReview=function(values){
  const copied=values.map(function(row){return row.slice();});
  storeFor(reviewTarget).values=copied;storeFor(reviewTarget).cells={};
  try{window.localStorage.setItem('rfq-summary-review',JSON.stringify(copied));}catch(_){}
 };
 window.__seedSummary=function(file,values){window.__stores[file]={sheet:'分类汇总表',values:values.map(function(row){return row.slice();}),cells:{}};};
}
async function run(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-inquiry-')),
  files=[path.join(root,'给排水清单.xlsx'),path.join(root,'机电清单.xlsx')],
  reviewTarget=path.join(root,'示例园区_分类审核成果.xlsx'),projectDirectory=path.join(root,'projects'),
  workbookDirectory=path.join(root,'分类工作簿'),summaryTarget=path.join(root,'分类汇总表.xlsx'),
  inquiryTarget=path.join(root,'示例园区_询价总表.xlsx'),inquiryTarget2=path.join(root,'示例园区_询价总表_2.xlsx');
 await fs.writeFile(files[0],'drain');await fs.writeFile(files[1],'mep');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:projectDirectory,libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(function(resolve){server.listen(0,'127.0.0.1',resolve);});
 await createLibraryStore({directory:path.join(root,'library')}).save({expectedRevision:0,
  library:sample.library,memory:sample.createMemory()});
 const projectFile=async function(){
  const list=(await fs.readdir(projectDirectory)).filter(function(name){return name.endsWith('.json')&&!name.startsWith('.');});
  return path.join(projectDirectory,list[0]);
 };
 const projectRecord=async function(){return JSON.parse(await fs.readFile(await projectFile(),'utf8'));};
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',function(error){errors.push(error.message);});
  page.on('dialog',function(dialog){dialog.accept();});
  await page.addInitScript(initScript,{files:files,drain:DRAIN,mep:MEP,reviewTarget:reviewTarget,reviewValues:REVIEW_VALUES,root:root});
  await page.exposeFunction('__writeReviewFixture',async function(file){await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  await page.exposeFunction('__writeCategoryFixture',async function(file,payload){
   await fs.writeFile(file,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  await page.exposeFunction('__writeSummaryFixture',async function(file,payload){
   await fs.writeFile(file,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  await page.exposeFunction('__writeInquiryFixture',async function(file,payload){
   await fs.writeFile(file,xlsxFixture.workbook(payload));});
  const installStubs=function(){return page.evaluate(function(){
   // 一本多页（2026-10-11变更）：第4步一次写入“第 1 页汇总＋逐类页”，第5步汇总表＝同一本工作簿第 1 页。
   window.RfqCategoryWorkbooks.writeAll=async function(app,plan,stagePath,options){
    const summary=options&&options.summarySheet,spec=summary.layout,meta=spec.metadata||{};
    window.__categoryWrites.push({path:stagePath,file:plan.file,planPath:plan.path});
    window.__summaryModels.push({stagePath:stagePath,layout:meta.layout,firstRow:meta.firstRow,lastRow:meta.lastRow,
     modeColumn:meta.modeColumn,auxCategory:meta.auxCategory,auxFile:meta.auxFile,
     categories:(plan.files||[]).map(function(entry){return {categoryId:entry.categoryId,categoryName:entry.categoryName,
      rowCount:entry.rowCount,sheetName:entry.sheetName,file:plan.file};}),
     hyperlinks:spec.hyperlinks.map(function(link){return {address:link.address,subAddress:link.subAddress,
      internal:link.internal===true,display:link.display};}),
     values:summary.values.map(function(row){return row.slice();}),
     rows:summary.values.slice(meta.firstRow-1,meta.lastRow).map(function(row){return row.slice(0,10);})});
    await window.__writeCategoryFixture(stagePath,'workbook:'+(plan.files||[]).length);};
   // 发布后按页读回：本夹具只记录期望页（真实读回逻辑见 category-workbooks 单测与真机复刻）。
   window.RfqCategoryWorkbooks.verifySheets=function(app,filePath,expected){
    window.__categoryVerify=(window.__categoryVerify||[]).concat([{path:filePath,expected:expected}]);
    return {ok:true,issues:[],sheets:expected.map(function(item,index){
     return {index:index+1,sheetName:item.sheetName,rowCount:item.rowCount};})};};
   window.RfqBrandHost.openSummary=function(app,filePath){window.__summaryOpened.push(filePath);return {path:filePath,opened:true};};
   window.RfqBrandHost.selectTarget=function(app,suggested){
    window.__suggested=suggested;return window.__inquiryTarget;};
   window.RfqBrandHost.write=async function(app,model,stagePath,settings){
    window.__inquiryBooks.push({stagePath:stagePath,model:model});
    await window.__writeInquiryFixture(stagePath,model.sheets);
    if(settings&&settings.finalizeFreeze)await settings.finalizeFreeze();};
  });};
  await require('./assistant-test-ui.cjs').acknowledgeProblems(page);
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  const shot=async function(file){
   if(!file)return;
   await page.evaluate(function(){const aux=document.getElementById('aux-section');if(aux)aux.open=false;});
   await page.screenshot({path:file,fullPage:true});
  };
  const dump=async function(name,value){
   if(!EVIDENCE)return;
   await fs.mkdir(EVIDENCE,{recursive:true});
   await fs.writeFile(path.join(EVIDENCE,name),JSON.stringify(value,null,2));
  };
  // 图01→图04：导入、合并确认、整表确认（改选汽车充电桩）、生成一本多页分类工作簿。
  await page.locator('#import-files').click();
  await page.waitForFunction(function(){return document.querySelectorAll('#imported-books > li').length===2;});
 await page.locator('#preview-confirm').click();
 await page.waitForFunction(()=>document.querySelector('#merge-section').hidden===false);
  await page.locator('#merge-identical').check();
  await page.waitForFunction(function(){return document.querySelector('#workflow-merged').textContent==='8';});
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(function(){return /自动匹配完成/.test(document.querySelector('#classification-review-banner').textContent);});
  await page.evaluate(function(target){
   window.RfqPathPicker.open=function(options){options.onConfirm({directory:null,name:'示例园区_分类审核成果.xlsx',target:target});return null;};
   window.RfqClassificationReviewHost.write=async function(app,result,stagePath,options){
    const sheet=window.RfqClassificationReviewModel.mainSheet(result,{title:options&&options.title});
    window.__seedReview(sheet.values);
    await window.__writeReviewFixture(stagePath);};
  },reviewTarget);
  await installStubs();
  await page.evaluate(function(target){window.__inquiryTarget=target;},inquiryTarget);
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(function(){return document.querySelector('#classification-review-message').textContent.includes('已生成并校验');});
  await page.locator('#classification-review-open').click();
  await page.waitForFunction(function(){return document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='review';});
  await page.evaluate(function(args){window.__setCell(args.row,9,'汽车充电桩');window.__setCell(args.row,10,'充电桩配套');},{row:CONFLICT_ROW});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(function(){return /整表已确认（8 行）/.test(document.querySelector('#sheet-review-message').textContent);});
  await page.waitForFunction(function(){return /分类工作簿已生成（1 本 · 4 类 · 无需询价1页）/.test(document.querySelector('#categories-banner').textContent);});
  assert.deepEqual((await fs.readdir(workbookDirectory)).sort(),['示例园区_分类工作簿.xlsx'],
   '第4步只发布一本分类工作簿');
  // 图05A：分类汇总表＝同一本工作簿第 1 页（默认分列），一类一行，名称是文件内跳转链接。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  await page.waitForFunction(function(){return document.querySelector('#brands-banner').textContent.includes('尚未生成分类汇总表');});
  await page.locator('#brands-generate').click();
  await page.waitForFunction(function(){return window.__summaryModels.length>=1&&
   /已生成并校验分类汇总表/.test(document.querySelector('#brands-message').textContent)&&
   /分类汇总表已生成（4 类）/.test(document.querySelector('#brands-banner').textContent);});
  const summary=await page.evaluate(function(){return window.__summaryModels[0];});
  const receipt=await projectRecord();
  assert.equal(require('node:path').resolve(receipt.summary.path).toLowerCase(),
   require('node:path').resolve(receipt.categories.path).toLowerCase(),'汇总表与分类工作簿是同一本文件');
  await page.evaluate(function(args){window.__seedSummary(args.file,args.values);},
   {file:receipt.summary.path,values:fillSummaryGrid(summary,SUMMARY_FILLS)});
  // 用户保存已填汇总后，读回必须刷新物理SHA，不能沿用生成时的空表SHA。
  await fs.appendFile(receipt.summary.path,'saved-brand-values');
  const filledSummarySha=require('node:crypto').createHash('sha256')
   .update(await fs.readFile(receipt.summary.path)).digest('hex');
  // R8主按钮：读回品牌与供应商（不填抬头也应成功），读回后进入第6步询价表。
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(function(){return /已读回并校验汇总表/.test(document.querySelector('#brands-message').textContent);});
  await page.waitForFunction(function(){return document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='inquiry';});
  const savedBrands=await projectRecord();
  assert.equal(savedBrands.summary.sha256,filledSummarySha,'已填汇总的实际SHA必须保存到绑定');
  assert.equal(savedBrands.brands.sourceSha256,filledSummarySha,'读回来源SHA必须对应当前文件');
  assert.match(await page.locator('#inquiry-banner').innerText(),/询价抬头未填齐/,'抬头四项未填齐时不能生成询价表');
  assert.equal(await page.locator('#inquiry-generate').isDisabled(),true,'抬头未填齐时生成按钮禁用');
  assert.match(await page.locator('#inquiry-status').innerText(),/缺少项目名称/,'缺项要如实定位');
  // 填写图06抬头：项目名称、单位名称、材料经办人、联系方式必填；原公司地址可选（这里留空）。
  await page.locator('#aux-section > summary').click();
  const inputWork=await page.evaluate(function(){
   const counts={preview:0,assess:0,build:0},originals=[];
   [[RfqCollection,'preview'],[RfqProject,'assess'],[RfqInquiryModel,'build']].forEach(function(pair){
    const original=pair[0][pair[1]];originals.push([pair[0],pair[1],original]);
    pair[0][pair[1]]=function(){counts[pair[1]]++;return original.apply(this,arguments);};
   });
   const input=document.getElementById('header-projectName');input.focus();
   input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
   for(const ch of '示例园区'){
    input.value+=ch;input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
   }
   input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'示例园区'}));
   const result={counts:counts,value:input.value,focused:document.activeElement===input};
   originals.forEach(function(pair){pair[0][pair[1]]=pair[2];});return result;
  });
  assert.deepEqual(inputWork.counts,{preview:0,assess:0,build:0},'抬头逐字输入不能触发清单重合并、整项目评估或询价模型重建');
  assert.equal(inputWork.value,'示例园区','中文组合输入内容完整保留');
  assert.equal(inputWork.focused,true,'逐字输入不移走焦点');
  const switchWork=await page.evaluate(function(){
   let merges=0,matchingKeys=0,assessments=0;const preview=RfqMerge.preview,key=RfqProject.contentKey,assess=RfqProject.assess;
   RfqMerge.preview=function(){merges++;return preview.apply(this,arguments);};
   RfqProject.contentKey=function(value){if(value.stage==='matching')matchingKeys++;return key.apply(this,arguments);};
   RfqProject.assess=function(){assessments++;return assess.apply(this,arguments);};
   const input=document.getElementById('header-projectName');input.dispatchEvent(new Event('change',{bubbles:true}));
   document.getElementById('header-company').focus();
   RfqMerge.preview=preview;RfqProject.contentKey=key;RfqProject.assess=assess;
   return {merges,matchingKeys,assessments,focused:document.activeElement.id};
  });
  assert.equal(switchWork.merges,0,'切换抬头输入框时来源和合并选项未变，不应重新合并材料');
  assert.equal(switchWork.matchingKeys,0,'抬头不改变自动分类内容键，切框不应重复计算该键');
  assert.ok(switchWork.assessments<=2,'同一抬头提交刷新最多评估询价内容和阶段状态各一次：'+switchWork.assessments);
  assert.equal(switchWork.focused,'header-company');
  await page.evaluate(function(){
   const values={'header-projectName':'示例园区','header-company':'示例建设公司','header-contact':'测试员',
    'header-phone':'示例联系方式','header-address':'','header-fax':'示例传真','header-email':'example@example.com'};
   Object.keys(values).forEach(function(id){
    const input=document.getElementById(id);input.value=values[id];
    input.dispatchEvent(new Event('change',{bubbles:true}));});
  });
  await page.waitForFunction(function(){return document.querySelector('#inquiry-banner').textContent.includes('尚未生成总询价工作簿');});
  await page.locator('#aux-section > summary').click();
  assert.equal(await page.locator('#inquiry-generate').isEnabled(),true,'品牌读回且抬头齐全后可生成');
  assert.match(await page.locator('#inquiry-workbook').innerText(),/尚未生成（预计文件名：示例园区_询价总表\.xlsx）/);
  assert.match(await page.locator('#inquiry-stats').innerText(),/水泵：按品牌生成 2 份/);
  assert.match(await page.locator('#inquiry-stats').innerText(),/阀门：多个品牌合成 1 份/);
  assert.match(await page.locator('#inquiry-stats').innerText(),/风机、汽车充电桩：各 1 份/);
  assert.equal(await page.locator('#inquiry-preview > li').count(),5,'预计5张询价页');
  // 生成总询价工作簿。
  await page.locator('#inquiry-generate').click();
  await page.waitForFunction(function(){return /总询价工作簿已生成并校验/.test(document.querySelector('#inquiry-message').textContent);});
  const written=await page.evaluate(function(){return window.__inquiryBooks[0].model;});
  const sheetNames=written.sheets.map(function(sheet){return sheet.name;});
  assert.deepEqual(sheetNames.slice(0,5),['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电'],
   '工作表名与图06一致');
  assert.deepEqual(sheetNames.slice(5),['内部追溯','处理记录'],'内部页留在总表内，拆分只取kind=inquiry');
  const valve=written.sheets.filter(function(sheet){return sheet.name==='阀门_合成询价';})[0];
  assert.equal(written.sheets.slice(5).every(function(sheet){return !sheet.layout;}),true,'内部追溯/处理记录页不带公开询价版式');
  assert.deepEqual(valve.values.slice(6).map(function(row){return row.slice(0,10);}),
   [['1','FM-001','阀门','DN50','个','20','通达 / 海岳','','',''],
    ['2','FM-002','阀门','DN65','个','12','通达 / 海岳','','','']],'阀门两行20/12、品牌通达 / 海岳');
  assert.deepEqual(valve.values.slice(0,5).map(function(row){return row[0];}),
   ['示例建设公司','公司地址：','电话：示例联系方式','供货单位：正通商贸 / 安合设备','工程名称：示例园区'],
   '用户指定前五行：公司、地址、联系方式、供货单位、工程名称');
  assert.equal(valve.values[0][8],'询价');
  assert.equal(valve.values[1][6],'联系人：测试员');
  assert.equal(valve.values[2][3],'传真：示例传真');
  assert.equal(valve.values[2][6],'邮箱：example@example.com');
  assert.deepEqual(valve.values[5],inquiryModel.COLUMNS,'公开材料列固定10列');
  assert.equal(valve.values.every(function(row){return row.every(function(value){return typeof value==='string';})}),true);
  assert.equal(valve.layout.metadata.headerRow,6);
  assert.equal(valve.layout.print.repeatRow,6,'打印重复表头');
  assert.equal(valve.layout.merges.some(function(merge){return merge.row===1&&merge.columnSpan===8;}),true,'公司名合并左侧');
  assert.equal(valve.layout.fills.some(function(fill){return fill.row===6;}),true,'表头浅色填充');
  [['水泵_青源','青源'],['水泵_恒流','恒流']].forEach(function(entry){
   const sheet=written.sheets.filter(function(item){return item.name===entry[0];})[0],
    rows=sheet.values.slice(sheet.layout.metadata.headerRow);
   assert.equal(rows.length,2,entry[0]+'含本类完整2个材料行');
   assert.deepEqual(rows.map(function(row){return row[5];}),['2','3']);
   assert.equal(rows.every(function(row){return row[6]===entry[1];}),true,entry[0]+'品牌列为本组品牌');
   assert.equal(rows.every(function(row){return row[7]===''&&row[8]==='';}),true,entry[0]+'报价单价与金额留空');
  });
  // 侧栏：当前操作的工作簿、返回汇总表修改、进入拆分。
  assert.match(await page.locator('#inquiry-banner').innerText(),/询价表已生成并校验/);
  assert.match(await page.locator('#inquiry-workbook').innerText(),/示例园区_询价总表\.xlsx/,'显示当前操作的工作簿');
  assert.match(await page.locator('#inquiry-stats').innerText(),/共 5 份询价表/);
  assert.match(await page.locator('#inquiry-status').innerText(),/SHA/);
  assert.equal(await page.locator('#inquiry-next').isEnabled(),true,'生成后可进入拆分');
  await page.evaluate(function(){
   const input=document.getElementById('header-projectName');input.value='修改后的项目';
   input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.locator('#inquiry-next').isDisabled(),true,'输入未失焦也必须立即禁止沿用旧询价总表');
  assert.equal(await page.evaluate(()=>RfqAssistant.snapshot().inquiryReady),false,'简版同步使旧询价失效');
  await page.evaluate(function(){
   const input=document.getElementById('header-projectName');input.value='示例园区';
   input.dispatchEvent(new Event('input',{bubbles:true}));
   input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  assert.equal(await page.locator('#inquiry-next').isEnabled(),true,'提交回原抬头后按当前内容键重新判定，不永久误报过期');
  assert.equal(await page.locator('#inquiry-back').isEnabled(),true,'可返回汇总表修改');
  await shot(SHOT);
  await dump('inquiry-model.json',{sheetNames:sheetNames,
   valve:{headerRow:valve.layout.metadata.headerRow,supplierLines:[valve.values[3][0]],
    columns:valve.values[5],rows:valve.values.slice(6).map(function(row){return row.slice(0,10);}),
    merges:valve.layout.merges,fills:valve.layout.fills,print:valve.layout.print,freeze:valve.layout.freeze,
    widths:valve.layout.columns.map(function(column){return column.width;})},
   pumpSheets:['水泵_青源','水泵_恒流'].map(function(name){
    const sheet=written.sheets.filter(function(item){return item.name===name;})[0];
    return {name:name,rows:sheet.values.slice(sheet.layout.metadata.headerRow).map(function(row){return row.slice(0,10);})};})});
  await dump('inquiry-status.json',{banner:await page.locator('#inquiry-banner').innerText(),
   progress:await page.locator('#inquiry-progress').innerText(),stats:await page.locator('#inquiry-stats').innerText(),
   status:await page.locator('#inquiry-status').innerText(),workbook:await page.locator('#inquiry-workbook').innerText(),
   preview:await page.locator('#inquiry-preview').innerText()});
  // 生成成功后把生成记录落盘（R9主按钮自动保存），项目状态按真实内容置为“询价表：已确认”。
  await page.waitForFunction(function(){return document.querySelector('#project-status').textContent.includes('询价表：已确认');});
  const saved=await projectRecord();
  assert.match(saved.generation.sha256,/^[a-f0-9]{64}$/,'生成记录必须带SHA');
  assert.match(String(saved.generation.inputKey),/^ck2-[0-9a-f]{16}$/);
  assert.equal(saved.generation.modelSnapshot.sheets.length,5,'固定modelSnapshot只含询价页');
  assert.equal(saved.header.fax,'示例传真','传真随项目保存');
  assert.equal(saved.header.email,'example@example.com','邮箱随项目保存');
  assert.equal(saved.generation.modelSnapshot.sheets.every(function(sheet){return sheet.kind==='inquiry';}),
   true,'生成快照只保留kind=inquiry的询价页');
  assert.deepEqual(saved.generation.sheetIds,saved.generation.modelSnapshot.sheets.map(function(sheet){return sheet.sheetId;}));
  assert.deepEqual(saved.generation.modelSnapshot.sheets.map(function(sheet){return sheet.name;}),
   ['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电'],'生成快照保存5张询价页');
  assert.equal(path.resolve(saved.generation.target).toLowerCase(),path.resolve(inquiryTarget).toLowerCase());
  assert.equal(errors.length,0);
  await dump('inquiry-binding.json',{target:saved.generation.target,sha256:saved.generation.sha256,
   inputKey:saved.generation.inputKey,sheetIds:saved.generation.sheetIds,
   snapshotSheets:saved.generation.modelSnapshot.sheets.map(function(sheet){return {sheetId:sheet.sheetId,name:sheet.name,
    kind:sheet.kind,categoryId:sheet.categoryId,mode:sheet.mode,rowIds:sheet.rowIds};})});
  await dump('inquiry-files.json',(await fs.readdir(root)).filter(function(name){return /询价总表/.test(name);}));
  // 返回汇总表修改（图06辅助按钮）与进入拆分（主按钮）。
  await page.locator('#inquiry-back').click();
  await page.waitForFunction(function(){return document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='brands';});
  await page.locator('#workflow-nav .workflow-step-button[data-stage="inquiry"]').click();
  await page.locator('#inquiry-next').click();
  await page.waitForFunction(function(){return document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='split';});
  await page.locator('#workflow-nav .workflow-step-button[data-stage="inquiry"]').click();
  // 改品牌后旧生成文件必须过期，拆分不再沿用；重新生成得到新工作簿。
  const changedFills=SUMMARY_FILLS.map(function(fill,index){
   return index===1?{mode:'synthesize',groups:[{brand:'通达B',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}]}:fill;});
  await page.evaluate(function(args){window.__seedSummary(args.file,args.values);},
   {file:receipt.summary.path,values:fillSummaryGrid(summary,changedFills)});
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(function(){return /已读回并校验汇总表/.test(document.querySelector('#brands-message').textContent);});
  await page.waitForFunction(function(){return document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='inquiry';});
  await page.waitForFunction(function(){return document.querySelector('#inquiry-banner').textContent.includes('总询价工作簿已过期');});
  assert.equal(await page.locator('#inquiry-next').isDisabled(),true,'过期后不得进入拆分');
  await page.evaluate(function(target){window.__inquiryTarget=target;},inquiryTarget2);
  await page.locator('#inquiry-generate').click();
  await page.waitForFunction(function(){return document.querySelector('#inquiry-message').textContent.includes('总询价工作簿已生成并校验')&&window.__inquiryBooks.length>=2;});
  const regenerated=(await page.evaluate(function(){return window.__inquiryBooks[1].model;}));
  const newValve=regenerated.sheets.filter(function(sheet){return sheet.name==='阀门_合成询价';})[0];
  assert.equal(newValve.values[7][6],'通达B / 海岳','重新生成后品牌列取最新汇总表');
  await page.waitForFunction(function(){return document.querySelector('#project-status').textContent.includes('询价表：已确认');});
  assert.deepEqual(errors,[]);
  console.log('PASS(R9): 图06总询价工作簿——5张询价页（水泵2/阀门1/风机1/充电桩1）、阀门20/12与品牌通达/海岳、抬头与打印版式成立；品牌取自汇总表读回，改品牌后旧生成过期并可重新生成；侧栏显示当前工作簿、预计输出、返回汇总表修改与进入拆分。');
 }finally{await browser.close();await new Promise(function(r){server.close(r);});await fs.rm(root,{recursive:true,force:true});}
}
module.exports={initScript,DRAIN,MEP,REVIEW_VALUES,CONFLICT_ROW,SUMMARY_FILLS,fillSummaryGrid};
if(require.main===module)run().catch(function(error){console.error(error);process.exitCode=1;});
