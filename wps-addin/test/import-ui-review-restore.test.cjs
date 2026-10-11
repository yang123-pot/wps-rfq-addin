// Exercise the production import-ui -> project-ui -> review-host restore connection.
// Only DOM, WPS and HTTP are replaced; no business comparison callback is mocked.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const project=require('../src/project.js'),collection=require('../src/collection.js');
const SHA_A='a'.repeat(64),SHA_B='b'.repeat(64),REVIEW_PATH='C:\\fixture\\恢复草稿.xlsx';
const RESTORE_TARGET='C:\\fixture\\示例园区_分类审核成果_恢复副本.xlsx';
const copy=value=>JSON.parse(JSON.stringify(value));

function element(id){
  return {id,textContent:'',value:'',checked:false,hidden:false,disabled:false,children:[],parentNode:null,
    classList:{toggle(){}},setAttribute(){},getAttribute(){return null;},focus(){},
    addEventListener(type,handler){(this.__listeners=this.__listeners||{})[type]=handler;},
    appendChild(child){this.children.push(child);child.parentNode=this;return child;},
    insertBefore(child){return this.appendChild(child);},
    querySelector(){return null;},get options(){return this.children;}};
}
// 表格内审核面板的按钮只在夹具里点击；handler由生产代码注册，与真实DOM一致。
function click(elements,id){
  const target=elements[id],handler=target&&target.__listeners&&target.__listeners.click;
  assert.equal(typeof handler,'function','缺少 '+id+' 的点击处理器');
  return handler({});
}
function fixture(){
  const col=sample.buildCollection(),preview=collection.preview(col,true);
  // Hand-authored business values. Stable IDs only come from the source fixture.
  const values=[
    ['水泵','DN50','台','2','水泵','pump','水泵'],
    ['水泵','DN65','台','3','水泵','pump','水泵'],
    ['阀门','DN50','个','20','阀门','valve','阀门'],
    ['阀门','DN65','个','12','阀门','valve','阀门'],
    ['送风机','规格A','台','2','风机','fan','风机'],
    ['排风机','规格B','台','3','风机','fan','风机'],
    ['充电桩配电箱','充电桩配套','台','1','待核对','ev-charger','汽车充电桩'],
    ['钢索','规格C','m','10','无需询价','no-inquiry','无需询价']
  ];
  const rows=values.map((v,index)=>({rowId:sample.rowIdOf(preview,v[0],v[1],v[2]),
    index:String(index+1),name:v[0],feature:v[1],unit:v[2],quantity:v[3],
    autoCategoryName:v[4],categoryId:v[5],categoryName:v[6],skip:v[5]==='no-inquiry',
    note:index===6?'草稿备注':''}));
  const value=project.create(col,true,{projectId:'p-ui-draft-sha-0001'});
  const inputKey=project.contentKey({stage:'matching',collection:col,mergeIdentical:true,groups:preview.groups});
  value.revision=5;
  value.mergeKey=project.contentKey({collection:col,mergeIdentical:true,groups:preview.groups});
  value.matching={schemaVersion:1,path:REVIEW_PATH,sha256:SHA_A,sheet:'分类审核成果',
    headerRow:3,firstRow:4,lastRow:11,rowIdColumn:11,inputKey,
    libraryVersion:sample.library.version,categories:sample.library.categories.map(c=>({id:c.id,name:c.name})),
    rowIds:rows.map(r=>r.rowId),fields:rows.map(r=>({rowId:r.rowId,index:r.index,
      name:r.name,feature:r.feature,unit:r.unit,quantity:r.quantity,autoCategoryName:r.autoCategoryName}))};
  value.review=null;
  value.generation=null;
  value.reviewDraft={schemaVersion:1,state:'draft',inputKey,savedAt:'2026-10-03T10:00:00.000Z',
    sheet:{path:'C:\\fixture\\旧审核.xlsx'},counts:{rows:8,filled:8,empty:0,notes:1},rows:copy(rows).reverse()};
  return {value,rows};
}
async function boot(config={}){
  const {value,rows}=fixture(),elements={},calls=[],saves=[],prepares=[],wpsCalls=[];
  if(config.project)config.project(value);
  let workflowOptions=null;
  const sheetRows=copy(rows);
  if(config.sheet)config.sheet(sheetRows);
  const order=config.ascending?sheetRows:sheetRows.reverse();
  const matrix=order.map(r=>[r.index,r.name,r.feature,r.unit,r.quantity,r.autoCategoryName,
    '一致',r.categoryName,r.note,'',r.rowId]);
  if(config.cells)config.cells(matrix);
  const sheet={Cells:{Item(row,column){
    if(config.readFails)throw Error('fixture WPS read failed');
    return {Value2:(matrix[row-4]||[])[column-1]};
  }}};
  const book={FullName:REVIEW_PATH,Worksheets:{Item(){return sheet;}},Activate(){wpsCalls.push('activate');},
    Close(save){wpsCalls.push(['close',save]);}};
  const application={AutomationSecurity:1,ActiveWorkbook:book,
    Workbooks:{Count:config.disk?0:1,Item(){return book;},Open(target,links,readOnly){
      wpsCalls.push(['open',target,links,readOnly]);return book;}}};
  const context=vm.createContext({console,setTimeout,clearTimeout,
    document:{getElementById(id){return elements[id]||(elements[id]=element(id));},
      createElement(tag){return element(tag);}},
    RfqPathPicker:{open(options){options.onConfirm({target:config.restoreTarget||RESTORE_TARGET});}},
    async fetch(url,init){
      const route=String(url),body=JSON.parse(init&&init.body||'{}');calls.push(route);
      let result;
      if(route==='/api/library/load')result={revision:0,library:copy(sample.library),memory:sample.createMemory()};
      else if(route==='/api/header/load')result={revision:0,templates:[]};
      else if(route==='/api/project/load')result={project:copy(value)};
      else if(route==='/api/project/restore-copy')result={copyPath:body.source.copyPath};
      else if(route==='/api/export/inspect')result={target:body.target,exists:true,sha256:config.sameSha?SHA_A:SHA_B};
      else if(route==='/api/project/save'){
        saves.push(copy(body));result={path:'fixture',revision:body.expectedRevision+1};
      }else if(route==='/api/export/prepare'){
        prepares.push(copy(body));result={ticket:'fixture-ticket',stagePath:body.target+'.staging'};
      }else if(route==='/api/export/commit')result={ticket:body.ticket,target:RESTORE_TARGET,sha256:SHA_B,bytes:12000};
      else if(route==='/api/export/verify')result={ok:true,matches:true};
      else if(route==='/api/export/discard')result={ok:true,discarded:true};
      else throw Error('Unexpected HTTP boundary: '+route);
      return {ok:true,status:200,json:async()=>result,text:async()=>JSON.stringify(result)};
    }});
  context.window=context;context.__RFQ_IMPORT__={token:'fixture-only'};
  // 七步导航面板与导入预览一样是与本用例无关的可选界面：这里只捕获阶段切换回调。
  context.RfqWorkflowUI={create(options){workflowOptions=options;
    return {goTo(){},current(){return 'import';},setStats(){},setStageState(){},startRibbonNavigation(){},
      refresh(){}};}};
  const modules={RfqCollection:'collection',RfqProject:'project',RfqProjectRestore:'project-restore',
    RfqClassification:'classification',RfqCategoryLibrary:'category-library',RfqCategoryMemory:'category-memory',
    RfqClassify:'classify',RfqClassificationReviewModel:'classification-review-model',
    RfqClassificationReviewHost:'classification-review-host',RfqCategoryWorkbooks:'category-workbooks',
    RfqInquiryHeader:'inquiry-header',RfqInquiryModel:'inquiry-model',RfqSplitPlan:'split-plan',RfqSplitState:'split-state'};
  for(const [name,file] of Object.entries(modules))context[name]=require('../src/'+file+'.js');
  // Import preview and workflow rendering are independent optional surfaces.
  const uiFiles=['export-ui','project-ui','classification-ui','library-ui','brand-ui','header-ui','inquiry-ui','split-ui','import-ui'];
  for(const file of uiFiles)vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file+'.js'),'utf8'),context,{filename:file+'.js'});
  const createProject=context.RfqProjectUI.create;
  let panel;
  context.RfqProjectUI.create=function(options){panel=createProject(options);return panel;};
  context.RfqImportUI.create({application,onBusy(){},onSelect(){return true;},onRemove(){}});
  await new Promise(resolve=>setImmediate(resolve));
  const opened=await panel.open(value.projectId);
  assert.equal(opened,true,'production restore should open the valid fixture project: '+elements['project-message'].textContent);
  return {panel,value,elements,calls,saves,prepares,wpsCalls,application,context,
    stageChanged(stage){assert.ok(workflowOptions,'import-ui must register a stage-change handler');
      return workflowOptions.onStageChange(stage);}};
}
function assertDraftOnly(result){
  const {panel,value,calls}=result;
  assert.equal(panel.reviewConfirmation(),null,'physical refresh must never confirm a draft');
  assert.deepEqual(copy(panel.reviewDraft()),value.reviewDraft,'saved draft business values and order must stay unchanged');
  assert.equal(panel.assessment().review.ready,false,'an unconfirmed draft must remain unconfirmed');
  for(const field of ['categories','summary','brands','generation','split'])
    assert.equal(panel.current()[field],null,'must not create '+field);
  assert.equal(calls.some(route=>/\/api\/(?:library\/save|export\/(?:prepare|commit)|split\/)/.test(route)),false,
    'restore must not learn, publish or generate');
}

