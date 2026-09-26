(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./brand-table.js'),require('./workbook-layout.js'));
 else root.RfqBrandModel=factory(root.RfqBrandTable,root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(brand,layout){
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
 // ===== R7：分类汇总表（图05A/05B）=====
 // 一类一行：序号、名称、材料条数、三组品牌与供应商、询价生成方式。名称是蓝色下划线原生链接，
 // 指向对应独立分类工作簿；两种布局（分列separated／同格combined）功能一致，都写出同一套绑定信息。
 var SUMMARY_SCHEMA_VERSION=1,SUMMARY_SHEET='分类汇总表',SUMMARY_HINT_ROW_GAP=2;
 var SUMMARY_LAYOUTS=['separated','combined'];
 var SUMMARY_MODES=[{value:'synthesize',label:'合成一份'},{value:'per-brand',label:'按品牌分别生成'}];
 var SUMMARY_MODE_LABELS={synthesize:'合成一份','per-brand':'按品牌分别生成'};
 function summaryIssue(code,title,message,categoryId){
  return {code:code,title:title,message:message,categoryId:categoryId==null?null:text(categoryId)};
 }
 function summaryModeLabel(value){return SUMMARY_MODE_LABELS[text(value)]||'';}
 function summaryModeValue(label){
  var value=text(label);
  for(var index=0;index<SUMMARY_MODES.length;index++)if(SUMMARY_MODES[index].label===value)return SUMMARY_MODES[index].value;
  return '';
 }
 function splitPath(value){
  return text(value).replace(/\//g,'\\').split('\\').filter(function(part){return part!=='';});
 }
 // 从汇总表目录到分类工作簿的“相对链接地址”：整目录搬移后仍能点开同一份文件。
 function relativePath(fromDirectory,toPath){
  var from=splitPath(fromDirectory),to=splitPath(toPath),drive=/^[a-z]:$/i;
  if(!from.length||!to.length)throw Error('无法计算分类工作簿的相对链接地址。');
  if(!(drive.test(from[0])&&drive.test(to[0]))||from[0].toLowerCase()!==to[0].toLowerCase())
   throw Error('分类工作簿与分类汇总表不在同一盘符，无法生成相对链接：'+text(toPath));
  var index=0;
  while(index<from.length&&index<to.length-1&&from[index].toLowerCase()===to[index].toLowerCase())index++;
  var up=[],step;
  for(step=index;step<from.length;step++)up.push('..');
  return up.concat(to.slice(index)).join('\\');
 }
 function summaryLayoutFor(name){
  if(text(name)==='combined')return {name:'combined',titleRow:1,projectRow:2,headerRow:4,subHeaderRow:null,firstRow:5,
   width:7,groups:[[4],[5],[6]],modeColumn:7,auxCategory:8,auxFile:9,auxOptions:10};
  return {name:'separated',titleRow:1,projectRow:null,headerRow:2,subHeaderRow:3,firstRow:4,
   width:10,groups:[[4,5],[6,7],[8,9]],modeColumn:10,auxCategory:11,auxFile:12,auxOptions:13};
 }
 function summaryHeaders(spec){
  if(spec.name==='combined')return [['序号','名称','材料条数','品牌与供应商一（用户填写）','品牌与供应商二（用户填写）',
   '品牌与供应商三（用户填写）','询价生成方式']];
  return [['序号','名称','材料条数','品牌与供应商一','','品牌与供应商二','','品牌与供应商三','','询价生成方式'],
   ['','','','品牌','供应商','品牌','供应商','品牌','供应商','']];
 }
 function put(row,index,value){while(row.length<index)row.push('');row[index-1]=value;}
 // 分类清单：来自R6已核实的回执（每类一个独立工作簿）。先校验类别、路径与清洗后重名，再生成汇总。
 function summaryPlan(categories,options){
  var input=options||{},directory=text(input.directory);
  if(!/^(?:[a-z]:[\\/]|\\\\)/i.test(directory))throw Error('分类汇总表目录无效，请先确认成果批次目录。');
  if(!Array.isArray(categories)||!categories.length)throw Error('没有需要询价的类别，未生成分类汇总表。');
  var issues=[],seen={},taken={},list=[];
  categories.forEach(function(item){
   var entry=item||{},categoryId=text(entry.categoryId),categoryName=text(entry.categoryName),path=text(entry.path);
   if(!categoryId){issues.push(summaryIssue('category-id-missing','缺少类别标识','有一个分类工作簿缺少稳定类别标识，不能生成汇总表。'));return;}
   if(!categoryName){issues.push(summaryIssue('category-name-missing','类别名称为空','类别 '+categoryId+' 没有名称，不能生成汇总表。',categoryId));return;}
   if(!/^(?:[a-z]:[\\/]|\\\\)/i.test(path)||!/^.+\.xlsx$/i.test(path)){
    issues.push(summaryIssue('category-path-invalid','分类工作簿路径无效','类别“'+categoryName+'”的分类工作簿路径无效，不能生成汇总表。',categoryId));return;}
   if(seen[categoryId]){issues.push(summaryIssue('category-duplicate','类别重复','类别标识 '+categoryId+' 在清单里出现多次，不能生成汇总表。',categoryId));return;}
   seen[categoryId]=true;
   var file=text(path).replace(/[\\/]+$/,'').replace(/[\\/][^\\/]*$/,'').replace(/[\\/]/g,'\\');
   var fileName=text(path).replace(/[\\/]+$/,'').split(/[\\/]/).pop(),relative;
   try{relative=relativePath(directory,path);}
   catch(error){issues.push(summaryIssue('category-relative-failed','无法生成相对链接',error.message,categoryId));return;}
   var key=relative.toLowerCase();
   if(taken[key])issues.push(summaryIssue('category-name-collision','分类工作簿重名',
    '类别“'+categoryName+'”与“'+taken[key]+'”的链接地址相同（'+relative+'），请先修改后再生成。',categoryId));
   else taken[key]=categoryName;
   list.push({categoryId:categoryId,categoryName:categoryName,rowCount:Number(entry.rowCount)||0,
    path:text(path),file:fileName,relative:relative,sha256:entry.sha256==null?null:text(entry.sha256)});
  });
  return {schemaVersion:SUMMARY_SCHEMA_VERSION,inputKey:input.inputKey==null?null:text(input.inputKey),
   directory:directory,layout:summaryLayoutFor(input.layout).name,projectName:text(input.projectName),
   categories:list,issues:issues,ok:issues.length===0};
 }
 // 生成分类汇总表工作簿：可见区一类一行，隐藏列保存稳定类别标识与相对链接，选项表供“询价生成方式”下拉。
 function buildSummary(plan,options){
  var input=options||{};
  if(!plan||!Array.isArray(plan.categories))throw Error('生成分类汇总表需要按类别整理的清单。');
  if(!plan.ok&&plan.issues&&plan.issues.length)
   throw Error('分类汇总表清单未通过预检：'+plan.issues.map(function(item){return item.title+'：'+item.message;}).join('；'));
  if(!plan.categories.length)throw Error('没有需要询价的类别，未生成分类汇总表。');
  var spec=summaryLayoutFor(input.layout||plan.layout),headers=summaryHeaders(spec);
  var lastRow=spec.firstRow+plan.categories.length-1,width=spec.auxOptions;
  var hintRow=lastRow+SUMMARY_HINT_ROW_GAP,values=[],rowIndex;
  function blank(){var row=[];while(row.length<width)row.push('');return row;}
  // 先建满等宽网格再填值，避免稀疏行在保存值校验时被判为“与预览不一致”。
  for(rowIndex=0;rowIndex<hintRow;rowIndex++)values.push(blank());
  put(values[spec.titleRow-1],1,'分类汇总表');
  if(spec.projectRow)put(values[spec.projectRow-1],1,'项目名称：'+text(plan.projectName));
  headers.forEach(function(row,index){
   var line=values[spec.headerRow-1+index];
   row.forEach(function(value,column){put(line,column+1,value);});
  });
  plan.categories.forEach(function(entry,index){
   var row=values[spec.firstRow-1+index];
   put(row,1,String(index+1));put(row,2,entry.categoryName);put(row,3,String(entry.rowCount));
   put(row,spec.auxCategory,entry.categoryId);put(row,spec.auxFile,entry.relative);
  });
  // 方式下拉的选项列表放在隐藏列，保持单页、不新增工作表页签（与获批图一致）。
  put(values[0],spec.auxOptions,SUMMARY_MODES[0].label);
  put(values[1],spec.auxOptions,SUMMARY_MODES[1].label);
  // 底部一行操作说明：点击名称打开对应分类工作簿；同格布局另说明两行填写格式。
  var first=plan.categories[0];
  put(values[hintRow-1],1,spec.name==='combined'
   ?'单格按两行填写：第一行“品牌：…”，第二行“供应商：…”。点击名称打开对应分类工作簿，例如：'+first.categoryName+' → '+first.file
   :'点击名称打开对应分类工作簿，例如：'+first.categoryName+' → '+first.file);
  values=layout.equalize(values,width);
  var baseWidth=spec.name==='combined'?[6,20,10,26,26,26,22]:[6,20,10,16,18,16,18,16,18,20];
  var columns=[];
  for(rowIndex=0;rowIndex<width;rowIndex++){
   var aux=rowIndex+1>=spec.auxCategory;
   columns.push({index:rowIndex+1,width:aux?(rowIndex+1===spec.auxFile?40:20):baseWidth[rowIndex],
    hidden:aux,title:aux?'内部':'分类汇总'});
  }
  var fills=[],fonts=[],hyperlinks=[],merges=[];
  (spec.subHeaderRow?summaryHeaderRows(spec):[spec.headerRow]).forEach(function(row){
   fills.push(layout.headerFill(row,spec.width));});
  spec.groups.forEach(function(group){
   if(spec.name==='combined')fills.push(layout.inputFill(spec.firstRow,group[0],plan.categories.length,1));
   else fills.push(layout.inputFill(spec.firstRow,group[0],plan.categories.length,2));
  });
  if(spec.subHeaderRow){
   merges.push({row:spec.headerRow,column:spec.groups[0][0],columnSpan:2});
   merges.push({row:spec.headerRow,column:spec.groups[1][0],columnSpan:2});
   merges.push({row:spec.headerRow,column:spec.groups[2][0],columnSpan:2});
  }
  plan.categories.forEach(function(entry,index){
   var row=spec.firstRow+index;
   hyperlinks.push({row:row,column:2,address:entry.relative,display:entry.categoryName,relative:true,
    screenTip:'打开分类工作簿：'+entry.file});
   fonts.push(layout.linkFont(row,2));
  });
  var optionsRange='$'+columnLetter(spec.auxOptions)+'$1:$'+columnLetter(spec.auxOptions)+'$2';
  var sheet=layout.build({columns:columns,headerRows:[spec.headerRow].concat(spec.subHeaderRow?[spec.subHeaderRow]:[]),
   rows:[],merges:merges,fills:fills,fonts:fonts,hyperlinks:hyperlinks,
   validations:[layout.listValidation(spec.firstRow,spec.modeColumn,plan.categories.length,1,SUMMARY_SHEET,optionsRange)],
   freeze:{row:spec.firstRow,column:1},
   print:{area:{row:1,column:1,rowSpan:hintRow,columnSpan:spec.width},repeatRow:spec.headerRow},
   metadata:{profile:'category-summary',layout:spec.name,headerRow:spec.headerRow,firstRow:spec.firstRow,lastRow:lastRow,
    modeColumn:spec.modeColumn,auxCategory:spec.auxCategory,auxFile:spec.auxFile,
    categoryIds:plan.categories.map(function(entry){return entry.categoryId;})}},
   {rowCount:values.length,columnCount:width});
  return {schemaVersion:SUMMARY_SCHEMA_VERSION,inputKey:plan.inputKey,directory:plan.directory,layout:spec.name,
   projectName:plan.projectName,sheet:SUMMARY_SHEET,headerRow:spec.headerRow,firstRow:spec.firstRow,lastRow:lastRow,
   modeColumn:spec.modeColumn,auxCategory:spec.auxCategory,auxFile:spec.auxFile,
   auxOptions:spec.auxOptions,
   categories:plan.categories.map(function(entry){return Object.assign({},entry);}),
   sheets:[{name:SUMMARY_SHEET,values:values,layout:sheet}]};
 }
 function summaryHeaderRows(spec){return [spec.headerRow,spec.subHeaderRow];}
 function columnLetter(index){var name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
 // 汇总表只保存可复现的绑定信息：布局、数据区域、稳定类别标识与相对链接、内容键。
 function summaryBindingFor(target,workbook){
  if(typeof target!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(target)||!/^.+\.xlsx$/i.test(target))
   throw Error('分类汇总表路径无效，请选择新的xlsx绝对路径。');
  var source=workbook||{};
  return {schemaVersion:SUMMARY_SCHEMA_VERSION,path:target,sheet:source.sheet||SUMMARY_SHEET,
   layout:source.layout||'separated',headerRow:source.headerRow||2,firstRow:source.firstRow||4,lastRow:source.lastRow||3,
   modeColumn:source.modeColumn||10,auxCategory:source.auxCategory||null,auxFile:source.auxFile||null,
   inputKey:source.inputKey==null?null:text(source.inputKey),
   projectName:source.projectName==null?'':text(source.projectName),
   categories:(source.categories||[]).map(function(entry){
    return {categoryId:text(entry.categoryId),categoryName:text(entry.categoryName),rowCount:Number(entry.rowCount)||0,
     file:text(entry.file),relative:text(entry.relative),path:text(entry.path)};})};
 }
 function validateSummaryBinding(binding){
  var errors=[];
  if(!binding||typeof binding!=='object'||Array.isArray(binding))return {ok:false,errors:['分类汇总表绑定不是有效对象。']};
  if(binding.schemaVersion!==SUMMARY_SCHEMA_VERSION)errors.push('分类汇总表绑定版本不支持：'+text(binding.schemaVersion));
  if(typeof binding.path!=='string'||!binding.path)errors.push('分类汇总表绑定缺少路径。');
  if(typeof binding.sheet!=='string'||!binding.sheet)errors.push('分类汇总表绑定缺少工作表名。');
  if(SUMMARY_LAYOUTS.indexOf(text(binding.layout))<0)errors.push('分类汇总表绑定缺少有效布局。');
  if(!Number.isSafeInteger(binding.headerRow)||binding.headerRow<1)errors.push('分类汇总表绑定缺少表头行号。');
  if(!Number.isSafeInteger(binding.firstRow)||binding.firstRow<=binding.headerRow)errors.push('分类汇总表绑定缺少数据起始行。');
  if(binding.modeColumn!=null&&(!Number.isSafeInteger(binding.modeColumn)||binding.modeColumn<1))
   errors.push('分类汇总表绑定缺少询价生成方式列。');
  if(!Array.isArray(binding.categories)||!binding.categories.length)errors.push('分类汇总表绑定缺少类别清单。');
  ['auxCategory','auxFile'].forEach(function(field){
   if(binding[field]==null)return;
   if(!Number.isSafeInteger(binding[field])||binding[field]<1)errors.push('分类汇总表绑定'+field+'无效。');
  });
  return {ok:errors.length===0,errors:errors};
 }
 // ===== R8：按稳定类别ID读回汇总表内填写的品牌与供应商 =====
 // 两种布局解析成同一套口径：每类一行、1至3组品牌/供应商、每类一个询价生成方式。读回通过后即“品牌汇总”
 // 阶段的唯一依据；询价对象显式携带groups，分别/合成取值不再被最后一品牌覆盖。
 function summaryCellAddress(row,column){return columnLetter(column)+String(row);}
 function summaryIssueAt(code,title,message,row,column,categoryId){
  var cell=row&&column?summaryCellAddress(row,column):null;
  return {code:code,title:title,message:(cell?('分类汇总表!'+cell+'：'):'')+message,
   row:row==null?null:row,column:column==null?null:column,cell:cell,categoryId:categoryId==null?null:text(categoryId)};
 }
 function summaryCellAt(values,row,column){
  var line=Array.isArray(values)?values[row-1]:null,value=Array.isArray(line)?line[column-1]:null;
  return value==null?'':String(value).trim();
 }
 function summaryRowBlank(values,row){
  var line=Array.isArray(values)?values[row-1]:null;
  if(!Array.isArray(line))return true;
  return line.every(function(value){return value==null||String(value).trim()==='';});
 }
 // 同格布局：单格两行“品牌：…”“供应商：…”，兼容中英文冒号；缺标签/重复标签/额外不明文本都报单元格，不猜。
 function parseCombinedGroup(raw,row,column,categoryId){
  var lines=text(raw).split(/\r?\n/).map(function(line){return line.trim();}).filter(function(line){return line!=='';});
  var brand=null,supplier=null,brandSeen=false,supplierSeen=false,duplicate=false,unknown=null;
  lines.forEach(function(line){
   var match=line.match(/^(品牌|brand)\s*[:：]\s*(.*)$/i);
   if(match){if(brandSeen)duplicate=true;brandSeen=true;brand=match[2].trim();return;}
   match=line.match(/^(供应商|supplier|供货单位)\s*[:：]\s*(.*)$/i);
   if(match){if(supplierSeen)duplicate=true;supplierSeen=true;supplier=match[2].trim();return;}
   if(unknown===null)unknown=line;
  });
  if(unknown!==null)return {issue:summaryIssueAt('combined-unknown','同格填写含无法识别的内容',
   '同格填写只能有两行“品牌：…”与“供应商：…”，这一格还有“'+unknown+'”，请按格式修改。',row,column,categoryId)};
  if(duplicate)return {issue:summaryIssueAt('combined-duplicate','同格填写标签重复',
   '同格填写的“品牌/供应商”标签出现多次，请合并为两行。',row,column,categoryId)};
  if(lines.length&&!brandSeen)return {issue:summaryIssueAt('combined-brand-missing','同格填写缺少品牌标签',
   '同格填写缺少“品牌：…”这一行，请按格式修改。',row,column,categoryId)};
  if(lines.length&&!supplierSeen)return {issue:summaryIssueAt('combined-supplier-missing','同格填写缺少供应商标签',
   '同格填写缺少“供应商：…”这一行，请按格式修改。',row,column,categoryId)};
  return {group:{brand:brand==null?'':brand,supplier:supplier==null?'':supplier}};
 }
 // 读回汇总表：表头、稳定类别ID、名称/条数固定列、每组品牌供应商、生成方式都逐项核对，错误定位到具体单元格。
 function parseSummary(values,binding){
  var issues=[],check=validateSummaryBinding(binding);
  if(!check.ok){
   check.errors.forEach(function(message){issues.push({code:'binding-invalid',title:'汇总表绑定无效',
    message:message,row:null,column:null,cell:null,categoryId:null});});
   return {ok:false,issues:issues,categories:[],expectedSheets:0,totalGroups:0,sheet:SUMMARY_SHEET};
  }
  var spec=summaryLayoutFor(binding.layout),
   auxCategory=binding.auxCategory||spec.auxCategory,modeColumn=binding.modeColumn||spec.modeColumn;
  if(!Array.isArray(values)||!values.length){
   issues.push({code:'sheet-empty',title:'汇总表为空',message:'分类汇总表没有内容，请用插件重新生成后再填写。',
    row:null,column:null,cell:null,categoryId:null});
   return {ok:false,issues:issues,categories:[],expectedSheets:0,totalGroups:0,sheet:SUMMARY_SHEET};
  }
  summaryHeaders(spec).forEach(function(line,index){
   var rowNumber=binding.headerRow+index;
   line.forEach(function(expected,column){
    if(!expected)return;
    var actual=summaryCellAt(values,rowNumber,column+1);
    if(actual!==expected)issues.push(summaryIssueAt('header-changed','汇总表表头被改动',
     '第'+rowNumber+'行应为“'+expected+'”，实际是“'+actual+'”，请用插件重新生成汇总表。',rowNumber,column+1,null));
   });
  });
  var expected={},order=[];
  (binding.categories||[]).forEach(function(item){
   var categoryId=text(item.categoryId);
   if(!categoryId||expected[categoryId])return;
   expected[categoryId]={categoryId:categoryId,categoryName:text(item.categoryName),rowCount:Number(item.rowCount)||0};
   order.push(expected[categoryId]);
  });
  var seen={},categories=[],expectedSheets=0,totalGroups=0,row;
  for(row=binding.firstRow;row<=values.length;row++){
   if(summaryRowBlank(values,row))continue;
   var categoryId=summaryCellAt(values,row,auxCategory);
   // 生成时在数据区下方留了一行操作说明（列A以“点击名称/单格按两行”开头），它不是数据行，直接跳过。
   if(!categoryId&&/^(?:点击名称|单格按两行)/.test(summaryCellAt(values,row,1)))continue;
   if(!categoryId){issues.push(summaryIssueAt('category-id-missing','缺少类别标识',
    '这一行没有类别标识，请用插件重新生成汇总表。',row,auxCategory,null));continue;}
   var target=expected[categoryId];
   if(!target){issues.push(summaryIssueAt('category-unknown','类别不属于本次汇总表',
    '类别标识“'+categoryId+'”不属于本次汇总表，请重新生成后再填写。',row,auxCategory,categoryId));continue;}
   if(seen[categoryId]){issues.push(summaryIssueAt('category-duplicate','类别行重复',
    '第'+seen[categoryId]+'行与这一行的类别标识重复：'+categoryId+'，请删除多出来的行。',row,auxCategory,categoryId));continue;}
   seen[categoryId]=row;
   var name=summaryCellAt(values,row,2),count=summaryCellAt(values,row,3);
   if(name!==target.categoryName)issues.push(summaryIssueAt('name-changed','类别名称被改动',
    '类别名称应为“'+target.categoryName+'”，实际是“'+name+'”；请还原或重新生成汇总表。',row,2,categoryId));
   if(count!==String(target.rowCount))issues.push(summaryIssueAt('count-changed','材料条数被改动',
    '材料条数应为'+target.rowCount+'，实际是“'+count+'”；请还原或重新生成汇总表。',row,3,categoryId));
   var groupIssues=[],parsedGroups=[];
   spec.groups.forEach(function(columns,index){
    var parsed;
    if(spec.name==='combined')parsed=parseCombinedGroup(summaryCellAt(values,row,columns[0]),row,columns[0],categoryId);
    else parsed={group:{brand:summaryCellAt(values,row,columns[0]),supplier:summaryCellAt(values,row,columns[1])}};
    if(parsed.issue){groupIssues.push(parsed.issue);return;}
    parsedGroups.push({brand:text(parsed.group.brand),supplier:text(parsed.group.supplier),
     index:index,columns:columns,column:columns[0]});
   });
   if(groupIssues.length){issues=issues.concat(groupIssues);continue;}
   // 空组忽略；只要有一项不完整就报半组并定位到该组单元格，不猜也不补。
   var complete=[];
   parsedGroups.forEach(function(group){
    if(!group.brand&&!group.supplier)return;
    if(!group.brand||!group.supplier){
     var badColumn=group.brand?group.columns[group.columns.length-1]:group.columns[0];
     issues.push(summaryIssueAt('group-half','品牌与供应商没有成对填写',
      '第'+(group.index+1)+'组只填了'+(group.brand?'品牌':'供应商')+'，请补齐或清空这一组。',row,badColumn,categoryId));
     return;}
    complete.push(group);
   });
   if(!complete.length){issues.push(summaryIssueAt('group-empty','还没有填写品牌与供应商',
    '这一类至少要填写一组完整的品牌与供应商。',row,spec.groups[0][0],categoryId));continue;}
   var combination={};
   complete.forEach(function(group){
    var key=(group.brand+'/'+group.supplier).toLowerCase();
    if(combination[key])issues.push(summaryIssueAt('group-duplicate','品牌与供应商组合重复',
     '“'+group.brand+' / '+group.supplier+'”出现了两次，请删除重复的一组。',row,group.column,categoryId));
    else combination[key]=true;
   });
   var modeLabel=summaryCellAt(values,row,modeColumn),mode=summaryModeValue(modeLabel);
   if(modeLabel&&!mode)issues.push(summaryIssueAt('mode-unknown','询价生成方式无法识别',
    '“'+modeLabel+'”不是可选方式，请从下拉里选择“合成一份”或“按品牌分别生成”。',row,modeColumn,categoryId));
   else if(complete.length>1&&!mode)issues.push(summaryIssueAt('mode-missing','多组品牌未选择询价生成方式',
    '这一类有'+complete.length+'组品牌，请选择“合成一份”或“按品牌分别生成”。',row,modeColumn,categoryId));
   if(!mode)mode='synthesize';
   categories.push({categoryId:categoryId,categoryName:target.categoryName,rowCount:target.rowCount,
    mode:mode,groups:complete.map(function(group){return {brand:group.brand,supplier:group.supplier};}),row:row});
   totalGroups+=complete.length;
   expectedSheets+=mode==='per-brand'?complete.length:1;
  }
  order.forEach(function(item){
   if(seen[item.categoryId])return;
   issues.push({code:'category-missing',title:'汇总表缺少类别行',
    message:'汇总表里缺少类别“'+item.categoryName+'”这一行，可能删除了行；请重新生成汇总表后再填写。',
    row:null,column:null,cell:null,categoryId:item.categoryId});
  });
  return {ok:issues.length===0,issues:issues,categories:issues.length?[]:categories,
   expectedSheets:issues.length?0:expectedSheets,totalGroups:issues.length?0:totalGroups,
   layout:spec.name,inputKey:binding.inputKey,sheet:SUMMARY_SHEET,path:binding.path,
   projectName:binding.projectName==null?'':text(binding.projectName)};
 }
 // 汇总读回的紧凑记录：只保留可复现的业务内容，供项目brands字段保存与询价/拆分内容键使用。
 function summaryReadRecord(read,options){
  var input=options||{},source=read||{};
  return {schemaVersion:SUMMARY_SCHEMA_VERSION,layout:text(source.layout),
   inputKey:source.inputKey==null?null:text(source.inputKey),
   summaryPath:input.summaryPath==null?(source.path==null?null:text(source.path)):text(input.summaryPath),
   sheet:SUMMARY_SHEET,readAt:input.readAt==null?null:text(input.readAt),
   expectedSheets:Number(source.expectedSheets)||0,
   categories:(source.categories||[]).map(function(entry){
    return {categoryId:text(entry.categoryId),categoryName:text(entry.categoryName),rowCount:Number(entry.rowCount)||0,
     mode:text(entry.mode),groups:(entry.groups||[]).map(function(group){
      return {brand:text(group.brand),supplier:text(group.supplier)};})};})};
 }
 // 预计份数：单组只有一份；多组按“合成一份”1份、“按品牌分别生成”按品牌组数各一份。
 function summarySheetCount(categories){
  return (Array.isArray(categories)?categories:[]).reduce(function(total,entry){
   var groups=(entry&&entry.groups)||[];
   if(!groups.length)return total;
   return total+(text(entry.mode)==='per-brand'?groups.length:1);},0);
 }
 function summaryCountsText(categories){
  return (Array.isArray(categories)?categories:[]).map(function(entry){
   var groups=(entry&&entry.groups)||[];
   return text(entry.categoryName)+' '+String(text(entry.mode)==='per-brand'?groups.length:1)+' 份';}).join('、');
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,SHEET:SHEET,DETAIL:DETAIL,NOTE:NOTE,COLUMNS:COLUMNS,EDITABLE:EDITABLE.slice(),
  buildWorkbook:buildWorkbook,bindingFor:bindingFor,validateBinding:validateBinding,parseSheet:parseSheet,apply:apply,
  SUMMARY_SCHEMA_VERSION:SUMMARY_SCHEMA_VERSION,SUMMARY_SHEET:SUMMARY_SHEET,SUMMARY_LAYOUTS:SUMMARY_LAYOUTS.slice(),
  SUMMARY_MODES:SUMMARY_MODES.map(function(item){return Object.assign({},item);}),
  summaryLayoutFor:summaryLayoutFor,summaryModeLabel:summaryModeLabel,summaryModeValue:summaryModeValue,
  relativePath:relativePath,summaryPlan:summaryPlan,buildSummary:buildSummary,
  summaryBindingFor:summaryBindingFor,validateSummaryBinding:validateSummaryBinding,
  parseSummary:parseSummary,summaryReadRecord:summaryReadRecord,
  summarySheetCount:summarySheetCount,summaryCountsText:summaryCountsText};
}));
