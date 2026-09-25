const test=require('node:test'),assert=require('node:assert/strict');
const brand=require('../src/brand-table.js'),model=require('../src/brand-model.js');
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
