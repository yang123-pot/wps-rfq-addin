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

test('原表浏览：预览后原生复制全部来源页；刷新统计不重写原表，来源异常不保留半成品',()=>{
 for(const fail of [false,true]){
  const h=fixture(),closed=[],copied=[],sourceSheets=[{Name:'1',format:'原合并单元格/小标题/列宽'},{Name:'10',format:'第二页格式'}];
  let target;
  const oldAdd=h.app.Workbooks.Add;
  h.app.Workbooks.Add=function(){target=oldAdd();return target;};
  sourceSheets.forEach((source,index)=>{source.Copy=function(before,after){
   assert.equal(before,null);assert.equal(h.app.AutomationSecurity,3);
   assert.equal(after,h.sheets[h.sheets.length-1]);
   if(fail&&index===1)throw Error('复制失败');
   copied.push(source.Name);h.sheets.push({Name:source.Name,format:source.format});
  };});
  h.app.Workbooks.Open=function(file,links,readOnly){
   assert.equal(file,'C:\\copies\\来源.xlsx');assert.equal(links,0);assert.equal(readOnly,true);
   return {FullName:file,Worksheets:{Count:2,Item:i=>sourceSheets[i-1]},Close:save=>{assert.equal(save,false);closed.push(file);}};
  };
  const overview={sheets:[{name:'导入预览',values:[['统计'],['2张表']]}],sourceCopies:[{
   originalPath:'C:\\原件.xlsx',copyPath:'C:\\copies\\来源.xlsx',fingerprint:'a'.repeat(64),
   sheets:[{sourceName:'1',previewName:'1'},{sourceName:'10',previewName:'10'}]}]};
  if(fail){assert.throws(()=>host.showPreview(h.app,overview),/复制失败/);assert.equal(h.closed,1);}
  else{
   const handle=host.showPreview(h.app,overview);
   assert.deepEqual(h.sheets.map(sheet=>sheet.Name),['导入预览','1','10']);
   assert.equal(h.sheets[1].format,'原合并单元格/小标题/列宽');
   h.app.Workbooks.Count=2;h.app.Workbooks.Item=i=>i===1?h.previous:target;
   h.sheets[0].UsedRange={UnMerge(){},Clear(){}};
   host.showPreview(h.app,overview,handle);
   assert.deepEqual(copied,['1','10'],'改变整理选项只刷新统计，不再次复制或清空后面的原表');
   assert.equal(h.added,1);
  }
  assert.equal(closed.length,1);assert.equal(h.app.AutomationSecurity,1);
 }
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
 function rangeFor(address,sheet){
  const sheetIndex=sheet?sheets.indexOf(sheet):0,prefix=sheetIndex>0?'sheet'+sheetIndex+'!':'',cacheKey=prefix+address;
  if(ranges.has(cacheKey))return ranges.get(cacheKey);
  const range={Font:{Size:null,Bold:false},NumberFormat:null,value:null,WrapText:null,HasFormula:false,MergeCells:false,
   Rows:{AutoFit(){this.autoFitCount=(this.autoFitCount||0)+1;}},
   get Value2(){return this.value;},
   set Value2(rows){this.value=rows.map(r=>r.map(v=>{
    if(typeof v==='string'&&v[0]==="'"){
     if(options.corruptQuotedText)return '被宿主改写';
     if(options.stripFirstQuote)return v.slice(1);
    }
    return v;
   }));},
   // 真实WPS/Excel不会把单格区域(A5:A5)标成已合并；单格合并没有版式意义，写入/读回都必须跳过。
   Merge(){if(options.mergeFails)throw Error('merge failed');
    const parts=String(address).split(':'),multi=parts.length===2&&parts[0]!==parts[1];
    this.MergeCells=multi;if(multi)merges[address]=true;},
   Interior:{Color:null},
   Select(){
    if(options.requireActiveSheet&&activeSheet!==sheet)throw Error('cannot select cells on inactive sheet: '+sheet.Name);
    selected=address;
    if(options.selectionScrollRow)scrollRow=options.selectionScrollRow;
   },
   Validation:{Formula1:null,Type:null,InCellDropdown:null,IgnoreBlank:null,
    Add(type,style,operator,formula1){if(options.validationFails)throw Error('validation failed');
     if(options.validationIgnore)return;
     if(options.validationRequiresExistingSheet){
      const reference=/^=?('(?:[^']|'')+'|[^!]+)!/.exec(String(formula1));
      const sourceName=reference&&reference[1].replace(/^'|'$/g,'').replace(/''/g,"'");
      if(!sourceName||!book.Worksheets.Item(sourceName))throw Error('validation source sheet missing: '+sourceName);
     }
     this.Type=type;
     // 实测WPS 12.1.0.29161 会把区域引用的引号/等号归一化后再回读：写 ='表'!$A$1 回读 =表!$A$1。
     if(options.validationWrongRegion)this.Formula1="='别的选项'!$Z$1:$Z$9";// 类型仍是3，来源却是别的区域
     else if(options.validationTypeOnly)this.Formula1=null;// 只落下拉类型，读不回来源
     else if(options.validationEchoWps)this.Formula1=String(formula1).replace(/^=/,'').replace(/'/g,'');
     else this.Formula1=options.validationEchoBare?String(formula1).replace(/^=/,''):formula1;
     validations[anchorKey({__address:address})]=this.Formula1;},
    Delete(){this.Formula1=null;this.Type=null;}},
   get Hyperlinks(){return hyperlinkView(anchorKey({__address:address}));}};
  range.__address=prefix+address;
  ranges.set(cacheKey,range);return range;
 }
 function hyperlinkView(address){
  const list=links[address]||(links[address]=[]);
  return {get Count(){return list.length;},Item(index){return list[index-1]||{};}};
 }
 const ranges=new Map(),frozenSheets=new Map(),freezePositions=new Map(),explicitSplits=new Map();let selected='',activeSheet=null,frozen=false,scrollRow=1;
 const sheets=[];
 function newSheet(name){
  const cells=new Map();
  const prefix='sheet'+sheets.length+'!';
  const sheet={Name:name||'Sheet',Visible:-1,Activate(){activeSheet=sheet;},Range(address){return rangeFor(address,sheet);},
   Cells:{Item(row,column){const address=colName(column)+row;if(!cells.has(address))cells.set(address,rangeFor(address,sheet));return cells.get(address);}},
   // 实测WPS表格（同Excel）：隐藏列的ColumnWidth恒为0，读不回原宽度，必须按Hidden核隐藏。
   Columns:{Item(index){const key=prefix+'col'+index;if(!columnWidths.has(key)){columnWidths.set(key,{_w:null,_h:false,
    get ColumnWidth(){return this._h?0:this._w;},set ColumnWidth(value){this._w=value;},
    get Hidden(){return this._h;},set Hidden(value){this._h=value===true;}});}return columnWidths.get(key);}},
   Rows:{Item(index){const key=prefix+'row'+index;if(!rowHeights.has(key))rowHeights.set(key,{RowHeight:null,Font:{Bold:false},AutoFit(){}});return rowHeights.get(key);}},
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
  if(options.noSheetActivation)delete sheet.Activate;
  // 真实宿主若缺少 Worksheet.Visible 或静默忽略写入，隐藏内部页就没落地，生成必须明确失败。
  if(options.sheetVisibilityIgnored)Object.defineProperty(sheet,'Visible',{get(){return -1;},set(){},configurable:true});
  return sheet;
 }
 function anchorKey(anchor){return String(anchor.__address||'').split(':')[0];}
 function colName(index){let name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
 const columnWidths=new Map(),rowHeights=new Map();
 const previous={FullName:'C:\\user.xlsx',Activate(){app._active=this;},Close(){assert.fail('user book closed');}};
 const book={FullName:'Book1',Worksheets:{get Count(){return sheets.length;},
   Item(i){return typeof i==='number'?sheets[i-1]:sheets.filter(s=>s.Name===i)[0];},
   Add(){const s=newSheet();sheets.push(s);activeSheet=s;return s;}},
  SaveAs(file,format){assert.equal(format,51);this.FullName=file;saved=true;},
  Close(save){assert.equal(save,false);closed++;},
  Activate(){app._active=this;}};
 let closed=0,saved=false;
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},ActiveWindow:{
   get ScrollRow(){return scrollRow;},
   set ScrollRow(value){if(!options.ignoreScrollRowWrite)scrollRow=value;},
   get FreezePanes(){return options.requireActiveSheet?frozenSheets.get(activeSheet)===true:frozen;},
   set FreezePanes(value){
    if(options.requireActiveSheet)frozenSheets.set(activeSheet,value===true);else frozen=value===true;
    if(value===true){
     const anchor=/^([A-Z]+)(\d+)$/.exec(selected);
     const column=anchor?Array.from(anchor[1]).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0):1;
     const inferred={row:anchor?Number(anchor[2])-1-(options.selectionFreezeOffset||0):0,column:column-1};
     const actual=options.wrongFreezePosition||explicitSplits.get(activeSheet)||inferred;
     freezePositions.set(activeSheet,options.scrolledFreezePosition&&scrollRow!==1?options.scrolledFreezePosition:actual);
    }
   },
   get SplitRow(){return options.noFreezePositionRead?undefined:(freezePositions.get(activeSheet)||{row:0}).row;},
   set SplitRow(value){if(!options.ignoreSplitWrites)explicitSplits.set(activeSheet,{...(explicitSplits.get(activeSheet)||{column:0}),row:value});},
   get SplitColumn(){return options.noFreezePositionRead?undefined:(freezePositions.get(activeSheet)||{column:0}).column;},
   set SplitColumn(value){if(!options.ignoreSplitWrites)explicitSplits.set(activeSheet,{...(explicitSplits.get(activeSheet)||{row:0}),column:value});},
   get Frozen(){return this.FreezePanes;}},
  get ActiveWorkbook(){return app._active;},Workbooks:{Count:1,Item(){return previous;},
   Add(){app._active=book;const s=newSheet();sheets.push(s);activeSheet=s;return book;},
   Open(file){
    app._active=book;
    if(options.reopenFreezePosition)freezePositions.forEach((_,sheet)=>freezePositions.set(sheet,options.reopenFreezePosition));
    if(options.loseFreezeOnReopen){frozen=false;frozenSheets.clear();}
    if(options.validationLiteralOnReopen)ranges.forEach(function(range){
     if(range.Validation.Type===3)range.Validation.Formula1='"'+String(range.Validation.Formula1).replace(/^=/,'')+'"';
    });
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
  isFrozen(name){return frozenSheets.get(sheets.find(sheet=>sheet.Name===name))===true;},
  loadFileFreeze(plan){for(const item of plan){if(!item.freeze)continue;const sheet=sheets.find(s=>s.Name===item.name);frozenSheets.set(sheet,true);freezePositions.set(sheet,{row:item.freeze.row-1,column:item.freeze.column-1});}},
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

test('询价抬头区域字体字号、居中及行高写入并保存重开核验',()=>{
 const lm=require('../src/workbook-layout.js'),spec=lm.build({columns:[{index:1},{index:2}],
  rows:[{index:1,height:48}],merges:[{row:1,column:1,columnSpan:2}],
  fonts:[{row:1,column:1,columnSpan:2,name:'宋体',size:24,bold:true}],
  alignments:[{row:1,column:1,columnSpan:2,horizontal:'center',vertical:'center'}]});
 const model={sheets:[{name:'询价',values:[['示例公司','']],layout:spec}]},h=layoutFixture();
 host.write(h.app,model,'C:\\temp\\rfq-layout.xlsx');
 const range=h.sheets[0].Range('A1:B1');
 assert.equal(range.Font.Name,'宋体');assert.equal(range.Font.Size,24);
 assert.equal(range.HorizontalAlignment,-4108);assert.equal(range.VerticalAlignment,-4108);
 assert.equal(h.sheets[0].Rows.Item(1).RowHeight,48);
 for(const [corrupt,pattern] of [
  [r=>{r.Font.Size=10;},/字号读回/],
  [r=>{r.HorizontalAlignment=-4131;},/对齐读回/],
  [r=>{r.Font.Name='其他字体';},/字体名称读回/]]){
  const fault=layoutFixture(),open=fault.app.Workbooks.Open;
  fault.app.Workbooks.Open=function(...args){const book=open(...args);corrupt(fault.sheets[0].Range('A1:B1'));return book;};
  assert.throws(()=>host.write(fault.app,model,'C:\\temp\\rfq-layout.xlsx'),pattern);
 }
});
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
 // R12-J 真机（2026-10-02）纠正：中文表名再加单引号会被 WPS JSA 存成字面量（下拉失效），
 // 简单名称必须不加引号，宿主才会存成区域引用。
 assert.equal(h.validations['H4'],"=内部选项!$A$1:$A$5",'分类下拉用区域引用，避免类别名被拆开');
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','用户工作簿保持活动');
 assert.equal(h.app.AutomationSecurity,1,'宏安全设置恢复');
});

// 2026-10-11（图04/05变更）：分类工作簿由“每类一份文件”改为一本多页——一次写入第 1 页汇总页＋逐类页，
// 页名＝类别名，汇总页“名称”列改为文件内跳转（地址留空、SubAddress＝页名!A1）。
function multiPagePlan(){
  function page(categoryId,categoryName,sheetName,rows){
    return {categoryId:categoryId,categoryName:categoryName,sheetName:sheetName,rowCount:rows.length,
      rowIds:rows.map(function(row,index){return 'r-'+categoryId+'-'+index;}),
      rows:rows.map(function(row,index){
        return {rowId:'r-'+categoryId+'-'+index,index:String(index+1),code:row[0],name:row[1],feature:row[2],
          unit:row[3],quantity:row[4],scopeId:'combined',categoryId:categoryId,categoryName:categoryName};})};
  }
  const files=[
   page('pump','水泵','水泵',[['SB-001','水泵','DN50','台','2'],['SB-002','水泵','DN65','台','3']]),
   page('valve','阀门','阀门',[['FM-001','阀门','DN50','个','20'],['FM-002','阀门','DN65','个','12']]),
   page('fan','风机','风口、风阀',[['FJ-001','送风机','规格A','台','2'],['FJ-002','排风机','规格B','台','3']]),
   page('ev-charger','汽车充电桩','汽车充电桩',[['CD-101','充电桩配电箱','充电桩配套','台','1']])];
  const directory='C:\\out\\示例园区\\分类工作簿';
  return {file:'示例园区_分类工作簿.xlsx',directory:directory,path:directory+'\\示例园区_分类工作簿.xlsx',
   sheets:files.map(function(entry){return {categoryId:entry.categoryId,categoryName:entry.categoryName,
     sheetName:entry.sheetName,rowCount:entry.rowCount,rowIds:entry.rowIds.slice()};}),files:files};
}
test('一本多页：一次写入“第 1 页汇总＋逐类页”，页名＝类别名，名称列是文件内跳转',()=>{
  const books=require('../src/category-workbooks.js'),brandModel=require('../src/brand-model.js');
  const plan=multiPagePlan();
  const summaryPlan=brandModel.summaryPlan(plan.files.map(function(entry){
    return {categoryId:entry.categoryId,categoryName:entry.categoryName,rowCount:entry.rowCount,sheetName:entry.sheetName};}),
    {directory:plan.directory,inputKey:'ck2-multipage',layout:'combined',projectName:'示例园区',internal:true});
  assert.equal(summaryPlan.ok,true,(summaryPlan.issues[0]||{}).message);
  const summary=brandModel.buildSummary(summaryPlan,{});
  const h=layoutFixture();
  const model=books.writeAll(h.app,plan,'C:\\temp\\rfq-layout.xlsx',{summarySheet:summary.sheets[0]});
  assert.deepEqual(model.sheets.map(sheet=>sheet.name),
    ['分类汇总表','水泵','阀门','风口、风阀','汽车充电桩'],'第 1 页是汇总页，其后每类一页且页名＝类别名');
  assert.deepEqual(h.sheets.map(sheet=>sheet.Name),
    ['分类汇总表','水泵','阀门','风口、风阀','汽车充电桩'],'页顺序与页名真正落到宿主工作表上');
  // 同格布局：第 1 行标题、第 4 行表头、第 5 行起一类一行；名称列是内部跳转。
  assert.deepEqual(h.links['B5'].map(item=>[item.Address,item.SubAddress,item.TextToDisplay]),
    [['',"水泵!A1",'水泵']],'名称列地址留空、SubAddress 指向同一本工作簿的对应页 A1');
  assert.deepEqual(h.links['B6'].map(item=>item.Address),[''],'不指向任何外部文件');
  assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','用户工作簿保持活动');
  assert.equal(h.app.AutomationSecurity,1,'宏安全设置恢复');
  // 逐类页仍是公开10列＋隐藏rowId，品牌/报价/金额留空；页名含顿号也照样独立成页。
  const fanSheet=h.sheets.find(sheet=>sheet.Name==='风口、风阀');
  const fanValues=fanSheet.Range('A1:K3').Value2;
  assert.equal(fanValues.length,3,'表头＋2行材料');
  assert.equal(fanValues.slice(1).every(row=>row[6]===''&&row[7]===''&&row[8]===''),true,'品牌/报价单价/金额留空');
  assert.equal(fanValues.slice(1).every(row=>!!row[10]),true,'每页仍带隐藏rowId列');
  // 跳转被写成外部地址或指错页：整本拒绝保存，不产出“看起来能跳”的文件。
  const external=layoutFixture({rewriteLinkAddress:(address)=>address===''?'C:\\out\\别的册.xlsx':address});
  assert.throws(()=>books.writeAll(external.app,plan,'C:\\temp\\rfq-layout.xlsx',{summarySheet:summary.sheets[0]}),
    /文件内跳转被写成外部地址|文件内跳转读回不一致/);
  assert.equal(external.app.ActiveWorkbook.FullName,'C:\\user.xlsx','核对失败也必须把用户工作簿恢复为活动簿');
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

function freezeBook(){
 const layout=require('../src/workbook-layout.js');
 const values=[['标题',''],['说明',''],['字段一','字段二'],['值一','值二']];
 return {sheets:[{name:'汇总',values,layout:layout.build({columns:[{index:1},{index:2}],freeze:{row:4,column:1}},
  {rowCount:4,columnCount:2})},{name:'明细',values,layout:layout.build({columns:[{index:1},{index:2}],freeze:{row:2,column:2}},
  {rowCount:4,columnCount:2})}]};
}

test('file freeze never calls native pane setters and strictly reopens the finalized stage',async()=>{
 assert.equal(typeof host.writeWithFileFreeze,'function');
 const h=layoutFixture({requireActiveSheet:true}),book=freezeBook(),before=JSON.stringify(book),window=h.app.ActiveWindow;
 for(const key of ['FreezePanes','SplitRow','SplitColumn','ScrollRow']){
  const descriptor=Object.getOwnPropertyDescriptor(window,key);Object.defineProperty(window,key,{get:descriptor.get,set(){throw Error('native pane setter must not be called');}});
 }
 let calls=0;await host.writeWithFileFreeze(h.app,book,'C:\\temp\\rfq-layout.xlsx',async plan=>{
  calls++;assert.equal(h.saved,true);assert.ok(h.closed>=2,'stage must be saved and closed before file processing');
  assert.deepEqual(plan,[{name:'汇总',freeze:{row:4,column:1}},{name:'明细',freeze:{row:2,column:2}}]);h.loadFileFreeze(plan);
 });
 assert.equal(calls,1);assert.equal(JSON.stringify(book),before);assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx');assert.equal(h.app.AutomationSecurity,1);
});
test('file freeze rejects processing failure, missing panes and changed values before publication',async()=>{
 assert.equal(typeof host.writeWithFileFreeze,'function');
 for(const arm of ['processing','missing','values']){
  const h=layoutFixture({requireActiveSheet:true});await assert.rejects(host.writeWithFileFreeze(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx',async plan=>{
   if(arm==='processing')throw Error('file processing failed');if(arm==='missing')return;
   h.loadFileFreeze(plan);h.sheets[0].Range('A1:B4').value[3][0]='changed';
  }),/processing failed|冻结|不一致/);
  assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx');assert.equal(h.app.AutomationSecurity,1);
 }
});
test('文本被宿主改写时指出首个差异单元格及期望/读回值',()=>{
 const h=layoutFixture({corruptQuotedText:true});
 const book={sheets:[{name:'分类汇总表',values:[['名称','跳转'],['风口、风阀',"'风口、风阀'!A1"]]}]};
 assert.throws(()=>host.write(h.app,book,'C:\\temp\\rfq-layout.xlsx'),
  /保存值与预览不一致.*B2.*期望.*读回/);
 assert.equal(h.saved,false);
});
test('F5：JSA吞掉首引号时保留汇总跳转原文，跨块写入与保存重开均逐值一致',()=>{
 const values=Array.from({length:502},(_,r)=>Array.from({length:13},(_,c)=>r===0?'字段'+c:''));
 values[16][11]="'风口、风阀'!A1";
 values[500][11]="'甲''乙'!A1";
 values[501][0]="''两引号原文";
 values[501][1]='000123';values[501][2]='=1+1';values[501][3]='12345678901234567890.1';
 const book={sheets:[{name:'分类汇总表',values}]},before=JSON.stringify(book);
 for(const stripFirstQuote of [false,true]){
  const h=layoutFixture({stripFirstQuote});
  assert.doesNotThrow(()=>host.write(h.app,book,'C:\\temp\\rfq-layout.xlsx'));
  assert.equal(h.saved,true);
  assert.deepEqual(h.sheets[0].Range('A1:M500').Value2,values.slice(0,500));
  assert.deepEqual(h.sheets[0].Range('A501:M502').Value2,values.slice(500));
 }
 assert.equal(JSON.stringify(book),before,'输出修复不得改掉模型中的原始跳转或材料文本');
});
test('冻结标志为true但位置错误时拒绝保存',()=>{
 const h=layoutFixture({wrongFreezePosition:{row:1,column:0}});
 assert.throws(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'),error=>{
  assert.match(error.message,/冻结.*位置.*不一致/);
  assert.match(error.message,/阶段=写入冻结/);
  assert.match(error.message,/设置行后.*设置列后.*启用后/);
  return true;
 });
 assert.equal(h.saved,false,'A4被宿主收缩成A2时不得保存并继续发布');
});

test('selection-derived freeze offset is avoided by explicit row and column splits',()=>{
 const h=layoutFixture({requireActiveSheet:true,selectionFreezeOffset:1});
 assert.doesNotThrow(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'));
 assert.equal(h.saved,true);
 assert.equal(h.isFrozen('汇总'),true);
 assert.equal(h.isFrozen('明细'),true);
});

test('ignored explicit freeze placement still blocks publication when the selected split is wrong',()=>{
 const h=layoutFixture({selectionFreezeOffset:1,ignoreSplitWrites:true});
 assert.throws(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'),/冻结.*位置.*不一致/);
 assert.equal(h.saved,false);
});

test('F5: selecting past a tall row must not shift the frozen header after enabling panes',()=>{
 const h=layoutFixture({requireActiveSheet:true,selectionScrollRow:8,scrolledFreezePosition:{row:1,column:0}});
 assert.doesNotThrow(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'));
 assert.equal(h.saved,true);
 assert.equal(h.isFrozen('汇总'),true);
 assert.equal(h.isFrozen('明细'),true);
});

test('F5: a host that ignores scroll restoration still cannot publish a shifted frozen header',()=>{
 const h=layoutFixture({selectionScrollRow:8,scrolledFreezePosition:{row:1,column:0},ignoreScrollRowWrite:true});
 assert.throws(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'),/冻结.*位置.*不一致/);
 assert.equal(h.saved,false);
});
test('每页保存重开后冻结位置或标志丢失时不报告生成成功',()=>{
 for(const options of [{requireActiveSheet:true,reopenFreezePosition:{row:1,column:0}},
  {requireActiveSheet:true,loseFreezeOnReopen:true}]){
  const h=layoutFixture(options);
  assert.throws(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'),error=>{
   assert.match(error.message,/冻结.*(位置.*不一致|未生效)/);
   assert.match(error.message,/阶段=保存重开/);
   return true;
  });
  assert.equal(h.saved,true,'该失败来自真实写入后的重开核对边界');
 }
 const valid=layoutFixture({requireActiveSheet:true});
 assert.doesNotThrow(()=>host.write(valid.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'),
  '汇总A4和明细B2须逐页激活核对，不能按最后活动页核所有页');
});
test('无法读回冻结位置时明确拒绝保存',()=>{
 const h=layoutFixture({noFreezePositionRead:true});
 assert.throws(()=>host.write(h.app,freezeBook(),'C:\\temp\\rfq-layout.xlsx'),/冻结.*位置.*(API|读回)/);
 assert.equal(h.saved,false);
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
 assert.deepEqual(sheet.Range('A1:J8').Value2,model.sheets[0].values,'公开值逐格写回且与模型一致');
 assert.equal(sheet.Range('A1:H1').MergeCells,true,'公司名居中合并左侧');
 assert.equal(sheet.Range('I1:J1').MergeCells,true,'询价合并右侧');
 assert.equal(sheet.Columns.Item(4).ColumnWidth,46,'项目特征描述列加宽以便长特征换行');
 assert.equal(sheet.Rows.Item(6).Font.Bold,true,'材料表头行加粗');
 assert.equal(sheet.Range('A6:J6').Interior.Color,layoutModule.toColor('#DCE6F1'),'表头浅色填充');
 assert.equal(sheet.PageSetup.PrintTitleRows,'$6:$6','打印重复表头');
 assert.equal(sheet.PageSetup.PrintArea,'A1:J8','打印区域覆盖标题到末行');
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
 assert.equal(String(h.validations['G3']).replace(/^=/,''),"内部选项!$A$1:$A$5",'只落到G3一个区域');
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
test('已有供应商件值与SHA一致也必须核对冻结位置',async()=>{
 for(const anchor of ['A2','A4']){
  const h=verifyFixture(),sheet=h.sheets[0];
  sheet.Activate();sheet.Range(anchor).Select();h.app.ActiveWindow.FreezePanes=true;
  h.expected.layout.freeze={row:4,column:1};
  const result=await host.verifyExistingOutput(h.app,{fileId:'file-a',target:h.target},h.expected,
   ()=>Promise.resolve({exists:true,sha256:'2'.repeat(64)}));
  assert.equal(result.ok,anchor==='A4','A2不能以值或SHA相同冒充要求的A4冻结');
  if(anchor==='A2')assert.ok(result.layoutIssues.some(issue=>/冻结.*位置.*不一致/.test(issue)));
  else assert.deepEqual(result.layoutIssues,[]);
 }
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

// R12-J 真机（2026-10-02）：简单中文表名不加引号（宿主存区域引用）；名字含空格等特殊字符时才加引号。
test('下拉来源：简单表名不加引号，含空格/特殊字符的表名才加引号',()=>{
 const layoutModule=require('../src/workbook-layout.js');
 const values=layoutModule.equalize([['标题'],['序号','项目名称'],['1','水泵']],8);
 function writeWith(sheetName){
  const spec=layoutModule.build({columns:[{index:1,width:8},{index:2,width:20}],headerRows:[2],
   validations:[layoutModule.listValidation(3,2,1,1,sheetName,'$A$1:$A$5')]},{rowCount:values.length,columnCount:8});
  const h=layoutFixture();
  host.write(h.app,{sheets:[{name:'材料明细',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');
  return h.validations['B3'];
 }
 assert.equal(writeWith('内部选项'),"=内部选项!$A$1:$A$5",'简单中文表名不加引号，避免被存成字面量');
 assert.equal(writeWith("汇总 表"),"='汇总 表'!$A$1:$A$5",'含空格的表名仍需按公式语法加引号');
 assert.equal(writeWith("It's 选项"),"='It''s 选项'!$A$1:$A$5",'名称里的单引号按公式语法双写');
});

// 2026-10-11 用户要求：最终分类列保留下拉，但允许直接输入下拉以外的类别名。
test('最终分类下拉允许输入其他值：关闭校验错误提示，其他下拉不受影响',()=>{
  const layoutModule=require('../src/workbook-layout.js');
  const values=layoutModule.equalize([['示例园区_分类审核成果.xlsx'],['自动匹配仅供参考'],
   ['序号','项目名称','规格','单位','工程量','自动建议','匹配情况','最终分类','审核备注','','行标识'],
   ['1','水泵','DN50','台','2','水泵','匹配成功','水泵','','','row-1']],11);
  const spec=layoutModule.build({columns:[{index:1,width:6},{index:2,width:16},{index:3,width:22},{index:4,width:8},
    {index:5,width:10},{index:6,width:14},{index:7,width:12},{index:8,width:16},{index:9,width:20},{index:10,width:3},
    {index:11,width:26,hidden:true}],
   headerRows:[3],validations:[layoutModule.listValidation(4,8,1,1,'内部选项','$B$2:$B$7',{allowOtherInput:true})],
   metadata:{profile:'classification-review'}},{rowCount:values.length,columnCount:11});
  const h=layoutFixture();
  host.write(h.app,{sheets:[{name:'分类审核成果',values:values,layout:spec}]},'C:\\temp\\rfq-layout.xlsx');
  const validation=h.sheets[0].Range('H4:H4').Validation;
  assert.equal(validation.Type,3,'保留下拉');
  assert.equal(validation.InCellDropdown,true,'保留下拉箭头');
  assert.equal(validation.ShowError,false,'允许输入下拉以外的值');
  assert.equal(h.saved,true);
  const plain=layoutModule.build({columns:[{index:1,width:8},{index:2,width:20}],headerRows:[1],
   validations:[layoutModule.listValidation(2,2,1,1,'内部选项','$A$1:$A$5')]},{rowCount:2,columnCount:2});
  const h2=layoutFixture();
  host.write(h2.app,{sheets:[{name:'材料明细',values:[['序号','类别'],['1','阀门']],layout:plain}]},'C:\\temp\\rfq-plain.xlsx');
  assert.notEqual(h2.sheets[0].Range('B2:B2').Validation.ShowError,false,
    '缺省下拉仍要拦住下拉以外的值（回归保护）');
});

// R12-L：跨表下拉依赖真实选项页；不能让不存在的“未来工作表”在夹具里自动成功。
function reviewWorkbookWithOptions(){
 const sample=require('./fixtures/workflow-v3-sample.cjs'),collection=require('../src/collection.js');
 const review=require('../src/classification-review-model.js');
 const groups=collection.preview(sample.buildCollection(),true).groups;
 return review.workbook(review.build(groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-options-order'}));
}

test('审核成果的跨表分类下拉在选项页实际存在后写入，并保存重开核对',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({validationRequiresExistingSheet:true,validationEchoBare:true});
 host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx');
 const main=h.book.Worksheets.Item('分类审核成果'),options=h.book.Worksheets.Item('内部选项');
 assert.equal(h.saved,true);
 assert.equal(main.Range('I4:I11').Validation.Formula1,'内部选项!$B$2:$B$7');
 assert.equal(main.Range('I4:I11').Validation.InCellDropdown,true);
 assert.deepEqual(options.Range('A1:B7').Value2,[['类别编号','类别名称'],
  ['no-inquiry','无需询价'],['pump','水泵'],['valve','阀门'],['fan','风机'],['ev-charger','汽车充电桩'],['strong-electric','强电']]);
 const first=main.Range('A1:L11').Value2[3];
 assert.deepEqual(first.slice(0,10),['1','水泵','DN50','台','2',first[5],'水泵','匹配成功','水泵','']);
 assert.match(first[5],/示例园区 \/ 给排水 \/ 清单序号待核对/);
 assert.equal(first[2],'DN50','第三列公开项目特征描述');
 assert.equal(h.app.AutomationSecurity,1);
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx');
});

test('分类下拉缺少实际选项页时拒绝保存，清理自建簿并恢复用户簿',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({validationRequiresExistingSheet:true});
 workbook.sheets=workbook.sheets.filter(sheet=>sheet.name!=='内部选项');
 assert.throws(()=>host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx'),/validation source sheet missing: 内部选项/);
 assert.equal(h.saved,false);
 assert.equal(h.closed,1);
 assert.equal(h.app.AutomationSecurity,1);
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx');
});

test('保存重开后分类来源变成带双引号字面量时拒绝假成功',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({validationEchoBare:true,validationLiteralOnReopen:true});
 assert.throws(()=>host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx'),/分类下拉读回不一致/);
 assert.equal(h.book.Worksheets.Item('分类审核成果').Range('I4:I11').Validation.Type,3,'下拉类型仍存在也不能放行');
 assert.equal(h.saved,true,'保存前回读看似相同，必须在保存重开后继续核验');
 assert.equal(h.closed,2);
 assert.equal(h.app.AutomationSecurity,1);
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx');
});

test('审核簿全部页建齐后激活公开页，再选择冻结锚点，内部页不被错误冻结',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({validationRequiresExistingSheet:true,requireActiveSheet:true});
 host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx');
 assert.equal(h.isFrozen('分类审核成果'),true);
 assert.equal(h.isFrozen('内部选项'),false);
 assert.equal(h.isFrozen('内部绑定'),false);
 assert.equal(h.saved,true);
});

test('需要冻结的审核页缺少工作表激活API时拒绝保存',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({noSheetActivation:true});
 assert.throws(()=>host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx'),/工作表激活|Worksheet.Activate/);
 assert.equal(h.saved,false);
 assert.equal(h.closed,1);
 assert.equal(h.app.AutomationSecurity,1);
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx');
});

// F1：内部选项/内部绑定必须在生成时真的隐藏（保存重开仍隐藏），公开审核页与跨表下拉不受影响。
test('F1生成审核成果时隐藏内部页，重开读回仍隐藏且下拉仍指向选项页',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({validationRequiresExistingSheet:true,validationEchoBare:true});
 host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx');
 assert.equal(h.saved,true);
 assert.notEqual(h.book.Worksheets.Item('分类审核成果').Visible,0,'公开审核页必须可见');
 assert.equal(h.book.Worksheets.Item('内部选项').Visible,0,'内部选项页必须隐藏');
 assert.equal(h.book.Worksheets.Item('内部绑定').Visible,0,'内部绑定页必须隐藏');
 assert.equal(h.book.Worksheets.Item('分类审核成果').Range('I4:I11').Validation.Formula1,'内部选项!$B$2:$B$7',
  '隐藏选项页仍是分类下拉来源');
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','隐藏内部页不得打乱用户活动工作簿');
});
test('F1宿主不支持或静默忽略工作表隐藏时明确失败，不产出未隐藏的内部页',()=>{
 const workbook=reviewWorkbookWithOptions(),h=layoutFixture({sheetVisibilityIgnored:true,validationEchoBare:true});
 assert.throws(()=>host.write(h.app,workbook,'C:\\temp\\rfq-layout.xlsx'),/未隐藏|工作表隐藏/);
 assert.equal(h.saved,false,'隐藏未落地不得保存成果表');
 assert.equal(h.app.AutomationSecurity,1,'失败后仍要恢复宏安全值');
 assert.equal(h.app.ActiveWorkbook.FullName,'C:\\user.xlsx','失败后不得留下用户簿被置后');
});
