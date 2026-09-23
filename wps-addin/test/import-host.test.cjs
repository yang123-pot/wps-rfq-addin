const test=require('node:test'),assert=require('node:assert/strict');
const importer=require('../src/import-host.js');
function metadata(){return {originalPath:'C:\\source\\清单.xlsx',originalName:'清单.xlsx',copyPath:'C:\\copies\\batch\\清单.xlsx',fingerprint:'a'.repeat(64)};}
test('picker requests paths only and supports multi-select, cancellation and malformed results',()=>{
 const app={GetOpenFilename(filter,index,title,button,multi){assert.equal(multi,true);assert.match(filter,/xlsx/);return ['C:\\a.xlsx','C:\\b.xls'];}};
 assert.deepEqual(importer.selectFiles(app),['C:\\a.xlsx','C:\\b.xls']);
 assert.deepEqual(importer.selectFiles({GetOpenFilename:()=>false}),[]);
 assert.deepEqual(importer.selectFiles({GetOpenFilename:()=>'C:\\a.xlsx'}),['C:\\a.xlsx']);
 assert.throws(()=>importer.selectFiles({GetOpenFilename:()=>({Count:2})}),/选择/);
});
function host(failRead=false){
 const m=metadata();let active,closed=0;const previous={FullName:'C:\\user.xlsx',Activate(){active=this;},Close(){assert.fail('user workbook closed');}};active=previous;
 const sheet={Name:'清单',UsedRange:{Row:1,Column:1,Rows:{Count:1},Columns:{Count:1},get Value2(){if(failRead)throw Error('read failed');return 'safe';}}};
 const book={Name:'清单.xlsx',FullName:m.copyPath,Worksheets:{Count:1,Item:()=>sheet},Close(save){assert.equal(save,false);closed++;},Activate(){active=this;}};
 const app={AutomationSecurity:1,get ActiveWorkbook(){return active;},Workbooks:{Count:1,Item:()=>previous,Open(file,links,readOnly){assert.equal(file,m.copyPath);assert.equal(links,0);assert.equal(readOnly,true);assert.equal(app.AutomationSecurity,3);active=book;return book;}}};
 return {app,m,previous,get closed(){return closed;}};
}
test('reads only the prepared copy, restores active workbook and macro setting, and uses original identity',()=>{
 const h=host(),result=importer.readCopy(h.app,h.m);assert.equal(result.path,h.m.originalPath);assert.equal(result.fingerprint,h.m.fingerprint);
 assert.equal(result.sheets[0].values[0][0],'safe');assert.equal(h.closed,1);assert.equal(h.app.ActiveWorkbook,h.previous);assert.equal(h.app.AutomationSecurity,1);
});
test('read failure cleans only owned copy and unsafe metadata cannot open the original',()=>{
 const h=host(true);assert.throws(()=>importer.readCopy(h.app,h.m),/read failed/);assert.equal(h.closed,1);assert.equal(h.app.AutomationSecurity,1);assert.equal(h.app.ActiveWorkbook,h.previous);
 h.m.copyPath=h.m.originalPath;assert.throws(()=>importer.readCopy(h.app,h.m),/副本/);assert.equal(h.closed,1);
});
test('refuses an already open copy rather than closing or trusting user edits',()=>{
 const h=host();h.previous.FullName=h.m.copyPath;
 assert.throws(()=>importer.readCopy(h.app,h.m),/已打开/);assert.equal(h.closed,0);assert.equal(h.app.AutomationSecurity,1);
});
function navigationHost(){
 const h=host();let selected=null;
 const sheet={Activate(){},Cells:{Item(row,column){return {Select(){selected={row,column};}};}}};
 const open=h.app.Workbooks.Open;
 h.app.Workbooks.Open=function(...args){const book=open(...args);book.Worksheets.Item=()=>sheet;book.Saved=true;book.ReadOnly=true;return book;};
 h.source={path:h.m.originalPath,file:h.m.originalName,sheet:'清单',row:3,column:2};
 Object.defineProperty(h,'selected',{get(){return selected;}});return h;
}
test('locates only the matching source in a readonly copy and restores macro settings',()=>{
 const h=navigationHost();importer.locateCopy(h.app,h.m,h.source);
 assert.deepEqual(h.selected,{row:3,column:2});assert.equal(h.app.ActiveWorkbook.FullName,h.m.copyPath);
 assert.equal(h.app.AutomationSecurity,1);assert.equal(h.closed,0);
});
test('invalid source identity or coordinates cannot open or activate a copy',()=>{
 for(const change of [{path:'C:\\other.xlsx'},{file:'other.xlsx'},{row:0},{column:1.5},{sheet:''}]){
  const h=navigationHost();let opened=0;h.app.Workbooks.Open=()=>{opened++;throw Error('unexpected open');};
  assert.throws(()=>importer.locateCopy(h.app,h.m,{...h.source,...change}),/来源/);
  assert.equal(opened,0);assert.equal(h.app.ActiveWorkbook,h.previous);
 }
});
test('navigation failure closes only the newly opened copy and restores the active book',()=>{
 const h=navigationHost(),open=h.app.Workbooks.Open;
 h.app.Workbooks.Open=function(...args){const book=open(...args);book.Worksheets.Item=()=>{throw Error('sheet missing');};return book;};
 assert.throws(()=>importer.locateCopy(h.app,h.m,h.source),/sheet missing/);
 assert.equal(h.closed,1);assert.equal(h.app.ActiveWorkbook,h.previous);assert.equal(h.app.AutomationSecurity,1);
});
test('an edited or writable open copy is left untouched and cannot be used for snapshot navigation',()=>{
 for(const change of [{Saved:false,ReadOnly:true},{Saved:true,ReadOnly:false}]){
  const h=navigationHost();h.previous.FullName=h.m.copyPath;Object.assign(h.previous,change);
  assert.throws(()=>importer.locateCopy(h.app,h.m,h.source),/副本/);assert.equal(h.closed,0);
 }
});
