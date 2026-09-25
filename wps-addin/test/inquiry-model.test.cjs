const test=require('node:test'),assert=require('node:assert/strict');
const brand=require('../src/brand-table.js'),header=require('../src/inquiry-header.js'),inquiry=require('../src/inquiry-model.js');
function source(id,name,code,quantity){
 return {id:id,itemId:'i-'+id,file:name+'.xlsx',path:'C:\\samples\\'+name+'.xlsx',sheet:'给排水',row:id.length,
  rows:[id.length],code:code,quantity:quantity,quantityRaw:quantity,unit:'个',engineering:'测试楼',profession:'给排水'};
}
function group(id,name,feature,unit,quantity,sources){
 return {id:id,scopeId:'C:/copies/a.xlsx',name:name,feature:feature,unit:unit,quantity:quantity,sources:sources,
  sourceLabels:['测试楼—给排水']};
}
const groups=[group('row-1','水龙头','DN15','个','1',[source('s1','a','000124','1')]),
 group('row-2','水龙头','DN20','个','2',[source('s2','b','000125','2')]),
 group('row-3','钢索','','套','2',[source('s3','b','000126','2')])];
const classification={schemaVersion:1,revision:1,decisions:[
 {rowId:'row-1',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'t'},
 {rowId:'row-2',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'t'},
 {rowId:'row-3',categoryId:'no-inquiry',categoryName:'无需询价',skip:true,confirmedAt:'t'}],history:[]};
const head={schemaVersion:1,company:'测试安装工程有限公司',address:'测试市测试路1号',phone:'010-12345678',
 projectName:'测试楼项目',contact:'测试员'};
function withBrands(list){
 const built=brand.build(groups,classification,'ck1-inquiry');
 return Object.assign({},built,{coverageMode:'material-subsets',assignments:list.map(function(item,index){
  return Object.assign({assignmentId:'a-'+(index+1),categoryId:'water-valve',rowIds:[],brand:'',supplier:'',
   note:'',coverageConfirmed:true,confirmedAt:null},item);})});
}
function build(data,extra){
 return inquiry.build(Object.assign({brandTable:data,header:head,inputKey:data.inputKey,
  groups:groups,classification:classification},extra||{}));
}
test('each brand row becomes one inquiry sheet with the local header layout',()=>{
 const data=withBrands([{rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A',note:'含税'}]);
 const model=build(data);
 assert.equal(model.sheets.length,1);
 const sheet=model.sheets[0];
 assert.equal(sheet.kind,'inquiry');
 assert.equal(sheet.assignmentId,'a-1');
 assert.match(sheet.name,/水阀门-品牌甲/);
 assert.deepEqual(sheet.values.slice(0,6).map(row=>row[0]),
  ['测试安装工程有限公司','公司地址：测试市测试路1号','电话：010-12345678','供货单位：供应商A','工程名称：测试楼项目','材料员：测试员']);
 assert.equal(sheet.layout.headerRow,7);
 assert.deepEqual(sheet.values[6],inquiry.COLUMNS);
 assert.deepEqual(sheet.values[7].slice(0,10),['1','000124','水龙头','DN15','个','1','品牌甲','','','含税']);
 assert.equal(sheet.values[8][6],'品牌甲','同一品牌行的材料共用该品牌');
 assert.equal(sheet.values.length,9);
 assert.equal(sheet.values.every(row=>row.every(value=>typeof value==='string')),true);
});
test('the brand in the inquiry sheet always follows the brand table',()=>{
 const first=build(withBrands([{rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A'}]));
 const second=build(withBrands([{rowIds:['row-1','row-2'],brand:'品牌乙',supplier:'供应商A'}]));
 assert.equal(first.sheets[0].values[7][6],'品牌甲');
 assert.equal(second.sheets[0].values[7][6],'品牌乙');
 assert.equal(first.sheets[0].values[7][7],'','报价单价先留空');
 assert.equal(first.sheets[0].values[7][8],'','金额先留空');
});
test('two brand rows produce two sheets and a name collision is resolved without overwriting',()=>{
 const data=withBrands([{rowIds:['row-1'],brand:'品牌甲',supplier:'供应商A'},
  {rowIds:['row-2'],brand:'品牌甲',supplier:'供应商B'}]);
 const model=build(data);
 assert.equal(model.sheets.length,2);
 assert.equal(new Set(model.sheets.map(sheet=>sheet.name)).size,2,'工作表名不得重复');
 assert.equal(model.sheets.every(sheet=>sheet.name.length<=31),true,'工作表名不得超过31个字符');
 assert.equal(model.trace.length,3,'内部追溯页包含表头与两条材料');
});
test('unconfirmed brands, missing headers and oversized text are refused',()=>{
 const plain=brand.build(groups,classification,'ck1-inquiry');
 assert.throws(()=>build(plain),/品牌或覆盖范围还没确认/);
 const data=withBrands([{rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A'}]);
 assert.throws(()=>inquiry.build({brandTable:data,header:header.create(),groups:groups,classification:classification}),/询价抬头不完整/);
 const long=withBrands([{rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A'}]);
 long.rows=long.rows.map(function(row){return row.rowId==='row-1'?Object.assign({},row,{feature:'x'.repeat(32768)}):row;});
 assert.throws(()=>build(long),/含超长文本|未截断/);
});
test('formula-looking text stays text and never becomes a formula column',()=>{
 const data=withBrands([{rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A',note:'=1+1'}]);
 const model=build(data);
 assert.equal(model.sheets[0].values[7][9],'=1+1','字面公式样文本按文本保留');
 assert.deepEqual(inquiry.COLUMNS.slice(0,6),['序号','项目编码','项目名称','项目特征描述','单位','工程量']);
 assert.equal(inquiry.COLUMNS.includes('原价'),false);
 assert.equal(model.sheets[0].values[7].length,inquiry.COLUMNS.length,'对外列必须与白名单一致');
});
test('the workbook adds internal pages and the generation record tracks the content key',()=>{
 const data=withBrands([{rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A'}]);
 const model=build(data);
 const book=inquiry.workbook(model,'2026-09-26T00:00:00.000Z');
 assert.equal(book.sheets.length,3,'对外询价页＋内部追溯页＋处理记录页');
 assert.deepEqual(book.sheets.map(sheet=>sheet.name).slice(1),[inquiry.TRACE,inquiry.RECORD]);
 assert.ok(book.sheets[2].values.some(row=>row[0]==='品牌来源'));
 const record=inquiry.record(model,{target:'C:\\out\\项目询价.xlsx',sha256:'a'.repeat(64),generatedAt:'2026-09-26T00:00:00.000Z'});
 assert.deepEqual(record.sheetIds,model.sheets.map(sheet=>sheet.sheetId));
 assert.equal(record.modelSnapshot.sheets.length,1);
 assert.equal(inquiry.isCurrent(record,data.inputKey),true);
 assert.equal(inquiry.isCurrent(record,'ck1-别的键'),false);
 assert.equal(inquiry.isCurrent(record,''),false);
 assert.throws(()=>inquiry.record(model,{target:''}),/生成记录缺少目标文件/);
 assert.throws(()=>inquiry.record(model,{target:'C:\\a.xlsx',sha256:'zz'}),/SHA256/);
});