for(const disk of [false,true])test('production restore: same draft business, reordered rows, changed SHA ('+(disk?'disk':'open workbook')+')',async()=>{
  const result=await boot({disk,ascending:true});
  assert.equal(result.panel.restoreAudit().ok,true,'same-input saved draft must authorize physical SHA refresh');
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,1);
  assert.equal(result.panel.current().matching.sha256,SHA_B);
  assert.equal(result.saves.length,1);
  assert.equal(result.saves[0].expectedRevision,5);
  assert.equal(result.saves[0].project.matching.sha256,SHA_B);
  assert.equal(result.saves[0].project.review,null);
  assert.deepEqual(result.saves[0].project.reviewDraft,result.value.reviewDraft);
  assert.equal(result.panel.current().revision,6);
  assert.match(result.elements['project-message'].textContent,/已保存审核内容一致/);
  assertDraftOnly(result);
  if(disk)assert.deepEqual(result.wpsCalls.filter(c=>Array.isArray(c)),[['open',REVIEW_PATH,0,true],['close',false]]);
});

for(const sameSha of [true,false])for(const changed of ['category','note','fixed'])
test('production restore: '+changed+' changed in saved draft is rejected even with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({sameSha,sheet(rows){
    if(changed==='category'){rows[6].categoryId='strong-electric';rows[6].categoryName='强电';}
    if(changed==='note')rows[6].note='表内另改备注';
    if(changed==='fixed')rows[0].quantity='200';
  }});
  assert.equal(result.panel.restoreAudit().ok,false,'business differences must block restore independently of SHA');
  assert.ok(result.panel.restoreAudit().issues.some(i=>i.code==='content-different'));
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
  assert.equal(result.panel.current().matching.sha256,SHA_A);
  assertDraftOnly(result);
});

