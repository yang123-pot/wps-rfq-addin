(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./classification-review-model.js'),require('./category-library.js'));
 else root.RfqSourceReviewModel=factory(root.RfqClassificationReviewModel,root.RfqCategoryLibrary);
}(typeof window==='object'?window:globalThis,function(reviewModel,library){
 'use strict';
 // 未勾选“合并清单”时，审核不另造扁平成果表：每本来料保存一份原样副本，
 // 仅在各材料工作表右侧追加三个公开列和一个隐藏行标识列。
 var SCHEMA_VERSION=1,COLUMNS=['建议分类','最终分类','审核备注'],ROW_ID_LABEL='行标识';
 function text(value){return value==null?'':String(value);}
 function idKey(value){
  try{
   var parts=JSON.parse(text(value));
   if(Array.isArray(parts)&&parts.length>=3){
    parts[0]=text(parts[0]).replace(/[\\/]+/g,'/').toLowerCase();
    return JSON.stringify(parts);
   }
  }catch(_){}
  return text(value);
 }
 function safeName(value){
  return text(value).replace(/[\\/:*?"<>|]/g,'_').replace(/[. ]+$/,'').trim()||'未命名清单';
 }
 function fileBase(name){return safeName(text(name).replace(/\.[^.]+$/,''));}
 function nonEmptyWidth(values){
  var width=0;
  (values||[]).forEach(function(row){
   if(!Array.isArray(row))return;
   for(var index=row.length-1;index>=0;index--){
    if(text(row[index]).trim()!==''){width=Math.max(width,index+1);break;}
   }
  });
  return width;
 }
 function headerRowOf(sheet,materials){
  var first=Math.min.apply(null,materials.map(function(item){return item.source.row;}));
  for(var row=1;row<first;row++){
   var values=sheet.values[row-1]||[];
   if(text(values[materials[0].source.column-1]).trim()==='项目名称')return row;
  }
  for(var probe=1;probe<first;probe++){
   if((sheet.values[probe-1]||[]).some(function(value){return text(value).trim()==='项目名称';}))return probe;
  }
  return Math.max(1,first-1);
 }
 function originRows(sheet,item,lastColumn){
  return (item.source.rows||[item.source.row]).map(function(row){
   var values=sheet.values[row-1]||[];
   return {row:row,values:Array.from({length:lastColumn},function(_,index){return text(values[index]);})};
  });
 }
 function build(entries,result,options){
  var input=options||{};
  if(!Array.isArray(entries)||!entries.length)throw Error('来源原表审核需要至少一份已导入工作簿。');
  if(!result||!Array.isArray(result.rows)||!result.rows.length)throw Error('来源原表审核需要自动分类结果。');
  var check=library.validate({version:result.libraryVersion,categories:result.categories,rules:[]});
  if(!check.ok)throw Error('来源原表审核的分类库不可用：'+check.errors.join('；'));
  var byId={};
  result.rows.forEach(function(row){byId[idKey(row.rowId)]=row;});
  var used={},files=[],fields=[];
  entries.forEach(function(entry,fileIndex){
   var materials=((entry.parsed&&entry.parsed.materials)||[]).slice();
   if(!materials.length)throw Error('来源清单没有可审核材料：'+text(entry.metadata&&entry.metadata.originalName));
   var snapshot=entry.snapshot||{},sheetByName={};
   (snapshot.sheets||[]).forEach(function(sheet){sheetByName[text(sheet.name)]=sheet;});
   var grouped={};
   materials.forEach(function(item){
    var sheetName=text(item.source&&item.source.sheet),row=byId[idKey(item.id)];
    if(!row)throw Error('自动分类结果缺少来源材料：'+text(item.name));
    if(!sheetByName[sheetName])throw Error('来源快照缺少工作表：'+sheetName);
    (grouped[sheetName]||(grouped[sheetName]=[])).push(item);
   });
   var sheets=Object.keys(grouped).map(function(sheetName){
    var sheet=sheetByName[sheetName],items=grouped[sheetName].sort(function(left,right){
     return left.source.row-right.source.row;
    });
    var width=Math.max(1,nonEmptyWidth(sheet.values));
    var headerRow=headerRowOf(sheet,items);
    var spec={name:sheetName,headerRow:headerRow,originLastColumn:width,
     reviewColumn:width+1,finalColumn:width+2,noteColumn:width+3,rowIdColumn:width+4,rows:[]};
    items.forEach(function(item){
     var row=byId[idKey(item.id)];
     spec.rows.push({rowId:text(row.rowId),index:text(row.index),row:item.source.row,
      name:text(row.name),feature:text(row.feature),unit:text(row.unit),quantity:text(row.quantity),
      trace:text(row.trace),code:text(row.code),scopeId:text(row.scopeId),sourceIds:(row.sourceIds||[]).map(text),
      autoCategoryId:row.autoCategoryId==null?null:text(row.autoCategoryId),
      autoCategoryName:reviewModel.autoLabel(row),finalCategoryName:text(row.finalCategoryName),
      reviewNote:'',originRows:originRows(sheet,item,width)});
    });
    return spec;
   });
   var base=fileBase(entry.metadata&&entry.metadata.originalName),counter=used[base.toLowerCase()]||0;
   used[base.toLowerCase()]=counter+1;
   var targetName=base+(counter?'_'+String(counter+1):'')+'_分类审核.xlsx';
   var file={
    schemaVersion:SCHEMA_VERSION,fileIndex:fileIndex+1,
    originalName:text(entry.metadata&&entry.metadata.originalName),
    copyPath:text(entry.metadata&&entry.metadata.copyPath),
    fingerprint:text(entry.metadata&&entry.metadata.fingerprint).toLowerCase(),
    index:fileIndex+1,targetName:targetName,sheets:sheets,
    rowCount:sheets.reduce(function(total,sheet){return total+sheet.rows.length;},0)
   };
   if(!/^(?:[a-z]:[\\/]|\\\\)/i.test(file.copyPath))throw Error('来源工作副本路径无效：'+file.originalName);
   files.push(file);
   sheets.forEach(function(sheet){sheet.rows.forEach(function(row){
    fields.push({rowId:row.rowId,index:row.index,code:row.code,name:row.name,feature:row.feature,unit:row.unit,
     quantity:row.quantity,trace:row.trace,scopeId:row.scopeId,sourceIds:row.sourceIds,
     autoCategoryName:row.autoCategoryName,autoCategoryId:row.autoCategoryId,
     fileIndex:file.fileIndex,fileName:file.originalName,sheet:sheet.name,row:row.row,originLastColumn:sheet.originLastColumn,
     reviewColumn:sheet.reviewColumn,finalColumn:sheet.finalColumn,noteColumn:sheet.noteColumn,rowIdColumn:sheet.rowIdColumn});
   });});
  });
  var rowIds=fields.map(function(field){return field.rowId;});
  if(new Set(rowIds).size!==rowIds.length)throw Error('来源原表审核的行标识重复，请重新导入。');
  return {schemaVersion:SCHEMA_VERSION,mode:'source-tables',columns:COLUMNS.slice(),rowIdLabel:ROW_ID_LABEL,
   files:files,fields:fields,rowIds:rowIds,rowCount:fields.length,sourceCount:entries.length,
   libraryVersion:text(result.libraryVersion),
   categories:(result.categories||[]).map(function(category){return {id:text(category.id),name:text(category.name)};}),
   title:input.title?text(input.title):null};
 }
 function targets(plan,directory){
  if(!plan||plan.mode!=='source-tables')throw Error('来源原表审核计划无效。');
  if(typeof directory!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(directory))
   throw Error('请选择来源审核副本的保存目录。');
  var base=directory.replace(/[\\/]+$/,'');
  return plan.files.map(function(file){
   return {file:file,path:base+'\\'+file.targetName};
  });
 }
 function batchDirectory(directory,projectName){
  var base=text(directory).replace(/[\\/]+$/,'');
  if(!/^(?:[a-z]:[\\/]|\\\\)/i.test(base))throw Error('请选择来源审核副本的保存目录。');
  var stamp=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
  return base+'\\'+safeName(projectName)+'_分类审核_'+stamp+'_'+Math.random().toString(36).slice(2,8);
 }
 function rowSummary(plan){
  return {files:plan.files.length,rows:plan.rowCount,sheets:plan.files.reduce(function(total,file){return total+file.sheets.length;},0),
   text:plan.files.length+' 份原表 · '+plan.files.reduce(function(total,file){return total+file.sheets.length;},0)+
    ' 张工作表 · '+plan.rowCount+' 条材料'};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,COLUMNS:COLUMNS.slice(),ROW_ID_LABEL:ROW_ID_LABEL,
  build:build,targets:targets,batchDirectory:batchDirectory,rowSummary:rowSummary,safeName:safeName};
}));
