const test=require('node:test'),assert=require('node:assert/strict');
const collection=require('../src/collection.js'),project=require('../src/project.js');
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
