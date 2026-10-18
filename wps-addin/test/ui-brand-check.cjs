const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const reviewModel=require('../src/classification-review-model.js');
const brandModel=require('../src/brand-model.js');
// 旧侧栏品牌路线已移除；保留原件保护、固定字段校验、双布局读回与保存恢复验证。
// R7（图05A/05B）：分类汇总表一类一行、双布局、名称指向独立分类工作簿。模拟WPS宿主写入，
// 相邻暂存/独占发布/项目与分类库走真实服务端；汇总表按第6.1节合成样例4类2/2/2/1行核对。
const DRAIN=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['SB-001','水泵','DN50','台','1'],['SB-002','水泵','DN65','台','1'],['FM-001','阀门','DN50','个','20'],
 ['FM-002','阀门','DN65','个','12'],['GS-001','钢索','规格C','m','10']];
const MEP=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['','给排水','','',''],['SB-101','水泵','DN50','台','1'],['SB-102','水泵','DN65','台','2'],
 ['','暖通','','',''],['FJ-101','送风机','规格A','台','2'],['FJ-102','排风机','规格B','台','3'],
 ['','强电','','',''],['CD-101','充电桩配电箱','充电桩配套','台','1']];
const REVIEW_VALUES=(function(){
 const preview=collection.preview(sample.buildCollection(),true);
 const result=reviewModel.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'});
 return reviewModel.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values;
}());
const CONFLICT_ROW=REVIEW_VALUES.findIndex(row=>row[1]==='充电桩配电箱')+1;
// R8：第6.1节样例填写——水泵2组按品牌分别生成(2份)、阀门2组合成(1份)、风机/充电桩各1份，合计5份。
const SUMMARY_FILLS=[
 {mode:'per-brand',groups:[{brand:'青源',supplier:'华川设备'},{brand:'恒流',supplier:'启明机电'}]},
 {mode:'synthesize',groups:[{brand:'通达',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}]},
 {mode:'synthesize',groups:[{brand:'瑞风',supplier:'瑞风设备'}]},
 {mode:'synthesize',groups:[{brand:'驰电',supplier:'远程电气'}]}];
