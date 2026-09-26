const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../src/brand-model.js'),host=require('../src/brand-host.js'),layout=require('../src/workbook-layout.js');

// R7（图05A/05B）：分类汇总表一类一行、双布局、名称指向独立分类工作簿、方式下拉。
const ROOT='C:\\out\\示例园区',DIRECTORY=ROOT,CATEGORY_DIRECTORY=ROOT+'\\分类工作簿';
const CATEGORIES=[
 {categoryId:'pump',categoryName:'水泵',rowCount:2,path:CATEGORY_DIRECTORY+'\\水泵.xlsx'},
 {categoryId:'valve',categoryName:'阀门',rowCount:2,path:CATEGORY_DIRECTORY+'\\阀门.xlsx'},
 {categoryId:'fan',categoryName:'风机',rowCount:2,path:CATEGORY_DIRECTORY+'\\风机.xlsx'},
 {categoryId:'ev-charger',categoryName:'汽车充电桩',rowCount:1,path:CATEGORY_DIRECTORY+'\\汽车充电桩.xlsx'}];
const INPUT_KEY='ck2-0123456789abcdef';
function planned(overrides,layoutName){
 return model.summaryPlan(overrides||CATEGORIES,Object.assign({directory:DIRECTORY,inputKey:INPUT_KEY,
  layout:layoutName||'separated',projectName:'示例园区'},overrides?{}:{}));
}
function built(layoutName,options){
 const plan=planned(null,layoutName);
 return {plan,workbook:model.buildSummary(plan,options||{})};
}
function visibleRow(workbook,index){return workbook.sheets[0].values[index-1];}
function addr(item){
 const lastColumn=item.column+(item.columnSpan||1)-1,lastRow=item.row+(item.rowSpan||1)-1;
 return columnName(item.column)+item.row+':'+columnName(lastColumn)+lastRow;
}

test('相对链接地址：同盘符相对化、整目录搬移后地址不变、跨盘符明确拒绝',()=>{
 assert.equal(model.relativePath(DIRECTORY,CATEGORY_DIRECTORY+'\\水泵.xlsx'),'分类工作簿\\水泵.xlsx');
 assert.equal(model.relativePath('D:\\搬移后目录\\示例园区','D:\\搬移后目录\\示例园区\\分类工作簿\\水泵.xlsx'),
  '分类工作簿\\水泵.xlsx','整目录搬移后相对链接保持一致');
 assert.equal(model.relativePath('C:\\a\\b\\c','C:\\a\\x\\y.xlsx'),'..\\..\\x\\y.xlsx');
 assert.equal(model.relativePath('C:\\含 空格\\项目','C:\\含 空格\\项目\\分类工作簿\\水 泵.xlsx'),'分类工作簿\\水 泵.xlsx');
 assert.throws(()=>model.relativePath('C:\\out','D:\\out\\水泵.xlsx'),/不在同一盘符/);
});

test('plan：一类一行清单，缺类别/缺路径/重复类别/链接重名都阻断',()=>{
 const plan=planned();
 assert.equal(plan.ok,true);
 assert.deepEqual(plan.issues,[]);
 assert.equal(plan.layout,'separated');
 assert.deepEqual(plan.categories.map(item=>[item.categoryId,item.categoryName,item.rowCount,item.relative]),
  [['pump','水泵',2,'分类工作簿\\水泵.xlsx'],['valve','阀门',2,'分类工作簿\\阀门.xlsx'],
   ['fan','风机',2,'分类工作簿\\风机.xlsx'],['ev-charger','汽车充电桩',1,'分类工作簿\\汽车充电桩.xlsx']]);
 assert.throws(()=>model.summaryPlan(CATEGORIES,{directory:'相对目录'}),/目录无效/,'目录非法必须阻断');
 assert.throws(()=>model.summaryPlan([],{directory:DIRECTORY}),/没有需要询价的类别/);
 const missing=model.summaryPlan(CATEGORIES.map((item,index)=>index===1?Object.assign({},item,{path:''}):item),
  {directory:DIRECTORY});
 assert.equal(missing.ok,false);
 assert.equal(missing.issues[0].code,'category-path-invalid');
 const dup=model.summaryPlan(CATEGORIES.concat([CATEGORIES[0]]),{directory:DIRECTORY});
 assert.equal(dup.ok,false);
 assert.equal(dup.issues[0].code,'category-duplicate');
 const collide=model.summaryPlan(CATEGORIES.map((item,index)=>index===1?Object.assign({},item,{categoryName:'水泵（别名）',path:CATEGORY_DIRECTORY+'\\水泵.xlsx'}):item),
  {directory:DIRECTORY});
 assert.equal(collide.ok,false);
 assert.equal(collide.issues[0].code,'category-name-collision');
 assert.throws(()=>model.buildSummary({ok:false,issues:[{title:'类别名称为空',message:'缺少名称'}],categories:[]}),/未通过预检/);
});

