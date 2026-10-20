const test=require('node:test'),assert=require('node:assert/strict');
const brand=require('../src/brand-table.js'),model=require('../src/brand-model.js');
test('R12-D：分类汇总操作说明跨公开列显示，不挤入序号列或吞并内部绑定',()=>{
 const categories=[{categoryId:'pump',categoryName:'水泵',rowCount:2,path:'C:\\out\\分类工作簿\\水泵.xlsx'}];
 for(const [layoutName,hintRow,width] of [['separated',6,10],['combined',7,7]]){
  const built=model.buildSummary(model.summaryPlan(categories,{directory:'C:\\out',layout:layoutName}));
  const sheet=built.sheets[0];
  const hintMerge=sheet.layout.merges.find(m=>m.row===hintRow&&m.column===1);
  assert.ok(hintMerge,'操作说明必须获得整行公开显示区域');
  assert.equal(hintMerge.columnSpan,width,'不得延伸到隐藏的类别或文件绑定列');
  assert.match(sheet.values[hintRow-1][0],/点击名称打开对应分类工作簿/);
 }
});
test('R7：分类汇总表模型与旧品牌表模型共存，双布局可用且名称链接指向独立工作簿',()=>{
 assert.equal(model.SUMMARY_SHEET,'分类汇总表');
 assert.deepEqual(model.SUMMARY_LAYOUTS,['separated','combined']);
 assert.equal(model.summaryModeLabel('per-brand'),'按品牌分别生成');
 const categories=[{categoryId:'pump',categoryName:'水泵',rowCount:2,path:'C:\\out\\分类工作簿\\水泵.xlsx'},
  {categoryId:'valve',categoryName:'阀门',rowCount:2,path:'C:\\out\\分类工作簿\\阀门.xlsx'}];
 ['separated','combined'].forEach(layoutName=>{
  const plan=model.summaryPlan(categories,{directory:'C:\\out',inputKey:'ck2-summary',layout:layoutName});
  assert.equal(plan.ok,true,(plan.issues[0]||{}).message);
  const workbook=model.buildSummary(plan,{});
  assert.equal(workbook.sheets.length,1,'汇总表保持单页，不新增工作表页签');
  assert.equal(workbook.sheets[0].name,'分类汇总表');
  assert.deepEqual(workbook.sheets[0].layout.hyperlinks.map(link=>link.address),
   ['分类工作簿\\水泵.xlsx','分类工作簿\\阀门.xlsx'],'名称超链接用相对地址指向对应分类工作簿');
  assert.equal(model.validateSummaryBinding(model.summaryBindingFor('C:\\out\\分类汇总表.xlsx',workbook)).ok,true);
 });
});
function source(id,name,code,quantity){
 return {id:id,itemId:'i-'+id,file:name+'.xlsx',path:'C:\\samples\\'+name+'.xlsx',sheet:'给排水',row:id.length,
  rows:[id.length],code:code,quantity:quantity,quantityRaw:quantity,unit:'m',engineering:'测试楼',profession:'给排水'};
}
function group(id,name,feature,unit,quantity,sources){
 return {id:id,scopeId:'C:/copies/a.xlsx',name:name,feature:feature,unit:unit,quantity:quantity,sources:sources,
  sourceLabels:['测试楼—给排水']};
}
const groups=[
 group('row-1','水管','DN50','m','0.3',[source('s1','a','000123','0.1'),source('s2','b','000123','0.2')]),
 group('row-2','水龙头','DN15','个','1',[source('s3','a','000124','1')]),
 group('row-3','钢索','','套','2',[source('s4','b','000125','2')])
];
const classification={schemaVersion:1,revision:1,
 decisions:[{rowId:'row-1',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'t'},
  {rowId:'row-2',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'t'},
  {rowId:'row-3',categoryId:'no-inquiry',categoryName:'无需询价',skip:true,confirmedAt:'t'}],history:[]};
