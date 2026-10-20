// R12-C：项目侧栏在SHA之外核对审核成果表业务内容；保存冲突(409)时回滚内存状态。
// 本机无playwright，这里用最小DOM/网络替身直接驱动 project-ui.js，验证与浏览器无关的接线逻辑。
const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');

const SHA=function(ch){return ch.repeat(64);};
const REVIEW_PATH='C:\\成果\\示例园区_分类审核成果.xlsx';

function fakeElement(id){
  return {id:id,textContent:'',className:'',hidden:false,children:[],type:'',value:'',checked:false,
    addEventListener:function(){},appendChild:function(child){this.children.push(child);this.textContent+=child.textContent;},
    cloneNode:function(){return fakeElement(id);},parentNode:null,removeChild:function(){},
    setAttribute:function(){},getAttribute:function(){return null;},focus:function(){}};
}
function boot(){
  const elements={};
  global.window=global.window||{};
  global.document={getElementById:function(id){return elements[id]||(elements[id]=fakeElement(id));},
    createElement:function(tag){return fakeElement(tag);}};
  window.__RFQ_IMPORT__={token:'test-token'};
  const project=require('../src/project.js'),restore=require('../src/project-restore.js'),
    reviewModel=require('../src/classification-review-model.js');
  window.RfqProject=project;global.RfqProject=project;
  window.RfqProjectRestore=restore;global.RfqProjectRestore=restore;
  window.RfqClassificationReviewModel=reviewModel;global.RfqClassificationReviewModel=reviewModel;
  delete require.cache[require.resolve('../src/project-ui.js')];
  require('../src/project-ui.js');
  return {project:project,ui:window.RfqProjectUI,elements:elements};
}
function reviewRows(){
  return [1,2,3,4,5,6,7,8].map(function(index){
    return {rowId:'row-'+index,index:String(index),name:'材料'+index,feature:'规格'+index,unit:'个',quantity:'1',
      autoCategoryName:'不限',categoryId:index===7?'ev-charger':'pump',categoryName:index===7?'汽车充电桩':'水泵',
      skip:false,note:''};});
}
function record(project){
  const col=sample.buildCollection();
  const value=project.create(col,true,{projectId:'p-ui-r12c-0001'});
  value.revision=4;value.name='示例园区';value.mergeIdentical=true;
  value.matching={schemaVersion:1,layoutVersion:2,path:REVIEW_PATH,sha256:SHA('a'),rowIdColumn:12,
    inputKey:'ck2-0123456789abcdef'};
  value.review={schemaVersion:1,sheet:{path:REVIEW_PATH},inputKey:'ck2-0123456789abcdef',
    confirmedAt:'2026-09-27T10:01:15.871Z',revision:1,rows:reviewRows(),counts:{}};
  project.STAGES.forEach(function(stage){value.stages[stage]={state:'ready',revision:4,updatedAt:new Date().toISOString(),detail:'t'};});
  return value;
}
function options(live,extra){
  const col=sample.buildCollection();
  return Object.assign({
    getCollection:function(){return col;},mergeIdentical:function(){return true;},
    getPreview:function(){return null;},getMergeConfirmation:function(){return null;},
    getClassification:function(){return {decisions:[]};},getClassificationRows:function(){return [];},
    getAssignments:function(){return null;},getHeader:function(){return null;},
    getStageVerdicts:function(){return {matching:{ready:true,detail:'ok'},review:{ready:true,detail:'ok'},
      categories:{ready:true,detail:'ok'},brands:{ready:true,detail:'ok'}};},
    getBrandVerdict:function(){return {ready:true,detail:'ok'};},getGenerationVerdict:function(){return {ready:true,detail:'ok'};},
    getSplitVerdict:function(){return {ready:true,detail:'ok'};},
    restore:function(){return true;},restoreClassification:function(){},
    restoreMergeConfirmation:function(){},restoreReviewBinding:function(value){live.matching=value||null;return live.matching;},
    restoreReviewConfirmation:function(value){live.review=value||null;},restoreReviewDraft:function(value){live.draft=value||null;},
    restoreCategories:function(){},restoreSummary:function(){},restoreBrands:function(){},
    restoreAssignments:function(){},restoreHeader:function(){},restoreGeneration:function(){},restoreSplit:function(){},
    getReviewBinding:function(){return live.matching;},getCategories:function(){return null;},
    getSummary:function(){return null;},getBrands:function(){return null;},getGeneration:function(){return null;},
    getSplit:function(){return null;},onBusy:function(){}},extra||{});
}
function installFetch(routes,saves){
  global.fetch=async function(url,init){
    const route=String(url),body=JSON.parse((init&&init.body)||'{}');
    const handler=routes.filter(function(item){return route.indexOf(item.match)>=0;})[0];
    if(!handler)throw Error('未预期的请求：'+route);
    const result=handler.handle(body,route);
    if(result&&result.status&&result.status>=400)
      return {ok:false,status:result.status,json:async function(){return {error:result.error||'错误'};},
        text:async function(){return JSON.stringify({error:result.error||'错误'});}};
    if(route.indexOf('/api/project/save')>=0&&saves)saves.push(body);
    return {ok:true,status:200,json:async function(){return result;},text:async function(){return JSON.stringify(result);}};
  };
}