test('分列布局（图05A）：一类一行、两行表头、黄色填写区、方式下拉、名称蓝色下划线相对链接',()=>{
 const {workbook}=built('separated'),sheet=workbook.sheets[0],spec=sheet.layout;
 assert.equal(sheet.name,'分类汇总表');
 assert.deepEqual(visibleRow(workbook,2).slice(0,10),
  ['序号','名称','材料条数','品牌与供应商一','','品牌与供应商二','','品牌与供应商三','','询价生成方式'],
  '分列布局按图05A分组表头');
 assert.deepEqual(visibleRow(workbook,3).slice(3,9),['品牌','供应商','品牌','供应商','品牌','供应商']);
 assert.deepEqual([1,2,3,4].map(index=>visibleRow(workbook,index+3).slice(0,3)),
  [['1','水泵','2'],['2','阀门','2'],['3','风机','2'],['4','汽车充电桩','1']],'一类一行，条数来自该类快照');
 assert.equal([1,2,3,4].every(index=>visibleRow(workbook,index+3).slice(3,9).every(value=>value==='')),true,
  '品牌与供应商初始必须空白，等人工填写');
 assert.deepEqual(sheet.values.slice(1).map(row=>row.length===13),sheet.values.slice(1).map(()=>true),'等宽矩阵供版式使用');
 assert.deepEqual(spec.merges.map(addr),['D2:E2','F2:G2','H2:I2'],'三组品牌供应商表头合并');
 assert.deepEqual(spec.fills.map(addr),
  ['A2:J2','A3:J3','D4:E7','F4:G7','H4:I7'],'表头浅色＋D:I黄色填写区');
 assert.deepEqual(spec.hyperlinks.map(link=>[addr(link),link.address,link.display]),
  [['B4:B4','分类工作簿\\水泵.xlsx','水泵'],['B5:B5','分类工作簿\\阀门.xlsx','阀门'],
   ['B6:B6','分类工作簿\\风机.xlsx','风机'],['B7:B7','分类工作簿\\汽车充电桩.xlsx','汽车充电桩']],
  '名称是相对地址原生链接，指向对应独立分类工作簿');
 assert.equal(spec.hyperlinks.every(link=>link.relative===true),true);
 assert.equal(spec.fonts.length,4,'名称单元格蓝色下划线');
 assert.deepEqual(spec.fonts.map(font=>[addr(font),font.underline,font.color]),
  [['B4:B4',true,layout.COLORS.link],['B5:B5',true,layout.COLORS.link],
   ['B6:B6',true,layout.COLORS.link],['B7:B7',true,layout.COLORS.link]]);
 assert.equal(spec.validations.length,1);
 assert.deepEqual([addr(spec.validations[0]),spec.validations[0].listSheet,spec.validations[0].listRange],
  ['J4:J7','分类汇总表','$M$1:$M$2'],'询价生成方式下拉');
 assert.deepEqual(spec.columns.filter(column=>column.hidden).map(column=>column.index),[11,12,13],'类别ID/相对链接/选项列隐藏');
 assert.equal(visibleRow(workbook,4)[10],'pump','隐藏列保存稳定类别ID');
 assert.equal(visibleRow(workbook,4)[11],'分类工作簿\\水泵.xlsx');
 assert.equal(visibleRow(workbook,1)[12],'合成一份');
 assert.equal(visibleRow(workbook,2)[12],'按品牌分别生成','方式选项列表供下拉引用');
 assert.match(visibleRow(workbook,workbook.lastRow+2)[0],/点击名称打开对应分类工作簿/,'底部操作说明');
});

