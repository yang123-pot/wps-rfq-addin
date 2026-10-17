// R11：项目重开先核持久文件路径/SHA；缺失或外部改写不恢复ready；整目录搬移后可核内容重新定位。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const OLD_ROOT='C:\\old\\示例园区',NEW_ROOT='E:\\moved\\示例园区';
const SHA=function(ch){return ch.repeat(64);};
const SHOT=process.env.RFQ_UI_PROJECT_RESTORE_SCREENSHOT,EVIDENCE=process.env.RFQ_UI_PROJECT_RESTORE_EVIDENCE;
async function run(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-project-restore-'));
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',function(error){errors.push(error.message);});
  await page.addInitScript(function(args){
   const emptySheet={Name:'Sheet1',UsedRange:{Row:1,Column:1,Rows:{Count:1},Columns:{Count:1},Value2:[[1]]}};
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Worksheets:{Count:1,Item(){return emptySheet;}},
    Activate(){window.Application.ActiveWorkbook=this;}};
   window.Application={ActiveWorkbook:previous,AutomationSecurity:1,Workbooks:{Count:1,Item(){return previous;}},
    GetSaveAsFilename(){throw Error('R11不应调用系统另存');},GetOpenFilename(){throw Error('R11不应调用系统打开');}};
   window.__inspect=Object.assign({},args.inspect);window.__saves=[];
   const nativeFetch=window.fetch;
   window.fetch=async function(url,options){
    const route=String(url);
    if(route.indexOf('/api/export/inspect')>=0){
     const body=JSON.parse(options.body||'{}'),value=window.__inspect[body.target]||{exists:false,sha256:null};
     return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
    }
    if(route.indexOf('/api/project/load')>=0){
     return new Response(JSON.stringify({project:window.__project}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(route.indexOf('/api/project/save')>=0){
     const body=JSON.parse(options.body||'{}');window.__saves.push(body);
     return new Response(JSON.stringify({path:'mock',revision:Number(body.expectedRevision||0)+1}),{status:200,
      headers:{'content-type':'application/json'}});
    }
    if(route.indexOf('/api/project/list')>=0)
     return new Response(JSON.stringify({projects:[]}),{status:200,headers:{'content-type':'application/json'}});
    return nativeFetch.apply(null,arguments);
   };
  },{project:null,inspect:{}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  await page.evaluate(function(args){
   ['save-project','open-project','refresh-projects','relocate-project','project-message','project-status','project-list']
    .forEach(function(id){const old=document.getElementById(id),clone=old.cloneNode(true);old.parentNode.replaceChild(clone,old);});
   const p=window.RfqProject.create({entries:[]},true,{projectId:'p-restore-ui-01'});
   p.revision=3;p.name='恢复样例';p.matching={schemaVersion:1,path:args.oldRoot+'\\示例园区_分类审核成果.xlsx',
    sha256:args.shas.review,inputKey:'ck2-restore'};
   p.review={schemaVersion:1,sheet:{path:p.matching.path},rows:[{rowId:'r1'}]};
   p.categories={schemaVersion:1,inputKey:'ck2-restore',root:args.oldRoot,directory:args.oldRoot+'\\分类工作簿',
    files:[{fileId:'f1',name:'水泵.xlsx',path:args.oldRoot+'\\分类工作簿\\水泵.xlsx',sha256:args.shas.category,status:'succeeded'}]};
   p.summary={schemaVersion:1,path:args.oldRoot+'\\分类汇总表.xlsx',sha256:args.shas.summary,
    directory:args.oldRoot,categoryDirectory:args.oldRoot+'\\分类工作簿'};
   p.brands={schemaVersion:1,summaryPath:p.summary.path,categories:[]};
   p.generation={schemaVersion:1,target:args.oldRoot+'\\示例园区_询价总表.xlsx',sha256:args.shas.generation,
    sheetIds:['sheet-pump-1'],modelSnapshot:{sheets:[{sheetId:'sheet-pump-1',kind:'inquiry'}]}};
   p.split={schemaVersion:1,projectId:p.projectId,batchId:'b-restore-ui-01',inputKey:'ck2-restore',
    generationSha256:args.shas.generation,outputDirectory:args.oldRoot+'\\询价输出',revision:1,
    files:[{fileId:'s1',name:'水泵_华川设备.xlsx',target:args.oldRoot+'\\询价输出\\水泵_华川设备.xlsx',
     state:'succeeded',sha256:args.shas.split}]};
   window.RfqProject.STAGES.forEach(function(stage){p.stages[stage]={state:'ready',revision:3,updatedAt:new Date().toISOString(),detail:'restore check'};});
   window.__project=p;
   const live={};
   window.__projectPanel=window.RfqProjectUI.create({
    getCollection:function(){return {entries:[]};},mergeIdentical:function(){return true;},getPreview:function(){return null;},
    getMergeConfirmation:function(){return null;},getClassification:function(){return {decisions:[]};},
    getClassificationRows:function(){return [];},getAssignments:function(){return null;},getHeader:function(){return null;},
    getStageVerdicts:function(){return {matching:{ready:true,detail:'ok'},review:{ready:true,detail:'ok'},
     categories:{ready:true,detail:'ok'},brands:{ready:true,detail:'ok'}};},
    getBrandVerdict:function(){return {ready:true,detail:'ok'};},getGenerationVerdict:function(){return {ready:true,detail:'ok'};},
    getSplitVerdict:function(){return {ready:true,detail:'ok'};},
    restore:function(){return true;},restoreClassification:function(){},
    restoreMergeConfirmation:function(value){live.mergeKey=value;},restoreReviewBinding:function(value){live.matching=value;},
    restoreReviewConfirmation:function(){},restoreReviewDraft:function(){},restoreCategories:function(value){live.categories=value;},
    restoreSummary:function(value){live.summary=value;},restoreBrands:function(value){live.brands=value;},
    restoreAssignments:function(){},restoreHeader:function(){},restoreGeneration:function(value){live.generation=value;},
    restoreSplit:function(value){live.split=value;},getReviewBinding:function(){return live.matching;},
    compareReviewContent:function(){return window.__reviewContent||null;},
    getCategories:function(){return live.categories;},getSummary:function(){return live.summary;},
    getBrands:function(){return live.brands;},getGeneration:function(){return live.generation;},getSplit:function(){return live.split;},
    onBusy:function(){}});
   window.RfqPathPicker.open=function(options){options.onConfirm([args.newRoot]);return {close(){}};};
  },{oldRoot:OLD_ROOT,newRoot:NEW_ROOT,shas:{review:SHA('a'),category:SHA('b'),summary:SHA('c'),generation:SHA('d'),split:SHA('e')}});
  // R12-C：审核成果表SHA与记录一致、但业务内容与确认快照不同（图03 H11磁盘空/快照汽车充电桩）时，
  // 不得把“表内审核”恢复为已确认；必须报出业务差异、区分磁盘内容，且不能靠换目录冒充一致。
  await page.evaluate(function(args){
   const map={};map[args.oldRoot+'\\示例园区_分类审核成果.xlsx']={exists:true,sha256:args.shas.review};
   window.__inspect=map;
   window.__reviewContent={matches:false,source:'disk',differences:[{rowId:'r-ev',code:'category-changed',
    field:'categoryId',label:'最终分类',expected:'汽车充电桩',actual:'',
    message:'“充电桩配电箱”的“最终分类”不一致：确认快照“汽车充电桩”，现表“（空）”'}]};
  },{oldRoot:OLD_ROOT,shas:{review:SHA('a')}});
  await page.evaluate(function(){return window.__projectPanel.open('p-restore-ui-01');});
  const r12cAudit=await page.evaluate(function(){return window.__projectPanel.restoreAudit();});
  assert.match(r12cAudit.blocks.review,/业务内容/,'SHA相同但业务不同时必须报业务差异');
  assert.match(r12cAudit.blocks.review,/磁盘内容/,'必须区分磁盘SHA与业务内容');
  assert.equal(r12cAudit.issues.filter(function(item){return item.code==='content-different';}).length,1);
  assert.equal(await page.evaluate(function(){return window.__projectPanel.assessment().review.ready;}),false,
   '业务内容不一致不得把表内审核恢复为ready');
  await page.evaluate(function(){window.__reviewContent={matches:true,source:'disk',differences:[]};});
  // 先模拟汇总表被外部改写：可以打开项目继续看填写内容，但品牌/询价/拆分不得恢复ready。
  await page.evaluate(function(args){
   const map={};map[args.oldRoot+'\\示例园区_分类审核成果.xlsx']={exists:true,sha256:args.shas.review};
   map[args.oldRoot+'\\分类工作簿\\水泵.xlsx']={exists:true,sha256:args.shas.category};
   map[args.oldRoot+'\\分类汇总表.xlsx']={exists:true,sha256:'9'.repeat(64)};
   map[args.oldRoot+'\\示例园区_询价总表.xlsx']={exists:true,sha256:args.shas.generation};
   map[args.oldRoot+'\\询价输出\\水泵_华川设备.xlsx']={exists:true,sha256:args.shas.split};
   window.__inspect=map;window.RfqProjectUI.open;
  },{oldRoot:OLD_ROOT,shas:{review:SHA('a'),category:SHA('b'),generation:SHA('d'),split:SHA('e')}});
  await page.evaluate(function(){return window.__projectPanel.open('p-restore-ui-01');});
  let audit=await page.evaluate(function(){return window.__projectPanel.restoreAudit();});
  assert.match(audit.blocks.brands,/外部修改/);
  assert.equal(await page.evaluate(function(){return window.__projectPanel.assessment().brands.ready;}),false);
  assert.match(await page.evaluate(function(){return document.getElementById('project-status').textContent;}),/恢复核对/);
  // 再模拟整目录搬移：旧路径全缺失，新路径内容SHA一致；点“重新定位项目文件”后保存并恢复ready。
  await page.evaluate(function(args){
   const map={},paths=[
    '\\示例园区_分类审核成果.xlsx','\\分类工作簿\\水泵.xlsx','\\分类汇总表.xlsx',
    '\\示例园区_询价总表.xlsx','\\询价输出\\水泵_华川设备.xlsx'];
   const shas=[args.shas.review,args.shas.category,args.shas.summary,args.shas.generation,args.shas.split];
   paths.forEach(function(relative,index){map[args.oldRoot+relative]={exists:false,sha256:null};
    map[args.newRoot+relative]={exists:true,sha256:shas[index]};});
   window.__inspect=map;
  },{oldRoot:OLD_ROOT,newRoot:NEW_ROOT,shas:{review:SHA('a'),category:SHA('b'),summary:SHA('c'),generation:SHA('d'),split:SHA('e')}});
  await page.evaluate(function(){return window.__projectPanel.open('p-restore-ui-01');});
  audit=await page.evaluate(function(){return window.__projectPanel.restoreAudit();});
  assert.equal(audit.relocatable,true);
  assert.equal(await page.evaluate(function(){return document.getElementById('relocate-project').hidden;}),false,
   '可重新定位时必须显示按钮');
  await page.evaluate(function(){document.getElementById('relocate-project').click();});
  await page.waitForFunction(function(){return window.__saves.length>=1&&window.__projectPanel.restoreAudit()&&
   window.__projectPanel.restoreAudit().ok===true;});
  assert.match(await page.evaluate(function(){return window.__projectPanel.current().summary.path;}),/^E:\\moved\\示例园区/);
  assert.equal(await page.evaluate(function(){return window.__projectPanel.current().split.files[0].target;}),NEW_ROOT+'\\询价输出\\水泵_华川设备.xlsx');
  if(SHOT){await fs.mkdir(path.dirname(SHOT),{recursive:true});
   await page.evaluate(function(){document.getElementById('aux-section').open=true;
    document.getElementById('project-section').scrollIntoView({block:'start'});});
   await page.screenshot({path:SHOT,fullPage:true});}
  if(EVIDENCE){await fs.mkdir(EVIDENCE,{recursive:true});
   await fs.writeFile(path.join(EVIDENCE,'project-restore.json'),JSON.stringify(
    await page.evaluate(function(){return {audit:window.__projectPanel.restoreAudit(),
     current:window.__projectPanel.current(),message:document.getElementById('project-message').textContent,
     status:document.getElementById('project-status').textContent};}),null,2));}
  assert.deepEqual(errors,[]);
  console.log('PASS(R11)：项目重开逐阶段核路径/SHA，外部改写与缺失不恢复ready；整目录搬移后逐项核内容并保存新绑定。');
 }finally{
  await browser.close();
  await new Promise(resolve=>{server.close(resolve);if(typeof server.closeAllConnections==='function')server.closeAllConnections();});
  await fs.rm(root,{recursive:true,force:true});
 }
}
run().catch(function(error){console.error(error);process.exitCode=1;});
