(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqBrandReference=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var MAX_CELLS=200000;
 function text(value){return value==null?'':String(value).trim();}
 function cell(row,index){
  var value=Array.isArray(row)?row[index-1]:null;
  return text(value);
 }
 function sheetOf(snapshot,name){
  return ((snapshot&&snapshot.sheets)||[]).filter(function(sheet){return sheet.name===name;})[0]||null;
 }
 // mapping必须明确给出：sheet/headerRow/categoryColumn/brandColumn；noteColumn可空。缺表头或列数不足都不猜。
 function validateMapping(snapshot,mapping){
  var errors=[];
  if(!snapshot||!Array.isArray(snapshot.sheets)||!snapshot.sheets.length)errors.push('品牌参考表没有可读工作表。');
  if(!mapping||typeof mapping!=='object')return {ok:false,errors:errors.concat(['缺少列映射。'])};
  var sheet=sheetOf(snapshot,mapping.sheet);
  if(!sheet)errors.push('找不到工作表：'+text(mapping.sheet));
  ['headerRow','categoryColumn','brandColumn'].forEach(function(key){
   if(!Number.isSafeInteger(mapping[key])||mapping[key]<1)errors.push('列映射缺少'+key+'。');
  });
  if(mapping.noteColumn!=null&&(!Number.isSafeInteger(mapping.noteColumn)||mapping.noteColumn<1))
   errors.push('备注列号无效。');
  if(sheet&&Number.isSafeInteger(mapping.headerRow)&&mapping.headerRow>sheet.values.length)
   errors.push('表头行超过工作表行数。');
  return {ok:errors.length===0,errors:errors};
 }
 function headerOf(snapshot,mapping){
  var sheet=sheetOf(snapshot,mapping.sheet);
  if(!sheet)return [];
  var row=sheet.values[mapping.headerRow-1]||[],out=[];
  for(var index=1;index<=row.length;index++)out.push({column:index,label:cell(row,index)});
  return out;
 }
 // 只读查看：参考表只用来查证品牌写法，绝不改动分类结果或已填品牌。
 function parse(snapshot,mapping){
  var check=validateMapping(snapshot,mapping);
  if(!check.ok)throw Error('品牌参考表列映射无效：'+check.errors.join('；'));
  var sheet=sheetOf(snapshot,mapping.sheet),rows=[],issues=[],seen={};
  var header=headerOf(snapshot,mapping);
  var categoryHeader=cell(sheet.values[mapping.headerRow-1],mapping.categoryColumn);
  var brandHeader=cell(sheet.values[mapping.headerRow-1],mapping.brandColumn);
  if(!categoryHeader)issues.push({sheetRow:mapping.headerRow,code:'header-empty',message:'类别列表头为空，请确认列映射。'});
  if(!brandHeader)issues.push({sheetRow:mapping.headerRow,code:'header-empty',message:'品牌列表头为空，请确认列映射。'});
  for(var index=mapping.headerRow;index<sheet.values.length;index++){
   var line=sheet.values[index],sheetRow=index+1;
   var category=cell(line,mapping.categoryColumn),brand=cell(line,mapping.brandColumn);
   var note=mapping.noteColumn==null?'':cell(line,mapping.noteColumn);
   if(!category&&!brand&&!note)continue;
   if(!category){issues.push({sheetRow:sheetRow,code:'category-missing',message:'第'+sheetRow+'行缺少类别名称，未纳入参考列表。'});continue;}
   var key=category+'\u0000'+brand;
   if(seen[key])issues.push({sheetRow:sheetRow,code:'duplicate',
    message:'第'+seen[key]+'行与第'+sheetRow+'行重复：'+category+'／'+(brand||'（空品牌）')});
   else seen[key]=sheetRow;
   rows.push({sheetRow:sheetRow,category:category,brand:brand,note:note,
    brands:brand?brand.split(/[、,，;；\/]+/).map(text).filter(Boolean):[]});
  }
  if(!rows.length)issues.push({sheetRow:mapping.headerRow,code:'empty-table',message:'表头之下没有可读的类别行。'});
  if(mapping.headerRow<1)issues.push({sheetRow:1,code:'header-row',message:'表头行号无效。'});
  return {schemaVersion:1,path:text(snapshot.path),name:text(snapshot.name),sheet:mapping.sheet,
   headerRow:mapping.headerRow,header:header,rows:rows,issues:issues,cells:rows.length};
 }
 function search(parsed,keyword){
  var needle=text(keyword).toLowerCase();
  if(!needle)return (parsed&&parsed.rows)||[];
  return ((parsed&&parsed.rows)||[]).filter(function(row){
   return [row.category,row.brand,row.note].join(' ').toLowerCase().indexOf(needle)>=0;});
 }
 function sheetNames(snapshot){return ((snapshot&&snapshot.sheets)||[]).map(function(sheet){return sheet.name;});}
 // 只读打开参考表，读完即关；不复制、不写入，原件SHA不变。
 function read(app,path){
  if(!app||typeof app.Workbooks!=='object')throw Error('读取品牌参考表需要连接WPS。');
  if(typeof path!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(path))throw Error('品牌参考表路径无效。');
  function key(value){return String(value||'').replace(/[\\/]+/g,'/').toLowerCase();}
  var opened=null,book=null,count=Number(app.Workbooks.Count)||0;
  for(var index=1;index<=count;index++){
   var candidate=app.Workbooks.Item(index);
   if(candidate&&key(candidate.FullName)===key(path)){book=candidate;break;}
  }
  try{
   if(!book){book=app.Workbooks.Open(path,0,true);opened=book;}
   if(!book||key(book.FullName)!==key(path))throw Error('WPS未返回指定品牌参考表。');
   var sheets=[],total=0,sheetCount=Number(book.Worksheets.Count)||0;
   for(var position=1;position<=sheetCount;position++){
    var sheet=book.Worksheets.Item(position),values=sheet.UsedRange.Value2;
    if(!Array.isArray(values))values=[[values]];
    else if(values.length&&!Array.isArray(values[0]))values=values.map(function(value){return [value];});
    total+=values.length*(values[0]?values[0].length:0);
    if(total>MAX_CELLS)throw Error('品牌参考表过大（超过'+MAX_CELLS+'个单元格），请先用筛选后的副本。');
    sheets.push({name:sheet.Name,values:values});
   }
   return {name:String(path).replace(/^.*[\\/]/,''),path:path,sheets:sheets};
  } finally {
   if(opened)try{opened.Close(false);}catch(_){}
  }
 }
 return {parse:parse,validateMapping:validateMapping,headerOf:headerOf,search:search,sheetNames:sheetNames,read:read,
  MAX_CELLS:MAX_CELLS};
}));