function data(){
 const built=brand.build(groups,classification,'ck1-brand');
 return Object.assign({},built,{coverageMode:'material-subsets',assignments:[
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1'],brand:'',supplier:'',note:'',coverageConfirmed:false,confirmedAt:null},
  {assignmentId:'a-2',categoryId:'water-valve',rowIds:['row-2'],brand:'',supplier:'',note:'',coverageConfirmed:false,confirmedAt:null}]});
}
function workbook(){return model.buildWorkbook(data(),'2026-09-26T00:00:00.000Z');}
function binding(values){return model.bindingFor('C:\\out\\分类品牌表.xlsx',Object.assign(workbook(),{}));}
function sheetValues(){return workbook().sheets[0].values.map(row=>row.slice());}
test('the workbook carries one row per assignment plus the material detail and the filling rules',()=>{
 const built=workbook();
 assert.deepEqual(built.sheets.map(sheet=>sheet.name),['分类品牌表','材料明细','填写说明']);
 const main=built.sheets[0].values;
 assert.deepEqual(main[1],['分配标识','类别','材料条目数','品牌','供应商','备注','材料行标识']);
 assert.deepEqual(main[2],['a-1','水阀门','1','','','','row-1']);
 assert.deepEqual(main[3],['a-2','水阀门','1','','','','row-2']);
 assert.equal(main.length,4);
 const details=built.sheets[1].values;
 assert.equal(details.length,3,'材料明细按分配逐条列出材料');
 assert.deepEqual(details[1].slice(0,3),['a-1','水阀门','水管']);
 assert.equal(details[1][5],'0.3','合并后的数量按文本十进制原样带入');
 assert.ok(built.sheets[2].values.some(row=>row[0]==='填写范围'));
 assert.ok(built.sheets.every(sheet=>sheet.values.every(row=>row.every(value=>typeof value==='string'))),'品牌表所有值必须是字符串');
 assert.deepEqual(Object.keys(built.rowMap).sort(),['a-1','a-2']);
 assert.equal(built.rowMap['a-1'].count,1);
 assert.deepEqual(built.rowMap['a-1'].rowIds,['row-1']);
});
test('bindingFor keeps only reproducible information and refuses a bad path',()=>{
 const bound=model.bindingFor('C:\\out\\分类品牌表.xlsx',workbook());
 assert.equal(bound.sheet,'分类品牌表');
 assert.equal(bound.headerRow,2);
 assert.equal(bound.firstRow,3);
 assert.equal(bound.inputKey,'ck1-brand');
 assert.deepEqual(model.validateBinding(bound),{ok:true,errors:[]});
 assert.throws(()=>model.bindingFor('相对路径.xlsx',workbook()),/路径无效/);
 assert.throws(()=>model.bindingFor('C:\\out\\分类品牌表.csv',workbook()),/路径无效/);
 assert.match(model.validateBinding(Object.assign({},bound,{schemaVersion:9})).errors.join('；'),/版本不支持/);
 assert.match(model.validateBinding(Object.assign({},bound,{rowMap:{}})).errors.join('；'),/分配标识映射/);
});
test('reading back matches by assignment id so user sorting still works',()=>{
 const built=workbook(),bound=model.bindingFor('C:\\out\\分类品牌表.xlsx',built),values=sheetValues();
 values[2][3]='品牌甲';values[2][4]='供应商A';values[2][5]='备注一';
 values[3][3]='品牌乙';values[3][4]='供应商B';
 const parsed=model.parseSheet(values,bound);
 assert.deepEqual(parsed.assignments.map(item=>[item.assignmentId,item.brand,item.supplier,item.note]).sort(),
  [['a-1','品牌甲','供应商A','备注一'],['a-2','品牌乙','供应商B','']]);
 const sorted=[values[0],values[1],values[3],values[2]];
 assert.deepEqual(model.parseSheet(sorted,bound).assignments.map(item=>[item.assignmentId,item.brand]).sort(),
  [['a-1','品牌甲'],['a-2','品牌乙']],'用户在WPS里排序后仍按稳定标识读回');
 const applied=model.apply(data(),model.parseSheet(values,bound));
 assert.deepEqual(applied.assignments.map(item=>item.assignmentId),['a-1','a-2'],'读回保持原有分配顺序');
 assert.equal(applied.assignments[0].brand,'品牌甲');
 assert.equal(applied.assignments[0].coverageConfirmed,false,'读回不得改动覆盖范围确认状态');
 assert.match(brand.validate(applied,brand.requiredRowIds(groups,classification)).errors.join('；'),/覆盖范围尚未确认|品牌为空/);
});
test('duplicate, deleted or unknown rows are refused with the specific line',()=>{
 const bound=model.bindingFor('C:\\out\\分类品牌表.xlsx',workbook()),values=sheetValues();
 assert.throws(()=>model.parseSheet(values.concat([values[2].slice()]),bound),/第3行与第5行的分配标识重复：a-1/);
 const deleted=[values[0],values[1],values[2]];
 assert.throws(()=>model.parseSheet(deleted,bound),/缺少分配标识“a-2”/);
 const unknown=sheetValues();unknown[2][0]='a-9';
 assert.throws(()=>model.parseSheet(unknown,bound),/不属于本次项目/);
});
test('edits to fixed columns are refused instead of silently accepted',()=>{
 const bound=model.bindingFor('C:\\out\\分类品牌表.xlsx',workbook());
 const category=sheetValues();category[2][1]='电线电缆';
 assert.throws(()=>model.parseSheet(category,bound),/第3行的类别被改动/);
 const count=sheetValues();count[2][2]='2';
 assert.throws(()=>model.parseSheet(count,bound),/第3行的材料条目数被改动/);
 const rows=sheetValues();rows[2][6]='row-9';
 assert.throws(()=>model.parseSheet(rows,bound),/第3行的材料行标识被改动/);
 const header=sheetValues();header[1][3]='品牌名称';
 assert.throws(()=>model.parseSheet(header,bound),/第2行第4列应为“品牌”/);
});
test('blocks are refused early and empty values never become a finished brand table',()=>{
 assert.throws(()=>model.buildWorkbook({rows:data().rows,assignments:[],inputKey:'ck1-brand',coverageMode:'pending'}),/还没有品牌分配/);
 const stray=Object.assign({},data(),{assignments:[
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1'],brand:'甲',supplier:'S1',coverageConfirmed:true},
  {assignmentId:'a-2',categoryId:'water-valve',rowIds:['row-9'],brand:'乙',supplier:'S2',coverageConfirmed:true}]});
 assert.throws(()=>model.buildWorkbook(stray,'2026-09-26T00:00:00.000Z'),/不属于当前清单的材料行/);
 const read=model.parseSheet(sheetValues(),model.bindingFor('C:\\out\\分类品牌表.xlsx',workbook()));
 assert.equal(read.assignments.every(item=>item.brand===''),true);
});

