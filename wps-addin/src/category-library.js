(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqCategoryLibrary=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var FIELDS=['name','feature','unit','text'],STATES=['active','disabled'];
 function validate(library){
  var errors=[];
  if(!library||typeof library!=='object'||Array.isArray(library))return {ok:false,errors:['分类库不是有效对象。']};
  if(typeof library.version!=='string'||!library.version.trim())errors.push('分类库缺少版本号。');
  var categories={},rules={};
  if(!Array.isArray(library.categories)||!library.categories.length)errors.push('分类库缺少类别列表。');
  else library.categories.forEach(function(category,index){
   var at='第'+(index+1)+'个类别';
   if(!category||typeof category!=='object'||Array.isArray(category)){errors.push(at+'无效。');return;}
   if(typeof category.id!=='string'||!category.id.trim())errors.push(at+'缺少编号。');
   else if(categories[category.id])errors.push('类别编号重复：'+category.id);
   else categories[category.id]=category;
   if(typeof category.name!=='string'||!category.name.trim())errors.push(at+'缺少名称。');
   if(category.state!=null&&STATES.indexOf(category.state)<0)errors.push(at+'启停状态无效。');
  });
  if(!Array.isArray(library.rules))errors.push('分类库缺少规则列表。');
  else library.rules.forEach(function(rule,index){
   var at='第'+(index+1)+'条规则';
   if(!rule||typeof rule!=='object'||Array.isArray(rule)){errors.push(at+'无效。');return;}
   if(typeof rule.id!=='string'||!rule.id.trim())errors.push(at+'缺少编号。');
   else if(rules[rule.id])errors.push('规则编号重复：'+rule.id);
   else rules[rule.id]=rule;
   if(typeof rule.categoryId!=='string'||!categories[rule.categoryId])errors.push(at+'引用了不存在的类别：'+String(rule.categoryId));
   if(rule.state!=null&&STATES.indexOf(rule.state)<0)errors.push(at+'启停状态无效。');
   if(!Array.isArray(rule.match)||!rule.match.length)errors.push(at+'缺少匹配条件。');
   else rule.match.forEach(function(condition,position){
    var where=at+'第'+(position+1)+'个条件';
    if(!condition||typeof condition!=='object'||FIELDS.indexOf(condition.field)<0)errors.push(where+'字段无效。');
    else if(!Array.isArray(condition.any)||!condition.any.length||
      condition.any.some(function(keyword){return typeof keyword!=='string'||!keyword.trim();}))errors.push(where+'关键词无效。');
   });
  });
  return {ok:errors.length===0,errors:errors};
 }
 function categories(library){return ((library&&library.categories)||[]).filter(function(category){return category.state!=='disabled';});}
 function category(library,id){var list=((library&&library.categories)||[]).filter(function(item){return item.id===id;});return list.length?list[0]:null;}
 function categoryName(library,id){var found=category(library,id);return found?found.name:String(id);}
 function rules(library){return ((library&&library.rules)||[]).filter(function(rule){return rule.state!=='disabled';});}
 return {validate:validate,categories:categories,category:category,categoryName:categoryName,rules:rules,FIELDS:FIELDS.slice(),STATES:STATES.slice()};
}));
