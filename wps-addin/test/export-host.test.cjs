const test=require('node:test'),assert=require('node:assert/strict'),host=require('../src/export-host.js');
const stage='C:\\temp\\rfq-stage.xlsx';
const model={sheets:[{name:'清单',values:[['编码','量'],['000123','12345678901234567890.1'],['=1+1','0.3']]},{name:'来源明细',values:[['来源','数量'],['原件.xlsx','0.3']]}]};
function fixture(failure){
 let active,closed=0,added=0,opened=0,saved=false;const previous={FullName:'C:\\user.xlsx',Activate(){active=this;},Close(){assert.fail('user book closed');}};active=previous;
 function sheet(){const ranges=new Map();return {Name:'Sheet',Range(address){if(!ranges.has(address))ranges.set(address,{Font:{},Rows:{autoFitCount:0,AutoFit(){this.autoFitCount++;}},get Value2(){return this.value;},set Value2(v){if(failure==='write')throw Error('write failed');assert.equal(this.NumberFormat,'@');this.value=v.map(r=>r.slice());},HasFormula:false});return ranges.get(address);}};}
 const sheets=[sheet()];const names=new Map();
 // 真机实测WPS支持工作簿级定义名（Names.Add/Item/RefersTo 且随保存重开保留），预览草稿簿以此作归属标记。
 const book={FullName:'Book1',Names:{get Count(){return names.size;},
   Add(name,refersTo){if(names.has(name))throw Error('duplicate name');names.set(name,{Name:name,RefersTo:refersTo});},
   Item(name){if(!names.has(name))throw Error('name missing');return names.get(name);}},
  Worksheets:{get Count(){return sheets.length;},Item(i){return typeof i==='number'?sheets[i-1]:sheets.find(s=>s.Name===i);},Add(){const s=sheet();sheets.push(s);return s;}},SaveAs(file,format){assert.equal(file,stage);assert.equal(format,51);if(failure==='save')throw Error('save failed');this.FullName=file;saved=true;},Close(save){assert.equal(save,false);closed++;},Activate(){active=this;}};
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
// R12真机遗留观察②：侧栏重建会丢掉内存句柄，必须靠PluginStorage＋草稿簿归属标记找回同一个草稿簿，
// 不能每次导入都新开预览，也不能仅凭“名字＋表形状”就把用户自己新建的同名同结构工作簿当成插件草稿。
function previewStorage(){
 const store=new Map();
 return {store,PluginStorage:{getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>{store.set(key,String(value));},removeItem:key=>{store.delete(key);}}};
}
function shapeSheet(sheet){sheet.UsedRange={UnMerge(){},Clear(){}};return sheet;}
test('侧栏重建后导入预览复用插件自建且未另存的预览簿',()=>{
 const storage=previewStorage();
 const h=fixture();
 h.app.PluginStorage=storage.PluginStorage;
 const first=host.showPreview(h.app,model);
 assert.equal(h.added,1);
 const book=first.book;
 assert.equal(book.FullName,'Book1');
 assert.equal(storage.store.get('rfq.preview.book'),'Book1','创建后在PluginStorage记住草稿簿名字');
 const token=book.Names.Item('RFQ_PREVIEW_TOKEN').RefersTo.replace(/^="?|"$/g,'');
 assert.match(token,/rfq-preview-/,'草稿簿里写入归属标记');
 assert.equal(storage.store.get('rfq.preview.token'),token,'PluginStorage与草稿簿保存同一个归属标记');
 for(const sheet of h.sheets)shapeSheet(sheet);
 // 模拟侧栏重建：内存句柄丢失，但草稿簿仍在宿主里打开，PluginStorage留有名字与标记。
 h.app.Workbooks.Count=2;h.app.Workbooks.Item=i=>i===1?h.previous:book;
 const again=host.showPreview(h.app,model,null);
 assert.equal(again.book,book,'重建后必须复用同一预览工作簿');
 assert.equal(h.added,1,'重建后不得再新开预览工作簿');
 // 用户另存后不再算插件草稿，必须另建，绝不覆盖用户文件。
 book.FullName='C:\\user-saved-preview.xlsx';
 const next=fixture();h.app.Workbooks.Add=()=>next.app.Workbooks.Add();
 host.showPreview(h.app,model,null);
 assert.equal(next.added,1,'用户另存后的预览不得被复用覆盖');
 assert.equal(book.FullName,'C:\\user-saved-preview.xlsx');
});
test('预览归属证明：同名同结构但不是插件草稿的工作簿一律不写入',()=>{
 // 场景A：插件草稿被用户另存后关闭，用户又新建/打开一个同名同结构的工作簿（没有归属标记）。
 const h=fixture(),storage=previewStorage();
 h.app.PluginStorage=storage.PluginStorage;
 const made=host.showPreview(h.app,model);
 assert.equal(h.added,1);
 made.book.FullName='C:\\user-saved.xlsx';
 const userBook=h.previous;
 userBook.FullName='Book1';// 用户工作簿恰好也是未另存草稿、名字相同
 userBook.Worksheets={get Count(){return model.sheets.length;},
  Item(i){return {Name:model.sheets[i-1].name,UsedRange:{UnMerge(){},Clear(){}}}}};
 h.app.Workbooks.Count=1;h.app.Workbooks.Item=()=>userBook;
 const replacement=fixture();
 h.app.Workbooks.Add=()=>replacement.app.Workbooks.Add();
 const result=host.showPreview(h.app,model,null);
 assert.equal(result.book,replacement.app.ActiveWorkbook,'没有归属标记的同名同结构工作簿不得被复用');
 assert.equal(replacement.added,1);
 assert.equal(userBook.FullName,'Book1','用户工作簿未被改写');
 assert.equal(userBook.Worksheets.Count,model.sheets.length);
 // 场景B：同名同结构但归属标记与PluginStorage不一致（用户自己写了同名定义名）也必须另建。
 const h2=fixture(),storage2=previewStorage();
 h2.app.PluginStorage=storage2.PluginStorage;
 const draft2=host.showPreview(h2.app,model).book;
 draft2.Names.Item('RFQ_PREVIEW_TOKEN').RefersTo='="rfq-preview-000000-0"';// 同名标记，但不是本次记忆的标记
 h2.app.Workbooks.Count=1;h2.app.Workbooks.Item=()=>draft2;
 const replacement2=fixture();
 h2.app.Workbooks.Add=()=>replacement2.app.Workbooks.Add();
 host.showPreview(h2.app,model,null);
 assert.equal(replacement2.added,1,'标记不一致时不得复用别人的工作簿');
 // 场景C：宿主不支持定义名/标记被剥掉时，即使记忆里有名字和标记也宁可新开，不冒写用户工作簿的风险。
 const h3=fixture(),storage3=previewStorage();
 h3.app.PluginStorage=storage3.PluginStorage;
 storage3.PluginStorage.setItem('rfq.preview.book','Book1');
 storage3.PluginStorage.setItem('rfq.preview.token','rfq-preview-manual-1');
 const userBook3=h3.previous;
 userBook3.FullName='Book1';
 userBook3.Worksheets={get Count(){return model.sheets.length;},
  Item(i){return {Name:model.sheets[i-1].name,UsedRange:{UnMerge(){},Clear(){}}}}};
 h3.app.Workbooks.Count=1;h3.app.Workbooks.Item=()=>userBook3;
 const replacement3=fixture();
 h3.app.Workbooks.Add=()=>replacement3.app.Workbooks.Add();
 host.showPreview(h3.app,model,null);
 assert.equal(replacement3.added,1,'无法证明归属时必须新开预览');
 assert.equal(userBook3.FullName,'Book1','拿不到归属证明时绝不改写用户工作簿');
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
   // 真实WPS/Excel不会把单格区域(A5:A5)标成已合并；单格合并没有版式意义，写入/读回都必须跳过。
   Merge(){if(options.mergeFails)throw Error('merge failed');
    const parts=String(address).split(':'),multi=parts.length===2&&parts[0]!==parts[1];
    this.MergeCells=multi;if(multi)merges[address]=true;},
   Interior:{Color:null},
   Select(){selected=address;},
   Validation:{Formula1:null,Type:null,InCellDropdown:null,IgnoreBlank:null,
    Add(type,style,operator,formula1){if(options.validationFails)throw Error('validation failed');
     if(options.validationIgnore)return;
     this.Type=type;
     // 实测WPS 12.1.0.29161 会把区域引用的引号/等号归一化后再回读：写 ='表'!$A$1 回读 =表!$A$1。
     if(options.validationWrongRegion)this.Formula1="='别的选项'!$Z$1:$Z$9";// 类型仍是3，来源却是别的区域
     else if(options.validationTypeOnly)this.Formula1=null;// 只落下拉类型，读不回来源
     else if(options.validationEchoWps)this.Formula1=String(formula1).replace(/^=/,'').replace(/'/g,'');
     else this.Formula1=options.validationEchoBare?String(formula1).replace(/^=/,''):formula1;
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
    // 实测WPS 12.1.0.29161 在落地原生链接时会把锚点改写成宿主“链接”样式（纯蓝16711680／下划线2）。
    if(options.linkRestylesFont)anchor.Font.Color=16711680; // #0000FF 按WPS的BGR整数
    const stored=options.rewriteLinkAddress?options.rewriteLinkAddress(address):address;
    const list=links[anchorKey(anchor)]||(links[anchorKey(anchor)]=[]);
    list.push({Address:stored,SubAddress:subAddress,ScreenTip:screenTip,TextToDisplay:display});
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
   Open(file){
    app._active=book;
    // 真实WPS：未显式设置纸张时，SaveAs省略pageSetup，方向/页高重开变回默认值。
    if(options.dropUninitializedPrint)sheets.forEach(function(sheet){
     if(sheet.PageSetup.PaperSize==null){sheet.PageSetup.Orientation=1;sheet.PageSetup.FitToPagesTall=1;}
    });
    if(options.reopenPaperSize!=null)sheets.forEach(sheet=>{sheet.PageSetup.PaperSize=options.reopenPaperSize;});
    // 模拟宿主保存/重开时把原生链接字体统一成自带链接色的行为。
    if(options.reopenLinkColor!=null)Object.keys(links).forEach(function(address){
     rangeFor(address).Font.Color=options.reopenLinkColor;
     rangeFor(address+':'+address).Font.Color=options.reopenLinkColor;});
    return book;}}};
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

// R12真机（WPS 12.1.0.29161 隔离COM实例实测）：Hyperlinks.Add 会把锚点改成宿主链接样式
// （Color 16711680／ColorIndex 5／下划线2）；把获批字体放到链接之后落地，保存重开读回与获批色完全一致
// （#0563C1→12673797／ColorIndex 23，相对地址仍读回“分类工作簿\水泵.xlsx”）。故障是写入次序，不是回读或主题色，
// 因此保持精确比对：宿主若在重开时改回自带链接蓝，属于无法核实的版式，必须停下而不是靠容差放行。
test('原生链接锚点字体：链接之后落地获批蓝色，重开读回必须与获批色完全一致',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['分类汇总表'],['项目名称：示例园区'],
  ['序号','名称','材料条数','品牌与供应商一','品牌','供应商','品牌与供应商二','品牌','供应商','询价生成方式'],
  ['1','水泵','2','','','','','','','合成一份']],10);
 const spec=layoutModule.build({columns:values[2].map(function(_,i){return {index:i+1};}),headerRows:[3],
  hyperlinks:[{row:4,column:2,address:'分类工作簿\\水泵.xlsx',display:'水泵',relative:true}],
  fonts:[layoutModule.linkFont(4,2)]},{rowCount:values.length,columnCount:10});
 const sheetOf=function(name){return {sheets:[{name:name,values:values,layout:spec}]};};
 const ordered=layoutFixture({linkRestylesFont:true});
 host.write(ordered.app,sheetOf('分类汇总表'),'C:\\temp\\rfq-layout.xlsx');
 assert.equal(ordered.sheets[0].Range('B4:B4').Font.Color,layoutModule.toColor('#0563C1'),
  '字体必须在原生链接之后落地，否则会被宿主链接样式覆盖');
 assert.equal(ordered.sheets[0].Range('B4:B4').Font.Underline,2,'蓝色下划线仍然落地');
 const rejected=layoutFixture({linkRestylesFont:true,reopenLinkColor:16711680});
 assert.throws(function(){host.write(rejected.app,sheetOf('分类汇总表'),'C:\\temp\\rfq-layout.xlsx');},
  /字体颜色读回不一致：B4:B4/,'宿主重开改写锚点色必须停下，不产出“看起来像”的文件');
});

// 五类失效之一：下拉“类型对、来源错”。Type=3 只说明单元格是下拉，不能证明选项源正确。
test('下拉来源必须读回一致：Type=3指错区域、只剩类型都拒绝，等价写法仍通过',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['清单'],
  ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  ['1','FM-001','阀门','DN50','个','20','通达','','','']],10);
 const spec=layoutModule.build({columns:values[1].map(function(_,i){return {index:i+1};}),headerRows:[2],
  validations:[layoutModule.listValidation(3,7,1,1,'内部选项','$A$1:$A$5')],metadata:{profile:'category-detail'}},
  {rowCount:values.length,columnCount:10});
 const book=function(){return {sheets:[{name:'材料明细',values:values,layout:spec}]};};
 // Type=3 却指到别的选项区域：必须拒绝，不能因为“有下拉”就放行。
 const wrong=layoutFixture({validationWrongRegion:true});
 assert.throws(function(){host.write(wrong.app,book(),'C:\\temp\\rfq-layout.xlsx');},
  /下拉未生效.*G3:G3.*实际.*别的选项/,'类型为3但来源是别的区域必须拒绝');
 assert.equal(wrong.saved,false,'错误来源不得保存文件');
 // 宿主只落下拉类型、读不回来源：不能仅凭Type=3宣布通过。
 const typeOnly=layoutFixture({validationTypeOnly:true});
 assert.throws(function(){host.write(typeOnly.app,book(),'C:\\temp\\rfq-layout.xlsx');},
  /下拉未生效.*G3:G3.*实际空.*类型3/,'只凭类型为3不能宣布下拉正确');
 assert.equal(typeOnly.saved,false);
 // 真正等价的WPS回读写法（去掉引号与等号）继续通过。
 const equivalent=layoutFixture({validationEchoWps:true});
 host.write(equivalent.app,book(),'C:\\temp\\rfq-layout.xlsx');
 assert.equal(equivalent.saved,true,'WPS归一化后的等价区域引用必须通过');
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
 const h=layoutFixture({dropUninitializedPrint:true});
 host.write(h.app,book,'C:\\temp\\rfq-inquiry.xlsx');
 const sheet=h.sheets[0];
 assert.deepEqual(sheet.Range('A1:J9').Value2,model.sheets[0].values,'公开值逐格写回且与模型一致');
 assert.equal(sheet.Range('A1:J1').MergeCells,true,'标题合并成整行');
 assert.equal(sheet.Columns.Item(4).ColumnWidth,46,'项目特征描述列加宽以便长特征换行');
 assert.equal(sheet.Rows.Item(7).Font.Bold,true,'材料表头行加粗');
 assert.equal(sheet.Range('A7:J7').Interior.Color,layoutModule.toColor('#DCE6F1'),'表头浅色填充');
 assert.equal(sheet.PageSetup.PrintTitleRows,'$7:$7','打印重复表头');
 assert.equal(sheet.PageSetup.PrintArea,'A1:J9','打印区域覆盖标题到末行');
 assert.equal(sheet.PageSetup.Orientation,2,'横向打印');
 assert.equal(sheet.PageSetup.PaperSize,9,'显式A4使打印设置保存重开后仍保留');
 assert.equal(sheet.PageSetup.Zoom,false,'关闭固定百分比缩放，使适合页宽生效');
 assert.equal(sheet.PageSetup.FitToPagesWide,1,'十列不横向分割');
 assert.equal(sheet.PageSetup.FitToPagesTall,0,'保留纵向分页');
 assert.equal(h.app.ActiveWindow.FreezePanes,true,'冻结表头以上');
 assert.deepEqual(book.sheets.slice(1).map(s=>s.name),['内部追溯','处理记录'],'内部页留在总表内，不进入公开询价页');
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','用户工作簿保持活动');
 const wrongPaper=layoutFixture({reopenPaperSize:1});
 assert.throws(()=>host.write(wrongPaper.app,book,'C:\\temp\\rfq-inquiry.xlsx'),/打印纸张读回不一致/);
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

