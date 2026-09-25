const test=require('node:test'),assert=require('node:assert/strict');
const brand=require('../src/brand-table.js'),collection=require('../src/collection.js');
function source(id,name,code,quantity,engineering){
 return {id:id,itemId:'i-'+id,file:name+'.xlsx',path:'C:\\samples\\'+name+'.xlsx',sheet:'给排水',row:id.length,
  rows:[id.length],code:code,quantity:quantity,quantityRaw:quantity,unit:'m',engineering:engineering||'测试楼',profession:'给排水'};
}
function group(id,name,feature,unit,quantity,sources,scopeId){
 return {id:id,scopeId:scopeId||'C:/copies/a.xlsx',name:name,feature:feature,unit:unit,quantity:quantity,
  sources:sources,sourceLabels:['测试楼—给排水']};
}
const groups=[
 group('row-1','水管','DN50','m','0.3',[source('s1','a','000123','0.1'),source('s2','b','000123','0.2')]),
 group('row-2','水龙头','DN15','个','1',[source('s3','a','000124','1')]),
 group('row-3','钢索','','套','2',[source('s4','b','000125','2')])
];
function classification(decisions){
 return {schemaVersion:1,revision:1,updatedAt:'2026-09-26T00:00:00.000Z',decisions:decisions,history:[]};
}
const confirmed=classification([
 {rowId:'row-1',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'2026-09-26T00:00:00.000Z'},
 {rowId:'row-2',categoryId:'water-valve',categoryName:'水阀门',skip:false,confirmedAt:'2026-09-26T00:00:00.000Z'},
 {rowId:'row-3',categoryId:'no-inquiry',categoryName:'无需询价',skip:true,confirmedAt:'2026-09-26T00:00:00.000Z'}
]);
const required=brand.requiredRowIds(groups,confirmed);
test('build refuses an incomplete classification instead of guessing categories',()=>{
 assert.throws(()=>brand.build(groups,classification([]),'ck1-test'),/未确认分类/);
 assert.throws(()=>brand.build(groups,null,'ck1-test'),/请先完成分类确认/);
 assert.throws(()=>brand.build([],confirmed,'ck1-test'),/没有可生成的材料行/);
 const draft={schemaVersion:1,revision:1,decisions:[
  {rowId:'row-1',categoryId:'water-valve',categoryName:'水阀门',confirmedAt:'2026-09-26T00:00:00.000Z'}],history:[]};
 assert.throws(()=>brand.build(groups,draft,'ck1-test'),/2行未确认分类/);
});
test('build keeps row identity, source trace and text quantities while dropping no-inquiry rows',()=>{
 const data=brand.build(groups,confirmed,'ck1-test');
 assert.deepEqual(Object.keys(data).sort(),['assignments','coverageMode','inputKey','rows','schemaVersion']);
 assert.equal(data.inputKey,'ck1-test');
 assert.equal(data.coverageMode,'pending','Q1未定时保留未确认状态，不得自动选择口径');
 assert.equal(data.assignments.length,1,'默认按类别自动生成一行，人工只需要填品牌');
 assert.deepEqual(data.assignments[0].rowIds,['row-1','row-2']);
 assert.equal(data.assignments[0].categoryId,'water-valve');
 assert.equal(data.assignments[0].brand,'');
 assert.equal(data.assignments[0].supplier,'','不得自动补品牌或供应商');
 assert.deepEqual(data.rows.map(row=>row.rowId),['row-1','row-2']);
 const water=data.rows[0];
 assert.equal(water.categoryId,'water-valve');
 assert.equal(water.categoryName,'水阀门');
 assert.equal(water.quantity,'0.3');
 assert.equal(water.unit,'m');
 assert.equal(water.scopeId,'C:/copies/a.xlsx');
 assert.deepEqual(water.codes,['000123']);
 assert.deepEqual(water.sourceIds,['s1','s2']);
 assert.equal(water.sources.length,2);
 assert.equal(brand.isEmpty(data),false);
 assert.deepEqual(brand.categories(data).map(item=>[item.categoryId,item.count]),[['water-valve',2]]);
 assert.deepEqual(brand.rowsOf(data,['row-2']).map(row=>row.name),['水龙头']);
});
test('an all no-inquiry project yields an empty result that is allowed to be saved',()=>{
 const allSkip=classification([
  {rowId:'row-1',categoryId:'no-inquiry',categoryName:'无需询价',skip:true,confirmedAt:'2026-09-26T00:00:00.000Z'},
  {rowId:'row-2',categoryId:'no-inquiry',categoryName:'无需询价',skip:true,confirmedAt:'2026-09-26T00:00:00.000Z'},
  {rowId:'row-3',categoryId:'no-inquiry',categoryName:'无需询价',skip:true,confirmedAt:'2026-09-26T00:00:00.000Z'}
 ]);
 const data=brand.build(groups,allSkip,'ck1-empty');
 assert.deepEqual(data.rows,[]);
 assert.equal(brand.isEmpty(data),true);
 assert.deepEqual(brand.validate(data,[]),{ok:true,errors:[]},'没有供应商文件时仍允许保存空状态');
});
test('validate blocks empty brand, empty supplier, unconfirmed coverage and unknown rows',()=>{
 const data=brand.build(groups,confirmed,'ck1-test');
 const filled=Object.assign({},data,{coverageMode:'material-subsets'});
 const blank=Object.assign({},filled,{assignments:[{assignmentId:'a-1',categoryId:'water-valve',
  rowIds:['row-1','row-2'],brand:'',supplier:'供应商甲',note:'',coverageConfirmed:true,confirmedAt:null}],rows:data.rows});
 assert.match(brand.validate(blank,required).errors.join('；'),/品牌为空/);
 const noSupplier=Object.assign({},filled,{assignments:[{assignmentId:'a-1',categoryId:'water-valve',
  rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'',note:'',coverageConfirmed:true,confirmedAt:null}]});
 assert.match(brand.validate(noSupplier,required).errors.join('；'),/供应商为空/);
 const unconfirmed=Object.assign({},filled,{assignments:[{assignmentId:'a-1',categoryId:'water-valve',
  rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商甲',note:'',coverageConfirmed:false,confirmedAt:null}]});
 assert.match(brand.validate(unconfirmed,required).errors.join('；'),/覆盖范围尚未确认/);
 const pending=Object.assign({},data,{assignments:unconfirmed.assignments});
 assert.match(brand.validate(pending,required).errors.join('；'),/覆盖范围模式仍是未确认/);
 const unknown=Object.assign({},filled,{assignments:[{assignmentId:'a-1',categoryId:'water-valve',
  rowIds:['row-3'],brand:'品牌甲',supplier:'供应商甲',note:'',coverageConfirmed:true,confirmedAt:null}]});
 const unknownErrors=brand.validate(unknown,required).errors.join('；');
 assert.match(unknownErrors,/类别与材料行不一致|未知材料行/);
 assert.match(unknownErrors,/漏配品牌与供应商/);
});
test('validate catches duplicate row references, duplicate ids, missing rows and stray rows',()=>{
 const data=brand.build(groups,confirmed,'ck1-test');
 const base=Object.assign({},data,{coverageMode:'alternative-quotes'});
 const duplicate=Object.assign({},base,{assignments:[
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1','row-1'],brand:'甲',supplier:'S1',coverageConfirmed:true},
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-2'],brand:'乙',supplier:'S2',coverageConfirmed:true}]});
 const errors=brand.validate(duplicate,required).errors.join('；');
 assert.match(errors,/重复引用材料行：row-1/);
 assert.match(errors,/品牌分配标识重复：a-1/);
 const missing=Object.assign({},base,{assignments:[{assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1'],
  brand:'甲',supplier:'S1',coverageConfirmed:true}]});
 assert.match(brand.validate(missing,required).errors.join('；'),/漏配品牌与供应商：row-2/);
 const stray=Object.assign({},base,{rows:base.rows.concat([{rowId:'row-9',categoryId:'water-valve',categoryName:'水阀门',
  scopeId:'x',codes:[],name:'多出来的行',feature:'',unit:'m',quantity:'1',sourceIds:['s9'],sourceLabels:[],sources:[]}])});
 assert.match(brand.validate(stray,required).errors.join('；'),/材料行不属于当前清单：row-9/);
});
test('two brands under one category are valid when the coverage mode says so',()=>{
 const data=brand.build(groups,confirmed,'ck1-test');
 const subsets=Object.assign({},data,{coverageMode:'material-subsets',assignments:[
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1'],brand:'品牌甲',supplier:'供应商A',note:'',coverageConfirmed:true,confirmedAt:'2026-09-26T00:00:00.000Z'},
  {assignmentId:'a-2',categoryId:'water-valve',rowIds:['row-2'],brand:'品牌乙',supplier:'供应商B',note:'',coverageConfirmed:true,confirmedAt:'2026-09-26T00:00:00.000Z'}]});
 assert.deepEqual(brand.validate(subsets,required),{ok:true,errors:[]});
 assert.equal(brand.assignmentsFor(subsets,'water-valve').length,2);
 const alternative=Object.assign({},data,{coverageMode:'alternative-quotes',assignments:[
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A',coverageConfirmed:true,confirmedAt:null},
  {assignmentId:'a-2',categoryId:'water-valve',rowIds:['row-1','row-2'],brand:'品牌乙',supplier:'供应商B',coverageConfirmed:true,confirmedAt:null}]});
 assert.deepEqual(brand.validate(alternative,required),{ok:true,errors:[]},'替代询价允许两个品牌各询同一组完整需求');
});
test('coverage mode changes never keep an old confirmation and unknown modes are refused',()=>{
 const data=brand.build(groups,confirmed,'ck1-test');
 const confirmedData=Object.assign({},data,{coverageMode:'material-subsets',assignments:[
  {assignmentId:'a-1',categoryId:'water-valve',rowIds:['row-1','row-2'],brand:'品牌甲',supplier:'供应商A',
   coverageConfirmed:true,confirmedAt:'2026-09-26T00:00:00.000Z'}]});
 const reset=brand.setCoverageMode(confirmedData,'pending');
 assert.equal(reset.assignments[0].coverageConfirmed,false);
 assert.equal(reset.assignments[0].confirmedAt,null);
 assert.match(brand.validate(reset,required).errors.join('；'),/覆盖范围尚未确认/);
 assert.throws(()=>brand.setCoverageMode(confirmedData,'whatever'),/无法识别的覆盖范围模式/);
});
test('build works on the real preview groups and follows the confirmed decisions',()=>{
 function input(name,fingerprint,rows){
  return {metadata:{originalPath:'C:\\samples\\'+name,originalName:name,copyPath:'C:\\copies\\'+name,fingerprint:fingerprint},
   snapshot:{name:name,path:'C:\\samples\\'+name,fingerprint:fingerprint,
    sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:rows.length,columnCount:5,values:rows}]}};
 }
 const head=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量']];
 const built=collection.add(collection.create(),[
  input('a.xlsx','a'.repeat(64),head.concat([['000123','水管','DN50','m','0.1']])),
  input('b.xlsx','b'.repeat(64),head.concat([['000123','水管','DN50','m','0.2']]))]);
 const preview=collection.preview(built,true);
 assert.equal(preview.canFinalize,true);
 const state=classification(preview.groups.map((group,index)=>({rowId:group.id||group.scopeId,
  categoryId:index===0?'water-valve':'no-inquiry',categoryName:index===0?'水阀门':'无需询价',skip:index!==0,
  confirmedAt:'2026-09-26T00:00:00.000Z'})));
 const data=brand.build(preview.groups,state,'ck1-real');
 assert.equal(preview.groups.length,1);
 assert.equal(data.rows.length,1);
 assert.equal(data.rows[0].quantity,'0.3','精确合并后数量按文本十进制守恒');
 assert.equal(data.rows[0].sourceIds.length,2);
 assert.equal(data.assignments.length,1,'一个类别默认一行，人工只需填品牌');
 assert.deepEqual(data.assignments[0].rowIds,[data.rows[0].rowId]);
 assert.match(brand.validate(data,brand.requiredRowIds(preview.groups,state)).errors.join('；'),/品牌为空/,
  '严格校验（询价拆分步骤用）仍要求供应商与范围确认');
 assert.match(brand.validateBrands(data,brand.requiredRowIds(preview.groups,state)).errors.join('；'),/品牌为空/);
});
test('the brand stage only needs a brand while the strict check still wants a supplier',()=>{
 const data=brand.build(groups,confirmed,'ck1-brand'),required=brand.requiredRowIds(groups,confirmed);
 assert.equal(data.assignments.length,1);
 assert.equal(brand.validateBrands(data,required).ok,false);
 assert.match(brand.validateBrands(data,required).errors.join('；'),/品牌为空/);
 const filled=Object.assign({},data,{assignments:[{...data.assignments[0],brand:'某品牌'}]});
 assert.deepEqual(brand.validateBrands(filled,required),{ok:true,errors:[]},'人工只填品牌即可通过品牌阶段');
 assert.equal(brand.validate(filled,required).ok,false,'严格校验仍要求供应商');
 const covered=Object.assign({},filled,{coverageMode:'material-subsets',
  assignments:[{...filled.assignments[0],supplier:'某供应商',coverageConfirmed:true}]});
 assert.deepEqual(brand.validate(covered,required),{ok:true,errors:[]});
 assert.equal(brand.STRUCTURE.requireBrand,false);
 assert.equal(brand.validate(data,required,brand.STRUCTURE).ok,true,'生成待填写汇总表时品牌可以为空');
});
test('the brand filled in the summary is the only source for the quotation brand column',()=>{
 const data=brand.build(groups,confirmed,'ck1-brand'),required=brand.requiredRowIds(groups,confirmed);
 const filled=Object.assign({},data,{assignments:[Object.assign({},data.assignments[0],{brand:'品牌甲'})]});
 const map=brand.brandMap(filled);
 assert.deepEqual(Object.keys(map).sort(),['row-1','row-2'],'每个材料行都要能查到品牌');
 assert.equal(map['row-1'].brand,'品牌甲');
 assert.equal(map['row-2'].brand,'品牌甲','同一类别默认同一品牌');
 assert.equal(map['row-1'].assignmentId,filled.assignments[0].assignmentId);
 const linked=brand.requireBrands(filled,required);
 assert.deepEqual(linked.map(item=>[item.rowId,item.brand]),[['row-1','品牌甲'],['row-2','品牌甲']]);
 assert.equal(brand.brandForRow(filled,'row-3'),null,'无需询价行不参与品牌联动');
 const empty=brand.build(groups,confirmed,'ck1-brand');
 assert.throws(()=>brand.requireBrands(empty,required),/还没有填写品牌/,'汇总表没填品牌时询价表不得留空放过');
 assert.throws(()=>brand.requireBrands(filled,required.concat(['row-9'])),/没有对应的品牌分配/);
 const split=Object.assign({},filled,{assignments:[
  Object.assign({},filled.assignments[0],{rowIds:['row-1'],brand:'品牌甲'}),
  Object.assign({},filled.assignments[0],{assignmentId:'a-2',rowIds:['row-2'],brand:'品牌乙'})]});
 assert.deepEqual(brand.requireBrands(split,required).map(item=>item.brand),['品牌甲','品牌乙'],
  '同类多品牌时按材料行分别联动，不复制数量也不吞并品牌');
});
