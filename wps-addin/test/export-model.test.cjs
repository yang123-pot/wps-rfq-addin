const test=require('node:test'),assert=require('node:assert/strict');
const collection=require('../src/collection.js'),review=require('../src/review.js'),{build}=require('../src/export-model.js');
function input(name,qty,fingerprint){
 const path='C:\\samples\\'+name,values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['000123','=测试名称','含换行\nDN50','m',qty]];
 return {metadata:{originalPath:path,originalName:name,copyPath:'C:\\copy\\'+name,fingerprint},snapshot:{name,path,fingerprint,sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
}
function fixture(){return collection.add(collection.create(),[input('a.xlsx','0.1','a'.repeat(64)),input('b.xlsx','0.2','b'.repeat(64))]);}
test('builds separate or exact merged output with every source, original code and explicit mode',()=>{
 const c=fixture(),before=JSON.stringify(c),separate=build(c,false),merged=build(c,true);
 assert.equal(separate.outputCount,2);assert.equal(merged.outputCount,1);assert.equal(merged.sheets.length,3);
 assert.equal(merged.sheets[0].values[1][1],'000123');assert.equal(merged.sheets[0].values[1][2],'=测试名称');
 assert.equal(merged.sheets[0].values[1][5],'0.3');assert.equal(merged.sheets[1].values.length,3);
 assert.ok(merged.sheets[1].values[1].includes('a'.repeat(64)));assert.ok(merged.sheets[2].values.some(r=>r.includes('merge-identical')));
 assert.equal(JSON.stringify(c),before);
});
test('refuses unresolved/empty inputs and preserves reviewed original code and quantity precision',()=>{
 assert.throws(()=>build(collection.create(),true),/核对|清单/);
 const c=collection.add(collection.create(),[input('a.xlsx','待定','a'.repeat(64))]);assert.throws(()=>build(c,true),/核对/);
 const e=c.entries[0],record=review.setDecision(e.snapshot,e.record,{kind:'material',sheet:'给排水',row:3,code:'000456',name:'水管',unit:'m',quantity:'12345678901234567890.123456789',engineering:'测试楼',profession:'给排水'});
 const model=build(collection.update(c,e.id,record),true),values=model.sheets[1].values[1];
 assert.equal(model.sheets[0].values[1][5],'12345678901234567890.123456789');
 assert.ok(values.includes('000123'));assert.ok(values.includes('000456'));assert.ok(values.includes('待定'));
 assert.ok(model.sheets.every(s=>s.values.every(r=>r.every(v=>typeof v==='string'))));
});
test('oversized text or XML control characters fail explicitly instead of silent truncation',()=>{
 for(const text of ['a'.repeat(32768),'bad\u0001text']){
  const i=input('a.xlsx','1','a'.repeat(64));i.snapshot.sheets[0].values[2][2]=text;
  assert.throws(()=>build(collection.add(collection.create(),[i]),false),/长度|字符/);
 }
});
module.exports={fixture};
