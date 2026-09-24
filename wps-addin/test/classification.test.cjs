const test=require('node:test'),assert=require('node:assert/strict');
const classification=require('../src/classification.js');
function rows(){return [
 {scopeId:'scope-1',name:'水管'},
 {scopeId:'scope-2',name:'阀门'},
 {scopeId:'scope-3',name:'风机',conflicts:[{categoryId:'a'},{categoryId:'b'}]}
];}
function decide(current,rowId,extra){
 return classification.setDecision(current,rowId,{categoryId:'water-valve',categoryName:'水阀门',matchLevel:'exact',
  basis:'用户已确认：所有水龙头→水阀门',libraryVersion:'2026-09-24.1',...(extra||{})});
}
test('one unconfirmed row blocks the brand table until every row is confirmed or marked as no inquiry',()=>{
 let current=classification.create();
 assert.deepEqual(classification.summary(current,rows()),{total:3,confirmed:0,remaining:3,
  pending:[{rowId:'scope-1',name:'水管',reason:'未确认分类'},{rowId:'scope-2',name:'阀门',reason:'未确认分类'},
   {rowId:'scope-3',name:'风机',reason:'多候选冲突待确认'}],conflicts:[{rowId:'scope-3',name:'风机'}],canGenerateBrandTable:false});
 current=decide(current,'scope-1');current=decide(current,'scope-2');
 let state=classification.summary(current,rows());
 assert.equal(state.remaining,1);assert.equal(state.canGenerateBrandTable,false,'剩1行未确认时必须阻断');
 assert.deepEqual(state.conflicts,[{rowId:'scope-3',name:'风机'}]);
 current=decide(current,'scope-3',{categoryId:'no-inquiry',categoryName:'无需询价',skip:true,matchLevel:'none'});
 state=classification.summary(current,rows());
 assert.equal(state.remaining,0);assert.equal(state.canGenerateBrandTable,true);
 assert.equal(classification.decisionFor(current,'scope-3').skip,true,'无需询价算已确认');
});
test('decisions keep the library version, basis and project revision, and newest wins',()=>{
 let current=decide(classification.create(),'scope-1');
 const first=classification.decisionFor(current,'scope-1');
 assert.equal(first.libraryVersion,'2026-09-24.1');assert.match(first.basis,/水龙头/);assert.equal(first.revision,1);
 assert.equal(current.revision,2);assert.equal(current.history[0].action,'confirm');
 current=decide(current,'scope-1',{categoryId:'other',categoryName:'别的类别',basis:'人工改选'});
 const second=classification.decisionFor(current,'scope-1');
 assert.equal(second.categoryId,'other');assert.equal(second.revision,2);assert.equal(current.decisions.length,1,'同一行只保留一条决策');
 assert.equal(current.history[1].action,'replace');assert.equal(current.history[1].previous,'water-valve');
});
test('revoking a decision blocks the brand table again and keeps history',()=>{
 let current=decide(classification.create(),'scope-1');
 current=classification.removeDecision(current,'scope-1');
 assert.equal(classification.decisionFor(current,'scope-1'),null);
 assert.equal(classification.summary(current,[{scopeId:'scope-1',name:'水管'}]).canGenerateBrandTable,false);
 const last=current.history[current.history.length-1];
 assert.equal(last.action,'revoke');assert.equal(last.previous,'water-valve');
 assert.equal(classification.removeDecision(current,'nope').revision,current.revision,'没有决策时撤销不产生新版本');
});
test('batch confirmation only touches the explicitly selected rows',()=>{
 let current=classification.create();
 for(const rowId of ['scope-1','scope-2'])current=decide(current,rowId);
 const state=classification.summary(current,rows());
 assert.deepEqual(state.pending.map(item=>item.rowId),['scope-3']);
 assert.equal(classification.decisionFor(current,'scope-3'),null);
});
test('validation rejects unsupported records and incomplete decisions',()=>{
 assert.match(classification.validate({...classification.create(),schemaVersion:9}).errors.join('；'),/版本/);
 assert.match(classification.validate({...classification.create(),decisions:[{rowId:'a'}]}).errors.join('；'),/类别/);
 assert.match(classification.validate({...classification.create(),decisions:[{categoryId:'a',confirmedAt:'x'}]}).errors.join('；'),/行标识/);
 assert.throws(()=>classification.setDecision(classification.create(),'','x'),/行标识/);
 assert.throws(()=>classification.setDecision(classification.create(),'scope-1',{}),/类别/);
});
function planFixture(){
 const entryA={id:'entry-a',metadata:{originalPath:'C:\\samples\\a.xlsx'},
  snapshot:{sheets:[{name:'给排水',columnCount:5},{name:'暖通',columnCount:4}]}};
 const entryB={id:'entry-b',metadata:{originalPath:'C:\\samples\\b.xlsx'},
  snapshot:{sheets:[{name:'给排水',columnCount:5}]}};
 const groups=[{scopeId:'scope-1',name:'水管',sources:[{path:'C:\\samples\\a.xlsx',sheet:'给排水',row:3,rows:[3]}]},
  {scopeId:'scope-2',name:'风口',sources:[{path:'C:\\samples\\b.xlsx',sheet:'给排水',row:4,rows:[4,5]}]}];
 return {entries:[entryA,entryB],groups:groups};
}
test('planColumn writes at the end of each sheet, keeps original row numbers and can require full confirmation',()=>{
 const {entries,groups}=planFixture();
 let current=decide(classification.create(),'scope-1');
 assert.throws(()=>classification.planColumn(current,groups,entries,{requireAll:true}),/还有1行未确认/);
 const partial=classification.planColumn(current,groups,entries,{});
 assert.equal(partial.mode,'separate');assert.equal(partial.plans.length,1);
 assert.deepEqual(partial.plans[0],{entryId:'entry-a',sheet:'给排水',headerRow:1,column:6,
  header:'分类备注｜匹配度｜核对状态',rows:[{row:3,text:'水阀门｜完全匹配｜已确认'}]});
 current=decide(current,'scope-2',{categoryId:'air-outlet-damper',categoryName:'风口、风阀',matchLevel:'partial'});
 const full=classification.planColumn(current,groups,entries,{headerRows:{给排水:2},requireAll:true});
 assert.equal(full.plans.length,2);
 const second=full.plans[1];
 assert.deepEqual({entryId:second.entryId,sheet:second.sheet,headerRow:second.headerRow,column:second.column},
  {entryId:'entry-b',sheet:'给排水',headerRow:2,column:6});
 assert.deepEqual(second.rows,[{row:4,text:'风口、风阀｜相近匹配｜已确认'},{row:5,text:'风口、风阀｜相近匹配｜已确认'}],
  '特征续行按归集范围一起标注');
});
test('merged projects plan a single flat table instead of touching original sheets',()=>{
 let current=decide(classification.create(),'scope-1');
 current=decide(current,'scope-2',{categoryId:'no-inquiry',categoryName:'无需询价',skip:true,matchLevel:'none'});
 const merged=classification.planColumn(current,planFixture().groups,[],{merged:true,sheet:'清单',column:7,requireAll:true});
 assert.equal(merged.mode,'merge-identical');assert.equal(merged.plans.length,1);
 assert.deepEqual(merged.plans[0],{entryId:null,sheet:'清单',headerRow:1,column:7,header:'分类备注｜匹配度｜核对状态',
  rows:[{row:2,text:'水阀门｜完全匹配｜已确认'},{row:3,text:'无需询价｜无可靠匹配｜已确认'}]});
});
