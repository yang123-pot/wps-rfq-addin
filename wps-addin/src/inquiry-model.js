(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./brand-table.js'),require('./inquiry-header.js'));
 else root.RfqInquiryModel=factory(root.RfqBrandTable,root.RfqInquiryHeader);
}(typeof window==='object'?window:globalThis,function(brand,header){
 'use strict';
 var SCHEMA_VERSION=1,
  COLUMNS=['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  INQUIRY='inquiry',TRACE='内部追溯',RECORD='处理记录';
 function text(value){return value==null?'':String(value);}
 function sanitize(name,used){
  var base=text(name).replace(/[\\\/\?\*\[\]:：]/g,'_').replace(/^'+|'+$/g,'').slice(0,31)||'询价表';
  var candidate=base,index=1;
  while(used[candidate]){candidate=(base.slice(0,28)+'-'+index).slice(0,31);index++;}
  used[candidate]=true;
  return candidate;
 }
 function guard(values,sheetName){
  return values.map(function(row,index){
   return row.map(function(value){
    var valueText=text(value);
    if(valueText.length>32767||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(valueText))
     throw Error('“'+sheetName+'”第'+(index+1)+'行含超长文本或不支持字符，未截断，不能生成。');
    return valueText;
   });
  });
 }
 // 品牌只从汇总表读回的数据取；报价单价与金额一律留空，原价与历史报价不带入。
 function build(input){
  var source=input||{},data=source.brandTable;
  if(!data||!Array.isArray(data.assignments)||!data.assignments.length)
   throw Error('还没有品牌分配，不能生成询价表。');
  var check=brand.validateBrands(data,source.rows||brand.requiredRowIds(source.groups||[],source.classification));
  if(!check.ok)throw Error('品牌或覆盖范围还没确认：'+check.errors.slice(0,3).join('；'));
  var headerCheck=header.validate(source.header);
  if(!headerCheck.ok)throw Error('询价抬头不完整：'+headerCheck.errors.join('；'));
  var used={},sheets=[],trace=[],titleRows=header.rows(source.header,'').length,headerRow=titleRows+1,byRowId={};
  data.rows.forEach(function(row){byRowId[row.rowId]=row;});
  data.assignments.forEach(function(assignment){
   var rows=brand.rowsOf(data,assignment.rowIds);
   var linked=brand.requireBrands(data,assignment.rowIds);
   if(!rows.length)throw Error('品牌分配没有对应材料行：'+assignment.assignmentId);
   var sheetId='sheet-'+assignment.assignmentId,
    sheetName=sanitize((byRowId[assignment.rowIds[0]]||{}).categoryName+'-'+linked[0].brand,used),
    values=header.rows(source.header,linked[0].supplier).concat([COLUMNS.slice()]);
   rows.forEach(function(row,index){
    values.push([String(index+1),row.codes.join('；'),row.name,row.feature,row.unit,row.quantity,
     linked[index].brand,'','',text(assignment.note)]);
    trace.push([sheetName,row.categoryId,linked[index].brand,linked[index].supplier,index+1,row.rowId,
     row.sourceIds.join('、'),row.quantity,(row.sourceLabels||[]).join('；')]);
   });
   sheets.push({sheetId:sheetId,kind:INQUIRY,assignmentId:assignment.assignmentId,name:sheetName,
    categoryId:assignment.categoryId,brand:linked[0].brand,supplier:linked[0].supplier,
    values:guard(values,sheetName),layout:{titleRows:titleRows,headerRow:headerRow,columns:COLUMNS.slice(),
     widths:{'项目特征描述':46,'项目名称':22,'项目编码':16}}});
  });
  return {schemaVersion:SCHEMA_VERSION,inputKey:text(source.inputKey||data.inputKey),header:header.normalize(source.header),
   coverageMode:text(data.coverageMode),rowCount:data.rows.length,sheets:sheets,
   trace:guard([['询价工作表','类别','品牌','供应商','序号','材料行标识','来源标识','工程量','来源']].concat(trace),TRACE)};
 }
 // 交给WPS写入的工作簿：对外询价页＋内部追溯页＋处理记录页。拆分时只取kind=inquiry的页。
 function workbook(model,generatedAt){
  if(!model||!Array.isArray(model.sheets)||!model.sheets.length)throw Error('没有可写入的询价页。');
  var sheets=model.sheets.map(function(sheet){return {name:sheet.name,values:sheet.values};});
  sheets.push({name:TRACE,values:model.trace});
  sheets.push({name:RECORD,values:[['项目','内容'],['工作簿版本','wps-rfq-inquiry-v1'],['内容键',model.inputKey],
   ['覆盖范围模式',brand.COVERAGE_LABELS[model.coverageMode]||model.coverageMode],
   ['询价工作表数',String(model.sheets.length)],['材料行数',String(model.rowCount)],
   ['生成时间',text(generatedAt||'')],
   ['品牌来源','品牌取自分类品牌表汇总表；报价单价与金额留空，原价与历史报价不带入'],
   ['用途','对供应商询价的工作簿；内部追溯页只留内部，拆分时不随文件外发']]});
  return {mode:'inquiry',inputKey:model.inputKey,sheets:sheets};
 }
 function record(model,receipt){
  var value=receipt||{};
  if(typeof value.target!=='string'||!value.target)throw Error('生成记录缺少目标文件。');
  if(!/^[a-f\d]{64}$/i.test(String(value.sha256||'')))throw Error('生成记录缺少文件SHA256。');
  return {schemaVersion:SCHEMA_VERSION,inputKey:model.inputKey,target:value.target,sha256:String(value.sha256).toLowerCase(),
   generatedAt:text(value.generatedAt||''),sheetIds:model.sheets.map(function(sheet){return sheet.sheetId;}),
   modelSnapshot:model};
 }
 // 旧生成文件是否还能用于拆分：内容键与询价页清单都要一致。
 function isCurrent(generation,currentKey){
  if(!generation||generation.schemaVersion!==SCHEMA_VERSION)return false;
  if(typeof currentKey!=='string'||!currentKey||generation.inputKey!==currentKey)return false;
  return Array.isArray(generation.sheetIds)&&generation.sheetIds.length>0&&!!generation.modelSnapshot;
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,COLUMNS:COLUMNS,INQUIRY:INQUIRY,TRACE:TRACE,RECORD:RECORD,
  build:build,workbook:workbook,record:record,isCurrent:isCurrent,sanitize:sanitize};
}));
