(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./category-library.js'));
 else root.RfqClassify=factory(root.RfqCategoryLibrary);
}(typeof window==='object'?window:globalThis,function(library){
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
 function suggest(item,source){
  var version=source&&source.version||null,candidates=[],reasons=[];
  library.rules(source).forEach(function(rule){
   var matched=[];
   var all=(rule.match||[]).every(function(condition){
    var hits=conditionHits(item,condition);
    if(hits.length)matched.push({field:condition.field,keywords:hits});
    return hits.length>0;
   });
   if(!all)return;
   var name=item&&item.name!=null?String(item.name).trim():'',nameKeywords=[];
   (rule.match||[]).forEach(function(condition){
    if(condition.field==='name'||condition.field==='text')nameKeywords=nameKeywords.concat(condition.any||[]);
   });
   candidates.push({categoryId:rule.categoryId,categoryName:library.categoryName(source,rule.categoryId),
    matchLevel:name&&nameKeywords.indexOf(name)>=0?'exact':'partial',ruleId:rule.id,basis:rule.basis||null,matched:matched});
   reasons.push('命中规则“'+rule.id+'”：'+matched.map(function(hit){return hit.field+'包含'+hit.keywords.join('、');}).join('；')
     +(rule.basis?'（依据：'+rule.basis+'）':''));
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