test('打开完成项目先绑定身份，再恢复拆分；不得为临时身份准备另一批回执',async()=>{
  const {project,ui,elements}=boot(),live={},value=record(project),requests=[];
  const splitPlan=require('../src/split-plan.js'),splitState=require('../src/split-state.js');
  window.RfqSplitPlan=global.RfqSplitPlan=splitPlan;
  window.RfqSplitState=global.RfqSplitState=splitState;
  window.RfqInquiryModel=global.RfqInquiryModel=require('../src/inquiry-model.js');
  delete require.cache[require.resolve('../src/split-ui.js')];require('../src/split-ui.js');
  const model={layoutVersion:2,inputKey:'ck1-restore-split',rowCount:1,sheets:[{sheetId:'sheet-a',kind:'inquiry',
    name:'水泵询价',categoryName:'水泵',brand:'青源',supplier:'华川设备',values:[['序号'],['1']],layout:{headerRow:1}}]};
  value.generation={inputKey:model.inputKey,modelSnapshot:model,target:'C:\\成果\\总询价.xlsx',sha256:SHA('b'),sheetIds:['sheet-a']};
  const plan=splitPlan.build({model,generation:value.generation,targetDirectory:'C:\\成果\\供应商件'});
  value.split=splitState.create(plan,SHA('b'),{projectId:value.projectId,batchId:'b-restore-split',outputDirectory:plan.directory});
  value.split.files.forEach(file=>{value.split=splitState.mark(value.split,file.fileId,'succeeded',SHA('c'));});
  const inspect=new Map([[REVIEW_PATH,SHA('a')],[value.generation.target,SHA('b')],...value.split.files.map(file=>[file.target,SHA('c')])]);
  let panel,generation=null;
  installFetch([
    {match:'/api/project/load',handle:()=>({project:value})},
    {match:'/api/project/restore-copy',handle:body=>({copyPath:body.source.copyPath})},
    {match:'/api/export/inspect',handle:body=>({target:body.target,exists:inspect.has(body.target),sha256:inspect.get(body.target)})},
    {match:'/api/split/prepare',handle:body=>{
      requests.push(body);
      return {plan,canPublish:true,receipt:body.projectId===value.projectId?value.split:
        splitState.create(plan,SHA('b'),{projectId:body.projectId,batchId:body.batchId,outputDirectory:plan.directory})};
    }}],[]);
  const split=window.RfqSplitUI.create({projectId:()=>panel.identity(),generation:()=>generation,context:()=>({inputKey:model.inputKey})});
  panel=ui.create(options(live,{restoreGeneration:value=>{generation=value;},restoreSplit:value=>split.restore(value),
    getGeneration:()=>generation,getSplit:()=>split.receipt(),getSplitVerdict:()=>split.verdict()}));
  assert.equal(await panel.open('p-ui-r12c-0001'),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);
  assert.equal(requests[0].projectId,'p-ui-r12c-0001','拆分准备必须属于刚打开的持久项目，不能用临时身份');
  assert.equal(requests[0].batchId,'b-restore-split','保留成功回执批次，不新建批次');
  assert.equal(split.verdict().ready,true,'已有完整成功回执应恢复为完成');
  assert.equal(elements['split-run'].disabled,false,'拆分准备响应必须成功处理，不能只靠预置回执判ready');
  assert.match(elements['split-status'].textContent,/完成 2 · 失败 0 · 待处理 0$/);
  assert.doesNotMatch(elements['split-message'].textContent,/拆分准备失败/);
  value.projectId='p-ui-r12c-0002';value.split.projectId=value.projectId;value.split.batchId='b-second-split';
  assert.equal(await panel.open('p-ui-r12c-0002'),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests[1].projectId,'p-ui-r12c-0002','从已打开项目切换时也不能沿用上个项目身份');
  assert.equal(requests[1].batchId,'b-second-split');
  assert.equal(split.verdict().ready,true);
  assert.equal(elements['split-run'].disabled,false);
});

