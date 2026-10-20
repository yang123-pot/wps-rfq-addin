(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./collection.js'),require('./workbook-layout.js'));
 else root.RfqImportPreviewModel=factory(root.RfqCollection,root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(collection,layout){
 'use strict';
 function unique(values){
  var result=[];values.forEach(function(value){value=String(value||'').trim();if(value&&result.indexOf(value)<0)result.push(value);});
  return result.join('；');
 }
 // TRIAL-001：原工作簿不动；预览始终逐表统计，只计算预计结果，不生成材料明细。
 function build(source,combined,options){
  var opts=options||{},name=opts.projectName||'项目',sheetCount=0;
  var preview=collection.preview(source,combined===true,opts.mergeAllWorkbooks===true);
  var values=[[name+' · 导入预览'],['按原文件工作表标签顺序列出，原件及小标题保持不变。'],
   ['序号','文件名称','工作表名称','工程／单体名称','专业／区段','材料条数','核对提示']];
  source.entries.forEach(function(entry){
   (entry.snapshot.sheets||[]).forEach(function(sheet){
    var materials=entry.parsed.materials.filter(function(item){return item.source&&item.source.sheet===sheet.name;});
    var issues=entry.parsed.issues.filter(function(issue){return issue.sheet===sheet.name;});
    var engineering=unique(materials.map(function(item){return item.source.engineering;}));
    var sections=unique(materials.map(function(item){return unique([item.source.profession,item.source.section]);}));
    sheetCount++;
    values.push([String(sheetCount),entry.metadata.originalName,sheet.name,engineering||'待核对',sections||'待核对',
     String(materials.length),(issues.length?'待核对 '+issues.length+' 项':materials.length?'已识别':'未识别到材料')]);
   });
  });
  values.push([]);
  values.push(['共 '+source.entries.length+' 本文件 · '+sheetCount+' 张工作表 · 原始 '+preview.inputCount+' 条材料']);
  values.push(['原始 '+preview.inputCount+' 条 → 预计整理后 '+preview.outputCount+' 条，减少 '+(preview.inputCount-preview.outputCount)+' 条重复材料。']);
  values.push([combined===true?'已选择合并完全相同的材料，数量相加；此处仅显示预计条数。':'未选择合并相同材料，逐条保留，不累加数量。']);
  values.push([opts.mergeAllWorkbooks===true?'后续统一整理全部工作簿；目前只更新统计预览。':'保留各工作簿来源；目前只更新统计预览。']);
  values.push(['条数不含表头、小标题及小计；待核对材料仍计入原始条数。跨表重复只在总预计数中计算。']);
  values.push([preview.canFinalize?'请核对工作表是否完整，确认整理方式后才开始自动分类。':'仍有待核对问题；预计条数仅供核对，解决问题后才可继续。']);
  values.push(['原文件、导入副本的内容、格式、小标题和工作表顺序保持不变；不生成合并明细。']);
  var merges=[{row:1,column:1,columnSpan:7},{row:2,column:1,columnSpan:7}];
  for(var index=4+sheetCount;index<=values.length;index++)merges.push({row:index,column:1,columnSpan:7});
  var usedNames=Object.create(null);usedNames['导入预览']=true;
  var sourceCopies=source.entries.map(function(entry,fileIndex){return {
   originalPath:entry.metadata.originalPath,copyPath:entry.metadata.copyPath,fingerprint:entry.metadata.fingerprint,
   sheets:(entry.snapshot.sheets||[]).map(function(sheet,index){
    var prefix=source.entries.length>1?(fileIndex+1)+'_'+(index+1)+'_':sheet.name==='导入预览'?'原表_':'';
    var base=prefix+sheet.name.slice(0,31-prefix.length),previewName=base,n=2;
    while(usedNames[previewName.toLowerCase()]){var suffix='_'+n++;previewName=base.slice(0,31-suffix.length)+suffix;}
    usedNames[previewName.toLowerCase()]=true;
    return {sourceName:sheet.name,previewName:previewName};
   })};});
  return {inputCount:preview.inputCount,outputCount:preview.outputCount,sheetCount:sheetCount,sourceCopies:sourceCopies,
   mode:preview.mode,previewOnly:opts.previewOnly===true,sheets:[
    {name:'导入预览',values:layout.equalize(values,7),layout:layout.build({
     columns:[9,30,30,30,32,12,20].map(function(width){return {width:width};}),
     // TRIAL-002：统计行不再写死 34 磅。专业/区段可能包含多个标题，交给宿主按换行内容
     // AutoFit；标题仍保持 32 磅，避免长项目名把首行撑得过高。
     rows:[{index:1,height:32}],
     headerRows:[3],merges:merges,fills:[layout.headerFill(3,7)],freeze:{row:4,column:1},
     print:{area:{row:1,column:1,rowSpan:values.length,columnSpan:7},repeatRow:3}})}]};
 }
 return {build:build};
}));