// R12-E：拆分待核对必须有内容证明。verifyExistingOutput 打开实际供应商文件，逐值核公开值/工作表范围/必需版式和抬头，
// 并在核对前后各取一次实际SHA；只有全通过且SHA没有在核对过程中变化才返回ok。
function verifyFixture(options){
 const opts=options||{},
  values=(opts.values||[['示例园区 水泵询价表','','','','','','','','',''],
   ['项目名称：示例园区','','','','','单位名称：示例建设公司','','','',''],
   ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
   ['1','FM-001','水泵','DN50','台','2','青源','','','']]).map(function(row){return row.slice();}),
  target=opts.target||'C:\\out\\水泵_青源.xlsx',h=layoutFixture();
 h.book.Worksheets.Add();
 h.sheets[0].Name=opts.sheetName||'水泵_青源';
 h.sheets[0].Range('A1:J'+values.length).Value2=values;
 h.sheets[0].Range('A1:J1').Merge();
 const expectedMerges=[{row:1,column:1,columnSpan:10}];
 // 单格“合并”（供应商区只有一组时的产物）在真实宿主不生效，核对必须跳过。
 if(opts.singleCellMerge)expectedMerges.push({row:3,column:1});
 if(opts.extraSheet)h.book.Worksheets.Add();
 if(opts.hiddenAuxiliary)h.sheets[0].Columns.Item(11).Hidden=true;
 const opened=[];
 h.app.Workbooks.Open=function(file,links,readonly){
  opened.push({file:file,links:links,readonly:readonly,security:h.app.AutomationSecurity});
  h.app._active=h.book;return h.book;};
 return Object.assign(h,{target:target,opened:opened,expected:{name:opts.sheetName||'水泵_青源',values:values,
  layout:{columns:[1,2,3,4,5,6,7,8,9,10].map(function(index){return {index:index};}),
   merges:expectedMerges,metadata:{profile:'inquiry-sheet'}}}});
}
test('R12-E verifyExistingOutput只认内容逐值一致的已有文件，核对前后SHA必须稳定',async()=>{
 const h=verifyFixture(),shaBefore='1'.repeat(64);
 const result=await host.verifyExistingOutput(h.app,{fileId:'file-a',target:h.target},h.expected,
  function(){return Promise.resolve({target:h.target,exists:true,sha256:shaBefore,bytes:100});});
 assert.equal(result.ok,true);
 assert.equal(result.sha256,shaBefore);
 assert.deepEqual(result.mismatches,[]);
 assert.deepEqual(result.layoutIssues,[]);
 assert.deepEqual(h.opened.map(function(item){return item.file;}),[h.target],'按目标实际路径只读打开');
 assert.equal(h.opened[0].readonly,true);
 assert.equal(h.opened[0].security,3,'核对期间临时禁宏');
 assert.equal(h.app.AutomationSecurity,1,'核对后恢复宏安全设置');
 assert.equal(h.closed,1,'只关闭插件自己打开的文件');
});
test('R12-E verifyExistingOutput拒绝同名异内容，不把外部文件当成功',async()=>{
 const h=verifyFixture();
 h.sheets[0].Range('A1:J4').Value2=h.expected.values.map(function(row,index){
  return index===3?row.map(function(value,column){return column===5?'999':value;}):row.slice();});
 const result=await host.verifyExistingOutput(h.app,{fileId:'file-a',target:h.target},h.expected,
  function(){return Promise.resolve({target:h.target,exists:true,sha256:'2'.repeat(64),bytes:100});});
 assert.equal(result.ok,false);
 assert.match(result.mismatches.join('；'),/工程量|公开值|不一致/);
 assert.equal(h.closed,1);
});
test('R12-E verifyExistingOutput拒绝隐藏辅助列与内部工作表',async()=>{
 const target='C:\\out\\水泵_青源.xlsx',inspect=function(){return Promise.resolve({target:target,exists:true,sha256:'3'.repeat(64),bytes:100});};
 const hidden=verifyFixture({hiddenAuxiliary:true});
 const hiddenResult=await host.verifyExistingOutput(hidden.app,{fileId:'file-a',target:hidden.target},hidden.expected,inspect);
 assert.equal(hiddenResult.ok,false);
 assert.match(hiddenResult.layoutIssues.join('；'),/隐藏/,'供应商件不允许隐藏追溯列');
 const extra=verifyFixture({extraSheet:true});
 const extraResult=await host.verifyExistingOutput(extra.app,{fileId:'file-a',target:extra.target},extra.expected,inspect);
 assert.equal(extraResult.ok,false);
 assert.match(extraResult.mismatches.join('；'),/工作表/,'供应商件不允许内部工作表');
});
test('R12-E verifyExistingOutput在核对过程中目标SHA改变时拒绝成功',async()=>{
 const h=verifyFixture();let calls=0;
 const result=await host.verifyExistingOutput(h.app,{fileId:'file-a',target:h.target},h.expected,
  function(){return Promise.resolve({target:h.target,exists:true,bytes:100,sha256:calls++===0?'4'.repeat(64):'5'.repeat(64)});});
 assert.equal(result.ok,false);
 assert.match(result.mismatches.join('；'),/SHA|变化/);
});
test('R12-E verifyExistingOutput对缺失目标直接保守拒绝，不打开工作簿',async()=>{
 const h=verifyFixture();
 const result=await host.verifyExistingOutput(h.app,{fileId:'file-a',target:h.target},h.expected,
  function(){return Promise.resolve({target:h.target,exists:false,sha256:null,bytes:0});});
 assert.equal(result.ok,false);
 assert.equal(result.sha256,null);
 assert.equal(h.opened.length,0);
});
// R12真实宿主（WPS 12.1.0.29161，本机原生COM实测）：供应商区只有一组时，询价版式会带一个单格“合并”A5:A5，
// 真实WPS不会把它标成已合并。写入/读回/内容核对都要跳过单格合并，只对有多格意义的合并判失败。
test('R12-E单格合并在真实宿主不生效：写入与内容核对都跳过，不误判失败',async()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['示例园区 水泵询价表','','','','','','','','',''],
  ['项目名称：示例园区','','','','','单位名称：示例建设公司','','','',''],
  ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],
  ['1','FM-001','水泵','DN50','台','3','青源','','','']],10);
 const spec=layoutModule.build({columns:values[2].map(function(_,index){return {index:index+1};}),headerRows:[3],
  merges:[{row:1,column:1,columnSpan:10},{row:3,column:1,rowSpan:1},{row:3,column:2,columnSpan:9}]},
  {rowCount:values.length,columnCount:10});
 const h=layoutFixture();
 host.write(h.app,{sheets:[{name:'水泵_青源',values:values,layout:spec}]},'C:\\temp\\rfq-single-merge.xlsx');
 assert.equal(h.saved,true,'单格合并不生效不得阻断真实写入');
 assert.equal(h.sheets[0].Range('A1:J1').MergeCells,true,'多格合并仍必须落地');
 const verified=verifyFixture({values:values,singleCellMerge:true});
 const result=await host.verifyExistingOutput(verified.app,{fileId:'file-a',target:verified.target},verified.expected,
  function(){return Promise.resolve({target:verified.target,exists:true,sha256:'6'.repeat(64),bytes:100});});
 assert.equal(result.ok,true,'内容一致时单格合并不应判失败');
 assert.deepEqual(result.layoutIssues,[]);
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
