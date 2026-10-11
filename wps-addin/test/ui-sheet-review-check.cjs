// R5验收：图03表内审核→整表一次确认→学习。模拟WPS宿主读写成果表，其余（暂存/发布/项目/分类库）走真实服务端。
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
// 生成态成果表（与R4一致）：第3行表头、数据从第4行起、K列隐藏rowId。
const REVIEW_VALUES=(function(){
 const preview=collection.preview(sample.buildCollection(),true);
 const result=reviewModel.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'});
 return reviewModel.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values;
}());
const rowOf=name=>REVIEW_VALUES.findIndex(row=>row[1]===name)+1;
const CONFLICT_ROW=rowOf('充电桩配电箱'),PUMP_ROW=rowOf('水泵'),FAN_ROW=rowOf('送风机');
const SHOT=process.env.RFQ_UI_SHEET_REVIEW_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_SHEET_REVIEW_EVIDENCE;
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
    const known=window.__copies.some(item=>item.copyPath===file)||String(file)===String(reviewTarget);
    if(!known)throw Error('unknown book: '+file);
    return window.__openBooks.filter(item=>item.FullName===file)[0]||openBook(file,readOnly);
   }}};
 window.Application=app;window.__files=files;
 // R12-C 之后，侧栏会把“打开簿/磁盘内容”与已保存快照按业务内容比较；因此表内修改必须同时落到
 // 这张表的值并持久化（相当于用户保存了 xlsx），否则重载后会被正确判为“内容与已保存确认不一致”。
 window.__setCell=function(row,column,value){
  const store=storeFor(reviewTarget);
  store.cells[row+':'+column]=value;
  const line=store.values[row-1]||(store.values[row-1]=[]);
  line[column-1]=value;
  try{window.localStorage.setItem('rfq-review-values',JSON.stringify(store.values));}catch(_){}
 };
 window.__reviewSnapshot=function(){
  const store=storeFor(reviewTarget);
  return {values:store.values.map(row=>row.slice()),cells:store.cells};
 };
 // 让模拟宿主读到插件真实生成的成果表（含真实rowId），重开后仍可重放同一张表。
 window.__seedReview=function(values){
  const copied=values.map(row=>row.slice());
  storeFor(reviewTarget).values=copied;storeFor(reviewTarget).cells={};
  try{window.localStorage.setItem('rfq-review-values',JSON.stringify(copied));}catch(_){}
 };
}
async function run(options={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-sheet-review-')),
  files=[path.join(root,'给排水清单.xlsx'),path.join(root,'机电清单.xlsx')],
  reviewTarget=path.join(root,'示例园区_分类审核成果.xlsx'),projectDirectory=path.join(root,'projects');
 await fs.writeFile(files[0],'drain');await fs.writeFile(files[1],'mep');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:projectDirectory,libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const store=createLibraryStore({directory:path.join(root,'library')});
 await store.save({expectedRevision:0,library:sample.library,memory:sample.createMemory()});
 const projectFile=async()=>path.join(projectDirectory,(await fs.readdir(projectDirectory))[0]);
 const projectRecord=async()=>JSON.parse(await fs.readFile(await projectFile(),'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let memorySaveAttempts=0;
  if(options.memoryFailure)await page.route('**/api/library/save',route=>{
   memorySaveAttempts++;
   return memorySaveAttempts===1?route.fulfill({status:500,contentType:'application/json',
    body:JSON.stringify({error:'注入的习惯保存失败'})}):route.continue();
  });
  await page.addInitScript(initScript,{files,drain:DRAIN,mep:MEP,reviewTarget,reviewValues:REVIEW_VALUES});
  await page.exposeFunction('__writeReviewFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  // 导入两份清单→选合并→确认选择（图01），进入自动分类（图02）。
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='8');
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>/自动匹配完成/.test(document.querySelector('#classification-review-banner').textContent));
  assert.equal(await page.locator('#stage-panel-review').isHidden(),true,'未生成成果表前不进入表内审核');
  // 生成成果表：只把写盘换成夹具文件，暂存/发布/校验走真实服务端。
  await page.evaluate(target=>{
   window.RfqPathPicker.open=function(options){options.onConfirm({directory:null,name:'示例园区_分类审核成果.xlsx',target:target});return null;};
   window.RfqClassificationReviewHost.write=async(app,result,stagePath,options)=>{
    window.__written=window.RfqClassificationReviewModel.mainSheet(result,{title:options&&options.title});
    window.__seedReview(window.__written.values);
    await window.__writeReviewFixture(stagePath);};
  },reviewTarget);
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  // 只比公开列与空位：K列随行rowId由真实来源路径决定，与离线夹具必然不同。
  assert.deepEqual(await page.evaluate(()=>window.__written.values.map(row=>row.slice(0,10))),
   REVIEW_VALUES.map(row=>row.slice(0,10)),'生成态成果表公开列与R4夹具一致，模拟宿主读到的就是这张表');
  assert.equal(await page.locator('#classification-review-open').isDisabled(),false);
  // 图03：打开成果表审核→侧栏切到第3步，主按钮与文案与图一致。
  await page.locator('#classification-review-open').click();
  await page.waitForFunction(()=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')==='review');
  assert.equal(await page.locator('#stage-panel-review').isHidden(),false);
  assert.equal(await page.locator('#sheet-review-confirm').innerText(),'审核完成，生成分类工作簿','主按钮必须与图03一致');
  assert.equal(await page.locator('#sheet-review-save').innerText(),'保存审核成果');
  assert.match(await page.locator('#sheet-review-progress').innerText(),/当前进度 3 \/ 7 · 正在进行表内审核/);
  await page.waitForFunction(()=>/待修改|可以整表确认/.test(document.querySelector('#sheet-review-stats').textContent));
  assert.match(await page.locator('#sheet-review-stats').innerText(),/8 行/);
  assert.match(await page.locator('#sheet-review-stats').innerText(),/1 处待修改/,'冲突行未填时整表未完成');
  assert.match(await page.locator('#stage-panel-review').innerText(),/不做逐行勾选确认/,'主流程不得要求逐行勾选');
  // R12-C：业务内容与已存确认一致时，两个恢复动作默认隐藏；只有发现业务差异才出现。
  assert.equal(await page.locator('#sheet-review-use-sheet').isHidden(),true);
  assert.equal(await page.locator('#sheet-review-restore-copy').isHidden(),true);
  assert.equal(await page.locator('#sheet-review-use-sheet').innerText(),'选用现表内容（按现表重新确认）');
  assert.equal(await page.locator('#sheet-review-restore-copy').innerText(),'恢复项目草稿到新副本');
  // 整表不完整不放行，并定位到具体单元格；未确认不写项目、不学习。
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('整表未通过校验'));
  assert.match(await page.locator('#sheet-review-issues').innerText(),/最终分类为空/);
  assert.match(await page.locator('#sheet-review-issues').innerText(),new RegExp('第'+CONFLICT_ROW+'行'));
  assert.deepEqual((await page.evaluate(()=>window.__selected[window.__selected.length-1])).slice(0,2),[CONFLICT_ROW,8],
   '必须定位到该行“最终分类”单元格');
  assert.deepEqual(await fs.readdir(projectDirectory).catch(()=>[]),[],'校验未通过不得写项目记录');
  assert.equal((await store.load()).memory.memories.length,0,'未整表确认不得学习');
  // 图03的修改：充电桩配电箱改选“汽车充电桩”，备注“充电桩配套”；保存审核成果只存草稿。
  await page.evaluate(({row})=>{window.__setCell(row,8,'汽车充电桩');window.__setCell(row,9,'充电桩配套');},{row:CONFLICT_ROW});
  await page.locator('#sheet-review-save').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('审核草稿已保存'));
  assert.match(await page.locator('#sheet-review-message').innerText(),/尚未确认、未学习、未生成分类工作簿/);
  const draft=await projectRecord();
  assert.equal(draft.review,null,'草稿不得写成整表确认');
  assert.equal(draft.reviewDraft.state,'draft');
  assert.deepEqual([draft.reviewDraft.counts.rows,draft.reviewDraft.counts.filled],[8,8]);
  assert.equal((await store.load()).memory.memories.length,0,'保存草稿不学习');
  if(SHOT)await page.screenshot({path:SHOT.replace(/\.png$/,'-draft.png'),fullPage:true});
  await dumpEvidence('review-draft.json',draft.reviewDraft);
  const matchWrites=await page.evaluate(()=>window.__cellWrites.filter(item=>item.column===7).map(item=>[item.row,item.value]));
  assert.deepEqual(matchWrites.filter(item=>item[0]===CONFLICT_ROW),[ [CONFLICT_ROW,'存在差异'] ],'草稿阶段把匹配情况刷新为存在差异');
  // 空分类与未知分类都要报出单元格并定位。
  await page.evaluate(({row})=>{window.__setCell(row,8,'');},{row:PUMP_ROW});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-issues').textContent.includes('最终分类为空'));
  assert.match(await page.locator('#sheet-review-issues').innerText(),new RegExp('第'+PUMP_ROW+'行'));
  assert.deepEqual((await page.evaluate(()=>window.__selected[window.__selected.length-1])).slice(0,2),[PUMP_ROW,8]);
  // 2026-10-11 用户要求：库外类别名不再判断为“最终分类无效”，改为确认时按新类别接收（见本文件后面的新类别用例）。
  assert.equal(await page.evaluate(()=>window.__written.layout.validations[0].allowOtherInput),true,
   '最终分类下拉必须允许输入下拉以外的值');
  assert.equal(await page.evaluate(()=>window.__written.layout.validations[0].inCellDropdown),true,'仍保留下拉');
  // 修回正确类别后整表一次确认：先落盘快照，再学习，并进入下一步。
  await page.evaluate(({row})=>{window.__setCell(row,8,'水泵');},{row:PUMP_ROW});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('整表已确认'));
  assert.match(await page.locator('#sheet-review-banner').innerText(),/整表已确认/);
  assert.match(await page.locator('#sheet-review-progress').innerText(),/整表已确认/);
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'categories',
   '整表确认后进入分类工作簿步骤');
  const confirmed=await projectRecord();
  assert.equal(confirmed.review.rows.length,8);
  assert.equal(confirmed.review.counts.consistent,7);
  assert.equal(confirmed.review.counts.different,1);
  assert.equal(confirmed.review.counts.noInquiry,1);
  assert.equal(confirmed.review.rows.filter(row=>row.categoryId==='ev-charger')[0].note,'充电桩配套');
  assert.match(confirmed.review.inputKey,/^ck2-[0-9a-f]{16}$/);
  assert.equal(confirmed.review.revision,1);
  // 项目状态在折叠的辅助功能里，用textContent读取阶段文字（不依赖可见性）。
  assert.match(await page.locator('#project-status').textContent(),/表内审核：已确认/);
  assert.match(await page.locator('#project-status').textContent(),/分类工作簿：未完成/,'分类工作簿属R6，不得误报完成');
  if(options.memoryFailure){
   assert.match(await page.locator('#sheet-review-message').textContent(),/习惯.*未保存/);
   assert.equal((await store.load()).memory.memories.length,0,'习惯写入失败不留下半份数据');
   assert.equal(confirmed.review.rows.length,8,'习惯写入失败不得回滚已保存的整表确认');
   await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
   assert.equal(await page.locator('#sheet-review-memory-retry').isVisible(),true);
   await page.locator('#sheet-review-memory-retry').click();
   await page.waitForFunction(()=>document.querySelector('#sheet-review-memory-retry').hidden);
   assert.equal(memorySaveAttempts,2,'只有明确重试才再次保存习惯');
  }else assert.match(await page.locator('#sheet-review-message').innerText(),/分类习惯已保存/);
  const learned=await store.load();
  const active=()=>learned.memory.memories.filter(record=>record.state==='active');
  assert.equal(active().length,8,'整表确认后按材料学习');
  assert.equal(learned.memory.memories.every(record=>record.sources.length===1),true);
  assert.equal(learned.memory.memories.every(record=>/^p-[a-z0-9-]+$/.test(record.sources[0].sourceProjectId)),true,
   '学习来源必须带稳定项目身份');
  assert.equal(learned.memory.memories.some(record=>record.categoryId==='no-inquiry'),true,'无需询价也按人工决定记录');
  // 重复点击幂等：不新增项目版本、不重复学习。
  const revision=confirmed.revision,memorySnapshot=JSON.stringify(learned.memory);
  await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
  await page.waitForFunction(()=>!document.querySelector('#stage-panel-review').hidden);
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('未重复确认'));
  assert.equal((await projectRecord()).revision,revision,'重复确认不得新增项目版本');
  assert.equal(JSON.stringify((await store.load()).memory),memorySnapshot,'重复确认不得重复学习');
  // R12-C：整表确认后再点“保存审核成果”只存草稿——不改confirmedAt、不新增确认版本、不学习；提示与已保存xlsx区分。
  const beforeDraft=await projectRecord(),beforeDraftMemory=JSON.stringify((await store.load()).memory);
  await page.evaluate(({row})=>{window.__setCell(row,9,'草稿备注');},{row:FAN_ROW});
  await page.locator('#sheet-review-save').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('审核草稿已保存'));
  assert.match(await page.locator('#sheet-review-message').innerText(),/尚未确认、未学习、未生成分类工作簿/,
   '草稿提示必须与“xlsx已保存”区分');
  const afterDraft=await projectRecord();
  assert.equal(afterDraft.review.confirmedAt,beforeDraft.review.confirmedAt,'草稿保存不得改动confirmedAt');
  assert.equal(afterDraft.review.revision,beforeDraft.review.revision,'草稿保存不得新增确认版本');
  assert.equal(JSON.stringify((await store.load()).memory),beforeDraftMemory,'草稿保存不得学习');
  assert.equal(afterDraft.reviewDraft.state,'draft');
  // 草稿改动尚未确认：与已存确认的业务差异必须显示，并给出两个恢复动作。
  assert.match(await page.locator('#sheet-review-banner').innerText(),/不一致/);
  assert.equal(await page.locator('#sheet-review-use-sheet').isVisible(),true);
  assert.equal(await page.locator('#sheet-review-restore-copy').isVisible(),true);
  await page.evaluate(({row})=>{window.__setCell(row,9,'');},{row:FAN_ROW});
 // 清掉草稿改动后，像用户重进“表内审核”那样重新读回一次，侧栏才会按 R12-C 重新比较并回到“整表已确认”。
 await page.locator('#workflow-nav .workflow-step-button[data-stage="matching"]').click();
 await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
 await page.waitForFunction(()=>document.querySelector('#sheet-review-banner').textContent.includes('整表已确认'));
  // 留证：确认后的侧栏（图03）与表内实际值（含按一致/存在差异刷新过的“匹配情况”列）。
  assert.match(await page.locator('#sheet-review-banner').innerText(),/整表已确认/);
  if(SHOT)await page.screenshot({path:SHOT,fullPage:true});
  await dumpEvidence('sheet-review-state.json',await page.evaluate(()=>window.__reviewSnapshot()));
  await dumpEvidence('sheet-review-values.json',await page.evaluate(()=>window.__written.values));
  await dumpEvidence('confirmation.json',(await projectRecord()).review);
  // 改确认：只撤销被改行的来源，其它材料记忆保留；确认快照进入第2次。
  await page.evaluate(({row})=>{window.__setCell(row,8,'阀门');},{row:FAN_ROW});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('整表已确认（8 行）'));
  const changed=await store.load();
  const revoked=changed.memory.memories.filter(record=>record.state==='revoked');
  assert.equal(revoked.length,1,'改确认只撤销被改行');
  assert.equal(revoked[0].item.name,'送风机');
  assert.equal(revoked[0].categoryId,'fan');
  assert.equal(changed.memory.memories.filter(record=>record.state==='active').length,8);
  const reconfirmed=await projectRecord();
  assert.equal(reconfirmed.review.revision,2);
  assert.equal(reconfirmed.review.rows.filter(row=>row.categoryId==='valve').length,3);
  assert.equal(reconfirmed.review.rows.filter(row=>row.categoryId==='fan').length,1);
  // 2026-10-11 用户要求：最终分类允许直接输入库外类别名——确认时按新类别接收，同时进类别库与经验库（同名去重）。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
  await page.waitForFunction(()=>!document.querySelector('#stage-panel-review').hidden);
  const pumpDn50=REVIEW_VALUES.findIndex(row=>row[1]==='水泵'&&row[2]==='DN50')+1;
  assert.equal((await store.load()).library.categories.some(item=>item.name==='临时类别'),false,
   '前置：库里本来没有该类别');
  await page.evaluate(({row})=>{window.__setCell(row,8,'临时类别');},{row:pumpDn50});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('已把新类别加入类别库'));
  assert.match(await page.locator('#sheet-review-message').innerText(),/已把新类别加入类别库/,'侧栏必须明确告知新类别已入库');
  const adopted=await store.load();
  const created=adopted.library.categories.filter(item=>item.name==='临时类别');
  assert.equal(created.length,1,'用户输入的新类别必须同时进类别库，且同名不重复建类');
  assert.equal(created[0].state,'active');
  const adoptedRow=(await projectRecord()).review.rows.filter(row=>row.name==='水泵'&&row.feature==='DN50')[0];
  assert.equal(adoptedRow.categoryName,'临时类别','确认快照保存用户输入的类别名');
  assert.equal(adoptedRow.categoryId,created[0].id,'确认快照使用类别库里的新编号');
  assert.equal(adopted.memory.memories.filter(record=>record.categoryId===created[0].id&&record.state==='active').length,1,
   '新类别同时进入经验库，供下次自动建议使用');
  // 复原为用户原本的选择，后面用例继续按已确认状态走。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
  await page.waitForFunction(()=>!document.querySelector('#stage-panel-review').hidden);
  await page.evaluate(({row})=>{window.__setCell(row,8,'水泵');},{row:pumpDn50});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>{const text=document.querySelector('#sheet-review-message').textContent;
    return text.includes('整表已确认（8 行）')&&!text.includes('已把新类别加入类别库');});
 // 整表确认成功后侧栏会进入下一步（分类工作簿）；409 负例要回到“表内审核”再点整表确认。
 await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
 await page.waitForFunction(()=>!document.querySelector('#stage-panel-review').hidden);
  // R12-C：项目保存冲突(409)——保留表内最新值与已存快照，不覆盖、不学习，并回滚为已存确认。
  const reviewFile=await projectFile(),conflictBase=await projectRecord();
  const memoryBefore409=JSON.stringify((await store.load()).memory);
  const bumped=JSON.parse(JSON.stringify(conflictBase));bumped.revision=conflictBase.revision+5;
  await fs.writeFile(reviewFile,JSON.stringify(bumped,null,2));
  await page.evaluate(({row})=>{window.__setCell(row,8,'水泵');},{row:FAN_ROW});
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>/项目未被覆盖|整表确认未保存/.test(document.querySelector('#sheet-review-message').textContent));
  assert.equal(await page.evaluate(({row})=>String(window.__reviewSnapshot().cells[row+':8']),{row:FAN_ROW}),'水泵',
   '409时表内最新值必须保留');
  assert.match(await page.locator('#sheet-review-banner').innerText(),/不一致/,'409必须回滚为已存确认并提示内容不一致');
  assert.equal((await projectRecord()).review.confirmedAt,conflictBase.review.confirmedAt,'409不得覆盖已存快照');
  assert.equal(JSON.stringify((await store.load()).memory),memoryBefore409,'409不得学习');
  // 复原文件版本与表内值，供后续步骤继续。
  await fs.writeFile(reviewFile,JSON.stringify(conflictBase,null,2));
  await page.evaluate(({row})=>{window.__setCell(row,8,'阀门');},{row:FAN_ROW});
  // F2/D03：现表与有效确认不一致时——第3步必须明确差异、不残留“可以生成”，并阻止按旧确认生成分类工作簿。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="matching"]').click();
  await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-banner').textContent.includes('整表已确认'));
  assert.equal(/可以生成/.test(await page.locator('#sheet-review-progress').innerText()),true,'确认一致时允许生成');
  await page.evaluate(({row})=>{window.__setCell(row,8,'强电');},{row:FAN_ROW});
  await page.locator('#workflow-nav .workflow-step-button[data-stage="matching"]').click();
  await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-banner').textContent.includes('不一致'));
  assert.equal(await page.locator('#sheet-review-banner').innerText(),'成果表内容与已保存确认不一致');
  assert.equal(/可以生成/.test(await page.locator('#sheet-review-progress').innerText()),false,'差异存在时不得残留可以生成');
  assert.match(await page.locator('#sheet-review-progress').innerText(),/不一致/);
  assert.equal(await page.locator('#sheet-review-use-sheet').isVisible(),true,'必须给出按现表重新确认入口');
  assert.equal(await page.locator('#sheet-review-restore-copy').isVisible(),true,'必须给出恢复到新副本入口');
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#workflow-nav .workflow-step-button[data-stage="categories"]').click();
  await page.locator('#categories-generate').click();
  await page.waitForFunction(()=>document.querySelector('#categories-message').textContent.includes('不一致'));
  assert.match(await page.locator('#categories-message').innerText(),/分类工作簿未生成/);
  assert.match(await page.locator('#categories-message').innerText(),/重新整表确认/);
  // 复原表内值，回到与已确认一致的状态继续后面的用例。
  await page.evaluate(({row})=>{window.__setCell(row,8,'阀门');},{row:FAN_ROW});
  // 恢复已确认项目只读回分类，不重复学习、不改写记忆文件。
  const memoryBeforeRestore=await fs.readFile(path.join(root,'library','library-state.json'),'utf8');
  await page.reload();
  await page.locator('#aux-section > summary').click();
  await page.locator('#open-project').click();
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  assert.equal(await fs.readFile(path.join(root,'library','library-state.json'),'utf8'),memoryBeforeRestore,
   '恢复旧项目不得触发新的学习或重写记忆');
  // 旧inputKey：绑定属于旧内容时拒绝确认，不覆盖已保存的确认快照。
  const stale=await projectRecord();
  stale.matching.inputKey='ck2-0000000000000000';
  await fs.writeFile(await projectFile(),JSON.stringify(stale,null,2));
  await page.reload();
  await page.locator('#aux-section > summary').click();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  await page.locator('#workflow-nav .workflow-step-button[data-stage="review"]').click();
  await page.waitForFunction(()=>!document.querySelector('#stage-panel-review').hidden);
  assert.match(await page.locator('#sheet-review-status').innerText(),/旧内容/,'旧绑定必须在侧栏明确提示重新生成');
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('整表确认未完成'));
  assert.match(await page.locator('#sheet-review-message').innerText(),/旧内容/);
  assert.match(await page.locator('#sheet-review-message').innerText(),/重新生成审核成果表/);
  const untouched=await projectRecord();
  assert.equal(untouched.review.rows.length,8,'拒绝时必须保留原确认快照，不拿旧成果表覆盖');
  assert.equal(untouched.review.revision,stale.review.revision,'拒绝时必须保留原确认快照，不拿旧成果表覆盖');
  // 窄侧栏可用，且没有脚本错误。
  await page.setViewportSize({width:340,height:900});
  const narrow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
   clientWidth:document.documentElement.clientWidth,steps:document.querySelectorAll('#workflow-nav .workflow-step').length}));
  assert.equal(narrow.steps,7);
  assert.ok(narrow.scrollWidth<=narrow.clientWidth+1,'窄侧栏不得出现横向滚动：'+JSON.stringify(narrow));
  assert.deepEqual(errors,[]);
  console.log('PASS: 图03表内审核：草稿不确认不学习、整表校验定位单元格、一次确认先落盘再学习、'+
   '重复确认幂等、改确认只撤销该行来源、旧inputKey拒绝且不覆盖已保存快照；'+
   'F2：现表不同于有效确认时报差异、不残留“可以生成”并阻止按旧确认生成分类工作簿；'+
   '2026-10-11：最终分类允许直接输入库外类别名，确认时按新类别入库并学习（同名去重）。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
}
module.exports={run,initScript,DRAIN,MEP,REVIEW_VALUES};
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
