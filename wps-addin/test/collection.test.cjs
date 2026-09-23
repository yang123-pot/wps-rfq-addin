const test=require('node:test'),assert=require('node:assert/strict');
const collection=require('../src/collection.js'),review=require('../src/review.js');
function input(name='a.xlsx',qty='0.1',fingerprint='a'.repeat(64)){
 const originalPath='C:\\项目\\'+name,copyPath='C:\\copies\\'+name;
 const values=[['工程名称：一号楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m',qty]];
 return {metadata:{originalPath,copyPath,originalName:name,fingerprint},snapshot:{name,path:originalPath,fingerprint,sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
}
test('separate by default and only explicit selection invokes exact decimal merge with full sources',()=>{
 const c=collection.add(collection.create(),[input(),input('b.xls','0.2','b'.repeat(64))]);
 assert.equal(collection.preview(c).outputCount,2);const p=collection.preview(c,true);
 assert.equal(p.outputCount,1);assert.equal(p.groups[0].quantity,'0.3');assert.equal(p.groups[0].sources.length,2);
 assert.deepEqual(p.groups[0].sources.map(s=>s.path),['C:\\项目\\a.xlsx','C:\\项目\\b.xls']);
});
test('adding duplicate path or content is atomic and rejects mismatched snapshot identities',()=>{
 const c=collection.add(collection.create(),[input()]);
 assert.throws(()=>collection.add(c,[input('b.xls','2','b'.repeat(64)),input()]),/重复/);assert.equal(c.entries.length,1);
 assert.throws(()=>collection.add(c,[input('copy.xlsx')]),/重复/);
 const bad=input('other.xls','2','c'.repeat(64));bad.snapshot.path='C:\\wrong.xls';assert.throws(()=>collection.add(c,[bad]),/标识|来源/);
});
test('review changes update merge, original fingerprints survive, removal never changes the remaining record',()=>{
 let c=collection.add(collection.create(),[input('a.xlsx','待定'),input('b.xls','0.2','b'.repeat(64))]);const id=c.entries[0].id,e=c.entries[0];
 assert.equal(collection.preview(c,true).canFinalize,false);
 const record=review.setDecision(e.snapshot,e.record,{kind:'material',sheet:'给排水',row:3,code:'001',name:'水管',unit:'m',quantity:'0.1',engineering:'一号楼',profession:'给排水'});
 const updated=collection.update(c,id,record);assert.equal(c.entries[0].record.decisions.length,0);
 assert.equal(collection.preview(updated,true).groups[0].quantity,'0.3');assert.equal(collection.preview(updated,true).canFinalize,true);
 assert.equal(updated.entries[0].parsed.fingerprint,'a'.repeat(64));assert.equal(updated.entries[0].dirty,true);
 assert.equal(collection.remove(updated,updated.entries[1].id).entries[0].record.decisions.length,1);
});
