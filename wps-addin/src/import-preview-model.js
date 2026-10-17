(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./collection.js'),require('./workbook-layout.js'));
 else root.RfqImportPreviewModel=factory(root.RfqCollection,root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(collection,layout){
 'use strict';
 function text(value){return value==null?'':String(value);}
 function sourceOverview(source,name){
  var inputCount=0,rows=[['序号','文件名称','工作表','材料行数','状态']],merges=[],fills=[];
  source.entries.forEach(function(entry,fileIndex){
   inputCount+=entry.parsed.materials.length;
   var sheets=entry.snapshot&&entry.snapshot.sheets||[];
   if(!sheets.length)sheets=[{name:'未识别到工作表',rowCount:0}];
   sheets.forEach(function(sheet){
    var count=entry.parsed.materials.filter(function(item){return item.source&&item.source.sheet===sheet.name;}).length;
    rows.push([String(fileIndex+1),entry.metadata.originalName,sheet.name,count,
     entry.parsed.issues.length?'含待核对':'已识别']);
   });
  });
  var values=[[name+' 项目询价 · 导入预览'],['一、导入预览（尚未合并工作簿）']].concat(rows);
  merges.push({row:1,column:1,columnSpan:5},{row:2,column:1,columnSpan:5});
  values.push([]);
  ['二、说明','请先核对上方工作簿和工作表是否完整，再回到侧栏选择是否合并全部工作簿。',
   '此时只展示导入结构，不生成跨工作簿合并后的材料结果。',
   '原始文件和导入副本均保持不变。'].forEach(function(note){
    merges.push({row:values.length+1,column:1,columnSpan:5});values.push([note]);
   });
  fills.push(layout.headerFill(3,5));
  return {inputCount:inputCount,outputCount:0,mode:'preview',previewOnly:true,sheets:[
   {name:'导入预览',values:layout.equalize(values,5),layout:layout.build({
    columns:[10,34,24,14,16].map(function(width){return {width:width};}),
    rows:values.map(function(_,index){return {index:index+1,height:index===0?32:30};}),
    headerRows:[3],merges:merges,fills:fills,freeze:{row:4,column:1},
    print:{area:{row:1,column:1,rowSpan:values.length,columnSpan:5},repeatRow:3}})}]};
 }
 function build(source,combined,options){
  var opts=options||{},name=opts.projectName||'项目';
  if(opts.previewOnly)return sourceOverview(source,name);
  var preview=collection.preview(source,combined===true,opts.mergeAllWorkbooks===true);
  if(!preview.inputCount)throw Error('请先导入有效清单。');
  var values=[[name+' 项目询价 · 导入预览'],['一、导入文件列表'],
   ['序号','文件名称','导入时间','行数','状态','']],merges=[{row:1,column:1,columnSpan:6},{row:2,column:1,columnSpan:6}],heads=[3];
  source.entries.forEach(function(entry,index){values.push([String(index+1),entry.metadata.originalName,
   text(entry.metadata.importedAt),String(entry.parsed.materials.length),entry.parsed.issues.length?'需核对':'导入成功','']);});
  values.push(['','合计','',String(preview.inputCount),'','']);
  values.push([]);
  merges.push({row:values.length+1,column:1,columnSpan:6});
  values.push(['二、材料处理预览（'+(opts.mergeAllWorkbooks?'已合并全部工作簿':'保留每个工作簿来源')+
   (combined?'，并合并完全相同项':'，不累加重复项')+'）']);
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
  if(!duplicates.length)values.push([combined?'没有完全相同且可合并的项目。':'全部材料进入当前项目，按工作簿和工作表分别保留来源。']);
  values.push([]);
  ['三、说明','输入 '+preview.inputCount+' 行 → '+(combined?'合并完全相同项后':'按来源分别保留')+' '+preview.outputCount+' 行。',
   opts.mergeAllWorkbooks?'已按用户选择合并全部工作簿，作为一份材料清单继续。':'各工作簿保留来源分组，不跨工作簿合并材料。',
   combined?'仅项目名称、项目特征描述、单位完全一致时合并；数量精确累加。':'逐条保留材料，并记录来自哪个工作簿、工作表和来源行。',
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
