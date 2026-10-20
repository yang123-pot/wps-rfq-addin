const test=require('node:test'),assert=require('node:assert/strict');
const {buildMigration,toLibraryState}=require('../dev/migrate-confirmed-library.cjs');
const memory=require('../src/category-memory.js'),defaults=require('../rules/defaults.json');
function row(recordId,name,feature,unit,categoryName,confirmed,extra){
 return Object.assign({recordId:recordId,item:{name:name,feature:feature,unit:unit},categoryName:categoryName,
  confirmed:confirmed,confirmationSource:'人工核对表'},extra||{});
}
test('unconfirmed rows are rejected instead of being migrated',()=>{
 const result=buildMigration({rows:[{recordId:'case-1',item:{name:'水管',feature:'DN50',unit:'m'},
  categoryId:'water-valve',categoryName:'水阀门',confirmed:false,confirmationSource:null}],overrides:[]},defaults);
 assert.equal(result.memories.length,0);
 assert.equal(result.rejected.length,1);
 assert.equal(result.rejected[0].reason,'未经人工确认');
 assert.equal(result.summary.mappable,0);
});
test('confirmed rows become memories with one source per confirmed record',()=>{
 const result=buildMigration({rows:[
  row('r-1','水龙头','DN15','个','水阀门',true),
  row('r-2','水龙头','DN15','个','水阀门',true),
  row('r-3','钢索','','套','无需询价',true)],overrides:[]},defaults);
 assert.equal(result.memories.length,2,'同一材料同一类别只记一条记忆');
 const faucet=result.memories.filter(item=>item.categoryId==='water-valve')[0];
 assert.deepEqual(faucet.recordIds,['r-1','r-2'],'重复确认保留多条确认来源');
 assert.equal(result.memories.filter(item=>item.categoryId==='no-inquiry')[0].recordIds.length,1);
 assert.equal(result.summary.confirmed,3);
 assert.equal(result.summary.mappable,3);
 assert.deepEqual(result.categories,[{categoryName:'水阀门',count:2},{categoryName:'无需询价',count:1}]);
});
test('category names outside the current library go to conflicts instead of being merged',()=>{
 const result=buildMigration({rows:[
  row('r-1','配电箱','','台','配电箱',true),
  row('r-2','水龙头','DN15','个','水阀门',true),
  row('r-3','水表','DN50','个','',true),
  row('r-4','','DN50','个','水阀门',true)],overrides:[]},defaults);
 assert.equal(result.summary.confirmed,2,'缺类别与缺名称的行不算确认通过');
 assert.equal(result.summary.mappable,1);
 assert.equal(result.conflicts.length,1);
 assert.match(result.conflicts[0].needs,/Q8/);
 assert.equal(result.rejected.filter(item=>item.reason==='缺少类别').length,1);
 assert.equal(result.rejected.filter(item=>item.reason==='缺少材料名称').length,1);
 assert.equal(result.summary.total,result.summary.confirmed+result.summary.rejected,'总数等于通过加拒绝');
});
test('only explicit user aliases map wording, and row overrides are reported without rewriting answers',()=>{
 const overrides=[{row:21,before:['询价','风口风阀'],after:['询价','风口、风阀']}];
 const rows=[row('r-1','风阀','500×200','个','风口风阀',true)];
 const bare=buildMigration({rows:rows,overrides:overrides},defaults);
 assert.equal(bare.memories.length,0,'行级修正不得自动当作类别别名');
 assert.equal(bare.conflicts.length,1);
 assert.deepEqual(bare.wordingVariants,[{categoryName:'风口风阀',count:1}]);
 assert.equal(bare.overrides.matched.length,0);
 assert.equal(bare.overrides.unmatched.length,1);
 const aliased=buildMigration({rows:rows,overrides:overrides},defaults,{aliases:[{from:'风口风阀',to:'风口、风阀'}]});
 assert.equal(aliased.memories.length,1);
 assert.equal(aliased.memories[0].categoryId,'air-outlet-damper');
 assert.equal(aliased.conflicts.length,0);
 const matched=buildMigration({rows:rows.map(item=>Object.assign({},item,{excelRow:21})),overrides:overrides},defaults);
 assert.equal(matched.overrides.matched.length,1,'能对上原行的修正要单独报告供核对');
});
test('a broad keyword must not be rewritten globally by a single row correction',()=>{
 const overrides=[{row:3702,before:['询价','配电箱'],after:['询价','汽车充电桩']}];
 const rows=[row('r-1','配电箱','','台','配电箱',true),row('r-2','配电箱','','台','配电箱',true),
  row('r-3','充电桩配套配电箱','','台','汽车充电桩',true)];
 const result=buildMigration({rows:rows,overrides:overrides},defaults);
 assert.deepEqual(result.conflicts.map(item=>item.categoryName),['配电箱','配电箱'],
  '只有明确写成汽车充电桩的行才并入该类别，其它配电箱行仍待Q8口径');
 assert.equal(result.memories.map(item=>item.categoryId).join(','),'ev-charger');
});
test('a matching category id is accepted when the name differs, otherwise it stays a conflict',()=>{
 const result=buildMigration({rows:[
  row('r-1','水龙头','DN15','个','阀门类',true,{categoryId:'water-valve'}),
  row('r-2','水龙头','DN15','个','阀门类',true,{categoryId:'missing-category'})],overrides:[]},defaults);
 assert.equal(result.memories.length,1);
 assert.equal(result.memories[0].categoryId,'water-valve');
 assert.equal(result.conflicts.length,1);
});
test('migrated memories keep confirmation sources and never carry personal columns',()=>{
 const result=buildMigration({rows:[row('r-1','水龙头','DN15','个','水阀门',true,{reviewer:'张三',phone:'010-12345678'})]},defaults);
 const state=toLibraryState(result,defaults,memory.create());
 assert.equal(state.memory.memories.length,1);
 const record=state.memory.memories[0];
 assert.equal(record.categoryId,'water-valve');
 assert.deepEqual(record.sources,[{sourceProjectId:'migration-20260920',sourceRowId:'r-1',decisionRevision:null}]);
 const text=JSON.stringify(state.memory);
 assert.equal(text.includes('张三'),false,'迁入只保留类别与确认来源，不复制核对人等个人数据');
 assert.equal(text.includes('010-12345678'),false);
 assert.equal(memory.find(state.memory,{name:'水龙头',feature:'DN15',unit:'个'}).matchLevel,'exact');
 const revoked=memory.revoke(state.memory,record.id);
 assert.equal(memory.summary(revoked).active,0,'迁入的记忆可以撤销');
});
