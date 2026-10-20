const test=require('node:test');const assert=require('node:assert/strict');
let api;try{api=require('../src/assistant-problems.js');}catch(_){api={};}
test('具体问题显示工作表与单元格并给出填写方法',()=>{
 assert.equal(typeof api.describe,'function');const p=api.describe({stage:'review',message:'最终分类为空',issues:[{sheet:'分类审核成果',row:7,column:8,code:'category-empty',message:'最终分类为空'}]});
 assert.match(p.location,/分类审核成果.*第 H 列第 7 行.*单元格 H7/);assert.match(p.solution,/无需询价/);assert.equal(p.actionLabel,'去填写');
});
test('集中错误把工作表坐标拆开显示，I891不能误读成清单序号1891',()=>{
 const p=api.describe({stage:'review',message:'最终分类为空',issues:[{sheet:'分类审核成果',row:891,column:9,code:'category-empty',message:'最终分类为空'}]});
 assert.match(p.location,/分类审核成果 · 第 I 列第 891 行（单元格 I891）/);
 assert.doesNotMatch(p.location,/· 1891/);
 const precomputed=api.describe({stage:'review',message:'错误',issues:[{sheet:'分类审核成果',cell:'J1888',code:'category-empty'}]});
 assert.match(precomputed.location,/第 J 列第 1888 行（单元格 J1888）/);
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
test('已打开其他目录同名工作簿时提示保存关闭，而不是另存或更换输出位置',()=>{
 const p=api.describe({stage:'brands',message:'分类汇总表未打开：WPS中已打开另一目录的同名分类工作簿：F:\\同名簿B\\示例园区_分类工作簿.xlsx。请先保存并关闭该同名工作簿，再从当前项目重试；插件不会借用或关闭它。'});
 assert.match(p.title,/已打开/);
 assert.match(p.solution,/保存.*关闭.*重试/);
 assert.doesNotMatch(p.solution,/请选择新的输出|另存新文件名/);
 assert.notEqual(p.actionLabel,'更换保存位置');
 assert.match(p.message,/F:\\同名簿B\\示例园区_分类工作簿.xlsx/,'保留实际冲突簿的位置');
});
