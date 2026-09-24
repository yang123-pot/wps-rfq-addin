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
  var scope=context.scope==='project'?'project':'global',projectId=scope==='project'?(context.projectId||null):null;
  if(scope==='project'&&!projectId)throw Error('项目例外记忆需要项目标识。');
  var existing=memory.memories.filter(function(record){
   return record.state==='active'&&record.scope===scope&&record.projectId===projectId&&
    record.categoryId===decision.categoryId&&signature(record.item)===signature(item);})[0];
  if(existing)return memory;
  var next=copy(memory);
  next.memories=next.memories.concat([{id:newId(),item:item,categoryId:decision.categoryId,
   categoryName:decision.categoryName||decision.categoryId,scope:scope,projectId:projectId,
   sourceRowId:decision.rowId||null,libraryVersion:decision.libraryVersion||context.libraryVersion||null,
   decisionRevision:decision.revision==null?null:decision.revision,state:'active',learnedAt:now()}]);
  next.updatedAt=now();
  next.history=(next.history||[]).concat([{at:next.updatedAt,action:'learn',categoryId:decision.categoryId,scope:scope,projectId:projectId}]);
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
 function find(memory,item,context){
  assertValid(memory);
  context=context||{};
  var target={name:text(item&&item.name),feature:text(item&&item.feature),unit:text(item&&item.unit)},
    candidates=[];
  memory.memories.forEach(function(record){
   if(record.state!=='active')return;
   if(record.scope==='project'&&record.projectId!==(context.projectId||null))return;
   var level=null;
   if(signature(record.item)===signature(target))level='exact';
   else if(record.item.name&&record.item.name===target.name)level='similar';
   if(!level)return;
   candidates.push({memoryId:record.id,categoryId:record.categoryId,categoryName:record.categoryName,matchLevel:level,
    basis:'项目'+(record.scope==='project'?'例外':'').replace('项目例外','例外')+'记忆：'+record.item.name+'→'+record.categoryName,
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
   byCategory:active.reduce(function(out,record){out[record.categoryId]=(out[record.categoryId]||0)+1;return out;},{})};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,LEVELS:LEVELS,create:create,validate:validate,assertValid:assertValid,
  learn:learn,revoke:revoke,find:find,summary:summary};
}));
