(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqCategoryLibrary=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var FIELDS=['name','feature','unit','text'],STATES=['active','disabled'],DECISION='no-inquiry';
 function conditionErrors(conditions,at,errors){
  if(!Array.isArray(conditions)){errors.push(at+'条件无效。');return;}
  conditions.forEach(function(condition,position){
   var where=at+'第'+(position+1)+'个条件';
   if(!condition||typeof condition!=='object'||FIELDS.indexOf(condition.field)<0)errors.push(where+'字段无效。');
   else if(!Array.isArray(condition.any)||!condition.any.length||
     condition.any.some(function(keyword){return typeof keyword!=='string'||!keyword.trim();}))errors.push(where+'关键词无效。');
  });
 }
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
   if(rule.basis!=null&&typeof rule.basis!=='string')errors.push(at+'依据无效。');
   if(!Array.isArray(rule.match)||!rule.match.length)errors.push(at+'缺少匹配条件。');
   else conditionErrors(rule.match,at,errors);
   if(rule.exclude!=null)conditionErrors(rule.exclude,at+'排除',errors);
   if(rule.aliases!=null&&(!Array.isArray(rule.aliases)||rule.aliases.some(function(keyword){
    return typeof keyword!=='string'||!keyword.trim();})))errors.push(at+'别名无效。');
  });
  return {ok:errors.length===0,errors:errors};
 }
 // “无需询价”是固定的人工决策入口，不随普通类别停用而消失。
 function categories(library){
  var list=((library&&library.categories)||[]).filter(function(category){
   return category.id===DECISION||category.state!=='disabled';});
  if(!list.some(function(category){return category.id===DECISION;}))
   return list.concat([{id:DECISION,name:'无需询价',state:'active'}]);
  return list;
 }
 function category(library,id){var list=((library&&library.categories)||[]).filter(function(item){return item.id===id;});return list.length?list[0]:null;}
 function categoryName(library,id){var found=category(library,id);return found?found.name:String(id);}
 function rules(library){return ((library&&library.rules)||[]).filter(function(rule){
  if(rule.state==='disabled')return false;
  if(rule.categoryId===DECISION)return true;
  var target=category(library,rule.categoryId);
  return !!target&&target.state!=='disabled';
 });}
 function aliases(rule){return (Array.isArray(rule&&rule.aliases)?rule.aliases:[]).filter(function(keyword){
  return typeof keyword==='string'&&keyword.trim();});}
 function exclude(rule){return Array.isArray(rule&&rule.exclude)?rule.exclude:[];}
 function newId(library,prefix){
  var used={};
  ((library&&library.categories)||[]).forEach(function(item){used[item.id]=true;});
  ((library&&library.rules)||[]).forEach(function(item){used[item.id]=true;});
  var stamp=Date.now().toString(36),candidate='';
  do{candidate=String(prefix||'item')+'-'+stamp+'-'+Math.random().toString(36).slice(2,8);}while(used[candidate]);
  return candidate;
 }
 return {DECISION:DECISION,validate:validate,categories:categories,category:category,categoryName:categoryName,rules:rules,
  aliases:aliases,exclude:exclude,newId:newId,FIELDS:FIELDS.slice(),STATES:STATES.slice()};
}));
