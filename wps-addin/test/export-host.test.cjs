const test=require('node:test'),assert=require('node:assert/strict'),host=require('../src/export-host.js');
const stage='C:\\temp\\rfq-stage.xlsx';
const model={sheets:[{name:'清单',values:[['编码','量'],['000123','12345678901234567890.1'],['=1+1','0.3']]},{name:'来源明细',values:[['来源','数量'],['原件.xlsx','0.3']]}]};
function fixture(failure){
 let active,closed=0,added=0,opened=0,saved=false;const previous={FullName:'C:\\user.xlsx',Activate(){active=this;},Close(){assert.fail('user book closed');}};active=previous;
 function sheet(){const ranges=new Map();return {Name:'Sheet',Range(address){if(!ranges.has(address))ranges.set(address,{Font:{},Rows:{autoFitCount:0,AutoFit(){this.autoFitCount++;}},get Value2(){return this.value;},set Value2(v){if(failure==='write')throw Error('write failed');assert.equal(this.NumberFormat,'@');this.value=v.map(r=>r.slice());},HasFormula:false});return ranges.get(address);}};}
 const sheets=[sheet()];const book={FullName:'Book1',Worksheets:{get Count(){return sheets.length;},Item(i){return typeof i==='number'?sheets[i-1]:sheets.find(s=>s.Name===i);},Add(){const s=sheet();sheets.push(s);return s;}},SaveAs(file,format){assert.equal(file,stage);assert.equal(format,51);if(failure==='save')throw Error('save failed');this.FullName=file;saved=true;},Close(save){assert.equal(save,false);closed++;},Activate(){active=this;}};
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},get ActiveWorkbook(){return active;},Workbooks:{Count:1,Item(){return previous;},Add(){added++;active=book;return book;},Open(file,links,readonly){opened++;assert.ok(saved);assert.equal(file,stage);assert.equal(links,0);assert.equal(readonly,true);assert.equal(app.AutomationSecurity,3);if(failure==='reopen')throw Error('reopen failed');if(failure==='corrupt')sheets[0].Range('A1:B3').value[1][0]='123';if(failure==='formula')sheets[0].Range('A1:B3').HasFormula=true;active=book;return book;}}};
 return {app,previous,sheets,get closed(){return closed;},get added(){return added;},get opened(){return opened;}};
}
test('save picker returns a path without saving and cancellation is a no-op',()=>{
 assert.equal(host.selectTarget({GetSaveAsFilename:()=>false},'清单.xlsx'),null);
 assert.equal(host.selectTarget({GetSaveAsFilename(name,filter){assert.equal(name,'清单.xlsx');assert.match(filter,/xlsx/);return stage;}},'清单.xlsx'),stage);
 assert.throws(()=>host.selectTarget({GetSaveAsFilename:()=>({})},'清单.xlsx'),/路径/);
});
test('writes text to a new book, saves XLSX, reopens and verifies exact values, restores user book',()=>{
 const h=fixture();host.write(h.app,model,stage);assert.equal(h.added,1);assert.equal(h.opened,1);assert.equal(h.closed,2);
 assert.equal(h.app.ActiveWorkbook,h.previous);assert.equal(h.app.AutomationSecurity,1);
 assert.deepEqual(h.sheets[0].Range('A1:B3').Value2,model.sheets[0].values);
});
test('source audit fields stay single line and source rows shrink after writing',()=>{
 const h=fixture();
 const audit={sheets:[{name:'清单',values:[['编码'],['000123']]},
  {name:'来源明细',values:[['原路径','文件SHA256','来源标识','核对追溯JSON','材料名称'],
   ['C:\\copy\\source.xlsx','a'.repeat(64),'source-1','{"row":3,"detail":"long"}','水管']]}]};
 host.write(h.app,audit,stage);
 const source=h.sheets[1];
 for(const column of ['A','B','C','D'])assert.equal(source.Range(column+'2:'+column+'2').WrapText,false);
 assert.equal(source.Range('A1:E2').Rows.autoFitCount,1);
 assert.equal(source.Range('A1:E2').WrapText,true,'普通材料字段仍换行');
});
test('write/save/reopen/value/formula failures clean owned books without closing user book',()=>{
 for(const failure of ['write','save','reopen','corrupt','formula']){
  const h=fixture(failure);assert.throws(()=>host.write(h.app,model,stage),/failed|不一致|公式/);
  assert.equal(h.app.ActiveWorkbook,h.previous);assert.equal(h.app.AutomationSecurity,1);assert.ok(h.closed>=1);
 }
});
test('unsafe or already opened staging path fails before adding a workbook',()=>{
 const h=fixture();assert.throws(()=>host.write(h.app,model,'relative.xlsx'),/路径/);assert.equal(h.added,0);
 h.previous.FullName=stage;assert.throws(()=>host.write(h.app,model,stage),/已打开/);assert.equal(h.added,0);
});

