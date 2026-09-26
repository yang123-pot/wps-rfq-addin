(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./export-host.js'),require('./brand-model.js'));
 else root.RfqBrandHost=factory(root.RfqExportHost,root.RfqBrandModel);
}(typeof window==='object'?window:globalThis,function(host,model){
 'use strict';
 function key(path){return String(path||'').replace(/[\\/]+/g,'/').toLowerCase();}
 function openBook(app,path){
  var count=Number(app.Workbooks.Count)||0;
  for(var index=1;index<=count;index++){
   var candidate=app.Workbooks.Item(index);
   if(candidate&&key(candidate.FullName)===key(path))return {book:candidate,opened:false};
  }
  var opened=app.Workbooks.Open(path,0,true);
  if(!opened||key(opened.FullName)!==key(path))throw Error('WPS未返回指定品牌表：'+path);
  return {book:opened,opened:true};
 }
 function sheetOf(book,name){
  var count=Number(book.Worksheets.Count)||0;
  for(var index=1;index<=count;index++){
   var candidate=book.Worksheets.Item(index);
   if(candidate&&candidate.Name===name)return candidate;
  }
  return null;
 }
 function valuesOf(sheet){
  var values=sheet.UsedRange.Value2;
  if(!Array.isArray(values))return [[values]];
  if(values.length&&!Array.isArray(values[0]))return values.map(function(value){return [value];});
  return values;
 }
 // 只读取已存在的品牌表：优先复用WPS里已打开的工作簿，未打开时以只读方式打开并在读取后关闭。
 function read(app,binding){
  if(!app||typeof app.Workbooks!=='object')throw Error('读取品牌表需要连接WPS。');
  var check=model.validateBinding(binding);
  if(!check.ok)throw Error('品牌表绑定无效：'+check.errors.join('；'));
  var handle=openBook(app,binding.path),opened=null;
  try{
   opened=handle.book;
   var sheet=sheetOf(opened,binding.sheet);
   if(!sheet)throw Error('品牌表缺少工作表“'+binding.sheet+'”，请用插件重新生成。');
   var parsed=model.parseSheet(valuesOf(sheet),binding);
   return {path:binding.path,sheet:binding.sheet,inputKey:binding.inputKey,
    assignments:parsed.assignments,rowCount:parsed.rows.length};
  } finally {
   if(handle.opened)try{opened.Close(false);}catch(_){}
  }
 }
// 生成沿用内部清单已验证的独占发布路径：不覆盖已有文件、写入后重开逐值校验。
function write(app,workbook,stagePath){return host.write(app,workbook,stagePath);}
 // R8：读取用户填写后的分类汇总表。优先复用WPS里已打开的同路径工作簿（含未保存的最新填写），
 // 未打开时以只读方式打开、读完后关闭；解析与校验全部交给模型，错误定位到具体单元格。
 function readSummary(app,binding){
  if(!app||typeof app.Workbooks!=='object')throw Error('读取分类汇总表需要连接WPS。');
  var check=model.validateSummaryBinding(binding);
  if(!check.ok)throw Error('分类汇总表绑定无效：'+check.errors.join('；'));
  var handle=openBook(app,binding.path),opened=null;
  try{
   opened=handle.book;
   var sheet=sheetOf(opened,binding.sheet);
   if(!sheet)throw Error('分类汇总表缺少工作表“'+binding.sheet+'”，请用插件重新生成后再填写。');
   var parsed=model.parseSummary(valuesOf(sheet),binding);
   return Object.assign({path:binding.path,sheet:binding.sheet,inputKey:binding.inputKey},parsed);
  } finally {
   if(handle.opened)try{opened.Close(false);}catch(_){}
  }
 }
// R7：分类汇总表按同一独占发布路径写入（暂存必须落在最终目录的相邻位置，名称超链接才能用相对地址）。
function summaryWrite(app,workbook,stagePath){return host.write(app,workbook,stagePath);}
 // 汇总表生成后打开供填写：优先复用已打开的同路径工作簿，未打开则以可编辑方式打开并恢复宏安全值。
 function openSummary(app,filePath){
  if(!/^(?:[a-z]:[\\/]|\\\\)/i.test(String(filePath||''))||!/^.+\.xlsx$/i.test(String(filePath||'')))
   throw Error('分类汇总表路径无效，未打开。');
  if(!app||typeof app.Workbooks!=='object')throw Error('打开分类汇总表需要连接WPS。');
  var security=app.AutomationSecurity,error=null,book=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未打开分类汇总表。');
  try{
   for(var index=1;index<=app.Workbooks.Count;index++){
    var open=app.Workbooks.Item(index);
    if(open&&key(open.FullName)===key(filePath)){open.Activate();return {path:filePath,opened:true,reused:true};}
   }
   app.AutomationSecurity=3;
   if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未打开分类汇总表。');
   book=app.Workbooks.Open(filePath,0,false);
   if(!book||key(book.FullName)!==key(filePath))throw Error('WPS未返回指定分类汇总表。');
   book.Activate();
  }catch(problem){error=problem;}
  finally{
   try{app.AutomationSecurity=security;}catch(problem){error=Error('宏安全设置恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return {path:filePath,opened:true,reused:false};
 }
 return {read:read,write:write,selectTarget:host.selectTarget,valuesOf:valuesOf,
  readSummary:readSummary,summaryWrite:summaryWrite,openSummary:openSummary};
}));
