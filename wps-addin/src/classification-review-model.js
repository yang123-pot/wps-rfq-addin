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
 // R5：图03的“匹配情况”列在整表读回时按“最终分类 vs 自动建议”重算为一致/存在差异。
 var MATCH={consistent:'一致',different:'存在差异'};
 var MATCH_COLUMN=7,FINAL_COLUMN=8,NOTE_COLUMN=9,AUTO_COLUMN=6;
 // 这些读回问题无法可靠定位到材料行或说明绑定已失效，草稿与整表确认都必须先修好。
 var BLOCKING_ISSUES=['row-id-missing','row-id-duplicate','row-id-unknown','row-missing','field-changed'];
 function text(value){return value==null?'':String(value);}
 function quantityText(value){return value==null?'':String(value);}
 function autoLabel(row){return text(row&&row.autoCategoryName)||'待核对';}
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
   autoLabel(row),row.matchState,row.finalCategoryName||'',row.reviewNote||''];
 }
 // 图03口径：最终分类与自动建议一致才是“一致”，无建议/冲突/被用户改写都是“存在差异”。
 function matchLabel(autoCategoryId,finalCategoryId){
  return autoCategoryId&&finalCategoryId&&String(autoCategoryId)===String(finalCategoryId)?MATCH.consistent:MATCH.different;
 }
 function issueTitle(code){
  return {suggested:null,'category-empty':'最终分类为空','category-unknown':'最终分类无效',
   'row-id-missing':'缺少行标识','row-id-duplicate':'行标识重复','row-id-unknown':'行标识不属于本次成果表',
   'row-missing':'材料行缺失','field-changed':'固定字段被改动'}[code]||'读回问题';
 }
 function mapIssue(issue){
  return {row:issue&&issue.row!=null?issue.row:null,column:issue&&issue.column!=null?issue.column:null,
   code:text(issue&&issue.code),title:issueTitle(issue&&issue.code),message:text(issue&&issue.message)};
 }
 function blocking(readResult){
  return ((readResult&&readResult.issues)||[]).filter(function(issue){
   return BLOCKING_ISSUES.indexOf(text(issue&&issue.code))>=0;});
 }
 function countRows(rows){
  var counts={rows:rows.length,filled:0,empty:0,unknown:0,consistent:0,different:0,noInquiry:0,notes:0};
  rows.forEach(function(row){
   if(text(row.categoryId))counts.filled++;
   else if(text(row.categoryName))counts.unknown++;
   else counts.empty++;
   if(row.skip)counts.noInquiry++;
   if(row.note)counts.notes++;
   if(row.match===MATCH.consistent)counts.consistent++;else counts.different++;
  });
  return counts;
 }
 // R5整表读回校验：只接收“最终分类”“审核备注”，其余列按固定字段快照核对（由host.readSheet给出问题）。
 // 空分类、未知分类、损坏行都带工作表单元格位置，整表不完整绝不放行。
 function validateRead(readResult,options){
  var input=options||{},source=input.categories||(input.model&&input.model.categories)||[];
  if(!readResult||!Array.isArray(readResult.rows))throw Error('整表审核需要成果表的读回结果。');
  var known={},errors=[],rows=[];
  source.forEach(function(category){known[text(category&&category.id)]=true;});
  ((readResult&&readResult.issues)||[]).forEach(function(issue){errors.push(mapIssue(issue));});
  readResult.rows.forEach(function(record){
   var name=text(record.name)||'（名称待补）',where='第'+record.row+'行',categoryName=text(record.finalCategoryName),
     categoryId=text(record.finalCategoryId);
   if(!categoryName)errors.push({row:record.row,column:FINAL_COLUMN,code:'category-empty',title:issueTitle('category-empty'),
    message:where+'“最终分类”为空：'+name+' 还没有选择类别或“无需询价”。'});
   else if(!categoryId||!known[categoryId])errors.push({row:record.row,column:FINAL_COLUMN,code:'category-unknown',
    title:issueTitle('category-unknown'),message:where+'“最终分类”“'+categoryName+'”不在当前分类库里，请用下拉重新选择。'});
   rows.push({rowId:text(record.rowId),row:record.row,index:text(record.index),name:name,feature:text(record.feature),
    unit:text(record.unit),quantity:text(record.quantity),
    autoCategoryId:text(record.autoCategoryId)||null,autoCategoryName:text(record.autoCategoryName),
    categoryId:categoryId,categoryName:categoryName,skip:categoryId===library.DECISION,
    note:text(record.reviewNote),match:matchLabel(record.autoCategoryId,categoryId)});
  });
  var counts=countRows(rows);
  return {ok:errors.length===0,errors:errors,rows:rows,counts:counts,
   summary:counts.rows+' 行 · 已填 '+counts.filled+' · 与建议不同 '+counts.different+' · 无需询价 '+counts.noInquiry};
 }
 // 整表确认快照：先落盘再学习，是分类工作簿（R6）与下游的唯一依据；行按集合保存，排序/筛选不影响。
 function confirmation(rows,options){
  var input=options||{},list=Array.isArray(rows)?rows:[];
  if(!list.length)throw Error('整表审核确认需要至少一行结果。');
  var binding=input.binding||null,counts=countRows(list);
  return {schemaVersion:SCHEMA_VERSION,projectId:input.projectId!=null?text(input.projectId):null,
   inputKey:input.inputKey!=null?text(input.inputKey):null,libraryVersion:input.libraryVersion!=null?text(input.libraryVersion):null,
   confirmedAt:input.confirmedAt!=null?text(input.confirmedAt):new Date().toISOString(),
   revision:Number.isSafeInteger(input.revision)&&input.revision>0?input.revision:1,
   sheet:binding?{path:text(binding.path),sheet:text(binding.sheet),headerRow:binding.headerRow,firstRow:binding.firstRow,
    lastRow:binding.lastRow,rowIdColumn:binding.rowIdColumn,sha256:binding.sha256!=null?text(binding.sha256):null}:null,
   counts:counts,rows:list.map(function(row){
    return {rowId:text(row.rowId),index:text(row.index),name:text(row.name),feature:text(row.feature),unit:text(row.unit),
     quantity:text(row.quantity),autoCategoryName:text(row.autoCategoryName),categoryId:text(row.categoryId),
     categoryName:text(row.categoryName),skip:row.categoryId===library.DECISION||row.skip===true,
     note:text(row.note),match:row.match===MATCH.consistent?MATCH.consistent:MATCH.different};})};
 }
 // 草稿：允许空分类/未知分类（用户还没填完），但标识或固定字段被破坏时拒绝保存，避免草稿与材料行错位。
 function draft(readResult,options){
  var input=options||{},broken=blocking(readResult);
  if(broken.length)return {ok:false,errors:broken.map(mapIssue),draft:null};
  var rows=((readResult&&readResult.rows)||[]).map(function(record){
   return {rowId:text(record.rowId),index:text(record.index),name:text(record.name),feature:text(record.feature),
    unit:text(record.unit),quantity:text(record.quantity),categoryId:text(record.finalCategoryId),
    categoryName:text(record.finalCategoryName),note:text(record.reviewNote)};
  });
  if(!rows.length)return {ok:false,errors:[{row:null,column:null,code:'row-missing',title:issueTitle('row-missing'),
   message:'成果表里没有可保存的审核行。'}],draft:null};
  return {ok:true,errors:[],draft:{schemaVersion:SCHEMA_VERSION,state:'draft',
   inputKey:input.inputKey!=null?text(input.inputKey):null,projectId:input.projectId!=null?text(input.projectId):null,
   savedAt:input.savedAt!=null?text(input.savedAt):new Date().toISOString(),
   sheet:input.binding?{path:text(input.binding.path),sheet:text(input.binding.sheet)}:null,
   counts:rows.reduce(function(counts,row){
    counts.rows++;if(row.categoryId)counts.filled++;else counts.empty++;
    if(row.note)counts.notes++;return counts;},{rows:0,filled:0,empty:0,notes:0}),rows:rows}};
 }
 function decisionOf(row){return [text(row&&row.rowId),text(row&&row.categoryId),text(row&&row.note)].join('\u0000');}
