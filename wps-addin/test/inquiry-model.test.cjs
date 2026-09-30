const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs'),collection=require('../src/collection.js'),
 inquiry=require('../src/inquiry-model.js'),header=require('../src/inquiry-header.js'),layout=require('../src/workbook-layout.js');
// 第6.1节合成样例：10输入→合并8→7询价＋1无需询价。R9只核总询价工作簿（拆分属R10）。
const preview=collection.preview(sample.buildCollection(),true);
const CATEGORY_OF={水泵:'pump',阀门:'valve',风机:'fan',汽车充电桩:'ev-charger'};
function categoryFor(name){
 if(name.indexOf('钢索')>=0)return {categoryId:'no-inquiry',categoryName:'无需询价',skip:true};
 if(name.indexOf('水泵')>=0)return {categoryId:'pump',categoryName:'水泵'};
 if(name.indexOf('阀门')>=0)return {categoryId:'valve',categoryName:'阀门'};
 if(name.indexOf('风机')>=0)return {categoryId:'fan',categoryName:'风机'};
 if(name.indexOf('配电箱')>=0)return {categoryId:'ev-charger',categoryName:'汽车充电桩'};
 throw Error('样例缺少材料分类：'+name);
}
const classification={schemaVersion:1,revision:1,decisions:preview.groups.map(function(group){
 var found=categoryFor(group.name);
 return {rowId:group.id,categoryId:found.categoryId,categoryName:found.categoryName,skip:found.skip===true};
})};
// R8汇总表读回口径：水泵按品牌分别生成（2份）、阀门2组合成（1份）、风机/充电桩单组（各1份），共5份。
const brands=sample.expectations.categories.map(function(category){
 return {categoryId:category.categoryId,categoryName:category.categoryName,rowCount:category.rows,
  mode:category.mode==='separate-brands'?'per-brand':'synthesize',groups:category.groups};
});
const head={projectName:'示例园区',company:'示例建设公司',contact:'测试员',phone:'示例联系方式',address:''};
function build(overrides){return inquiry.build(Object.assign({brands:brands,groups:preview.groups,
 classification:classification,header:head,inputKey:'ck2-sample00000000'},overrides||{}));}
function sheetNamed(model,name){return model.sheets.filter(function(sheet){return sheet.name===name;})[0];}
function dataRows(sheet){return sheet.values.slice(sheet.headerRow);}

test('图06：分别生成每组一张、合成每类一张，材料只列一次且品牌按组顺序显示',()=>{
 const model=build();
 assert.deepEqual(model.sheets.map(function(sheet){return sheet.name;}),
  ['水泵_青源','水泵_恒流','阀门_合成询价','风机_瑞风','汽车充电桩_驰电'],'工作表名与图06一致');
 assert.deepEqual(inquiry.summaryLines(model),['水泵：按品牌生成 2 份','阀门：多个品牌合成 1 份','风机、汽车充电桩：各 1 份'],
  '侧栏预计输出与图06一致');
 assert.equal(model.sheetCount,5,'总表5张询价页');
 assert.equal(model.sheets.every(function(sheet){return sheet.kind==='inquiry';}),true);
 // 水泵：每组一个询价对象，各含本类完整2行材料。
 [['水泵_青源','青源'],['水泵_恒流','恒流']].forEach(function(entry){
  const sheet=sheetNamed(model,entry[0]),rows=dataRows(sheet);
  assert.equal(rows.length,2,entry[0]+'含本类完整2个材料行');
  assert.deepEqual(rows.map(function(row){return row[5];}),['2','3'],entry[0]+'保留本类完整工程量20/12之外的2/3');
  assert.deepEqual(rows.map(function(row){return row[6];}),[entry[1],entry[1]],entry[0]+'品牌列为本组品牌');
 });
 const pump=sheetNamed(model,'水泵_青源');
 assert.deepEqual(dataRows(pump).map(function(row){return row[6];}),['青源','青源'],'分别生成时品牌列为本组品牌');
 // 阀门：合成一份，同表列出全部品牌，材料行与工程量只出现一次。
 const valve=sheetNamed(model,'阀门_合成询价'),valveRows=dataRows(valve);
 assert.equal(valve.mode,'synthesize');
 assert.equal(valve.groupCount,2);
 assert.deepEqual(valveRows.map(function(row){return row.slice(0,10);}),
  [['1','FM-001','阀门','DN50','个','20','通达 / 海岳','','',''],
   ['2','FM-002','阀门','DN65','个','12','通达 / 海岳','','','']],
  '阀门两行20/12、品牌为通达 / 海岳，材料行只出现一次');
 assert.equal(valveRows.length,2,'合成不得把材料行翻倍');
 assert.deepEqual(valve.supplierLines,['通达 — 正通商贸','海岳 — 安合设备'],'供应商信息逐组对应');
 assert.equal(valve.supplier,'多供应商','多供应商合成用于后续拆分的文件名');
 assert.equal(sheetNamed(model,'风机_瑞风').supplier,'瑞风设备','单组用本组供应商');
});

