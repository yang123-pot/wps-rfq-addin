const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs'),collection=require('../src/collection.js');
const review=require('../src/classification-review-model.js'),source=require('../src/source-review-model.js');

function plan(){
 const col=sample.buildCollection(),preview=collection.preview(col,false,false);
 const result=review.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-source'});
 return {col,preview,result,plan:source.build(col.entries,result,{title:'来源审核'})};
}
test('不合并清单时每本来源各一审核副本，保持原表数量和顺序并覆盖全部材料行',()=>{
 const built=plan(),value=built.plan;
 assert.equal(value.mode,'source-tables');
 assert.equal(value.files.length,2);
 assert.deepEqual(value.files.map(file=>file.originalName),['给排水清单.xlsx','机电清单.xlsx']);
 assert.deepEqual(value.files.map(file=>file.sheets.map(sheet=>sheet.name)),[['给排水'],['机电安装']]);
 assert.equal(value.rowCount,10);
 assert.equal(value.rowIds.length,10);
 assert.equal(new Set(value.rowIds).size,10);
 assert.equal(value.files.reduce((count,file)=>count+file.rowCount,0),10);
});

test('审核副本只在原表有效列右侧追加建议、最终、备注和隐藏行标识列',()=>{
 const value=plan().plan;
 value.files.forEach(file=>file.sheets.forEach(sheet=>{
  assert.equal(sheet.headerRow,2);
  assert.equal(sheet.originLastColumn,5);
  assert.deepEqual([sheet.reviewColumn,sheet.finalColumn,sheet.noteColumn,sheet.rowIdColumn],[6,7,8,9]);
  assert.equal(sheet.rows.every(row=>row.originRows[0].row===row.row),true);
 }));
 const first=value.files[0].sheets[0].rows[0];
 assert.equal(first.finalCategoryName,'水泵','唯一建议仍可预填最终分类');
 assert.equal(value.files[1].sheets[0].rows.find(row=>row.name==='充电桩配电箱').finalCategoryName,'',
  '冲突保留空白，不跨来源合并');
});

test('目标文件名按来源区分并拒绝覆盖同名单',()=>{
 const value=plan().plan;
 assert.deepEqual(source.targets(value,'C:\\成果').map(item=>item.path),[
  'C:\\成果\\给排水清单_分类审核.xlsx','C:\\成果\\机电清单_分类审核.xlsx'
 ]);
 assert.match(source.batchDirectory('C:\\成果','示例园区'),/^C:\\成果\\示例园区_分类审核_\d{14}_[a-z0-9]{6}$/);
 assert.equal(source.rowSummary(value).text,'2 份原表 · 2 张工作表 · 10 条材料');
});
