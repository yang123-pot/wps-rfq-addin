(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqClassification=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,LEVELS={exact:'完全匹配',partial:'相近匹配',none:'无可靠匹配'},
   HEADER='分类备注｜匹配度｜核对状态';
 function now(){return new Date().toISOString();}
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function create(){return {schemaVersion:SCHEMA_VERSION,revision:1,updatedAt:now(),decisions:[],history:[]};}
 function validate(classification){
  var errors=[];
  if(!classification||typeof classification!=='object'||Array.isArray(classification))
   return {ok:false,errors:['分类确认记录不是有效对象。']};
  if(classification.schemaVersion!==SCHEMA_VERSION)errors.push('分类确认记录版本不支持：'+String(classification.schemaVersion));
  if(!Number.isSafeInteger(classification.revision)||classification.revision<1)errors.push('分类确认记录版本号无效。');
  if(!Array.isArray(classification.decisions))errors.push('分类确认记录缺少决策列表。');
  else classification.decisions.forEach(function(decision,index){
   var at='第'+(index+1)+'个决策';
   if(!decision||typeof decision!=='object'||Array.isArray(decision)){errors.push(at+'无效。');return;}
   if(typeof decision.rowId!=='string'||!decision.rowId)errors.push(at+'缺少行标识。');
   if(typeof decision.categoryId!=='string'||!decision.categoryId)errors.push(at+'缺少类别或“无需询价”。');
   if(typeof decision.confirmedAt!=='string'||!decision.confirmedAt)errors.push(at+'缺少确认时间。');
   if(decision.libraryVersion!=null&&typeof decision.libraryVersion!=='string')errors.push(at+'库版本无效。');
  });
  return {ok:errors.length===0,errors:errors};
 }
 function assertValid(classification){
  var check=validate(classification);
  if(!check.ok)throw Error('分类确认记录不完整：'+check.errors.join('；'));
  return classification;
 }
 function rowKey(row){return String(row&&(row.rowId||row.id||row.scopeId)||'');}
 function decisionFor(classification,rowId){
  var list=(classification&&classification.decisions||[]).filter(function(item){return item.rowId===rowId;});
  return list.length?list[0]:null;
 }
 function setDecision(classification,rowId,decision){
  assertValid(classification);
  if(typeof rowId!=='string'||!rowId)throw Error('缺少行标识，无法确认分类。');
  if(!decision||typeof decision!=='object'||typeof decision.categoryId!=='string'||!decision.categoryId)
   throw Error('确认分类需要类别或“无需询价”。');
  var next=copy(classification),previous=decisionFor(classification,rowId);
  var record={rowId:rowId,categoryId:decision.categoryId,categoryName:decision.categoryName||decision.categoryId,
   skip:decision.skip===true,matchLevel:decision.matchLevel||null,ruleId:decision.ruleId||null,
   memoryId:decision.memoryId||null,basis:decision.basis||null,libraryVersion:decision.libraryVersion||null,
   note:decision.note||null,confirmedAt:now(),revision:classification.revision};
  next.decisions=next.decisions.filter(function(item){return item.rowId!==rowId;}).concat([record]);
  next.revision=classification.revision+1;next.updatedAt=now();
  next.history=(next.history||[]).concat([{at:next.updatedAt,action:previous?'replace':'confirm',rowId:rowId,
   revision:next.revision,previous:previous?previous.categoryId:null}]);
  return next;
 }
 function removeDecision(classification,rowId){
  assertValid(classification);
  var next=copy(classification),previous=decisionFor(classification,rowId);
  if(!previous)return next;
  next.decisions=next.decisions.filter(function(item){return item.rowId!==rowId;});
  next.revision=classification.revision+1;next.updatedAt=now();
  next.history=(next.history||[]).concat([{at:next.updatedAt,action:'revoke',rowId:rowId,revision:next.revision,previous:previous.categoryId}]);
  return next;
 }
 function summary(classification,rows){
  assertValid(classification);
  var list=rows||[],pending=[],conflicts=[];
  list.forEach(function(row){
   var rowId=rowKey(row);
   if(!rowId)return;
   if(decisionFor(classification,rowId))return;
   var conflict=!!(row.conflicts&&row.conflicts.length>1);
   if(conflict)conflicts.push({rowId:rowId,name:row.name||''});
   pending.push({rowId:rowId,name:row.name||'',reason:conflict?'多候选冲突待确认':'未确认分类'});
  });
  return {total:list.length,confirmed:list.length-pending.length,remaining:pending.length,
   pending:pending,conflicts:conflicts,canGenerateBrandTable:list.length>0&&pending.length===0};
 }
 function levelLabel(level){return LEVELS[level]||LEVELS.none;}
 function sourceOf(decision){
  if(!decision||typeof decision!=='object')return null;
  return {categoryId:decision.categoryId,categoryName:decision.categoryName,rowId:decision.rowId,revision:decision.revision};
 }
 function cellText(decision){return decision.categoryName+'｜'+levelLabel(decision.matchLevel)+'｜已确认';}
 function columnOf(entry,sheet){
  var found=((entry&&entry.snapshot&&entry.snapshot.sheets)||[]).filter(function(item){return item.name===sheet;})[0];
  return found?Number(found.columnCount)+1:null;
 }
 function headerRowOf(entry,sheet){
  var found=((entry&&entry.parsed&&entry.parsed.sheets)||[]).filter(function(item){return item.name===sheet;})[0];
  var header=found&&Array.isArray(found.headers)?found.headers.filter(function(item){
   return item&&Number.isSafeInteger(item.row)&&item.row>0;
  })[0]:null;
  if(!header)throw Error('工作副本缺少有效表头行号：'+sheet+'，未写入。');
  return header.row;
 }
 function planColumn(classification,groups,entries,options){
  assertValid(classification);
  options=options||{};
  var header=options.header||HEADER,list=groups||[],library=entries||[];
  var pending=list.filter(function(group){return !decisionFor(classification,rowKey(group));});
  if(options.requireAll&&pending.length)throw Error('还有'+pending.length+'行未确认分类，不能写入工作副本。');
  if(options.merged){
   var mergedRows=[];
   list.forEach(function(group,index){
    var decision=decisionFor(classification,rowKey(group));
    if(decision)mergedRows.push({row:index+2,text:cellText(decision)});
   });
   if(!mergedRows.length)return {mode:'merge-identical',plans:[]};
   return {mode:'merge-identical',plans:[{entryId:null,sheet:options.sheet||'清单',headerRow:options.headerRow||1,
    column:options.column||1,header:header,rows:mergedRows}]};
  }
  var plans=[],byPlan={};
  library.forEach(function(entry){
   var shelves={};
   list.forEach(function(group){
    var decision=decisionFor(classification,rowKey(group));
    if(!decision)return;
    (group.sources||[]).forEach(function(source){
     if(!entry.metadata||entry.metadata.originalPath!==source.path)return;
     var sheet=source.sheet,column=columnOf(entry,sheet);
     if(column==null)throw Error('工作副本缺少工作表记录：'+sheet);
     var key=entry.id+'|'+sheet;
     if(!byPlan[key]){
      byPlan[key]={entryId:entry.id,sheet:sheet,headerRow:headerRowOf(entry,sheet),column:column,header:header,rows:[]};
      plans.push(byPlan[key]);
     }
     if(!shelves[key])shelves[key]={};
     (source.rows&&source.rows.length?source.rows:[source.row]).forEach(function(rowNumber){
      if(shelves[key][rowNumber])return;
      shelves[key][rowNumber]=true;
      byPlan[key].rows.push({row:rowNumber,text:cellText(decision)});
     });
    });
   });
  });
  return {mode:'separate',plans:plans};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,HEADER:HEADER,LEVELS:LEVELS,create:create,validate:validate,assertValid:assertValid,
  decisionFor:decisionFor,setDecision:setDecision,removeDecision:removeDecision,summary:summary,cellText:cellText,
  planColumn:planColumn,sourceOf:sourceOf};
}));
