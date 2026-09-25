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
 var KIND_OF_STAGE={import:'source',review:'review',merge:'merge',classification:'classification',brand:'brand',generation:'generation',split:'split'};
 var BRAND_COVERAGE=['pending','alternative-quotes','material-subsets'];
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
 function create(input,mergeIdentical,options){
  var entries=input&&input.entries||[],stages={};
  STAGES.forEach(function(stage,index){stages[stage]={state:index===0?'ready':'missing',revision:index===0?1:null,updatedAt:index===0?now():null,detail:null};});
  var requested=options&&options.projectId;
  return {schemaVersion:SCHEMA_VERSION,projectId:requested?String(requested):newId(),
   name:entries.length?String(entries[0].metadata.originalName).replace(/\.[^.]+$/,''):'未命名项目',
   createdAt:now(),updatedAt:now(),revision:1,mergeIdentical:!!mergeIdentical,stages:stages,
   sources:sourcesOf(input),mergeKey:null,
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
  if(project.mergeKey!=null&&(typeof project.mergeKey!=='string'||!project.mergeKey))errors.push('合并确认记录无效。');
  ['assignments','header','generation','split'].forEach(function(field){
   var value=project[field];
   if(value==null)return;
   if(typeof value!=='object'||Array.isArray(value)){errors.push(field+'字段无效。');return;}
   if(value.schemaVersion!=null&&value.schemaVersion!==1)errors.push(field+'内部版本不支持：'+String(value.schemaVersion));
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
 function invalidateStage(project,stage,detail){
  if(!KIND_OF_STAGE[stage])throw Error('无法识别的项目阶段：'+String(stage));
  return invalidate(project,{kind:KIND_OF_STAGE[stage],detail:detail||null});
 }
 // 固定字段顺序：对象键一律排序、数组保持原序，保证同一内容得到同一个键。
 function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
   var out={};
   Object.keys(value).sort().forEach(function(key){
    if(value[key]===undefined)return;
    out[key]=canonical(value[key]);
   });
   return out;
  }
  return value===undefined?null:value;
 }
 function contentSnapshot(options){
  var input=options||{};
  var sources=(((input.collection&&input.collection.entries)||[]).map(function(entry){
   var metadata=entry.metadata||{},record=entry.record||{};
   return {name:metadata.originalName||'',fingerprint:String(metadata.fingerprint||'').toLowerCase(),
    review:record.decisions||[]};
  }));
  var classification=(((input.classification&&input.classification.decisions)||[]).map(function(decision){
   return {rowId:decision.rowId,categoryId:decision.categoryId,skip:decision.skip===true,
    categoryName:decision.categoryName,matchLevel:decision.matchLevel};
  })).sort(function(left,right){return String(left.rowId).localeCompare(String(right.rowId));});
  var assignments=input.assignments?{coverageMode:input.assignments.coverageMode,
   assignments:((input.assignments.assignments)||[]).map(function(assignment){
    return {assignmentId:assignment.assignmentId,categoryId:assignment.categoryId,rowIds:assignment.rowIds,
     brand:assignment.brand,supplier:assignment.supplier,note:assignment.note,
     coverageConfirmed:assignment.coverageConfirmed===true};
   })}:null;
  return canonical({version:1,mergeIdentical:input.mergeIdentical===true,sources:sources,
   classification:classification,assignments:assignments,header:input.header||null});
 }
 function digest(text){
  var first=0x811c9dc5,second=0x9e3779b9,index,code;
  for(index=0;index<text.length;index++){
   code=text.charCodeAt(index);
   first=Math.imul(first^code,0x01000193)>>>0;
   second=Math.imul(second^code,0x85ebca6b)>>>0;
  }
  return ('0000000'+first.toString(16)).slice(-8)+('0000000'+second.toString(16)).slice(-8);
 }
 function contentKey(options){return 'ck1-'+digest(JSON.stringify(contentSnapshot(options)));}
 function assess(options){
  var input=options||{},collection=input.collection||{entries:[]},entries=collection.entries||[];
  var invalidSources=entries.filter(function(entry){
   var metadata=entry.metadata||{},snapshot=entry.snapshot||{};
   return !metadata.originalPath||!metadata.originalName||!metadata.copyPath||
    !/^[a-f\d]{64}$/i.test(String(metadata.fingerprint||''))||!snapshot.sheets;
  }).length;
  var importReady=entries.length>0&&invalidSources===0;
  var preview=input.preview||null;
  var reviewReady=importReady&&!!preview&&preview.canFinalize===true&&(preview.issues||[]).length===0;
  var mergeIdentical=input.mergeIdentical===true;
  var mergeKey=contentKey({collection:collection,mergeIdentical:mergeIdentical});
  var mergeReady=reviewReady&&typeof input.mergeConfirmedKey==='string'&&input.mergeConfirmedKey===mergeKey;
  var classifier=input.classification&&Array.isArray(input.classification.decisions)?input.classification:null;
  var decided={};
  if(classifier)classifier.decisions.forEach(function(decision){if(decision&&decision.rowId)decided[decision.rowId]=true;});
  var rows=Array.isArray(input.rows)?input.rows:[];
  var pending=rows.filter(function(row){return !row||!decided[row.rowId];}).length;
  var classificationReady=mergeReady&&rows.length>0&&pending===0;
  var brandVerdict=input.brand||null;
  var brandReady=classificationReady&&!!brandVerdict&&brandVerdict.ready===true;
  var generationVerdict=input.generation||null;
  var generationReady=brandReady&&!!generationVerdict&&generationVerdict.ready===true;
  var splitVerdict=input.split||null;
  var splitReady=generationReady&&!!splitVerdict&&splitVerdict.ready===true;
  var brandKey=contentKey({collection:collection,mergeIdentical:mergeIdentical,classification:classifier});
  var generationKey=contentKey({collection:collection,mergeIdentical:mergeIdentical,classification:classifier,
   assignments:input.assignments||null,header:input.header||null});
  var issues=(preview&&preview.issues||[]).length;
  return {
   import:{ready:importReady,detail:importReady?('已导入'+entries.length+'份清单'):(invalidSources?'有'+invalidSources+'份导入记录不完整':'尚未导入清单')},
   review:{ready:reviewReady,detail:reviewReady?'来源问题已清零':(preview?(issues+'个待核对问题'):'尚未生成合并预览')},
   merge:{ready:mergeReady,detail:mergeReady?('已确认'+(mergeIdentical?'精确合并':'分别保留')+'预览'):(reviewReady?'本次预览尚未确认':'来源核对未完成')},
   classification:{ready:classificationReady,detail:classificationReady?('已确认'+rows.length+'行分类'):(mergeReady?('还有'+pending+'行未确认分类'):'合并预览未确认')},
   brand:{ready:brandReady,detail:brandReady?'品牌、供应商与抬头已确认':(classificationReady?'品牌、范围或抬头未确认':'分类未全部确认')},
   generation:{ready:generationReady,detail:generationReady?'询价表已生成并校验':(brandReady?'尚未生成总询价工作簿':'品牌与抬头未确认')},
   split:{ready:splitReady,detail:splitReady?'拆分已完成并核对':(generationReady?'尚未完成拆分':'尚未生成总询价工作簿')},
   mergeKey:mergeKey,mergeIdentical:mergeIdentical,brandKey:brandKey,generationKey:generationKey,rowCount:rows.length,pending:pending};
 }
 // 只把能证明完成的阶段置为ready；一旦上游断裂，从该阶段起取消ready并让下游过期。
 function sync(project,report){
  var next=project,broken=null,index,stage;
  for(index=0;index<STAGES.length&&broken===null;index++){
   stage=STAGES[index];
   if(!(report&&report[stage]&&report[stage].ready===true))broken=stage;
  }
  var cut=broken===null?STAGES.length:STAGES.indexOf(broken),current;
  for(index=0;index<cut;index++){
   current=STAGES[index];
   if(next.stages[current].state!=='ready')
    next=confirm(next,current,report&&report[current]?report[current].detail:null);
  }
  if(broken!==null){
   var stale=STAGES.slice(cut).some(function(name){return next.stages[name].state==='ready';});
   if(stale)next=invalidateStage(next,broken,report&&report[broken]?report[broken].detail:null);
  }
  return next;
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,STAGES:STAGES.slice(),STAGE_LABELS:STAGE_LABELS,create:create,validate:validate,
  assertValid:assertValid,stageState:stageState,confirm:confirm,invalidate:invalidate,compareSources:compareSources,refresh:refresh,
  newId:newId,invalidateStage:invalidateStage,contentSnapshot:contentSnapshot,contentKey:contentKey,assess:assess,sync:sync,
  KIND_OF_STAGE:KIND_OF_STAGE,BRAND_COVERAGE:BRAND_COVERAGE.slice()};
}));
