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

test('导入预览只创建自有工作簿、不保存原件；改选择更新同一自有簿，已另存则另建',()=>{
 const h=fixture();
 const handle=host.showPreview(h.app,model);
 assert.equal(h.added,1);assert.equal(h.closed,0);assert.equal(h.opened,0);
 assert.notEqual(h.app.ActiveWorkbook,h.previous);
 const book=h.app.ActiveWorkbook;
 h.app.Workbooks.Count=2;h.app.Workbooks.Item=i=>i===1?h.previous:book;
 for(const sheet of h.sheets)sheet.UsedRange={UnMerge(){},Clear(){}};
 const result=host.showPreview(h.app,{sheets:model.sheets.map(s=>({...s,values:[s.values[0]]}))},handle);
 assert.equal(result.book,book);assert.equal(h.added,1,'更新预览不产生重复工作簿');
 book.FullName='C:\\user-saved-preview.xlsx';
 const next=fixture();h.app.Workbooks.Add=()=>next.app.Workbooks.Add();
 host.showPreview(h.app,model,handle);
 assert.equal(next.added,1,'用户另存后的预览不再被刷新覆盖');
 assert.equal(book.FullName,'C:\\user-saved-preview.xlsx');
});

// R2：版式、原生超链接与区域下拉的模拟宿主。只模拟本包真正用到的API。
function layoutFixture(overrides){
 const options=overrides||{},stage='C:\\temp\\rfq-layout.xlsx';
 const merges={},fills={},validations={},links={};
 function rangeFor(address){
  if(ranges.has(address))return ranges.get(address);
  const range={Font:{Size:null,Bold:false},NumberFormat:null,value:null,WrapText:null,HasFormula:false,MergeCells:false,
   Rows:{AutoFit(){this.autoFitCount=(this.autoFitCount||0)+1;}},
   get Value2(){return this.value;},
   set Value2(rows){this.value=rows.map(r=>r.slice());},
   Merge(){if(options.mergeFails)throw Error('merge failed');this.MergeCells=true;merges[address]=true;},
   Interior:{Color:null},
   Select(){selected=address;},
   Validation:{Formula1:null,Type:null,InCellDropdown:null,IgnoreBlank:null,
    Add(type,style,operator,formula1){if(options.validationFails)throw Error('validation failed');
     if(options.validationIgnore)return;
     this.Type=type;
     // 实测WPS表格会把区域引用的等号去掉后再回读Formula1，模拟宿主差异。
     this.Formula1=options.validationEchoBare?String(formula1).replace(/^=/,''):formula1;
     validations[anchorKey({__address:address})]=this.Formula1;},
    Delete(){this.Formula1=null;this.Type=null;}},
   get Hyperlinks(){return hyperlinkView(anchorKey({__address:address}));}};
  range.__address=address;
  ranges.set(address,range);return range;
 }
 function hyperlinkView(address){
  const list=links[address]||(links[address]=[]);
  return {get Count(){return list.length;},Item(index){return list[index-1]||{};}};
 }
 const ranges=new Map();let selected='';
 const sheets=[];
 function newSheet(name){
  const cells=new Map();
  const sheet={Name:name||'Sheet',Range:rangeFor,
   Cells:{Item(row,column){const address=colName(column)+row;if(!cells.has(address))cells.set(address,rangeFor(address));return cells.get(address);}},
   // 实测WPS表格（同Excel）：隐藏列的ColumnWidth恒为0，读不回原宽度，必须按Hidden核隐藏。
   Columns:{Item(index){const key='col'+index;if(!columnWidths.has(key)){columnWidths.set(key,{_w:null,_h:false,
    get ColumnWidth(){return this._h?0:this._w;},set ColumnWidth(value){this._w=value;},
    get Hidden(){return this._h;},set Hidden(value){this._h=value===true;}});}return columnWidths.get(key);}},
   Rows:{Item(index){const key='row'+index;if(!rowHeights.has(key))rowHeights.set(key,{RowHeight:null,Font:{Bold:false},AutoFit(){}});return rowHeights.get(key);}},
   PageSetup:{PrintArea:null,PrintTitleRows:null}};
  if(!options.noHyperlinks){
   sheet.Hyperlinks={Add(anchor,address,subAddress,screenTip,display){
    if(options.linkAddThrows)throw Error('link unsupported');
    if(options.dropLink)return;
    const list=links[anchorKey(anchor)]||(links[anchorKey(anchor)]=[]);
    list.push({Address:address,SubAddress:subAddress,ScreenTip:screenTip,TextToDisplay:display});
   }};
  }
  return sheet;
 }
 function anchorKey(anchor){return String(anchor.__address||'').split(':')[0];}
 function colName(index){let name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
 const columnWidths=new Map(),rowHeights=new Map();
 const previous={FullName:'C:\\user.xlsx',Activate(){app._active=this;},Close(){assert.fail('user book closed');}};
 const book={FullName:'Book1',Worksheets:{get Count(){return sheets.length;},
   Item(i){return typeof i==='number'?sheets[i-1]:sheets.filter(s=>s.Name===i)[0];},
   Add(){const s=newSheet();sheets.push(s);return s;}},
  SaveAs(file,format){assert.equal(format,51);this.FullName=file;saved=true;},
  Close(save){assert.equal(save,false);closed++;},
  Activate(){app._active=this;}};
 let closed=0,saved=false;
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},ActiveWindow:{FreezePanes:false,get Frozen(){return this.FreezePanes;}},
  get ActiveWorkbook(){return app._active;},Workbooks:{Count:1,Item(){return previous;},
   Add(){app._active=book;const s=newSheet();sheets.push(s);return book;},
   Open(file){app._active=book;return book;}}};
 app._active=previous;
 // Range()缓存必须按地址记忆住合并/填充/下拉状态，才能被读回校验。
 return {app,book,ranges,get sheets(){return sheets;},get saved(){return saved;},merges,fills,validations,links,columnWidths,rowHeights,
  get selected(){return selected;},get closed(){return closed;}};
}

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
test('落地获批版式：等宽矩阵、列宽、表头填充、冻结、打印、原生链接与区域下拉',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['示例园区材料询价表'],
  ['项目名称：示例园区'],
  ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  ['1','FM-001','阀门','DN50','个','20','通达 / 海岳','','','']],10);
 const spec=layoutModule.build({columns:values[2].map(function(_,i){return {index:i+1,width:i===3?42:14};}),
  headerRows:[3],freeze:{row:4,column:1},
  merges:[{row:1,column:1,columnSpan:10}],
  fills:[layoutModule.headerFill(3,10),layoutModule.inputFill(4,7,1,1)],
  hyperlinks:[{row:4,column:2,address:'C:\\out\\分类工作簿\\阀门.xlsx',display:'阀门'}],
  validations:[layoutModule.listValidation(4,8,1,1,'内部选项','$A$1:$A$5')],
  print:{area:{row:1,column:1,rowSpan:4,columnSpan:10},repeatRow:3},metadata:{profile:'category-detail'}},
  {rowCount:values.length,columnCount:10});
 const h=layoutFixture();
 host.write(h.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');
 assert.equal(h.sheets[0].Columns.Item(4).ColumnWidth,42,'长特征列按版式加宽');
 assert.equal(h.sheets[0].Columns.Item(1).ColumnWidth,14);
 assert.equal(h.sheets[0].Rows.Item(3).Font.Bold,true,'表头行加粗');
 assert.equal(h.sheets[0].Range('A3:J3').Interior.Color,layoutModule.toColor('#DCE6F1'),'表头浅色填充');
 assert.equal(h.sheets[0].Range('G4:G4').Interior.Color,layoutModule.toColor('#FFF7D6'),'可填写区黄色');
 assert.equal(h.sheets[0].Range('A1:J1').MergeCells,true,'标题合并成整行');
 assert.equal(h.app.ActiveWindow.FreezePanes,true,'冻结首行/首列');
 assert.equal(h.sheets[0].PageSetup.PrintArea,'A1:J4');
 assert.equal(h.sheets[0].PageSetup.PrintTitleRows,'$3:$3','打印重复表头');
 assert.deepEqual(h.links['B4'].map(function(item){return item.Address+'|'+item.TextToDisplay;}),
  ['C:\\out\\分类工作簿\\阀门.xlsx|阀门'],'用原生超链接，显示类别名');
 assert.equal(h.validations['H4'],"='内部选项'!$A$1:$A$5",'分类下拉用区域引用，避免类别名被拆开');
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','用户工作簿保持活动');
 assert.equal(h.app.AutomationSecurity,1,'宏安全设置恢复');
});

