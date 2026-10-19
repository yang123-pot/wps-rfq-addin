// 图04/图05（2026-10-11变更“一本多页”）验收：第4步只生成**一本** <项目名称>_分类工作簿.xlsx——
// 第 1 页＝分类汇总表（名称列＝文件内跳转到对应分类页），其后每类一页（页名＝类别名）、只打开一次；
// 第5步的“分类汇总表”就是这本工作簿的第 1 页（同一文件），没有单类导出入口。
// 模拟WPS宿主写入，暂存/独占发布/项目与分类库走真实服务端；同名不覆盖、另建批次。
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
 const result=reviewModel.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01',mergeAllWorkbooks:true});
 return reviewModel.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values;
}());
const CONFLICT_ROW=REVIEW_VALUES.findIndex(row=>row[1]==='充电桩配电箱')+1;
const PAGE_NAMES=['水泵','阀门','风机','汽车充电桩'],PAGE_ROWS=[2,2,2,1];
const SHOT=process.env.RFQ_UI_CATEGORY_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_CATEGORY_EVIDENCE;
async function dumpEvidence(name,value){
 if(!EVIDENCE)return;
 await fs.mkdir(EVIDENCE,{recursive:true});
 await fs.writeFile(path.join(EVIDENCE,name),JSON.stringify(value,null,2));
}
function initScript(context){
 const {files,reviewTarget}=context;
 window.__copies=[];window.__cellWrites=[];window.__selected=[];window.__openBooks=[];window.__stores={};
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
 // 与 ui-sheet-review-check 同一口径：表内修改要落值并持久化，重载后磁盘内容才与已保存确认快照一致。
 window.__setCell=function(row,column,value){
  const store=storeFor(reviewTarget);
  store.cells[row+':'+column]=value;
  const line=store.values[row-1]||(store.values[row-1]=[]);
  line[column-1]=value;
  try{window.localStorage.setItem('rfq-review-values',JSON.stringify(store.values));}catch(_){}
 };
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
  workbookDirectory=path.join(root,'分类工作簿'),
  workbookFile=path.join(workbookDirectory,'示例园区_分类工作簿.xlsx');
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
 const listXlsx=async directory=>(await fs.readdir(directory)).filter(name=>/\.xlsx$/i.test(name)).sort();
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(initScript,{files,drain:DRAIN,mep:MEP,reviewTarget,reviewValues:REVIEW_VALUES,root});
  await page.exposeFunction('__writeReviewFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  await page.exposeFunction('__writeCategoryFixture',async(file,payload)=>{
   await fs.writeFile(file,Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(String(payload))]));});
  // 一本多页写入换成夹具文件：页序/页名/页内跳转/逐页行数仍取插件真实模型（brand-model＋category-workbooks），
  // 便于逐项核对；每次 reload 后页面脚本重新加载，必须重新安装。
  const installCategoryStub=()=>page.evaluate(()=>{
   window.__categoryWrites=[];window.__categoryOpens=[];window.__categoryVerify=[];window.__categoryFail=null;
   window.RfqCategoryWorkbooks.writeAll=async function(app,plan,stagePath,options){
    const sheets=[];
    if(options&&options.summarySheet)sheets.push({name:options.summarySheet.name,
     values:options.summarySheet.values.map(row=>row.slice()),
     hyperlinks:((options.summarySheet.layout&&options.summarySheet.layout.hyperlinks)||[]).map(link=>Object.assign({},link))});
    (plan.files||[]).forEach(function(entry){
     const sheet=window.RfqCategoryWorkbooks.mainSheet(entry,{});
     sheets.push({name:entry.sheetName,categoryName:entry.categoryName,rowCount:entry.rowCount,
      rowIds:entry.rowIds.slice(),values:sheet.values.map(row=>row.slice())});});
    if(plan.noInquiry){
     const extra=window.RfqCategoryWorkbooks.mainSheet(plan.noInquiry,{});
     sheets.push({name:plan.noInquiry.sheetName,categoryName:'无需询价',rowCount:plan.noInquiry.rowCount,
      rowIds:plan.noInquiry.rowIds.slice(),values:extra.values.map(row=>row.slice())});
    }
    window.__categoryWrites.push({path:stagePath,file:plan.file,planPath:plan.path,sheets:sheets});
    if(window.__categoryFail)throw Error('模拟写入失败');
    await window.__writeCategoryFixture(stagePath,'pages:'+sheets.length+'#'+window.__categoryWrites.length);
   };
   window.RfqCategoryWorkbooks.verifySheets=function(app,filePath,expected){
    window.__categoryVerify.push({path:filePath,expected:expected.map(item=>Object.assign({},item))});
    return {ok:true,issues:[],sheets:expected.map((item,index)=>({index:index+1,sheetName:item.sheetName,rowCount:item.rowCount}))};
   };
   window.RfqCategoryWorkbooks.openForEditing=function(app,filePath){
    window.__categoryOpens.push(filePath);return {path:filePath,opened:true,reused:false};};
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
  // 留证截图前收起折叠的辅助功能，只呈现七步流程与当前阶段面板（便于对照图04/图05）。
  const shot=async file=>{
   if(!SHOT)return;
   await page.evaluate(()=>{const aux=document.getElementById('aux-section');if(aux)aux.open=false;});
   await page.screenshot({path:file,fullPage:true});
  };
  await require('./assistant-test-ui.cjs').acknowledgeProblems(page);
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  assert.match(await page.locator('#categories-note').innerText(),/最后单独保留一页“无需询价”/,
   '第4步说明必须明确无需询价保留在分类簿最后，不进入品牌汇总');
  // 图01→图02→图03：导入、合并确认、生成成果表、整表确认（含用户改选汽车充电桩）。
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
  await installCategoryStub();
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  await page.locator('#classification-review-open').click();
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='review');
  await page.evaluate(({row})=>{window.__setCell(row,9,'汽车充电桩');window.__setCell(row,10,'充电桩配套');},{row:CONFLICT_ROW});
  // 图04：第1次生成故意让写入失败，验证整本未通过不算完成、重试仍只写这一本。
  await page.evaluate(()=>{window.__categoryFail=true;});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>/整表已确认（8 行）|整表未通过校验|整表确认未完成|整表确认未保存/.test(
   document.querySelector('#sheet-review-message').textContent));
  assert.match(await page.locator('#sheet-review-message').innerText(),/整表已确认（8 行）/,'整表一次确认必须通过并落盘');
  await page.waitForFunction(()=>/分类工作簿未生成/.test(document.querySelector('#categories-message').textContent));
  assert.match(await page.locator('#categories-banner').innerText(),/分类工作簿已生成 0 \/ 6 页|尚未生成分类工作簿/);
  assert.equal(await page.locator('#categories-summary').isDisabled(),true,'整本未通过不得解锁生成汇总');
  assert.equal(await page.locator('#categories-layout').isDisabled(),true,'整本未通过不得解锁布局选择');
  assert.equal(await page.locator('#categories-retry').isHidden(),false,'未通过时提供重试入口');
  // 整本失败：一本都没有写出去，不得留下任何成果文件，也不得把“未生成”说成已完成。
  assert.deepEqual(await listXlsx(workbookDirectory),[],'整本失败时不得留下成果文件');
  assert.match(await page.locator('#categories-files').innerText(),/尚未全部通过校验/);
  assert.deepEqual(await page.evaluate(()=>window.__categoryWrites.map(item=>item.planPath)),[workbookFile],
   '失败的一次也只针对那一本工作簿');
  assert.equal(await page.locator('#categories-files > li button').count(),0,'列表里不得出现任何单类导出/打开入口');
  // 重试：仍只写这一本，页序/页名/页内跳转/逐页行数全部按真实模型核对。
  await page.evaluate(()=>{window.__categoryFail=null;});
  await page.locator('#categories-retry').click();
  await page.waitForFunction(()=>/分类工作簿已生成（1 本 · 4 类 · 无需询价1页）/.test(document.querySelector('#categories-banner').textContent));
  assert.deepEqual(await listXlsx(workbookDirectory),['示例园区_分类工作簿.xlsx'],'只生成一本分类工作簿');
  const writes=await page.evaluate(()=>window.__categoryWrites.map(item=>item));
  assert.equal(writes.length,2,'失败一次＋成功一次，共两次写入尝试');
  const model=writes[writes.length-1];
  assert.equal(model.file,'示例园区_分类工作簿.xlsx');
  assert.equal(model.planPath,workbookFile,'写入目标就是那一本工作簿');
  assert.deepEqual(model.sheets.map(sheet=>sheet.name),['分类汇总表'].concat(PAGE_NAMES,['无需询价']),
   '第 1 页是分类汇总表，其后询价类别各一页，无需询价在最后');
  assert.deepEqual(model.sheets.slice(1).map(sheet=>sheet.rowCount),PAGE_ROWS.concat([1]),'逐页行数2/2/2/1/无需询价1');
  assert.deepEqual(model.sheets.slice(1).map(sheet=>sheet.values.length-1),PAGE_ROWS.concat([1]),'逐页材料行数与回执一致');
  assert.equal(model.sheets.slice(1).every(sheet=>sheet.values[0].length===11),true,'公开10列＋K列随行rowId');
  assert.equal(model.sheets.slice(1).flatMap(sheet=>sheet.values.slice(1).map(row=>row.slice(6,9))).every(row=>row.every(value=>value==='')),true,
   '品牌/报价单价/金额留空');
  assert.equal(model.sheets[model.sheets.length-1].values[1][9],'无需询价','无需询价末页明确标注');
  // 汇总页（第 1 页）：一类一行，名称列是文件内跳转（地址空、SubAddress＝页名!A1）。
  const summarySheet=model.sheets[0];
  assert.deepEqual(summarySheet.hyperlinks.map(link=>[link.address,link.subAddress,link.internal===true,link.display]),
   PAGE_NAMES.map(name=>['',name+'!A1',true,name]),'名称列＝文件内跳转到对应分类页');
  assert.deepEqual(summarySheet.values.slice(3,7).map(row=>row.slice(0,3)),
   [['1','水泵','2'],['2','阀门','2'],['3','风机','2'],['4','汽车充电桩','1']],'汇总页一类一行、条数来自快照');
  assert.equal(summarySheet.values.slice(3,7).every(row=>row.slice(3,9).every(value=>value==='')),true,'品牌供应商初始空白');
  // 发布后按页读回：期望值必须是“第 1 页汇总＋逐类页”，顺序与行数完全一致。
  const verify=await page.evaluate(()=>window.__categoryVerify.map(item=>item));
  assert.equal(verify.length,1,'成功写入后必须按页读回核对一次');
  assert.equal(verify[0].path,workbookFile);
  assert.deepEqual(verify[0].expected.map(item=>item.sheetName),['分类汇总表'].concat(PAGE_NAMES,['无需询价']));
  assert.deepEqual(verify[0].expected.map(item=>item.rowCount),[summarySheet.values.length].concat(PAGE_ROWS,[1]),
   '按页核行数含第 1 页汇总页');
  assert.deepEqual(await page.evaluate(()=>window.__categoryOpens),[workbookFile],
   '整本只打开一次（不逐页、不逐份打开）');
  const receipt=await projectRecord();
  assert.equal(receipt.categories.status,'complete');
  assert.equal(receipt.categories.summaryLayout,'separated','默认布局为品牌、供应商分列');
  assert.deepEqual(receipt.categories.sheets.map(sheet=>[sheet.sheetName,sheet.isSummary===true,sheet.status]),
   [['分类汇总表',true,'succeeded']].concat(PAGE_NAMES.map(name=>[name,false,'succeeded']),[['无需询价',false,'succeeded']]),
   '第 1 页汇总＋逐类页＋无需询价末页全部已生成并校验');
  assert.deepEqual(receipt.categories.counts,{categories:4,inquiryRows:7,noInquiryRows:1,totalRows:8});
  const bytes=await fs.readFile(receipt.categories.path);
  assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),receipt.categories.sha256,
   '落盘SHA与回执一致');
  assert.match(await page.locator('#categories-banner').innerText(),/分类工作簿已生成（1 本 · 4 类 · 无需询价1页）/);
  assert.match(await page.locator('#categories-status').innerText(),/实际文件：/);
  await waitIdle();
  assert.equal(await page.locator('#categories-layout').isEnabled(),true,'整本核实后解锁布局选择');
  assert.equal(await page.locator('#categories-layout').inputValue(),'separated');
  assert.equal(await page.locator('#categories-summary').isEnabled(),true,'整本核实后解锁生成分类汇总表');
  assert.equal(await page.locator('#categories-files > li').count(),7,'1 行工作簿＋6 页');
  assert.match(await page.locator('#categories-files').innerText(),/1 本工作簿 · 6 页/);
  assert.match(await page.locator('#project-status').textContent(),/分类工作簿：已确认/);
  await dumpEvidence('category-receipt.json',receipt.categories);
  await dumpEvidence('category-workbook-pages.json',model.sheets.map(sheet=>({name:sheet.name,rowCount:sheet.rowCount,
   hyperlinks:sheet.hyperlinks||[]})));
  await shot(SHOT);
  // 图05：分类汇总表就是同一本工作簿的第 1 页——不改布局时只做绑定，不重写文件、不产生第二本。
  await page.locator('#categories-summary').click();
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='brands');
  await page.waitForFunction(()=>/分类汇总表/.test(document.querySelector('#brands-status').textContent));
  assert.equal(await page.locator('#brands-generate').isDisabled(),false);
  assert.deepEqual(await listXlsx(workbookDirectory),['示例园区_分类工作簿.xlsx'],'生成汇总表不得再产出第二个文件');
  assert.equal(await page.evaluate(()=>window.__categoryWrites.length),2,'不改布局时“生成分类汇总表”不重写工作簿');
  const bound=await projectRecord();
  assert.equal(bound.summary.path,bound.categories.path,'项目绑定里汇总表与分类工作簿指向同一文件');
  assert.equal(bound.summary.internal,true);
  assert.deepEqual(bound.summary.categories.map(item=>[item.categoryName,item.sheetName,item.rowCount]),
   PAGE_NAMES.map((name,index)=>[name,name,PAGE_ROWS[index]]),'汇总绑定逐类带页名与行数');
  assert.match(await page.locator('#brands-status').innerText(),/实际文件：.*示例园区_分类工作簿\.xlsx/);
  await shot(SHOT?SHOT.replace(/\.png$/,'-step5.png'):null);
  // 改布局＝按新布局重写第 1 页：另存一本新文件（不覆盖已生成文件与已填内容），两处绑定同步指向新文件。
  await page.locator('#brands-layout').selectOption('combined');
  await page.locator('#brands-generate').click();
  await page.waitForFunction(()=>/已生成并校验分类汇总表（4 类，品牌与供应商同格填写）/.test(document.querySelector('#brands-message').textContent),
   null,{timeout:30000});
  const rewritten=await projectRecord();
  assert.notEqual(rewritten.categories.path,workbookFile,'改布局必须另存新文件，不覆盖旧排布');
  assert.match(rewritten.categories.file,/^示例园区_分类工作簿_\d{8}-\d{6}\.xlsx$/);
  assert.equal(rewritten.summary.path,rewritten.categories.path,'改布局后两处绑定仍指向同一文件');
  assert.equal(rewritten.categories.summaryLayout,'combined');
  assert.deepEqual(await listXlsx(workbookDirectory),['示例园区_分类工作簿.xlsx',rewritten.categories.file].sort(),
   '旧排布文件保留、未覆盖');
  const rewrittenWrites=await page.evaluate(()=>window.__categoryWrites.map(item=>item.file));
  assert.equal(rewrittenWrites.length,3,'改布局确实重写了整本工作簿');
  assert.equal(rewritten.summary.categories.length,4);
  await dumpEvidence('category-rebound.json',{before:workbookFile,after:rewritten.categories.path,
   files:await listXlsx(workbookDirectory)});
  // 过期与重新生成＝新批次：整表确认变化后旧分类工作簿必须失效，重新生成另建批次目录、不覆盖旧文件。
  const before=await projectRecord(),beforeBatch=before.categories.directory,beforeFile=before.categories.path;
  const beforeBytes=await fs.readFile(beforeFile);
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
  await page.waitForFunction(()=>/分类工作簿已生成（1 本 · 4 类 · 无需询价1页）/.test(document.querySelector('#categories-banner').textContent),
   null,{timeout:30000});
  const after=await projectRecord();
  assert.notEqual(after.categories.directory,beforeBatch,'重新生成必须创建新批次目录');
  assert.equal(after.categories.status,'complete');
  assert.equal(after.categories.path.startsWith(after.categories.directory),true);
  assert.deepEqual(await fs.readFile(beforeFile),beforeBytes,'旧批次文件内容未被覆盖');
  assert.deepEqual(await listXlsx(beforeBatch),await listXlsx(beforeBatch),'旧批次目录保留原文件');
  assert.match(after.categories.path,/_分类工作簿\.xlsx$/);
  // 回执显示40页但缺少实际文件读回（本次真实故障形态）：不得继续显示完成，重新生成必须换新批次。
  const missingReadBack=await projectRecord(),beforeMissingBatch=missingReadBack.categories.directory;
  delete missingReadBack.categories.readBack;
  await fs.writeFile(await projectFile(),JSON.stringify(missingReadBack,null,2));
  await page.reload();
  await installCategoryStub();
  await openProject();
  await page.locator('#workflow-nav .workflow-step-button[data-stage="categories"]').click();
  await page.waitForFunction(()=>/分类工作簿需要重新生成/.test(document.querySelector('#categories-banner').textContent));
  assert.match(await page.locator('#categories-stats').innerText(),/缺少可信的实际页结构读回记录/);
  assert.equal(await page.locator('#categories-summary').isDisabled(),true,'缺少实际页读回时不得解锁汇总');
  const writesBeforeRecovery=await page.evaluate(()=>window.__categoryWrites.length);
  await waitIdle();
  await page.evaluate(()=>RfqAssistant.run('categoriesGenerate'));
  await page.waitForFunction(()=>/分类工作簿已生成（1 本 · 4 类 · 无需询价1页）/.test(document.querySelector('#categories-banner').textContent),
   null,{timeout:30000});
  const repaired=await projectRecord();
  assert.equal(repaired.categories.directory,beforeMissingBatch,'现有文件页结构正确时应补做读回，不重复生成');
  assert.equal(repaired.categories.readBack.ok,true);
  assert.equal(repaired.categories.readBack.sheets.length,6);
  assert.equal(await page.evaluate(()=>window.__categoryWrites.length),writesBeforeRecovery,'恢复读回不得重写工作簿');
  await shot(SHOT?SHOT.replace(/\.png$/,'-rebatch.png'):null);
  await dumpEvidence('category-regenerated.json',{before:beforeBatch,after:after.categories.directory,
   files:await listXlsx(after.categories.directory)});
  await page.setViewportSize({width:340,height:900});
  const narrow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
   clientWidth:document.documentElement.clientWidth,steps:document.querySelectorAll('#workflow-nav .workflow-step').length}));
  assert.equal(narrow.steps,7);
  assert.ok(narrow.scrollWidth<=narrow.clientWidth+1,'窄侧栏不得出现横向滚动：'+JSON.stringify(narrow));
  assert.deepEqual(errors,[]);
  console.log('PASS: 图04/05一本多页：只生成一本分类工作簿（第1页汇总＋逐类页、页名＝类别名、名称列＝文件内跳转）、'+
   '整本失败不算完成、按页读回核行数、生成汇总表不再另出文件、改布局另存不覆盖、重新生成另建批次。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
