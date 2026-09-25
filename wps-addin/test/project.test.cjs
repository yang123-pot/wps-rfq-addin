const test=require('node:test'),assert=require('node:assert/strict');
const collection=require('../src/collection.js'),project=require('../src/project.js'),review=require('../src/review.js');
function input(name,fingerprint,qty){
 const path='C:\\samples\\'+name,values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['000123','水管','DN50','m',qty]];
 return {metadata:{originalPath:path,originalName:name,copyPath:'C:\\copies\\'+name,fingerprint},snapshot:{name,path,fingerprint,sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
}
function fixture(){return collection.add(collection.create(),[input('a.xlsx','a'.repeat(64),'0.1'),input('b.xlsx','b'.repeat(64),'0.2')]);}
test('creates a project from a collection with source fingerprints and an import stage',()=>{
 const created=project.create(fixture(),true);
 assert.equal(created.schemaVersion,1);assert.match(created.projectId,/^[a-z0-9-]{8,64}$/);
 assert.equal(created.revision,1);assert.equal(created.mergeIdentical,true);assert.equal(created.name,'a');
 assert.equal(created.sources.length,2);assert.equal(created.sources[0].fingerprint,'a'.repeat(64));
 assert.equal(created.sources[0].sheetCount,1);assert.ok(created.sources[0].snapshot);
 assert.equal(project.stageState(created,'import'),'ready');assert.equal(project.stageState(created,'review'),'missing');
 assert.deepEqual(project.validate(created),{ok:true,errors:[]});
});
test('confirm then invalidate marks the owning stage missing and all downstream stages stale',()=>{
 let current=project.create(fixture(),false);
 for(const stage of ['review','merge','classification','brand','generation','split'])current=project.confirm(current,stage,{note:stage});
 assert.equal(project.stageState(current,'classification'),'ready');
 const next=project.invalidate(current,{kind:'classification',detail:'改了一条分类'});
 assert.equal(next.revision,current.revision+1);
 assert.equal(project.stageState(next,'import'),'ready');assert.equal(project.stageState(next,'merge'),'ready');
 assert.equal(project.stageState(next,'classification'),'missing');
 for(const stage of ['brand','generation','split'])assert.equal(project.stageState(next,stage),'stale');
 assert.equal(next.history.length,1);assert.equal(next.history[0].kind,'classification');assert.equal(next.history[0].revision,next.revision);
 assert.equal(project.stageState(current,'classification'),'ready','原对象不得被改动');
 assert.equal(project.stageState(project.invalidate(current,{kind:'source'}),'review'),'stale','已确认的来源核对保留为过期记录，供查看历史');
 assert.equal(project.stageState(project.invalidate(current,{kind:'header'}),'brand'),'missing');
 assert.equal(project.stageState(project.invalidate(current,{kind:'header'}),'generation'),'stale');
 const fresh=project.invalidate(project.create(fixture(),false),{kind:'classification'});
 assert.equal(project.stageState(fresh,'import'),'ready');assert.equal(project.stageState(fresh,'brand'),'missing','从未确认的阶段仍为缺失');
 assert.throws(()=>project.invalidate(current,{kind:'unknown'}),/无法识别/);
 assert.throws(()=>project.confirm(current,'unknown'),/无法识别/);
});
test('validation reports missing fields, bad fingerprints and unsupported versions',()=>{
 const good=project.create(fixture(),false);
 assert.match(project.validate({...good,schemaVersion:99}).errors.join('；'),/版本/);
 assert.match(project.validate({...good,projectId:'x'}).errors.join('；'),/编号/);
 const broken={...good,sources:[{...good.sources[0],fingerprint:'zz'}]};
 assert.match(project.validate(broken).errors.join('；'),/指纹/);
 const missing={...good};delete missing.stages;
 assert.match(project.validate(missing).errors.join('；'),/阶段/);
 assert.equal(project.validate({}).ok,false);
 assert.throws(()=>project.assertValid({}),/项目记录/);
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
test('refresh keeps the project id and invalidates affected stages when sources or the merge choice change',()=>{
 const base=project.confirm(project.create(fixture(),false),'review');
 const unchanged=project.refresh(base,fixture(),false);
 assert.equal(unchanged.projectId,base.projectId);assert.equal(unchanged.revision,base.revision);
 assert.equal(project.stageState(unchanged,'review'),'ready');
 const changed=project.refresh(base,collection.add(collection.create(),[input('a.xlsx','c'.repeat(64),'0.1'),input('b.xlsx','b'.repeat(64),'0.2')]),false);
 assert.equal(changed.projectId,base.projectId);assert.equal(changed.revision,base.revision+1);
 assert.equal(project.stageState(changed,'import'),'missing');
 assert.equal(project.stageState(changed,'review'),'stale','来源变了，已确认的来源核对置为过期');
 assert.match(changed.history[0].detail,/来源变化/);
 assert.equal(changed.sources[0].fingerprint,'c'.repeat(64));
 const merged=project.refresh(base,fixture(),true);
 assert.equal(merged.mergeIdentical,true);assert.equal(project.stageState(merged,'review'),'ready','只改合并选择不影响来源核对');
 assert.equal(project.stageState(merged,'merge'),'missing');assert.match(merged.history[0].detail,/精确合并/);
});
test('contentKey is a stable business snapshot key that ignores UI, time and receipt fields',()=>{
 const base=fixture(),key=project.contentKey({collection:base,mergeIdentical:false});
 assert.match(key,/^ck1-[0-9a-f]{16}$/);
 assert.equal(project.contentKey({collection:base,mergeIdentical:false}),key);
 assert.equal(project.contentKey({collection:base,mergeIdentical:false,filter:'pending',
  updatedAt:'2026-09-26T00:00:00.000Z',receipt:{target:'C:\\out\\a.xlsx'}}),key,'界面筛选、时间与回执字段不得进入内容键');
 assert.notEqual(project.contentKey({collection:base,mergeIdentical:true}),key,'合并模式影响输出');
 assert.notEqual(project.contentKey({collection:{entries:base.entries.slice().reverse()},mergeIdentical:false}),key,
  '来源顺序影响输出，必须进入内容键');
 const entry=base.entries[0];
 const corrected=collection.update(base,entry.id,review.setDecision(entry.snapshot,entry.record,
  {kind:'material',sheet:'给排水',row:3,code:'000123',name:'水管',unit:'m',quantity:'0.1',
   engineering:'测试楼',profession:'给排水'}),true);
 assert.notEqual(project.contentKey({collection:corrected,mergeIdentical:false}),key,'来源核对内容必须进入内容键');
 const classifier={schemaVersion:1,revision:1,updatedAt:'2026-09-26T00:00:00.000Z',
  decisions:[{rowId:'r1',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'2026-09-26T00:00:00.000Z'}],history:[]};
 const withClassification=project.contentKey({collection:base,mergeIdentical:false,classification:classifier});
 assert.notEqual(withClassification,key);
 assert.equal(project.contentKey({collection:base,mergeIdentical:false,
  classification:{...classifier,revision:9,updatedAt:'2027-01-01T00:00:00.000Z'}}),withClassification,
  '确认时间与记录版本变化不影响内容键');
 const brandData={coverageMode:'material-subsets',assignments:[{assignmentId:'a-1',categoryId:'water-valve',
  rowIds:['r1'],brand:'某品牌',supplier:'某供应商',coverageConfirmed:true,confirmedAt:null}]};
 const withBrand=project.contentKey({collection:base,mergeIdentical:false,classification:classifier,assignments:brandData});
 assert.notEqual(withBrand,withClassification);
 const withHeader=project.contentKey({collection:base,mergeIdentical:false,classification:classifier,
  assignments:brandData,header:{company:'测试公司'}});
 assert.notEqual(withHeader,withBrand);
 const report=project.assess({collection:base,mergeIdentical:false,classification:classifier,
  assignments:brandData,header:{company:'测试公司'}});
 assert.equal(report.brandKey,withClassification,'品牌表上游键只含清单、合并与分类');
 assert.equal(report.generationKey,withHeader,'生成与拆分键再加入品牌与抬头');
});
test('stage readiness comes from real content, never from a non-empty field',()=>{
 const base=fixture(),preview=collection.preview(base,false);
 const bare=project.assess({collection:base,mergeIdentical:false,preview:preview});
 assert.equal(bare.import.ready,true);
 assert.equal(bare.review.ready,true,'来源问题清零后来源核对完成');
 assert.equal(bare.merge.ready,false,'没有明确确认预览时合并阶段不得完成');
 assert.equal(bare.classification.ready,false);
 const merged=project.assess({collection:base,mergeIdentical:false,preview:preview,mergeConfirmedKey:bare.mergeKey});
 assert.equal(merged.merge.ready,true);
 assert.equal(merged.classification.ready,false,'仍有行未确认分类');
 const rows=preview.groups.map(group=>({rowId:group.id||group.scopeId}));
 const classifier={schemaVersion:1,revision:1,decisions:rows.map(row=>({rowId:row.rowId,
  categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'2026-09-26T00:00:00.000Z'})),history:[]};
 const ready=project.assess({collection:base,mergeIdentical:false,preview:preview,mergeConfirmedKey:bare.mergeKey,
  classification:classifier,rows:rows});
 assert.equal(ready.classification.ready,true);
 assert.equal(ready.brand.ready,false,'品牌与抬头未确认时品牌阶段不得完成');
 assert.equal(ready.generation.ready,false);
 assert.equal(ready.split.ready,false);
 assert.equal(project.assess({collection:collection.create(),mergeIdentical:false}).import.ready,false);
 assert.equal(project.assess({collection:{entries:[{metadata:{originalName:'x.xlsx'},snapshot:{}}]},mergeIdentical:false})
  .import.ready,false,'导入记录缺路径、副本或指纹时不得算有效导入');
 assert.equal(project.assess({collection:base,mergeIdentical:false,preview:{canFinalize:false,issues:[{code:'x'}]}}).review.ready,false);
 assert.equal(project.assess({collection:base,mergeIdentical:false,preview:preview,
  mergeConfirmedKey:'ck1-ffffffffffffffff'}).merge.ready,false,'确认的键与当前预览不一致时不得算完成');
});
test('sync confirms provable stages and lets everything downstream expire when an upstream step breaks',()=>{
 const base=fixture(),preview=collection.preview(base,false);
 const key=project.assess({collection:base,mergeIdentical:false,preview:preview}).mergeKey;
 const rows=preview.groups.map(group=>({rowId:group.id||group.scopeId}));
 const classifier={schemaVersion:1,revision:1,decisions:rows.map(row=>({rowId:row.rowId,
  categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'2026-09-26T00:00:00.000Z'})),history:[]};
 const input={collection:base,mergeIdentical:false,preview:preview,mergeConfirmedKey:key,classification:classifier,rows:rows};
 const ready=project.sync(project.create(base,false),project.assess(input));
 for(const stage of ['import','review','merge','classification'])assert.equal(project.stageState(ready,stage),'ready',stage);
 assert.equal(project.stageState(ready,'brand'),'missing','没有品牌数据时下游仍是未完成');
 const dropped=project.sync(ready,project.assess({...input,classification:{...classifier,decisions:classifier.decisions.slice(0,1)}}));
 assert.equal(project.stageState(dropped,'classification'),'missing','分类缺行后分类阶段不得保持已确认');
 const broken=project.sync(ready,project.assess({...input,preview:{canFinalize:false,issues:[{code:'quantity-invalid'}]}}));
 assert.equal(project.stageState(broken,'review'),'missing');
 assert.equal(project.stageState(broken,'merge'),'stale');
 assert.equal(project.stageState(broken,'classification'),'stale');
 assert.equal(broken.projectId,ready.projectId);
 assert.equal(broken.revision,ready.revision+1);
 const again=project.sync(broken,project.assess(input));
 assert.equal(project.stageState(again,'classification'),'ready');
 assert.equal(project.stageState(again,'review'),'ready');
});
test('validation refuses a bad merge receipt and unknown internal versions',()=>{
 const good=project.create(fixture(),false);
 assert.match(project.validate({...good,mergeKey:7}).errors.join('；'),/合并确认/);
 assert.equal(project.validate({...good,mergeKey:'ck1-'+'a'.repeat(16)}).ok,true);
 assert.match(project.validate({...good,assignments:{schemaVersion:2}}).errors.join('；'),/内部版本不支持/);
 assert.match(project.validate({...good,header:{schemaVersion:9}}).errors.join('；'),/内部版本不支持/);
 assert.match(project.validate({...good,generation:[]}).errors.join('；'),/generation字段无效/);
 assert.equal(project.validate({...good,assignments:{schemaVersion:1,rows:[]}}).ok,true);
 assert.equal(project.KIND_OF_STAGE.classification,'classification');
 assert.throws(()=>project.invalidateStage(good,'nope'),/无法识别/);
 assert.equal(project.stageState(project.invalidateStage(project.confirm(good,'brand'),'brand'),'brand'),'missing');
 const downstream=project.invalidateStage(project.confirm(project.confirm(good,'classification'),'brand'),'classification');
 assert.equal(project.stageState(downstream,'classification'),'missing');
 assert.equal(project.stageState(downstream,'brand'),'stale','已确认的下游阶段过期但保留历史');
});
