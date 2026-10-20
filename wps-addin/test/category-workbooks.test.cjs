const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const reviewModel=require('../src/classification-review-model.js');
const reviewHost=require('../src/classification-review-host.js');
const books=require('../src/category-workbooks.js');

// 合成样例：10输入→合并8→7询价＋1无需询价→4分类文件2/2/2/1行（handoff 6.1）。
function confirmed(){
  const preview=collection.preview(sample.buildCollection(),true);
  const result=reviewModel.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'});
  const binding=reviewHost.bindingFor({target:'C:\\out\\示例园区\\示例园区_分类审核成果.xlsx',sha256:'a'.repeat(64)},
    result,{inputKey:'ck2-0123456789abcdef'});
  // 图03口径的整表确认：充电桩配电箱由用户在表内改选“汽车充电桩”，钢索保留“无需询价”。
  const rows=result.rows.map(row=>{
    const conflict=row.matchState===reviewModel.STATE.conflict;
    return {rowId:row.rowId,index:String(row.index),name:row.name,feature:row.feature,unit:row.unit,quantity:row.quantity,
      autoCategoryName:reviewModel.autoLabel(row),
      categoryId:conflict?'ev-charger':row.finalCategoryId,categoryName:conflict?'汽车充电桩':row.finalCategoryName,
      skip:!conflict&&row.finalCategoryId==='no-inquiry',note:conflict?'充电桩配套':'',match:'存在差异'};
  });
  return {result,binding,rows,confirmation:reviewModel.confirmation(rows,{projectId:'p-sample01',
    inputKey:'ck2-0123456789abcdef',libraryVersion:sample.library.version,binding,revision:1})};
}
const ROOT='C:\\out\\示例园区';
const DIRECTORY=books.workbookDirectory(ROOT);
function planned(overrides){
  const {binding,confirmation}=confirmed();
  return books.plan(confirmation,Object.assign({binding,directory:DIRECTORY,inputKey:'ck2-0123456789abcdef',root:ROOT,
    projectName:'示例园区'},overrides));
}
function renamedCategory(confirmation,categoryId,name){
  return Object.assign({},confirmation,{rows:confirmation.rows.map(row=>
    row.categoryId===categoryId?Object.assign({},row,{categoryName:name}):row)});
}

test('批次目录：成果表所在目录＋分类工作簿子目录，路径非法时明确拒绝',()=>{
  assert.equal(books.rootOf('C:\\out\\示例园区\\示例园区_分类审核成果.xlsx'),ROOT);
  assert.equal(books.rootOf('C:/out/示例园区/示例园区_分类审核成果.xlsx'),ROOT);
  assert.equal(books.batchDirectory('C:\\out\\示例园区\\示例园区_分类审核成果.xlsx'),DIRECTORY);
  assert.equal(books.workbookDirectory('C:\\out\\示例园区\\'),DIRECTORY);
  assert.throws(()=>books.batchDirectory('相对路径\\成果.xlsx'),/成果批次目录无效/);
  assert.equal(books.safeName('水泵/阀门'),'水泵_阀门');
  assert.equal(books.safeName('  汽车充电桩  '),'汽车充电桩');
  assert.equal(books.safeName('..'),'未命名类别');
  assert.equal(books.fileNameFor('汽车充电桩'),'汽车充电桩.xlsx');
});

