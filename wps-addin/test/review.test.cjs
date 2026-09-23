const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('../src/review.js');
const {preview} = require('../src/merge.js');

function snapshot(rows = []) {
  const values = [['工程名称：一号楼','','','','',''], ['序号','项目编码','项目名称','项目特征描述','单位','工程量'],
    [1,123,'水龙头','铜制','个','待定'], ...rows];
  return {name:'清单.xlsx',path:'C:\\项目\\清单.xlsx',sheets:[{name:'清单',startRow:1,startColumn:1,rowCount:values.length,columnCount:6,values}]};
}
function decision(row=3, extra={}) {
  return {sheet:'清单',row,kind:'material',code:'000123',name:'水龙头',unit:'个',quantity:'0.1',engineering:'一号楼',profession:'给排水',codeDisplayConfirmed:true,...extra};
}
function storage() {const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}

test('review fixes invalid fields and inferred source without changing original data, preserving audit in merge',()=>{
  const s=snapshot(), before=JSON.stringify(s), record=review.setDecision(s,review.create(s),decision());
  const b=review.apply(s,record), m=b.materials[0];
  assert.equal(m.code,'000123');assert.equal(m.quantity,'0.1');assert.equal(m.quantityRaw,'待定');
  assert.equal(m.source.professionBasis,'user-confirmed');assert.equal(b.issues.length,0);
  const result=preview([b]);assert.equal(result.canFinalize,true);
  assert.equal(result.groups[0].sources[0].review.original.code,'123');
  assert.equal(result.groups[0].sources[0].review.original.quantityRaw,'待定');
  assert.equal(JSON.stringify(s),before);assert.equal(review.create(s).decisions.length,0);
});
test('invalid quantity, blank source and unconfirmed empty code cannot be acknowledged away',()=>{
  const s=snapshot();
  for(const change of [{quantity:'待定'},{quantity:'-1'},{engineering:' '},{profession:''},{unit:''},{name:''},{code:''}]) {
    assert.throws(()=>review.setDecision(s,review.create(s),decision(3,change)),/工程量|来源|单位|名称|编码/);
  }
  const missing=snapshot();missing.sheets[0].values[2][1]='';
  const r=review.setDecision(missing,review.create(missing),decision(3,{code:'',allowMissingCode:true}));
  assert.equal(review.apply(missing,r).issues.length,0);
});
test('section decision keeps heading; promotion reparses following material sources; undo restores issues',()=>{
  const s=snapshot([['','','通风机','','',''],[2,'002','阀门','DN20','个',2]]);
  let r=review.setDecision(s,review.create(s),{kind:'section',sheet:'清单',row:4});
  assert.equal(review.apply(s,r).issues.some(i=>i.code==='section-ambiguous'),false);
  r=review.setDecision(s,r,decision(4,{name:'通风机',code:'003',unit:'台',quantity:'2',profession:'暖通'}));
  const b=review.apply(s,r);assert.equal(b.materials.length,3);
  assert.equal(b.materials[2].source.profession,''); // it no longer inherits the false heading
  assert.equal(preview([b]).canFinalize,false);
  r=review.removeDecision(s,r,'清单',4);
  assert.equal(review.apply(s,r).issues.some(i=>i.code==='section-ambiguous'),true);
});
test('continuations require individual explicit ownership and transfer exactly once',()=>{
  const s=snapshot([['','','','含接头','',''],['','','','含安装','',''],[2,'002','水龙头','钢制','个',2]]);
  let r=review.setDecision(s,review.create(s),decision());
  r=review.setDecision(s,r,decision(6,{code:'002',quantity:'2'}));
  r=review.setDecision(s,r,{kind:'continuation',sheet:'清单',row:4,targetRow:6});
  assert.equal(preview([review.apply(s,r)]).canFinalize,false);
  r=review.setDecision(s,r,{kind:'continuation',sheet:'清单',row:5,targetRow:3});
  const b=review.apply(s,r);
  assert.equal(b.materials[0].feature,'铜制\n含安装');assert.deepEqual(b.materials[0].source.rows,[3,5]);
  assert.equal(b.materials[1].feature,'钢制\n含接头');assert.deepEqual(b.materials[1].source.rows,[6,4]);
  assert.equal(preview([b]).canFinalize,true);
  assert.throws(()=>review.setDecision(s,r,{kind:'continuation',sheet:'清单',row:4,targetRow:99}),/归属/);
  r=review.removeDecision(s,r,'清单',5);assert.equal(preview([review.apply(s,r)]).canFinalize,false);
});
test('unknown rows can only be excluded with explicit reason; headers cannot be dismissed',()=>{
  const s=snapshot([['注意事项','','','','','']]);
  assert.throws(()=>review.setDecision(s,review.create(s),{kind:'nonmaterial',sheet:'清单',row:4,reason:''}),/理由/);
  const r=review.setDecision(s,review.create(s),{kind:'nonmaterial',sheet:'清单',row:4,reason:'已核对为编制说明'});
  assert.equal(review.apply(s,r).issues.some(i=>i.code==='row-unrecognized'),false);
  assert.throws(()=>review.setDecision(s,r,{kind:'nonmaterial',sheet:'清单',row:2,reason:'忽略'}),/核对|支持/);
});
test('save and restore exact workbook only, rejecting changed values, paths, broken and future records',()=>{
  const s=snapshot(), db=storage(), r=review.setDecision(s,review.create(s),decision());
  assert.equal(review.load(db,s),null);review.save(db,s,r);
  assert.deepEqual(review.load(db,s),r);
  const changed=structuredClone(s);changed.sheets[0].values[2][5]='3';
  assert.throws(()=>review.load(db,changed),/变化|不一致/);
  const other=structuredClone(s);other.path='C:\\其他\\清单.xlsx';assert.equal(review.load(db,other),null);
  assert.throws(()=>review.apply(other,r),/变化|不一致/);
  assert.throws(()=>review.apply(s,{...r,version:999}),/版本|记录/);
  assert.throws(()=>review.load({getItem:()=>'{oops'},s),/损坏/);
  assert.throws(()=>review.save({setItem(){throw Error('QuotaExceededError');}},s,r),/保存失败/);
  const unsaved={...s,path:'清单.xlsx'};assert.throws(()=>review.save(db,unsaved,review.create(unsaved)),/先.*保存/);
});
test('imported and active-book reviews at the same path never overwrite each other',()=>{
  const active=snapshot(), imported={...active,fingerprint:'a'.repeat(64)},db=storage();
  const a=review.setDecision(active,review.create(active),decision(3,{quantity:'2'}));
  const b=review.setDecision(imported,review.create(imported),decision(3,{quantity:'3'}));
  review.save(db,imported,b);review.save(db,active,a);
  assert.deepEqual(review.load(db,imported),b);assert.deepEqual(review.load(db,active),a);
  review.save(db,imported,review.create(imported));assert.deepEqual(review.load(db,active),a);
  assert.throws(()=>review.load(db,{...imported,fingerprint:'b'.repeat(64)}),/变化|不一致/);
});
test('invalid, duplicate or unknown decisions fail atomically and never erase unrelated issues',()=>{
  const s=snapshot(), r=review.create(s);
  assert.throws(()=>review.setDecision(s,r,{...decision(),sheet:'其他'}),/核对|工作表/);
  assert.throws(()=>review.setDecision(s,r,{...decision(),row:100}),/核对|行/);
  assert.throws(()=>review.apply(s,{...r,decisions:[decision(),decision()]}),/重复/);
  assert.throws(()=>review.apply(s,{...r,decisions:[{...decision(),kind:'approve-all'}]}),/核对|类型/);
  assert.equal(r.decisions.length,0);
});
test('numeric code requires explicit display review and an existing code cannot be dismissed as absent',()=>{
  const s=snapshot();
  assert.throws(()=>review.setDecision(s,review.create(s),decision(3,{code:'123',codeDisplayConfirmed:false})),/编码|格式/);
  assert.throws(()=>review.setDecision(s,review.create(s),decision(3,{code:'',allowMissingCode:true})),/编码/);
  s.sheets[0].values[2][1]='000123';
  assert.throws(()=>review.setDecision(s,review.create(s),decision(3,{code:'',allowMissingCode:true})),/编码/);
});
test('explicit nonmaterial decision survives a preceding section becoming material',()=>{
  const s=snapshot([['','','通风机','','',''],['','','','此行为独立说明','','']]);
  let r=review.setDecision(s,review.create(s),{kind:'nonmaterial',sheet:'清单',row:5,reason:'已核对是独立说明'});
  r=review.setDecision(s,r,decision(4,{name:'通风机',code:'004',unit:'台',quantity:'2',profession:'暖通'}));
  const b=review.apply(s,r);assert.equal(b.materials[1].feature,'');assert.deepEqual(b.materials[1].source.rows,[4]);
  assert.equal(b.issues.some(i=>i.code==='feature-continuation'),false);
});
test('undoing a promoted material removes decisions for newly recognized continuations even when transferred',()=>{
  const s=snapshot([['','','通风机','','',''],['','','','新增续行','','']]);
  let r=review.setDecision(s,review.create(s),decision(4,{name:'通风机',code:'004',unit:'台',quantity:'2',profession:'暖通'}));
  r=review.setDecision(s,r,{kind:'continuation',sheet:'清单',row:5,targetRow:3});
  r=review.removeDecision(s,r,'清单',4);
  const b=review.apply(s,r);assert.equal(r.decisions.length,0);
  assert.equal(b.materials[0].feature,'铜制');assert.equal(b.issues.some(i=>i.row===5 && i.code==='row-unrecognized'),true);
});
