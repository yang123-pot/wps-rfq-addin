const test=require('node:test'),assert=require('node:assert/strict');
const host=require('../src/project-host.js');
const copy='C:\\copies\\rfq-1.xlsx';
const meta={originalPath:'C:\\samples\\一号.xlsx',originalName:'一号.xlsx',copyPath:copy,fingerprint:'a'.repeat(64)};
const plan={sheet:'给排水',headerRow:2,column:6,header:'分类备注｜匹配度｜核对状态',rows:[{row:3,text:'水阀门｜完全匹配｜已确认'},{row:4,text:'无需询价｜完全匹配｜已确认'}]};
function fixture(options){
 const opened=[],closed=[],saved=[];
 const values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量',''],['001','水管','DN50','m','0.1',''],['002','钢索','-','根','1','']];
 function makeSheet(){
  const store=values.map(row=>row.slice());
  return {Name:'给排水',Cells:{Item(row,column){
   return {NumberFormat:'',get Value2(){return store[row-1][column-1];},
    set Value2(value){if(options&&options.writeFails)throw Error('write failed');store[row-1][column-1]=value;},
    get HasFormula(){return false;}};
  }},sheetValues:store};
 }
 const sheet=makeSheet();
 const previous={FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;},Close(){assert.fail('用户工作簿不得被关闭');}};
 function bookFor(file,readOnly){
  return {FullName:(options&&options.fullName)||file,ReadOnly:!!readOnly,Worksheets:{Item(name){if(name!=='给排水')return null;return sheet;}},Activate(){app.ActiveWorkbook=this;},
   Save(){if(options&&options.saveFails)throw Error('save failed');saved.push(file);},
   Close(save){closed.push({file,save:save===true});}};
 }
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},_active:previous,
  get ActiveWorkbook(){return app._active;},set ActiveWorkbook(value){app._active=value;},
  Workbooks:{Count:1,Item(){return previous;},
   Open(file,links,readOnly){opened.push({file,links,readOnly});if(file!==copy)throw Error('unexpected file '+file);return bookFor(file,readOnly);}}};
 return {app,previous,sheet,opened,closed,saved};
}
test('appends a classification column to the work copy, verifies by reopening and restores the user book',()=>{
 const h=fixture();
 const result=host.appendColumn(h.app,meta,plan);
 assert.deepEqual(result,{sheet:'给排水',column:6,headerRow:2,wrote:2});
 assert.deepEqual(h.opened.map(entry=>entry.readOnly),[false,true],'先可写写入，再只读重开校验');
 assert.deepEqual(h.saved,[copy]);
 assert.equal(h.sheet.sheetValues[1][5],'分类备注｜匹配度｜核对状态');
 assert.equal(h.sheet.sheetValues[2][5],'水阀门｜完全匹配｜已确认');
 assert.equal(h.sheet.sheetValues[3][5],'无需询价｜完全匹配｜已确认');
 assert.deepEqual(h.sheet.sheetValues.slice(0,4).map(row=>row.slice(0,5)),[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水管','DN50','m','0.1'],['002','钢索','-','根','1']],'原内容与行序不得改变');
 assert.equal(h.app.ActiveWorkbook,h.previous);assert.equal(h.app.AutomationSecurity,1);
});
test('work copy path returned as file URL / percent encoding remains the same owned file',()=>{
 const h=fixture({fullName:'file:///C:/copies/rfq-1.xlsx'});
 assert.deepEqual(host.appendColumn(h.app,meta,plan),{sheet:'给排水',column:6,headerRow:2,wrote:2});
 assert.equal(h.closed.length,2,'写入和校验各自打开的副本都必须关闭');
 assert.equal(h.app.ActiveWorkbook,h.previous);
});
test('wrong workbook returned by WPS is closed and reported instead of writing into it',()=>{
 const h=fixture({fullName:'C:\\wrong\\其他工作簿.xlsx'});
 assert.throws(()=>host.appendColumn(h.app,meta,plan),/其他工作簿\.xlsx/);
 assert.deepEqual(h.saved,[],'路径不符时不得保存');
 assert.equal(h.closed.length,1,'错误返回对象也必须关闭');
 assert.equal(h.app.ActiveWorkbook,h.previous);
});
test('refuses the original file, invalid plans and existing different content',()=>{
 const h=fixture();
 assert.throws(()=>host.appendColumn(h.app,{...meta,copyPath:meta.originalPath},plan),/不能写入原件/);
 assert.throws(()=>host.appendColumn(h.app,{...meta,copyPath:'relative.xlsx'},plan),/路径无效/);
 assert.throws(()=>host.appendColumn(h.app,{...meta,fingerprint:'zz'},plan),/指纹无效/);
 assert.throws(()=>host.appendColumn(h.app,meta,{...plan,column:0}),/列号/);
 assert.throws(()=>host.appendColumn(h.app,meta,{...plan,rows:[{row:2,text:'x'}]}),/行内容无效/);
 const occupied=fixture();occupied.sheet.sheetValues[1][5]='用户已有内容';
 assert.throws(()=>host.appendColumn(occupied.app,meta,plan),/已有内容，未覆盖/);
 assert.deepEqual(h.opened,[]);
});
test('an occupied material cell blocks the whole column before any write or save',()=>{
 const h=fixture();
 h.sheet.sheetValues[2][5]='用户原有分类';
 assert.throws(()=>host.appendColumn(h.app,meta,plan),/第3行.*已有内容|已有内容.*第3行/);
 assert.equal(h.sheet.sheetValues[1][5],'','标题不得抢先写入');
 assert.equal(h.sheet.sheetValues[2][5],'用户原有分类','已有分类不得被覆盖');
 assert.equal(h.sheet.sheetValues[3][5],'','其他材料行也不得部分写入');
 assert.deepEqual(h.saved,[]);
 assert.equal(h.app.ActiveWorkbook,h.previous);
 assert.equal(h.app.AutomationSecurity,1);
});
test('write or save failures report no success and keep the user workbook open',()=>{
 for(const [options,pattern] of [[{writeFails:true},/write failed/],[{saveFails:true},/save failed/]]){
  const h=fixture(options);
  assert.throws(()=>host.appendColumn(h.app,meta,plan),pattern);
  assert.equal(h.app.ActiveWorkbook,h.previous);assert.equal(h.app.AutomationSecurity,1);
 }
});