test('版式读回缺失或宿主缺API时明确报错，不产出“看起来像”的文件',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['清单'],['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  ['1','FM-001','阀门','DN50','个','20','通达','','','']],10);
 const spec=layoutModule.build({columns:values[1].map(function(_,i){return {index:i+1};}),headerRows:[2],
  hyperlinks:[{row:3,column:2,address:'C:\\out\\阀门.xlsx',display:'阀门'}],
  validations:[layoutModule.listValidation(3,8,1,1,'内部选项','$A$1:$A$5')]},
  {rowCount:values.length,columnCount:10});
 const dropped=layoutFixture({dropLink:true});
 assert.throws(function(){host.write(dropped.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');},
  /超链接未生效|超链接读回缺失/,'链接未真正写入时必须失败');
 const noApi=layoutFixture({noHyperlinks:true});
 assert.throws(function(){host.write(noApi.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');},
  /Hyperlinks\.Add/,'缺API时必须报出具体API名');
 assert.equal(noApi.saved,false,'缺API时不得保存/发布文件');
 const badValidation=layoutFixture({validationFails:true});
 assert.throws(function(){host.write(badValidation.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');},
  /validation failed|分类下拉读回|下拉未生效/);
 const noMerge=layoutFixture({mergeFails:true});
 assert.throws(function(){host.write(noMerge.app,{sheets:[{name:'材料明细',values:values,
  layout:layoutModule.build({columns:values[1].map(function(_,i){return {index:i+1};}),headerRows:[2],
   merges:[{row:1,column:1,columnSpan:10}]},{rowCount:values.length,columnCount:10})}]},'C:\\temp\\rfq-layout.xlsx');},
  /merge failed|合并/,'合并失败必须停止');
});

test('无layout的旧模型仍按原行为写出，版式校验拦住越界区域',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const legacy={sheets:[{name:'清单',values:[['编码','量'],['000123','0.3']]}]};
 const h=layoutFixture();
 host.write(h.app,legacy,'C:\\temp\\rfq-layout.xlsx');
 assert.deepEqual(h.sheets[0].Range('A1:B2').Value2,[['编码','量'],['000123','0.3']],'旧模型不带layout也能写出');
 assert.deepEqual(layoutModule.validate(layoutModule.build({columns:[{index:1}],
  merges:[{row:1,column:1,columnSpan:4}]},{rowCount:2,columnCount:2}),{rowCount:2,columnCount:2}).errors,
  ['第1个合并超出工作表列范围。'],'越界合并必须在写盘前被拦住');
});

test('publishing stops before creating a workbook when the staging file already exists',()=>{
 const h=writingFixture({stageExists:true});
 assert.throws(()=>host.write(h.app,model,stage),/已存在/);
 assert.deepEqual(h.written,[]);
});

// R9：图06总询价工作簿——真实询价模型（模型→workbook→host）经版式写入并读回核验。
test('R9 inquiry workbook keeps the 图06 layout: title merge, header fill, freeze, print repeat row',()=>{
 const layoutModule=require('../src/workbook-layout.js'),inquiry=require('../src/inquiry-model.js');
 const groups=[
  {id:'row-1',scopeId:'C:/copies/a.xlsx',name:'阀门',feature:'DN50',unit:'个',quantity:'20',
   sources:[{id:'s1',code:'FM-001'}],sourceLabels:['示例园区—给排水']},
  {id:'row-2',scopeId:'C:/copies/a.xlsx',name:'阀门',feature:'DN65',unit:'个',quantity:'12',
   sources:[{id:'s2',code:'FM-002'}],sourceLabels:['示例园区—给排水']}];
 const classification={schemaVersion:1,revision:1,decisions:[
  {rowId:'row-1',categoryId:'valve',categoryName:'阀门',skip:false},
  {rowId:'row-2',categoryId:'valve',categoryName:'阀门',skip:false}]};
 const model=inquiry.build({brands:[{categoryId:'valve',categoryName:'阀门',rowCount:2,mode:'synthesize',
   groups:[{brand:'通达',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}]}],
  groups:groups,classification:classification,inputKey:'ck2-inquiry-layout',
  header:{projectName:'示例园区',company:'示例建设公司',contact:'测试员',phone:'示例联系方式',address:''}});
 const book=inquiry.workbook(model,'2026-09-27T00:00:00.000Z');
 const h=layoutFixture();
 host.write(h.app,book,'C:\\temp\\rfq-inquiry.xlsx');
 const sheet=h.sheets[0];
 assert.deepEqual(sheet.Range('A1:J9').Value2,model.sheets[0].values,'公开值逐格写回且与模型一致');
 assert.equal(sheet.Range('A1:J1').MergeCells,true,'标题合并成整行');
 assert.equal(sheet.Columns.Item(4).ColumnWidth,46,'项目特征描述列加宽以便长特征换行');
 assert.equal(sheet.Rows.Item(7).Font.Bold,true,'材料表头行加粗');
 assert.equal(sheet.Range('A7:J7').Interior.Color,layoutModule.toColor('#DCE6F1'),'表头浅色填充');
 assert.equal(sheet.PageSetup.PrintTitleRows,'$7:$7','打印重复表头');
 assert.equal(sheet.PageSetup.PrintArea,'A1:J9','打印区域覆盖标题到末行');
 assert.equal(h.app.ActiveWindow.FreezePanes,true,'冻结表头以上');
 assert.deepEqual(book.sheets.slice(1).map(s=>s.name),['内部追溯','处理记录'],'内部页留在总表内，不进入公开询价页');
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','用户工作簿保持活动');
});

// R12实机（2026-09-27）：WPS表格把区域引用的等号/引号去掉后回读Formula1，
// 不能因为等价写法就把“已经落地的下拉”判成未生效，也不能因此阻断整条生成链路。
test('宿主回读去掉等号的同一区域时按等价通过，下拉区域不变',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['清单'],
  ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  ['1','FM-001','阀门','DN50','个','20','通达','','','']],10);
 const spec=layoutModule.build({columns:values[1].map(function(_,i){return {index:i+1};}),headerRows:[2],
  validations:[layoutModule.listValidation(3,7,1,1,'内部选项','$A$1:$A$5')],metadata:{profile:'category-detail'}},
  {rowCount:values.length,columnCount:10});
 const h=layoutFixture({validationEchoBare:true});
 host.write(h.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');
 assert.equal(String(h.validations['G3']).replace(/^=/,''),"'内部选项'!$A$1:$A$5",'只落到G3一个区域');
 assert.equal(h.saved,true,'等价回读不阻断保存快照');
});

test('宿主完全没有落下拉时明确报出期望与实际，不产出文件',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['清单'],
  ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  ['1','FM-001','阀门','DN50','个','20','通达','','','']],10);
 const spec=layoutModule.build({columns:values[1].map(function(_,i){return {index:i+1};}),headerRows:[2],
  validations:[layoutModule.listValidation(3,7,1,1,'内部选项','$A$1:$A$5')],metadata:{profile:'category-detail'}},
  {rowCount:values.length,columnCount:10});
 const h=layoutFixture({validationIgnore:true});
 assert.throws(function(){host.write(h.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');},
  /下拉未生效.*G3:G3.*期望.*实际空/,'必须报出具体单元格、期望公式与实际回读');
 assert.equal(h.saved,false,'下拉未落地时不得保存文件');
});

// R12实机（2026-09-27）：WPS表格把隐藏列的ColumnWidth读回0，随行rowId隐藏列不能因此判失败。
test('隐藏辅助列按Hidden判定，不因隐藏列宽读回0而阻断',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['示例园区_分类审核成果.xlsx'],
  ['自动匹配仅供参考'],
  ['序号','项目名称','规格','单位','工程量','自动建议','匹配情况','最终分类','审核备注','','行标识'],
  ['1','水泵','DN50','台','2','水泵','匹配成功','水泵','','','row-1']],11);
 const spec=layoutModule.build({columns:[{index:1,width:6},{index:2,width:16},{index:3,width:22},{index:4,width:8},
   {index:5,width:10},{index:6,width:14},{index:7,width:12},{index:8,width:16},{index:9,width:20},{index:10,width:3},
   {index:11,width:26,hidden:true}],
  headerRows:[3],validations:[layoutModule.listValidation(4,8,1,1,'内部选项','$B$2:$B$7')],metadata:{profile:'classification-review'}},
  {rowCount:values.length,columnCount:11});
 const h=layoutFixture({validationEchoBare:true});
 host.write(h.app,{sheets:[{name:'分类审核成果',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');
 assert.equal(h.sheets[0].Columns.Item(11).Hidden,true,'随行rowId辅助列必须隐藏');
 assert.equal(h.sheets[0].Columns.Item(11).ColumnWidth,0,'隐藏列的宽度在WPS里读回0');
 assert.equal(h.saved,true,'隐藏列宽读回0不得阻断生成');
 assert.equal(h.sheets[0].Columns.Item(8).ColumnWidth,16,'可见列宽仍按版式读回校对');
});
