const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const model=require('../src/import-preview-model.js');
test('图01主工作表：两个文件10行、精确合并8行且明细保留逐来源数量',()=>{
 const collection=sample.buildCollection(),before=JSON.stringify(collection);
 const result=model.build(collection,true,{projectName:'示例园区'});
 assert.equal(result.sheets.length,2);
 assert.deepEqual(result.sheets.map(s=>s.name),['导入预览','合并明细']);
 assert.equal(result.inputCount,10);assert.equal(result.outputCount,8);
 const main=result.sheets[0];
 assert.equal(main.values.filter(row=>row[5]==='1 + 1 = 2').length,1);
 assert.equal(main.values.filter(row=>row[5]==='1 + 2 = 3').length,1);
 assert.equal(main.layout.merges.filter(r=>r.column===6&&r.rowSpan===2).length,2);
 const detail=result.sheets[1];
 assert.equal(detail.values.length,11,'表头加10条来源，不重复累加');
 assert.equal(detail.values.every(row=>row.every(value=>typeof value==='string')),true);
 assert.equal(JSON.stringify(collection),before,'生成预览不修改导入集合');
});
test('默认分别保留10行，预览不声称已经合并或已经分类',()=>{
 const result=model.build(sample.buildCollection(),false,{projectName:'示例园区'});
 assert.equal(result.outputCount,10);
 assert.equal(result.sheets[0].values.some(row=>row.join('').includes('按来源分别保留，同一项目')),true);
 assert.equal(result.sheets[0].values.some(row=>row.join('').includes('所有工作簿默认进入当前项目')),true);
 assert.equal(result.sheets[0].values.some(row=>row[5]==='1 + 1 = 2'),false);
 assert.equal(result.sheets[0].values.every(row=>row.length===6),true);
});