test('R12-C：审核成果表SHA相同但业务内容不同——重开不得判为已一致，review不ready',async()=>{
  const {project,ui}=boot(),live={},value=record(project);
  installFetch([
    {match:'/api/project/load',handle:function(){return {project:value};}},
    {match:'/api/project/restore-copy',handle:function(body){return {copyPath:body.source.copyPath};}},
    {match:'/api/export/inspect',handle:function(){return {target:REVIEW_PATH,exists:true,sha256:SHA('a')};}},
    {match:'/api/project/list',handle:function(){return {projects:[]};}}],[]);
  const panel=ui.create(options(live,{compareReviewContent:function(record){
    return {matches:false,source:'disk',differences:[{rowId:'row-7',code:'category-changed',field:'categoryId',
      label:'最终分类',expected:'汽车充电桩',actual:'',
      message:'“材料7”的“最终分类”不一致：确认快照“汽车充电桩”，现表“（空）”'}]};}}));
  assert.equal(await panel.open('p-ui-r12c-0001'),true);
  const audit=panel.restoreAudit();
  assert.equal(audit.ok,false,'内容不同不得恢复ready');
  assert.match(audit.blocks.review,/业务内容/);
  assert.equal(audit.blocks.review.indexOf('磁盘内容')>=0,true,'必须区分磁盘SHA与业务内容');
  assert.equal(audit.relocatable,false);
  assert.equal(panel.assessment().review.ready,false,'内容不一致不得把表内审核判为已确认');
  assert.ok(panel.assessment().review.detail.indexOf('业务内容')>=0,'审核阶段必须带出业务差异说明');
});

test('R12-C：业务内容一致、仅另存改变SHA——刷新物理校验并写回项目',async()=>{
  const {project,ui}=boot(),live={},value=record(project),saves=[];
  installFetch([
    {match:'/api/project/load',handle:function(){return {project:value};}},
    {match:'/api/project/restore-copy',handle:function(body){return {copyPath:body.source.copyPath};}},
    {match:'/api/export/inspect',handle:function(){return {target:REVIEW_PATH,exists:true,sha256:SHA('b')};}},
    {match:'/api/project/save',handle:function(body){return {path:'mock',revision:Number(body.expectedRevision||0)+1};}},
    {match:'/api/project/list',handle:function(){return {projects:[]};}}],saves);
  const panel=ui.create(options(live,{compareReviewContent:function(){
    return {matches:true,source:'disk',differences:[]};}}));
  await panel.open('p-ui-r12c-0001');
  const audit=panel.restoreAudit();
  assert.equal(audit.ok,true);
  assert.equal(audit.physicalRefresh.length,1);
  assert.equal(panel.current().matching.sha256,SHA('b'),'业务一致时按新SHA刷新物理校验');
  assert.equal(saves.length,1,'物理刷新必须写回项目记录');
});

test('R12-C：保存冲突(409)回滚内存中的确认与草稿，已存快照不被覆盖',async()=>{
  const {project,ui}=boot(),live={},saves=[];
  let conflict=false;
  installFetch([
    {match:'/api/project/save',handle:function(body){
      if(conflict)return {status:409,error:'项目已被其他窗口保存'};
      return {path:'mock',revision:Number(body.expectedRevision||0)+1};}},
    {match:'/api/project/list',handle:function(){return {projects:[]};}}],saves);
  const panel=ui.create(options(live,{}));
  assert.ok(await panel.save(),'先正常保存一次，建立当前项目');
  const before={confirmation:panel.reviewConfirmation(),draft:panel.reviewDraft()};
  conflict=true;
  const next={schemaVersion:1,rows:reviewRows(),confirmedAt:'2026-09-27T11:00:00.000Z',revision:2};
  const draft={state:'draft',counts:{rows:8,filled:8,empty:0,notes:0},rows:reviewRows()};
  assert.equal(await panel.commitReview(next,{draft:draft}),null,'409不得返回成功回执');
  assert.equal(panel.reviewConfirmation(),before.confirmation,'409必须回滚确认，不覆盖已存快照');
  assert.equal(panel.reviewDraft(),before.draft,'409必须回滚草稿');
  assert.equal(await panel.commitReviewDraft(draft),null);
  assert.equal(panel.reviewDraft(),before.draft,'草稿保存冲突同样回滚');
});