test('plan：询价类别分组在前、无需询价保留为最后明细页，rowId/scopeId和数量不变',()=>{
  const plan=planned();
  assert.deepEqual(plan.issues,[]);
  assert.equal(plan.ok,true);
  assert.deepEqual(plan.counts,{categories:4,inquiryRows:7,noInquiryRows:1,totalRows:8});
  // 一本多页：逐类条目共用同一个工作簿文件；页名＝类别名，行数与图04一致。
  assert.deepEqual(plan.files.map(file=>[file.categoryName,file.sheetName,file.rowCount]),
    [['水泵','水泵',2],['阀门','阀门',2],['风机','风机',2],['汽车充电桩','汽车充电桩',1]]);
  assert.equal(plan.file,'示例园区_分类工作簿.xlsx','文件名＝<项目名称>_分类工作簿.xlsx');
  assert.equal(plan.path,DIRECTORY+'\\'+plan.file);
  assert.deepEqual(plan.files.map(file=>file.file),['示例园区_分类工作簿.xlsx','示例园区_分类工作簿.xlsx','示例园区_分类工作簿.xlsx','示例园区_分类工作簿.xlsx'],
    '所有类别页都写进这一本工作簿');
  assert.deepEqual(plan.files.map(file=>file.path),[plan.path,plan.path,plan.path,plan.path]);
  assert.deepEqual(plan.sheets.map(sheet=>[sheet.sheetName,sheet.rowCount]),[['水泵',2],['阀门',2],['风机',2],['汽车充电桩',1],['无需询价',1]]);
  const pump=plan.files[0];
  assert.equal(pump.rowIds.length,2);
  assert.equal(pump.rows.every(row=>!!row.rowId),true,'rowId必须保留，供汇总/询价关联');
  assert.equal(pump.rows.every(row=>row.scopeId==='combined'),true,'来源边界必须保留');
  assert.equal(pump.rows.every(row=>row.categoryId==='pump'),true);
  assert.deepEqual(pump.rows.map(row=>[row.index,row.name,row.feature,row.unit,row.quantity]),
    [['1','水泵','DN50','台','2'],['2','水泵','DN65','台','3']],'序号按本类重排，合并数量2/3不翻倍');
  assert.equal(plan.files.some(file=>file.categoryId==='no-inquiry'),false,'无需询价不进入品牌/询价类别文件');
  assert.equal(plan.noInquiry.sheetName,'无需询价');
  assert.equal(plan.noInquiry.rowCount,1);
  assert.equal(plan.noInquiry.rows[0].name,'钢索','无需询价末页保留原行供复核');
  assert.equal(plan.noInquiry.rows[0].note,'无需询价');
  assert.deepEqual(plan.files[3].rows.map(row=>[row.name,row.feature,row.quantity]),[['充电桩配电箱','充电桩配套','1']]);
});

test('plan先检查全部目标：缺绑定、缺类别、行标识不属于本次绑定、清洗后重名都阻断',()=>{
  const {binding,confirmation}=confirmed();
  assert.throws(()=>books.plan(confirmation,{directory:DIRECTORY}),/内部绑定/);
  assert.throws(()=>books.plan({rows:[]},{binding,directory:DIRECTORY}),/已确认的整表审核结果/);
  assert.throws(()=>books.plan(confirmation,{binding,directory:'相对目录'}),/目录无效/);
  const empty=books.plan({rows:confirmation.rows.map(row=>Object.assign({},row,
    {categoryId:row.skip?'no-inquiry':'',categoryName:row.skip?'无需询价':'',skip:row.skip}))},
    {binding,directory:DIRECTORY,root:ROOT});
  assert.equal(empty.ok,false);
  assert.deepEqual(empty.issues.map(item=>item.code).filter((code,index,list)=>list.indexOf(code)===index),['category-missing']);
  const unknown=books.plan({rows:confirmation.rows.map(row=>Object.assign({},row,{rowId:row.rowId+'-x'}))},
    {binding,directory:DIRECTORY,root:ROOT});
  assert.equal(unknown.ok,false);
  assert.equal(unknown.issues[0].code,'row-id-unknown');
  const illegals=books.plan(renamedCategory(confirmation,'pump','水泵/阀门'),{binding,directory:DIRECTORY,root:ROOT});
  assert.equal(illegals.ok,true);
  assert.equal(illegals.files[0].sheetName,'水泵_阀门','非法页名字符必须清洗');
  assert.equal(illegals.files[0].categoryFile,'水泵_阀门.xlsx','类别文件名仍按同一清洗规则（用于重名检查）');
  const clash=books.plan(renamedCategory(renamedCategory(confirmation,'pump','水泵 1'),'valve','水泵 1'),
    {binding,directory:DIRECTORY,root:ROOT});
  assert.equal(clash.ok,false,'两个类别清洗后同名必须在写第一份前阻断');
  assert.equal(clash.issues[0].code,'name-collision');
  assert.equal(clash.files.length,4,'仍返回完整清单供侧栏展示，但ok=false不放行');
});

