const test=require('node:test'),assert=require('node:assert/strict');
const library=require('../src/category-library.js'),defaults=require('../rules/defaults.json');
test('accepts the shipped defaults and exposes active categories and rules',()=>{
 assert.deepEqual(library.validate(defaults),{ok:true,errors:[]});
 assert.equal(library.categories(defaults).length,4);
 assert.equal(library.rules(defaults).length,4);
 assert.equal(library.categoryName(defaults,'water-valve'),'水阀门');
 assert.equal(library.category(defaults,'missing'),null);
});
test('rejects unsupported versions, duplicate ids, dangling categories and bad conditions',()=>{
 const cases=[
  [{...defaults,version:''},/版本/],
  [{...defaults,categories:[...defaults.categories,{id:'water-valve',name:'重复'}]},/重复/],
  [{...defaults,rules:[{id:'x',categoryId:'not-there',match:[{field:'name',any:['a']}]}]},/不存在的类别/],
  [{...defaults,rules:[{id:'x',categoryId:'no-inquiry',match:[{field:'feature-x',any:['a']}]}]},/字段无效/],
  [{...defaults,rules:[{id:'x',categoryId:'no-inquiry',match:[{field:'name',any:[]}]}]},/关键词无效/],
  [{...defaults,rules:[{id:'x',categoryId:'no-inquiry',state:'paused',match:[{field:'name',any:['a']}]}]},/启停状态/],
  [{...defaults,categories:'none'},/类别列表/]
 ];
 for(const [value,pattern] of cases)assert.match(library.validate(value).errors.join('；'),pattern);
 assert.equal(library.validate(null).ok,false);
});
test('disabled entries stay in the file but out of matching',()=>{
 const modified={...defaults,categories:[...defaults.categories,{id:'legacy',name:'停用类别',state:'disabled'}],
  rules:[...defaults.rules,{id:'legacy-rule',categoryId:'water-valve',state:'disabled',match:[{field:'name',any:['旧词']}]}]};
 assert.equal(library.categories(modified).some(category=>category.id==='legacy'),false);
 assert.equal(library.rules(modified).some(rule=>rule.id==='legacy-rule'),false);
 assert.equal(modified.categories.some(category=>category.id==='legacy'),true,'停用记录仍保留可查看');
});
