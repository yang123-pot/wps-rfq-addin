const test=require('node:test'),assert=require('node:assert/strict');
const restore=require('../src/project-restore.js');
const sha=function(value){return String(value).repeat(64).slice(0,64);};
function project(){
 const root='C:\\成果\\示例园区';
 return {projectId:'p-restore-0001',revision:3,
  matching:{path:root+'\\示例园区_分类审核成果.xlsx',sha256:sha('a'),inputKey:'ck2-review'},
  review:{sheet:{path:root+'\\示例园区_分类审核成果.xlsx'},rows:[{rowId:'r1'}]},
  categories:{root:root,directory:root+'\\分类工作簿',files:[
   {fileId:'f1',name:'水泵.xlsx',path:root+'\\分类工作簿\\水泵.xlsx',sha256:sha('b'),status:'succeeded'},
   {fileId:'f2',name:'阀门.xlsx',path:root+'\\分类工作簿\\阀门.xlsx',sha256:sha('c'),status:'succeeded'}]},
  summary:{path:root+'\\分类汇总表.xlsx',sha256:sha('d'),directory:root,categoryDirectory:root+'\\分类工作簿'},
  brands:{summaryPath:root+'\\分类汇总表.xlsx',categories:[]},
  generation:{target:root+'\\示例园区_询价总表.xlsx',sha256:sha('e')},
  split:{outputDirectory:root+'\\询价输出',projectId:'p-restore-0001',batchId:'b-restore-0001',
   files:[{fileId:'s1',name:'水泵_华川设备.xlsx',target:root+'\\询价输出\\水泵_华川设备.xlsx',
    sha256:sha('f'),state:'succeeded'}]}};
}
function checks(value,override){
 const map={};
 restore.requirements(value).forEach(function(item){
  const change=override&&override[item.path]||{};
  map[item.path]={exists:change.exists!==false,sha256:change.sha256||item.sha256};
 });
 return map;
}
test('恢复审计按每阶段真实路径和SHA判断，缺失或外部改写不恢复ready',()=>{
 const value=project(),all=checks(value);
 assert.equal(restore.audit(value,all).ok,true);
 const missing=JSON.parse(JSON.stringify(value));
 const reviewPath=missing.matching.path, changedPath=missing.summary.path;
 const missingChecks=Object.assign({},all);
 missingChecks[reviewPath]={exists:false,sha256:null};
 let audit=restore.audit(missing,missingChecks);
 assert.equal(audit.ok,false);
 assert.match(audit.blocks.review,/不存在/);
 assert.equal(audit.relocatable,true,'只有缺失文件时可尝试目录重新定位');
 const changed=Object.assign({},all);
 changed[changedPath]={exists:true,sha256:sha('9')};
 audit=restore.audit(value,changed);
 assert.match(audit.blocks.brands,/外部修改/);
 assert.equal(audit.relocatable,false,'内容被改写不能靠换目录冒充完成');
 const pending=JSON.parse(JSON.stringify(value));
 pending.split.files[0].state='pending';
 assert.match(restore.audit(pending,all).blocks.split,/仍是“pending”/);
});
test('整目录搬移按原根目录重写全部绑定路径，再用新路径内容核对',()=>{
 const value=project(),before=JSON.stringify(value);
 const relocated=restore.relocate(value,{fromRoot:'C:\\成果\\示例园区',toRoot:'E:\\搬移后\\示例园区'});
 assert.equal(JSON.stringify(value),before,'重定位不得改动原记录');
 assert.equal(relocated.matching.path,'E:\\搬移后\\示例园区\\示例园区_分类审核成果.xlsx');
 assert.equal(relocated.categories.files[1].path,'E:\\搬移后\\示例园区\\分类工作簿\\阀门.xlsx');
 assert.equal(relocated.summary.categoryDirectory,'E:\\搬移后\\示例园区\\分类工作簿');
 assert.equal(relocated.generation.target,'E:\\搬移后\\示例园区\\示例园区_询价总表.xlsx');
 assert.equal(relocated.split.files[0].target,'E:\\搬移后\\示例园区\\询价输出\\水泵_华川设备.xlsx');
 assert.equal(restore.audit(relocated,checks(relocated)).ok,true,'新目录逐项核SHA后恢复ready');
 assert.equal(restore.commonRoot(value),'C:\\成果\\示例园区');
});

// R12-C：审核成果表SHA相同不代表业务内容一致。磁盘空分类/H11与确认快照“汽车充电桩”的矛盾必须报出。
test('R12-C：SHA相同但业务内容与确认快照不同，不得恢复为已一致',()=>{
  const value=project(),all=checks(value),reviewPath=value.matching.path;
  const differences=[{rowId:'r-ev',code:'category-changed',field:'categoryId',label:'最终分类',
    expected:'汽车充电桩',actual:'',message:'“充电桩配电箱”的“最终分类”不一致：确认快照“汽车充电桩”，现表“（空）”'}];
  const different=Object.assign({},all);
  different[reviewPath]={exists:true,sha256:value.matching.sha256,content:{matches:false,differences:differences}};
  const audit=restore.audit(value,different);
  assert.equal(audit.ok,false,'业务内容不同不得恢复ready');
  assert.match(audit.blocks.review,/业务内容/);
  assert.equal(audit.relocatable,false,'业务差异不能靠换目录冒充一致');
  const issue=audit.issues.filter(item=>item.code==='content-different')[0];
  assert.ok(issue,'必须产生content-different问题');
  assert.equal(issue.stage,'review');
  assert.deepEqual(issue.differences,differences);
  assert.equal(audit.physicalRefresh.length,0);
});

test('R12-C：业务一致但仅另存/格式变化，登记物理刷新而不判外部改写；业务不同且SHA不同则同时报出',()=>{
  const value=project(),all=checks(value),reviewPath=value.matching.path;
  const physical=Object.assign({},all);
  physical[reviewPath]={exists:true,sha256:'5'.repeat(64),content:{matches:true,differences:[]}};
  const refreshed=restore.audit(value,physical);
  assert.equal(refreshed.ok,true,'业务内容与确认快照一致时，仅SHA变化不阻断恢复');
  assert.equal(refreshed.issues.length,0);
  assert.deepEqual(refreshed.physicalRefresh,[{stage:'review',path:reviewPath,label:'审核成果表',sha256:'5'.repeat(64)}]);
  const both=Object.assign({},all);
  both[reviewPath]={exists:true,sha256:'6'.repeat(64),content:{matches:false,differences:[
    {rowId:'r1',code:'note-changed',field:'note',label:'审核备注',expected:'现场确认',actual:'',
     message:'“水泵”的“审核备注”不一致：确认快照“现场确认”，现表“”'}]}};
  const audit=restore.audit(value,both);
  assert.equal(audit.ok,false);
  assert.equal(audit.issues.filter(item=>item.code==='content-different').length,1);
  assert.equal(audit.issues.filter(item=>item.code==='changed').length,1);
  assert.match(audit.blocks.review,/业务内容/,'优先展示业务差异而不是只报外部改写');
  assert.equal(audit.physicalRefresh.length,0);
});