test('每类一个工作簿：单一“材料明细”页、10个公开列、品牌/报价/金额留空、K列隐藏rowId',()=>{
  const plan=planned(),pump=books.workbook(plan.files[0]);
  assert.equal(pump.sheets.length,1,'一个类别一个工作簿，不是一个工作簿多个分类页');
  assert.equal(pump.sheets[0].name,'材料明细');
  assert.deepEqual(pump.sheets[0].values[0].slice(0,10),books.COLUMNS);
  assert.deepEqual(books.COLUMNS,['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注']);
  assert.equal(pump.sheets[0].values.every(row=>row.length===11),true,'等宽矩阵：公开10列＋K列隐藏rowId');
  assert.deepEqual(pump.sheets[0].values[1].slice(0,10),
    ['1','SB-001','水泵','DN50','台','2','','','',''],'品牌/报价单价/金额留空');
  assert.deepEqual(pump.sheets[0].values[2].slice(0,10),
    ['2','SB-002','水泵','DN65','台','3','','','',''],'合并行编码取首个来源（给排水清单SB-002）');
  assert.equal(pump.sheets[0].values[1][10],plan.files[0].rows[0].rowId,'K列保存随行rowId');
  const spec=pump.sheets[0].layout;
  assert.equal(spec.metadata.profile,'category-workbook');
  assert.equal(spec.metadata.categoryId,'pump');
  assert.equal(spec.metadata.rowIdColumn,books.ROW_ID_COLUMN);
  assert.equal(spec.columns.filter(column=>column.hidden===true).length,1);
  assert.equal(spec.columns[books.ROW_ID_COLUMN-1].hidden,true);
  assert.equal(spec.freeze.row,2);
  assert.equal(spec.print.repeatRow,1);
  assert.equal(spec.fills.length,1);
  assert.deepEqual(spec.merges,[]);
  assert.deepEqual(plan.files.map(file=>books.mainSheet(file).values.length-1),[2,2,2,1],'4份文件2/2/2/1行');
  assert.deepEqual(books.mainSheet(plan.files[3]).values[1].slice(0,10),
    ['1','CD-101','充电桩配电箱','充电桩配套','台','1','','','','']);
  assert.equal(plan.files.every(file=>books.workbook(file).sheets[0].layout.metadata.lastRow===file.rowCount+1),true);
  // 持久回执只存rowId/路径/SHA/状态，缺少材料行时必须明确拒绝，而不是写出空表。
  assert.throws(()=>books.mainSheet({categoryId:'pump',categoryName:'水泵',rowIds:['a'],rowCount:2}),/缺少材料行/);
  assert.throws(()=>books.write({},books.receipt(plan,{}).files[0],'C:\\stage\\x.xlsx'),/缺少材料行/,
    '持久回执记录不含材料行，直接写入必须明确拒绝');
});

