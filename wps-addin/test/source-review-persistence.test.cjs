'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const collection=require('../src/collection.js'),review=require('../src/review.js'),project=require('../src/project.js');
function input(){
 const originalPath='C:\\sources\\continuations.xlsx',fingerprint='d'.repeat(64);
 return {metadata:{originalPath,originalName:'continuations.xlsx',copyPath:'C:\\copies\\continuations.xlsx',fingerprint},
  snapshot:{name:'continuations.xlsx',path:originalPath,fingerprint,sheets:[{name:'安装',startRow:1,startColumn:1,rowCount:5,columnCount:5,
   values:[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
    ['001','阀门','阀门首段','个','2'],['','','独立核对的续段','',''],['002','水泵','水泵首段','台','1']]}]}};
}
function decided(){
 let c=collection.add(collection.create(),[input()]),e=c.entries[0];
 const record=review.setDecision(e.snapshot,e.record,{kind:'continuation',sheet:'安装',row:4,targetRow:5});
 return collection.update(c,e.id,record,false);
}
function restore(saved){return collection.add(collection.create(),saved.sources.map(s=>({
 metadata:{originalPath:s.originalPath,originalName:s.originalName,copyPath:s.copyPath,fingerprint:s.fingerprint},
 snapshot:s.snapshot,record:s.reviewRecord})));}
test('serialized project preserves confirmed continuation ownership and full text on restore',()=>{
 const saved=JSON.parse(JSON.stringify(project.create(decided(),true,{projectId:'p-source-roundtrip'})));
 const restored=restore(saved),p=collection.preview(restored,true);
 assert.equal(p.blockingIssueCount,0,'confirmed source rows must not become unresolved after reopening');
 assert.deepEqual(p.groups.map(g=>[g.name,g.feature,g.quantity]),[['阀门','阀门首段','2'],['水泵','水泵首段\n独立核对的续段','1']]);
 assert.equal(restored.entries[0].dirty,false);
 assert.equal(restored.entries[0].parsed.materials[1].review.continuations[0].confirmed,true);
});
test('importing a saved source record rejects a changed snapshot instead of silently discarding it',()=>{
 const i=input(),record=decided().entries[0].record;i.snapshot.sheets[0].values[2][2]='已变化';
 assert.throws(()=>collection.add(collection.create(),[{...i,record}]),/内容已变化|核对记录不一致/);
});
test('importing an invalid continuation target refuses the saved record',()=>{
 const i=input(),record=review.create(i.snapshot);
 record.decisions.push({kind:'continuation',sheet:'安装',row:4,targetRow:99});
 assert.throws(()=>collection.add(collection.create(),[{...i,record}]),/续行归属/);
});
test('project validation rejects unsupported source review versions',()=>{
 const p=project.create(decided(),true,{projectId:'p-source-version'});
 p.sources[0].reviewRecord={...decided().entries[0].record,version:99};
 assert.equal(project.validate(p).ok,false);
 assert.match(project.validate(p).errors.join('；'),/核对记录/);
});
test('legacy projects without source decisions preserve continuation blockers',()=>{
 const saved=project.create(collection.add(collection.create(),[input()]),true,{projectId:'p-source-legacy'});
 delete saved.sources[0].reviewRecord;
 assert.equal(collection.preview(restore(saved),true).blockingIssueCount,1);
 assert.equal(restore(saved).entries[0].record.decisions.length,0);
});
test('refreshing after an ownership decision is removed does not retain the previous decision',()=>{
 const c=decided(),saved=project.create(c,true,{projectId:'p-source-cleared'}),e=c.entries[0];
 const cleared=collection.update(c,e.id,review.removeDecision(e.snapshot,e.record,'安装',4),false);
 const again=restore(JSON.parse(JSON.stringify(project.refresh(saved,cleared,true))));
 assert.equal(collection.preview(again,true).blockingIssueCount,1);
 assert.equal(again.entries[0].record.decisions.length,0);
});
