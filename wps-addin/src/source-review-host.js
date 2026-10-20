(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./workbook-layout.js'));
 else root.RfqSourceReviewHost=factory(root.RfqWorkbookLayout);
}(typeof window==='object'?window:globalThis,function(layout){
 'use strict';
 var SCHEMA_VERSION=1,LAYOUT_VERSION=2;
 function text(value){return value==null?'':String(value);}
 function key(path){return text(path).replace(/[\\/]+/g,'/').toLowerCase();}
 function absolute(path){return typeof path==='string'&&/^(?:[a-z]:[\\/]|\\\\)/i.test(path);}
 function columnName(index){var name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
 function findOpen(app,path){
  for(var index=1;index<=app.Workbooks.Count;index++){
   var book=app.Workbooks.Item(index);
   if(book&&key(book.FullName)===key(path))return book;
  }
  return null;
 }
 function validateFilePlan(file){
  if(!file||file.schemaVersion!==SCHEMA_VERSION)throw Error('来源审核副本计划无效。');
  if(!absolute(file.copyPath))throw Error('来源工作副本路径无效：'+text(file.originalName));
  if(!Array.isArray(file.sheets)||!file.sheets.length)throw Error('来源审核副本没有可追加列的工作表。');
  file.sheets.forEach(function(sheet){
   if(typeof sheet.name!=='string'||!sheet.name||!Array.isArray(sheet.rows)||!sheet.rows.length)
    throw Error('来源审核工作表计划无效。');
   [sheet.headerRow,sheet.originLastColumn,sheet.reviewColumn,sheet.finalColumn,sheet.noteColumn,sheet.rowIdColumn]
    .forEach(function(value){if(!Number.isSafeInteger(value)||value<1)throw Error('来源审核列位置无效。');});
  });
  return file;
 }
 function validateBinding(binding){
  if(!binding||binding.mode!=='source-tables'||binding.schemaVersion!==SCHEMA_VERSION)
   throw Error('来源审核副本绑定无效，请重新生成。');
  if(!Array.isArray(binding.files)||!binding.files.length)throw Error('来源审核副本缺少文件绑定。');
  if(!Array.isArray(binding.fields)||!binding.fields.length)throw Error('来源审核副本缺少材料快照。');
  binding.files.forEach(function(file){
   if(!absolute(file.path)||!/^[a-f\d]{64}$/i.test(text(file.sha256)))
    throw Error('来源审核副本路径或SHA无效：'+text(file.originalName));
   validateFilePlan(file);
  });
  return binding;
 }
 function bindingFor(receipts,plan,options){
  var input=options||{};
  if(!plan||plan.mode!=='source-tables')throw Error('来源审核副本计划无效。');
  if(!Array.isArray(receipts)||receipts.length!==plan.files.length)throw Error('来源审核副本保存回执不完整。');
  var files=plan.files.map(function(file,index){
   var receipt=receipts[index];
   if(!receipt||!absolute(receipt.target)||!/^[a-f\d]{64}$/i.test(text(receipt.sha256)))
    throw Error('来源审核副本保存回执无效：'+file.originalName);
   return Object.assign({},file,{path:receipt.target,sha256:text(receipt.sha256).toLowerCase(),bytes:Number(receipt.bytes)||0,
    sheet:file.sheets[0].name,firstRow:file.sheets[0].headerRow,lastRow:file.sheets[0].rows[file.sheets[0].rows.length-1].row});
  });
  var boundFields=plan.fields.map(function(field){
   return Object.assign({},field,{path:files[field.fileIndex-1].path,file:files[field.fileIndex-1].originalName});
  });
  return {schemaVersion:SCHEMA_VERSION,layoutVersion:LAYOUT_VERSION,mode:'source-tables',
   path:files[0].path,sha256:files[0].sha256,sheet:'多份原表',
   headerRow:files[0].headerRow,firstRow:files[0].firstRow,lastRow:files[0].lastRow,rowIdColumn:files[0].sheets[0].rowIdColumn,
   libraryVersion:text(plan.libraryVersion),categories:plan.categories.map(function(category){
    return {id:text(category.id),name:text(category.name)};}),
   files:files,fields:boundFields,
   rowIds:plan.rowIds.slice(),rowCount:plan.rowCount,sourceCount:plan.sourceCount,
   inputKey:input.inputKey?text(input.inputKey):null,title:input.title?text(input.title):plan.title,
   generatedAt:input.generatedAt?text(input.generatedAt):null};
 }
 function putCell(sheet,row,column,value){
  var cell=sheet.Cells.Item(row,column);
  cell.Value2=value;
  return cell;
 }
 function matrix(value,rows,columns){
  var out=Array.from({length:rows},function(){return Array(columns).fill('');});
  if(!Array.isArray(value)){out[0][0]=value==null?'':value;return out;}
  if(!Array.isArray(value[0]))value=value.map(function(item){return [item];});
  value.forEach(function(row,r){if(r<rows&&Array.isArray(row))row.forEach(function(item,c){if(c<columns)out[r][c]=item;});});
  return out;
 }
 function readBlock(sheet,startRow,endRow,startColumn,endColumn){
  var height=endRow-startRow+1,width=endColumn-startColumn+1;
  if(sheet.Range&&typeof sheet.Range==='function'){
   var range=sheet.Range(columnName(startColumn)+startRow+':'+columnName(endColumn)+endRow);
   return matrix(range.Value2,height,width);
  }
  return Array.from({length:height},function(_,r){
   return Array.from({length:width},function(_,c){return text(sheet.Cells.Item(startRow+r,startColumn+c).Value2);});
  });
 }
 function writeColumn(sheet,startRow,endRow,column,values){
  if(sheet.Range&&typeof sheet.Range==='function'){
   var range=sheet.Range(columnName(column)+startRow+':'+columnName(column)+endRow);
   range.NumberFormat='@';range.Value2=values.map(function(value){return [value];});
   return range;
  }
  values.forEach(function(value,index){putCell(sheet,startRow+index,column,value);});
  return null;
 }
 function markHeader(cell){
  if(cell.Font)cell.Font.Bold=true;
  if(cell.Interior)cell.Interior.Color=layout.toColor(layout.COLORS.header);
  if('WrapText' in cell)cell.WrapText=true;
 }
 function markInput(cell){
  if(cell.Interior)cell.Interior.Color=layout.toColor(layout.COLORS.input);
  if('WrapText' in cell)cell.WrapText=true;
 }
 function markWarning(cell){
  if(cell.Interior)cell.Interior.Color=layout.toColor(layout.COLORS.warning);
  if('WrapText' in cell)cell.WrapText=true;
 }
 function applyReviewColumns(book,file){
  file.sheets.forEach(function(spec){
   var sheet=book.Worksheets.Item(spec.name);
   if(!sheet)throw Error('审核副本缺少工作表：'+spec.name);
   if(typeof sheet.Columns!=='object')throw Error('当前WPS不支持列属性API，未追加审核列。');
   ['建议分类','最终分类','审核备注','行标识'].forEach(function(label,index){
    markHeader(putCell(sheet,spec.headerRow,spec.reviewColumn+index,label));
   });
   var firstRow=Math.min.apply(null,spec.rows.map(function(record){return record.row;})),
     lastRow=Math.max.apply(null,spec.rows.map(function(record){return record.row;})),
     byRow={};spec.rows.forEach(function(record){byRow[record.row]=record;});
   function valuesFor(selector){return Array.from({length:lastRow-firstRow+1},function(_,index){
    var record=byRow[firstRow+index];return record?text(selector(record)):'';});}
   writeColumn(sheet,firstRow,lastRow,spec.reviewColumn,valuesFor(function(record){return record.autoCategoryName;}));
   var finalRange=writeColumn(sheet,firstRow,lastRow,spec.finalColumn,
     valuesFor(function(record){return record.finalCategoryName||'';}));
   writeColumn(sheet,firstRow,lastRow,spec.noteColumn,valuesFor(function(record){return record.reviewNote||'';}));
   writeColumn(sheet,firstRow,lastRow,spec.rowIdColumn,valuesFor(function(record){return record.rowId;}));
   if(finalRange){markInput({Interior:finalRange.Interior,WrapText:finalRange.WrapText});}
   else spec.rows.forEach(function(record){markInput(sheet.Cells.Item(record.row,spec.finalColumn));});
   spec.rows.forEach(function(record){
    if(record.abnormal)markWarning(sheet.Cells.Item(record.row,spec.finalColumn));
   });
   sheet.Columns.Item(spec.reviewColumn).ColumnWidth=16;
   sheet.Columns.Item(spec.finalColumn).ColumnWidth=18;
   sheet.Columns.Item(spec.noteColumn).ColumnWidth=24;
   sheet.Columns.Item(spec.rowIdColumn).ColumnWidth=26;
   sheet.Columns.Item(spec.rowIdColumn).Hidden=true;
   if(sheet.Columns.Item(spec.rowIdColumn).Hidden!==true)
    throw Error('“'+spec.name+'”的行标识列未隐藏，未保存审核副本。');
  });
 }
 function verifyFile(book,file){
  file.sheets.forEach(function(spec){
   var sheet=book.Worksheets.Item(spec.name);
   if(!sheet)throw Error('审核副本缺少工作表：'+spec.name);
   if(sheet.Columns.Item(spec.rowIdColumn).Hidden!==true)
    throw Error('“'+spec.name+'”的行标识列保存后未保持隐藏，未确认审核副本。');
   var firstRow=Math.min.apply(null,spec.rows.map(function(record){return record.row;})),
     lastRow=Math.max.apply(null,spec.rows.map(function(record){return record.row;})),
     ids=readBlock(sheet,firstRow,lastRow,spec.rowIdColumn,spec.rowIdColumn),
     finals=readBlock(sheet,firstRow,lastRow,spec.finalColumn,spec.finalColumn);
   spec.rows.forEach(function(record){
    if(text(ids[record.row-firstRow][0])!==record.rowId)
     throw Error('“'+spec.name+'”第'+record.row+'行的隐藏行标识读回不一致。');
    if(text(finals[record.row-firstRow][0])!==text(record.finalCategoryName))
     throw Error('“'+spec.name+'”第'+record.row+'行的最终分类读回不一致。');
   });
  });
 }
 function write(app,file,stagePath,options){
  validateFilePlan(file);
  if(!app||typeof app.Workbooks!=='object')throw Error('追加审核列需要连接WPS。');
  if(!absolute(stagePath)||!/^.+\.xlsx$/i.test(stagePath))throw Error('审核副本暂存路径无效。');
  if(findOpen(app,stagePath))throw Error('审核副本暂存文件已打开，未写入。');
  if(!(options&&options.prepared===true)&&app.FileSystem&&typeof app.FileSystem.Exists==='function'&&app.FileSystem.Exists(stagePath))
   throw Error('审核副本暂存文件已存在，未覆盖。');
  var previous=app.ActiveWorkbook,security=app.AutomationSecurity,source=null,opened=null,error=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未生成审核副本。');
  try{
   app.AutomationSecurity=3;
   if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未生成审核副本。');
   if(options&&options.prepared===true){
    opened=app.Workbooks.Open(stagePath,0,false);
   }else{
    source=app.Workbooks.Open(file.copyPath,0,false);
    if(!source)throw Error('WPS未返回来源工作副本：'+file.originalName);
    source.SaveAs(stagePath,51);
    opened=key(source.FullName)===key(stagePath)?source:findOpen(app,stagePath);
    if(opened===source)source=null;
   }
   if(!opened||key(opened.FullName)!==key(stagePath))throw Error('WPS未返回指定审核副本。');
   applyReviewColumns(opened,file);
   opened.Save();
   opened.Close(false);opened=null;
   if(source){try{source.Close(false);}catch(_){}source=null;}
   opened=app.Workbooks.Open(stagePath,0,true);
   if(!opened||key(opened.FullName)!==key(stagePath))throw Error('WPS未返回指定审核副本供核对。');
   verifyFile(opened,file);
  }catch(problem){error=problem;}
  finally{
   try{if(opened)opened.Close(false);}catch(problem){error=error||Error('审核副本核对簿关闭失败：'+problem.message);}
   try{if(source)source.Close(false);}catch(problem){error=error||Error('来源工作副本关闭失败：'+problem.message);}
   try{app.AutomationSecurity=security;}catch(problem){error=error||Error('宏安全设置恢复失败：'+problem.message);}
   try{if(previous)previous.Activate();}catch(problem){error=error||Error('原工作簿恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return {path:stagePath,file:file.originalName,rows:file.rowCount};
 }
 function categoryIdOf(binding,name){
  var found=((binding&&binding.categories)||[]).filter(function(category){return category.name===name;})[0];
  return found?text(found.id):'';
 }
 function compareOrigin(sheet,record,firstRow,lastRow,values){
  for(var rowIndex=0;rowIndex<record.originRows.length;rowIndex++){
   var origin=record.originRows[rowIndex],actual=[];
   for(var column=1;column<=origin.values.length;column++)
    actual.push(text(values[origin.row-firstRow][column-1]));
   for(var index=0;index<origin.values.length;index++){
    if(actual[index]!==origin.values[index])
     return {row:origin.row,column:index+1,original:origin.values[index],actual:actual[index]};
   }
  }
  return null;
 }
 function readFile(app,file,binding){
  validateFilePlan(file);
  var book=findOpen(app,file.path),owned=false,rows=[],issues=[],seen={};
  if(!book){
   book=app.Workbooks.Open(file.path,0,true);owned=true;
   if(!book||key(book.FullName)!==key(file.path))throw Error('WPS未返回指定审核副本：'+file.originalName);
  }
  try{
   file.sheets.forEach(function(spec){
    var sheet=book.Worksheets.Item(spec.name);
    if(!sheet)throw Error('审核副本缺少工作表：'+file.originalName+' / '+spec.name);
    var firstRow=Math.min.apply(null,spec.rows.map(function(record){return record.row;})),
      lastRow=Math.max.apply(null,spec.rows.map(function(record){return record.row;})),
      originWidth=Math.max.apply(null,spec.rows.map(function(record){
       return Math.max.apply(null,record.originRows.map(function(origin){return origin.values.length;}));
      })),
      originBlock=readBlock(sheet,firstRow,lastRow,1,originWidth),
      ids=readBlock(sheet,firstRow,lastRow,spec.rowIdColumn,spec.rowIdColumn),
      autos=readBlock(sheet,firstRow,lastRow,spec.reviewColumn,spec.reviewColumn),
      finals=readBlock(sheet,firstRow,lastRow,spec.finalColumn,spec.finalColumn),
      notes=readBlock(sheet,firstRow,lastRow,spec.noteColumn,spec.noteColumn);
    spec.rows.forEach(function(record){
     var offset=record.row-firstRow,actualId=text(ids[offset][0]);
     if(!actualId){
      issues.push({path:file.path,file:file.originalName,sheet:spec.name,row:record.row,column:spec.rowIdColumn,
       code:'row-id-missing',message:spec.name+'第'+record.row+'行缺少隐藏行标识，可能被删行或破坏。'});
      return;
     }
     if(actualId!==record.rowId){
      issues.push({path:file.path,file:file.originalName,sheet:spec.name,row:record.row,column:spec.rowIdColumn,
       code:'row-id-unknown',message:spec.name+'第'+record.row+'行的隐藏行标识不属于当前来源快照。'});
      return;
     }
     if(seen[actualId]){
      issues.push({path:file.path,file:file.originalName,sheet:spec.name,row:record.row,column:spec.rowIdColumn,
       code:'row-id-duplicate',message:spec.name+'第'+record.row+'行与第'+seen[actualId]+'行使用了同一行标识。'});
      return;
     }
     seen[actualId]=record.row;
     var changed=compareOrigin(sheet,record,firstRow,lastRow,originBlock);
     if(changed)issues.push({path:file.path,file:file.originalName,sheet:spec.name,row:changed.row,column:changed.column,
      code:'field-changed',message:spec.name+'第'+changed.row+'行第'+changed.column+'列原表内容已改：原“'+
       changed.original+'”现“'+changed.actual+'”。请撤销此处改动后重新审核。'});
     var autoName=text(autos[offset][0]).trim(),finalName=text(finals[offset][0]).trim(),
       note=text(notes[offset][0]);
     rows.push({rowId:record.rowId,row:record.row,index:record.index,name:record.name,feature:record.feature,
      unit:record.unit,quantity:record.quantity,trace:record.trace,autoCategoryName:autoName||record.autoCategoryName,
      autoCategoryId:record.autoCategoryId,finalCategoryName:finalName,finalCategoryId:categoryIdOf(binding, finalName),
      reviewNote:note,path:file.path,file:file.originalName,sheet:spec.name,finalColumn:spec.finalColumn});
    });
   });
  }finally{
   if(owned)try{book.Close(false);}catch(_){}
  }
  return {rows:rows,issues:issues};
 }
 function readBack(app,binding){
  validateBinding(binding);
  var previous=app.ActiveWorkbook,security=app.AutomationSecurity,allRows=[],allIssues=[],error=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未读取来源审核副本。');
  try{
   app.AutomationSecurity=3;
   binding.files.forEach(function(file){
    var read=readFile(app,file,binding);
    allRows=allRows.concat(read.rows);allIssues=allIssues.concat(read.issues);
   });
   binding.fields.forEach(function(field){
    if(!allRows.some(function(row){return row.rowId===field.rowId;}))
     allIssues.push({path:field.path||null,file:field.fileName,sheet:field.sheet,row:field.row,column:1,code:'row-missing',
      message:'来源审核副本缺少材料行：'+field.name+' / '+field.feature});
   });
  }catch(problem){error=problem;}
  finally{
   try{app.AutomationSecurity=security;}catch(problem){error=error||Error('宏安全设置恢复失败：'+problem.message);}
   try{if(previous)previous.Activate();}catch(problem){error=error||Error('原工作簿恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return {rows:allRows,issues:allIssues,source:'source-tables'};
 }
 function openForEditing(app,binding){
  validateBinding(binding);
  var security=app.AutomationSecurity,error=null,opened=[];
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未打开审核副本。');
  try{
   app.AutomationSecurity=3;
   binding.files.forEach(function(file){
    var book=findOpen(app,file.path);
    if(!book){
     book=app.Workbooks.Open(file.path,0,false);
     if(!book||key(book.FullName)!==key(file.path))throw Error('WPS未返回指定审核副本：'+file.originalName);
    }
    var firstSheet=file.sheets[0],sheet=book.Worksheets.Item(firstSheet.name);
    if(!sheet)throw Error('审核副本缺少工作表：'+file.originalName+' / '+firstSheet.name);
    book.Activate();sheet.Activate();
    opened.push(book);
   });
   if(opened.length){opened[0].Activate();var targetSheet=opened[0].Worksheets.Item(binding.files[0].sheets[0].name);
    targetSheet.Activate();var first=binding.files[0].sheets[0].rows[0];
    if(first)targetSheet.Cells.Item(first.row,binding.files[0].sheets[0].finalColumn).Select();}
  }catch(problem){error=problem;}
  finally{
   try{app.AutomationSecurity=security;}catch(problem){error=error||Error('宏安全设置恢复失败：'+problem.message);}
  }
  if(error)throw error;
  return {opened:true,count:opened.length,files:binding.files.map(function(file){return file.path;})};
}
 function locate(app,binding,target){
  validateBinding(binding);
  var file=null;
  if(target&&target.path)file=binding.files.filter(function(item){return key(item.path)===key(target.path);})[0]||null;
  if(!file&&target&&target.fileIndex)file=binding.files[target.fileIndex-1]||null;
  if(!file)file=binding.files[0];
  var sheetName=target&&target.sheet?target.sheet:(file.sheets[0]&&file.sheets[0].name);
  if(!target||!Number.isSafeInteger(target.row)||target.row<1)throw Error('定位需要有效的原表行号。');
  var security=app.AutomationSecurity,book=null,error=null;
  if(typeof security!=='number')throw Error('不能读取宏安全设置，未定位审核列。');
  try{
   app.AutomationSecurity=3;
   book=findOpen(app,file.path);
   if(!book){book=app.Workbooks.Open(file.path,0,false);if(!book||key(book.FullName)!==key(file.path))
    throw Error('WPS未返回指定审核副本：'+file.originalName);}
   var sheet=book.Worksheets.Item(sheetName);if(!sheet)throw Error('审核副本缺少工作表：'+sheetName);
   book.Activate();sheet.Activate();
   var column=Number.isSafeInteger(target.column)&&target.column>0?target.column:file.sheets[0].finalColumn;
   sheet.Cells.Item(target.row,column).Select();
  }catch(problem){error=problem;}
  finally{try{app.AutomationSecurity=security;}catch(problem){error=error||Error('宏安全设置恢复失败：'+problem.message);}}
  if(error)throw error;
  return {path:file.path,sheet:sheetName,row:target.row,column:target.column};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,LAYOUT_VERSION:LAYOUT_VERSION,bindingFor:bindingFor,write:write,readBack:readBack,
  openForEditing:openForEditing,locate:locate,validateBinding:validateBinding};
}));