test('图06抬头块、10列公开值、报价与金额留空、长特征换行',()=>{
 const model=build(),valve=sheetNamed(model,'阀门_合成询价');
 assert.equal(valve.headerRow,7,'标题/信息/经办人/供应商信息后为表头行');
 assert.deepEqual(valve.values[0][0],'示例园区材料询价表');
 assert.equal(valve.values[2][0],'项目名称：示例园区');
 assert.equal(valve.values[2][5],'单位名称：示例建设公司');
 assert.equal(valve.values[3][0],'材料经办人：测试员');
 assert.equal(valve.values[3][5],'联系方式：示例联系方式');
 assert.equal(valve.values[4][0],'供应商信息');
 assert.equal(valve.values[5][1],'海岳 — 安合设备');
 assert.deepEqual(valve.values[6],inquiry.COLUMNS,'公开材料列固定10列');
 assert.equal(valve.values.every(function(row){return row.every(function(value){return typeof value==='string';})}),
  true,'公开值全部按文本写出');
 assert.equal(valve.values.every(function(row){return row.length===10;}),true,'等宽矩阵补齐到10列');
 const rows=dataRows(valve);
 assert.equal(rows.every(function(row){return row[7]===''&&row[8]==='';}),true,'报价单价与金额留空');
 assert.equal(rows.some(function(row){return row.indexOf('原价')>=0;}),false);
 // 长特征完整保留、不截断；超宿主单格限制时明确拒绝。
 assert.equal(model.sheets.every(function(sheet){return sheet.layout&&sheet.layout.columns.length===10;}),true);
 const featureColumn=valve.layout.columns.filter(function(column){return column.index===4;})[0];
 assert.ok(featureColumn.width>=40,'项目特征描述列按图06加宽以便长特征换行');
});

test('图06版式：标题合并、表头填充、冻结、打印重复表头随模型给出',()=>{
 const model=build(),valve=sheetNamed(model,'阀门_合成询价'),spec=valve.layout;
 assert.equal(spec.metadata.profile,'inquiry-sheet');
 assert.deepEqual(spec.headerRows,[1,7],'标题行与表头行加粗');
 assert.deepEqual(spec.freeze,{row:8,column:1},'冻结表头以上');
 const titleMerge=spec.merges.filter(function(merge){return merge.row===1;})[0];
 assert.deepEqual([titleMerge.column,titleMerge.columnSpan],[1,10],'标题合并成整行');
 const supplierMerge=spec.merges.filter(function(merge){return merge.row===5&&merge.rowSpan===2;})[0];
 assert.deepEqual([supplierMerge.column,supplierMerge.rowSpan],[1,2],'供应商信息标签纵向合并两行');
 assert.equal(spec.fills.some(function(fill){return fill.row===7&&fill.color===layout.COLORS.header;}),true,'表头浅色填充');
 assert.deepEqual(spec.print.repeatRow,7,'打印重复表头行');
 assert.equal(spec.print.area.rowSpan,valve.values.length,'打印区域覆盖整张询价表');
 assert.equal(spec.print.orientation,'landscape','十列材料横向打印');
 assert.equal(spec.print.paperSize,9,'A4纸张随询价及拆分版式传递');
 assert.equal(spec.print.fitToWidth,1,'十列保持在同一页宽度');
 assert.equal(spec.print.fitToHeight,0,'长清单按高度自然分页，不强缩成一页');
});