function writingFixture(overrides){
 const written=[],writtenRows={},closedUser=[];
 function sheet(){
  const ranges=new Map();
  return {Name:'清单',Range(address){
   if(!ranges.has(address)){const range={Font:{},NumberFormat:null,value:null,HasFormula:false,
    get Value2(){return this.value;},
    set Value2(rows){assert.equal(this.NumberFormat,'@');written.push(address);writtenRows[address]=rows.map(r=>r.slice());this.value=rows.map(r=>r.slice());}};
    ranges.set(address,range);}
   return ranges.get(address);}};
 }
 const previous={FullName:'C:\\user.xlsx',Activate(){if(overrides&&overrides.activateFails)throw Error('activate failed');app.ActiveWorkbook=this;},Close(){closedUser.push(true);}};
 const sheets=[sheet()];
 const book={FullName:'Book1',Worksheets:{get Count(){return sheets.length;},Item(i){return typeof i==='number'?sheets[i-1]:sheets.find(s=>s.Name===i);},Add(){const s=sheet();sheets.push(s);return s;}},
  SaveAs(file,format){assert.equal(format,51);this.FullName=file;},
  Close(){if(overrides&&overrides.closeFails)throw Error('close failed');closedUser.push('owned');},
  Activate(){app.ActiveWorkbook=this;}};
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>!!(overrides&&overrides.stageExists)},
  get ActiveWorkbook(){return app._active;},
  set ActiveWorkbook(value){app._active=value;},
  Workbooks:{Count:1,Item(){return previous;},Add(){app._active=book;return book;},Open(file,links,readonly){assert.equal(file,stage);assert.equal(links,0);assert.equal(readonly,true);assert.equal(app.AutomationSecurity,3);app._active=book;return book;}}};
 app._active=previous;
 if(overrides&&overrides.macroRestoreFails){
  let security=1;
  Object.defineProperty(app,'AutomationSecurity',{get(){return security;},set(value){if(value===1)throw Error('macro restore failed');security=value;}});
 }
 return {app,written,writtenRows,closedUser,previous,sheets,sheet};
}
test('writes and verifies sheets longer than 500 rows in bounded chunks',()=>{
 const h=writingFixture(),values=[['编码','量']];
 for(let i=0;i<500;i++)values.push(['000'+String(i).padStart(3,'0'),String(i)+'.5']);
 const long={sheets:[{name:'清单',values}]};
 host.write(h.app,long,stage);
 assert.deepEqual(h.written,['A1:B500','A501:B501']);
 assert.deepEqual([].concat(h.writtenRows['A1:B500'],h.writtenRows['A501:B501']),values);
 assert.equal(h.app.ActiveWorkbook,h.previous);
});
test('cleanup, macro restore and active book restore failures never report success',()=>{
 for(const [overrides,pattern] of [[{closeFails:true},/清理失败/],[{macroRestoreFails:true},/宏安全设置恢复失败/],[{activateFails:true},/原工作簿恢复失败/]]){
  const h=writingFixture(overrides);
  assert.throws(()=>host.write(h.app,model,stage),pattern);
  assert.deepEqual(h.closedUser.filter(v=>v===true),[],'用户工作簿不得被关闭');
 }
});
test('publishing stops before creating a workbook when the staging file already exists',()=>{
 const h=writingFixture({stageExists:true});
 assert.throws(()=>host.write(h.app,model,stage),/已存在/);
 assert.deepEqual(h.written,[]);
});