// ===== R8（图05A/05B→06）：汇总表读回、多品牌关系与联动口径 =====
const R8_ROOT='C:\\out\\示例园区',R8_SUMMARY=R8_ROOT+'\\分类汇总表.xlsx';
const R8_CATEGORIES=[
 {categoryId:'pump',categoryName:'水泵',rowCount:2,path:R8_ROOT+'\\分类工作簿\\水泵.xlsx'},
 {categoryId:'valve',categoryName:'阀门',rowCount:2,path:R8_ROOT+'\\分类工作簿\\阀门.xlsx'},
 {categoryId:'fan',categoryName:'风机',rowCount:2,path:R8_ROOT+'\\分类工作簿\\风机.xlsx'},
 {categoryId:'ev-charger',categoryName:'汽车充电桩',rowCount:1,path:R8_ROOT+'\\分类工作簿\\汽车充电桩.xlsx'}];
// 第6.1节样例填写：水泵2组按品牌分别生成→2份，阀门2组合成→1份，风机/充电桩各1份；合计5份。
const R8_FILLS=[
 {mode:'per-brand',groups:[{brand:'青源',supplier:'华川设备'},{brand:'恒流',supplier:'启明机电'}]},
 {mode:'synthesize',groups:[{brand:'通达',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}]},
 {mode:'synthesize',groups:[{brand:'瑞风',supplier:'瑞风设备'}]},
 {mode:'synthesize',groups:[{brand:'驰电',supplier:'远程电气'}]}];