// 按插件真实生成的汇总表网格填入品牌/供应商，交给模拟宿主当作用户在WPS里填写后的内容。
function fillSummaryGrid(model,fills){
 const values=model.values.map(row=>row.slice()),spec=brandModel.summaryLayoutFor(model.layout);
 fills.forEach((fill,index)=>{
  const row=spec.firstRow+index;
  (fill.groups||[]).forEach((group,groupIndex)=>{
   if(spec.name==='combined')
    values[row-1][spec.groups[groupIndex][0]-1]='品牌：'+group.brand+'\n供应商：'+group.supplier;
   else{values[row-1][spec.groups[groupIndex][0]-1]=group.brand;values[row-1][spec.groups[groupIndex][1]-1]=group.supplier;}
  });
  values[row-1][spec.modeColumn-1]=fill.mode?brandModel.summaryModeLabel(fill.mode):'';
 });
 return values;
}
function summaryInitScript(context){
 const {files,reviewTarget}=context;
 window.__copies=[];window.__openBooks=[];window.__stores={};window.__categoryWrites=[];
 window.__summaryModels=[];window.__summaryOpened=[];
 const nativeFetch=window.fetch;
 window.fetch=async function(...args){
  const response=await nativeFetch(...args);
  if(String(args[0])==='/api/import/prepare'&&response.ok){
   const data=await response.clone().json();
   if(Array.isArray(data.files))window.__copies=data.files;
  }
  return response;
 };
 const grids={'给排水清单.xlsx':{sheet:'给排水',values:context.drain},'机电清单.xlsx':{sheet:'机电安装',values:context.mep}};
 function seededReview(){try{return JSON.parse(window.localStorage.getItem('rfq-summary-review')||'null');}catch(_){return null;}}
 function storeFor(file){
  if(window.__stores[file])return window.__stores[file];
  const copy=window.__copies.filter(item=>item.copyPath===file)[0];
  const name=copy?copy.originalName:(String(file)===String(reviewTarget)?'示例园区_分类审核成果.xlsx':null);
  const grid=name?grids[name]:null;
  const values=grid?grid.values.map(row=>row.slice())
   :(String(file)===String(reviewTarget)?((seededReview()||context.reviewValues).map(row=>row.slice()))
    :Array.from({length:5},()=>['','','','','']));
  window.__stores[file]={sheet:grid?grid.sheet:'分类审核成果',values:values,cells:{}};
  return window.__stores[file];
 }
 function sheetFor(file,requested){
  const store=storeFor(file);
  return {Name:typeof requested==='string'?requested:store.sheet,
   UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:store.values[0].length},Value2:store.values},
   Activate(){},
   Cells:{Item(row,column){return {NumberFormat:'',
    get Value2(){const value=store.cells[row+':'+column];return value===undefined?(store.values[row-1]||[])[column-1]:value;},
    set Value2(value){store.cells[row+':'+column]=value;},
    get HasFormula(){return false;},Select(){}};}}};
 }
 function openBook(file,readOnly){
  const book={FullName:file,ReadOnly:!!readOnly,
   Worksheets:{Count:1,Item(requested){return sheetFor(file,requested);}},
   Activate(){app.ActiveWorkbook=book;},Save(){book.saved=true;},
   Close(){window.__openBooks=window.__openBooks.filter(item=>item!==book);}};
  window.__openBooks.push(book);
  return book;
 }
 const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
 const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
  Workbooks:{get Count(){return 1+window.__openBooks.length;},
   Item(index){return index===1?previous:window.__openBooks[index-2];},
   Open(file,links,readOnly){
    if(files.includes(file))throw Error('original was opened');
    const known=window.__copies.some(item=>item.copyPath===file)||String(file).startsWith(context.root);
    if(!known)throw Error('unknown book: '+file);
    return window.__openBooks.filter(item=>item.FullName===file)[0]||openBook(file,readOnly);
   }}};
 window.Application=app;window.__files=files;
 // R12-C 之后侧栏按业务内容比较“打开簿/磁盘内容”与已保存快照；表内修改要落值并持久化，
 // 重载后成果表内容才与已保存确认一致（否则重开会正确判为“内容与已保存确认不一致”）。
 window.__setCell=function(row,column,value){
  const store=storeFor(reviewTarget);
  store.cells[row+':'+column]=value;
  const line=store.values[row-1]||(store.values[row-1]=[]);
  line[column-1]=value;
  try{window.localStorage.setItem('rfq-summary-review',JSON.stringify(store.values));}catch(_){}
 };
 window.__seedReview=function(values){
  const copied=values.map(row=>row.slice());
  storeFor(reviewTarget).values=copied;storeFor(reviewTarget).cells={};
  try{window.localStorage.setItem('rfq-summary-review',JSON.stringify(copied));}catch(_){}
 };
 // R8：把用户填写后的汇总表内容按真实生成路径放进模拟宿主，读回时由插件真实解析。
 window.__seedSummary=function(file,values){
  window.__stores[file]={sheet:'分类汇总表',values:values.map(row=>row.slice()),cells:{}};
 };
}
const SUMMARY_SHOT=process.env.RFQ_UI_SUMMARY_SCREENSHOT,SUMMARY_EVIDENCE=process.env.RFQ_UI_SUMMARY_EVIDENCE;
async function summaryFlow(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-summary-')),
  files=[path.join(root,'给排水清单.xlsx'),path.join(root,'机电清单.xlsx')],
  reviewTarget=path.join(root,'示例园区_分类审核成果.xlsx'),projectDirectory=path.join(root,'projects'),
  workbookDirectory=path.join(root,'分类工作簿');
 await fs.writeFile(files[0],'drain');await fs.writeFile(files[1],'mep');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:projectDirectory,libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await createLibraryStore({directory:path.join(root,'library')}).save({expectedRevision:0,
  library:sample.library,memory:sample.createMemory()});
 const projectFile=async()=>{
  const list=(await fs.readdir(projectDirectory)).filter(name=>name.endsWith('.json')&&!name.startsWith('.'));
  return path.join(projectDirectory,list[0]);
 };
 const projectRecord=async()=>JSON.parse(await fs.readFile(await projectFile(),'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(summaryInitScript,{files,drain:DRAIN,mep:MEP,reviewTarget,reviewValues:REVIEW_VALUES,root});
  await page.exposeFunction('__writeReviewFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  await page.exposeFunction('__writeCategoryFixture',async(file,payload)=>{
   await fs.writeFile(file,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  await page.exposeFunction('__writeSummaryFixture',async(file,payload)=>{
   await fs.writeFile(file,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  const installStubs=()=>page.evaluate(()=>{
   // 一本多页（2026-10-11变更）：第4步一次写入“第 1 页汇总＋逐类页”，第5步“分类汇总表”＝同一本工作簿第 1 页。
   // 写入换成夹具文件；汇总页内容仍取插件真实模型（brand-model），便于逐项核对公开版式与页内跳转。
   window.RfqCategoryWorkbooks.writeAll=async function(app,plan,stagePath,options){
    const summary=options&&options.summarySheet,spec=summary.layout,meta=spec.metadata||{};
    window.__categoryWrites.push({path:stagePath,file:plan.file,planPath:plan.path,
     pages:(plan.files||[]).map(entry=>entry.sheetName)});
    window.__summaryModels.push({stagePath:stagePath,layout:meta.layout,headerRow:meta.headerRow,firstRow:meta.firstRow,
     lastRow:meta.lastRow,auxCategory:meta.auxCategory,auxFile:meta.auxFile,
     categories:(plan.files||[]).map(entry=>({categoryId:entry.categoryId,categoryName:entry.categoryName,
      rowCount:entry.rowCount,sheetName:entry.sheetName,file:plan.file})),
     hyperlinks:spec.hyperlinks.map(link=>({address:link.address,subAddress:link.subAddress,internal:link.internal===true,
      display:link.display})),
     hidden:spec.columns.filter(column=>column.hidden).map(column=>column.index),
     validation:{row:spec.validations[0].row,rowSpan:spec.validations[0].rowSpan,column:spec.validations[0].column,
      listRange:spec.validations[0].listRange},
     values:summary.values.map(row=>row.slice()),
     rows:summary.values.slice(meta.firstRow-1,meta.lastRow).map(row=>row.slice(0,10))});
    await window.__writeCategoryFixture(stagePath,'workbook:'+(plan.files||[]).length);};
   // 发布后按页读回：本夹具只需记录期望页（真实读回逻辑在 category-workbooks 单测与真机复刻里核对）。
   window.RfqCategoryWorkbooks.verifySheets=function(app,filePath,expected){
    window.__categoryVerify=(window.__categoryVerify||[]).concat([{path:filePath,
     expected:expected.map(item=>Object.assign({},item))}]);
    return {ok:true,issues:[],sheets:expected.map((item,index)=>({index:index+1,sheetName:item.sheetName,rowCount:item.rowCount}))};};
   // F3：自动打开与手动入口共用同一 openSummary；夹具可注入一次打开失败。
   window.RfqBrandHost.openSummary=function(app,filePath){
    if(window.__openSummaryFails){window.__openSummaryFails=false;throw Error('fixture 打开汇总表失败');}
    window.__summaryOpened.push(filePath);return {path:filePath,opened:true};};
  });
  const openProject=async()=>{
   await page.locator('#aux-section > summary').click();
   await page.locator('#open-project').click();
   await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
   await page.locator('#project-list > li button').first().click();
   await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  };
  const waitIdle=()=>page.waitForFunction(()=>document.getElementById('task-controls').disabled===false);
  const shot=async file=>{
   if(!SUMMARY_SHOT)return;
   await page.evaluate(()=>{const aux=document.getElementById('aux-section');if(aux)aux.open=false;});
   await page.screenshot({path:file,fullPage:true});
  };
  const dumpEvidence=async(name,value)=>{
   if(!SUMMARY_EVIDENCE)return;
   await fs.mkdir(SUMMARY_EVIDENCE,{recursive:true});
   await fs.writeFile(path.join(SUMMARY_EVIDENCE,name),JSON.stringify(value,null,2));
  };
  await require('./assistant-test-ui.cjs').acknowledgeProblems(page);
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  await page.locator('#aux-section > summary').click();
  await page.evaluate(()=>{
   const values={'header-company':'测试安装工程有限公司','header-address':'测试市测试路1号',
    'header-phone':'010-12345678','header-projectName':'测试楼项目','header-contact':'测试员'};
   Object.keys(values).forEach(id=>{
    const input=document.getElementById(id);input.value=values[id];
    input.dispatchEvent(new Event('change',{bubbles:true}));});
  });
  await page.waitForFunction(()=>document.querySelector('#header-status').textContent.includes('抬头已齐全'));
  await page.locator('#header-save-template').click();
  await page.waitForFunction(()=>document.querySelector('#header-message').textContent.includes('请先填写模板名称'));
  await page.locator('#header-template-name').fill('本项目抬头');
  await page.locator('#header-save-template').click();
  await page.waitForFunction(()=>document.querySelector('#header-message').textContent.includes('已保存本机抬头模板'));
  assert.equal(await page.locator('#header-template-select option').count(),2,'保存后模板下拉里应出现该模板');
  // 图01→图04：导入、合并确认、整表确认（含改选汽车充电桩）、生成4份独立分类工作簿。
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
 await page.locator('#preview-confirm').click();
 await page.waitForFunction(()=>document.querySelector('#merge-section').hidden===false);
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='8');
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>/自动匹配完成/.test(document.querySelector('#classification-review-banner').textContent));
  await page.evaluate(target=>{
   window.RfqPathPicker.open=function(options){options.onConfirm({directory:null,name:'示例园区_分类审核成果.xlsx',target:target});return null;};
   window.RfqClassificationReviewHost.write=async(app,result,stagePath,options)=>{
    const sheet=window.RfqClassificationReviewModel.mainSheet(result,{title:options&&options.title});
    window.__seedReview(sheet.values);
    await window.__writeReviewFixture(stagePath);};
  },reviewTarget);
  await installStubs();
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  await page.locator('#classification-review-open').click();
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='review');
  await page.evaluate(({row})=>{window.__setCell(row,8,'汽车充电桩');window.__setCell(row,9,'充电桩配套');},{row:CONFLICT_ROW});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>/整表已确认（8 行）|整表未通过校验|整表确认未完成|整表确认未保存/.test(
   document.querySelector('#sheet-review-message').textContent));
  assert.match(await page.locator('#sheet-review-message').innerText(),/整表已确认（8 行）/,'整表一次确认必须通过并落盘');
  await page.waitForFunction(()=>/分类工作簿已生成（1 本 · 4 页）/.test(document.querySelector('#categories-banner').textContent));
  assert.deepEqual((await fs.readdir(workbookDirectory)).sort(),['示例园区_分类工作簿.xlsx'],
   '第4步只发布一本分类工作簿');
  console.log('PASS(R7-1): 图05前序链路成立——一本多页分类工作簿（4类2/2/2/1行）已生成。');
  // 图05A：生成分类汇总表（默认分列布局），一类一行，名称是蓝色下划线相对链接。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  await page.waitForFunction(()=>document.querySelector('#brands-banner').textContent.includes('尚未生成分类汇总表'));
  assert.equal(await page.locator('#brands-layout').isEnabled(),true,'分类工作簿核实后解锁布局选择');
  assert.equal(await page.locator('#brands-layout').inputValue(),'separated','默认布局为品牌、供应商分列');
  assert.equal(await page.locator('#brands-generate').isEnabled(),true,'分类工作簿完成后可生成分类汇总表');
  assert.equal(await page.locator('#brands-list > li').count(),4,'一类一行，共4个类别');
  assert.match(await page.locator('#brands-list').innerText(),/水泵[\s\S]*页名：水泵/,'每行显示对应分类页名');
  await page.locator('#brands-generate').click();
  await page.waitForFunction(()=>window.__summaryModels.length>=1&&
   /已生成并校验分类汇总表/.test(document.querySelector('#brands-message').textContent)&&
   /分类汇总表已生成（4 类）/.test(document.querySelector('#brands-banner').textContent));
  const separated=await page.evaluate(()=>window.__summaryModels[0]);
  assert.equal(separated.layout,'separated');
  assert.deepEqual(separated.categories.map(item=>[item.categoryName,item.rowCount,item.sheetName]),
   [['水泵',2,'水泵'],['阀门',2,'阀门'],['风机',2,'风机'],['汽车充电桩',1,'汽车充电桩']],
   '一类一行，条数取自该类快照，页名＝类别名');
  assert.deepEqual(separated.hyperlinks.map(link=>[link.address,link.subAddress,link.internal,link.display]),
   [['','水泵!A1',true,'水泵'],['','阀门!A1',true,'阀门'],['','风机!A1',true,'风机'],
    ['','汽车充电桩!A1',true,'汽车充电桩']],'名称加蓝色下划线原生链接，文件内跳转到对应分类页');
  assert.deepEqual(separated.rows.map(row=>row.slice(0,3)),
   [['1','水泵','2'],['2','阀门','2'],['3','风机','2'],['4','汽车充电桩','1']]);
  assert.equal(separated.rows.every(row=>row.slice(3,9).every(value=>value==='')),true,'品牌与供应商初始空白');
  assert.deepEqual(separated.hidden,[11,12,13],'隐藏列保存稳定类别ID/页内跳转/方式选项');
  assert.deepEqual([separated.validation.row,separated.validation.rowSpan,separated.validation.column,separated.validation.listRange],
   [4,4,10,'$M$1:$M$2'],'询价生成方式下拉覆盖4行');
  assert.equal((await fs.readdir(workbookDirectory)).includes('示例园区_分类工作簿.xlsx'),true,
   '分类汇总表就是这本工作簿的第 1 页（同一文件）');
  const receipt=await projectRecord();
  assert.equal(receipt.summary.layout,'separated');
  assert.equal(path.resolve(receipt.summary.path).toLowerCase(),
   path.resolve(workbookDirectory,'示例园区_分类工作簿.xlsx').toLowerCase(),
   '项目记录必须保存汇总表（＝分类工作簿）真实路径');
  assert.equal(path.resolve(receipt.categories.path).toLowerCase(),path.resolve(receipt.summary.path).toLowerCase(),
   '分类工作簿与汇总表指向同一文件');
  assert.deepEqual(receipt.summary.categories.map(item=>item.categoryId),['pump','valve','fan','ev-charger']);
  assert.match(String(receipt.summary.sha256),/^[a-f0-9]{64}$/,'汇总表回执必须带SHA');
  assert.match(await page.locator('#brands-banner').innerText(),/分类汇总表已生成（4 类）/);
 assert.match(await page.locator('#project-status').textContent(),
   /品牌汇总：未完成（分类汇总表已生成（4 类，品牌、供应商分列），请在表内填写品牌与供应商后点“填写完成，生成询价表”读回）/,
   '生成汇总表但未读回填写内容前，品牌汇总阶段不得误报完成');
  // F3：发布校验与项目绑定保存完成后自动打开一次最终文件，供用户直接表内填写。
  assert.deepEqual(await page.evaluate(()=>window.__summaryOpened.map(item=>String(item).toLowerCase())),
   [String(receipt.summary.path).toLowerCase()],'分列布局生成成功后必须自动打开一次最终汇总表（无需再点按钮）');
  // 手动“打开汇总表”入口保留：自动打开之外仍可再次打开同一文件。
  await page.locator('#brands-open').click();
  assert.deepEqual(await page.evaluate(()=>window.__summaryOpened.map(item=>String(item).toLowerCase())),
   [String(receipt.summary.path).toLowerCase(),String(receipt.summary.path).toLowerCase()],
   '手动入口保留且指向已生成的真实文件');
  await shot(SUMMARY_SHOT&&SUMMARY_SHOT.replace(/\.png$/,'-separated.png'));
 await dumpEvidence('summary-binding-separated.json',receipt.summary);
  await dumpEvidence('summary-files.json',await fs.readdir(workbookDirectory));
  // R8：先放一个半组错误，验证读回定位到具体单元格且不改用户在表内的填写；再改成完整内容读回。
  const separatedPath=receipt.summary.path,specSep=brandModel.summaryLayoutFor('separated');
  const halfGrid=fillSummaryGrid(separated,SUMMARY_FILLS);
  halfGrid[specSep.firstRow-1][specSep.groups[1][1]-1]='';
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),{file:separatedPath,values:halfGrid});
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(()=>/未通过校验/.test(document.querySelector('#brands-message').textContent));
  assert.match(await page.locator('#brands-issues').innerText(),/G4|成对/,'半组错误必须定位到具体单元格');
  assert.match(await page.locator('#project-status').textContent(),/品牌汇总：未完成/,'校验未通过时品牌汇总阶段不得完成');
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),
   {file:separatedPath,values:fillSummaryGrid(separated,SUMMARY_FILLS)});
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(()=>/已读回并校验汇总表/.test(document.querySelector('#brands-message').textContent));
  // R9：第5步主按钮读回成功后进入第6步“询价表”（图05→06）；回第5步继续核对。
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='inquiry');
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  assert.match(await page.locator('#brands-message').innerText(),/预计 5 份询价表/);
  assert.match(await page.locator('#brands-banner').innerText(),/品牌与供应商已读回（4 类）/);
  const readSeparated=await projectRecord();
  assert.equal(readSeparated.brands.expectedSheets,5,'水泵2、阀门1、风机1、充电桩1共5份');
  assert.deepEqual(readSeparated.brands.categories.map(item=>[item.categoryId,item.mode,item.groups.length]),
   [['pump','per-brand',2],['valve','synthesize',2],['fan','synthesize',1],['ev-charger','synthesize',1]]);
  assert.deepEqual(readSeparated.brands.categories[1].groups,[{brand:'通达',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}],
   '阀门多品牌按组保留，不被最后一组覆盖');
  assert.match(await page.locator('#project-status').textContent(),/品牌汇总：已确认/,'读回通过后品牌汇总阶段才算完成');
  // 已读回后再把表内改坏：旧读回作废、阶段回到未完成，且不改动用户在表内的填写。
  const brokenGrid=fillSummaryGrid(separated,SUMMARY_FILLS);
  brokenGrid[specSep.firstRow-1][specSep.groups[1][1]-1]='';
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),{file:separatedPath,values:brokenGrid});
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(()=>/未通过校验/.test(document.querySelector('#brands-message').textContent));
  assert.match(await page.locator('#project-status').textContent(),/品牌汇总：未完成/,'改坏表内内容后旧读回必须作废');
  assert.equal((await projectRecord()).brands,null,'作废后的读回不得继续留在项目记录');
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),
   {file:separatedPath,values:fillSummaryGrid(separated,SUMMARY_FILLS)});
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(()=>/已读回并校验汇总表/.test(document.querySelector('#brands-message').textContent));
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  assert.match(await page.locator('#project-status').textContent(),/品牌汇总：已确认/);
  assert.equal(errors.length,0);
  await waitIdle();
  // 图05B：切到同格布局，重新生成新的汇总表文件（不覆盖已生成文件）。
  await page.locator('#brands-layout').selectOption('combined');
  await page.waitForFunction(()=>document.querySelector('#brands-banner').textContent.includes('已过期'));
  await page.locator('#brands-generate').click();
  await page.waitForFunction(()=>window.__summaryModels.length>=2&&
   /已生成并校验分类汇总表/.test(document.querySelector('#brands-message').textContent));
  const combined=await page.evaluate(()=>window.__summaryModels[1]);
  assert.equal(combined.layout,'combined');
  assert.equal(combined.headerRow,4,'同格布局单行表头');
  assert.deepEqual(combined.hyperlinks.map(link=>link.subAddress),separated.hyperlinks.map(link=>link.subAddress),
   '两种布局名称跳转目标一致（都跳到同一本工作簿的对应分类页）');
  assert.deepEqual(combined.rows.map(row=>row.slice(0,3)),separated.rows.map(row=>row.slice(0,3)),
   '两种布局类别、条数一致');
  assert.equal(combined.rows.every(row=>row.slice(3,6).every(value=>value==='')),true,'同格单格初始空白');
  assert.notEqual(combined.stagePath,separated.stagePath,'重新生成另存新文件，不覆盖已生成汇总表');
  const receipt2=await projectRecord();
  assert.equal(receipt2.summary.layout,'combined');
  assert.notEqual(path.resolve(receipt2.summary.path).toLowerCase(),
   path.resolve(workbookDirectory,'示例园区_分类工作簿.xlsx').toLowerCase(),'同格布局必须另存新文件');
  assert.equal(path.resolve(receipt2.categories.path).toLowerCase(),path.resolve(receipt2.summary.path).toLowerCase(),
   '改布局后分类工作簿与汇总表仍指向同一文件');
  assert.ok((await fs.readdir(workbookDirectory)).filter(name=>/^示例园区_分类工作簿.*\.xlsx$/.test(name)).length>=2,
   '两份分类工作簿（旧排布＋新排布）同时保留');
  // F3：同格布局生成成功后同样只自动打开一次新文件；上一次的自动/手动打开不重复累积。
  assert.deepEqual(await page.evaluate(()=>window.__summaryOpened.map(item=>String(item).toLowerCase())),
   [String(separatedPath).toLowerCase(),String(separatedPath).toLowerCase(),String(receipt2.summary.path).toLowerCase()],
   '同格布局也必须自动打开一次，且不重复打开旧文件');
  // R8：同格布局同样读回，解析口径必须与分列布局等价、仍为5份。
  const combinedPath=receipt2.summary.path;
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),
   {file:combinedPath,values:fillSummaryGrid(combined,SUMMARY_FILLS)});
  await page.locator('#brands-confirm').click();
  await page.waitForFunction(()=>/已读回并校验汇总表/.test(document.querySelector('#brands-message').textContent));
  const readCombined=await projectRecord();
  assert.equal(readCombined.brands.expectedSheets,5);
  assert.equal(readCombined.brands.layout,'combined');
  const business=list=>list.map(item=>[item.categoryId,item.mode,item.groups.map(group=>[group.brand,group.supplier])]);
  assert.deepEqual(business(readCombined.brands.categories),business(readSeparated.brands.categories),
   '两种布局读回的品牌口径必须等价');
  await shot(SUMMARY_SHOT&&SUMMARY_SHOT.replace(/\.png$/,'-combined.png'));
  await dumpEvidence('summary-models.json',[separated,combined]);
  await dumpEvidence('summary-binding-combined.json',receipt2.summary);
  await dumpEvidence('summary-stage-status.json',{brands:await page.locator('#brands-status').textContent(),
   projectStatus:await page.locator('#project-status').textContent()});
  // 重开恢复：项目记录里的汇总绑定与布局必须恢复。
  await waitIdle();
  await page.reload();
  await installStubs();
  await openProject();
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  await page.waitForFunction(()=>/品牌与供应商已读回（4 类）/.test(document.querySelector('#brands-banner').textContent));
  assert.equal(await page.locator('#brands-list > li').count(),4);
  assert.equal(await page.locator('#brands-layout').inputValue(),'combined','恢复后布局必须与项目记录一致');
  assert.match(await page.locator('#project-status').textContent(),/品牌汇总：已确认/,'读回的品牌组随项目保存并恢复');
  // F3：自动打开只在发布校验与项目绑定保存完成后发生；失败路径不自动打开，也不虚报。
  const summaryFiles=async()=>(await fs.readdir(workbookDirectory)).filter(name=>/^示例园区_分类工作簿.*\.xlsx$/.test(name));
  // (1) 仅打开失败：成果与手动入口保留，提示“已生成、未打开”，不重新发布、不改写成未生成。
  const openedBefore=await page.evaluate(()=>window.__summaryOpened.length),
   modelsBefore=await page.evaluate(()=>window.__summaryModels.length),
   filesBefore=(await summaryFiles()).length;
  await page.evaluate(()=>{window.__openSummaryFails=true;});
  await page.locator('#brands-generate').click();
  await page.waitForFunction(()=>/已生成、未打开/.test(document.querySelector('#brands-message').textContent));
  assert.match(await page.locator('#brands-message').textContent(),/已生成、未打开/,
   '只有打开失败才提示“已生成、未打开”');
  assert.doesNotMatch(await page.locator('#brands-message').textContent(),/未生成/,
   '打开失败不得虚报“未生成”');
  const afterOpenFail=await projectRecord();
  // 一本多页：布局没变时不重写工作簿，打开失败只影响“打开”，成果与绑定保持原样。
  assert.equal(path.resolve(afterOpenFail.summary.path).toLowerCase(),path.resolve(combinedPath).toLowerCase(),
   '打开失败不得改写成果路径');
  assert.equal((await summaryFiles()).length,filesBefore,'打开失败不得新增或覆盖成果文件');
  assert.equal(await page.evaluate(()=>window.__summaryOpened.length),openedBefore,'打开失败不得记成已打开');
  assert.equal(await page.evaluate(()=>window.__summaryModels.length),modelsBefore,'打开失败不得重新发布');
  assert.equal(await page.locator('#brands-open').isEnabled(),true,'打开失败后手动打开入口必须保留');
  await page.locator('#brands-open').click();
  await page.waitForFunction(()=>/已打开分类汇总表/.test(document.querySelector('#brands-message').textContent));
  assert.equal(await page.evaluate(()=>window.__summaryOpened.length),openedBefore+1,
   '打开失败后仍可手动打开同一成果文件');
  // (2) 生成失败（写入失败）：不自动打开，不新增或覆盖成果文件。
  const filesBeforeWriteFail=(await summaryFiles()).length,
   openedBeforeWriteFail=await page.evaluate(()=>window.__summaryOpened.length);
  // 改成同格→分列会按新布局重写整本工作簿，正好用来注入一次写入失败。
  await page.locator('#brands-layout').selectOption('separated');
  await page.evaluate(()=>{const native=window.RfqCategoryWorkbooks.writeAll;
   window.RfqCategoryWorkbooks.writeAll=async function(){window.RfqCategoryWorkbooks.writeAll=native;
    throw Error('fixture 写入失败');};});
  await page.waitForTimeout(1100); // 另存名带秒级时间戳：保证本次与新文件不撞名
  await page.locator('#brands-generate').click();
  await page.waitForFunction(()=>/未生成/.test(document.querySelector('#brands-message').textContent));
  assert.match(await page.locator('#brands-message').textContent(),/fixture 写入失败/,
   '生成失败必须来自注入的写入失败');
  assert.equal((await summaryFiles()).length,filesBeforeWriteFail,'生成失败不得新增或覆盖成果文件');
  assert.equal(await page.evaluate(()=>window.__summaryOpened.length),openedBeforeWriteFail,'生成失败不得自动打开');
  // (3) 项目绑定保存失败：已发布成果保留，但不自动打开，也不谎称“未生成”。
  const filesBeforeSaveFail=(await summaryFiles()).length,
   openedBeforeSaveFail=await page.evaluate(()=>window.__summaryOpened.length);
  await page.evaluate(()=>{const native=window.fetch;
   window.fetch=async function(...args){
    if(window.__failProjectSaveOnce&&String(args[0])==='/api/project/save'){
     window.__failProjectSaveOnce=false;throw Error('fixture 项目保存失败');}
    return native(...args);};
   window.__failProjectSaveOnce=true;});
  await page.waitForTimeout(1100);
  await page.locator('#brands-generate').click();
  try{
   await page.waitForFunction(()=>/项目绑定未保存/.test(document.querySelector('#brands-message').textContent));
  }catch(error){
   throw Error('等待“项目绑定未保存”提示超时，当前提示为：'+await page.locator('#brands-message').textContent());
  }
  assert.match(await page.locator('#brands-message').textContent(),/已生成并校验/,
   '发布成功但绑定保存失败时不得虚报“未生成”');
  assert.doesNotMatch(await page.locator('#brands-message').textContent(),/未生成/,
   '发布成功但绑定保存失败时不得虚报“未生成”');
  assert.equal((await summaryFiles()).length,filesBeforeSaveFail+1,'已发布成果文件保留');
  assert.equal(await page.evaluate(()=>window.__summaryOpened.length),openedBeforeSaveFail,'绑定保存失败不得自动打开');
  assert.deepEqual(errors,[]);
  console.log('PASS(R7+R8一本多页): 图05A/05B分类汇总表＝分类工作簿第 1 页——一类一行、双布局可用、4条名称链接文件内跳到对应分类页；R8按稳定类别ID读回、半组定位单元格、多品牌按组保留、预计5份、双布局等价并随项目保存恢复。');
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
}
(async()=>{await summaryFlow();})().catch(e=>{console.error(e);process.exitCode=1;});
