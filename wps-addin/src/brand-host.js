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
 return {read:read,write:write,selectTarget:host.selectTarget,valuesOf:valuesOf};
}));