test('抬头四项必填、原公司地址可选；缺项或非文本拒绝生成',()=>{
 assert.throws(function(){build({header:header.create()});},/询价抬头不完整/);
 assert.throws(function(){build({header:Object.assign({},head,{company:''})});},/缺少单位名称/);
 const optional=build({header:Object.assign({},head,{address:''})});
 assert.equal(optional.sheets.length,5,'原公司地址可选，不填不影响生成');
 assert.equal(sheetNamed(optional,'阀门_合成询价').headerRow,7);
 const withAddress=build({header:Object.assign({},head,{address:'示例市示例路1号'})});
 assert.equal(sheetNamed(withAddress,'阀门_合成询价').headerRow,8,'填写地址后多一行，表头行随之下移');
 assert.equal(sheetNamed(withAddress,'阀门_合成询价').values[4][0],'原公司地址：示例市示例路1号');
});

test('没有汇总表读回品牌、条数不符或类别缺行都拒绝生成',()=>{
 assert.throws(function(){build({brands:null});},/还没有从分类汇总表读回品牌/);
 assert.throws(function(){build({brands:brands.map(function(item){
  return item.categoryId==='pump'?Object.assign({},item,{rowCount:9}):item;})});},/材料条数与汇总表不一致/);
 assert.throws(function(){build({brands:brands.concat([{categoryId:'missing',categoryName:'缺失类',rowCount:1,
  mode:'synthesize',groups:[{brand:'某',supplier:'某'}]}])});},/没有对应材料行/);
 assert.throws(function(){build({brands:brands.map(function(item){
  return item.categoryId==='valve'?Object.assign({},item,{mode:'unknown'}):item;})});},/没有有效的询价生成方式/);
});

test('超长文本拒绝且不外泄，生成内容不随时间变化',()=>{
 const dirty=preview.groups.map(function(group){
  return group.name==='阀门'&&group.feature==='DN50'?Object.assign({},group,{feature:'x'.repeat(32768)}):group;});
 assert.throws(function(){build({groups:dirty});},/含超长文本|未截断/);
 const first=build(),second=build();
 assert.deepEqual(first.sheets.map(function(sheet){return sheet.values;}),
  second.sheets.map(function(sheet){return sheet.values;}),'同一内容重复生成结果一致，不含时间');
 const book=inquiry.workbook(first,'2026-09-27T00:00:00.000Z'),book2=inquiry.workbook(first,'2027-01-01T00:00:00.000Z');
 assert.deepEqual(book.sheets.slice(0,5).map(function(sheet){return sheet.values;}),
  book2.sheets.slice(0,5).map(function(sheet){return sheet.values;}),'时间只进处理记录页，不进询价页');
});

test('总表工作簿含内部页，生成记录跟踪sheetId、内容键与固定快照',()=>{
 const model=build(),book=inquiry.workbook(model,'2026-09-27T00:00:00.000Z');
 assert.equal(book.sheets.length,7,'5张询价页＋内部追溯页＋处理记录页');
 assert.deepEqual(book.sheets.slice(5).map(function(sheet){return sheet.name;}),[inquiry.TRACE,inquiry.RECORD]);
 assert.equal(book.sheets[5].values.length,model.trace.length);
 assert.ok(book.sheets[6].values.some(function(row){return row[0]==='品牌来源';}));
 const record=inquiry.record(model,{target:'C:\\out\\示例园区_询价总表.xlsx',sha256:'a'.repeat(64),
  generatedAt:'2026-09-27T00:00:00.000Z'});
 assert.deepEqual(record.sheetIds,model.sheets.map(function(sheet){return sheet.sheetId;}));
 assert.equal(record.sheetCount,5);
 assert.equal(record.modelSnapshot.sheets.length,5);
 assert.equal(inquiry.isCurrent(record,model.inputKey),true);
 assert.equal(inquiry.isCurrent(record,'ck2-别的键'),false);
 assert.equal(inquiry.isCurrent(record,''),false);
 assert.equal(inquiry.isCurrent(null,model.inputKey),false);
 assert.throws(function(){inquiry.record(model,{target:''});},/生成记录缺少目标文件/);
 assert.throws(function(){inquiry.record(model,{target:'C:\\a.xlsx',sha256:'zz'});},/SHA256/);
});
