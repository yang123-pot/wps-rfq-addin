(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqBrandTable=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,DECISION='no-inquiry',
  COVERAGE=['pending','alternative-quotes','material-subsets'],
  COVERAGE_LABELS={pending:'范围未确认','alternative-quotes':'各品牌询同一组完整需求','material-subsets':'各品牌只覆盖指定材料子集'};
 // 生成待填写汇总表时只校验结构与覆盖；品牌阶段只要求品牌；严格校验留给需要供应商的询价拆分步骤。
 var STRUCTURE={requireBrand:false,requireSupplier:false,requireCoverage:false},
  BRAND_STAGE={requireBrand:true,requireSupplier:false,requireCoverage:false},
  STRICT={requireBrand:true,requireSupplier:true,requireCoverage:true};
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function text(value){return value==null?'':String(value).trim();}
 function unique(list){var out=[];(list||[]).forEach(function(item){if(item!=null&&out.indexOf(item)<0)out.push(item);});return out;}
 function rowKeyOf(value){return typeof value==='string'?value:String((value&&(value.id||value.scopeId))||'');}
 // 必须被品牌分配覆盖的行：已确认类别且不是“无需询价”，与build的取行口径一致。
 function requiredRowIds(groups,classification){
  var decisions={};
  ((classification&&classification.decisions)||[]).forEach(function(decision){
   if(decision&&decision.rowId)decisions[decision.rowId]=decision;});
  return (groups||[]).filter(function(group){
   var decision=decisions[rowKeyOf(group)];
   return !!decision&&decision.skip!==true&&decision.categoryId!==DECISION;}).map(rowKeyOf);
 }
 function build(groups,classification,inputKey){
  if(!Array.isArray(groups)||!groups.length)throw Error('没有可生成的材料行，请先完成导入与来源核对。');
  if(!classification||!Array.isArray(classification.decisions))throw Error('请先完成分类确认，再建立分类品牌表。');
  var decisions={};
  classification.decisions.forEach(function(decision){if(decision&&decision.rowId)decisions[decision.rowId]=decision;});
  var missing=groups.filter(function(group){return !decisions[rowKeyOf(group)];});
  if(missing.length)throw Error('还有'+missing.length+'行未确认分类，不能建立分类品牌表。');
  var rows=[];
  groups.forEach(function(group){
   var rowId=rowKeyOf(group),decision=decisions[rowId];
   if(!rowId)throw Error('材料行缺少稳定标识，不能建立分类品牌表。');
   if(decision.skip===true||decision.categoryId===DECISION)return;
   if(group.quantity==null||!/^\d+(?:\.\d+)?$/.test(String(group.quantity)))
    throw Error('材料“'+text(group.name)+'”数量异常，不能建立分类品牌表。');
   rows.push({rowId:rowId,categoryId:decision.categoryId,categoryName:decision.categoryName||decision.categoryId,
    scopeId:group.scopeId,codes:unique((group.sources||[]).map(function(source){return source.code;})),
    name:text(group.name),feature:group.feature==null?'':String(group.feature),unit:text(group.unit),
    quantity:String(group.quantity),sourceIds:(group.sources||[]).map(function(source){return source.id;}),
    sourceLabels:(group.sourceLabels||[]).slice(),sources:copy(group.sources||[])});
  });
  // 默认每个类别一行，人工只需在汇总表里填品牌；同类多品牌时再由用户拆成多行。
  var grouped=[],assignments=[];
  rows.forEach(function(row){
   var found=grouped.filter(function(item){return item.categoryId===row.categoryId;})[0];
   if(!found){found={categoryId:row.categoryId,categoryName:row.categoryName,rowIds:[]};grouped.push(found);}
   found.rowIds.push(row.rowId);
  });
  grouped.forEach(function(category){
   assignments.push(createAssignment({assignments:assignments},category.categoryId,category.rowIds.slice()));
  });
  return {schemaVersion:SCHEMA_VERSION,inputKey:text(inputKey),coverageMode:'pending',rows:rows,assignments:assignments};
 }
 function isEmpty(data){return !((data&&data.rows)||[]).length;}
 function categories(data){
  var out=[],byCategory={};
  ((data&&data.rows)||[]).forEach(function(row){
   if(!byCategory[row.categoryId]){
    byCategory[row.categoryId]={categoryId:row.categoryId,categoryName:row.categoryName||row.categoryId,rowIds:[],count:0};
    out.push(byCategory[row.categoryId]);
   }
   byCategory[row.categoryId].rowIds.push(row.rowId);
   byCategory[row.categoryId].count++;
  });
  return out;
 }
 function rowsOf(data,rowIds){
  var wanted=(rowIds||[]).map(String),out=[];
  ((data&&data.rows)||[]).forEach(function(row){if(wanted.indexOf(row.rowId)>=0)out.push(row);});
  return out;
 }
 function assignmentsFor(data,categoryId){
  return ((data&&data.assignments)||[]).filter(function(assignment){return assignment.categoryId===categoryId;});
 }
 function createAssignment(data,categoryId,rowIds){
  var used={};
  ((data&&data.assignments)||[]).forEach(function(assignment){used[assignment.assignmentId]=true;});
  var attempt='';
  do{attempt='a-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}while(used[attempt]);
  return {assignmentId:attempt,categoryId:String(categoryId||''),rowIds:(rowIds||[]).slice(),brand:'',supplier:'',
   note:'',coverageConfirmed:false,confirmedAt:null};
 }
 // 品牌单一来源：询价表、拆分文件都只能从这里取品牌，不允许另行填写或改写。
 // 多值映射：同一材料行可被多个品牌分配覆盖（分别询价/按品牌分表），这里保留全部而不是后来覆盖前面。
 function brandMap(data){
  var map={};
  ((data&&data.assignments)||[]).forEach(function(assignment){
   (assignment.rowIds||[]).forEach(function(rowId){
    (map[rowId]=map[rowId]||[]).push({assignmentId:assignment.assignmentId,categoryId:assignment.categoryId,
     brand:text(assignment.brand),supplier:text(assignment.supplier),note:text(assignment.note)});
   });
  });
  return map;
 }
 function brandForRow(data,rowId){var found=brandMap(data)[rowId];return found&&found.length?found:null;}
 // 询价表按行取品牌时用这里：没有品牌就等于没有联动，必须报错而不是留空。
 function requireBrands(data,expectedRowIds){
  var map=brandMap(data);
  return (expectedRowIds||[]).map(function(rowId){
   var found=map[rowId];
   if(!found||!found.length)throw Error('材料行没有对应的品牌分配：'+String(rowId));
   // 显式携带该行适用的全部品牌/供应商组：分别生成取当前组、合成列出全部组，不再被最后一组覆盖。
   var groups=found.map(function(item){
    if(!item.brand)throw Error('材料行还没有填写品牌：'+String(rowId));
    return {brand:item.brand,supplier:item.supplier,assignmentId:item.assignmentId};});
   return {rowId:rowId,categoryId:found[0].categoryId,brand:groups[0].brand,supplier:groups[0].supplier,
    assignmentId:groups[0].assignmentId,groups:groups,
    assignmentIds:found.map(function(item){return item.assignmentId;})};
  });
 }
 function setCoverageMode(data,mode){
  if(COVERAGE.indexOf(mode)<0)throw Error('无法识别的覆盖范围模式：'+String(mode));
  var next=copy(data||{});
  next.coverageMode=mode;
  if(mode==='pending'){
   // 范围退回未确认时，已确认标记必须一起失效，避免旧确认被当成新口径。
   next.assignments=(next.assignments||[]).map(function(assignment){
    return Object.assign({},assignment,{coverageConfirmed:false,confirmedAt:null});});
  }
  return next;
 }
 // options.allowEmptyBrands用于“生成待填写的品牌表”这一步：结构与覆盖仍要完整，品牌与供应商允许留空等用户填写。
 function validate(data,expectedRows,options){
  var settings=options||{},requireBrand=settings.requireBrand!==false,
   requireSupplier=settings.requireSupplier!==false,requireCoverage=settings.requireCoverage!==false;
  var errors=[];
  if(!data||typeof data!=='object'||Array.isArray(data))return {ok:false,errors:['分类品牌数据不是有效对象。']};
  if(data.schemaVersion!==SCHEMA_VERSION)errors.push('分类品牌数据版本不支持：'+String(data.schemaVersion));
  if(typeof data.inputKey!=='string'||!data.inputKey)errors.push('分类品牌数据缺少内容键。');
  if(COVERAGE.indexOf(data.coverageMode)<0)errors.push('覆盖范围模式无效：'+String(data.coverageMode));
  if(!Array.isArray(data.rows))errors.push('分类品牌数据缺少材料行。');
  if(!Array.isArray(data.assignments))errors.push('分类品牌数据缺少品牌分配。');
  var list=data.rows||[],byRow={};
  list.forEach(function(row,index){
   var at='第'+(index+1)+'个材料行';
   if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(at+'无效。');return;}
   if(typeof row.rowId!=='string'||!row.rowId)errors.push(at+'缺少行标识。');
   else if(byRow[row.rowId])errors.push('材料行标识重复：'+row.rowId);
   else byRow[row.rowId]=row;
   if(typeof row.categoryId!=='string'||!row.categoryId)errors.push(at+'缺少类别。');
   if(typeof row.name!=='string'||!row.name)errors.push(at+'缺少材料名称。');
   if(typeof row.unit!=='string'||!row.unit)errors.push(at+'缺少单位。');
   if(typeof row.quantity!=='string'||!/^\d+(?:\.\d+)?$/.test(row.quantity))errors.push(at+'数量不是文本十进制。');
   if(!Array.isArray(row.sourceIds)||!row.sourceIds.length)errors.push(at+'缺少来源追溯。');
  });
  if(Array.isArray(expectedRows)){
   var expected=expectedRows.map(rowKeyOf);
   expected.forEach(function(rowId){if(!byRow[rowId])errors.push('缺少材料行：'+rowId);});
   Object.keys(byRow).forEach(function(rowId){if(expected.indexOf(rowId)<0)errors.push('材料行不属于当前清单：'+rowId);});
  }
  var assignments=data.assignments||[],byId={},covered={};
  assignments.forEach(function(assignment,index){
   var at='第'+(index+1)+'条品牌分配';
   if(!assignment||typeof assignment!=='object'||Array.isArray(assignment)){errors.push(at+'无效。');return;}
   if(typeof assignment.assignmentId!=='string'||!assignment.assignmentId)errors.push(at+'缺少标识。');
   else if(byId[assignment.assignmentId])errors.push('品牌分配标识重复：'+assignment.assignmentId);
   else byId[assignment.assignmentId]=assignment;
   if(typeof assignment.categoryId!=='string'||!assignment.categoryId)errors.push(at+'缺少类别。');
   else if(list.length&&!list.some(function(row){return row.categoryId===assignment.categoryId;}))
    errors.push(at+'引用了当前清单没有的类别：'+assignment.categoryId);
   if(requireBrand&&!text(assignment.brand))errors.push(at+'品牌为空，不能自动补空。');
   if(requireSupplier&&!text(assignment.supplier))errors.push(at+'供应商为空，不能自动补空。');
   if(!Array.isArray(assignment.rowIds)||!assignment.rowIds.length)errors.push(at+'缺少材料行。');
   var seen={};
   (assignment.rowIds||[]).forEach(function(rowId){
    if(seen[rowId]){errors.push(at+'重复引用材料行：'+rowId);return;}
    seen[rowId]=true;
    var row=byRow[rowId];
    if(!row){errors.push(at+'引用了未知材料行：'+rowId);return;}
    if(row.categoryId!==assignment.categoryId)errors.push(at+'类别与材料行不一致：'+rowId);
    (covered[rowId]=covered[rowId]||[]).push(assignment.assignmentId);
   });
   if(requireCoverage&&assignment.coverageConfirmed!==true)errors.push(at+'覆盖范围尚未确认。');
  });
  list.forEach(function(row){
   if(row&&row.rowId&&!covered[row.rowId])errors.push('材料行漏配品牌与供应商：'+row.rowId);
  });
  if(requireCoverage&&list.length&&data.coverageMode==='pending')errors.push('覆盖范围模式仍是未确认，不能算完成。');
  return {ok:errors.length===0,errors:errors};
 }
 // 品牌阶段：汇总表每一行都必须填品牌；供应商与范围确认留给后续询价拆分步骤。
 function validateBrands(data,expectedRows){return validate(data,expectedRows,BRAND_STAGE);}
 return {SCHEMA_VERSION:SCHEMA_VERSION,DECISION:DECISION,COVERAGE:COVERAGE.slice(),COVERAGE_LABELS:COVERAGE_LABELS,
  STRUCTURE:STRUCTURE,BRAND_STAGE:BRAND_STAGE,STRICT:STRICT,
  build:build,validate:validate,validateBrands:validateBrands,categories:categories,rowsOf:rowsOf,
  assignmentsFor:assignmentsFor,requiredRowIds:requiredRowIds,brandMap:brandMap,brandForRow:brandForRow,
  requireBrands:requireBrands,
  createAssignment:createAssignment,setCoverageMode:setCoverageMode,isEmpty:isEmpty};
}));
