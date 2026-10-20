(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqCategoryMemory=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,LEVELS={exact:'完全匹配',similar:'相近匹配'};
 function now(){return new Date().toISOString();}
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function text(value){return value==null?'':String(value).trim();}
 function signature(item){return [text(item&&item.name),text(item&&item.feature),text(item&&item.unit)].join('\u0000');}
 function sourceRef(decision,context){
  return {sourceProjectId:context.sourceProjectId!=null?text(context.sourceProjectId):null,
   sourceRowId:text(decision.rowId||context.rowId)||null,
   decisionRevision:decision.revision==null?null:decision.revision};
 }
 function sourceKey(reference){return [text(reference&&reference.sourceProjectId),text(reference&&reference.sourceRowId)].join('\u0001');}
 function scopeOf(context){return context.scope==='project'?'project':'global';}
 function scopeProject(scope,context){return scope==='project'?(context.projectId||null):null;}
 function matchRecord(memory,scope,projectId,categoryId,item){
  return memory.memories.filter(function(record){
   return record.state==='active'&&record.scope===scope&&record.projectId===projectId&&
    record.categoryId===categoryId&&signature(record.item)===signature(item);})[0];
 }
 function create(){return {schemaVersion:SCHEMA_VERSION,version:'local-1',updatedAt:now(),memories:[],history:[]};}
 function validate(memory){
  var errors=[];
  if(!memory||typeof memory!=='object'||Array.isArray(memory))return {ok:false,errors:['习惯记忆不是有效对象。']};
  if(memory.schemaVersion!==SCHEMA_VERSION)errors.push('习惯记忆版本不支持：'+String(memory.schemaVersion));
  if(typeof memory.version!=='string'||!memory.version.trim())errors.push('习惯记忆缺少版本标识。');
  if(!Array.isArray(memory.memories))errors.push('习惯记忆缺少记录列表。');
  else memory.memories.forEach(function(record,index){
   var at='第'+(index+1)+'条记忆';
   if(!record||typeof record!=='object'||Array.isArray(record)){errors.push(at+'无效。');return;}
   if(typeof record.id!=='string'||!record.id)errors.push(at+'缺少标识。');
   if(typeof record.categoryId!=='string'||!record.categoryId)errors.push(at+'缺少类别。');
   if(!record.item||typeof record.item!=='object')errors.push(at+'缺少材料字段。');
   if(['active','revoked'].indexOf(record.state)<0)errors.push(at+'状态无效。');
   if(record.sources!=null&&!Array.isArray(record.sources))errors.push(at+'确认来源无效。');
   if(record.scope!=null&&['global','project'].indexOf(record.scope)<0)errors.push(at+'适用范围无效。');
  });
  if(!Array.isArray(memory.history))errors.push('习惯记忆缺少变更历史。');
  return {ok:errors.length===0,errors:errors};
 }
 function assertValid(memory){var check=validate(memory);if(!check.ok)throw Error('习惯记忆不完整：'+check.errors.join('；'));return memory;}
 function newId(){return 'm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
 function learn(memory,decision,context){
  assertValid(memory);
  if(!decision||typeof decision!=='object'||typeof decision.categoryId!=='string'||!decision.categoryId||!decision.confirmedAt)
   throw Error('只有人工确认的分类才能写入习惯记忆。');
  context=context||{};
  var item={name:text(context.item&&context.item.name),feature:text(context.item&&context.item.feature),unit:text(context.item&&context.item.unit)};
  if(!item.name)throw Error('记忆需要材料名称。');
  var scope=scopeOf(context),projectId=scopeProject(scope,context);
  if(scope==='project'&&!projectId)throw Error('项目例外记忆需要项目标识。');
  var source=sourceRef(decision,context),existing=matchRecord(memory,scope,projectId,decision.categoryId,item);
  if(existing){
   var known=(Array.isArray(existing.sources)?existing.sources:[]).some(function(reference){
    return sourceKey(reference)===sourceKey(source);});
   if(known)return memory;
   var grown=copy(memory);
   grown.memories=grown.memories.map(function(record){
    if(record.id!==existing.id)return record;
    var merged=Object.assign({},record,{sources:(Array.isArray(record.sources)?record.sources:[]).concat([source])});
    if(merged.sourceRowId==null)merged.sourceRowId=source.sourceRowId;
    if(merged.decisionRevision==null)merged.decisionRevision=source.decisionRevision;
    return merged;
   });
   grown.updatedAt=now();
   grown.history=(grown.history||[]).concat([{at:grown.updatedAt,action:'learn-source',categoryId:decision.categoryId,
    scope:scope,projectId:projectId,sourceProjectId:source.sourceProjectId,sourceRowId:source.sourceRowId}]);
   return grown;
  }
  var next=copy(memory);
  next.memories=next.memories.concat([{id:newId(),item:item,categoryId:decision.categoryId,
   categoryName:decision.categoryName||decision.categoryId,scope:scope,projectId:projectId,
   sourceRowId:decision.rowId||null,libraryVersion:decision.libraryVersion||context.libraryVersion||null,
   decisionRevision:decision.revision==null?null:decision.revision,sources:[source],state:'active',learnedAt:now()}]);
  next.updatedAt=now();
  next.history=(next.history||[]).concat([{at:next.updatedAt,action:'learn',categoryId:decision.categoryId,scope:scope,
   projectId:projectId,sourceProjectId:source.sourceProjectId,sourceRowId:source.sourceRowId}]);
  return next;
 }
 function releaseSource(memory,decision,context){
  assertValid(memory);
  if(!decision||typeof decision!=='object'||typeof decision.categoryId!=='string'||!decision.categoryId)
   throw Error('撤销习惯需要原类别。');
  context=context||{};
  var item={name:text(context.item&&context.item.name),feature:text(context.item&&context.item.feature),unit:text(context.item&&context.item.unit)};
  if(!item.name)return memory;
  var scope=scopeOf(context),projectId=scopeProject(scope,context);
  var target=matchRecord(memory,scope,projectId,decision.categoryId,item);
  if(!target||!Array.isArray(target.sources))return memory;
  var source=sourceRef(decision,context),removeKey=sourceKey(source);
  var remaining=target.sources.filter(function(reference){return sourceKey(reference)!==removeKey;});
  if(remaining.length===target.sources.length)return memory;
  var revoked=remaining.length===0,next=copy(memory);
  next.memories=next.memories.map(function(record){
   if(record.id!==target.id)return record;
   if(revoked)return Object.assign({},record,{sources:remaining,state:'revoked',revokedAt:now()});
   return Object.assign({},record,{sources:remaining});
  });
  next.updatedAt=now();
  next.history=(next.history||[]).concat([{at:next.updatedAt,action:revoked?'release-revoke':'release-source',
   categoryId:decision.categoryId,scope:scope,projectId:projectId,sourceProjectId:source.sourceProjectId,
   sourceRowId:source.sourceRowId}]);
  return next;
 }
 function revoke(memory,memoryId){
  assertValid(memory);
  var target=memory.memories.filter(function(record){return record.id===memoryId&&record.state==='active';})[0];
  if(!target)return memory;
  var next=copy(memory);
  next.memories=next.memories.map(function(record){
   if(record.id!==memoryId)return record;
   return {...record,state:'revoked',revokedAt:now()};
  });
  next.updatedAt=now();
  next.history=(next.history||[]).concat([{at:next.updatedAt,action:'revoke',memoryId:memoryId,categoryId:target.categoryId}]);
  return next;
 }
 var compactIndexes=new WeakMap();
 function indexedRecords(memory,target,context){
  var index=compactIndexes.get(memory);
  if(!index){assertValid(memory);index={exact:new Map(),names:new Map()};
   memory.memories.forEach(function(r){if(r.state!=='active')return;var key=signature(r.item),name=text(r.item.name);
    if(!index.exact.has(key))index.exact.set(key,[]);index.exact.get(key).push(r);
    if(!index.names.has(name))index.names.set(name,[]);index.names.get(name).push(r);});compactIndexes.set(memory,index);}
  function visible(r){return r.scope!=='project'||r.projectId===(context.projectId||null);}
  var exact=(index.exact.get(signature(target))||[]).filter(visible);
  return exact.length?exact:(index.names.get(target.name)||[]).filter(visible);
 }
 function find(memory,item,context){
  if(!memory||!memory.compact)assertValid(memory);
  context=context||{};
  var target={name:text(item&&item.name),feature:text(item&&item.feature),unit:text(item&&item.unit)},
    candidates=[];
  (memory.compact?indexedRecords(memory,target,context):memory.memories).forEach(function(record){
   if(record.state!=='active')return;
   if(record.scope==='project'&&record.projectId!==(context.projectId||null))return;
   var level=null;
   if(signature(record.item)===signature(target))level='exact';
   else if(record.item.name&&record.item.name===target.name)level='similar';
   if(!level)return;
   candidates.push({memoryId:record.id,categoryId:record.categoryId,categoryName:record.categoryName,matchLevel:level,
    basis:(record.scope==='project'?'本项目习惯记忆：':'本机习惯记忆：')+record.item.name+'→'+record.categoryName,
    learnedAt:record.learnedAt,sourceRowId:record.sourceRowId});
  });
  var distinct=[],seen={};
  candidates.forEach(function(candidate){
   if(seen[candidate.categoryId])return;seen[candidate.categoryId]=true;distinct.push(candidate);});
  return {candidates:candidates,conflicts:distinct.length>1?distinct:[],matchLevel:distinct.length===0?'none':
    (candidates.some(function(candidate){return candidate.matchLevel==='exact';})?'exact':'similar'),
   requiresConfirmation:true};
 }
 function summary(memory){
  assertValid(memory);
  var active=memory.memories.filter(function(record){return record.state==='active';});
  return {total:memory.memories.length,active:active.length,revoked:memory.memories.length-active.length,
   byCategory:active.reduce(function(out,record){out[record.categoryId]=(out[record.categoryId]||0)+1;return out;},{}),
   sourceCount:active.reduce(function(total,record){return total+(Array.isArray(record.sources)?record.sources.length:0);},0)};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,LEVELS:LEVELS,create:create,validate:validate,assertValid:assertValid,
  learn:learn,releaseSource:releaseSource,revoke:revoke,find:find,summary:summary,signature:signature};
}));
