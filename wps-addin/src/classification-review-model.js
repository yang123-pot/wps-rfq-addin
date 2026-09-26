(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./classify.js'),require('./category-library.js'),require('./workbook-layout.js'));
 else root.RfqClassificationReviewModel=factory(root.RfqClassify,root.RfqCategoryLibrary,root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(classify,library,layout){
 'use strict';
 // R4：自动分类→审核成果表。只做“建议”，不产生任何人工确认，也不学习。
 var SCHEMA_VERSION=1,SHEET='分类审核成果',OPTIONS_SHEET='内部选项',BINDING_SHEET='内部绑定';
 var COLUMNS=['序号','项目名称','规格','单位','工程量','自动建议','匹配情况','最终分类','审核备注'];
 var ROW_ID_COLUMN=11;                     // K列：随行隐藏辅助列，保存稳定rowId，主表不展示技术字段
 var TITLE_ROW=1,NOTE_ROW=2,HEADER_ROW=3,FIRST_ROW=4;
 var STATE={suggested:'匹配成功',conflict:'分类冲突',none:'无可靠匹配',skip:'无需询价'};
 function text(value){return value==null?'':String(value);}
 function quantityText(value){return value==null?'':String(value);}
 function rowIdOf(group){return text(group&&(group.id||group.scopeId));}
 function firstSource(group){
  var sources=(group&&group.sources)||[];
  return sources.length?sources[0]:null;
 }
 function describe(suggestion){
  if(!suggestion)return '';
  if(suggestion.conflicts&&suggestion.conflicts.length>1)
   return '命中多个类别：'+suggestion.conflicts.map(function(item){return item.categoryName||item.categoryId;}).join('、');
  if(!suggestion.candidates||!suggestion.candidates.length)return '分类库与习惯记忆都没有可靠命中';
  var hit=suggestion.candidates[0];
  return (hit.matchLevel==='exact'?'完全匹配':'部分匹配')+(hit.basis?'：'+hit.basis:'');
 }
 // 唯一可靠建议才预填“最终分类”；冲突与无建议一律留空留给用户决定。
 function build(groups,options){
  var input=options||{},source=input.library;
  if(!Array.isArray(groups))throw Error('自动分类需要已确认的合并结果。');
  if(!source)throw Error('自动分类需要分类库。');
  var check=library.validate(source);
  if(!check.ok)throw Error('分类库不可用：'+check.errors.join('；'));
  var libraryVersion=text(source.version);
  var rows=groups.map(function(group,index){
   var item={name:text(group.name),feature:text(group.feature),unit:text(group.unit)};
   var suggestion=classify.suggest(item,source,{memory:input.memory||null,projectId:input.projectId||null});
   var conflicts=(suggestion.conflicts||[]).length>1;
   var candidates=suggestion.candidates||[];
   var auto=candidates.length===1?candidates[0]:null;
   var state=conflicts?STATE.conflict:(candidates.length?(auto&&auto.categoryId===library.DECISION?STATE.skip:STATE.suggested):STATE.none);
   var origin=firstSource(group);
   return {rowId:rowIdOf(group),index:index+1,name:item.name,feature:item.feature,unit:item.unit,
    quantity:quantityText(group.quantity),scopeId:text(group.scopeId),
    code:origin?text(origin.code):'',engineering:origin?text(origin.engineering):'',
    profession:origin?text(origin.profession):'',
    sourceIds:((group.sources||[]).map(function(entry){return text(entry.id);})),
    libraryVersion:libraryVersion,
    autoCategoryId:auto?text(auto.categoryId):null,autoCategoryName:auto?text(auto.categoryName):null,
    matchState:state,matchBasis:describe(suggestion),
    finalCategoryId:auto?text(auto.categoryId):'',finalCategoryName:auto?text(auto.categoryName):'',
    reviewNote:'',abnormal:conflicts};
  });
  return {schemaVersion:SCHEMA_VERSION,sheet:SHEET,columns:COLUMNS.slice(),rows:rows,
   libraryVersion:libraryVersion,categories:library.categories(source).map(function(category){
    return {id:text(category.id),name:text(category.name)};}),
   counts:{rows:rows.length,
    suggested:rows.filter(function(row){return row.matchState===STATE.suggested;}).length,
    skip:rows.filter(function(row){return row.matchState===STATE.skip;}).length,
    conflict:rows.filter(function(row){return row.matchState===STATE.conflict;}).length,
    none:rows.filter(function(row){return row.matchState===STATE.none;}).length,
    pending:rows.length}};
 }
 function summary(model){
  var counts=model.counts;
  return {rows:counts.rows,suggested:counts.suggested+counts.skip,conflict:counts.conflict+counts.none,
   noInquiry:counts.skip,confirmed:0,
   text:counts.rows+' 行结果已写入成果表',
   detail:(counts.suggested+counts.skip)+' 行有建议 · '+(counts.conflict+counts.none)+' 行需重点核对'};
 }
 function publicRow(row){
  return [String(row.index),row.name,row.feature,row.unit,row.quantity,
   row.autoCategoryName||'待核对',row.matchState,row.finalCategoryName||'',row.reviewNote||''];
 }
 // 主表9列＋标题两行；K列隐藏保存rowId；异常行整行橙色；最终分类浅黄并挂区域下拉。
 function mainSheet(model,options){
  var input=options||{},title=input.title||'分类审核成果.xlsx',lastRow=FIRST_ROW+model.rows.length-1;
  var values=[[title,'','','','','','','',''],
   ['自动匹配仅供参考，请在“最终分类”列审核与修改','','','','','','','',''],
   COLUMNS.slice()];
  model.rows.forEach(function(row){
   var line=publicRow(row);
   line.push('');                    // J列：公开9列后的空位
   line.push(row.rowId);             // K列：随行隐藏辅助列
   values.push(line);
  });
  values=layout.equalize(values,ROW_ID_COLUMN);   // 等宽矩阵：短标题行不再决定列宽
  var width=[6,16,22,8,10,14,12,16,20,3,26];
  var columns=width.map(function(value,index){return {index:index+1,width:value,
   hidden:index+1===ROW_ID_COLUMN,title:index<COLUMNS.length?COLUMNS[index]:'行标识'};});
  var fills=[layout.headerFill(HEADER_ROW,COLUMNS.length)];
  if(model.rows.length)fills.push(layout.inputFill(FIRST_ROW,8,model.rows.length,1));
  var merges=[{row:TITLE_ROW,column:1,columnSpan:COLUMNS.length},{row:NOTE_ROW,column:1,columnSpan:COLUMNS.length}];
  model.rows.forEach(function(row,index){
   if(!row.abnormal)return;
   fills.push({row:FIRST_ROW+index,column:1,rowSpan:1,columnSpan:COLUMNS.length,color:layout.COLORS.accent});
  });
  var validations=model.rows.length?[layout.listValidation(FIRST_ROW,8,model.rows.length,1,
   OPTIONS_SHEET,'$B$2:$B$'+String(model.categories.length+1))]:[];
  var spec=layout.build({columns:columns,headerRows:[HEADER_ROW],
   rows:[{index:TITLE_ROW,height:24}],merges:merges,fills:fills,validations:validations,
   freeze:{row:FIRST_ROW,column:1},
   print:{area:{row:1,column:1,rowSpan:values.length,columnSpan:COLUMNS.length},repeatRow:HEADER_ROW},
   metadata:{profile:'classification-review',libraryVersion:model.libraryVersion,rowIdColumn:ROW_ID_COLUMN,
    headerRow:HEADER_ROW,firstRow:FIRST_ROW,lastRow:lastRow}},
   {rowCount:values.length,columnCount:ROW_ID_COLUMN});
  return {name:SHEET,values:values,layout:spec};
 }
 // 下拉选项放在内部表，用区域引用避免带标点类别名被拆开。
 function optionsSheet(model){
  var values=[['类别编号','类别名称']];
  model.categories.forEach(function(category){values.push([category.id,category.name]);});
  var spec=layout.build({columns:[{index:1,width:20},{index:2,width:20}],headerRows:[1],
   metadata:{profile:'internal-options'}},{rowCount:values.length,columnCount:2});
  return {name:OPTIONS_SHEET,values:values,layout:spec};
 }
 // 内部绑定：rowId、固定字段快照与库版本，供整表读回校验；不进入公开列。
 function bindingSheet(model){
  var values=[['行标识','序号','项目编码','项目名称','项目特征描述','单位','工程量','来源边界','来源标识','库版本']];
  model.rows.forEach(function(row){
   values.push([row.rowId,String(row.index),row.code,row.name,row.feature,row.unit,row.quantity,
    row.scopeId,row.sourceIds.join(' '),row.libraryVersion]);
  });
  var spec=layout.build({columns:Array.from({length:10},function(_,index){return {index:index+1};}),headerRows:[1],
   metadata:{profile:'internal-binding'}},{rowCount:values.length,columnCount:10});
  return {name:BINDING_SHEET,values:values,layout:spec};
 }
 function workbook(model,options){
  return {sheets:[mainSheet(model,options),optionsSheet(model),bindingSheet(model)]};
 }
 // 读回期望值：R5用它按rowId校验固定字段，未保存编辑与筛选隐藏行都不漏。
 function expectedRows(model){
  return model.rows.map(function(row){
   return {rowId:row.rowId,index:String(row.index),name:row.name,feature:row.feature,unit:row.unit,
    quantity:row.quantity,code:row.code};
  });
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,SHEET:SHEET,OPTIONS_SHEET:OPTIONS_SHEET,BINDING_SHEET:BINDING_SHEET,
  COLUMNS:COLUMNS.slice(),ROW_ID_COLUMN:ROW_ID_COLUMN,TITLE_ROW:TITLE_ROW,NOTE_ROW:NOTE_ROW,
  HEADER_ROW:HEADER_ROW,FIRST_ROW:FIRST_ROW,STATE:STATE,
  build:build,summary:summary,mainSheet:mainSheet,optionsSheet:optionsSheet,bindingSheet:bindingSheet,
  workbook:workbook,publicRow:publicRow,expectedRows:expectedRows};
}));
