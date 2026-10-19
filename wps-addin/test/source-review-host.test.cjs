const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs'),collection=require('../src/collection.js');
const review=require('../src/classification-review-model.js'),source=require('../src/source-review-model.js');
const host=require('../src/source-review-host.js');

function built(){
 const col=sample.buildCollection(),preview=collection.preview(col,false,false);
 const result=review.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-source'});
 const plan=source.build(col.entries.slice(0,1),result,{title:'来源审核'});
 return plan.files[0];
}
function fixture(file){
 let active=null,closed=0,opened=0,saves=0;
 const cells={},columns={};
 (file.sheets||[]).forEach(sheet=>{
  const origin=(file.originalName==='给排水清单.xlsx'?sample.inputs[0].snapshot.sheets[0].values:sample.inputs[1].snapshot.sheets[0].values);
  origin.forEach((row,r)=>row.forEach((value,c)=>{cells[sheet.name+':'+(r+1)+':'+(c+1)]=value;}));
 });
 function cell(sheet,row,column){
  return {
   get Value2(){return cells[sheet+':'+row+':'+column];},
   set Value2(value){cells[sheet+':'+row+':'+column]=value;},
   Font:{},Interior:{Color:null},WrapText:false
  };
 }
 function columnNumber(name){
  let value=0;for(const char of name)value=value*26+(char.charCodeAt(0)-64);return value;
 }
 function columnLabel(value){let name='';for(;value>0;value=Math.floor((value-1)/26))name=String.fromCharCode(65+(value-1)%26)+name;return name;}
 function range(sheet,address){
  const match=/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(address);if(!match)throw Error('unexpected range '+address);
  const startColumn=columnNumber(match[1]),endColumn=columnNumber(match[3]),startRow=Number(match[2]),endRow=Number(match[4]);
  return {NumberFormat:'',Interior:{Color:null},WrapText:false,
   get Value2(){return Array.from({length:endRow-startRow+1},(_,r)=>Array.from({length:endColumn-startColumn+1},
    (_,c)=>cells[sheet+':'+(startRow+r)+':'+(startColumn+c)]));},
   set Value2(values){values.forEach((row,r)=>row.forEach((value,c)=>{cells[sheet+':'+(startRow+r)+':'+(startColumn+c)]=value;}));}};
 }
 function sheet(name){
  return {Name:name,Range:address=>range(name,address),Cells:{Item:(row,column)=>cell(name,row,column)},Columns:{Item(column){
   const key=name+':'+column;columns[key]||(columns[key]={ColumnWidth:0,Hidden:false});return columns[key];
  }},
   Activate(){}};
 }
 const sourceBook={FullName:file.copyPath,Worksheets:{Item:name=>sheet(name)},
  Save(){saves++;},Close(save){assert.equal(save,false);closed++;},Activate(){active=this;}};
 const stagePath='C:\\成果\\给排水清单_分类审核.xlsx';
 const stageBook={FullName:stagePath,Worksheets:{Item:name=>sheet(name)},Save(){saves++;},Close(){closed++;},Activate(){active=this;}};
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},_active:{FullName:'C:\\用户.xlsx',Activate(){}},
  get ActiveWorkbook(){return active||app._active;},
  Workbooks:{Count:1,Item(index){return index===1?null:null;},
   Open(path,links,readonly){
    opened++;
    if(path===stagePath)return stageBook;
    throw Error('unexpected path '+path);
   }}};
 return {file,app,stagePath,cells,get opened(){return opened;},get closed(){return closed;},get saves(){return saves;}};
}
test('在服务端复制的审核副本上只追加列，保留原表单元格并隐藏行标识',()=>{
 const h=fixture(built()),result=host.write(h.app,h.file,h.stagePath,{prepared:true});
 assert.equal(result.rows,5);
 assert.equal(h.saves,1);
 assert.equal(h.cells['给排水:2:6'],'建议分类');
 assert.equal(h.cells['给排水:2:7'],'最终分类');
 assert.equal(h.cells['给排水:2:8'],'审核备注');
 assert.equal(h.cells['给排水:2:9'],'行标识');
 assert.equal(h.cells['给排水:3:2'],'水泵','原表内容保持不变');
 assert.equal(h.cells['给排水:3:6'],'水泵');
 assert.equal(h.cells['给排水:3:7'],'水泵');
 assert.equal(h.cells['给排水:3:9'],h.file.sheets[0].rows[0].rowId);
});
test('生成绑定并读回两份来源的审核行，保留文件与工作表位置',()=>{
 const h=fixture(built());
 host.write(h.app,h.file,h.stagePath,{prepared:true});
 const planSeed=built();
 const receipt={target:h.stagePath,sha256:'a'.repeat(64),bytes:100};
 const binding=host.bindingFor([receipt],{schemaVersion:1,mode:'source-tables',files:[planSeed],fields:planSeed.sheets[0].rows.map(row=>({
  rowId:row.rowId,index:row.index,name:row.name,feature:row.feature,unit:row.unit,quantity:row.quantity,
  trace:row.trace,autoCategoryName:row.autoCategoryName,autoCategoryId:row.autoCategoryId,fileIndex:1,
  sheet:planSeed.sheets[0].name,row:row.row,originLastColumn:5,reviewColumn:6,finalColumn:7,noteColumn:8,rowIdColumn:9
 })),rowIds:planSeed.sheets[0].rows.map(row=>row.rowId),rowCount:5,sourceCount:1,libraryVersion:'fixture',
 categories:review.build(collection.preview(sample.buildCollection(),false,false).groups,
  {library:sample.library,memory:sample.createMemory(),projectId:'p'}).categories},{inputKey:'ck2-source'});
 const read=host.readBack(h.app,binding);
 assert.equal(read.rows.length,5);
 assert.deepEqual(read.issues,[]);
 assert.equal(read.rows[0].path,h.stagePath);
 assert.equal(read.rows[0].sheet,'给排水');
 assert.equal(read.rows[0].finalCategoryName,'水泵');
 assert.equal(read.rows[0].finalCategoryId,'pump');
});
test('原表材料被改动、行标识缺失时按原表和列定位',()=>{
 const file=built(),h=fixture(file);
 host.write(h.app,file,h.stagePath,{prepared:true});
 const receipt={target:h.stagePath,sha256:'b'.repeat(64)},plan={schemaVersion:1,mode:'source-tables',files:[file],
  fields:file.sheets[0].rows.map(row=>({rowId:row.rowId,index:row.index,name:row.name,feature:row.feature,unit:row.unit,
   quantity:row.quantity,trace:row.trace,autoCategoryName:row.autoCategoryName,autoCategoryId:row.autoCategoryId,
   fileIndex:1,sheet:file.sheets[0].name,row:row.row,originLastColumn:5,reviewColumn:6,finalColumn:7,noteColumn:8,rowIdColumn:9})),
  rowIds:file.sheets[0].rows.map(row=>row.rowId),rowCount:5,sourceCount:1,libraryVersion:'fixture',
  categories:[{id:'pump',name:'水泵'},{id:'no-inquiry',name:'无需询价'}]};
 const binding=host.bindingFor([receipt],plan,{});
 h.cells['给排水:3:2']='水泵被改';
 h.cells['给排水:4:9']='';
 const read=host.readBack(h.app,binding);
 const changed=read.issues.find(item=>item.code==='field-changed');
 const missing=read.issues.find(item=>item.code==='row-id-missing');
 assert.deepEqual([changed.path,changed.sheet,changed.row,changed.column],
  [h.stagePath,'给排水',3,2]);
 assert.deepEqual([missing.sheet,missing.row,missing.column],[ '给排水',4,9]);
});
test('原表审核的空分类问题使用该工作表的最终分类列并带文件/工作表位置',()=>{
 const file=built(),h=fixture(file);
 host.write(h.app,file,h.stagePath,{prepared:true});
 const binding=host.bindingFor([{target:h.stagePath,sha256:'c'.repeat(64)}],{schemaVersion:1,mode:'source-tables',files:[file],
  fields:file.sheets[0].rows.map(row=>({rowId:row.rowId,index:row.index,name:row.name,feature:row.feature,unit:row.unit,
   quantity:row.quantity,trace:row.trace,autoCategoryName:row.autoCategoryName,autoCategoryId:row.autoCategoryId,
   fileIndex:1,sheet:file.sheets[0].name,row:row.row,originLastColumn:5,reviewColumn:6,finalColumn:7,noteColumn:8,rowIdColumn:9})),
  rowIds:file.sheets[0].rows.map(row=>row.rowId),rowCount:5,sourceCount:1,libraryVersion:'fixture',
  categories:[{id:'pump',name:'水泵'}]},{});
 const read=host.readBack(h.app,binding);read.rows[0].finalCategoryName='';read.rows[0].finalCategoryId='';
 const checked=review.validateRead(read,{categories:binding.categories});
 assert.equal(checked.errors[0].code,'category-empty');
 assert.deepEqual([checked.errors[0].path,checked.errors[0].sheet,checked.errors[0].row,checked.errors[0].column],
  [h.stagePath,'给排水',3,7]);
});
