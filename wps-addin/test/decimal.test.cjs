const test=require('node:test'),assert=require('node:assert/strict');
const decimal=require('../src/decimal.js'),merge=require('../src/merge.js');
test('decimal text addition never drifts into floating point',()=>{
 assert.equal(decimal.add('0.1','0.2'),'0.3');
 assert.equal(decimal.add('1','2'),'3');
 assert.equal(decimal.add('0','0'),'0');
 assert.equal(decimal.add('000123','000077'),'200');
 assert.equal(decimal.add('12345678901234567890.123456789','0.000000001'),'12345678901234567890.12345679');
 assert.equal(decimal.add('2.5','2.5'),'5');
 assert.equal(decimal.sum(['0.1','0.2','0.3']),'0.6');
 assert.equal(decimal.normalize('007.500'),'7.5');
 assert.equal(decimal.normalize('0.000'),'0');
});
test('invalid quantities are refused instead of silently treated as zero',()=>{
 for(const value of ['','abc','1.2.3','-1','1,5',' 1','1e3',null,undefined,1]){
  assert.equal(decimal.isQuantity(value),false,String(value));
  assert.throws(()=>decimal.add('1',value),/工程量必须是十进制文本/);
 }
 assert.equal(decimal.isQuantity('0'),true);
 assert.equal(decimal.isQuantity('0.0'),true);
});
test('comparison follows numeric order for quantities with leading zeros and different scales',()=>{
 assert.equal(decimal.compare('007','7'),0);
 assert.equal(decimal.compare('0.10','0.1'),0);
 assert.equal(decimal.compare('2','10'),-1);
 assert.equal(decimal.compare('10','2'),1);
 assert.equal(decimal.compare('1.05','1.5'),-1);
});
test('merge keeps its original behaviour while sharing the decimal helper',()=>{
 const shared=merge.preview([{name:'a.xlsx',path:'C:\\a.xlsx',fingerprint:'a'.repeat(64),issues:[],
  materials:[{id:'i1',name:'水管',feature:'DN50',unit:'m',code:'000123',quantity:'0.1',quantityRaw:'0.1',issueCodes:[],
   source:{engineering:'测试楼',profession:'给排水',sheet:'给排水',row:3,column:1,rows:[3]}}]},
 {name:'b.xlsx',path:'C:\\b.xlsx',fingerprint:'b'.repeat(64),issues:[],
  materials:[{id:'i2',name:'水管',feature:'DN50',unit:'m',code:'000123',quantity:'0.2',quantityRaw:'0.2',issueCodes:[],
   source:{engineering:'测试楼',profession:'给排水',sheet:'给排水',row:3,column:1,rows:[3]}}]}],{mergeIdentical:true});
 assert.equal(shared.groups.length,1);
 assert.equal(shared.groups[0].quantity,'0.3','合并仍走共用十进制相加');
 assert.equal(shared.canFinalize,true);
});