test('production restore: changed automatic suggestion cannot refresh physical SHA',async()=>{
  const result=await boot({cells(matrix){matrix[0][5]='外部改写建议';}});
  assert.equal(result.panel.restoreAudit().ok,false);
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
});
for(const issue of ['missing','duplicate','unknown'])test('production restore: '+issue+' row ID refuses SHA refresh',async()=>{
  const result=await boot({cells(matrix){matrix[0][10]=issue==='missing'?'':issue==='duplicate'?matrix[1][10]:'foreign-row';}});
  assert.equal(result.panel.restoreAudit().ok,false);
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
});
for(const sameSha of [false,true])for(const key of ['stale','missing','both-stale'])
test('production restore: '+key+' draft inputKey is rejected with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({sameSha,project(value){
    value.reviewDraft.inputKey=key==='missing'?null:'ck2-old-content';
    if(key==='both-stale')value.matching.inputKey='ck2-old-content';
  }});
  assert.equal(result.panel.restoreAudit().ok,false);
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
});
for(const sameSha of [false,true])test('production restore: WPS read failure is rejected with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({readFails:true,sameSha});
  assert.equal(result.panel.restoreAudit().ok,false);
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
});
for(const sameSha of [false,true])for(const broken of ['duplicate','empty-id'])
test('production restore: saved draft with '+broken+' extra row is rejected with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({sameSha,project(value){
    const extra=copy(value.reviewDraft.rows[0]);
    if(broken==='empty-id')extra.rowId='';
    value.reviewDraft.rows.push(extra);
  }});
  assert.equal(result.panel.restoreAudit().ok,false,'corrupt saved row IDs cannot authorize physical refresh');
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
  assertDraftOnly(result);
});
for(const sameSha of [false,true])test('production restore: malformed saved draft row list is rejected with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({sameSha,project(value){value.reviewDraft.rows={broken:true};}});
  assert.equal(result.panel.restoreAudit().ok,false,'comparison failures must not fall back to SHA-only acceptance');
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
  assertDraftOnly(result);
});
for(const sameSha of [false,true])test('production restore: identical unfinished unknown category remains a draft with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({sameSha,project(value){
    const row=value.reviewDraft.rows.find(r=>r.index==='7');row.categoryId='';row.categoryName='未填完的类别';
    value.reviewDraft.counts.filled=7;value.reviewDraft.counts.empty=1;
  },sheet(rows){rows[6].categoryId='';rows[6].categoryName='未填完的类别';}});
  assert.equal(result.panel.restoreAudit().ok,true,'restoring a draft must not require valid whole-sheet classification');
  assert.equal(result.saves.length,sameSha?0:1);
  assertDraftOnly(result);
});
test('production restore: incomplete but business-identical saved draft refreshes without confirming',async()=>{
  const result=await boot({project(value){
    const row=value.reviewDraft.rows.find(r=>r.index==='7');row.categoryId='';row.categoryName='';
    value.reviewDraft.counts.filled=7;value.reviewDraft.counts.empty=1;
  },sheet(rows){rows[6].categoryId='';rows[6].categoryName='';}});
  assert.equal(result.panel.restoreAudit().ok,true,'physical refresh must not require whole-sheet confirmation');
  assert.equal(result.saves.length,1);
  assertDraftOnly(result);
});
for(const sameSha of [false,true])test('production restore: empty draft category changed to unknown text is rejected with '+(sameSha?'same':'changed')+' SHA',async()=>{
  const result=await boot({sameSha,project(value){
    const row=value.reviewDraft.rows.find(r=>r.index==='7');row.categoryId='';row.categoryName='';
    value.reviewDraft.counts.filled=7;value.reviewDraft.counts.empty=1;
  },sheet(rows){rows[6].categoryName='未知的非空类别';}});
  assert.equal(result.panel.restoreAudit().ok,false,'an unknown nonempty category differs from the saved empty draft');
  assert.equal(result.panel.restoreAudit().physicalRefresh.length,0);
  assert.equal(result.saves.length,0);
  assertDraftOnly(result);
});
test('production restore: existing confirmation takes priority over a newer conflicting draft',async()=>{
  const result=await boot({sameSha:true,project(value){
    value.review=Object.assign(copy(value.reviewDraft),{confirmedAt:'2026-10-03T09:00:00.000Z',revision:1});
    value.reviewDraft.rows.find(r=>r.index==='7').note='较新草稿不同';
  }});
  assert.equal(result.panel.restoreAudit().ok,true,'matching confirmation remains the authoritative snapshot');
  assert.equal(result.saves.length,0);
});