test('receipt/summarize：逐页未完成不算完成，整本通过才complete，全部无需询价为空批次',()=>{
  const plan=planned(),receipt=books.receipt(plan,{layout:'separated',
    summary:{sheetName:'分类汇总表',rowCount:9}});
  assert.equal(receipt.status,'pending');
  assert.equal(receipt.files.length,4);
  assert.equal(receipt.file,plan.file);
  assert.equal(receipt.path,plan.path);
  assert.deepEqual(receipt.sheets.map(sheet=>[sheet.sheetName,sheet.rowCount,sheet.isSummary===true,sheet.status]),
    [['分类汇总表',9,true,'pending'],['水泵',2,false,'pending'],['阀门',2,false,'pending'],
     ['风机',2,false,'pending'],['汽车充电桩',1,false,'pending'],['无需询价',1,false,'pending']],
    '第 1 页＝汇总页，询价类别各一页，无需询价在最后，逐页都待生成');
  assert.deepEqual(receipt.counts,{categories:4,inquiryRows:7,noInquiryRows:1,totalRows:8});
  assert.equal(receipt.files.every(file=>file.status==='pending'&&file.sha256===null),true);
  assert.deepEqual(receipt.files[0].rowIds,plan.files[0].rowIds);
  assert.equal(books.summarize(receipt).status,'pending');
  assert.equal(books.statusOf(receipt),'pending');
  // 只把第 1 页（汇总页）标成功：还有类别页未通过，绝不能显示全部完成。
  receipt.sheets[0].status='succeeded';
  const half=books.summarize(receipt);
  assert.equal(half.status,'partial','逐页有未完成绝不能显示全部完成');
  assert.equal(books.statusOf(receipt),'partial','回执状态必须与逐页的真实状态一致');
  assert.equal(half.generated,1);
  assert.equal(half.categories,4,'categories 只数类别页');
  assert.equal(half.pages,6,'pages 含汇总页和无需询价页');
  assert.equal(half.noInquiryPages,1);
  assert.equal(half.text,'分类工作簿已生成（1 本 · 4 类 · 无需询价1页）');
  assert.equal(half.detail,'7 行纳入询价 · 1 行无需询价');
  // 整本一次写入：所有页与整文件一起成功/失败。
  receipt.sha256='c'.repeat(64);receipt.bytes=1234;
  books.setSheetsStatus(receipt,'succeeded');
  assert.equal(receipt.status,'complete');
  assert.equal(books.summarize(receipt).status,'complete');
  assert.equal(receipt.sheets.every(sheet=>sheet.status==='succeeded'),true);
  assert.equal(receipt.files.every(file=>file.status==='succeeded'&&file.sha256==='c'.repeat(64)),true,
    '整本写入成功后逐份记录同步指向同一个文件SHA');
  books.setSheetsStatus(receipt,'failed','写入失败');
  assert.equal(books.summarize(receipt).failed,6);
  assert.equal(books.statusOf(receipt),'pending','整本失败时回执不得写complete');
  assert.equal(books.statusOf({files:[],counts:{inquiryRows:0}}),'empty');
  assert.equal(books.statusOf({files:[],counts:{inquiryRows:7}}),'pending');
  const {binding,confirmation}=confirmed();
  const none=books.plan({rows:confirmation.rows.filter(row=>row.skip&&row.categoryId==='no-inquiry')},
    {binding,directory:DIRECTORY,root:ROOT});
  assert.equal(none.files.length,0);
  assert.equal(none.noInquiry,null,'没有询价类别时不生成半本分类工作簿');
  assert.equal(books.summarize(books.receipt(none,{})).status,'empty');
  assert.equal(books.summarize(null).status,'empty');
});

test('一本多页写入把无需询价放在最后，页面内保留十列并明确标注',()=>{
  const plan=planned(),fixture=fakeApp(),stage='C:\\stage\\all.xlsx';
  books.writeAll(fixture.app,plan,stage,{});
  const stored=fixture.state.written[stage];
  assert.equal(stored.length,5);
  assert.equal(stored[4].name,'无需询价');
  assert.deepEqual(stored[4].values[1].slice(0,10),
    ['1','GS-001','钢索','规格C','m','10','','','','无需询价']);
});

test('绑定必须带项目编码与来源边界：R6从成果表内部绑定取编码/scopeId',()=>{
  const {binding,result}=confirmed();
  assert.equal(binding.fields.length,result.rows.length);
  assert.equal(binding.fields.every(field=>typeof field.code==='string'),true);
  assert.equal(binding.fields.every(field=>field.scopeId==='combined'),true,'R6需要按rowId取来源边界');
  assert.equal(binding.fields.every(field=>field.sourceIds.length>0),true);
  assert.deepEqual(planned().files[1].rows.map(row=>row.code),['FM-001','FM-002']);
});

