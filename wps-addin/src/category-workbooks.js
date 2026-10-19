(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./workbook-layout.js'),require('./export-host.js'));
 else root.RfqCategoryWorkbooks=factory(root.RfqWorkbookLayout,root.RfqExportHost);
}(typeof window==='object'?window:globalThis,function(layout,exportHost){
 'use strict';
 // R6：按整表确认快照生成独立分类工作簿。每个询价类别一个.xlsx（不是一个工作簿里多个分类页），
 // 每簿只含本类材料，公开10列，品牌/报价单价/金额留空；无需询价行只保留在审核成果表中。
 var SCHEMA_VERSION=1,LAYOUT_VERSION=2,SHEET='材料明细',FOLDER='分类工作簿',NO_INQUIRY='no-inquiry';
 var COLUMNS=['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'];
 var ROW_ID_COLUMN=11;                 // K列：随行隐藏辅助列，保存稳定rowId，公开列仍固定10列
 var HEADER_ROW=1,FIRST_ROW=2;
 function text(value){return value==null?'':String(value);}
 function isAbsolute(value){return /^(?:[a-z]:[\\/]|\\\\)/i.test(text(value));}
 function safeName(value){
  return text(value).replace(/[\\/:*?"<>|]/g,'_').replace(/[. ]+$/,'').trim()||'未命名类别';
 }
 function fileNameFor(categoryName){return safeName(categoryName)+'.xlsx';}
// 2026-10-11（图04/05变更）：分类工作簿由“每类一份文件”改为“一本多页”，页名＝类别名。
// Excel 页名规则：最长 31 字符，不得含 : \ / ? * [ ]，且簿内不得重名。
function safeSheetName(value,taken){
 var name=text(value).replace(/[:\\\/\?\*\[\]]/g,'_').replace(/^'+|'+$/g,'').trim();
 if(!name)name='分类';
 if(name.length>31)name=name.slice(0,31);
 var used=taken||{},key=name.toLowerCase(),index=2;
 while(used[key]){var suffix='('+index+')';name=(name.length+suffix.length>31?name.slice(0,31-suffix.length):name)+suffix;
  key=name.toLowerCase();index++;}
 return name;
}
 function directoryOf(filePath){
  var value=text(filePath).replace(/[\\/]+$/,'');
  return value.replace(/[\\/][^\\/]*$/,'');
 }
function normalizeRoot(value){
  var root=text(value).replace(/\//g,'\\').replace(/\\+$/,'');
  if(!isAbsolute(root))throw Error('成果批次目录无效，无法确定分类工作簿位置。');
  return root;
}
// 成果批次根目录沿用用户已确认的审核成果表所在目录（R4已选定位置），本包只新建“分类工作簿”子目录。
function rootOf(reviewPath){return normalizeRoot(directoryOf(reviewPath));}
function workbookDirectory(root){return normalizeRoot(root)+'\\'+FOLDER;}
function batchDirectory(reviewPath){return workbookDirectory(rootOf(reviewPath));}
 function issue(code,title,message,rowId){
  return {code:code,title:title,message:message,rowId:rowId==null?null:text(rowId)};
 }
 function indexFields(binding){
  var fields={};
  ((binding&&binding.fields)||[]).forEach(function(field){fields[text(field&&field.rowId)]=field;});
  return fields;
 }
 // 分组与文件清单：按确认快照的categoryId分组、排除无需询价，保留rowId/scopeId和数量；
 // 先检查全部目标与清洗后重名，先检查全部再写第一份。
 function plan(confirmation,options){
  var input=options||{};
  if(!confirmation||!Array.isArray(confirmation.rows)||!confirmation.rows.length)
   throw Error('生成分类工作簿需要已确认的整表审核结果。');
  if(!input.binding||!Array.isArray(input.binding.fields)||!input.binding.fields.length)
   throw Error('生成分类工作簿需要审核成果表的内部绑定（含项目编码与来源边界）。');
  var directory=text(input.directory);
  if(!isAbsolute(directory))throw Error('分类工作簿目录无效，请先确认审核成果表的位置。');
  var fields=indexFields(input.binding),issues=[],order=[],byId={},noInquiryRows=0,noInquiry=null;
  confirmation.rows.forEach(function(row){
   var rowId=text(row&&row.rowId);
   if(!rowId){
    issues.push(issue('row-id-missing','缺少行标识','整表确认快照里有一行缺少稳定行标识，无法生成分类工作簿。'));
    return;
   }
   var field=fields[rowId];
   if(!field){
    issues.push(issue('row-id-unknown','行标识不属于当前成果表',
     '确认快照里的行标识 '+rowId+' 不在审核成果表绑定中，请重新整表确认后再生成。',rowId));
    return;
   }
   var categoryId=text(row.categoryId),categoryName=text(row.categoryName);
   if(row.skip===true||categoryId===NO_INQUIRY){
    noInquiryRows++;
    if(!noInquiry)noInquiry={categoryId:NO_INQUIRY,categoryName:'无需询价',isNoInquiry:true,rows:[]};
    noInquiry.rows.push({rowId:rowId,index:String(noInquiry.rows.length+1),code:text(field.code),
     name:text(row.name)||text(field.name),feature:text(row.feature),unit:text(row.unit),quantity:text(row.quantity),
     scopeId:text(field.scopeId),sourceIds:((field.sourceIds||[]).map(function(id){return text(id);})),
     categoryId:NO_INQUIRY,categoryName:'无需询价',skip:true,note:'无需询价'});
    return;
   }
   if(!categoryId||!categoryName){
    issues.push(issue('category-missing','最终分类为空',
     '“'+(text(row.name)||text(field.name)||'（名称待补）')+'”没有有效类别，不能生成分类工作簿。',rowId));
    return;
   }
   var entry=byId[categoryId];
   if(!entry){
    entry={categoryId:categoryId,categoryName:categoryName,rows:[]};
    byId[categoryId]=entry;order.push(entry);
   }
   entry.rows.push({rowId:rowId,index:String(entry.rows.length+1),code:text(field.code),
    name:text(row.name)||text(field.name),feature:text(row.feature),unit:text(row.unit),quantity:text(row.quantity),
    scopeId:text(field.scopeId),sourceIds:((field.sourceIds||[]).map(function(id){return text(id);})),
    categoryId:categoryId,categoryName:categoryName,skip:false,note:''});
  });
  // 一本多页：所有类别页都写进同一个工作簿，逐类条目共用这一个文件；page 名仍按类别名规则清洗。
  var projectName=text(input.projectName);
  var workbookName=safeName(projectName||'分类工作簿')+'_分类工作簿.xlsx',
   workbookPath=directory+'\\'+workbookName;
  var files=[],taken={};
  order.forEach(function(entry){
   var categoryFile=fileNameFor(entry.categoryName),key=categoryFile.toLowerCase();
   entry.file=workbookName;entry.path=workbookPath;entry.categoryFile=categoryFile;
   entry.rowCount=entry.rows.length;entry.rowIds=entry.rows.map(function(row){return row.rowId;});
   if(taken[key])issues.push(issue('name-collision','类别名称重名',
    '类别“'+entry.categoryName+'”与“'+taken[key]+'”按文件名清洗后都是 '+categoryFile+'，请先修改类别名称再生成。'));
   else taken[key]=entry.categoryName;
   files.push(entry);
  });
 // 一本多页：页名＝类别名（经页名规则清洗），簿内重名自动加尾号而不是阻断。
 var sheetTaken={};
 files.forEach(function(entry){
  entry.sheetName=safeSheetName(entry.categoryName,sheetTaken);
  sheetTaken[entry.sheetName.toLowerCase()]=entry.categoryName;
 });
 if(noInquiry&&files.length){
  noInquiry.file=workbookName;noInquiry.path=workbookPath;
  noInquiry.splitFileName=safeName(projectName||'分类工作簿')+'_无需询价.xlsx';
  noInquiry.rowCount=noInquiry.rows.length;noInquiry.rowIds=noInquiry.rows.map(function(row){return row.rowId;});
  noInquiry.sheetName=safeSheetName('无需询价',sheetTaken);
  sheetTaken[noInquiry.sheetName.toLowerCase()]='无需询价';
 }
  var inquiryRows=files.reduce(function(total,entry){return total+entry.rowCount;},0);
  return {schemaVersion:SCHEMA_VERSION,sheet:SHEET,folder:FOLDER,
   inputKey:input.inputKey==null?null:text(input.inputKey),
   root:input.root==null?directoryOf(directory):text(input.root),
   batchId:input.batchId==null?null:text(input.batchId),
  file:workbookName,path:directory+'\\'+workbookName,
  sheets:files.map(function(entry){return {categoryId:entry.categoryId,categoryName:entry.categoryName,
   sheetName:entry.sheetName,rowCount:entry.rowCount,rowIds:entry.rowIds.slice()};}).concat(
    noInquiry&&files.length?[{categoryId:NO_INQUIRY,categoryName:'无需询价',sheetName:noInquiry.sheetName,
     rowCount:noInquiry.rowCount,rowIds:noInquiry.rowIds.slice(),isNoInquiry:true}]:[]),
   directory:directory,files:files,noInquiry:noInquiry&&files.length?noInquiry:null,issues:issues,ok:issues.length===0,
   counts:{categories:files.length,inquiryRows:inquiryRows,noInquiryRows:noInquiryRows,
    totalRows:confirmation.rows.length}};
 }
// 一本多页：状态以逐页 sheets 为准（含第 1 页汇总页）；旧记录没有 sheets 时退回逐份 files（兼容历史回执）。
function statusItems(record){
  var source=record||{};
  if(Array.isArray(source.sheets)&&source.sheets.length)return source.sheets;
  return source.files||[];
}
// 回执状态只由每页的真实状态推导：只要还有未完成，就绝不能显示全部完成。
function statusOf(record){
  var source=record||{},items=statusItems(source);
  if(!items.length)return source.counts&&source.counts.inquiryRows?'pending':'empty';
  var done=items.filter(function(item){return item&&item.status==='succeeded';}).length;
  return done===items.length?'complete':(done?'partial':'pending');
}
function sheetEntry(item){
  var value=item||{};
  return {categoryId:value.categoryId==null?null:text(value.categoryId),categoryName:text(value.categoryName),
   sheetName:text(value.sheetName),rowCount:Number(value.rowCount)||0,rowIds:(value.rowIds||[]).slice(),
   isSummary:value.isSummary===true,isNoInquiry:value.isNoInquiry===true,status:'pending',error:null};
}
// 图04的侧栏口径：一本多页——类别页数、纳入询价行、无需询价行。
function summarize(record){
  var source=record||{},items=statusItems(source),
   inquiryPages=items.filter(function(item){return item&&item.isSummary!==true&&item.isNoInquiry!==true;}).length,
   noInquiryPages=items.filter(function(item){return item&&item.isNoInquiry===true;}).length;
  var generated=items.filter(function(item){return item&&item.status==='succeeded';}).length;
  var failed=items.filter(function(item){return item&&(item.status==='failed'||item.status==='needs-verification');}).length;
  var counts=source.counts||{},status=statusOf(source),file=source.file==null?null:text(source.file);
  return {status:status,categories:inquiryPages,generated:generated,pending:items.length-generated,
   failed:failed,pages:items.length,file:file,
   noInquiryPages:noInquiryPages,
   inquiryRows:counts.inquiryRows||0,noInquiryRows:counts.noInquiryRows||0,totalRows:counts.totalRows||0,
   text:file?('分类工作簿已生成（1 本 · '+inquiryPages+' 类'+(noInquiryPages?' · 无需询价1页':'')+'）'):(generated+' 个分类工作簿已生成'),
   detail:(counts.inquiryRows||0)+' 行纳入询价 · '+(counts.noInquiryRows||0)+' 行无需询价'};
}
// 回执里的逐页状态随整本写入结果一起更新：一本多页只有“整本成功/整本未通过”两种真实结果。
function setSheetsStatus(record,status,error){
  var source=record||{},value=text(status)||'pending';
  (source.sheets||[]).forEach(function(sheet){
   sheet.status=value;sheet.error=error==null?null:text(error);});
  (source.files||[]).forEach(function(file){
   file.status=value;file.error=error==null?null:text(error);
   if(value==='succeeded'){file.sha256=source.sha256==null?file.sha256:text(source.sha256);file.bytes=source.bytes||0;}});
  source.status=statusOf(source);
  return source;
}
function emptyReceipt(options){
  var input=options||{};
  return {schemaVersion:SCHEMA_VERSION,inputKey:input.inputKey==null?null:text(input.inputKey),
   layoutVersion:LAYOUT_VERSION,
   root:input.root==null?null:text(input.root),batchId:input.batchId==null?null:text(input.batchId),
   directory:input.directory==null?null:text(input.directory),layout:input.layout||'separated',
   createdAt:input.createdAt==null?null:text(input.createdAt),updatedAt:null,status:'none',
  counts:{categories:0,inquiryRows:0,noInquiryRows:input.noInquiryRows||0,totalRows:input.totalRows||0},
  // 一本多页：file/path 指向那一个分类工作簿；sheets 逐页保存（第 1 页＝汇总页），files 仍逐类保存便于续作。
  file:input.file==null?null:text(input.file),path:input.path==null?null:text(input.path),
  sha256:null,bytes:0,sheets:(input.sheets||[]).map(sheetEntry),files:[]};
 }
 // 持久回执：路径/SHA/状态/批次随项目保存；一本多页时逐页状态都必须核实通过才算完成。
 // options.summary＝第 1 页汇总页（{sheetName,rowCount}）；汇总页永远排在第 1 页。
 function receipt(planValue,options){
  var input=options||{},summary=input.summary?[Object.assign({},input.summary,{isSummary:true})]:[];
  var empty=emptyReceipt({inputKey:planValue.inputKey,root:planValue.root,batchId:planValue.batchId,
   directory:planValue.directory,noInquiryRows:planValue.counts.noInquiryRows,totalRows:planValue.counts.totalRows,
   sheets:summary.concat(planValue.sheets||[])});
  empty.createdAt=input.createdAt==null?new Date().toISOString():text(input.createdAt);
  empty.updatedAt=empty.createdAt;empty.layout=input.layout||'separated';
  empty.counts.categories=planValue.files.length;empty.counts.inquiryRows=planValue.counts.inquiryRows;
  empty.file=planValue.file==null?null:text(planValue.file);
  empty.path=planValue.path==null?null:text(planValue.path);
  empty.noInquiry=planValue.noInquiry?JSON.parse(JSON.stringify(planValue.noInquiry)):null;
  empty.files=planValue.files.map(function(entry){
   return {categoryId:entry.categoryId,categoryName:entry.categoryName,name:entry.file,path:entry.path,
    rowCount:entry.rowCount,rowIds:entry.rowIds.slice(),sha256:null,bytes:0,status:'pending',error:null};
  });
  empty.status=empty.files.length?'pending':'empty';
  return empty;
 }
 // 每份文件一个工作簿：只含“材料明细”一页，10个公开列，品牌/报价单价/金额留空。
 function mainSheet(entry,options){
  var input=options||{},values=[[COLUMNS[0],COLUMNS[1],COLUMNS[2],COLUMNS[3],COLUMNS[4],
   COLUMNS[5],COLUMNS[6],COLUMNS[7],COLUMNS[8],COLUMNS[9]]];
  if(!entry||!Array.isArray(entry.rows))
   throw Error('分类工作簿缺少材料行（需要按本次整表确认分组的文件清单），未生成。');
  entry.rows.forEach(function(row){
   var line=[String(row.index),text(row.code),text(row.name),text(row.feature),text(row.unit),text(row.quantity),
    '','','',text(row.note)];
   line.push(row.rowId);            // K列：随行隐藏辅助列
   values.push(line);
  });
  values=layout.equalize(values,ROW_ID_COLUMN);
  layout.guardValues(SHEET,values);
  var width=[6,16,20,30,8,10,14,12,12,18,26],lastRow=FIRST_ROW+entry.rows.length-1;
  var columns=width.map(function(value,index){return {index:index+1,width:value,
   hidden:index+1===ROW_ID_COLUMN,title:index<COLUMNS.length?COLUMNS[index]:'行标识'};});
  var spec=layout.build({columns:columns,headerRows:[HEADER_ROW],
   fills:[layout.headerFill(HEADER_ROW,COLUMNS.length)],
   freeze:{row:FIRST_ROW,column:1},
   print:{area:{row:1,column:1,rowSpan:values.length,columnSpan:COLUMNS.length},repeatRow:HEADER_ROW},
   metadata:{profile:'category-workbook',categoryId:entry.categoryId,categoryName:entry.categoryName,
    batchId:input.batchId==null?null:text(input.batchId),rowIdColumn:ROW_ID_COLUMN,
    headerRow:HEADER_ROW,firstRow:FIRST_ROW,lastRow:lastRow}},
   {rowCount:values.length,columnCount:ROW_ID_COLUMN});
  return {name:SHEET,values:values,layout:spec};
 }
 function workbook(entry,options){return {sheets:[mainSheet(entry,options||{})]};}
 function write(app,entry,stagePath,options){
  var model=workbook(entry,options||{});
  exportHost.write(app,model,stagePath);
  return model;
 }
// 2026-10-11（图04/05变更）：一本多页写入——第 1 页＝分类汇总页（由调用方给出），其后每类一页，页名＝类别名。
function writeAll(app,planValue,stagePath,options){
 var input=options||{},sheets=[];
 if(input.summarySheet)sheets.push(input.summarySheet);
 (planValue.files||[]).forEach(function(entry){
  var model=mainSheet(entry,input.sheetOptions||{});
  model.name=text(entry.sheetName)||text(entry.categoryName)||model.name;
  sheets.push(model);
 });
 if(planValue.noInquiry){
  var noInquiryModel=mainSheet(planValue.noInquiry,input.sheetOptions||{});
  noInquiryModel.name=text(planValue.noInquiry.sheetName)||'无需询价';
  sheets.push(noInquiryModel);
 }
 if(!sheets.length)throw Error('没有可写入的分类工作簿页。');
 var model={sheets:sheets};
 exportHost.write(app,model,stagePath);
 return model;
}
 // 生成后按图04习惯打开各分类工作簿供查看；宏安全值与活动簿的处理与成果表一致。
 function openForEditing(app,filePath){
  if(!isAbsolute(filePath)||!/^.+\.xlsx$/i.test(text(filePath)))throw Error('分类工作簿路径无效，未打开。');
  function key(value){return String(value||'').replace(/[\\/]+/g,'/').toLowerCase();}
  var security=app.AutomationSecurity,error=null,book=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未打开分类工作簿。');
  try{
   for(var index=1;index<=app.Workbooks.Count;index++){
    var open=app.Workbooks.Item(index);
    if(open&&key(open.FullName)===key(filePath)){open.Activate();return {path:filePath,opened:true,reused:true};}
   }
   app.AutomationSecurity=3;
   if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未打开分类工作簿。');
   book=app.Workbooks.Open(filePath,0,false);
   if(!book||key(book.FullName)!==key(filePath))throw Error('WPS未返回指定分类工作簿。');
   book.Activate();
  }catch(problem){error=problem;}
  finally{
   try{app.AutomationSecurity=security;}catch(problem){error=Error('宏安全设置恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return {path:filePath,opened:true,reused:false};
 }
// 2026-10-11（图04/05变更）：一本多页发布后按页读回——逐页核“页名与顺序”和“本页行数是否都在”。
function keyOf(value){return text(value).replace(/[\\/]+/g,'/').toLowerCase();}
function readSheets(app,filePath){
 if(!isAbsolute(filePath)||!/^.+\.xlsx$/i.test(text(filePath)))throw Error('分类工作簿路径无效，未读回核对。');
 if(!app||typeof app.Workbooks!=='object')throw Error('读回分类工作簿需要连接WPS。');
 var security=null,opened=null,book=null,error=null,list=[],index;
 try{
  var count=Number(app.Workbooks.Count)||0;
  for(index=1;index<=count;index++){
   var candidate=app.Workbooks.Item(index);
   if(candidate&&keyOf(candidate.FullName)===keyOf(filePath)){book=candidate;break;}
  }
  if(!book){
   security=app.AutomationSecurity;
   if(typeof security!=='number')throw Error('不能读取宏安全设置，未读回分类工作簿。');
   app.AutomationSecurity=3;
   if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未读回分类工作簿。');
   opened=app.Workbooks.Open(filePath,0,true);
   if(!opened||keyOf(opened.FullName)!==keyOf(filePath))throw Error('WPS未返回指定分类工作簿。');
   book=opened;
  }
  var total=Number(book.Worksheets.Count)||0;
  for(index=1;index<=total;index++){
   var sheet=book.Worksheets.Item(index),used=sheet&&sheet.UsedRange;
   list.push({index:index,sheetName:sheet?text(sheet.Name):'',rowCount:used&&used.Rows?Number(used.Rows.Count)||0:0});
  }
 }catch(problem){error=problem;}
 finally{
  try{if(opened)opened.Close(false);}catch(problem){error=error||Error('读回后关闭分类工作簿失败：'+problem.message);}
  if(security!=null)try{app.AutomationSecurity=security;}catch(problem){error=error||Error('宏安全设置恢复失败：'+problem.message);}
 }
 if(error)throw error;
 return list;
}
function verifySheets(app,filePath,sheets){
 var expected=(sheets||[]).map(function(item){
  return {sheetName:text(item.sheetName),rowCount:Number(item.rowCount)||0};});
 var actual=readSheets(app,filePath),issues=[];
 if(actual.length!==expected.length)
  issues.push('工作表页数不一致：期望 '+expected.length+' 页，实际 '+actual.length+' 页。');
 // 值逐格一致由导出宿主在写入阶段（保存重开逐值核）与发布SHA证明；这里补的是逐页结构与行数。
 // 宿主可能在已用区域尾部多算空行，因此只把“比写下的行数少”当作失败，页名与顺序必须完全一致。
 expected.forEach(function(item,index){
  var got=actual[index];
  if(!got)return;
  if(got.sheetName!==item.sheetName)
   issues.push('第 '+(index+1)+' 页应为“'+item.sheetName+'”，实际“'+got.sheetName+'”。');
  if(Number(got.rowCount)<item.rowCount)
   issues.push('“'+item.sheetName+'”行数不足：期望至少 '+item.rowCount+' 行，实际 '+got.rowCount+' 行。');
 });
 return {ok:issues.length===0,issues:issues,sheets:actual};
}
 return {SCHEMA_VERSION:SCHEMA_VERSION,LAYOUT_VERSION:LAYOUT_VERSION,SHEET:SHEET,FOLDER:FOLDER,NO_INQUIRY:NO_INQUIRY,
  COLUMNS:COLUMNS.slice(),ROW_ID_COLUMN:ROW_ID_COLUMN,HEADER_ROW:HEADER_ROW,FIRST_ROW:FIRST_ROW,
  text:text,safeName:safeName,fileNameFor:fileNameFor,directoryOf:directoryOf,
  batchDirectory:batchDirectory,workbookDirectory:workbookDirectory,rootOf:rootOf,
  plan:plan,summarize:summarize,receipt:receipt,emptyReceipt:emptyReceipt,
 sheetNameFor:safeSheetName,
 writeAll:writeAll,
  statusOf:statusOf,statusItems:statusItems,setSheetsStatus:setSheetsStatus,
  readSheets:readSheets,verifySheets:verifySheets,
  mainSheet:mainSheet,workbook:workbook,write:write,openForEditing:openForEditing};
}));
