(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./brand-table.js'),
  require('./inquiry-header.js'),require('./workbook-layout.js'));
 else root.RfqInquiryModel=factory(root.RfqBrandTable,root.RfqInquiryHeader,root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(brand,header,layout){
 'use strict';
 // R9：品牌唯一来源是分类汇总表读回（R8）。按每类选定方式生成总询价工作簿：
 // 按品牌分别生成＝每组一个询价对象、每张含本类完整材料；合成一份＝每类一个对象、全部品牌组、材料只列一次。
 var SCHEMA_VERSION=1,LAYOUT_VERSION=2,
  COLUMNS=['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  INQUIRY='inquiry',TRACE='内部追溯',RECORD='处理记录',
  MODES=['synthesize','per-brand'],MODE_LABELS={synthesize:'合成一份','per-brand':'按品牌分别生成'},
  BRAND_SEPARATOR=' / ',MULTI_SUPPLIER='多供应商',COMBINED_NAME='合成询价',
  HEADER_FONT_SIZE=10,TITLE_COLUMN_SPAN=8,
  COLUMN_WIDTHS=[6,16,22,46,8,10,20,12,12,16];
 function text(value){return value==null?'':String(value);}
 function trim(value){return text(value).trim();}
 function modeLabel(value){return MODE_LABELS[trim(value)]||'';}
 function sanitize(name,used){
  var base=trim(name).replace(/[\\\/\?\*\[\]:：]/g,'_').replace(/^'+|'+$/g,'').slice(0,31)||'询价表';
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
 // 汇总表读回记录 → 稳定的类别清单：categoryId、名称、条数、方式、1至3组品牌与供应商。
 function summaryCategories(source){
  var list=source&&Array.isArray(source.categories)?source.categories:(Array.isArray(source)?source:null);
  if(!list||!list.length)throw Error('还没有从分类汇总表读回品牌与供应商，不能生成询价表。');
  return list.map(function(entry){
   var item=entry||{},categoryId=trim(item.categoryId),groups=(item.groups||[]).map(function(group){
    return {brand:trim(group&&group.brand),supplier:trim(group&&group.supplier)};});
   var label=trim(item.categoryName)||categoryId;
   if(!categoryId)throw Error('分类汇总表里有一类缺少稳定类别标识，不能生成询价表。');
   var mode=trim(item.mode)||'synthesize';
   if(MODES.indexOf(mode)<0)throw Error('类别“'+label+'”没有有效的询价生成方式，不能生成询价表。');
   return {categoryId:categoryId,categoryName:trim(item.categoryName)||categoryId,rowCount:Number(item.rowCount)||0,
    mode:mode,groups:groups};
  });
 }
 // 材料行来自当前清单分组与分类确认；类别归属以稳定rowId为准，排序/筛选不影响。
 function materialRows(source){
  var built=brand.build(source.groups||[],source.classification,source.inputKey);
  return built.rows;
 }
 function sheetGroups(entry){
  if(!entry.groups.length)return [[{brand:'',supplier:''}]];
  if(entry.mode==='per-brand')return entry.groups.map(function(group){return [group];});
  return [entry.groups];
 }
 // 单组用“类别_品牌”（图06：水泵_青源、风机_瑞风、汽车充电桩_驰电）；多组合成用“类别_合成询价”。
 function sheetNameFor(entry,groupSet){
  var suffix=groupSet.length>1?COMBINED_NAME:trim(groupSet[0]&&groupSet[0].brand);
  return trim(entry.categoryName)+(suffix?'_'+suffix:'');
 }
 function sheetLayout(block,rowCount,categoryId,mode){
  var columnSpan=COLUMNS.length,totalRows=block.headerRow+rowCount,
   merges=[{row:1,column:1,columnSpan:8},{row:1,column:9,columnSpan:2},
    {row:2,column:1,columnSpan:6},{row:2,column:7,columnSpan:4},
    {row:3,column:1,columnSpan:3},{row:3,column:4,columnSpan:3},{row:3,column:7,columnSpan:4},
    {row:4,column:1,columnSpan:10},{row:5,column:1,columnSpan:10}];
  // 合并区无法可靠AutoFit；按区域宽度与字数预留换行高度，不截断用户填写。
  function height(row){
   var regions=merges.filter(function(merge){return merge.row===row;}),maxLines=1,size=row===1?24:12;
   regions.forEach(function(region){
    var width=COLUMN_WIDTHS.slice(region.column-1,region.column-1+region.columnSpan).reduce(function(a,b){return a+b;},0)*7,
     value=block.lines[row-1][region.column-1]||'',lines=0;
    value.split(/\r?\n/).forEach(function(line){
     var units=0;for(var i=0;i<line.length;i++)units+=line.charCodeAt(i)>255?1:0.6;
     lines+=Math.max(1,Math.ceil(units*size*1.34/Math.max(20,width-20)));
    });
    maxLines=Math.max(maxLines,lines);
   });
   return Math.max(row===1?48:32,Math.ceil(maxLines*size*1.5+12));
  }
  return layout.build({fontSize:HEADER_FONT_SIZE,
   columns:COLUMNS.map(function(_,position){return {index:position+1,width:COLUMN_WIDTHS[position]};}),
   rows:[1,2,3,4,5].map(function(row){return {index:row,height:height(row)};}),
   fonts:[{row:2,column:1,rowSpan:4,columnSpan:10,name:'宋体',size:12,color:'#000000',bold:false},
    {row:1,column:1,columnSpan:8,name:'宋体',size:24,color:'#000000',bold:true},
    {row:1,column:9,columnSpan:2,name:'宋体',size:22,color:'#000000',bold:false}],
   alignments:[{row:2,column:1,rowSpan:4,columnSpan:10,horizontal:'left',vertical:'center'},
    {row:1,column:1,columnSpan:8,horizontal:'center',vertical:'center'},
    {row:1,column:9,columnSpan:2,horizontal:'center',vertical:'center'}],
   headerRows:[block.titleRow,block.headerRow],freeze:{row:block.headerRow+1,column:1},merges:merges,
   fills:[layout.headerFill(block.headerRow,columnSpan)],
   print:{area:{row:1,column:1,rowSpan:totalRows,columnSpan:columnSpan},repeatRow:block.headerRow,
    paperSize:9,orientation:'landscape',fitToWidth:1,fitToHeight:0},
   metadata:{profile:'inquiry-sheet',categoryId:text(categoryId),mode:text(mode),headerRow:block.headerRow,
    titleRow:block.titleRow,supplierFirstRow:block.supplierFirstRow,supplierRowCount:block.supplierRowCount,
    titleSpan:TITLE_COLUMN_SPAN}},
   {rowCount:totalRows,columnCount:columnSpan});
 }
 // 生成询价模型。input：{brands(汇总读回记录或类别数组),groups(合并预览分组),classification,header,inputKey}。
 function build(input){
  var source=input||{},headerCheck=header.validate(source.header);
  if(!headerCheck.ok)throw Error('询价抬头不完整：'+headerCheck.errors.join('；'));
  var categories=summaryCategories(source.brands||source.summaryRead||source.categories),
   rows=materialRows(source),byCategory={},used={},sheets=[],trace=[];
  rows.forEach(function(row){
   (byCategory[row.categoryId]=byCategory[row.categoryId]||[]).push(row);
  });
  categories.forEach(function(entry){
   var categoryRows=byCategory[entry.categoryId]||[],groupPosition=0;
   if(!categoryRows.length)
    throw Error('分类“'+entry.categoryName+'”在当前清单里没有对应材料行，请重新读回汇总表。');
   if(entry.rowCount&&categoryRows.length!==entry.rowCount)
    throw Error('分类“'+entry.categoryName+'”的材料条数与汇总表不一致（清单'+categoryRows.length+'行，汇总表'+
     entry.rowCount+'行），请重新读回汇总表后再生成。');
   sheetGroups(entry).forEach(function(groupSet){
    var multi=groupSet.length>1,brandLabel=groupSet.map(function(group){return group.brand;}).filter(function(value){return value;}).join(BRAND_SEPARATOR),
     supplierLabel=multi?MULTI_SUPPLIER:groupSet[0].supplier,
     sheetName=sanitize(sheetNameFor(entry,groupSet),used),block=header.block(source.header,groupSet),
     values=block.lines.concat([COLUMNS.slice()]);
    groupPosition++;
    categoryRows.forEach(function(row,index){
     values.push([String(index+1),row.codes.join('；'),row.name,row.feature,row.unit,row.quantity,brandLabel,'','','']);
     trace.push([sheetName,row.categoryId,brandLabel,groupSet.map(function(group){return group.supplier;}).join(BRAND_SEPARATOR),
      index+1,row.rowId,row.sourceIds.join('、'),row.quantity,(row.sourceLabels||[]).join('；')]);
    });
    values=layout.equalize(values,COLUMNS.length);
    sheets.push({sheetId:'sheet-'+entry.categoryId+'-'+groupPosition,kind:INQUIRY,
     categoryId:entry.categoryId,categoryName:entry.categoryName,mode:entry.mode,groupCount:groupSet.length,
     groups:groupSet.map(function(group){return {brand:group.brand,supplier:group.supplier};}),
     brand:brandLabel,brandLabel:brandLabel,supplier:supplierLabel,
     rowIds:categoryRows.map(function(row){return row.rowId;}),name:sheetName,
     headerRow:block.headerRow,titleRows:block.lines.length,supplierLines:block.groups.map(function(group){
      return group.brand?group.brand+' — '+group.supplier:group.supplier;}),
     values:guard(values,sheetName),layout:sheetLayout(block,categoryRows.length,entry.categoryId,entry.mode)});
   });
  });
  return {schemaVersion:SCHEMA_VERSION,layoutVersion:LAYOUT_VERSION,inputKey:text(source.inputKey),header:header.normalize(source.header),
   projectName:header.normalize(source.header).projectName,mode:source.mode||'summary',rowCount:rows.length,
   sheetCount:sheets.length,sheets:sheets,
   trace:guard([['询价工作表','类别','品牌','供应商','序号','材料行标识','来源标识','工程量','来源']].concat(trace),TRACE)};
 }
 // 每个类别一行汇总：类别、方式、组数、份数、材料行数。用于侧栏“预计输出”。
 function categorySummary(model){
  var order=[],map={};
  ((model&&model.sheets)||[]).forEach(function(sheet){
   var found=map[sheet.categoryId];
   if(!found){found=map[sheet.categoryId]={categoryId:sheet.categoryId,categoryName:sheet.categoryName,
    mode:sheet.mode,sheetCount:0,groupCount:0,rows:0};order.push(found);}
   found.sheetCount++;found.groupCount=Math.max(found.groupCount,sheet.groupCount||1);
   found.rows=Math.max(found.rows,(sheet.rowIds||[]).length);
  });
  return order;
 }
 // 图06侧栏“预计输出”：按品牌分别生成按份数列出；多品牌合成单列；单组类别合并为“各 1 份”。
 function summaryLines(model){
  var lines=[],singles=[];
  categorySummary(model).forEach(function(item){
   if(item.mode==='per-brand')lines.push(item.categoryName+'：按品牌生成 '+item.sheetCount+' 份');
   else if(item.groupCount>1)lines.push(item.categoryName+'：多个品牌合成 '+item.sheetCount+' 份');
   else singles.push(item.categoryName);
  });
  if(singles.length)lines.push(singles.join('、')+'：各 1 份');
  return lines;
 }
 function countsText(model){return summaryLines(model).join('；');}
 function ensureSheets(model){
  if(!model||!Array.isArray(model.sheets)||!model.sheets.length)throw Error('没有可写入的询价页。');
  return model.sheets;
 }
 // 交给WPS写入的总询价工作簿：对外询价页＋内部追溯页＋处理记录页（内部页只在内部，拆分只取kind=inquiry）。
 function workbook(model,generatedAt){
  var sheets=ensureSheets(model).map(function(sheet){
   return {name:sheet.name,values:sheet.values,layout:sheet.layout};});
  sheets.push({name:TRACE,values:model.trace});
  sheets.push({name:RECORD,values:[['项目','内容'],['工作簿版本','wps-rfq-inquiry-v2'],['内容键',model.inputKey],
   ['项目名称',model.projectName],['询价工作表数',String(model.sheets.length)],['材料行数',String(model.rowCount)],
   ['生成时间',text(generatedAt||'')],
   ['品牌来源','品牌与供应商取自分类汇总表读回结果；报价单价与金额留空，原价与历史报价不带入'],
   ['供应商信息区','第4行供货单位取当前供应商，多组完整列出；合成一份时材料行只出现一次'],
   ['用途','对供应商询价的工作簿；内部追溯页只留内部，拆分时不随文件外发']]});
  return {mode:'inquiry',inputKey:model.inputKey,sheets:sheets};
 }
 function record(model,receipt){
  var value=receipt||{};
  if(typeof value.target!=='string'||!value.target)throw Error('生成记录缺少目标文件。');
  if(!/^[a-f\d]{64}$/i.test(String(value.sha256||'')))throw Error('生成记录缺少文件SHA256。');
  return {schemaVersion:SCHEMA_VERSION,inputKey:model.inputKey,target:value.target,sha256:String(value.sha256).toLowerCase(),
   generatedAt:text(value.generatedAt||''),sheetIds:model.sheets.map(function(sheet){return sheet.sheetId;}),
   sheetCount:model.sheets.length,modelSnapshot:model};
 }
 // 旧生成文件是否还能用于拆分：内容键与询价页清单都要一致。
 function isCurrent(generation,currentKey){
  if(!generation||generation.schemaVersion!==SCHEMA_VERSION)return false;
  if(typeof currentKey!=='string'||!currentKey||generation.inputKey!==currentKey)return false;
  return Array.isArray(generation.sheetIds)&&generation.sheetIds.length>0&&!!generation.modelSnapshot&&
   generation.modelSnapshot.layoutVersion===LAYOUT_VERSION;
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,LAYOUT_VERSION:LAYOUT_VERSION,COLUMNS:COLUMNS,INQUIRY:INQUIRY,TRACE:TRACE,RECORD:RECORD,
  MODES:MODES.slice(),MODE_LABELS:MODE_LABELS,MULTI_SUPPLIER:MULTI_SUPPLIER,COMBINED_NAME:COMBINED_NAME,
  build:build,workbook:workbook,record:record,isCurrent:isCurrent,sanitize:sanitize,
  categorySummary:categorySummary,summaryLines:summaryLines,countsText:countsText,modeLabel:modeLabel};
}));
