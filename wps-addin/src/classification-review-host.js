(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./export-host.js'),require('./classification-review-model.js'));
 else root.RfqClassificationReviewHost=factory(root.RfqExportHost,root.RfqClassificationReviewModel);
}(typeof window==='object'?window:globalThis,function(exportHost,model){
 'use strict';
 // R4宿主：把审核成果表交给export-host写入并校验（含版式/下拉），保存绑定，并支持按稳定rowId整表读回。
 var SCHEMA_VERSION=1;
 function text(value){return value==null?'':String(value);}
 function key(path){return String(path||'').replace(/[\\/]+/g,'/').toLowerCase();}
 function safeName(value){
  return text(value).replace(/[\\/:*?"<>|]/g,'_').replace(/[. ]+$/,'').trim()||'未命名项目';
 }
 function suggestedName(projectName){return safeName(projectName)+'_分类审核成果.xlsx';}
 function findOpen(app,path){
  for(var index=1;index<=app.Workbooks.Count;index++){
   var book=app.Workbooks.Item(index);
   if(key(book.FullName)===key(path))return book;
  }
  return null;
 }
 function validateBinding(binding){
  if(!binding||typeof binding!=='object')throw Error('审核成果绑定无效，请重新生成成果表。');
  if(binding.schemaVersion!==SCHEMA_VERSION)throw Error('审核成果绑定版本不支持：'+String(binding.schemaVersion));
  if(typeof binding.path!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(binding.path))throw Error('审核成果路径无效。');
  if(typeof binding.sheet!=='string'||!binding.sheet)throw Error('审核成果缺少工作表名。');
  [['headerRow','表头行'],['firstRow','首行'],['lastRow','末行'],['rowIdColumn','行标识列']].forEach(function(pair){
   if(!Number.isSafeInteger(binding[pair[0]])||binding[pair[0]]<1)throw Error('审核成果绑定缺少有效'+pair[1]+'。');
  });
  if(!Array.isArray(binding.fields)||!binding.fields.length)throw Error('审核成果绑定缺少固定字段快照。');
  return binding;
 }
 function bindingFor(receipt,result,options){
  var input=options||{};
  if(!receipt||typeof receipt.target!=='string'||!/^[a-f\d]{64}$/i.test(String(receipt.sha256||'')))
   throw Error('审核成果保存回执无效，未记录绑定。');
  var lastRow=model.FIRST_ROW+result.rows.length-1;
  return {schemaVersion:SCHEMA_VERSION,path:receipt.target,sha256:String(receipt.sha256).toLowerCase(),
   sheet:model.SHEET,headerRow:model.HEADER_ROW,firstRow:model.FIRST_ROW,lastRow:lastRow,
   rowIdColumn:model.ROW_ID_COLUMN,libraryVersion:result.libraryVersion,
   categories:result.categories.map(function(category){return {id:category.id,name:category.name};}),
   rowIds:result.rows.map(function(row){return row.rowId;}),
   fields:result.rows.map(function(row){
    return {rowId:row.rowId,index:String(row.index),name:row.name,feature:row.feature,unit:row.unit,
     quantity:row.quantity,code:row.code};}),
   inputKey:input.inputKey?String(input.inputKey):null,
   title:input.title?String(input.title):null,
   generatedAt:input.generatedAt?String(input.generatedAt):null};
 }
 function categoryIdOf(binding,name){
  var found=((binding&&binding.categories)||[]).filter(function(item){return item.name===name;})[0];
  return found?found.id:'';
 }
 // 纯读回：按稳定rowId逐行核对固定字段，行序变化不影响，筛选隐藏行也会被读到。
 function readSheet(read,binding){
  validateBinding(binding);
  var fields={},rows=[],issues=[],seen={};
  binding.fields.forEach(function(field){fields[field.rowId]=field;});
  var labels={name:'项目名称',feature:'规格',unit:'单位',quantity:'工程量'};
  for(var row=binding.firstRow;row<=binding.lastRow;row++){
   var rowId=text(read(row,binding.rowIdColumn));
   if(!rowId){
    issues.push({row:row,column:binding.rowIdColumn,code:'row-id-missing',
     message:'第'+row+'行缺少随行行标识，可能被删行或破坏。'});
    continue;
   }
   if(seen[rowId]){
    issues.push({row:row,column:binding.rowIdColumn,code:'row-id-duplicate',
     message:'第'+row+'行与第'+seen[rowId]+'行使用了同一行标识，疑似复制行。'});
    continue;
   }
   seen[rowId]=row;
   var snapshot=fields[rowId];
   if(!snapshot){
    issues.push({row:row,column:binding.rowIdColumn,code:'row-id-unknown',
     message:'第'+row+'行的标识不属于本次绑定：'+rowId});
    continue;
   }
   var record={rowId:rowId,row:row,index:text(read(row,1)).trim(),name:text(read(row,2)),
    feature:text(read(row,3)),unit:text(read(row,4)),quantity:text(read(row,5)),
    autoCategoryName:text(read(row,6)),matchState:text(read(row,7)),
    finalCategoryName:text(read(row,8)).trim(),reviewNote:text(read(row,9))};
   record.finalCategoryId=categoryIdOf(binding,record.finalCategoryName);
   var actualValues={name:record.name,feature:record.feature,unit:record.unit,quantity:record.quantity};
   ['name','feature','unit','quantity'].forEach(function(field,offset){
    if(actualValues[field]===text(snapshot[field]))return;
    issues.push({row:row,column:2+offset,code:'field-changed',
     message:'第'+row+'行“'+labels[field]+'”已改：原“'+text(snapshot[field])+'”现“'+actualValues[field]+'”'});
   });
   rows.push(record);
  }
  binding.fields.forEach(function(field){
   if(!rows.some(function(item){return item.rowId===field.rowId;}))
    issues.push({row:null,column:null,code:'row-missing',
     message:'成果表缺少材料行：'+field.name+' / '+field.feature});
  });
  return {rows:rows,issues:issues};
 }
 // 读表优先用同路径已打开簿及其最新修改；只关闭插件自己打开的簿，并恢复宏安全值与活动工作簿。
 function readBack(app,binding){
  validateBinding(binding);
  var previous=app.ActiveWorkbook,security=app.AutomationSecurity,opened=null,result=null,error=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未读取成果表。');
  try{
   var book=findOpen(app,binding.path);
   if(book){
    var sheet=book.Worksheets.Item(binding.sheet);
    if(!sheet)throw Error('成果表里找不到工作表：'+binding.sheet);
    result=readSheet(function(row,column){return sheet.Cells.Item(row,column).Value2;},binding);
   }else{
    app.AutomationSecurity=3;
    if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未读取成果表。');
    opened=app.Workbooks.Open(binding.path,0,true);
    if(!opened||key(opened.FullName)!==key(binding.path))throw Error('WPS未返回指定成果表。');
    var target=opened.Worksheets.Item(binding.sheet);
    if(!target)throw Error('成果表里找不到工作表：'+binding.sheet);
    result=readSheet(function(row,column){return target.Cells.Item(row,column).Value2;},binding);
   }
  }catch(problem){error=problem;}
  finally{
   try{if(opened)opened.Close(false);}catch(problem){error=problem;}
   try{app.AutomationSecurity=security;}catch(problem){error=Error('宏安全设置恢复失败：'+problem.message);}
   try{if(previous)previous.Activate();}catch(problem){error=Error('原工作簿恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return result;
 }
 function write(app,result,stagePath,options){
  var workbook=model.workbook(result,options||{});
  exportHost.write(app,workbook,stagePath);
  return workbook;
 }
 // 成果表是给用户在WPS里直接编辑的，因此打开后【故意】保持打开并置前，不恢复原活动工作簿。
 function openForEditing(app,path){
  if(typeof path!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(path))throw Error('审核成果表路径无效，未打开。');
  var security=app.AutomationSecurity,error=null,book=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未打开成果表。');
  try{
   app.AutomationSecurity=3;
   if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未打开成果表。');
   book=findOpen(app,path);
   if(!book){
    book=app.Workbooks.Open(path,0,false);
    if(!book||key(book.FullName)!==key(path))throw Error('WPS未返回指定成果表。');
   }
   book.Activate();
  }catch(problem){error=problem;}
  finally{
   try{app.AutomationSecurity=security;}catch(problem){error=Error('宏安全设置恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return {path:path,opened:true};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,suggestedName:suggestedName,
  selectTarget:function(app,suggested){return exportHost.selectTarget(app,suggested);},
  workbookFor:function(result,options){return model.workbook(result,options||{});},
  write:write,openForEditing:openForEditing,bindingFor:bindingFor,readSheet:readSheet,readBack:readBack,
  validateBinding:validateBinding};
}));
