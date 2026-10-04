// Exercise the production import-ui -> project-ui -> review-host restore connection.
// Only DOM, WPS and HTTP are replaced; no business comparison callback is mocked.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const project=require('../src/project.js'),collection=require('../src/collection.js');
const SHA_A='a'.repeat(64),SHA_B='b'.repeat(64),REVIEW_PATH='C:\\fixture\\恢复草稿.xlsx';
const copy=value=>JSON.parse(JSON.stringify(value));

function element(id){
  const listeners={};
  return {id,textContent:'',value:'',checked:false,hidden:false,disabled:false,children:[],parentNode:null,
    classList:{toggle(){}},setAttribute(){},getAttribute(){return null;},focus(){},
    addEventListener(type,handler){listeners[type]=handler;},
    appendChild(child){this.children.push(child);child.parentNode=this;return child;},
    insertBefore(child){return this.appendChild(child);},
    querySelector(){return null;},get options(){return this.children;}};
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
  const {value,rows}=fixture(),elements={},calls=[],saves=[],wpsCalls=[];
  if(config.project)config.project(value);
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
      }else throw Error('Unexpected HTTP boundary: '+route);
      return {ok:true,status:200,json:async()=>result,text:async()=>JSON.stringify(result)};
    }});
  context.window=context;context.__RFQ_IMPORT__={token:'fixture-only'};
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
  return {panel,value,elements,calls,saves,wpsCalls,application};
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
