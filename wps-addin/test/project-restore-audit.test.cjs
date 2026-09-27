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
