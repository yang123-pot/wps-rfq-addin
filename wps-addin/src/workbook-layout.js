(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqWorkbookLayout=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 // 统一版式模型：等宽矩阵＋layout。模型只描述“应该长什么样”，真正写盘由export-host执行。
 // layout随模型→workbook→host→拆分传递；旧的无layout模型仍然兼容。
 var SCHEMA_VERSION=1,FONT_SIZE=10;
 var COLORS={header:'#DCE6F1',input:'#FFF7D6',accent:'#FDE9D9',note:'#F2F2F2',link:'#0563C1'};
 function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
 function integer(value,min){return Number.isSafeInteger(value)&&value>=(min==null?1:min);}
 function toColor(hex){
  if(typeof hex!=='string'||!/^#[0-9a-f]{6}$/i.test(hex))throw Error('版式颜色必须是#RRGGBB：'+String(hex));
  var value=parseInt(hex.slice(1),16);
  // WPS/Excel的Interior.Color用BGR整数。
  return ((value&0x0000ff)<<16)|(value&0x00ff00)|((value>>16)&0x0000ff);
 }
 // 把长短不一的行补齐成等宽矩阵：短标题行不再决定列宽，也不截断任何已写内容。
 function equalize(values,width){
  if(!Array.isArray(values))throw Error('工作表内容必须是二维数组。');
  var widest=0;
  values.forEach(function(row){
   if(!Array.isArray(row))throw Error('工作表内容必须是二维数组。');
   if(row.length>widest)widest=row.length;
  });
  var target=integer(width)?width:widest;
  if(target<widest)throw Error('指定列数小于实际内容列数，拒绝截断：'+target+'<'+widest);
  if(target<1)throw Error('工作表至少需要一列。');
  return values.map(function(row){
   var next=row.slice();
   while(next.length<target)next.push('');
   return next;
  });
 }
 // R12-I：宿主单格上限（32767字符）与XML控制字符必须在模型边界明确拒绝，绝不交给宿主截断或报底层错误。
 // 分类审核成果表、分类工作簿、品牌汇总、询价表都调用这里，保证“未截断”口径一致。
 function guardValues(name,values){
  var sheet=name||'工作表';
  (values||[]).forEach(function(row,index){
   (Array.isArray(row)?row:[]).forEach(function(value){
    var text=value==null?'':String(value);
    if(text.length>32767||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
     throw Error('“'+sheet+'”第'+(index+1)+'行含超长文本或不支持字符，未截断，不能生成。');
   });
  });
  return values;
 }
 function rect(item,at,errors){
  if(!isObject(item)){errors.push(at+'区域无效。');return;}
  ['row','column'].forEach(function(field){
   if(!integer(item[field]))errors.push(at+'缺少有效'+field+'。');});
  ['rowSpan','columnSpan'].forEach(function(field){
   if(item[field]!=null&&!integer(item[field]))errors.push(at+field+'无效。');});
 }
 function validate(layout,bounds){
  var errors=[];
  if(!isObject(layout))return {ok:false,errors:['版式不是有效对象。']};
  if(layout.schemaVersion!==SCHEMA_VERSION)errors.push('版式版本不支持：'+String(layout.schemaVersion));
  if(!Array.isArray(layout.columns))errors.push('版式缺少列定义。');
  if(layout.hidden!=null&&typeof layout.hidden!=='boolean')errors.push('工作表隐藏设置无效。');
  (layout.columns||[]).forEach(function(column,index){
   var at='第'+(index+1)+'列';
   if(!isObject(column)||!integer(column.index)){errors.push(at+'缺少列号。');return;}
   if(column.width!=null&&(!Number.isFinite(column.width)||column.width<=0))errors.push(at+'列宽无效。');
   if(column.hidden!=null&&typeof column.hidden!=='boolean')errors.push(at+'隐藏设置无效。');
   if(column.wrap!=null&&typeof column.wrap!=='boolean')errors.push(at+'自动换行设置无效。');
  });
  (layout.rows||[]).forEach(function(row){
   if(!isObject(row)||!integer(row.index)||!Number.isFinite(row.height)||row.height<=0)errors.push('行高定义无效。');});
  ['merges','fills','fonts','hyperlinks','validations'].forEach(function(field){
   if(layout[field]!=null&&!Array.isArray(layout[field]))errors.push(field+'必须是数组。');
  });
  (layout.merges||[]).forEach(function(merge,index){rect(merge,'第'+(index+1)+'个合并',errors);});
  (layout.fills||[]).forEach(function(fill,index){
   rect(fill,'第'+(index+1)+'个填充',errors);
   if(isObject(fill)){try{toColor(fill.color);}catch(error){errors.push(error.message);}}});
  // 字体区域：用于名称超链接的蓝色下划线等获批样式；缺省不动，给了颜色/加粗/下划线才落地。
  (layout.fonts||[]).forEach(function(font,index){
   rect(font,'第'+(index+1)+'个字体',errors);
   if(!isObject(font))return;
   if(font.color!=null){try{toColor(font.color);}catch(error){errors.push(error.message);}}
   ['bold','underline'].forEach(function(field){
    if(font[field]!=null&&typeof font[field]!=='boolean')errors.push('第'+(index+1)+'个字体'+field+'设置无效。');});
  });
  (layout.hyperlinks||[]).forEach(function(link,index){
   rect(link,'第'+(index+1)+'个链接',errors);
   if(!isObject(link))return;
   if(typeof link.address!=='string'||!link.address.trim())errors.push('第'+(index+1)+'个链接缺少地址。');
   if(typeof (link.display==null?'':link.display)==='object')errors.push('第'+(index+1)+'个链接显示文本无效。');
  });
  (layout.validations||[]).forEach(function(rule,index){
   rect(rule,'第'+(index+1)+'个下拉',errors);
   if(!isObject(rule))return;
   if(typeof rule.listSheet!=='string'||!rule.listSheet.trim())errors.push('第'+(index+1)+'个下拉缺少选项表。');
   if(typeof rule.listRange!=='string'||!/^\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+$/.test(rule.listRange))
    errors.push('第'+(index+1)+'个下拉缺少有效的选项区域。');
  });
  if(layout.freeze!=null){
   if(!isObject(layout.freeze)||!integer(layout.freeze.row,0)||!integer(layout.freeze.column,0))
    errors.push('冻结窗格定义无效。');
  }
  if(layout.print!=null){
   if(!isObject(layout.print))errors.push('打印设置无效。');
   else{
    if(layout.print.area!=null)rect(layout.print.area,'打印区域',errors);
    if(layout.print.repeatRow!=null&&!integer(layout.print.repeatRow))errors.push('重复标题行无效。');
   }
  }
  if(bounds&&isObject(bounds)){
   var rowCount=bounds.rowCount,columnCount=bounds.columnCount;
   function within(item,at){
    if(!isObject(item))return;
    var lastRow=item.row+(item.rowSpan||1)-1,lastColumn=item.column+(item.columnSpan||1)-1;
    if(integer(rowCount)&&(item.row>rowCount||lastRow>rowCount))errors.push(at+'超出工作表行范围。');
    if(integer(columnCount)&&(item.column>columnCount||lastColumn>columnCount))errors.push(at+'超出工作表列范围。');
   }
   (layout.merges||[]).forEach(function(merge,index){within(merge,'第'+(index+1)+'个合并');});
   (layout.fills||[]).forEach(function(fill,index){within(fill,'第'+(index+1)+'个填充');});
   (layout.hyperlinks||[]).forEach(function(link,index){within(link,'第'+(index+1)+'个链接');});
   (layout.validations||[]).forEach(function(rule,index){within(rule,'第'+(index+1)+'个下拉');});
   (layout.fonts||[]).forEach(function(font,index){within(font,'第'+(index+1)+'个字体');});
   (layout.columns||[]).forEach(function(column,index){
    if(integer(columnCount)&&integer(column.index)&&column.index>columnCount)errors.push('第'+(index+1)+'列超出工作表列范围。');});
  }
  return {ok:errors.length===0,errors:errors};
 }
 function assertValid(layout,bounds){
  var check=validate(layout,bounds);
  if(!check.ok)throw Error('版式不完整或版本不支持：'+check.errors.join('；'));
  return layout;
 }
 // 生成一份规范版式：缺省字号、表头加粗、浅色表头与填写区，未给出的区域不臆造。
 function build(spec){
  var input=spec||{};
  var layout={schemaVersion:SCHEMA_VERSION,fontSize:input.fontSize||FONT_SIZE,
   columns:(input.columns||[]).map(function(column,index){
    return {index:column.index||index+1,width:column.width==null?18:column.width,
     wrap:column.wrap!==false,numberFormat:column.numberFormat||'@',hidden:column.hidden===true,
     title:column.title==null?'':String(column.title)};}),
   rows:(input.rows||[]).map(function(row){return {index:row.index,height:row.height};}),
   headerRows:(input.headerRows||[]).slice(),freeze:input.freeze||null,
   merges:(input.merges||[]).map(function(merge){return Object.assign({rowSpan:1,columnSpan:1},merge);}),
   fills:(input.fills||[]).map(function(fill){return Object.assign({rowSpan:1,columnSpan:1},fill);}),
   fonts:(input.fonts||[]).map(function(font){return Object.assign({rowSpan:1,columnSpan:1},font);}),
   hyperlinks:(input.hyperlinks||[]).map(function(link){return Object.assign({rowSpan:1,columnSpan:1},link);}),
   validations:(input.validations||[]).map(function(rule){
    return Object.assign({rowSpan:1,columnSpan:1,allowBlank:true,inCellDropdown:true},rule);}),
   hidden:input.hidden===true,
   print:input.print||null,metadata:input.metadata||null};
  return assertValid(layout,input.bounds);
 }
 // 便捷区域：材料明细的浅色表头与黄色填写区都按获批效果图统一定义。
 function headerFill(row,columnSpan,color){return {row:row,column:1,rowSpan:1,columnSpan:columnSpan,color:color||COLORS.header};}
 function inputFill(row,column,rowSpan,columnSpan,color){return {row:row,column:column,rowSpan:rowSpan,columnSpan:columnSpan,color:color||COLORS.input};}
 // 名称超链接的获批样式：蓝色下划线；由export-host落到Range.Font。
 function linkFont(row,column,rowSpan,columnSpan){
  return {row:row,column:column,rowSpan:rowSpan||1,columnSpan:columnSpan||1,color:COLORS.link,underline:true};
 }
 // allowOtherInput：保留下拉，但允许用户直接输入下拉以外的值（最终分类列用；2026-10-11 用户要求）。
 function listValidation(row,column,rowSpan,columnSpan,listSheet,listRange,options){
  var extra=options||{};
  return {row:row,column:column,rowSpan:rowSpan,columnSpan:columnSpan,listSheet:listSheet,listRange:listRange,
   allowBlank:extra.allowBlank!==false,inCellDropdown:extra.inCellDropdown!==false,
   allowOtherInput:extra.allowOtherInput===true};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,COLORS:COLORS,FONT_SIZE:FONT_SIZE,equalize:equalize,guardValues:guardValues,validate:validate,
  assertValid:assertValid,build:build,toColor:toColor,headerFill:headerFill,inputFill:inputFill,linkFont:linkFont,
  listValidation:listValidation};
}));