// F2/D03：打开项目后直接进入第3步（不重开项目）时，确认与草稿的取舍必须和项目重开一致。
function confirmedProject(value){
  value.review=Object.assign(copy(value.reviewDraft),{confirmedAt:'2026-10-03T09:00:00.000Z',revision:1});
}

test('F2第3步：现表等于有效确认、仅旧草稿不同——不报草稿差异、仍可生成',async()=>{
  const result=await boot({sameSha:true,project(value){
    confirmedProject(value);
    value.reviewDraft.rows.find(r=>r.index==='7').note='旧草稿不同';
  }});
  const {panel,elements}=result;
  result.stageChanged('review');
  assert.equal(elements['sheet-review-banner'].textContent,'整表已确认');
  assert.match(elements['sheet-review-progress'].textContent,/可以生成分类工作簿/);
  assert.equal(elements['sheet-review-use-sheet'].hidden,true,'确认一致时不得提示草稿差异');
  assert.equal(elements['sheet-review-restore-copy'].hidden,true,'确认一致时不得提供草稿恢复入口');
  assert.equal(/草稿/.test(elements['sheet-review-stats'].textContent+elements['sheet-review-status'].textContent),false,
    '旧草稿不覆盖有效确认，不得把草稿差异报给用户');
  assert.equal(panel.assessment().review.ready,true,'确认快照仍是表内审核的依据');
  assert.equal(result.saves.length,0,'只看差异不写项目记录');
});