// 模拟宿主：只实现export-host真正用到的API，用来验证逐份写入、版式落地与重开读回。
function fakeApp(){
  const state={created:0,opened:0,closed:0,saved:[],written:{}};
  let active=null,lastSaved=null,activeSheet=null,frozen=false;
  const previous={FullName:'C:\\user.xlsx',Activate(){active=this;},Close(){assert.fail('user book closed');}};
  active=previous;
  function newSheet(name){
    const ranges=new Map(),columns=new Map(),rows=new Map();
    const sheetState={written:null,address:null};
    function range(address){
      if(ranges.has(address))return ranges.get(address);
      const target={NumberFormat:'',value:null,WrapText:null,HasFormula:false,MergeCells:false,
        Font:{Size:null,Bold:false},Rows:{AutoFit(){}},Interior:{Color:null},
        Select(){assert.equal(activeSheet,sheet,'只能在当前工作表选择冻结锚点');this.selected=true;
          const match=/^([A-Z]+)(\d+)$/.exec(address);
          sheet.__freeze={row:Number(match[2])-1,column:Array.from(match[1]).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1};},
        Merge(){this.MergeCells=true;},
        get Value2(){return this.value;},
        set Value2(values){
          this.value=values.map(row=>row.slice());
          if(Array.isArray(values)&&values.length){sheetState.written=this.value;sheetState.address=address;}
        }};
      ranges.set(address,target);return target;
    }
    const sheet={Name:name||'Sheet',Activate(){activeSheet=sheet;},Range:range,
      Cells:{Item(row,column){return range(columnName(column)+row);}},
      Columns:{Item(index){
        if(!columns.has(index))columns.set(index,{ColumnWidth:null,Hidden:false});
        return columns.get(index);}},
      Rows:{Item(index){
        if(!rows.has(index))rows.set(index,{RowHeight:null,Font:{Bold:false},AutoFit(){}});
        return rows.get(index);}},
      PageSetup:{PrintArea:null,PrintTitleRows:null},
      __ranges:ranges,__columns:columns,__rows:rows,__state:sheetState};
    return sheet;
  }
  function makeBook(){
    const sheets=[newSheet('Sheet1')];
    activeSheet=sheets[0];
    return {FullName:'Book'+state.created,
      Worksheets:{get Count(){return sheets.length;},
        Item(requested){return typeof requested==='number'?sheets[requested-1]:sheets.filter(s=>s.Name===requested)[0];},
        Add(){const sheet=newSheet('Sheet');sheets.push(sheet);activeSheet=sheet;return sheet;}},
      SaveAs(file,format){
        assert.equal(format,51,'必须以xlsx格式独占保存');
        this.FullName=file;lastSaved=this;state.saved.push(file);
        state.written[file]=sheets.map(sheet=>({name:sheet.Name,
          values:sheet.__state.written,address:sheet.__state.address,
          columns:sheet.__columns,rows:sheet.__rows}));
      },
      Close(save){assert.equal(save,false);state.closed++;},
      Activate(){active=this;},
      __sheets:sheets};
  }
  const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},
    get ActiveWorkbook(){return active;},ActiveWindow:{
      get SplitRow(){return (activeSheet.__freeze||{row:0}).row;},
      set SplitRow(value){activeSheet.__freeze={...(activeSheet.__freeze||{column:0}),row:value};},
      get SplitColumn(){return (activeSheet.__freeze||{column:0}).column;},
      set SplitColumn(value){activeSheet.__freeze={...(activeSheet.__freeze||{row:0}),column:value};},
      get FreezePanes(){return frozen;},set FreezePanes(value){
        assert.ok(activeSheet,'冻结前必须有活动工作表');frozen=value===true;state.frozenSheet=activeSheet.Name;
      }},
    Workbooks:{Count:1,Item(){return previous;},
      Add(){const book=makeBook();state.created++;active=book;return book;},
      Open(file,links,readonly){
        assert.equal(links,0);assert.equal(readonly,true);assert.equal(app.AutomationSecurity,3);
        assert.equal(file,lastSaved&&lastSaved.FullName,'必须重开刚保存的文件核对');
        state.opened++;active=lastSaved;return lastSaved;}}};
  return {app,state,previous};
}
function columnName(index){let name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}

