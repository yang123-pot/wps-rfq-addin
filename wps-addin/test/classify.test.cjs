const test=require('node:test'),assert=require('node:assert/strict');
const libraryLib=require('../src/category-library.js'),classify=require('../src/classify.js'),defaults=require('../rules/defaults.json');
function item(name,feature,unit){return {name:name,feature:feature||'',unit:unit||''};}
test('matches the four confirmed business rules with an explainable basis',()=>{
 assert.deepEqual(libraryLib.validate(defaults),{ok:true,errors:[]});
 const cases=[
  [{name:'电动排烟阀手动开启钢索',feature:'',unit:'套'},'no-inquiry','partial','钢索'],
  [{name:'水龙头',feature:'不锈钢 DN15',unit:'个'},'water-valve','exact','水龙头'],
  [{name:'风阀',feature:'500×200',unit:'个'},'air-outlet-damper','exact','风阀'],
  [{name:'充电桩配套配电箱',feature:'',unit:'台'},'ev-charger','partial','充电桩']
 ];
 for(const [entry,categoryId,level,keyword] of cases){
  const result=classify.suggest(entry,defaults);
  assert.equal(result.matchLevel,level,entry.name);
  assert.equal(result.candidates[0].categoryId,categoryId,entry.name);
  assert.equal(result.libraryVersion,defaults.version);
  assert.equal(result.requiresConfirmation,true,'建议不得直接成为确认结果');
  assert.match(result.reasons.join('；'),new RegExp(keyword));
  assert.ok(result.reasons.join('；').includes('用户已确认'),'必须带出用户确认口径');
 }
});
test('similar wording that does not satisfy the confirmed rules stays unknown',()=>{
 for(const entry of [item('照明配电箱','', '台'),item('风管','镀锌钢板','m'),item('水表','DN50','个'),item('钢带','','m')]){
  const result=classify.suggest(entry,defaults);
  assert.equal(result.matchLevel,'none',entry.name);
  assert.deepEqual(result.candidates,[]);
  assert.deepEqual(result.conflicts,[]);
 }
});
test('conflicting rules surface every candidate instead of choosing one',()=>{
 const conflicting={version:'test',categories:[{id:'a',name:'类别A'},{id:'b',name:'类别B'}],
  rules:[{id:'rule-a',categoryId:'a',match:[{field:'name',any:['水龙头']}]},
   {id:'rule-b',categoryId:'b',match:[{field:'text',any:['水龙头']}]}]};
 const result=classify.suggest(item('水龙头','','个'),conflicting);
 assert.equal(result.conflicts.length,2);assert.equal(result.candidates.length,2);
 assert.equal(result.accepted,null);assert.equal(result.requiresConfirmation,true);
});
test('disabled rules are ignored and unknown libraries never throw',()=>{
 const disabled={version:'test',categories:[{id:'a',name:'类别A'}],
  rules:[{id:'rule-a',categoryId:'a',state:'disabled',match:[{field:'name',any:['水龙头']}]}]};
 assert.equal(classify.suggest(item('水龙头','','个'),disabled).matchLevel,'none');
 assert.equal(classify.suggest(item('水龙头','','个'),null).matchLevel,'none');
 assert.deepEqual(classify.suggest(item('水龙头','','个'),null).candidates,[]);
});
