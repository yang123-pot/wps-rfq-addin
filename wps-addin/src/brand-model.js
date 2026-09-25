(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./brand-table.js'));
 else root.RfqBrandModel=factory(root.RfqBrandTable);
}(typeof window==='object'?window:globalThis,function(brand){
 'use strict';
 var SCHEMA_VERSION=1,SHEET='分类品牌表',DETAIL='材料明细',NOTE='填写说明',
  COLUMNS=[{key:'assignmentId',header:'分配标识'},{key:'categoryName',header:'类别'},
   {key:'count',header:'材料条目数'},{key:'brand',header:'品牌'},{key:'supplier',header:'供应商'},
   {key:'note',header:'备注'},{key:'rowIds',header:'材料行标识'}],
  EDITABLE=['brand','supplier','note'],TITLE_ROW=1,HEADER_ROW=2,FIRST_ROW=3;
 function cell(row,index){
  var value=Array.isArray(row)?row[index]:null;
  return value==null?'':String(value).trim();
 }
 function text(value){return value==null?'':String(value);}
 function guard(sheets){
  var total=0;
  sheets.forEach(function(sheet){
   if(!sheet.values.length)throw Error('“'+sheet.name+'”没有内容，不能生成。');
   var cells=sheet.values.length*sheet.values[0].length;
   total+=cells;
   if(cells>1000000||total>3000000)throw Error('品牌表范围过大，请减少材料或品牌后重试。');
   sheet.values=sheet.values.map(function(row,index){
    return row.map(function(value){
     var valueText=text(value);
     if(valueText.length>32767||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(valueText))
      throw Error('“'+sheet.name+'”第'+(index+1)+'行含超长文本或不支持字符，未截断，不能生成。');
     return valueText;
    });
   });
  });
  return sheets;
 }
 function rowMapOf(data){
  var map={};
  brand.categories(data).forEach(function(category){
   brand.assignmentsFor(data,category.categoryId).forEach(function(assignment){
    map[assignment.assignmentId]={categoryId:assignment.categoryId,
     categoryName:assignment.categoryName||category.categoryName||assignment.categoryId,
     rowIds:(assignment.rowIds||[]).slice(),count:(assignment.rowIds||[]).length,
     brand:text(assignment.brand),supplier:text(assignment.supplier),note:text(assignment.note)};
   });
  });
  return map;
 }
 function buildWorkbook(data,generatedAt){
  var rows=data&&data.rows||[],assignments=data&&data.assignments||[];
  if(!assignments.length)throw Error('还没有品牌分配，先在侧栏为类别建立品牌与供应商行。');
  var rowMap=rowMapOf(data),main=[[SHEET+'-请只填写品牌、供应商、备注，其他列由插件读取时校验']];
  main.push(COLUMNS.map(function(column){return column.header;}));
  var byCategory={};
  brand.categories(data).forEach(function(category){byCategory[category.categoryId]=category;});
  var details=[['分配标识','类别','材料名称','项目特征描述','单位','工程量','材料行标识','来源']];
  assignments.forEach(function(assignment){
   var expected=rowMap[assignment.assignmentId];
   if(!expected)throw Error('品牌分配缺少类别归属：'+text(assignment.assignmentId));
   var covered=brand.rowsOf(data,assignment.rowIds);
   if(covered.length!==expected.rowIds.length)
    throw Error('品牌分配引用了不属于当前清单的材料行：'+text(assignment.assignmentId));
   main.push([assignment.assignmentId,expected.categoryName,expected.count,text(assignment.brand),
    text(assignment.supplier),text(assignment.note),expected.rowIds.join('、')]);
   covered.forEach(function(row){
    details.push([assignment.assignmentId,expected.categoryName,row.name,row.feature,row.unit,row.quantity,
     row.rowId,(row.sourceLabels||[]).join('；')]);
   });
  });
  var notes=[['项目','内容'],['工作簿版本','wps-rfq-brand-v1'],['内容键',text(data.inputKey)],
   ['覆盖范围模式',brand.COVERAGE_LABELS[data.coverageMode]||text(data.coverageMode)],
   ['材料行数',String(rows.length)],['品牌分配行数',String(assignments.length)],
   ['生成时间',text(generatedAt||'')],
   ['填写范围','只能修改品牌、供应商、备注三列；“分配标识”“类别”“材料条目数”“材料行标识”是固定列。'],
   ['品牌联动','这里填写的品牌是询价表与拆分文件品牌列的唯一来源，不允许在询价表里另行填写或改写。'],
   ['固定列被改动','读取时会指出具体行并拒绝，需要重新生成后再填写。'],
   ['读回方式','回到侧栏点“读取并核对品牌表”，确认预览后才写入项目。'],
   ['用途','项目内部品牌与供应商整理，不是对供应商的询价文件。']];
  return {schemaVersion:SCHEMA_VERSION,inputKey:text(data.inputKey),coverageMode:text(data.coverageMode),
   rowMap:rowMap,headerRow:HEADER_ROW,firstRow:FIRST_ROW,sheet:SHEET,
   sheets:guard([{name:SHEET,values:main},{name:DETAIL,values:details},{name:NOTE,values:notes}])};
 }
 function bindingFor(target,workbook){
  if(typeof target!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(target)||!/^.+\.xlsx$/i.test(target))
   throw Error('品牌表路径无效，请选择新的xlsx绝对路径。');
  return {schemaVersion:SCHEMA_VERSION,path:target,sheet:(workbook&&workbook.sheet)||SHEET,
   headerRow:(workbook&&workbook.headerRow)||HEADER_ROW,firstRow:(workbook&&workbook.firstRow)||FIRST_ROW,
   inputKey:text(workbook&&workbook.inputKey),rowMap:(workbook&&workbook.rowMap)||{}};
 }
 function validateBinding(binding){
  var errors=[];
  if(!binding||typeof binding!=='object'||Array.isArray(binding))return {ok:false,errors:['品牌表绑定不是有效对象。']};
  if(binding.schemaVersion!==SCHEMA_VERSION)errors.push('品牌表绑定版本不支持：'+text(binding.schemaVersion));
  if(typeof binding.path!=='string'||!binding.path)errors.push('品牌表绑定缺少路径。');
  if(typeof binding.sheet!=='string'||!binding.sheet)errors.push('品牌表绑定缺少工作表名。');
  if(!Number.isSafeInteger(binding.headerRow)||binding.headerRow<1)errors.push('品牌表绑定缺少表头行号。');
  if(!Number.isSafeInteger(binding.firstRow)||binding.firstRow<=binding.headerRow)errors.push('品牌表绑定缺少数据起始行。');
  if(!binding.rowMap||typeof binding.rowMap!=='object'||Array.isArray(binding.rowMap)||!Object.keys(binding.rowMap).length)
   errors.push('品牌表绑定缺少分配标识映射。');
  return {ok:errors.length===0,errors:errors};
 }
 // 按分配标识匹配而不是按行号，用户在WPS里排序后仍能正确读回。
 function parseSheet(values,binding){
  var check=validateBinding(binding);
  if(!check.ok)throw Error('品牌表绑定无效：'+check.errors.join('；'));
  if(!Array.isArray(values)||!values.length)throw Error('品牌表为空，无法读取。');
  var header=values[binding.headerRow-1]||[];
  COLUMNS.forEach(function(column,index){
   var actual=cell(header,index);
   if(actual!==column.header)
    throw Error('品牌表第'+binding.headerRow+'行第'+(index+1)+'列应为“'+column.header+'”，实际是“'+actual+'”，请用插件重新生成品牌表。');
  });
  var seen={},assignments=[],lineNumbers=[];
  for(var index=binding.firstRow-1;index<values.length;index++){
   var line=values[index],rowNumber=index+1;
   if(!line||!line.length||line.every(function(value){return cell([value],0)==='';}))continue;
   var assignmentId=cell(line,0);
   var expected=binding.rowMap[assignmentId],previous=seen[assignmentId];
   if(previous)throw Error('品牌表第'+previous+'行与第'+rowNumber+'行的分配标识重复：'+assignmentId);
   if(!expected)throw Error('品牌表第'+rowNumber+'行的分配标识“'+assignmentId+'”不属于本次项目，请重新生成品牌表。');
   seen[assignmentId]=rowNumber;
   var categoryName=cell(line,1),count=cell(line,2),rowIds=cell(line,6);
   if(categoryName!==text(expected.categoryName))
    throw Error('品牌表第'+rowNumber+'行的类别被改动（应为“'+text(expected.categoryName)+'”），不能读回。');
   if(count!==String(expected.count))
    throw Error('品牌表第'+rowNumber+'行的材料条目数被改动（应为'+expected.count+'），不能读回。');
   if(rowIds!==(expected.rowIds||[]).join('、'))
    throw Error('品牌表第'+rowNumber+'行的材料行标识被改动，不能读回。');
   assignments.push({assignmentId:assignmentId,categoryId:expected.categoryId,brand:cell(line,3),
    supplier:cell(line,4),note:cell(line,5)});
   lineNumbers.push(rowNumber);
  }
  Object.keys(binding.rowMap).forEach(function(assignmentId){
   if(!seen[assignmentId])
    throw Error('品牌表缺少分配标识“'+assignmentId+'”，可能删除了行，请重新生成品牌表后再填写。');
  });
  return {assignments:assignments,rows:lineNumbers};
 }
 // 读回只覆盖可编辑列，保持原有分配顺序，避免内容键无故变化。
 function apply(data,read){
  var updates={};
  (read&&read.assignments||[]).forEach(function(item){updates[item.assignmentId]=item;});
  var missing=(data&&data.assignments||[]).filter(function(assignment){return !updates[assignment.assignmentId];});
  if(missing.length)throw Error('品牌表读回缺少分配标识：'+missing.map(function(item){return item.assignmentId;}).join('、'));
  var changed=data.assignments.map(function(assignment){
   var update=updates[assignment.assignmentId];
   return Object.assign({},assignment,{brand:text(update.brand),supplier:text(update.supplier),note:text(update.note)});
  });
  return Object.assign({},data,{assignments:changed});
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,SHEET:SHEET,DETAIL:DETAIL,NOTE:NOTE,COLUMNS:COLUMNS,EDITABLE:EDITABLE.slice(),
  buildWorkbook:buildWorkbook,bindingFor:bindingFor,validateBinding:validateBinding,parseSheet:parseSheet,apply:apply};
}));
