const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const reviewModel=require('../src/classification-review-model.js');
const brandModel=require('../src/brand-model.js');
// 上面这段是R1–R6过渡期侧栏品牌面板的回归用例；下面summaryFlow是R7（图05A/05B）的分类汇总表用例。
async function legacyBrandFlow(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-brand-')),files=[path.join(root,'测试一.xlsx')];
 await fs.writeFile(files[0],'first file');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--explicitly-allowed-ports='+server.address().port]});
 let brandTarget=path.join(root,'分类品牌表.xlsx');
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(({files,root})=>{
   window.__copies=[];
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
    '测试一.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
     ['001','水龙头','DN15','个','1'],['002','电动排烟阀手动开启钢索','','套','2']]
   };
   function sheetFor(path,name){
    window.__books=window.__books||{};
    window.__books[path]=window.__books[path]||{};
    if(!window.__books[path][name]){
     const original=(window.__copies.filter(item=>item.copyPath===path)[0]||{}).originalName;
     window.__books[path][name]={values:(materialRows[original]||[]).map(row=>row.slice())};
    }
    const store=window.__books[path][name];
    return {Name:name,UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:5},Value2:store.values}};
   }
   function bookFor(path){return {FullName:path,
    Worksheets:{Count:1,Item(name){return sheetFor(path,typeof name==='string'?name:'给排水');}},
    Activate(){app.ActiveWorkbook=this;},Close(){}};}
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
    GetSaveAsFilename(){return window.__saveAs;},
    Workbooks:{Count:1,Item(){return previous;},Open(file){
     if(files.includes(file))throw Error('original was opened');
     return bookFor(file);
    }}};
   window.Application=app;window.__files=files;
  },{files,root});
  await page.exposeFunction('__writeBrandFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.locator('#aux-section > summary').click();
  assert.match(await page.locator('#brand-status').innerText(),/先完成导入/,'分类未完成前不得建立品牌表');
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===1);
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 2'));
  await page.waitForFunction(()=>document.querySelector('#brand-status').textContent.includes('分类'));
  const rows=page.locator('#classification-list > li');
  await rows.nth(0).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  await page.locator('#classification-list > li').nth(1).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await page.waitForFunction(()=>document.querySelector('#brand-status').textContent.includes('尚未生成分类品牌表'));
  assert.match(await page.locator('#brand-categories').innerText(),/水阀门/,'按类别自动生成品牌行');
  assert.doesNotMatch(await page.locator('#brand-categories').innerText(),/无需询价/,'无需询价行不进入品牌表');
  assert.equal(await page.locator('#brand-categories [data-assignment-id]').count(),1);
  assert.match(await page.locator('#brand-status').innerText(),/品牌为空/,'没填品牌时品牌阶段不能完成');
  assert.equal(await page.locator('#brand-generate').isDisabled(),false,'结构通过即可生成待填写汇总表');

  await page.evaluate(target=>{
   window.RfqBrandHost.selectTarget=()=>target;
   window.RfqBrandHost.write=async(app,model,stagePath)=>{window.__brandModel=model;await window.__writeBrandFixture(stagePath);};
  },brandTarget);
  await page.locator('#brand-generate').click();
  await page.waitForFunction(()=>document.querySelector('#brand-message').textContent.includes('分类品牌表已生成'));
  assert.match(await page.locator('#brand-status').innerText(),/品牌表已生成：/,'生成后要记录品牌表路径');
  const model=await page.evaluate(()=>window.__brandModel);
  assert.deepEqual(model.sheets[0].values[1],['分配标识','类别','材料条目数','品牌','供应商','备注','材料行标识']);
  assert.equal(model.sheets[0].values[2][3],'','生成的汇总表品牌列必须是空的，等人工填写');
  assert.equal(model.sheets[0].values[2][4],'','供应商留到询价拆分步骤再补');
  const notes=model.sheets[2].values.map(row=>row[1]).join('；');
  assert.match(notes,/只能修改品牌、供应商、备注/,'汇总表要说明填写范围');
  assert.match(notes,/品牌列的唯一来源/,'汇总表要说明品牌与询价表联动');

  await page.evaluate(()=>{
   window.__readBinding=null;window.__readFails=null;
   window.RfqBrandHost.read=function(app,binding){
    window.__readBinding=binding;
    if(window.__readFails)throw Error(window.__readFails);
    const assignmentId=Object.keys(binding.rowMap)[0];
    return {path:binding.path,sheet:binding.sheet,inputKey:binding.inputKey,
     assignments:[{assignmentId:assignmentId,categoryId:'water-valve',brand:'品牌甲',supplier:'供应商A',note:'人工填写的品牌'}],rowCount:1};
   };
  });
  await page.locator('#brand-read').click();
  await page.waitForFunction(()=>!document.querySelector('#brand-preview').hidden);
  assert.match(await page.locator('#brand-preview-list').innerText(),/品牌：“”→“品牌甲”/,'读取后必须先给出逐项预览');
  assert.match(await page.locator('#brand-message').innerText(),/确认写入项目/);
  await page.locator('#brand-confirm-read').click();
  await page.waitForFunction(()=>document.querySelector('#brand-message').textContent.includes('已按品牌表更新项目'));
  assert.equal(await page.locator('#brand-categories input[aria-label="品牌"]').inputValue(),'品牌甲');
  assert.match(await page.locator('#brand-status').innerText(),/品牌已填写完整/);
  const binding=await page.evaluate(()=>window.__readBinding);
  assert.equal(binding.path,brandTarget);
  assert.match(String(binding.inputKey),/^ck2-[0-9a-f]{16}$/,'读回必须带生成时的内容键');
  assert.equal(Object.keys(binding.rowMap).length,1,'绑定必须按分配标识记录映射');

  await page.evaluate(()=>{window.__readFails='品牌表第3行的类别被改动（应为“水阀门”），不能读回。';});
  await page.locator('#brand-read').click();
  await page.waitForFunction(()=>document.querySelector('#brand-message').textContent.includes('类别被改动'));
  assert.equal(await page.locator('#brand-categories input[aria-label="品牌"]').inputValue(),'品牌甲','读取失败不得改动项目里的品牌');
  assert.match(await page.locator('#brand-message').innerText(),/品牌表未读取成功/);

  await page.locator('#brand-coverage').selectOption('material-subsets');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#project-status').innerText(),/品牌汇总：未完成/,
   'R7起品牌汇总阶段只认分类汇总表；过渡期侧栏面板填好品牌也不代表该阶段完成');
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
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#brand-status').innerText(),/品牌已填写完整/,'人工填好品牌后品牌面板必须显示已完整');
  assert.match(await page.locator('#project-status').innerText(),/分类工作簿：未完成/,
   '分类工作簿尚未实现时，品牌汇总不得被误报为已完成');
  assert.match(await page.locator('#project-status').innerText(),/询价表：未完成/);
  const saved=JSON.parse(await fs.readFile(path.join(root,'projects',(await fs.readdir(path.join(root,'projects')))[0]),'utf8'));
  assert.equal(saved.assignments.assignments[0].brand,'品牌甲','项目记录必须保存人工填写的品牌');
  assert.equal(saved.assignments.binding.path,brandTarget);
  assert.equal(saved.schemaVersion,2,'项目记录必须写入v2结构');
  assert.equal(saved.stages.categories.state,'missing','未实现的分类工作簿阶段必须保持未完成');
  assert.equal(saved.stages.brands.state,'missing','分类工作簿未完成时品牌汇总不得误报完成');
  await page.reload();
  await page.locator('#aux-section > summary').click();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  assert.equal(await page.locator('#brand-categories input[aria-label="品牌"]').inputValue(),'品牌甲','恢复项目后品牌与表路径要一致');
  assert.match(await page.locator('#brand-status').innerText(),/品牌表已生成：/);
  // D2：按品牌与抬头生成总询价工作簿，品牌列来自汇总表，报价单价与金额留空。
  const inquiryTarget=path.join(root,'项目询价.xlsx');
  await page.evaluate(target=>{
   window.__writtenModels=[];
   window.RfqBrandHost.selectTarget=()=>target;
   window.RfqBrandHost.write=async(app,model,stagePath)=>{
    window.__writtenModels.push(model);await window.__writeBrandFixture(stagePath);};
  },inquiryTarget);
  await page.locator('#inquiry-generate').click();
  await page.waitForFunction(()=>document.querySelector('#inquiry-message').textContent.includes('询价工作簿已生成'));
  assert.match(await page.locator('#inquiry-status').innerText(),/询价页 1 张/);
  assert.match(await page.locator('#inquiry-preview').innerText(),/品牌 品牌甲/);
  const written=await page.evaluate(()=>window.__writtenModels[window.__writtenModels.length-1]);
  assert.deepEqual(written.sheets[0].values[6].slice(0,10),
   ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],'对外列必须与白名单一致');
  assert.equal(written.sheets[0].values[7][6],'品牌甲','询价表品牌必须来自汇总表');
  assert.equal(written.sheets[0].values[7][7],'','报价单价留空');
  assert.equal(written.sheets[0].values[7][8],'','金额留空');
  assert.deepEqual(written.sheets.slice(1).map(sheet=>sheet.name),['内部追溯','处理记录'],'内部资料只留在内部页');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#inquiry-status').innerText(),/已生成：/,'询价工作簿必须真实生成并校验');
  assert.match(await page.locator('#project-status').innerText(),/询价表：未完成（品牌汇总未完成）/,
   '阶段未实现前不得因旧生成记录误报完成');

  // E2：一个询价页拆成一个文件，成功后写回执；输出目录必须先存在。
  const splitDirectory=path.join(root,'拆分');
  await fs.mkdir(splitDirectory,{recursive:true});
  await page.evaluate(target=>{window.__saveAs=target;},path.join(splitDirectory,'水阀门_供应商A.xlsx'));
  await page.locator('#split-directory').click();
  await page.waitForFunction(()=>document.querySelector('#split-status').textContent.includes('计划 1 个文件'));
  assert.match(await page.locator('#split-preview').innerText(),/水阀门_供应商A\.xlsx/);
  assert.match(await page.locator('#split-preview').innerText(),/品牌 品牌甲|品牌甲/);
  await page.locator('#split-run').click();
  await page.waitForFunction(()=>document.querySelector('#split-message').textContent.includes('拆分完成'));
  assert.match(await page.locator('#split-status').innerText(),/完成 1/);
  const splitFile=path.join(splitDirectory,'水阀门_供应商A.xlsx');
  assert.equal(require('node:fs').existsSync(splitFile),true,'拆分文件必须真实存在');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#split-status').innerText(),/完成 1/,'拆分必须真实完成并核对');
  const afterSplit=JSON.parse(await fs.readFile(path.join(root,'projects',(await fs.readdir(path.join(root,'projects')))[0]),'utf8'));
  assert.equal(afterSplit.split.files.length,1);
  assert.equal(afterSplit.split.files[0].state,'succeeded');
  assert.match(afterSplit.split.files[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal(afterSplit.generation.target,inquiryTarget,'生成记录必须保存目标文件与内容键');
  assert.match(afterSplit.generation.inputKey,/^ck2-[0-9a-f]{16}$/);

  // 品牌变化后旧生成文件必须过期，拆分也不能继续沿用。
  await page.evaluate(()=>{
   window.RfqBrandHost.read=function(app,binding){
    const assignmentId=Object.keys(binding.rowMap)[0];
    return {path:binding.path,sheet:binding.sheet,inputKey:binding.inputKey,
     assignments:[{assignmentId:assignmentId,categoryId:'water-valve',brand:'品牌乙',supplier:'供应商A',note:''}],rowCount:1};
   };
  });
  await page.locator('#brand-read').click();
  await page.waitForFunction(()=>!document.querySelector('#brand-preview').hidden);
  await page.locator('#brand-confirm-read').click();
  await page.waitForFunction(()=>document.querySelector('#inquiry-status').textContent.includes('过期'));
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-status').textContent.includes('旧生成文件已过期'));
  assert.match(await page.locator('#split-status').innerText(),/冲突 1：.*(不一致|重新生成)/,'过期后必须阻断旧拆分计划并说明原因');
  assert.equal(await page.locator('#split-run').isDisabled(),true,'过期计划不得再执行发布');
  assert.deepEqual(errors,[]);
  console.log('PASS(过渡期面板): 品牌表按类别自动生成与人工填品牌、抬头必填、询价表按白名单生成且品牌来自汇总表、报价与金额留空、拆分一份一文件并写回执、品牌变化后旧生成文件与拆分计划立即阻断。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
}

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
 window.__setCell=function(row,column,value){storeFor(reviewTarget).cells[row+':'+column]=value;};
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
  workbookDirectory=path.join(root,'分类工作簿'),summaryTarget=path.join(root,'分类汇总表.xlsx');
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
   window.RfqCategoryWorkbooks.write=async function(app,entry,stagePath,options){
    window.__categoryWrites.push({path:stagePath,categoryId:entry.categoryId,categoryName:entry.categoryName,name:entry.file});
    await window.__writeCategoryFixture(stagePath,entry.file);};
   // 汇总表写入换成夹具文件；模型内容仍取插件真实模型，便于逐项核对公开版式与链接。
   window.RfqBrandHost.summaryWrite=async function(app,model,stagePath){
    const spec=model.sheets[0].layout;
    window.__summaryModels.push({stagePath:stagePath,layout:model.layout,headerRow:model.headerRow,firstRow:model.firstRow,
     lastRow:model.lastRow,auxCategory:model.auxCategory,auxFile:model.auxFile,auxOptions:model.auxOptions,
     categories:model.categories.map(item=>({categoryId:item.categoryId,categoryName:item.categoryName,
      rowCount:item.rowCount,relative:item.relative,file:item.file})),
     hyperlinks:spec.hyperlinks.map(link=>({address:link.address,display:link.display,relative:link.relative})),
     hidden:spec.columns.filter(column=>column.hidden).map(column=>column.index),
     validation:{row:spec.validations[0].row,rowSpan:spec.validations[0].rowSpan,column:spec.validations[0].column,
      listRange:spec.validations[0].listRange},
     values:model.sheets[0].values.map(row=>row.slice()),
     rows:model.sheets[0].values.slice(model.firstRow-1,model.lastRow).map(row=>row.slice(0,10))});
    await window.__writeSummaryFixture(stagePath,'summary');};
   window.RfqBrandHost.openSummary=function(app,filePath){window.__summaryOpened.push(filePath);return {path:filePath,opened:true};};
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
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  // 图01→图04：导入、合并确认、整表确认（含改选汽车充电桩）、生成4份独立分类工作簿。
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
  await page.waitForFunction(()=>/4 个分类工作簿已生成/.test(document.querySelector('#categories-banner').textContent));
  assert.deepEqual((await fs.readdir(workbookDirectory)).sort(),
   ['汽车充电桩.xlsx','水泵.xlsx','阀门.xlsx','风机.xlsx'].sort(),'4份独立分类工作簿已真实发布');
  console.log('PASS(R7-1): 图05前序链路成立——4类2/2/2/1行分类工作簿已生成。');
  // 图05A：生成分类汇总表（默认分列布局），一类一行，名称是蓝色下划线相对链接。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="brands"]').click();
  await page.waitForFunction(()=>document.querySelector('#brands-banner').textContent.includes('尚未生成分类汇总表'));
  assert.equal(await page.locator('#brands-layout').isEnabled(),true,'分类工作簿核实后解锁布局选择');
  assert.equal(await page.locator('#brands-layout').inputValue(),'separated','默认布局为品牌、供应商分列');
  assert.equal(await page.locator('#brands-generate').isEnabled(),true,'分类工作簿完成后可生成分类汇总表');
  assert.equal(await page.locator('#brands-list > li').count(),4,'一类一行，共4个类别');
  assert.match(await page.locator('#brands-list').innerText(),/水泵[\s\S]*链接目标：水泵\.xlsx/,'每行显示链接目标');
  await page.locator('#brands-generate').click();
  await page.waitForFunction(()=>window.__summaryModels.length>=1&&
   /已生成并校验分类汇总表/.test(document.querySelector('#brands-message').textContent));
  const separated=await page.evaluate(()=>window.__summaryModels[0]);
  assert.equal(separated.layout,'separated');
  assert.deepEqual(separated.categories.map(item=>[item.categoryName,item.rowCount,item.relative]),
   [['水泵',2,'分类工作簿\\水泵.xlsx'],['阀门',2,'分类工作簿\\阀门.xlsx'],['风机',2,'分类工作簿\\风机.xlsx'],
    ['汽车充电桩',1,'分类工作簿\\汽车充电桩.xlsx']],'一类一行，条数取自该类快照');
  assert.deepEqual(separated.hyperlinks.map(link=>[link.address,link.display,link.relative]),
   [['分类工作簿\\水泵.xlsx','水泵',true],['分类工作簿\\阀门.xlsx','阀门',true],['分类工作簿\\风机.xlsx','风机',true],
    ['分类工作簿\\汽车充电桩.xlsx','汽车充电桩',true]],'名称加蓝色下划线相对链接，指向对应独立分类工作簿');
  assert.deepEqual(separated.rows.map(row=>row.slice(0,3)),
   [['1','水泵','2'],['2','阀门','2'],['3','风机','2'],['4','汽车充电桩','1']]);
  assert.equal(separated.rows.every(row=>row.slice(3,9).every(value=>value==='')),true,'品牌与供应商初始空白');
  assert.deepEqual(separated.hidden,[11,12,13],'隐藏列保存稳定类别ID/相对链接/方式选项');
  assert.deepEqual([separated.validation.row,separated.validation.rowSpan,separated.validation.column,separated.validation.listRange],
   [4,4,10,'$M$1:$M$2'],'询价生成方式下拉覆盖4行');
  assert.equal((await fs.readdir(root)).includes('分类汇总表.xlsx'),true,'汇总表已真实发布到项目目录');
  const receipt=await projectRecord();
  assert.equal(receipt.summary.layout,'separated');
  assert.equal(path.resolve(receipt.summary.path).toLowerCase(),path.resolve(summaryTarget).toLowerCase(),
   '项目记录必须保存汇总表真实路径');
  assert.deepEqual(receipt.summary.categories.map(item=>item.categoryId),['pump','valve','fan','ev-charger']);
  assert.match(String(receipt.summary.sha256),/^[a-f0-9]{64}$/,'汇总表回执必须带SHA');
  assert.match(await page.locator('#brands-banner').innerText(),/分类汇总表已生成（4 类）/);
 assert.match(await page.locator('#project-status').textContent(),
   /品牌汇总：未完成（分类汇总表已生成（4 类，品牌、供应商分列），请在表内填写品牌与供应商后点“填写完成，生成询价表”读回）/,
   '生成汇总表但未读回填写内容前，品牌汇总阶段不得误报完成');
  await page.locator('#brands-open').click();
  assert.deepEqual(await page.evaluate(()=>window.__summaryOpened.map(item=>String(item).toLowerCase())),
   [String(receipt.summary.path).toLowerCase()],'打开汇总表指向已生成的真实文件');
  await shot(SUMMARY_SHOT&&SUMMARY_SHOT.replace(/\.png$/,'-separated.png'));
 await dumpEvidence('summary-binding-separated.json',receipt.summary);
 await dumpEvidence('summary-files.json',(await fs.readdir(root)).filter(name=>name.startsWith('分类汇总表')));
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
  assert.deepEqual(combined.hyperlinks.map(link=>link.address),separated.hyperlinks.map(link=>link.address),
   '两种布局名称链接与目标一致');
  assert.deepEqual(combined.rows.map(row=>row.slice(0,3)),separated.rows.map(row=>row.slice(0,3)),
   '两种布局类别、条数一致');
  assert.equal(combined.rows.every(row=>row.slice(3,6).every(value=>value==='')),true,'同格单格初始空白');
  assert.notEqual(combined.stagePath,separated.stagePath,'重新生成另存新文件，不覆盖已生成汇总表');
  const receipt2=await projectRecord();
  assert.equal(receipt2.summary.layout,'combined');
  assert.notEqual(path.resolve(receipt2.summary.path).toLowerCase(),path.resolve(summaryTarget).toLowerCase(),
   '同格布局必须另存新文件');
  assert.ok((await fs.readdir(root)).filter(name=>name.startsWith('分类汇总表')).length>=2,'两份汇总表文件同时保留');
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
  assert.deepEqual(errors,[]);
  console.log('PASS(R7+R8): 图05A/05B分类汇总表——一类一行、双布局可用、4名称链接指向正确独立分类工作簿；R8按稳定类别ID读回、半组定位单元格、多品牌按组保留、预计5份、双布局等价并随项目保存恢复。');
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
}
(async()=>{await legacyBrandFlow();await summaryFlow();})().catch(e=>{console.error(e);process.exitCode=1;});
