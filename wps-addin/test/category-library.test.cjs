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
test('the no-inquiry decision stays selectable even when other categories are disabled',()=>{
 assert.deepEqual(library.categories({version:'test',categories:[{id:'a',name:'甲'}],rules:[]}).map(c=>c.id),['a','no-inquiry'],
  '分类库没有该条目时也要给出人工决策入口');
 const disabled={version:'test',categories:[{id:'no-inquiry',name:'无需询价',state:'disabled'},{id:'a',name:'甲',state:'disabled'}],
  rules:[{id:'r',categoryId:'no-inquiry',match:[{field:'text',any:['钢索']}]}]};
 assert.equal(library.validate(disabled).ok,true);
 assert.deepEqual(library.categories(disabled).map(category=>category.id),['no-inquiry'],'普通类别停用后仍要能人工选择无需询价');
 assert.equal(library.rules(disabled).length,1,'无需询价的规则不因普通类别停用而消失');
});
test('validates aliases and exclude conditions while old rules stay valid',()=>{
 const aliased={...defaults,rules:[{id:'r',categoryId:'water-valve',match:[{field:'name',any:['水龙头']}],
  aliases:['龙头'],exclude:[{field:'feature',any:['临时']}],basis:'测试'}]};
 assert.deepEqual(library.validate(aliased),{ok:true,errors:[]});
 assert.deepEqual(library.aliases(aliased.rules[0]),['龙头']);
 assert.deepEqual(library.exclude(defaults.rules[0]),[],'旧规则缺exclude按空数组处理');
 assert.deepEqual(library.aliases(defaults.rules[0]),[],'旧规则缺aliases按空数组处理');
 const broken=(rule)=>library.validate({...defaults,rules:[rule]}).errors.join('；');
 assert.match(broken({id:'r',categoryId:'water-valve',match:[{field:'name',any:['x']}],aliases:['']}),/别名无效/);
 assert.match(broken({id:'r',categoryId:'water-valve',match:[{field:'name',any:['x']}],exclude:[{field:'nope',any:['y']}]}),/排除第1个条件字段无效/);
 assert.match(broken({id:'r',categoryId:'water-valve',match:[{field:'name',any:['x']}],exclude:[{field:'name',any:['  ']}]}),/排除第1个条件关键词无效/);
 assert.match(broken({id:'r',categoryId:'water-valve',match:[{field:'name',any:['x']}],exclude:'none'}),/排除条件无效/);
 assert.match(broken({id:'r',categoryId:'water-valve',match:[{field:'name',any:['x']}],basis:7}),/依据无效/);
});
test('generates fresh stable identifiers that never collide with existing ones',()=>{
 assert.match(library.newId(defaults,'category'),/^category-[a-z0-9-]+$/);
 assert.notEqual(library.newId(defaults,'water-valve'),'water-valve');
 const first=library.newId(defaults,'rule'),second=library.newId(defaults,'rule');
 assert.equal(first===second,false,'同一批新增的编号不得重复');
});
