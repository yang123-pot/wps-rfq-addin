// R6验收：图04 按整表确认结果生成独立分类工作簿。模拟WPS宿主写入，暂存/独占发布/项目/分类库走真实服务端。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs'),{createLibraryStore}=require('../dev/library-store.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const reviewModel=require('../src/classification-review-model.js');
const DRAIN=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['SB-001','水泵','DN50','台','1'],['SB-002','水泵','DN65','台','1'],['FM-001','阀门','DN50','个','20'],
 ['FM-002','阀门','DN65','个','12'],['GS-001','钢索','规格C','m','10']];
const MEP=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['','给排水','','',''],['SB-101','水泵','DN50','台','1'],['SB-102','水泵','DN65','台','2'],
 ['','暖通','','',''],['FJ-101','送风机','规格A','台','2'],['FJ-102','排风机','规格B','台','3'],
 ['','强电','','',''],['CD-101','充电桩配电箱','充电桩配套','台','1']];
// 生成态成果表（与R4/R5一致）：第3行表头、数据从第4行起、K列隐藏rowId。
const REVIEW_VALUES=(function(){
 const preview=collection.preview(sample.buildCollection(),true);
 const result=reviewModel.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'});
 return reviewModel.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values;
}());
const CONFLICT_ROW=REVIEW_VALUES.findIndex(row=>row[1]==='充电桩配电箱')+1;
const SHOT=process.env.RFQ_UI_CATEGORY_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_CATEGORY_EVIDENCE;
async function dumpEvidence(name,value){
 if(!EVIDENCE)return;
 await fs.mkdir(EVIDENCE,{recursive:true});
 await fs.writeFile(path.join(EVIDENCE,name),JSON.stringify(value,null,2));
}
function initScript(context){
 const {files,reviewTarget}=context;
 window.__copies=[];window.__cellWrites=[];window.__selected=[];window.__openBooks=[];window.__stores={};
 window.__categoryWrites=[];window.__categoryFail=null;
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
 function seededReview(){
  try{return JSON.parse(window.localStorage.getItem('rfq-review-values')||'null');}catch(_){return null;}
 }
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
    set Value2(value){store.cells[row+':'+column]=value;
     window.__cellWrites.push({path:file,row:row,column:column,value:value});},
    get HasFormula(){return false;},
    Select(){window.__selected.push([row,column,file]);}};}}};
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
 window.__setCell=function(row,column,value){storeFor(reviewTarget).cells[row+':'+column]=value;};
 window.__seedReview=function(values){
  const copied=values.map(row=>row.slice());
  storeFor(reviewTarget).values=copied;storeFor(reviewTarget).cells={};
  try{window.localStorage.setItem('rfq-review-values',JSON.stringify(copied));}catch(_){}
 };
}
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-category-')),
  files=[path.join(root,'给排水清单.xlsx'),path.join(root,'机电清单.xlsx')],
  reviewTarget=path.join(root,'示例园区_分类审核成果.xlsx'),projectDirectory=path.join(root,'projects'),
  workbookDirectory=path.join(root,'分类工作簿');
 await fs.writeFile(files[0],'drain');await fs.writeFile(files[1],'mep');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:projectDirectory,libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const store=createLibraryStore({directory:path.join(root,'library')});
 await store.save({expectedRevision:0,library:sample.library,memory:sample.createMemory()});
 // 项目库是原子写入：只读正式.json，跳过保存过程中的临时文件。
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
  await page.addInitScript(initScript,{files,drain:DRAIN,mep:MEP,reviewTarget,reviewValues:REVIEW_VALUES,root});
  await page.exposeFunction('__writeReviewFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  await page.exposeFunction('__writeCategoryFixture',async(file,payload)=>{
   await fs.writeFile(file,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  // R6：分类工作簿写入换成夹具文件；计划内容与每份的行数/列值仍取插件真实模型，便于逐项核对。
  // 每次reload后都要重新安装（页面脚本会重新加载），写入载荷记录也随之重置。
  const installCategoryStub=()=>page.evaluate(()=>{
   window.RfqCategoryWorkbooks.write=async function(app,entry,stagePath,options){
    const sheet=window.RfqCategoryWorkbooks.mainSheet(entry,options||{});
    window.__categoryWrites.push({path:stagePath,categoryId:entry.categoryId,categoryName:entry.categoryName,
     name:entry.file,rowCount:entry.rowCount,rowIds:entry.rowIds.slice(),
     sheetName:sheet.name,values:sheet.values.map(row=>row.slice())});
    if(window.__categoryFail===entry.file)throw Error('模拟写入失败：'+entry.file);
    await window.__writeCategoryFixture(stagePath,entry.file+'#'+window.__categoryWrites.length);
   };
  });
  const openProject=async()=>{
   await page.locator('#aux-section > summary').click();
   await page.locator('#open-project').click();
   await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
   await page.locator('#project-list > li button').first().click();
   await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  };
  // 项目保存期间侧栏会整体禁用（onBusy），断言控件可用前先等这一轮结束。
  const waitIdle=()=>page.waitForFunction(()=>document.getElementById('task-controls').disabled===false);
  // 留证截图前收起折叠的辅助功能，只呈现七步流程与当前阶段面板（便于对照图04）。
  const shot=async file=>{
   if(!SHOT)return;
   await page.evaluate(()=>{const aux=document.getElementById('aux-section');if(aux)aux.open=false;});
   await page.screenshot({path:file,fullPage:true});
  };
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  // 图01→图02→图03：导入、合并确认、生成成果表、整表确认（含用户改选汽车充电桩）。
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
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
  await installCategoryStub();
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  await page.locator('#classification-review-open').click();
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='review');
  await page.evaluate(({row})=>{window.__setCell(row,8,'汽车充电桩');window.__setCell(row,9,'充电桩配套');},{row:CONFLICT_ROW});
  // 图04：第1次生成故意让“风机.xlsx”写入失败，验证局部成功不显示全部完成、重试只处理未完成。
  await page.evaluate(()=>{window.__categoryFail='风机.xlsx';});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>/整表已确认（8 行）|整表未通过校验|整表确认未完成|整表确认未保存/.test(
   document.querySelector('#sheet-review-message').textContent));
  assert.match(await page.locator('#sheet-review-message').innerText(),/整表已确认（8 行）/,'整表一次确认必须通过并落盘');
  await page.waitForFunction(()=>/已生成 3 \/ 4/.test(document.querySelector('#categories-banner').textContent));
  assert.match(await page.locator('#categories-banner').innerText(),/已生成 3 \/ 4 份分类工作簿/);
  assert.match(await page.locator('#categories-stats').innerText(),/7 行纳入询价 · 1 行无需询价/);
  assert.match(await page.locator('#categories-progress').innerText(),/4 \/ 7/);
  assert.equal(await page.locator('#categories-summary').isDisabled(),true,'未全部完成不得解锁生成汇总');
  assert.equal(await page.locator('#categories-layout').isDisabled(),true,'未全部完成不得解锁布局选择');
  assert.equal(await page.locator('#categories-retry').isHidden(),false,'未完成时提供重试入口');
  const partial=await projectRecord();
  assert.equal(partial.categories.status,'partial','部分成功必须落盘为未完成');
  assert.equal(partial.categories.files.filter(file=>file.status==='succeeded').length,3);
  assert.equal(partial.categories.files.filter(file=>file.status==='failed').length,1);
  assert.equal(partial.categories.files.filter(file=>file.name==='风机.xlsx')[0].error.includes('模拟写入失败'),true);
  assert.match(await page.locator('#project-status').textContent(),/分类工作簿：未完成/);
  assert.deepEqual((await fs.readdir(workbookDirectory)).sort(),['汽车充电桩.xlsx','水泵.xlsx','阀门.xlsx'].sort(),
   '先检查全部目标、逐份独占发布：失败的一份没有留下文件');
  // 图04验收：4个独立文件2/2/2/1行、10列、品牌/报价/金额留空、无需询价不含在分类簿。
  const firstFour=await page.evaluate(()=>window.__categoryWrites.map(item=>item));
  assert.equal(firstFour.length,4);
  assert.deepEqual(firstFour.map(item=>[item.name,item.rowCount]),[['水泵.xlsx',2],['阀门.xlsx',2],['风机.xlsx',2],['汽车充电桩.xlsx',1]]);
  assert.equal(new Set(firstFour.map(item=>item.path)).size,4,'4个类别必须是4个独立工作簿，不是4张工作表');
  assert.equal(firstFour.every(item=>item.sheetName==='材料明细'),true);
  assert.equal(firstFour.every(item=>item.values[0].length===11),true,'公开10列＋K列随行rowId');
  assert.deepEqual(firstFour.flatMap(item=>item.values.slice(1).map(row=>row.slice(6,10))),
   Array.from({length:7},()=>['','','','']),'品牌/报价单价/金额/备注留空');
  assert.equal(firstFour.some(item=>item.rowIds.includes(sample.expectedRows(true).filter(row=>row.name==='钢索')[0].rowId)),false,
   '无需询价行不进入任何分类工作簿');
  // 重试（跨重启）：侧栏/服务重启后按记录SHA核对，已成功的3份跳过，只重写未完成的“风机.xlsx”。
  await page.reload();
  await installCategoryStub();
  await openProject();
  await page.locator('#workflow-nav .workflow-step-button[data-stage="categories"]').click();
  await page.waitForFunction(()=>/已生成 3 \/ 4/.test(document.querySelector('#categories-banner').textContent));
  assert.equal(await page.evaluate(()=>window.__categoryWrites.length),0,'重载后不得重复写入已成功的文件');
  await page.locator('#categories-retry').click();
  await page.waitForFunction(()=>/4 个分类工作簿已生成/.test(document.querySelector('#categories-banner').textContent));
  assert.deepEqual(await page.evaluate(()=>window.__categoryWrites.map(item=>item.name)),['风机.xlsx'],
   '重启后重试只处理未完成的一份');
  assert.deepEqual((await fs.readdir(workbookDirectory)).sort(),
   ['汽车充电桩.xlsx','水泵.xlsx','阀门.xlsx','风机.xlsx'].sort());
  const receipt=await projectRecord();
  assert.equal(receipt.categories.status,'complete');
  assert.equal(receipt.categories.files.length,4);
  assert.equal(receipt.categories.files.every(file=>file.status==='succeeded'&&/^[a-f0-9]{64}$/.test(file.sha256)),true);
  assert.deepEqual(receipt.categories.counts,{categories:4,inquiryRows:7,noInquiryRows:1,totalRows:8});
  assert.equal(receipt.categories.layout,'separated','默认布局为品牌、供应商分列');
  for(const file of receipt.categories.files){
   const bytes=await fs.readFile(file.path);
   assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),file.sha256,'落盘SHA与回执一致');
  }
  assert.match(await page.locator('#categories-banner').innerText(),/4 个分类工作簿已生成/);
  assert.match(await page.locator('#categories-status').innerText(),/实际目录：/);
  await waitIdle();
  assert.equal(await page.locator('#categories-layout').isEnabled(),true,'全部核实后解锁布局选择');
  assert.equal(await page.locator('#categories-layout').inputValue(),'separated');
  assert.equal(await page.locator('#categories-summary').isEnabled(),true,'全部核实后解锁生成分类汇总表');
  assert.equal(await page.locator('#categories-files > li').count(),4);
  assert.match(await page.locator('#project-status').textContent(),/分类工作簿：已确认/);
  await dumpEvidence('category-receipt.json',receipt.categories);
  await dumpEvidence('category-workbook-rows.json',firstFour.map(item=>({name:item.name,rowCount:item.rowCount,
   rowIds:item.rowIds,values:item.values})));
  await shot(SHOT);
  // 布局选择会随项目保存。图04主按钮“生成分类汇总表”切到第5步并按当前布局生成汇总表（R7）。
  await page.locator('#categories-layout').selectOption('combined');
  await page.waitForFunction(()=>document.querySelector('#categories-message').textContent.includes('同格填写'));
  await page.locator('#categories-summary').click();
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='brands');
  await page.waitForFunction(()=>/分类汇总表/.test(document.querySelector('#brands-message').textContent));
  // 过期与重新生成＝新批次：整表确认变化后旧分类工作簿必须失效，重新生成不覆盖旧批次与已填汇总。
  const before=await projectRecord(),beforeBatch=before.categories.directory;
  const beforeBytes=await Promise.all(before.categories.files.map(file=>fs.readFile(file.path)));
  before.categories.reviewRevision=99;
  await fs.writeFile(await projectFile(),JSON.stringify(before,null,2));
  await page.reload();
  await installCategoryStub();
  await openProject();
  await page.locator('#workflow-nav .workflow-step-button[data-stage="categories"]').click();
  await page.waitForFunction(()=>/分类工作簿已过期/.test(document.querySelector('#categories-banner').textContent));
  assert.match(await page.locator('#categories-status').innerText(),/旧文件保留且不覆盖/);
  await waitIdle();
  assert.equal(await page.locator('#categories-summary').isDisabled(),true,'过期时不得解锁生成汇总');
  assert.match(await page.locator('#project-status').textContent(),/分类工作簿：未完成/);
  await page.locator('#categories-generate').click();
  await page.waitForFunction(old=>{
   const text=document.querySelector('#categories-status').textContent;
   return text.includes('实际目录：')&&!text.includes(old)&&
    /4 个分类工作簿已生成/.test(document.querySelector('#categories-banner').textContent);
  },beforeBatch,{timeout:30000});
  const after=await projectRecord();
  assert.notEqual(after.categories.directory,beforeBatch,'重新生成必须创建新批次目录');
  assert.equal(after.categories.status,'complete');
  assert.equal(after.categories.files.length,4);
  for(const file of after.categories.files)assert.equal(file.path.startsWith(after.categories.directory),true);
  assert.deepEqual(await fs.readdir(beforeBatch).then(list=>list.sort()),
   ['汽车充电桩.xlsx','水泵.xlsx','阀门.xlsx','风机.xlsx'].sort(),'旧批次文件保留');
  const afterBytes=await Promise.all(before.categories.files.map(file=>fs.readFile(file.path)));
  assert.deepEqual(afterBytes,beforeBytes,'旧批次文件内容未被覆盖');
  await shot(SHOT?SHOT.replace(/\.png$/,'-rebatch.png'):null);
  await dumpEvidence('category-regenerated.json',{before:beforeBatch,after:after.categories.directory,
   files:after.categories.files.map(file=>file.path)});
  await page.setViewportSize({width:340,height:900});
  const narrow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
   clientWidth:document.documentElement.clientWidth,steps:document.querySelectorAll('#workflow-nav .workflow-step').length}));
  assert.equal(narrow.steps,7);
  assert.ok(narrow.scrollWidth<=narrow.clientWidth+1,'窄侧栏不得出现横向滚动：'+JSON.stringify(narrow));
  assert.deepEqual(errors,[]);
  console.log('PASS: 图04独立分类工作簿：先检查全部目标、4个独立文件2/2/2/1行、10列且品牌/报价/金额留空、'+
   '局部成功不算完成、重试只处理未完成、全部核实后解锁布局与汇总、重新生成另建批次不覆盖旧文件。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
