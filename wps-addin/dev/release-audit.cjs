const SCHEMA_VERSION=1;
const INTERNAL_SHEETS=['内部追溯','处理记录','来源明细','清单'];
const FORBIDDEN=['原价','历史报价','原清单文件','原路径','SHA256','核对追溯JSON','自动结果','历史分类定位'];
function text(value){return value==null?'':String(value);}
function cellValues(sheet){
 const values=(sheet&&sheet.values)||[];
 const out=[];
 values.forEach(function(row,rowIndex){
  (row||[]).forEach(function(value,columnIndex){
   const valueText=text(value);
   if(valueText)out.push({row:rowIndex+1,column:columnIndex+1,text:valueText});
  });
 });
 return out;
}
// 对外文件只允许白名单内容：没有隐藏表、没有内部表、没有原价/历史报价/内部路径，也没有公式。
function audit(input){
 const source=input||{},workbook=source.workbook||{},sheets=workbook.sheets||[];
 const allowed=(source.allowedSheets||[]).map(text);
 const issues=[],internalSheets=[],hiddenSheets=[],formulaCells=[],forbiddenFields=[];
 sheets.forEach(function(sheet){
  const name=text(sheet&&sheet.name);
  if(sheet&&sheet.hidden===true||sheet&&sheet.visible===false)hiddenSheets.push(name);
  if(INTERNAL_SHEETS.indexOf(name)>=0||text(sheet&&sheet.kind)==='internal')internalSheets.push(name);
  if(allowed.length&&allowed.indexOf(name)<0)issues.push({code:'unexpected-sheet',sheet:name,message:'出现了白名单之外的工作表：'+name});
  cellValues(sheet).forEach(function(cell){
   if(cell.text.charAt(0)==='=')
    formulaCells.push({sheet:name,row:cell.row,column:cell.column,text:cell.text});
   FORBIDDEN.forEach(function(word){
    if(cell.text.indexOf(word)>=0)
     forbiddenFields.push({sheet:name,row:cell.row,column:cell.column,field:word});
   });
  });
 });
 const expected=source.expectedManifest;
 const mismatches=[];
 if(expected&&Array.isArray(expected.cells)){
  expected.cells.forEach(function(entry){
   const sheet=sheets.filter(function(item){return text(item&&item.name)===text(entry.sheet);})[0];
   if(!sheet){mismatches.push({sheet:entry.sheet,row:entry.row,column:entry.column,reason:'文件里没有这张工作表'});return;}
   const row=(sheet.values||[])[Number(entry.row)-1]||[];
   const actual=text(row[Number(entry.column)-1]);
   if(actual!==text(entry.value))
    mismatches.push({sheet:entry.sheet,row:entry.row,column:entry.column,expected:text(entry.value),actual:actual});
  });
 }
 const ok=hiddenSheets.length===0&&internalSheets.length===0&&formulaCells.length===0&&
  forbiddenFields.length===0&&mismatches.length===0&&issues.length===0;
 return {schemaVersion:SCHEMA_VERSION,ok:ok,sheets:sheets.map(function(sheet){return text(sheet&&sheet.name);}),
  hiddenSheets:hiddenSheets,internalSheets:internalSheets,formulaCells:formulaCells,
  forbiddenFields:forbiddenFields,unexpectedSheets:issues,mismatches:mismatches};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,INTERNAL_SHEETS:INTERNAL_SHEETS,FORBIDDEN:FORBIDDEN,audit:audit,cellValues:cellValues};
