const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const model=require('../src/classification-review-model.js');
const memory=require('../src/category-memory.js');
const layout=require('../src/workbook-layout.js');

function built(){
  const col=sample.buildCollection();
  const preview=collection.preview(col,true);
  return {preview:preview,result:model.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'})};
}

test('自动分类只给建议：8行中7行有建议、1行冲突，全部尚未人工确认',()=>{
  const {preview,result}=built();
  assert.equal(preview.groups.length,8,'合并后应8行');
  assert.equal(result.counts.rows,8);
  assert.equal(result.counts.suggested,6,'水泵/阀门/风机共6行唯一建议');
  assert.equal(result.counts.skip,1,'钢索1行建议无需询价');
  assert.equal(result.counts.conflict,1,'充电桩配电箱1行冲突');
  assert.equal(result.counts.none,0);
  assert.equal(result.counts.pending,8,'全部仍是待人工确认');
  assert.equal(result.rows.every(row=>row.reviewNote===''),true,'生成阶段不写审核备注');
  const summary=model.summary(result);
  assert.equal(summary.text,'8 行结果已写入成果表');
  assert.equal(summary.detail,'7 行有建议 · 1 行需重点核对','与图02侧栏统计一致');
  assert.equal(summary.confirmed,0,'尚未人工确认');
});

test('唯一可靠建议预填最终分类，冲突行留空并标为异常',()=>{
  const {result}=built();
  const byKey={};
  result.rows.forEach(row=>{byKey[sample.keyOf(row.name,row.feature,row.unit)]=row;});
  assert.equal(byKey[sample.keyOf('水泵','DN50','台')].finalCategoryName,'水泵','唯一建议预填');
  assert.equal(byKey[sample.keyOf('钢索','规格C','m')].finalCategoryName,'无需询价','无需询价可预填');
  assert.equal(byKey[sample.keyOf('钢索','规格C','m')].matchState,'无需询价');
  const conflict=byKey[sample.keyOf('充电桩配电箱','充电桩配套','台')];
  assert.equal(conflict.matchState,'分类冲突');
  assert.equal(conflict.finalCategoryId,'','冲突必须留空交给用户决定');
  assert.equal(conflict.abnormal,true,'冲突行必须突出显示');
  assert.match(conflict.matchBasis,/多个类别/);
  assert.match(byKey[sample.keyOf('水泵','DN50','台')].matchBasis,/完全匹配/);
});

test('成果表按图03列序输出9列，规格保存完整特征，编码与来源只进内部绑定',()=>{
  const {result}=built();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  assert.deepEqual(model.COLUMNS,['序号','项目名称','规格','单位','工程量','自动建议','匹配情况','最终分类','审核备注']);
  assert.deepEqual(sheet.values[2].slice(0,9),model.COLUMNS,'第3行前9列是公开表头');
  assert.deepEqual(sheet.values[2].slice(9),['',''],'表头右侧只留辅助列位');
  assert.equal(sheet.values[0][0],'示例园区_分类审核成果.xlsx','标题行与图02一致');
  assert.match(sheet.values[1][0],/自动匹配仅供参考/);
  assert.equal(sheet.values.length,model.HEADER_ROW+result.rows.length,'标题2行＋表头1行＋全部有效行');
  assert.deepEqual(model.publicRow(result.rows[0]),['1','水泵','DN50','台','2','水泵','匹配成功','水泵','']);
  assert.equal(sheet.values[3][2],'DN50','规格列保存完整项目特征描述');
  assert.equal(sheet.values[3][4],'2','工程量按文本写入，保留精度');
  assert.equal(sheet.values[3].length,11,'公开9列＋序号/行标识辅助列');
  assert.equal(sheet.values[3][10],result.rows[0].rowId,'K列保存稳定rowId');
  assert.equal(model.COLUMNS.includes(result.rows[0].code),false,'主表不得出现技术字段');
  const binding=model.bindingSheet(result);
  assert.deepEqual(binding.values[0],['行标识','序号','项目编码','项目名称','项目特征描述','单位','工程量','来源边界','来源标识','库版本']);
  assert.equal(binding.values[1][2],result.rows[0].code,'编码只在内部绑定表');
  assert.equal(binding.values.length,result.rows.length+1);
});

test('版式落地：表头浅色、最终分类浅黄带区域下拉、异常行橙色、隐藏辅助列、冻结与打印',()=>{
  const {result}=built();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  const spec=sheet.layout;
  assert.equal(layout.validate(spec,{rowCount:sheet.values.length,columnCount:11}).ok,true);
  assert.equal(spec.columns[10].hidden,true,'行标识列必须隐藏');
  assert.equal(spec.columns[9].hidden,false);
  assert.equal(spec.freeze.row,model.FIRST_ROW,'冻结表头');
  assert.equal(spec.print.repeatRow,model.HEADER_ROW,'打印重复表头');
  assert.deepEqual(spec.merges.map(item=>item.columnSpan),[9,9]);
  const header=spec.fills.filter(item=>item.row===model.HEADER_ROW&&item.color===layout.COLORS.header);
  assert.equal(header.length,1,'表头浅色填充');
  const input=spec.fills.filter(item=>item.column===8&&item.color===layout.COLORS.input);
  assert.equal(input.length,1,'最终分类列浅黄可编辑');
  assert.equal(input[0].rowSpan,result.rows.length);
  const abnormal=spec.fills.filter(item=>item.color===layout.COLORS.accent);
  assert.equal(abnormal.length,result.counts.conflict,'异常行橙色');
  assert.equal(abnormal[0].columnSpan,9);
  assert.equal(spec.validations.length,1,'最终分类列挂区域下拉');
  assert.equal(spec.validations[0].column,8);
  assert.equal(spec.validations[0].listSheet,model.OPTIONS_SHEET);
  assert.equal(spec.validations[0].listRange,'$B$2:$B$'+String(result.categories.length+1));
  const options=model.optionsSheet(result);
  assert.deepEqual(options.values[0],['类别编号','类别名称']);
  assert.equal(options.values.length,result.categories.length+1,'下拉选项来自内部表');
});

test('生成成果表不学习、不确认：传入记忆也不写回、阶段仍是待确认',()=>{
  const col=sample.buildCollection(),preview=collection.preview(col,true),state=sample.createMemory();
  const before=JSON.stringify(state);
  const result=model.build(preview.groups,{library:sample.library,memory:state,projectId:'p-sample01'});
  assert.equal(JSON.stringify(state),before,'生成建议不得写入习惯记忆');
  assert.equal(result.counts.pending,result.counts.rows,'全部仍待人工确认');
  assert.equal(memory.summary(state).active,0);
  const again=model.build(preview.groups,{library:sample.library,memory:state,projectId:'p-sample01'});
  assert.deepEqual(again.counts,result.counts,'重复生成结果一致');
  assert.deepEqual(model.expectedRows(again),model.expectedRows(result),'固定字段快照可重复比对');
  assert.throws(()=>model.build(preview.groups,{}),/分类库/);
  assert.throws(()=>model.build(null,{library:sample.library}),/已确认的合并结果/);
  assert.throws(()=>model.build(preview.groups,{library:{version:'x',categories:[],rules:[]}}),/分类库不可用/);
});
