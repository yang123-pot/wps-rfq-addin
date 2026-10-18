const test=require('node:test');const assert=require('node:assert/strict');
let api;try{api=require('../src/assistant-problems.js');}catch(_){api={};}
test('具体问题显示工作表与单元格并给出填写方法',()=>{
 assert.equal(typeof api.describe,'function');const p=api.describe({stage:'review',message:'最终分类为空',issues:[{sheet:'分类审核成果',row:7,column:8,code:'category-empty',message:'最终分类为空'}]});
 assert.match(p.location,/分类审核成果.*H7/);assert.match(p.solution,/无需询价/);assert.equal(p.actionLabel,'去填写');
});
test('抬头缺项、文件冲突和项目冲突有不同解决方式',()=>{
 assert.equal(typeof api.describe,'function');
 assert.match(api.describe({stage:'header',message:'联系方式未填写'}).solution,/联系方式/);
 assert.match(api.describe({stage:'split',message:'目标文件已存在'}).solution,/文件夹|文件名/);
 assert.match(api.describe({stage:'project',status:409,message:'conflict'}).solution,/草稿|保存/);
});
test('未知故障不猜原因；问题去重但保留不同位置',()=>{
 assert.equal(typeof api.describe,'function');assert.match(api.describe({message:'opaque-code-32'}).solution,/详情/);
 assert.equal(api.unique([{message:'空分类',row:7,column:8},{message:'空分类',row:7,column:8},{message:'空分类',row:8,column:8}]).length,2);
});