test('逐份写入模拟宿主：4个文件各建一个新工作簿，值与版式落地并重开核对',()=>{
  const plan=planned();
  plan.files.forEach((file,index)=>{
    const fixture=fakeApp(),stage='C:\\stage\\stage-'+index+'.xlsx';
    const model=books.write(fixture.app,file,stage,{batchId:'b-1'});
    assert.equal(model.sheets.length,1);
    assert.equal(fixture.state.created,1,'每份文件单独新建一个工作簿');
    assert.equal(fixture.state.opened,1,'保存后必须重开核对');
    assert.equal(fixture.state.closed,2,'暂存簿与重开核对簿都要关闭');
    assert.equal(fixture.app.ActiveWorkbook,fixture.previous,'用户工作簿恢复为活动簿');
    assert.equal(fixture.app.AutomationSecurity,1,'宏安全值恢复');
    assert.deepEqual(fixture.state.saved,[stage]);
    const stored=fixture.state.written[stage];
    assert.equal(stored.length,1,'每个分类工作簿只有一张工作表');
    assert.equal(stored[0].name,'材料明细');
    assert.equal(fixture.state.frozenSheet,'材料明细','冻结落在分类材料页');
    assert.deepEqual(stored[0].values.slice(0,1+file.rowCount).map(row=>row.slice(0,10)),
      books.mainSheet(file).values.map(row=>row.slice(0,10)));
    assert.equal(stored[0].columns.get(books.ROW_ID_COLUMN).Hidden,true,'随行rowId列必须隐藏');
    assert.deepEqual(stored[0].columns.get(1).ColumnWidth,6);
    assert.equal(stored[0].rows.get(1).Font.Bold,true,'表头加粗');
    assert.equal(fixture.app.ActiveWindow.FreezePanes,true,'冻结窗格生效');
  });
  // 4个类别＝4个独立工作簿；一个工作簿里4张表不是本包的正确结果。
  const fixture=fakeApp();
  plan.files.forEach((file,index)=>books.write(fixture.app,file,'C:\\stage\\s'+index+'.xlsx',{}));
  assert.equal(fixture.state.created,4,'4个独立文件必须各建一个工作簿');
  assert.equal(Object.keys(fixture.state.written).length,4);
});

test('openForEditing复用已打开的同路径工作簿，未打开则只读打开并恢复宏安全值',()=>{
  const filePath='C:\\out\\示例园区\\分类工作簿\\水泵.xlsx';
  let opened=0,active=null;
  const target={Name:'水泵.xlsx',FullName:filePath,Activate(){active=this;}};
  const app={AutomationSecurity:1,Workbooks:{Count:1,
    Item(){return target;},Open(){opened++;active=target;return target;}}};
  assert.deepEqual(books.openForEditing(app,filePath),{path:filePath,opened:true,reused:true});
  assert.equal(opened,0,'已打开的同路径工作簿直接复用');
  app.Workbooks={Count:1,Item(){return null;},Open(file,links,readonly){
    assert.equal(links,0);assert.equal(readonly,false,'分类工作簿要打开供查看/后续读回');
    assert.equal(app.AutomationSecurity,3);opened++;active=target;return target;}};
  assert.deepEqual(books.openForEditing(app,filePath),{path:filePath,opened:true,reused:false});
  assert.equal(opened,1);
  assert.equal(app.AutomationSecurity,1,'宏安全值必须恢复');
  assert.equal(active,target,'分类工作簿打开后置前供查看');
  assert.throws(()=>books.openForEditing({AutomationSecurity:null,Workbooks:{Count:0}},filePath),/宏安全设置/);
  assert.throws(()=>books.openForEditing(app,'relative.xlsx'),/路径无效/);
});

test('WPS返回编码路径或规范化短路径时，仍以同名目标完成页结构读回',()=>{
  const file='C:\\out\\批次#1\\示例园区_分类工作簿.xlsx';
  function appFor(book){
    return {AutomationSecurity:1,Workbooks:{Count:1,Item(){return null;},
      Open(){assert.equal(this.Count,1);return book;}}};
  }
  function openedBook(full){
    return {Name:'示例园区_分类工作簿.xlsx',FullName:full,Worksheets:{Count:2,
      Item(index){return index===1?{Name:'分类汇总表',UsedRange:{Rows:{Count:9}}}:
        {Name:'无需询价',UsedRange:{Rows:{Count:2}}};}},Close(save){assert.equal(save,false);}};
  }
  const encoded=books.readSheets(appFor(openedBook('C:/out/批次%231/示例园区_分类工作簿.xlsx')),file);
  assert.deepEqual(encoded.map(item=>item.sheetName),['分类汇总表','无需询价']);
  const shortPath=books.readSheets(appFor(openedBook('C:\\out\\SHORT~1\\示例园区_分类工作簿.xlsx')),file);
  assert.deepEqual(shortPath.map(item=>item.sheetName),['分类汇总表','无需询价']);
  const wrong=openedBook('C:\\out\\另一批次\\另一个文件.xlsx');
  wrong.Name='另一个文件.xlsx';
  assert.throws(()=>books.readSheets(appFor(wrong),file),/WPS未返回指定分类工作簿/);
});

