(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./category-library.js'),require('./category-memory.js'));
 else root.RfqClassify=factory(root.RfqCategoryLibrary,root.RfqCategoryMemory);
}(typeof window==='object'?window:globalThis,function(library,memory){
 'use strict';
 function fieldText(item,field){
  var name=item&&item.name!=null?String(item.name):'',feature=item&&item.feature!=null?String(item.feature):'',
    unit=item&&item.unit!=null?String(item.unit):'';
  if(field==='name')return name;
  if(field==='feature')return feature;
  if(field==='unit')return unit;
  return name+' '+feature;
 }
 function conditionHits(item,condition){
  var text=fieldText(item,condition.field);
  return (condition.any||[]).filter(function(keyword){return text.indexOf(keyword)>=0;});
 }
 function allowedCategories(source){
  var allowed={};
  library.categories(source).forEach(function(category){allowed[category.id]=true;});
  return allowed;
 }
 function ruleExcluded(item,rule){
  return (Array.isArray(rule.exclude)?rule.exclude:[]).some(function(condition){
   return condition&&typeof condition==='object'&&library.FIELDS.indexOf(condition.field)>=0&&
    Array.isArray(condition.any)&&condition.any.length>0&&conditionHits(item,condition).length>0;
  });
 }
 function memoryModule(){return memory||(typeof window==='object'&&window.RfqCategoryMemory)||null;}
 function memoryCandidates(item,state,allowed,projectId){
  var module_=state?memoryModule():null;
  if(!module_||typeof module_.find!=='function'||typeof module_.validate!=='function')return [];
  if(!module_.validate(state).ok)return [];
  var found;
  try{found=module_.find(state,item,{projectId:projectId});}
  catch(_){return [];}
  return ((found&&found.candidates)||[]).filter(function(candidate){return !!allowed[candidate.categoryId];});
 }
 function suggest(item,source,context){
  var options=context||{},memoryState=options.memory||null,projectId=options.projectId||null;
  var version=source&&source.version||null,candidates=[],reasons=[],allowed=allowedCategories(source);
  library.rules(source).forEach(function(rule){
   if(!allowed[rule.categoryId])return;
   var matched=[];
   var all=(rule.match||[]).every(function(condition){
    var hits=conditionHits(item,condition);
    if(hits.length)matched.push({field:condition.field,keywords:hits});
    return hits.length>0;
   });
   if(!all||ruleExcluded(item,rule))return;
   var name=item&&item.name!=null?String(item.name).trim():'',nameKeywords=[];
   (rule.match||[]).forEach(function(condition){
    if(condition.field==='name'||condition.field==='text')nameKeywords=nameKeywords.concat(condition.any||[]);
   });
   candidates.push({categoryId:rule.categoryId,categoryName:library.categoryName(source,rule.categoryId),source:'rule',
    matchLevel:name&&nameKeywords.indexOf(name)>=0?'exact':'partial',ruleId:rule.id,basis:rule.basis||null,matched:matched});
   reasons.push('命中规则“'+rule.id+'”：'+matched.map(function(hit){return hit.field+'包含'+hit.keywords.join('、');}).join('；')
     +(rule.basis?'（依据：'+rule.basis+'）':''));
  });
  memoryCandidates(item,memoryState,allowed,projectId).forEach(function(found){
   candidates.push({categoryId:found.categoryId,categoryName:found.categoryName||library.categoryName(source,found.categoryId),
    source:'memory',matchLevel:found.matchLevel==='exact'?'exact':'partial',memoryId:found.memoryId,
    basis:found.basis||'历史人工确认',matched:[]});
   reasons.push('命中历史确认：'+(found.basis||found.categoryName||found.categoryId));
  });
  var distinct=[],byCategory={};
  candidates.forEach(function(candidate){
   if(byCategory[candidate.categoryId])return;
   byCategory[candidate.categoryId]=candidate;distinct.push(candidate);
  });
  return {candidates:candidates,conflicts:distinct.length>1?distinct:[],matchLevel:distinct.length===0?'none':
    (candidates.some(function(candidate){return candidate.matchLevel==='exact';})?'exact':'partial'),
   reasons:reasons,libraryVersion:version,requiresConfirmation:true,accepted:null};
 }
 return {suggest:suggest};
}));