test('同格布局（图05B）：单行表头、单格三组、方式下拉；与分列布局结果等价',()=>{
 const separated=built('separated').workbook,combined=built('combined').workbook;
 const sheet=combined.sheets[0],spec=sheet.layout;
 assert.deepEqual(visibleRow(combined,4).slice(0,7),
  ['序号','名称','材料条数','品牌与供应商一（用户填写）','品牌与供应商二（用户填写）','品牌与供应商三（用户填写）','询价生成方式'],
  '同格布局按图05B单行表头');
 assert.equal(visibleRow(combined,2)[0],'项目名称：示例园区','图05B带项目名称行');
 assert.deepEqual([1,2,3,4].map(index=>visibleRow(combined,index+4).slice(0,3)),
  [['1','水泵','2'],['2','阀门','2'],['3','风机','2'],['4','汽车充电桩','1']]);
 assert.equal([1,2,3,4].every(index=>visibleRow(combined,index+4).slice(3,6).every(value=>value==='')),true,
  '同格单格初始必须空白');
 assert.deepEqual(spec.merges,[],'同格布局无需合并表头');
 assert.deepEqual(spec.fills.map(addr),['A4:G4','D5:D8','E5:E8','F5:F8'],'三组单列黄色填写区');
 assert.deepEqual(spec.validations.map(rule=>[addr(rule),rule.listRange]),[['G5:G8','$J$1:$J$2']]);
 assert.deepEqual(spec.columns.filter(column=>column.hidden).map(column=>column.index),[8,9,10]);
 assert.equal(visibleRow(combined,5)[7],'pump');
 assert.equal(visibleRow(combined,5)[8],'分类工作簿\\水泵.xlsx');
 assert.match(visibleRow(combined,combined.lastRow+2)[0],/单格按两行填写：第一行“品牌：…”，第二行“供应商：…”/,
  '同格必须明确两行标签写法');
 // 两种布局都必须可用且口径一致：类别、条数、链接地址、显示名完全相同。
 assert.deepEqual(separated.sheets[0].layout.hyperlinks.map(link=>[link.address,link.display]),
  sheet.layout.hyperlinks.map(link=>[link.address,link.display]));
 assert.deepEqual(model.summaryModeValue('按品牌分别生成'),'per-brand');
 assert.deepEqual(model.summaryModeValue('合成一份'),'synthesize');
 assert.equal(model.summaryModeValue('未知方式'),'');
});

test('绑定：保存布局/数据区域/稳定类别ID/文件绑定/内容键，非法绑定明确拒绝',()=>{
 const {workbook}=built('combined');
 const binding=model.summaryBindingFor('C:\\out\\示例园区\\分类汇总表.xlsx',workbook);
 assert.equal(binding.layout,'combined');
 assert.equal(binding.headerRow,4);
 assert.equal(binding.firstRow,5);
 assert.equal(binding.inputKey,INPUT_KEY);
 assert.equal(binding.sheet,'分类汇总表');
 assert.deepEqual(binding.categories.map(item=>[item.categoryId,item.file,item.relative]),
  [['pump','水泵.xlsx','分类工作簿\\水泵.xlsx'],['valve','阀门.xlsx','分类工作簿\\阀门.xlsx'],
   ['fan','风机.xlsx','分类工作簿\\风机.xlsx'],['ev-charger','汽车充电桩.xlsx','分类工作簿\\汽车充电桩.xlsx']]);
 assert.deepEqual(model.validateSummaryBinding(binding),{ok:true,errors:[]});
 assert.throws(()=>model.summaryBindingFor('relative.xlsx',workbook),/路径无效/);
 assert.match(model.validateSummaryBinding(Object.assign({},binding,{schemaVersion:9})).errors.join('；'),/版本不支持/);
 assert.match(model.validateSummaryBinding(Object.assign({},binding,{layout:'grid'})).errors.join('；'),/有效布局/);
 assert.match(model.validateSummaryBinding(Object.assign({},binding,{categories:[]})).errors.join('；'),/类别清单/);
});

