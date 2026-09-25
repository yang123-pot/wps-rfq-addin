const test=require('node:test'),assert=require('node:assert/strict');
const libraryLib=require('../src/category-library.js'),classify=require('../src/classify.js'),memoryLib=require('../src/category-memory.js');
function lib(categories,rules){return {version:'test',categories:categories,rules:rules};}
const two={id:'a',name:'甲'},other={id:'b',name:'乙'};
function learnFor(item,options){
 const resolved=Object.assign({categoryId:'b',confirmedAt:'2026-09-25T00:00:00.000Z'},options||{});
 return memoryLib.learn(memoryLib.create(),resolved,Object.assign({item:item},resolved.context||{}));
}
test('rules and memories stay separate candidates and surface a conflict instead of picking the newest',()=>{
 const library=lib([two,other],[{id:'r',categoryId:'a',match:[{field:'name',any:['水管']}]}]);
 const item={name:'水管',feature:'DN50',unit:'m'};
 const memory=learnFor(item);
 const result=classify.suggest(item,library,{memory:memory,projectId:'p-test001'});
 assert.equal(result.conflicts.length,2);
 assert.equal(result.requiresConfirmation,true);
 assert.equal(result.accepted,null);
 assert.deepEqual(result.candidates.map(candidate=>candidate.source).sort(),['memory','rule']);
 assert.ok(result.candidates.every(candidate=>candidate.categoryName),'候选必须带出可读类别名');
});
test('a rule and a memory agreeing on one category keep both bases without a conflict',()=>{
 const library=lib([two,other],[{id:'r',categoryId:'b',match:[{field:'name',any:['水管']}],basis:'用户已确认：水管→乙'}]);
 const item={name:'水管',feature:'DN50',unit:'m'};
 const result=classify.suggest(item,library,{memory:learnFor(item),projectId:'p-test001'});
 assert.deepEqual(result.conflicts,[]);
 assert.equal(result.candidates.length,2);
 assert.equal(result.matchLevel,'exact');
 assert.match(result.reasons.join('；'),/历史确认/);
});
test('memory-only matches convert similar to partial and keep requiring manual confirmation',()=>{
 const library=lib([two,other],[]),trained={name:'水管',feature:'DN50',unit:'m'};
 const memory=learnFor(trained);
 const exact=classify.suggest(trained,library,{memory:memory,projectId:'p-test001'});
 assert.equal(exact.matchLevel,'exact');assert.equal(exact.candidates.length,1);
 assert.equal(exact.candidates[0].source,'memory');
 assert.ok(exact.candidates[0].memoryId);
 const similar=classify.suggest({name:'水管',feature:'PVC-U',unit:'m'},library,{memory:memory,projectId:'p-test001'});
 assert.equal(similar.candidates.length,1);
 assert.equal(similar.candidates[0].matchLevel,'partial','相近记忆必须统一为 partial');
 assert.equal(similar.matchLevel,'partial');
});
test('revoked memories and other projects never become candidates',()=>{
 const library=lib([two,other],[]),item={name:'水管',feature:'DN50',unit:'m'};
 const scoped=memoryLib.learn(memoryLib.create(),{categoryId:'b',confirmedAt:'2026-09-25T00:00:00.000Z'},
  {item:item,scope:'project',projectId:'p-owner'});
 assert.equal(classify.suggest(item,library,{memory:scoped,projectId:'p-owner'}).candidates.length,1);
 assert.equal(classify.suggest(item,library,{memory:scoped,projectId:'p-other'}).candidates.length,0);
 const record=scoped.memories[0];
 const revoked=memoryLib.revoke(scoped,record.id);
 assert.equal(classify.suggest(item,library,{memory:revoked,projectId:'p-owner'}).candidates.length,0);
});
test('disabled categories and their memories stop producing new candidates',()=>{
 const library=lib([two,{id:'b',name:'乙',state:'disabled'}],[{id:'r',categoryId:'b',match:[{field:'name',any:['水管']}]}]);
 const item={name:'水管',feature:'DN50',unit:'m'};
 const result=classify.suggest(item,library,{memory:learnFor(item),projectId:'p-test001'});
 assert.deepEqual(result.candidates,[]);
 assert.equal(result.matchLevel,'none');
});
test('exclude conditions suppress a rule and keep the old two-argument call working',()=>{
 const library=lib([two],[{id:'r',categoryId:'a',match:[{field:'name',any:['水管']}],
  exclude:[{field:'feature',any:['临时']}]}]);
 assert.equal(classify.suggest({name:'水管',feature:'临时安装',unit:'m'},library).candidates.length,0);
 assert.equal(classify.suggest({name:'水管',feature:'DN50',unit:'m'},library).candidates.length,1);
 assert.equal(classify.suggest({name:'水管',feature:'DN50',unit:'m'},library,null).candidates.length,1);
});
test('missing or malformed memory state never throws and never invents candidates',()=>{
 const library=lib([two],[{id:'r',categoryId:'a',match:[{field:'name',any:['水管']}]}]);
 const item={name:'水管',feature:'DN50',unit:'m'};
 assert.equal(classify.suggest(item,library,{memory:null}).candidates.length,1);
 assert.equal(classify.suggest(item,library,{memory:{schemaVersion:1,memories:'坏'}}).candidates.length,1);
 assert.equal(classify.suggest(item,library,{memory:memoryLib.create()}).candidates.length,1);
 assert.equal(libraryLib.validate(library).ok,true);
});
