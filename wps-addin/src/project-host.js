(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqProjectHost=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function property(object,name){try{return object&&object[name];}catch(_){return null;}}
 function normalizePath(value){
  var raw=String(value==null?'':value).trim();
  if(/^file:\/+/i.test(raw))raw=raw.replace(/^file:\/+/i,'');
  raw=raw.replace(/^localhost[\\/]+/i,'');
  try{raw=decodeURIComponent(raw);}catch(_){}
  raw=raw.replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\/,'');
  return raw.replace(/[\\/]+/g,'\\').replace(/\\$/,'').toLowerCase();
 }
 function key(value){return normalizePath(value);}
 function fullName(book){
  var full=property(book,'FullName'),directory=property(book,'Path'),name=property(book,'Name');
  return String(full||(directory&&name?String(directory)+'\\'+String(name):name||''));
 }
 function fileName(path){var parts=normalizePath(path).split('\\');return parts[parts.length-1]||'';}
 function bookName(book){return String(property(book,'Name')||fileName(fullName(book))||'').toLowerCase();}
 function sameBook(book,path){
  return !!book&&(normalizePath(fullName(book))===normalizePath(path)||
   (!!fileName(path)&&bookName(book)===fileName(path)));
 }
 function returnedLabel(book){
  var name=String(property(book,'Name')||fileName(fullName(book))||'').trim();
  return name?'（WPS返回“'+name+'”）':'';
 }
 function absolute(value){return typeof value==='string'&&/^(?:[a-z]:[\\/]|\\\\).+/i.test(value);}
 function validateMeta(meta){
  if(!meta||typeof meta!=='object'||!absolute(meta.copyPath))throw Error('工作副本路径无效，未写入。');
  if(key(meta.copyPath)===key(meta.originalPath))throw Error('不能写入原件，请使用独立工作副本。');
  if(!/^[a-f\d]{64}$/i.test(meta.fingerprint||''))throw Error('工作副本指纹无效，未写入。');
 }
 function validatePlan(plan){
  if(!plan||typeof plan.sheet!=='string'||!plan.sheet.trim())throw Error('写入计划缺少工作表名称。');
  if(!Number.isSafeInteger(plan.column)||plan.column<1)throw Error('写入计划缺少有效列号。');
  if(!Number.isSafeInteger(plan.headerRow)||plan.headerRow<1)throw Error('写入计划缺少有效表头行号。');
  if(typeof plan.header!=='string'||!plan.header.trim())throw Error('写入计划缺少列标题。');
  if(!Array.isArray(plan.rows))throw Error('写入计划缺少行内容。');
  plan.rows.forEach(function(item){
   if(!item||!Number.isSafeInteger(item.row)||item.row<1||item.row===plan.headerRow||typeof item.text!=='string')
    throw Error('写入计划行内容无效。');
  });
 }
 function findOpen(app,file){
  for(var index=1;index<=app.Workbooks.Count;index++){
   var book=app.Workbooks.Item(index);
   if(key(fullName(book))===key(file))return book;
  }
  return null;
 }
 function appendColumn(app,meta,plan){
  validateMeta(meta);validatePlan(plan);
  if(findOpen(app,meta.copyPath))throw Error('工作副本已打开，请保存并关闭后重试；用户工作簿未关闭。');
  var previous=app.ActiveWorkbook,security=app.AutomationSecurity,owned=null,reopened=null,failure=null,wrote=0;
  if(typeof security!=='number')throw Error('当前WPS不能读取宏安全设置，未写入。');
  try{
   app.AutomationSecurity=3;
   if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未写入工作副本。');
   owned=app.Workbooks.Open(meta.copyPath,0,false);
   if(!owned)throw Error('WPS未返回工作副本，未写入。');
   if(!sameBook(owned,meta.copyPath))throw Error('WPS返回的工作副本与本次项目不一致'+returnedLabel(owned)+'。');
   var sheet=owned.Worksheets.Item(plan.sheet);
   if(!sheet)throw Error('工作副本中找不到工作表：'+plan.sheet);
   var header=sheet.Cells.Item(plan.headerRow,plan.column),current=header.Value2;
   if(header.HasFormula||(current!=null&&String(current).trim()!==''&&String(current)!==plan.header))
    throw Error('“'+plan.sheet+'”第'+plan.column+'列已有内容，未覆盖。');
   var cells=plan.rows.map(function(item){
    var cell=sheet.Cells.Item(item.row,plan.column),existing=cell.Value2;
    if(cell.HasFormula||(existing!=null&&String(existing).trim()!==''))
     throw Error('“'+plan.sheet+'”第'+item.row+'行分类列已有内容，未覆盖。');
    return cell;
   });
   header.NumberFormat='@';header.Value2=plan.header;
   plan.rows.forEach(function(item,index){
    var cell=cells[index];
    cell.NumberFormat='@';cell.Value2=item.text;wrote++;
   });
   owned.Save();owned.Close(false);owned=null;
   app.AutomationSecurity=3;if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未重新打开校验。');
   reopened=app.Workbooks.Open(meta.copyPath,0,true);
   if(!reopened)throw Error('WPS未返回工作副本，未校验。');
   if(!sameBook(reopened,meta.copyPath))throw Error('WPS返回的工作副本与本次校验不一致'+returnedLabel(reopened)+'。');
   var verified=reopened.Worksheets.Item(plan.sheet);
   if(!verified||String(verified.Cells.Item(plan.headerRow,plan.column).Value2)!==plan.header)throw Error('写入校验不一致：列标题');
   plan.rows.forEach(function(item){
    if(String(verified.Cells.Item(item.row,plan.column).Value2)!==item.text)throw Error('写入校验不一致：第'+item.row+'行');
   });
  }catch(error){failure=error;}
  finally{
   try{if(reopened)reopened.Close(false);if(owned)owned.Close(false);}catch(error){failure=Error('工作副本关闭失败：'+error.message);}
   try{app.AutomationSecurity=security;}catch(error){failure=Error('宏安全设置恢复失败：'+error.message);}
   try{if(previous)previous.Activate();}catch(error){failure=Error('原工作簿恢复失败：'+error.message);}
  }
  if(failure)throw failure;
  return {sheet:plan.sheet,column:plan.column,headerRow:plan.headerRow,wrote:wrote};
 }
 return {appendColumn:appendColumn};
}));