// 模拟宿主：只实现export-host真正用到的API（含原生超链接/下拉/字体/隐藏列），验证逐值写入与重开读回。
function summaryApp(options){
 const settings=options||{},ranges=new Map(),widths=new Map(),heights=new Map(),links=new Map(),merges=new Map();
 const state={created:0,opened:0,closed:0,saved:[]};
 let active=null,lastSaved=null;
 const previous={FullName:'C:\\user.xlsx',Activate(){active=this;},Close(){assert.fail('user book closed');}};
 active=previous;
 function key(address){return String(address).split(':')[0];}
 function range(address){
  if(ranges.has(address))return ranges.get(address);
  const target={__address:address,Font:{Size:null,Bold:false,Color:null,Underline:null},NumberFormat:null,value:null,
   WrapText:null,HasFormula:false,MergeCells:false,Interior:{Color:null},Rows:{AutoFit(){}},Select(){},
   Merge(){this.MergeCells=true;merges.set(address,true);},
   get Value2(){return this.value;},set Value2(values){this.value=values.map(row=>row.slice());},
   Validation:{Formula1:null,InCellDropdown:null,IgnoreBlank:null,Delete(){this.Formula1=null;},
    Add(type,style,operator,formula1){this.Formula1=formula1;}},
   get Hyperlinks(){const list=links.get(key(address))||[];return {get Count(){return list.length;},Item(index){return list[index-1]||{};}};}};
  ranges.set(address,target);return target;
 }
 function newSheet(name){
  const sheet={Name:name||'Sheet',Range:range,
   Cells:{Item(row,column){return range(columnName(column)+row);}},
   Columns:{Item(index){const id='c'+index;if(!widths.has(id))widths.set(id,{ColumnWidth:null,Hidden:false});return widths.get(id);}},
   Rows:{Item(index){const id='r'+index;if(!heights.has(id))heights.set(id,{RowHeight:null,Font:{Bold:false}});return heights.get(id);}},
   PageSetup:{PrintArea:null,PrintTitleRows:null},
   Hyperlinks:{Add(anchor,address,subAddress,screenTip,display){
    const list=links.get(key(anchor.__address))||[];if(!links.has(key(anchor.__address)))links.set(key(anchor.__address),list);
    // WPS可能把相对地址解析成绝对地址；读回要能同时接受两者。
    const stored=settings.resolveLinks&&!/^(?:[a-z]:[\\/]|\\\\)/i.test(address)
     ? 'C:\\out\\示例园区\\'+String(address).replace(/\\/g,'\\') : address;
    list.push({Address:stored,SubAddress:subAddress,ScreenTip:screenTip,TextToDisplay:display});}}};
  return sheet;
 }
 function makeBook(){
  const sheets=[newSheet('Sheet1')];
  return {FullName:'Book'+state.created,
   Worksheets:{get Count(){return sheets.length;},
    Item(requested){return typeof requested==='number'?sheets[requested-1]:sheets.filter(s=>s.Name===requested)[0];},
    Add(){const sheet=newSheet('Sheet');sheets.push(sheet);return sheet;}},
   SaveAs(file,format){assert.equal(format,51,'必须以xlsx格式独占保存');this.FullName=file;lastSaved=this;state.saved.push(file);},
   Close(save){assert.equal(save,false);state.closed++;},
   Activate(){active=this;},__sheets:sheets};
 }
 const app={AutomationSecurity:1,FileSystem:{Exists:()=>false},ActiveWindow:{FreezePanes:false},
  get ActiveWorkbook(){return active;},
  Workbooks:{Count:1,Item(){return previous;},
   Add(){const book=makeBook();state.created++;active=book;return book;},
   Open(file,linksArg,readonly){assert.equal(linksArg,0);assert.equal(readonly,true);assert.equal(app.AutomationSecurity,3);
    state.opened++;active=lastSaved;return lastSaved;}}};
 return {app,state,previous,ranges,widths,heights,links,merges};
}
function columnName(index){let name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}