function r8Summary(layoutName,fills){
 const plan=model.summaryPlan(R8_CATEGORIES,{directory:R8_ROOT,inputKey:'ck2-r8-sample',layout:layoutName,projectName:'示例园区'});
 const workbook=model.buildSummary(plan,{});
 const values=workbook.sheets[0].values.map(row=>row.slice());
 const spec=model.summaryLayoutFor(layoutName);
 (fills||R8_FILLS).forEach((fill,index)=>{
  const row=spec.firstRow+index;
  (fill.groups||[]).forEach((group,groupIndex)=>{
   if(spec.name==='combined')
    values[row-1][spec.groups[groupIndex][0]-1]='品牌：'+group.brand+'\n供应商：'+group.supplier;
   else{values[row-1][spec.groups[groupIndex][0]-1]=group.brand;values[row-1][spec.groups[groupIndex][1]-1]=group.supplier;}
  });
  values[row-1][spec.modeColumn-1]=fill.mode?model.summaryModeLabel(fill.mode):'';
 });
 return {workbook,values,binding:model.summaryBindingFor(R8_SUMMARY,workbook)};
}
function r8Fills(first){return [first,R8_FILLS[1],R8_FILLS[2],R8_FILLS[3]];}
test('R8汇总读回：两种布局解析等价，1至3组与生成方式一致，预计5份',()=>{
 const separated=r8Summary('separated'),combined=r8Summary('combined');
 const separatedRead=model.parseSummary(separated.values,separated.binding);
 const combinedRead=model.parseSummary(combined.values,combined.binding);
 assert.equal(separatedRead.ok,true,(separatedRead.issues[0]||{}).message);
 assert.equal(combinedRead.ok,true,(combinedRead.issues[0]||{}).message);
 const business=function(list){return list.map(item=>({categoryId:item.categoryId,mode:item.mode,groups:item.groups}));};
 assert.deepEqual(business(separatedRead.categories),business(combinedRead.categories),'两种布局必须解析成同一套品牌口径');
 assert.deepEqual(separatedRead.categories.map(item=>[item.categoryId,item.mode,item.groups.length,item.groups.map(g=>g.brand)]),
  [['pump','per-brand',2,['青源','恒流']],['valve','synthesize',2,['通达','海岳']],
   ['fan','synthesize',1,['瑞风']],['ev-charger','synthesize',1,['驰电']]]);
 assert.equal(separatedRead.expectedSheets,5,'水泵2、阀门1、风机1、充电桩1共5份');
 assert.equal(combinedRead.expectedSheets,5);
 assert.equal(model.summarySheetCount(separatedRead.categories),5);
 assert.equal(model.summaryCountsText(separatedRead.categories),'水泵 2 份、阀门 1 份、风机 1 份、汽车充电桩 1 份');
 assert.equal(separatedRead.totalGroups,6);
});
test('R8汇总读回：品牌供应商可留空，空组忽略、半组保留、重复组合与多组未选方式仍报单元格',()=>{
 const single=r8Summary('separated',r8Fills({mode:'',groups:[{brand:'甲',supplier:'S1'}]}));
 const singleRead=model.parseSummary(single.values,single.binding);
 assert.equal(singleRead.ok,true,(singleRead.issues[0]||{}).message);
 assert.equal(singleRead.categories[0].mode,'synthesize','单组默认合成一份');
 assert.equal(singleRead.expectedSheets,4,'四类各单组，每类仍只有一份');
 const spec=model.summaryLayoutFor('separated');
 // 半组：只填品牌不填供应商，允许原样读回，后续询价表供应商留空。
 const half=r8Summary('separated',r8Fills(R8_FILLS[0]));
 half.values[spec.firstRow-1][spec.groups[1][1]-1]='';
 const halfRead=model.parseSummary(half.values,half.binding);
  assert.equal(halfRead.ok,true,(halfRead.issues[0]||{}).message);
  assert.deepEqual(halfRead.categories[0].groups,[{brand:'青源',supplier:'华川设备'},{brand:'恒流',supplier:''}]);
  // 全部留空：该类别仍进入下一步，按一份空品牌/空供应商询价页计算。
  const empty=r8Summary('separated',r8Fills({mode:'',groups:[]}));
  const emptyRead=model.parseSummary(empty.values,empty.binding);
  assert.equal(emptyRead.ok,true,(emptyRead.issues[0]||{}).message);
  assert.deepEqual(emptyRead.categories[0].groups,[]);
  assert.equal(emptyRead.categories[0].mode,'synthesize');
  assert.equal(emptyRead.expectedSheets,4,'空白品牌类别仍保留一份询价页');
  assert.equal(model.summarySheetCount(emptyRead.categories),4);
 // 重复组合：完全相同的品牌/供应商组合出现两次。
 const dup=r8Summary('separated',r8Fills({mode:'synthesize',groups:[{brand:'通达',supplier:'正通商贸'},{brand:'通达',supplier:'正通商贸'}]}));
 const dupRead=model.parseSummary(dup.values,dup.binding);
 assert.equal(dupRead.ok,false);
 assert.match(dupRead.issues.map(item=>item.code).join('；'),/group-duplicate/);
 assert.equal(dupRead.issues[0].cell,'F4');
 // 同品牌不同供应商是允许的，不得误判为重复。
 const sameBrand=r8Summary('separated',r8Fills({mode:'synthesize',groups:[{brand:'通达',supplier:'正通商贸'},{brand:'通达',supplier:'安合设备'}]}));
 assert.equal(model.parseSummary(sameBrand.values,sameBrand.binding).ok,true);
 // 多组未选方式：不放行并定位到方式列。
 const noMode=r8Summary('separated',r8Fills({mode:'',groups:[{brand:'甲',supplier:'S1'},{brand:'乙',supplier:'S2'}]}));
 const noModeRead=model.parseSummary(noMode.values,noMode.binding);
 assert.equal(noModeRead.ok,false);
 assert.equal(noModeRead.issues[0].code,'mode-missing');
 assert.equal(noModeRead.issues[0].cell,'J4');
});
test('R8汇总读回：稳定类别ID读回，排序不串类；删行/复制行/改名称条数都定位到单元格',()=>{
 const base=r8Summary('separated');
 // 排序不串类：交换两行数据，仍按隐藏类别ID对应，名称/条数/品牌都不串。
 const rows=[base.values[3].slice(),base.values[4].slice()];
 const sorted=base.values.map(row=>row.slice());sorted[3]=rows[1];sorted[4]=rows[0];
 const sortedRead=model.parseSummary(sorted,base.binding);
 assert.equal(sortedRead.ok,true,(sortedRead.issues[0]||{}).message);
 assert.deepEqual(sortedRead.categories.map(item=>item.categoryId).slice(0,2),['valve','pump'],'按隐藏类别ID读回，排序不串类');
 assert.deepEqual(sortedRead.categories.filter(item=>item.categoryId==='pump')[0].groups.map(g=>g.brand),['青源','恒流']);
 // 复制行：同一类别出现两次，报单元格。
 const copied=base.values.map(row=>row.slice());copied.splice(4,0,copied[3].slice());
 const copiedRead=model.parseSummary(copied,base.binding);
 assert.equal(copiedRead.ok,false);
 assert.equal(copiedRead.issues[0].code,'category-duplicate');
 assert.equal(copiedRead.issues[0].cell,'K5');
 // 删行：缺少类别行。
 const deleted=base.values.map(row=>row.slice());deleted.splice(4,1);
 const deletedRead=model.parseSummary(deleted,base.binding);
 assert.equal(deletedRead.ok,false);
 assert.match(deletedRead.issues.map(item=>item.message).join('；'),/缺少类别“阀门”/);
 // 改名称/条数：固定列被改动，定位到名称/条数单元格。
 const renamed=base.values.map(row=>row.slice());renamed[4][1]='阀门（改）';
 const renamedRead=model.parseSummary(renamed,base.binding);
 assert.equal(renamedRead.ok,false);
 assert.equal(renamedRead.issues[0].code,'name-changed');
 assert.equal(renamedRead.issues[0].cell,'B5');
 const recounted=base.values.map(row=>row.slice());recounted[4][2]='9';
 const recountedRead=model.parseSummary(recounted,base.binding);
 assert.equal(recountedRead.ok,false);
 assert.equal(recountedRead.issues[0].code,'count-changed');
 assert.equal(recountedRead.issues[0].cell,'C5');
 // 未知类别ID：不是本次汇总表的行。
 const unknown=base.values.map(row=>row.slice());unknown[4][10]='unknown';
 const unknownRead=model.parseSummary(unknown,base.binding);
 assert.equal(unknownRead.ok,false);
 assert.equal(unknownRead.issues[0].code,'category-unknown');
 assert.equal(unknownRead.issues[0].cell,'K5');
});
test('R8同格读回：未知文本报单元格，单行品牌/供应商可留空并解析成独立字段',()=>{
 const base=r8Summary('combined');
 assert.equal(model.parseSummary(base.values,base.binding).ok,true);
 const missing=base.values.map(row=>row.slice());missing[4][3]='青源';// 缺少“品牌：”标签
 const missingRead=model.parseSummary(missing,base.binding);
 assert.equal(missingRead.ok,false);
 assert.equal(missingRead.issues[0].cell,'D5');
 const extra=base.values.map(row=>row.slice());extra[4][3]='品牌：青源\n供应商：华川设备\n备注：这是不该出现的';
 const extraRead=model.parseSummary(extra,base.binding);
 assert.equal(extraRead.ok,false);
 assert.equal(extraRead.issues[0].code,'combined-unknown');
 assert.equal(extraRead.issues[0].cell,'D5');
 const half=base.values.map(row=>row.slice());half[4][3]='品牌：青源';
 const halfRead=model.parseSummary(half,base.binding);
  assert.equal(halfRead.ok,true,(halfRead.issues[0]||{}).message);
  assert.deepEqual(halfRead.categories.filter(item=>item.categoryId==='pump')[0].groups[0],{brand:'青源',supplier:''});
 // 英文冒号与换行兼容。
 const english=base.values.map(row=>row.slice());english[4][3]='品牌: 青源\r\n供应商: 华川设备';
 const englishRead=model.parseSummary(english,base.binding);
 assert.equal(englishRead.ok,true,(englishRead.issues[0]||{}).message);
 assert.deepEqual(englishRead.categories.filter(item=>item.categoryId==='pump')[0].groups[0],{brand:'青源',supplier:'华川设备'});
});
test('R8读回记录：只保留可复现业务字段，供项目brands保存与询价/拆分内容键使用',()=>{
 const base=r8Summary('combined');
 const read=model.parseSummary(base.values,base.binding);
 const record=model.summaryReadRecord(read,{readAt:'2026-09-27T00:00:00.000Z',summaryPath:R8_SUMMARY});
 assert.equal(record.schemaVersion,1);
 assert.equal(record.layout,'combined');
 assert.equal(record.expectedSheets,5);
 assert.equal(record.summaryPath,R8_SUMMARY);
 assert.deepEqual(Object.keys(record.categories[0]).sort(),['categoryId','categoryName','groups','mode','rowCount']);
 assert.deepEqual(record.categories[0].groups,[{brand:'青源',supplier:'华川设备'},{brand:'恒流',supplier:'启明机电'}]);
});
