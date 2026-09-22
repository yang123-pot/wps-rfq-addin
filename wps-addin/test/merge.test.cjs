const test=require('node:test');
const assert=require('node:assert/strict');
const {preview}=require('../src/merge.js');

function material(row,overrides={}) {
  return {id:'row-'+row,code:'000'+row,name:'管道',feature:'DN50\n含接头',unit:'m',quantity:'0.1',quantityRaw:'0.1',issueCodes:[],
    source:{file:'清单.xlsx',path:'C:\\项目\\清单.xlsx',sheet:'给排水',row,rows:[row],column:3,engineering:'一号楼',profession:'给排水',professionBasis:'section',section:'给水系统'},...overrides};
}
function book(items,overrides={}) {return {name:'清单.xlsx',path:'C:\\项目\\清单.xlsx',materials:items,issues:[],sheets:[],...overrides};}
function otherBook(items) {
  const b=book(items,{name:'二号楼.xlsx',path:'C:\\项目\\二号楼.xlsx'});
  b.materials=b.materials.map(m=>({...m,source:{...m.source,file:b.name,path:b.path,engineering:'二号楼'}}));return b;
}
test('default preserves every input row and workbook boundary',()=>{
  const result=preview([book([material(3),material(4)]),otherBook([material(3)])]);
  assert.equal(result.mode,'separate');assert.equal(result.inputCount,3);assert.equal(result.outputCount,3);
  assert.deepEqual(result.groups.map(x=>x.quantity),['0.1','0.1','0.1']);
  assert.equal(new Set(result.groups.map(x=>x.scopeId)).size,2);
});
test('explicit merge combines only exact name feature unit while ignoring different codes',()=>{
  const a=book([material(3),material(4,{code:'DIFFERENT'})]);
  const b=otherBook([material(3)]);
  const result=preview([a,b],{mergeIdentical:true});
  assert.equal(result.outputCount,1);assert.equal(result.groups[0].quantity,'0.3');
  assert.deepEqual(result.groups[0].sources.map(x=>x.code),['0003','DIFFERENT','0003']);
  assert.deepEqual(result.groups[0].sourceLabels,['一号楼—给排水','二号楼—给排水']);
  assert.equal(result.groups[0].sources.length,3);assert.equal(result.canFinalize,true);
});
test('same code and near text cannot force a merge or unit conversion',()=>{
  const items=[material(3),material(4,{name:' 管道'}),material(5,{feature:'DN50 含接头'}),material(6,{unit:'M'}),material(7,{unit:'m '})];
  items.forEach(x=>x.code='SAME');const result=preview([book(items)],{mergeIdentical:true});
  assert.equal(result.outputCount,5);
  assert.deepEqual(result.groups.map(x=>x.name),['管道',' 管道','管道','管道','管道']);
});
test('decimal arithmetic handles unequal scales and quantities above safe integer without rounding',()=>{
  const values=['9007199254740993.01','0.09','0.000000000000000001','2'];
  const result=preview([book(values.map((q,i)=>material(i+3,{quantity:q,quantityRaw:q})))],{mergeIdentical:true});
  assert.equal(result.groups[0].quantity,'9007199254740995.100000000000000001');
});
test('invalid and missing quantities stay separate and never become zero',()=>{
  const result=preview([book([material(3),material(4,{quantity:null,quantityRaw:'待定'}),material(5,{quantity:null,quantityRaw:''}),material(6,{quantity:'0',quantityRaw:0})])],{mergeIdentical:true});
  assert.deepEqual(result.groups.map(x=>x.quantity),['0.1',null,null]);
  assert.equal(result.groups[1].sources[0].quantityRaw,'待定');
  assert.equal(result.canFinalize,false);assert.equal(result.issues.filter(x=>x.code==='quantity-invalid').length,2);
});
test('all original source details including continuation rows survive without mutable input references',()=>{
  const input=book([material(3,{source:{...material(3).source,rows:[3,4,5]}})]);
  const before=JSON.stringify(input);const result=preview([input],{mergeIdentical:true});
  assert.deepEqual(result.groups[0].sources[0].rows,[3,4,5]);
  result.groups[0].sources[0].rows.push(9);
  assert.equal(JSON.stringify(input),before);
  assert.equal(result.groups[0].sources[0].quantityRaw,'0.1');
  assert.equal(result.groups[0].sources[0].row,3);
});
test('duplicate Windows path or supplied fingerprint is rejected instead of counted twice',()=>{
  const a=book([material(3)]);
  assert.throws(()=>preview([a,book([material(4)],{path:'c:/项目/清单.xlsx'})]),/重复/);
  const b=otherBook([material(3)]);a.fingerprint='a'.repeat(64);b.fingerprint='a'.repeat(64);
  assert.throws(()=>preview([a,b]),/重复/);
});
test('same filename in different directories remains distinct without evidence of duplicate contents',()=>{
  const a=book([material(3)]),b=otherBook([material(3)]);b.name=a.name;
  const result=preview([a,b]);assert.equal(result.inputCount,2);
});
test('duplicate source row and overlapping continuation provenance are rejected',()=>{
  assert.throws(()=>preview([book([material(3),material(3)])]),/重复.*来源|来源.*重复/);
  assert.throws(()=>preview([book([material(3,{source:{...material(3).source,rows:[3,4]}}),material(4)])]),/重复.*来源|来源.*重复/);
});
test('parser issues remain visible and stop finalization even if group quantities are valid',()=>{
  const input=book([material(3,{issueCodes:['source-inferred']})],{issues:[{code:'source-inferred',severity:'review',sheet:'给排水',row:3,column:3,message:'按名称推断'}]});
  const result=preview([input],{mergeIdentical:true});
  assert.equal(result.canFinalize,false);assert.equal(result.issues[0].code,'source-inferred');
  assert.equal(result.issues[0].file,input.name);assert.equal(result.groups[0].sources[0].professionBasis,'section');
});
test('empty inputs, malformed material fields and already aggregated outputs are rejected',()=>{
  assert.throws(()=>preview([]),/工作簿/);
  assert.throws(()=>preview([book([material(3,{quantity:'-1'})])]),/数量|工程量/);
  assert.throws(()=>preview([book([material(3,{name:null})])]),/字段/);
  assert.throws(()=>preview([preview([book([material(3)])])]),/解析|原始/);
});
test('unresolved source labels remain explicit and never disappear through display deduplication',()=>{
  const m=material(3);m.source.engineering='';m.source.profession='';
  const result=preview([book([m])]);
  assert.deepEqual(result.groups[0].sourceLabels,['工程待核对—专业待核对']);
  assert.equal(result.canFinalize,false);
});
test('missing original identity or raw quantity is refused even with otherwise valid totals',()=>{
  const missingId=material(3);delete missingId.id;
  const missingRaw=material(3);delete missingRaw.quantityRaw;
  assert.throws(()=>preview([book([missingId])]),/追溯|原始/);
  assert.throws(()=>preview([book([missingRaw])]),/追溯|原始/);
});
test('whitespace-only source labels cannot satisfy finalization',()=>{
  const item=material(3);item.source.engineering=' ';item.source.profession='\t';
  const result=preview([book([item])]);
  assert.equal(result.canFinalize,false);
  assert.deepEqual(result.groups[0].sourceLabels,['工程待核对—专业待核对']);
});
test('dot path aliases are rejected until the importer resolves a canonical path',()=>{
  const input=book([material(3)],{path:'C:/临时/../项目/清单.xlsx'});
  input.materials[0].source.path=input.path;
  assert.throws(()=>preview([input]),/路径.*规范/);
});
