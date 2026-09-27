(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./collection.js'),require('./workbook-layout.js'));
 else root.RfqImportPreviewModel=factory(root.RfqCollection,root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(collection,layout){
 'use strict';
 function text(value){return value==null?'':String(value);}
 function build(source,combined,options){
  var preview=collection.preview(source,combined===true),name=(options&&options.projectName)||'项目';
  if(!preview.inputCount)throw Error('请先导入有效清单。');
  var values=[[name+' 项目询价 · 导入预览'],['一、导入文件列表'],
   ['序号','文件名称','导入时间','行数','状态','']],merges=[{row:1,column:1,columnSpan:6},{row:2,column:1,columnSpan:6}],heads=[3];
  source.entries.forEach(function(entry,index){values.push([String(index+1),entry.metadata.originalName,
   text(entry.metadata.importedAt),String(entry.parsed.materials.length),entry.parsed.issues.length?'需核对':'导入成功','']);});
  values.push(['','合计','',String(preview.inputCount),'','']);
  values.push([]);
  merges.push({row:values.length+1,column:1,columnSpan:6});
  values.push(['二、合并预览（'+(combined?'仅显示将被合并的完全相同项':'分别保留清单，不进行合并')+'）']);
  heads.push(values.length+1);
  values.push(['来源文件','项目名称','项目特征描述','单位','工程量','合并结果']);
  var fills=heads.map(function(row){return layout.headerFill(row,6);});
  var duplicates=combined?preview.groups.filter(function(group){return group.sources.length>1;}):[];
  duplicates.forEach(function(group){
   var first=values.length+1;
   group.sources.forEach(function(item,index){values.push([item.file,group.name,group.feature,group.unit,
    text(item.quantity),index===0?group.sources.map(function(s){return text(s.quantity);}).join(' + ')+' = '+group.quantity:'']);});
   merges.push({row:first,column:6,rowSpan:group.sources.length});
   fills.push({row:first,column:6,rowSpan:group.sources.length,color:'#E2F0D9'});
  });
  if(!duplicates.length)values.push([combined?'没有完全相同且可合并的项目。':'当前分别保留每条材料及来源。']);
  values.push([]);
  ['三、说明','输入 '+preview.inputCount+' 行 → '+(combined?'合并后':'分别保留')+' '+preview.outputCount+' 行。',
   '仅项目名称、项目特征描述、单位完全一致时合并；十进制精确累加。',
   '预览随侧栏选择刷新，请在侧栏确认选择后开始自动分类。',
   '此预览不作为填写表；原始文件和导入副本保持不变。'].forEach(function(note){
    merges.push({row:values.length+1,column:1,columnSpan:6});values.push([note]);
   });
  var details=[['序号','来源文件','来源工作表','来源行','项目编码','项目名称','项目特征描述','单位','原工程量','本次结果工程量']];
  preview.groups.forEach(function(group,index){group.sources.forEach(function(item,sourceIndex){details.push([String(index+1),item.file,item.sheet,
   String(item.row),item.code,group.name,group.feature,group.unit,text(item.quantityRaw),sourceIndex===0?text(group.quantity):'']);});});
  return {inputCount:preview.inputCount,outputCount:preview.outputCount,mode:preview.mode,sheets:[
   {name:'导入预览',values:layout.equalize(values,6),layout:layout.build({columns:[26,24,40,12,16,28].map(function(width){return {width:width};}),
    rows:values.map(function(_,i){return {index:i+1,height:i===0?32:30};}),headerRows:heads,merges:merges,fills:fills,
    freeze:{row:4,column:1},print:{area:{row:1,column:1,rowSpan:values.length,columnSpan:6},repeatRow:3}})},
   {name:'合并明细',values:layout.equalize(details,10),layout:layout.build({columns:[10,26,20,10,18,24,44,12,18,20].map(function(width){return {width:width};}),
    headerRows:[1],fills:[layout.headerFill(1,10)],freeze:{row:2,column:1},
    print:{area:{row:1,column:1,rowSpan:details.length,columnSpan:10},repeatRow:1}})}]};
 }
 return {build:build};
}));
