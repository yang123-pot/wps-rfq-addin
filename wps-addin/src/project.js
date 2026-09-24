(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqProject=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1;
 var STAGES=['import','review','merge','classification','brand','generation','split'];
 var STAGE_LABELS={import:'导入清单',review:'来源核对',merge:'合并确认',classification:'分类确认',brand:'品牌与抬头',generation:'生成询价表',split:'拆分文件'};
 var OWNER={source:'import',review:'review',merge:'merge',classification:'classification',brand:'brand',header:'brand',generation:'generation',split:'split'};
 function now(){return new Date().toISOString();}
 function newId(){return 'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function stageIndex(stage){var index=STAGES.indexOf(stage);if(index<0)throw Error('无法识别的项目阶段：'+stage);return index;}
 function sourcesOf(collection){
  return ((collection&&collection.entries)||[]).map(function(entry){
   var meta=entry.metadata||{},snapshot=entry.snapshot||{};
   return {id:entry.id,originalPath:meta.originalPath,originalName:meta.originalName,copyPath:meta.copyPath,fingerprint:meta.fingerprint,
    sheetCount:(snapshot.sheets||[]).length,materialCount:(snapshot.materials||[]).length,issueCount:(snapshot.issues||[]).length,snapshot:snapshot};
  });
 }
 function create(input,mergeIdentical){
  var entries=input&&input.entries||[],stages={};
  STAGES.forEach(function(stage,index){stages[stage]={state:index===0?'ready':'missing',revision:index===0?1:null,updatedAt:index===0?now():null,detail:null};});
  return {schemaVersion:SCHEMA_VERSION,projectId:newId(),
   name:entries.length?String(entries[0].metadata.originalName).replace(/\.[^.]+$/,''):'未命名项目',
   createdAt:now(),updatedAt:now(),revision:1,mergeIdentical:!!mergeIdentical,stages:stages,
   sources:sourcesOf(input),
   review:null,classification:null,assignments:null,header:null,generation:null,split:null,history:[]};
 }
 function validate(project){
  var errors=[];
  if(!project||typeof project!=='object'||Array.isArray(project))return {ok:false,errors:['项目记录不是有效对象。']};
  if(project.schemaVersion!==SCHEMA_VERSION)errors.push('项目记录版本不支持：'+String(project.schemaVersion));
  if(typeof project.projectId!=='string'||!/^[a-z0-9-]{8,64}$/.test(project.projectId))errors.push('项目编号无效。');
  if(!Number.isSafeInteger(project.revision)||project.revision<1)errors.push('项目版本号无效。');
  if(typeof project.name!=='string'||!project.name)errors.push('项目名称缺失。');
  if(typeof project.mergeIdentical!=='boolean')errors.push('合并选择缺失。');
  if(!project.stages||typeof project.stages!=='object'||STAGES.some(function(stage){
   var record=project.stages[stage];
   return !record||['ready','missing','stale'].indexOf(record.state)<0;
  }))errors.push('项目阶段记录缺失或无效。');
  if(!Array.isArray(project.sources))errors.push('来源列表缺失。');
  else project.sources.forEach(function(source,index){
   var at='第'+(index+1)+'个来源';
   if(!source||typeof source!=='object'){errors.push(at+'记录无效。');return;}
   if(typeof source.id!=='string'||!source.id)errors.push(at+'缺少标识。');
   if(typeof source.originalPath!=='string'||!source.originalPath)errors.push(at+'缺少原件路径。');
   if(typeof source.originalName!=='string'||!source.originalName)errors.push(at+'缺少原件名称。');
   if(typeof source.copyPath!=='string'||!source.copyPath)errors.push(at+'缺少工作副本路径。');
   if(typeof source.fingerprint!=='string'||!/^[a-f\d]{64}$/i.test(source.fingerprint))errors.push(at+'指纹无效。');
  });
  return {ok:errors.length===0,errors:errors};
 }
 function assertValid(project){var check=validate(project);if(!check.ok)throw Error('项目记录不完整或版本不支持：'+check.errors.join('；'));return project;}
 function stageState(project,stage){stageIndex(stage);return (project.stages&&project.stages[stage]||{}).state;}
 function confirm(project,stage,detail){
  stageIndex(stage);
  var next=copy(project);
  next.stages[stage]={state:'ready',revision:project.revision,updatedAt:now(),detail:detail||null};
  next.updatedAt=now();
  return next;
 }
 function invalidate(project,change){
  var kind=change&&change.kind;
  if(!OWNER[kind])throw Error('无法识别的变更类型：'+String(kind));
  var index=stageIndex(OWNER[kind]),next=copy(project);
  next.revision=project.revision+1;next.updatedAt=now();
  STAGES.slice(index).forEach(function(stage,position){
   var previous=next.stages[stage]||{};
   next.stages[stage]=position===0?{state:'missing',revision:null,updatedAt:now(),detail:change.detail||null}
    :{state:previous.state==='missing'?'missing':'stale',revision:previous.revision||null,updatedAt:previous.updatedAt||null,detail:previous.detail||null};
  });
  next.history=(next.history||[]).concat([{revision:next.revision,at:next.updatedAt,kind:kind,detail:change.detail||null,sourceId:change.sourceId||null}]);
  return next;
 }
 function compareSources(project,collection){
  var current={},added=[],changed=[],removed=[],seen={};
  ((collection&&collection.entries)||[]).forEach(function(entry){current[entry.metadata.originalPath]=entry;});
  (project.sources||[]).forEach(function(source){
   seen[source.originalPath]=true;
   var entry=current[source.originalPath];
   if(!entry){removed.push(source.originalPath);return;}
   if(entry.metadata.fingerprint!==source.fingerprint)changed.push(source.originalPath);
  });
  Object.keys(current).forEach(function(key){if(!seen[key])added.push(key);});
  return {added:added,changed:changed,removed:removed};
 }
 function refresh(project,collection,mergeIdentical){
  var next=copy(project),comparison=compareSources(project,collection);
  next.sources=sourcesOf(collection);
  if(comparison.added.length||comparison.removed.length||comparison.changed.length)
   next=invalidate(next,{kind:'source',detail:'来源变化：新增'+comparison.added.length+'、变更'+comparison.changed.length+'、移除'+comparison.removed.length});
  if(!!mergeIdentical!==!!project.mergeIdentical){
   next.mergeIdentical=!!mergeIdentical;
   next=invalidate(next,{kind:'merge',detail:mergeIdentical?'改为精确合并':'改为分别保留'});
  }
  next.updatedAt=now();
  return next;
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,STAGES:STAGES.slice(),STAGE_LABELS:STAGE_LABELS,create:create,validate:validate,
  assertValid:assertValid,stageState:stageState,confirm:confirm,invalidate:invalidate,compareSources:compareSources,refresh:refresh};
}));
