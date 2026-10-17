(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./review.js'));
 else root.RfqProject=factory(root.RfqReview);
}(typeof window==='object'?window:globalThis,function(sourceReview){
 'use strict';
 // v2：7阶段（导入与合并/自动分类/表内审核/分类工作簿/品牌汇总/询价表/拆分文件）。
 // v1记录仍可读取，但只能作为副本继续，原文件不被改写。
 var SCHEMA_VERSION=2,LEGACY_SCHEMA_VERSION=1;
 var STAGES=['import','matching','review','categories','brands','inquiry','split'];
 var STAGE_LABELS={import:'导入与合并',matching:'自动分类',review:'表内审核',categories:'分类工作簿',
  brands:'品牌汇总',inquiry:'询价表',split:'拆分文件'};
 var LEGACY_STAGES=['import','review','merge','classification','brand','generation','split'];
 var LEGACY_LABELS={import:'导入清单',review:'来源核对',merge:'合并确认',classification:'分类确认',
  brand:'品牌与抬头',generation:'生成询价表',split:'拆分文件'};
 // 变更类型→第一个需要重做的阶段：该阶段置为未完成，其后已确认的阶段置为过期。
 // 来源/合并变动→匹配及之后失效；最终分类变动→分类工作簿及之后失效；品牌/方式/抬头变动→询价/拆分失效。
 var OWNER={source:'import',merge:'import',matching:'matching',review:'review',categories:'categories',
  brands:'brands',header:'inquiry',inquiry:'inquiry',split:'split'};
 var KIND_OF_STAGE={import:'source',matching:'matching',review:'review',categories:'categories',
  brands:'brands',inquiry:'inquiry',split:'split'};
 // review是整表审核确认快照；reviewDraft是“保存审核成果”的草稿（都不代表下游已完成）。
 var FUTURE_FIELDS=['matching','review','reviewDraft','categories','summary','brands','inquiry','split','header'];
 // R1过渡期旧侧栏仍在使用的暂存字段；内部版本未知时同样必须拒绝，防止误读。
 var INTERIM_FIELDS=['classification','assignments','generation'];
  // 每个阶段的业务键包含哪些确认内容；所有键都含来源、合并方式与材料行。
  // 2026-10-11（图04/05变更“一本多页”）：分类与汇总阶段的输出是同一本工作簿，
  // 业务键改为“1 文件 + 逐页行数（含第 1 页汇总页）”，文件或任一页行数变化都必须让汇总及下游过期。
  var KEY_CONTENT={import:[],matching:[],review:['review'],categories:['review','output'],
   summary:['review','output'],brands:['review'],inquiry:['review','brands','header'],split:['review','brands','header']};
 var BRAND_COVERAGE=['pending','alternative-quotes','material-subsets'];
 var ID_PATTERN=/^[a-z0-9-]{8,64}$/;

 function now(){return new Date().toISOString();}
 function newId(){return 'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function text(value){return value==null?'':String(value);}
 function stageIndex(stage){var index=STAGES.indexOf(stage);if(index<0)throw Error('无法识别的项目阶段：'+String(stage));return index;}
 function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
 function isLegacy(record){return isObject(record)&&record.schemaVersion===LEGACY_SCHEMA_VERSION;}
 function schemaOf(record){return isObject(record)&&Number.isSafeInteger(record.schemaVersion)?record.schemaVersion:null;}
 function emptyStages(){
  var stages={};
  STAGES.forEach(function(stage){stages[stage]={state:'missing',revision:null,updatedAt:null,detail:null};});
  return stages;
 }
 function scopeIdOf(source,mergeIdentical){
  if(mergeIdentical)return 'combined';
  return text(source&&source.id);
 }
 function sourcesOf(collection){
  return ((collection&&collection.entries)||[]).map(function(entry){
   var meta=entry.metadata||{},snapshot=entry.snapshot||{};
   var source={id:entry.id,originalPath:meta.originalPath,originalName:meta.originalName,copyPath:meta.copyPath,
    fingerprint:meta.fingerprint,scopeId:text(entry.id),
    sheetCount:(snapshot.sheets||[]).length,materialCount:(snapshot.materials||[]).length,
    issueCount:(snapshot.issues||[]).length,snapshot:snapshot};
   // 来源核对与整表分类确认各自保存；无核对的旧项目保持原结构。
   if(entry.record&&entry.record.decisions&&entry.record.decisions.length)source.reviewRecord=copy(entry.record);
   return source;
  });
 }
 function blankRecord(name,mergeIdentical,options){
  var input=options||{},requested=input.projectId;
  return {schemaVersion:SCHEMA_VERSION,projectId:requested?String(requested):newId(),
   name:name||'未命名项目',createdAt:now(),updatedAt:now(),revision:0,
   fromProjectId:input.fromProjectId?String(input.fromProjectId):null,
   mergeIdentical:!!mergeIdentical,mergeAllWorkbooks:input.mergeAllWorkbooks===true,stages:emptyStages(),sources:[],mergeKey:null,
   matching:null,review:null,categories:null,summary:null,brands:null,inquiry:null,split:null,header:null,carried:null,history:[]};
 }
 function create(input,mergeIdentical,options){
  var entries=(input&&input.entries)||[];
  var name=entries.length?String(entries[0].metadata.originalName).replace(/\.[^.]+$/,''):'未命名项目';
  var next=blankRecord(name,mergeIdentical,options);
  next.sources=sourcesOf(input).map(function(source){
   source.scopeId=scopeIdOf(source,next.mergeIdentical);
   return source;
  });
  return next;
 }
 // 把合并预览的分组规范成“稳定ID＋业务字段”的行快照，供业务键统一使用。
 function rowsFromPreview(preview){
  return ((preview&&preview.groups)||[]).map(function(group){
   return {rowId:text(group.id||group.scopeId),scopeId:group.scopeId==null?null:text(group.scopeId),
    name:text(group.name),feature:text(group.feature),unit:text(group.unit),
    quantity:group.quantity==null?null:text(group.quantity),
    sourceIds:((group.sources||[]).map(function(source){return text(source.id);}))};
  });
 }
 function validateSources(sources,errors){
  if(!Array.isArray(sources)){errors.push('来源列表缺失。');return;}
  sources.forEach(function(source,index){
   var at='第'+(index+1)+'个来源';
   if(!isObject(source)){errors.push(at+'记录无效。');return;}
   if(typeof source.id!=='string'||!source.id)errors.push(at+'缺少标识。');
   if(typeof source.originalPath!=='string'||!source.originalPath)errors.push(at+'缺少原件路径。');
   if(typeof source.originalName!=='string'||!source.originalName)errors.push(at+'缺少原件名称。');
   if(typeof source.copyPath!=='string'||!source.copyPath)errors.push(at+'缺少工作副本路径。');
   if(typeof source.fingerprint!=='string'||!/^[a-f\d]{64}$/i.test(source.fingerprint))errors.push(at+'指纹无效。');
   if(source.reviewRecord!=null){
    try{sourceReview.apply(source.snapshot,source.reviewRecord);}
    catch(error){errors.push(at+'来源核对记录无效：'+error.message);}
   }
  });
 }
 function validateStages(project,names,errors){
  var stages=project.stages;
  if(!isObject(stages)){errors.push('项目阶段记录缺失或无效。');return;}
  if(names.some(function(stage){
   var record=stages[stage];
   return !isObject(record)||['ready','missing','stale'].indexOf(record.state)<0;
  }))errors.push('项目阶段记录缺失或无效。');
 }
 function validateFutureFields(project,errors){
  FUTURE_FIELDS.concat(INTERIM_FIELDS).forEach(function(field){
   var value=project[field];
   if(value==null)return;
   if(!isObject(value)){errors.push(field+'字段无效。');return;}
   if(value.schemaVersion!=null&&value.schemaVersion!==1)errors.push(field+'内部版本不支持：'+String(value.schemaVersion));
  });
  if(project.carried!=null&&!isObject(project.carried))errors.push('carried字段无效。');
 }
 function validateV2(project){
  var errors=[];
  if(typeof project.projectId!=='string'||!ID_PATTERN.test(project.projectId))errors.push('项目编号无效。');
  if(!Number.isSafeInteger(project.revision)||project.revision<0)errors.push('项目版本号无效。');
  if(typeof project.name!=='string'||!project.name)errors.push('项目名称缺失。');
  if(typeof project.mergeIdentical!=='boolean')errors.push('合并选择缺失。');
  if(project.mergeAllWorkbooks!=null&&typeof project.mergeAllWorkbooks!=='boolean')errors.push('工作簿合并选择无效。');
  if(project.fromProjectId!=null&&(typeof project.fromProjectId!=='string'||!ID_PATTERN.test(project.fromProjectId)))
   errors.push('上游项目编号无效。');
  validateStages(project,STAGES,errors);
  validateSources(project.sources,errors);
  if(project.mergeKey!=null&&(typeof project.mergeKey!=='string'||!project.mergeKey))errors.push('合并确认记录无效。');
  validateFutureFields(project,errors);
  if(project.history!=null&&!Array.isArray(project.history))errors.push('项目变更历史无效。');
  return errors;
 }
 function validateV1(project){
  var errors=[];
  if(typeof project.projectId!=='string'||!ID_PATTERN.test(project.projectId))errors.push('项目编号无效。');
  if(!Number.isSafeInteger(project.revision)||project.revision<1)errors.push('项目版本号无效。');
  if(typeof project.name!=='string'||!project.name)errors.push('项目名称缺失。');
  if(typeof project.mergeIdentical!=='boolean')errors.push('合并选择缺失。');
  validateStages(project,LEGACY_STAGES,errors);
  validateSources(project.sources,errors);
  if(project.mergeKey!=null&&(typeof project.mergeKey!=='string'||!project.mergeKey))errors.push('合并确认记录无效。');
  ['review','classification','assignments','header','generation','split'].forEach(function(field){
   var value=project[field];
   if(value==null)return;
   if(!isObject(value)){errors.push(field+'字段无效。');return;}
   if(value.schemaVersion!=null&&value.schemaVersion!==1)errors.push(field+'内部版本不支持：'+String(value.schemaVersion));
  });
  return errors;
 }
 function validate(project){
  if(!isObject(project))return {ok:false,errors:['项目记录不是有效对象。']};
  var version=project.schemaVersion,errors;
  if(version===SCHEMA_VERSION)errors=validateV2(project);
  else if(version===LEGACY_SCHEMA_VERSION)errors=validateV1(project);
  else return {ok:false,errors:['项目记录版本不支持：'+String(version)]};
  return {ok:errors.length===0,errors:errors};
 }
 function assertValid(project){var check=validate(project);if(!check.ok)throw Error('项目记录不完整或版本不支持：'+check.errors.join('；'));return project;}
 function assertEditable(project){
  if(isLegacy(project))throw Error('这是旧版(v1)项目记录，请先复制为新流程副本再继续，原文件不会被改写。');
  assertValid(project);
  return project;
 }
 function stageState(project,stage){stageIndex(stage);return (project.stages&&project.stages[stage]||{}).state;}
 function confirm(project,stage,detail){
  stageIndex(stage);
  var next=copy(project);
  next.stages[stage]={state:'ready',revision:project.revision,updatedAt:now(),detail:detail||null};
  next.updatedAt=now();
  return next;
 }
 // revision属于持久化乐观锁，只由项目库在保存成功时递增；内容变化只改阶段与历史。
 function invalidate(project,change){
  var kind=change&&change.kind;
  if(!OWNER[kind])throw Error('无法识别的变更类型：'+String(kind));
  var index=stageIndex(OWNER[kind]),next=copy(project);
  next.updatedAt=now();
  STAGES.slice(index).forEach(function(stage,position){
   var previous=next.stages[stage]||{};
   next.stages[stage]=position===0?{state:'missing',revision:null,updatedAt:now(),detail:change.detail||null}
    :{state:previous.state==='missing'?'missing':'stale',revision:previous.revision||null,updatedAt:previous.updatedAt||null,detail:previous.detail||null};
  });
  next.history=(next.history||[]).concat([{revision:next.revision,at:next.updatedAt,kind:kind,
   detail:change.detail||null,sourceId:change.sourceId||null}]);
  return next;
 }
 function invalidateStage(project,stage,detail){
  if(!KIND_OF_STAGE[stage])throw Error('无法识别的项目阶段：'+String(stage));
  return invalidate(project,{kind:KIND_OF_STAGE[stage],detail:detail||null});
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
 function refresh(project,collection,mergeIdentical,options){
  assertEditable(project);
  var next=copy(project),comparison=compareSources(project,collection),input=options||{},
    mergeAllWorkbooks=input.mergeAllWorkbooks===true;
  next.sources=sourcesOf(collection).map(function(source){
   source.scopeId=scopeIdOf(source,!!mergeIdentical);
   return source;
  });
  if(comparison.added.length||comparison.removed.length||comparison.changed.length)
   next=invalidate(next,{kind:'source',detail:'来源变化：新增'+comparison.added.length+'、变更'+comparison.changed.length+'、移除'+comparison.removed.length});
  if(!!mergeIdentical!==!!project.mergeIdentical){
   next.mergeIdentical=!!mergeIdentical;
   next=invalidate(next,{kind:'merge',detail:mergeIdentical?'改为精确合并':'改为分别保留'});
  }
  if(mergeAllWorkbooks!==!!project.mergeAllWorkbooks){
   next.mergeAllWorkbooks=mergeAllWorkbooks;
   next=invalidate(next,{kind:'merge',detail:mergeAllWorkbooks?'改为合并全部工作簿':'改为保留每个工作簿'});
  }
  next.updatedAt=now();
  return next;
 }
 // v1→v2：保留v1原文件，另建副本；只复用可验证的来源与分类草稿，品牌及下游一律重做。
 function upgradeV1(record,options){
  var check=validate(record);
  if(!check.ok||!isLegacy(record))throw Error('只有有效(v1)项目记录才能继续为新流程副本：'+(check.errors||[]).join('；'));
  var input=options||{},next=blankRecord(record.name,record.mergeIdentical===true,
   {projectId:input.projectId,fromProjectId:record.projectId});
  next.createdAt=record.createdAt||next.createdAt;
  next.sources=(record.sources||[]).map(function(source){
   var cloned=copy(source);
   cloned.scopeId=scopeIdOf(cloned,next.mergeIdentical);
   return cloned;
  });
  next.carried={classification:record.classification?copy(record.classification):null,
   review:record.review?copy(record.review):null,mergeKey:record.mergeKey||null};
  next.history=[{revision:0,at:next.updatedAt,kind:'upgrade',
   detail:'从v1项目'+record.projectId+'继续为新流程副本；旧品牌及下游不算完成，需重新整表确认',sourceId:record.projectId}];
  return next;
 }
 // 固定字段顺序：对象键排序、行按稳定ID排序，保证同一内容得到同一个键，表内排序不误判为内容变化。
 function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(isObject(value)){
   var out={};
   Object.keys(value).sort().forEach(function(key){
    if(value[key]===undefined)return;
    out[key]=canonical(value[key]);
   });
   return out;
  }
  return value===undefined?null:value;
 }
 function digest(input){
  var source=String(input),first=0x811c9dc5,second=0x9e3779b9,index,code;
  for(index=0;index<source.length;index++){
   code=source.charCodeAt(index);
   first=Math.imul(first^code,0x01000193)>>>0;
   second=Math.imul(second^code,0x85ebca6b)>>>0;
  }
  return ('0000000'+first.toString(16)).slice(-8)+('0000000'+second.toString(16)).slice(-8);
 }
 function normalizeRows(source){
  var list=[];
  if(Array.isArray(source))list=source;
  else if(isObject(source)&&Array.isArray(source.decisions))list=source.decisions;
  else if(isObject(source)&&Array.isArray(source.rows))list=source.rows;
  return list.map(function(row){
   var item=row||{};
   return {rowId:text(item.rowId),categoryId:text(item.categoryId),
    categoryName:text(item.categoryName),skip:item.skip===true,note:text(item.note)};
  }).filter(function(row){return !!row.rowId;})
   .sort(function(left,right){return left.rowId.localeCompare(right.rowId);});
 }
 // 材料行快照：保留全部影响输出的业务字段，按稳定ID排序，表内排序/筛选不影响业务键。
 function normalizeMaterials(list){
  return (Array.isArray(list)?list:[]).map(function(row){
   var item=row||{};
   return {rowId:text(item.rowId||item.id),scopeId:item.scopeId==null?null:text(item.scopeId),
    name:text(item.name),feature:text(item.feature),unit:text(item.unit),
    quantity:item.quantity==null?null:text(item.quantity),
    sources:((item.sourceIds||item.sources||[]).map(function(source){
     return text(source&&source.id?source.id:source);
    })).sort()};
  }).sort(function(left,right){return left.rowId.localeCompare(right.rowId);});
 }
 function brandRowsLike(list){
  return Array.isArray(list)&&list.every(function(item){
   return isObject(item)&&(item.categoryId!=null||item.groups!=null);});
 }
  // 一本多页的产物快照：只留“1 文件 + 逐页行数（页名与顺序固定）”，表内排序/格式不影响业务键。
  function normalizeOutput(value){
   var source=isObject(value)?value:{};
   var sheets=(Array.isArray(source.sheets)?source.sheets:[]).map(function(item){
    var sheet=isObject(item)?item:{};
    return {name:text(sheet.sheetName||sheet.name),rowCount:Number(sheet.rowCount)||0};});
   return {file:text(source.file),sheets:sheets};
  }
 function normalizeBrands(source){
  if(!source)return [];
  var list;
  if(Array.isArray(source))list=brandRowsLike(source)?source:[];
  else if(isObject(source)&&Array.isArray(source.assignments)){
   return source.assignments.map(function(assignment){
    return {categoryId:text(assignment&&assignment.categoryId),mode:text(assignment&&assignment.coverageMode),
     groups:[{brand:text(assignment&&assignment.brand),supplier:text(assignment&&assignment.supplier),
      note:text(assignment&&assignment.note)}]};
   }).sort(function(left,right){return left.categoryId.localeCompare(right.categoryId);});
  } else if(isObject(source)&&brandRowsLike(source.rows))list=source.rows;
  else return [];
  return list.map(function(row){
   var item=row||{},groups=Array.isArray(item.groups)?item.groups:[];
   return {categoryId:text(item.categoryId),mode:text(item.mode),
    groups:groups.map(function(group){
     return {brand:text(group&&group.brand),supplier:text(group&&group.supplier),note:text(group&&group.note)};
    })};
  }).sort(function(left,right){return left.categoryId.localeCompare(right.categoryId);});
 }
 function contentSnapshot(options){
  var input=options||{},stage=KEY_CONTENT[input.stage]?input.stage:'import',
    includes=KEY_CONTENT[stage],rows=normalizeMaterials(input.groups||input.rows);
  var snapshot={version:2,stage:stage,mergeIdentical:input.mergeIdentical===true,
   mergeAllWorkbooks:input.mergeAllWorkbooks===true,
   sources:((input.collection&&input.collection.entries)||[]).map(function(entry){
    return {id:text(entry.id),origin:text(entry.metadata&&entry.metadata.originalPath).toLowerCase(),
     fingerprint:text(entry.metadata&&entry.metadata.fingerprint).toLowerCase()};
   }),rows:rows};
  if(includes.indexOf('review')>=0)snapshot.review=normalizeRows(input.review||input.classification);
  if(includes.indexOf('brands')>=0)snapshot.brands=normalizeBrands(input.brands||input.assignments);
  if(includes.indexOf('header')>=0)snapshot.header=canonical(input.header||null);
  if(includes.indexOf('output')>=0)snapshot.output=normalizeOutput(input.output||input.categories||input.summary);
  return canonical(snapshot);
 }
 function contentKey(options){return 'ck2-'+digest(JSON.stringify(contentSnapshot(options)));}
 function stageInfo(upstreamReady,verdict,readyText,waitText,blockText){
  if(upstreamReady&&verdict&&verdict.ready===true)return {ready:true,detail:(verdict.detail||readyText)};
  // 本阶段自身已有明确未完成原因时优先展示；否则按上游是否就绪给出可操作原因。
  if(verdict&&verdict.ready===false&&verdict.detail)return {ready:false,detail:verdict.detail};
  return {ready:false,detail:upstreamReady?waitText:blockText};
 }
 function assess(options){
  var input=options||{},source=input.collection||{entries:[]},entries=source.entries||[];
  var invalidSources=entries.filter(function(entry){
   var metadata=entry.metadata||{},snapshot=entry.snapshot||{};
   return !metadata.originalPath||!metadata.originalName||!metadata.copyPath||
    !/^[a-f\d]{64}$/i.test(String(metadata.fingerprint||''))||!snapshot.sheets;
  }).length;
  var preview=input.preview||null,issues=(preview&&preview.issues||[]).length;
  var sourcesReady=entries.length>0&&invalidSources===0;
  var previewClean=sourcesReady&&!!preview&&preview.canFinalize===true&&issues===0;
  var mergeIdentical=input.mergeIdentical===true;
  var mergeAllWorkbooks=input.mergeAllWorkbooks===true;
  var rows=(input.groups&&input.groups.length)?input.groups:rowsFromPreview(preview);
  var mergeKey=contentKey({stage:'import',collection:source,mergeIdentical:mergeIdentical,mergeAllWorkbooks:mergeAllWorkbooks,groups:rows});
  var mergeConfirmed=typeof input.mergeConfirmedKey==='string'&&input.mergeConfirmedKey===mergeKey;
  var importReady=previewClean&&mergeConfirmed;
  var matchingReady=importReady&&!!input.matching&&input.matching.ready===true;
  var reviewReady=matchingReady&&!!(input.review&&input.review.ready===true);
  var categoriesReady=reviewReady&&!!(input.categories&&input.categories.ready===true);
  var brandsReady=categoriesReady&&!!(input.brands&&input.brands.ready===true);
  var inquiryReady=brandsReady&&!!(input.inquiry&&input.inquiry.ready===true);
  var splitReady=inquiryReady&&!!(input.split&&input.split.ready===true);
  var reviewSource=input.review&&input.review.rows?input.review:(input.review||input.classification);
  // 分类/汇总阶段的生产物就是那一本分类工作簿：1 文件＋逐页行数（含第 1 页汇总页）。
  var output=normalizeOutput(input.categories||input.summary);
  var key={collection:source,mergeIdentical:mergeIdentical,mergeAllWorkbooks:mergeAllWorkbooks,groups:rows,review:reviewSource,
   brands:input.brands&&input.brands.rows?input.brands:input.brands||input.assignments,header:input.header||null,
   output:output};
  var matchingKey=contentKey(Object.assign({},key,{stage:'matching'}));
  var reviewKey=contentKey(Object.assign({},key,{stage:'review'}));
  var categoriesKey=contentKey(Object.assign({},key,{stage:'categories'}));
  var summaryKey=contentKey(Object.assign({},key,{stage:'summary'}));
  var brandsKey=contentKey(Object.assign({},key,{stage:'brands'}));
  var inquiryKey=contentKey(Object.assign({},key,{stage:'inquiry'}));
  var splitKey=contentKey(Object.assign({},key,{stage:'split'}));
  return {
   import:{ready:importReady,detail:importReady?('已导入'+entries.length+'份清单，合并选择已确认'):
    (!sourcesReady?(invalidSources?'有'+invalidSources+'份导入记录不完整':'尚未导入清单'):
     (issues?issues+'个来源问题仍待核对':'本次合并选择尚未确认'))},
   matching:stageInfo(importReady,input.matching,'自动匹配完成，尚未人工确认','尚未生成自动分类建议','导入与合并未完成'),
   review:stageInfo(matchingReady,input.review,'整表已确认并保存快照','尚未完成整表审核确认','自动分类未完成'),
   categories:stageInfo(reviewReady,input.categories,'分类工作簿已生成并校验','尚未生成分类工作簿','表内审核未确认'),
   brands:stageInfo(categoriesReady,input.brands,'品牌与供应商已填写并读回','尚未填写分类汇总表','分类工作簿未生成'),
   inquiry:stageInfo(brandsReady,input.inquiry,'询价表已生成并校验','尚未生成询价表','品牌汇总未完成'),
   split:stageInfo(inquiryReady,input.split,'拆分已完成并核对','尚未完成拆分','询价表未生成'),
   mergeKey:mergeKey,matchingKey:matchingKey,reviewKey:reviewKey,categoriesKey:categoriesKey,
   summaryKey:summaryKey,brandsKey:brandsKey,inquiryKey:inquiryKey,splitKey:splitKey,
   brandKey:reviewKey,generationKey:inquiryKey,
   mergeIdentical:mergeIdentical,mergeAllWorkbooks:mergeAllWorkbooks,rowCount:rows.length,rows:rows};
 }
 // 只把能证明完成的阶段置为ready；一旦上游断裂，从该阶段起取消ready并让下游过期。
 function sync(project,report){
  assertEditable(project);
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
 return {SCHEMA_VERSION:SCHEMA_VERSION,LEGACY_SCHEMA_VERSION:LEGACY_SCHEMA_VERSION,STAGES:STAGES.slice(),
  STAGE_LABELS:STAGE_LABELS,LEGACY_STAGES:LEGACY_STAGES.slice(),LEGACY_LABELS:LEGACY_LABELS,
  create:create,validate:validate,assertValid:assertValid,assertEditable:assertEditable,isLegacy:isLegacy,schemaOf:schemaOf,
  stageState:stageState,confirm:confirm,invalidate:invalidate,invalidateStage:invalidateStage,
  compareSources:compareSources,refresh:refresh,upgradeV1:upgradeV1,newId:newId,
 rowsFromPreview:rowsFromPreview,normalizeOutput:normalizeOutput,contentSnapshot:contentSnapshot,contentKey:contentKey,assess:assess,sync:sync,
  OWNER:OWNER,KIND_OF_STAGE:KIND_OF_STAGE,BRAND_COVERAGE:BRAND_COVERAGE.slice()};
}));