test('模拟宿主：汇总表单页写入，链接/下拉/字体/隐藏列落地并重开读回',()=>{
 for(const [layoutName,expectedWidth] of [['separated',13],['combined',10]]){
  const {workbook}=built(layoutName),fixture=summaryApp(),stage='C:\\out\\示例园区\\.分类汇总表.tmp.xlsx';
  host.summaryWrite(fixture.app,workbook,stage);
  assert.equal(fixture.state.created,1,'汇总表只新建一个工作簿');
  assert.equal(fixture.state.opened,1,'保存后必须重开核对');
  assert.equal(fixture.app.ActiveWorkbook,fixture.previous,'用户工作簿恢复为活动簿');
  assert.equal(fixture.app.AutomationSecurity,1,'宏安全值恢复');
  const spec=workbook.sheets[0].layout;
  const nameCell=fixture.ranges.get(addr(spec.hyperlinks[0]));
  assert.equal(nameCell.Font.Underline,2,'名称单元格蓝色下划线');
  assert.equal(nameCell.Font.Color,layout.toColor(layout.COLORS.link));
  const links=fixture.links.get(keyOf(addr(spec.hyperlinks[0])));
  assert.equal(links.length,1);
  assert.equal(links[0].Address,'分类工作簿\\水泵.xlsx','链接必须是相对地址，整目录搬移仍可点开');
  assert.equal(links[0].TextToDisplay,'水泵');
  const modeCell=fixture.ranges.get(addr(spec.validations[0]));
  assert.equal(modeCell.Validation.Formula1,"='分类汇总表'!$"+columnName(workbook.auxOptions)+"$1:$"+columnName(workbook.auxOptions)+"$2");
  spec.columns.filter(column=>column.hidden).forEach(column=>assert.equal(fixture.widths.get('c'+column.index).Hidden,true));
  assert.equal(fixture.app.ActiveWindow.FreezePanes,true,'冻结表头');
  assert.equal(workbook.sheets[0].values[0].length,expectedWidth,'单页等宽矩阵');
 }
});
function keyOf(address){return String(address).split(':')[0];}
test('读回允许WPS把相对地址解析成绝对地址：整目录搬移后仍判定为同一链接',()=>{
 const {workbook}=built('separated'),fixture=summaryApp({resolveLinks:true});
 host.summaryWrite(fixture.app,workbook,'C:\\out\\示例园区\\.分类汇总表.tmp.xlsx');
 const stored=fixture.links.get('B4')[0].Address;
 assert.equal(stored,'C:\\out\\示例园区\\分类工作簿\\水泵.xlsx','模拟WPS解析后的绝对地址');
 assert.equal(stored.slice(-'分类工作簿\\水泵.xlsx'.length),'分类工作簿\\水泵.xlsx','相对尾串仍与链接一致');
});
test('打开汇总表：已打开的同路径工作簿直接复用，未打开则以可编辑方式打开并恢复宏安全值',()=>{
 const filePath='C:\\out\\示例园区\\分类汇总表.xlsx';
 let opened=0,active=null;
 const target={FullName:filePath,Activate(){active=this;}};
 const reuse={AutomationSecurity:1,Workbooks:{Count:1,Item(){return target;},Open(){opened++;return target;}}};
 assert.deepEqual(host.openSummary(reuse,filePath),{path:filePath,opened:true,reused:true});
 assert.equal(opened,0,'已打开的同路径工作簿直接复用');
 const fresh={AutomationSecurity:1,Workbooks:{Count:1,Item(){return null;},Open(file,links,readonly){
  assert.equal(links,0);assert.equal(readonly,false,'汇总表要打开供填写');assert.equal(fresh.AutomationSecurity,3);
  opened++;active=target;return target;}}};
 assert.deepEqual(host.openSummary(fresh,filePath),{path:filePath,opened:true,reused:false});
 assert.equal(opened,1);
 assert.equal(fresh.AutomationSecurity,1,'宏安全值必须恢复');
 assert.equal(active,target,'汇总表打开后置前供填写');
 assert.throws(()=>host.openSummary({AutomationSecurity:null,Workbooks:{Count:0}},filePath),/宏安全设置/);
 assert.throws(()=>host.openSummary(fresh,'relative.xlsx'),/路径无效/);
});