test('F2第3步：现表不同于有效确认——明确差异、不残留“可以生成”并阻止按旧确认生成',async()=>{
  const result=await boot({sameSha:true,project(value){confirmedProject(value);},
    sheet(rows){rows[6].categoryId='strong-electric';rows[6].categoryName='强电';}});
  const {panel,elements}=result;
  result.stageChanged('review');
  assert.equal(elements['sheet-review-banner'].textContent,'成果表内容与已保存确认不一致');
  assert.equal(/可以生成/.test(elements['sheet-review-progress'].textContent),false,'差异存在时不得残留可以生成');
  assert.equal(elements['sheet-review-use-sheet'].hidden,false,'必须给出按现表重新确认入口');
  assert.equal(elements['sheet-review-restore-copy'].hidden,false,'必须给出恢复项目已确认内容到新副本入口');
  assert.match(elements['sheet-review-status'].textContent,/现表|恢复/);
  assert.equal(panel.assessment().review.ready,false,'业务内容不一致时不得把表内审核判为已确认');
  assert.match(String(panel.assessment().review.detail||''),/业务内容/,'必须带出业务差异说明');
  click(elements,'categories-generate');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(result.calls.includes('/api/export/prepare'),false,'现表与确认不一致时不得按旧确认生成分类工作簿');
  assert.match(elements['categories-message'].textContent,/不一致|差异/);
});

test('F2第3步：仅草稿项目——报出草稿差异、保留恢复入口、不确认不学习',async()=>{
  const result=await boot({sameSha:true,sheet(rows){rows[6].categoryId='strong-electric';rows[6].categoryName='强电';}});
  const {panel,elements}=result;
  result.stageChanged('review');
  assert.equal(panel.reviewConfirmation(),null,'草稿不等于已确认');
  assert.equal(elements['sheet-review-use-sheet'].hidden,false,'草稿项目仍可选用现表重新确认');
  assert.equal(elements['sheet-review-restore-copy'].hidden,false,'草稿项目仍可恢复到新副本');
  assert.match(elements['sheet-review-stats'].textContent+elements['sheet-review-status'].textContent,/审核草稿/);
  assert.equal(/可以生成/.test(elements['sheet-review-progress'].textContent),false,'未整表确认时不得显示可以生成');
  assert.equal(panel.assessment().review.ready,false,'草稿项目保持未确认');
  assertDraftOnly(result);
});

// 宿主写入本身由 host/export 用例覆盖；这里只核“从已确认快照恢复只更新绑定”的接线与提示。
test('F2：从已确认快照恢复副本——只更新绑定、不重复确认、不重复学习、不覆盖当前成果表',async()=>{
  const host=require('../src/classification-review-host.js');
  const result=await boot({sameSha:true,project(value){confirmedProject(value);},
    sheet(rows){rows[6].categoryId='strong-electric';rows[6].categoryName='强电';}});
  const {panel,elements}=result,before=panel.reviewConfirmation();
  const originalWrite=host.write,writes=[];
  host.write=async function(application,model,stagePath,options){writes.push({model,stagePath,options});};
  try{
    result.stageChanged('review');
    assert.equal(elements['sheet-review-restore-copy'].hidden,false);
    await click(elements,'sheet-review-restore-copy');
  }finally{host.write=originalWrite;}
  assert.equal(writes.length,1,'只写一次新副本');
  assert.equal(writes[0].model.rows.find(row=>row.rowId===before.rows.find(r=>r.index==='7').rowId)
    .finalCategoryName,'汽车充电桩','写的是项目已确认内容，不是现表“强电”');
  assert.equal(result.prepares.length,1);
  assert.equal(result.prepares[0].target,RESTORE_TARGET);
  assert.match(elements['sheet-review-message'].textContent,/未覆盖/);
  assert.match(elements['sheet-review-message'].textContent,/无需重复确认/);
  assert.equal(panel.reviewConfirmation(),before,'恢复副本不得改写已保存确认快照');
  assert.equal(result.calls.some(route=>route==='/api/library/save'),false,'恢复副本不得重新学习');
  assert.equal(result.saves.length,0,'恢复副本只切绑定，不写项目记录');
});
