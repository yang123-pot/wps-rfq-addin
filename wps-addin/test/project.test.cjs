const test=require('node:test'),assert=require('node:assert/strict');
const collection=require('../src/collection.js'),project=require('../src/project.js'),review=require('../src/review.js');
function input(name,fingerprint,qty){
 const path='C:\\samples\\'+name,values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['000123','水管','DN50','m',qty]];
 return {metadata:{originalPath:path,originalName:name,copyPath:'C:\\copies\\'+name,fingerprint},snapshot:{name,path,fingerprint,sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
}
function fixture(){return collection.add(collection.create(),[input('a.xlsx','a'.repeat(64),'0.1'),input('b.xlsx','b'.repeat(64),'0.2')]);}
function rowsOf(col,merge){return project.rowsFromPreview(collection.preview(col,merge));}
function legacyRecord(overrides){
 const sources=fixture().entries.map(function(entry){
  return {id:entry.id,originalPath:entry.metadata.originalPath,originalName:entry.metadata.originalName,
   copyPath:entry.metadata.copyPath,fingerprint:entry.metadata.fingerprint,sheetCount:1,materialCount:1,issueCount:0};
 });
 const stages={};
 ['import','review','merge','classification','brand','generation','split'].forEach(function(stage,index){
  stages[stage]={state:index===0?'ready':'missing',revision:index===0?1:null,updatedAt:null,detail:null};});
 return Object.assign({schemaVersion:1,projectId:'p-legacy01',name:'a',createdAt:'2026-09-25T00:00:00.000Z',
  updatedAt:'2026-09-25T00:00:00.000Z',revision:1,mergeIdentical:false,stages:stages,sources:sources,
  mergeKey:null,review:null,classification:null,assignments:null,header:null,generation:null,split:null,history:[]},overrides||{});
}
test('creates a v2 project from a collection with fingerprints and 7 real stages',()=>{
 const created=project.create(fixture(),true);
 assert.equal(project.SCHEMA_VERSION,2);
 assert.equal(created.schemaVersion,2);assert.match(created.projectId,/^[a-z0-9-]{8,64}$/);
 assert.equal(created.revision,0);assert.equal(created.mergeIdentical,true);assert.equal(created.name,'a');
 assert.equal(created.fromProjectId,null);
 assert.deepEqual(project.STAGES,['import','matching','review','categories','brands','inquiry','split']);
 assert.deepEqual(project.STAGE_LABELS,{import:'导入与合并',matching:'自动分类',review:'表内审核',
  categories:'分类工作簿',brands:'品牌汇总',inquiry:'询价表',split:'拆分文件'});
 assert.equal(created.sources.length,2);assert.equal(created.sources[0].fingerprint,'a'.repeat(64));
 assert.equal(created.sources[0].scopeId,'combined','合并模式下来源边界为combined');
 assert.ok(created.sources[0].snapshot);
 project.STAGES.forEach(function(stage){assert.equal(project.stageState(created,stage),'missing',stage);});
 assert.deepEqual(project.validate(created),{ok:true,errors:[]});
 const separate=project.create(fixture(),false);
 assert.equal(separate.sources[0].scopeId,'c:/samples/a.xlsx','分别保留时来源边界保留到簿');
});
test('confirm then invalidate marks the owning stage missing and all downstream stages stale',()=>{
 let current=project.create(fixture(),false);
 project.STAGES.forEach(function(stage){current=project.confirm(current,stage,{note:stage});});
 assert.equal(project.stageState(current,'brands'),'ready');
 const next=project.invalidate(current,{kind:'review',detail:'改了一条最终分类'});
 assert.equal(next.revision,current.revision,'内容变化不改持久化版本号，版本由保存成功时递增');
 assert.equal(project.stageState(next,'import'),'ready');assert.equal(project.stageState(next,'matching'),'ready');
 assert.equal(project.stageState(next,'review'),'missing');
 for(const stage of ['categories','brands','inquiry','split'])assert.equal(project.stageState(next,stage),'stale');
 assert.equal(next.history.length,1);assert.equal(next.history[0].kind,'review');
 assert.equal(project.stageState(current,'review'),'ready','原对象不得被改动');
 assert.equal(project.stageState(project.invalidate(current,{kind:'source'}),'matching'),'stale','来源变化使匹配及之后过期');
 assert.equal(project.stageState(project.invalidate(current,{kind:'header'}),'inquiry'),'missing');
 assert.equal(project.stageState(project.invalidate(current,{kind:'header'}),'brands'),'ready','抬头变化不影响品牌汇总');
 assert.equal(project.stageState(project.invalidate(current,{kind:'header'}),'split'),'stale');
 const fresh=project.invalidate(project.create(fixture(),false),{kind:'brands'});
 assert.equal(project.stageState(fresh,'import'),'missing');assert.equal(project.stageState(fresh,'inquiry'),'missing','从未确认的阶段仍为缺失');
 assert.throws(function(){project.invalidate(current,{kind:'unknown'});},/无法识别/);
 assert.throws(function(){project.confirm(current,'unknown');},/无法识别/);
});
test('validation reports missing fields, bad fingerprints and unsupported versions',()=>{
 const good=project.create(fixture(),false);
 assert.match(project.validate({...good,schemaVersion:99}).errors.join('；'),/版本/);
 assert.match(project.validate({...good,projectId:'x'}).errors.join('；'),/编号/);
 const broken={...good,sources:[{...good.sources[0],fingerprint:'zz'}]};
 assert.match(project.validate(broken).errors.join('；'),/指纹/);
 const missing={...good};delete missing.stages;
 assert.match(project.validate(missing).errors.join('；'),/阶段/);
 assert.match(project.validate({...good,fromProjectId:'bad'}).errors.join('；'),/上游项目编号/);
 assert.equal(project.validate({}).ok,false);
 assert.throws(function(){project.assertValid({});},/项目记录/);
 const legacy=legacyRecord();
 assert.equal(project.validate(legacy).ok,true,'v1记录仍可读取');
 assert.equal(project.isLegacy(legacy),true);assert.equal(project.schemaOf(legacy),1);
 assert.equal(project.isLegacy(good),false);assert.equal(project.schemaOf(good),2);
});
test('compares stored sources against the current collection',()=>{
 const stored=project.create(fixture(),false);
 const changed=collection.add(collection.create(),[input('a.xlsx','c'.repeat(64),'0.1'),input('b.xlsx','b'.repeat(64),'0.2')]);
 assert.deepEqual(project.compareSources(stored,changed).changed,['C:\\samples\\a.xlsx']);
 assert.deepEqual(project.compareSources(stored,changed).removed,[]);
 const removed=collection.add(collection.create(),[input('b.xlsx','b'.repeat(64),'0.2')]);
 assert.deepEqual(project.compareSources(stored,removed).removed,['C:\\samples\\a.xlsx']);
 const added=collection.add(collection.create(),[input('a.xlsx','a'.repeat(64),'0.1'),input('b.xlsx','b'.repeat(64),'0.2'),input('c.xlsx','c'.repeat(64),'1')]);
 assert.deepEqual(project.compareSources(stored,added).added,['C:\\samples\\c.xlsx']);
});
test('refresh keeps the project id and invalidates from import when sources or the merge choice change',()=>{
 const base=project.create(fixture(),false);
 const unchanged=project.refresh(base,fixture(),false);
 assert.equal(unchanged.projectId,base.projectId);assert.equal(unchanged.revision,base.revision);
 assert.equal(unchanged.history.length,0);
 const changed=project.refresh(base,collection.add(collection.create(),[input('a.xlsx','c'.repeat(64),'0.1'),input('b.xlsx','b'.repeat(64),'0.2')]),false);
 assert.equal(changed.projectId,base.projectId);
 assert.equal(project.stageState(changed,'import'),'missing');
 assert.equal(changed.history[0].kind,'source');assert.match(changed.history[0].detail,/来源变化/);
 assert.equal(changed.sources[0].fingerprint,'c'.repeat(64));
 const merged=project.refresh(base,fixture(),true);
 assert.equal(merged.mergeIdentical,true);assert.equal(project.stageState(merged,'import'),'missing');
 assert.match(merged.history[0].detail,/精确合并/);
 assert.equal(merged.sources[0].scopeId,'combined','合并选择变化时必须同步来源边界');
 assert.throws(function(){project.refresh(legacyRecord(),fixture(),false);},/旧版|v1/,'v1项目必须走继续副本，不能直接改写');
});
test('contentKey is a stable v2 business snapshot key that ignores UI, time and in-sheet sorting',()=>{
 const base=fixture(),groups=rowsOf(base,false);
 const key=project.contentKey({collection:base,mergeIdentical:false,groups:groups});
 assert.match(key,/^ck2-[0-9a-f]{16}$/);
 assert.equal(project.contentKey({collection:base,mergeIdentical:false,groups:groups.slice().reverse()}),key,
  '成果表内排序不得改变业务键');
 assert.equal(project.contentKey({collection:base,mergeIdentical:false,groups:groups,filter:'pending',
  updatedAt:'2026-09-26T00:00:00.000Z',receipt:{target:'C:\\out\\a.xlsx'}}),key,'界面筛选、时间与回执字段不得进入内容键');
 assert.notEqual(project.contentKey({collection:base,mergeIdentical:true,groups:groups}),key,'合并模式影响输出');
 assert.notEqual(project.contentKey({collection:{entries:base.entries.slice().reverse()},mergeIdentical:false,groups:groups}),key,
  '来源顺序影响输出，必须进入内容键');
 const edited=groups.map(function(row,index){return index?row:Object.assign({},row,{quantity:'9'});});
 assert.notEqual(project.contentKey({collection:base,mergeIdentical:false,groups:edited}),key,'材料工程量必须进入内容键');
 const decisions=groups.map(function(row){return {rowId:row.rowId,categoryId:'water-valve',categoryName:'水阀门',skip:false};});
 assert.equal(key,project.contentKey({collection:base,mergeIdentical:false,groups:groups,review:{rows:decisions}}),
  '导入阶段键不包含分类确认');
 const reviewKey=project.contentKey({stage:'review',collection:base,mergeIdentical:false,groups:groups,review:{rows:decisions}});
 assert.notEqual(reviewKey,project.contentKey({stage:'review',collection:base,mergeIdentical:false,groups:groups,review:{rows:[]}}));
 assert.equal(reviewKey,project.contentKey({stage:'review',collection:base,mergeIdentical:false,groups:groups,
  review:{schemaVersion:9,rows:decisions,updatedAt:'2027-01-01T00:00:00.000Z'}}),'确认时间与记录版本变化不影响内容键');
 const brands=[{categoryId:'water-valve',mode:'combined',groups:[{brand:'某品牌',supplier:'某供应商'}]}];
 const inquiryKey=project.contentKey({stage:'inquiry',collection:base,mergeIdentical:false,groups:groups,review:{rows:decisions},
  brands:brands,header:{projectName:'测试楼'}});
 assert.notEqual(inquiryKey,project.contentKey({stage:'inquiry',collection:base,mergeIdentical:false,groups:groups,
  review:{rows:decisions},brands:brands}),'抬头影响询价键');
 const report=project.assess({collection:base,mergeIdentical:false,preview:collection.preview(base,false),groups:groups,
  mergeConfirmedKey:key,review:{rows:decisions},brands:brands,header:{projectName:'测试楼'}});
 assert.equal(report.brandKey,reviewKey,'品牌表上游键只含清单、合并与分类确认');
 assert.equal(report.generationKey,inquiryKey,'生成与拆分键再加入品牌与抬头');
});
// 2026-10-11（图04/05变更“一本多页”）：分类/汇总阶段的业务键＝1 文件＋逐页行数（含第 1 页汇总页），
// 文件或任一页行数变化都必须换键（让汇总与下游过期），只改界面/格式不得换键。
test('一本多页业务键：1文件＋逐页行数（含汇总页），文件或任一页行数变化即换键',()=>{
 const base=fixture(),groups=rowsOf(base,false);
 const sheets=[{sheetName:'分类汇总表',rowCount:9},{sheetName:'水泵',rowCount:2},{sheetName:'阀门',rowCount:2}];
 const keyOf=(file,list)=>project.contentKey({stage:'categories',collection:base,mergeIdentical:false,groups:groups,
  review:{ready:true},output:{file:file,sheets:list}});
 const dataKey=keyOf('示例园区_分类工作簿.xlsx',sheets);
 assert.match(dataKey,/^ck2-[0-9a-f]{16}$/);
 assert.equal(keyOf('示例园区_分类工作簿.xlsx',sheets.map(sheet=>Object.assign({},sheet))),dataKey,
  '相同页行数（对象副本、无关字段）必须同键');
 assert.equal(keyOf('示例园区_分类工作簿.xlsx',sheets.map(sheet=>({name:sheet.sheetName,rowCount:sheet.rowCount}))),dataKey,
  '页名/行数相同、字段写法不同不得换键');
 assert.notEqual(keyOf('示例园区_分类工作簿.xlsx',sheets.map((sheet,index)=>index?sheet:Object.assign({},sheet,{rowCount:10}))),
  dataKey,'第 1 页（汇总页）行数变化必须换键');
 assert.notEqual(keyOf('示例园区_分类工作簿.xlsx',sheets.map((sheet,index)=>index===2?Object.assign({},sheet,{rowCount:3}):sheet)),
  dataKey,'任一类别页行数变化必须换键');
 assert.notEqual(keyOf('别的_分类工作簿.xlsx',sheets),dataKey,'换文件必须换键');
 assert.notEqual(keyOf('示例园区_分类工作簿.xlsx',sheets.slice(0,2)),dataKey,'少一页必须换键');
 const preview=collection.preview(base,false),bare=project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups});
 const common={collection:base,mergeIdentical:false,preview:preview,groups:groups,mergeConfirmedKey:bare.mergeKey,
  matching:{ready:true},review:{ready:true}};
 const output={ready:true,file:'示例园区_分类工作簿.xlsx',sheets:sheets};
 const report=project.assess(Object.assign({},common,{categories:output}));
 assert.equal(report.categoriesKey,dataKey,'assess 的分类键必须按同口径计算');
 assert.equal(report.summaryKey,project.contentKey({stage:'summary',collection:base,mergeIdentical:false,groups:groups,
  review:{ready:true},output:{file:'示例园区_分类工作簿.xlsx',sheets:sheets}}),'汇总阶段用同一份1文件＋逐页行数');
 assert.equal(report.brandsKey,project.contentKey({stage:'brands',collection:base,mergeIdentical:false,groups:groups,
  review:{ready:true}}),'分类工作簿的页行数不进入品牌阶段键');
 const changed=project.assess(Object.assign({},common,{categories:Object.assign({},output,
  {sheets:sheets.map((sheet,index)=>index===2?Object.assign({},sheet,{rowCount:3}):sheet)})}));
 assert.notEqual(changed.categoriesKey,report.categoriesKey);
 assert.notEqual(changed.summaryKey,report.summaryKey);
 assert.deepEqual(project.normalizeOutput({file:'a.xlsx',sheets:[{sheetName:'分类汇总表',rowCount:9},{name:'水泵',rowCount:2}]}),
  {file:'a.xlsx',sheets:[{name:'分类汇总表',rowCount:9},{name:'水泵',rowCount:2}]},'页名字段兼容 sheetName/name');
});
test('stage readiness comes from real content, never from a non-empty field',()=>{
 const base=fixture(),preview=collection.preview(base,false),groups=rowsOf(base,false);
 const bare=project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups});
 assert.equal(bare.import.ready,false,'没有明确确认本次合并选择时导入阶段不得完成');
 assert.equal(bare.matching.ready,false);
 const merged=project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups,mergeConfirmedKey:bare.mergeKey});
 assert.equal(merged.import.ready,true);
 const reviewedPreview=Object.assign({},preview,{issues:[{code:'source-unresolved'}],canFinalize:true,
  reviewIssueCount:1,blockingIssueCount:0});
 const reviewed=project.assess({collection:base,mergeIdentical:false,preview:reviewedPreview,groups:groups,
  mergeConfirmedKey:bare.mergeKey});
 assert.equal(reviewed.import.ready,true,'已明确确认的来源/区段提示不得在重算时阻断导入');
 assert.match(reviewed.import.detail,/1条来源\/区段提示已确认/);
 assert.equal(merged.matching.ready,false,'没有自动分类结论时匹配阶段不得完成');
 assert.equal(project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups,
  mergeConfirmedKey:bare.mergeKey,matching:{}}).matching.ready,false,'空对象不能冒充已完成');
 assert.equal(project.assess({collection:collection.create(),mergeIdentical:false}).import.ready,false);
 assert.equal(project.assess({collection:{entries:[{metadata:{originalName:'x.xlsx'},snapshot:{}}]},mergeIdentical:false})
  .import.ready,false,'导入记录缺路径、副本或指纹时不得算有效导入');
 assert.equal(project.assess({collection:base,mergeIdentical:false,preview:{canFinalize:false,issues:[{code:'x'}]},
  groups:groups,mergeConfirmedKey:bare.mergeKey}).import.ready,false,'来源问题未清零不得进入下一步');
 assert.equal(project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups,
  mergeConfirmedKey:'ck2-ffffffffffffffff'}).import.ready,false,'确认的键与当前预览不一致时不得算完成');
 const full=project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups,mergeConfirmedKey:bare.mergeKey,
  matching:{ready:true},review:{ready:true},categories:{ready:true},brands:{ready:true},inquiry:{ready:true},split:{ready:true}});
 project.STAGES.forEach(function(stage){assert.equal(full[stage].ready,true,stage);});
});
test('sync confirms provable stages and lets everything downstream expire when an upstream step breaks',()=>{
 const base=fixture(),preview=collection.preview(base,false),groups=rowsOf(base,false);
 const bare=project.assess({collection:base,mergeIdentical:false,preview:preview,groups:groups});
 const input={collection:base,mergeIdentical:false,preview:preview,groups:groups,mergeConfirmedKey:bare.mergeKey,
  matching:{ready:true,detail:'自动匹配完成'},review:{ready:true},categories:{ready:true},brands:{ready:true},
  inquiry:{ready:true},split:{ready:true}};
 const ready=project.sync(project.create(base,false),project.assess(input));
 project.STAGES.forEach(function(stage){assert.equal(project.stageState(ready,stage),'ready',stage);});
 const dropped=project.sync(ready,project.assess(Object.assign({},input,{review:{ready:false}})));
 assert.equal(project.stageState(dropped,'review'),'missing','表内审核未确认后不得保持已确认');
 assert.equal(project.stageState(dropped,'categories'),'stale');
 assert.equal(dropped.projectId,ready.projectId);
 const broken=project.sync(ready,project.assess(Object.assign({},input,{preview:{canFinalize:false,issues:[{code:'quantity-invalid'}]}})));
 assert.equal(project.stageState(broken,'import'),'missing');
 assert.equal(project.stageState(broken,'matching'),'stale');
 const again=project.sync(broken,project.assess(input));
 assert.equal(project.stageState(again,'review'),'ready');assert.equal(project.stageState(again,'split'),'ready');
});
test('validation refuses a bad merge receipt and unknown internal versions',()=>{
 const good=project.create(fixture(),false);
 assert.match(project.validate({...good,mergeKey:7}).errors.join('；'),/合并确认/);
 assert.equal(project.validate({...good,mergeKey:'ck2-'+'a'.repeat(16)}).ok,true);
 assert.match(project.validate({...good,brands:{schemaVersion:2}}).errors.join('；'),/内部版本不支持/);
 assert.match(project.validate({...good,header:{schemaVersion:9}}).errors.join('；'),/内部版本不支持/);
 assert.match(project.validate({...good,categories:[]}).errors.join('；'),/categories字段无效/);
 assert.match(project.validate({...good,classification:{schemaVersion:2}}).errors.join('；'),/内部版本不支持/,'过渡期暂存字段也要拒绝未知版本');
 assert.equal(project.validate({...good,inquiry:{schemaVersion:1}}).ok,true);
 assert.equal(project.KIND_OF_STAGE.review,'review');
 assert.throws(function(){project.invalidateStage(good,'nope');},/无法识别/);
 assert.equal(project.stageState(project.invalidateStage(project.confirm(good,'brands'),'brands'),'brands'),'missing');
 const downstream=project.invalidateStage(project.confirm(project.confirm(good,'review'),'brands'),'review');
 assert.equal(project.stageState(downstream,'review'),'missing');
 assert.equal(project.stageState(downstream,'brands'),'stale','已确认的下游阶段过期但保留历史');
});