test('WPS已打开另一目录的同名分类工作簿时，明确提示先关闭且不借用该工作簿',()=>{
  const file='C:\\out\\批次A\\示例园区_分类工作簿.xlsx';
  const wrong={Name:'示例园区_分类工作簿.xlsx',
    FullName:'C:\\out\\批次B\\示例园区_分类工作簿.xlsx',
    Worksheets:{Count:2,Item(index){return index===1?{Name:'分类汇总表',UsedRange:{Rows:{Count:9}}}:
      {Name:'无需询价',UsedRange:{Rows:{Count:2}}};}},
    Activate(){throw Error('不得激活另一目录的同名工作簿');}};
  let opened=0;
  const app={AutomationSecurity:1,Workbooks:{Count:1,Item(){return wrong;},
    Open(){opened++;throw Error('不得触发WPS原生同名错误');}}};
  assert.throws(()=>books.openForEditing(app,file),/另一目录.*同名.*先保存并关闭/);
  assert.throws(()=>books.readSheets(app,file),/另一目录.*同名.*先保存并关闭/);
  assert.equal(opened,0,'发现另一目录同名工作簿时不得再调用Open');
});

// 2026-10-11（图04/05变更）：一本多页写入必须“有页可写”，发布后按页读回核页名与行数。
test('一本多页：空清单明确拒绝写入；发布后按页读回页名/行数，页名或行数不对都报错',()=>{
  assert.throws(()=>books.writeAll({}, planWithPages([]), 'C:\\stage\\x.xlsx', {}),/没有可写入的分类工作簿页/);
  const expected=[{sheetName:'分类汇总表',rowCount:9},{sheetName:'水泵',rowCount:3},{sheetName:'阀门',rowCount:3}],
    file='C:\\out\\示例园区\\分类工作簿\\示例园区_分类工作簿.xlsx';
  const good=sheetApp([{name:'分类汇总表',rows:9},{name:'水泵',rows:3},{name:'阀门',rows:3}]);
  const result=books.verifySheets(good,file,expected);
  assert.equal(result.ok,true,(result.issues||[]).join('；'));
  assert.deepEqual(result.sheets.map(sheet=>[sheet.sheetName,sheet.rowCount]),
    [['分类汇总表',9],['水泵',3],['阀门',3]]);
  assert.equal(good.closed,1,'读回打开的工作簿在核对后关闭');
  assert.equal(good.AutomationSecurity,1,'宏安全值恢复');
  assert.match(books.verifySheets(sheetApp([{name:'水泵',rows:3},{name:'分类汇总表',rows:9},{name:'阀门',rows:3}]),file,expected)
    .issues.join('；'),/第 1 页应为“分类汇总表”/,'汇总页必须就在第 1 页');
  assert.match(books.verifySheets(sheetApp([{name:'分类汇总表',rows:9},{name:'水泵',rows:1},{name:'阀门',rows:3}]),file,expected)
    .issues.join('；'),/“水泵”行数不足/,'少写材料行必须报错');
  assert.match(books.verifySheets(sheetApp([{name:'分类汇总表',rows:9}]),file,expected).issues.join('；'),/工作表页数不一致/);
  assert.throws(()=>books.verifySheets(good,'relative.xlsx',expected),/路径无效/);
  assert.throws(()=>books.readSheets({AutomationSecurity:null,Workbooks:{Count:0}},file),/宏安全设置/);
});
function planWithPages(files){return {file:'示例园区_分类工作簿.xlsx',path:'C:\\out\\示例园区\\分类工作簿\\示例园区_分类工作簿.xlsx',files:files};}
function sheetApp(sheets){
  const app={AutomationSecurity:1,closed:0,
    Workbooks:{Count:1,Item(){return null;},
      Open(file,links,readonly){
        assert.equal(links,0);assert.equal(readonly,true);assert.equal(app.AutomationSecurity,3);
        return {Name:String(file).split(/[\\/]/).pop(),FullName:file,Worksheets:{get Count(){return sheets.length;},
          Item(index){const sheet=sheets[index-1];return {Name:sheet.name,UsedRange:{Rows:{Count:sheet.rows}}};}},
          Close(save){assert.equal(save,false);app.closed++;}};}}};
  return app;
}