test('R12-C：草稿保存只写reviewDraft，不改已存确认与confirmedAt',async()=>{
  const {project,ui}=boot(),live={},saves=[];
  installFetch([
    {match:'/api/project/save',handle:function(body){return {path:'mock',revision:Number(body.expectedRevision||0)+1};}},
    {match:'/api/project/list',handle:function(){return {projects:[]};}}],saves);
  const panel=ui.create(options(live,{}));
  assert.ok(await panel.save());
  const confirmation={schemaVersion:1,rows:reviewRows(),inputKey:'ck2-0123456789abcdef',
    confirmedAt:'2026-09-27T10:01:15.871Z',revision:1};
  await panel.commitReview(confirmation,{draft:{state:'draft',counts:{rows:8},rows:reviewRows()}});
  assert.equal(panel.reviewConfirmation().confirmedAt,'2026-09-27T10:01:15.871Z');
  const before=panel.reviewConfirmation();
  const draft2={state:'draft',savedAt:'2026-09-27T11:30:00.000Z',counts:{rows:8,filled:8,empty:0,notes:1},rows:reviewRows()};
  assert.ok(await panel.commitReviewDraft(draft2),'草稿保存成功');
  assert.equal(panel.reviewDraft().savedAt,'2026-09-27T11:30:00.000Z','草稿保存更新草稿');
  assert.equal(panel.reviewConfirmation(),before,'草稿保存不得改动已存确认');
  assert.equal(panel.reviewConfirmation().confirmedAt,'2026-09-27T10:01:15.871Z','confirmedAt保持不变');
});

// F2/D02：物理SHA刷新必须先写回项目记录才算生效；写回失败（409/写错误）时内存SHA与版本一起回滚，
// 内容照旧可用并给出可见重试提示，不能把没保存的新SHA当成当前持久绑定。
for(const failure of [{status:409,error:'项目已被其他窗口保存'},{status:500,error:'项目记录写入失败'}])
test('F2：物理刷新写回失败('+failure.status+')——内存SHA与版本回滚、内容保留、提示重试',async()=>{
  const {project,ui,elements}=boot(),live={},value=record(project),saves=[];
  installFetch([
    {match:'/api/project/load',handle:function(){return {project:value};}},
    {match:'/api/project/restore-copy',handle:function(body){return {copyPath:body.source.copyPath};}},
    {match:'/api/export/inspect',handle:function(){return {target:REVIEW_PATH,exists:true,sha256:SHA('b')};}},
    {match:'/api/project/save',handle:function(){return {status:failure.status,error:failure.error};}},
    {match:'/api/project/list',handle:function(){return {projects:[]};}}],saves);
  const panel=ui.create(options(live,{compareReviewContent:function(){
    return {matches:true,source:'disk',differences:[]};}}));
  assert.equal(await panel.open('p-ui-r12c-0001'),true,'写回失败不得阻断打开，项目内容仍可用');
  const audit=panel.restoreAudit();
  assert.equal(audit.ok,true,'业务内容与已保存审核一致，核对本身仍然通过');
  assert.equal(audit.physicalRefresh.length,1);
  assert.equal(saves.length,0,'失败时没有成功写回');
  assert.equal(panel.current().matching.sha256,SHA('a'),'未写回的新SHA不得留在内存绑定里');
  assert.equal(live.matching.sha256,SHA('a'),'绑定对象同一份内存状态也要回滚');
  assert.equal(panel.current().revision,4,'版本不得递增');
  assert.equal(panel.current().review.rows.length,8,'已保存审核确认快照保留');
  const message=elements['project-message'].textContent;
  assert.match(message,/物理校验/,'必须提示物理校验未写回');
  assert.match(message,/重试/,'必须给出可见的重试提示');
});

// F2/D02：写回成功时版本与SHA同步更新，且只写一次（不重复保存、不改确认快照）。
test('F2：物理刷新写回成功——版本与SHA同步递增、确认快照不变',async()=>{
  const {project,ui,elements}=boot(),live={},value=record(project),saves=[];
  installFetch([
    {match:'/api/project/load',handle:function(){return {project:value};}},
    {match:'/api/project/restore-copy',handle:function(body){return {copyPath:body.source.copyPath};}},
    {match:'/api/export/inspect',handle:function(){return {target:REVIEW_PATH,exists:true,sha256:SHA('b')};}},
    {match:'/api/project/save',handle:function(body){return {path:'mock',revision:Number(body.expectedRevision||0)+1};}},
    {match:'/api/project/list',handle:function(){return {projects:[]};}}],saves);
  const panel=ui.create(options(live,{compareReviewContent:function(){
    return {matches:true,source:'disk',differences:[]};}}));
  assert.equal(await panel.open('p-ui-r12c-0001'),true);
  assert.equal(panel.current().matching.sha256,SHA('b'),'业务一致时按新SHA刷新物理校验');
  assert.equal(panel.current().revision,5,'版本与SHA同步更新');
  assert.equal(saves.length,1,'物理刷新只写一次');
  assert.equal(saves[0].expectedRevision,4);
  assert.equal(saves[0].project.matching.sha256,SHA('b'));
  assert.equal(saves[0].project.review.confirmedAt,'2026-09-27T10:01:15.871Z','确认快照随写回保留');
  assert.equal(/重试/.test(elements['project-message'].textContent),false,'写回成功不得提示重试');
});