// R12-C：把项目里已保存的审核快照（整表确认或草稿）重建为可再次写入的成果表模型。
// 用户可编辑的两列取快照，编码/来源等固定字段取绑定，避免“文件未保存”就丢掉人工决定或内部字段。
function fromSnapshot(snapshot,binding,options){
  var input=options||{},rows=((snapshot&&snapshot.rows)||[]);
  if(!rows.length)throw Error('需要已保存的审核快照才能重建成果副本。');
  var fields={};
  ((binding&&binding.fields)||[]).forEach(function(field){fields[text(field.rowId)]=field;});
  var categories=(((binding&&binding.categories)||input.categories)||[]).map(function(category){
    return {id:text(category.id),name:text(category.name)};});
  var nameOf={};categories.forEach(function(category){nameOf[category.id]=category.name;});
  var libraryVersion=binding&&binding.libraryVersion!=null?text(binding.libraryVersion):null;
  var list=rows.map(function(row,index){
    var field=fields[text(row.rowId)]||{},categoryId=text(row.categoryId),
      categoryName=text(row.categoryName)||nameOf[categoryId]||'',
      autoCategoryId=field.autoCategoryId==null?null:text(field.autoCategoryId);
    return {rowId:text(row.rowId),index:text(row.index||field.index||(index+1)),
      name:row.name!=null?text(row.name):text(field.name),feature:row.feature!=null?text(row.feature):text(field.feature),
      unit:row.unit!=null?text(row.unit):text(field.unit),
      quantity:row.quantity!=null?text(row.quantity):text(field.quantity),
      scopeId:text(field.scopeId),code:text(field.code),engineering:'',profession:'',
      sourceIds:((field.sourceIds||[]).map(function(id){return text(id);})),libraryVersion:libraryVersion,
      autoCategoryId:autoCategoryId,
      autoCategoryName:field.autoCategoryName!=null?text(field.autoCategoryName):text(row.autoCategoryName),
      matchState:matchLabel(autoCategoryId,categoryId),matchBasis:'',
      finalCategoryId:categoryId,finalCategoryName:categoryName,reviewNote:text(row.note),
      abnormal:!autoCategoryId&&categoryId!==library.DECISION};
  });
  return {schemaVersion:SCHEMA_VERSION,sheet:SHEET,columns:COLUMNS.slice(),rows:list,libraryVersion:libraryVersion,
   categories:categories,
   counts:{rows:list.length,
    suggested:list.filter(function(row){return row.matchState===MATCH.consistent;}).length,
    skip:list.filter(function(row){return row.finalCategoryId===library.DECISION;}).length,
    conflict:list.filter(function(row){return !row.autoCategoryId;}).length,
    none:0,pending:list.length}};
}
 // 成果表绑定是否还能用于本次内容：来源/合并/分类库变化后必须重新生成，旧inputKey一律拒绝。
 function bindingState(binding,inputKey){
  if(!binding||typeof binding!=='object')
   return {ok:false,code:'missing',message:'还没有生成审核成果表：请先在“自动分类”阶段生成并打开成果表。'};
  if(binding.inputKey&&inputKey&&text(binding.inputKey)!==text(inputKey))
   return {ok:false,code:'stale',message:'清单、合并选择或分类库已变化（成果表绑定的是旧内容），请重新生成审核成果表后再审核。'};
  return {ok:true,code:'fresh',message:''};
 }
 function sameRows(left,right){
  var before=(left&&left.rows)||[],after=(right&&right.rows)||[];
  if(before.length!==after.length)return false;
  var index={};before.forEach(function(row){index[text(row.rowId)]=decisionOf(row);});
  return after.every(function(row){return index[text(row.rowId)]===decisionOf(row);});
 }
 // 改确认只撤销被改的那一行来源，未变的行保持原记忆来源。
 function changedRows(previous,next){
  var before={},after={},changes=[];
  ((previous&&previous.rows)||[]).forEach(function(row){before[text(row.rowId)]=row;});
  ((next&&next.rows)||[]).forEach(function(row){after[text(row.rowId)]=row;});
  Object.keys(after).forEach(function(rowId){
   var from=before[rowId],to=after[rowId];
   if(from&&decisionOf(from)===decisionOf(to))return;
   changes.push({rowId:rowId,from:from?{categoryId:text(from.categoryId),note:text(from.note)}:null,
    to:{categoryId:text(to.categoryId),note:text(to.note)}});
  });
  Object.keys(before).forEach(function(rowId){
   if(after[rowId])return;
   changes.push({rowId:rowId,from:{categoryId:text(before[rowId].categoryId),note:text(before[rowId].note)},to:null});
  });
  return changes;
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
  workbook:workbook,publicRow:publicRow,expectedRows:expectedRows,
  MATCH:MATCH,MATCH_COLUMN:MATCH_COLUMN,FINAL_COLUMN:FINAL_COLUMN,NOTE_COLUMN:NOTE_COLUMN,AUTO_COLUMN:AUTO_COLUMN,
  BLOCKING_ISSUES:BLOCKING_ISSUES.slice(),autoLabel:autoLabel,matchLabel:matchLabel,
  validateRead:validateRead,confirmation:confirmation,draft:draft,sameRows:sameRows,changedRows:changedRows,
  bindingState:bindingState,fromSnapshot:fromSnapshot};
}));
