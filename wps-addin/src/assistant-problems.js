(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RfqAssistantProblems=api;}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function column(n){var s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
 function unique(items){var seen=Object.create(null);return (items||[]).filter(function(p){var k=[p.code,p.message,p.sheet,p.row,p.column,p.cell].join('|');if(seen[k])return false;seen[k]=true;return true;});}
 function describe(input){
  var p=input||{},issues=unique(p.issues||[]),first=issues[0]||{},message=String(p.message||first.message||'本次操作未完成。');
  var cell=first.cell||((first.row&&first.column)?column(first.column)+first.row:'');
  var location=[first.sheet||p.sheet||'',cell].filter(Boolean).join(' · ');
  var r={title:p.title||'这一步还不能完成',message:message,location:location,issues:issues,actionLabel:p.actionLabel||'去处理',solution:'请展开详情查看具体提示，保留当前填写内容后重试；仍失败时把详情提供给维护人员。',details:p.details||message};
  if(p.stage==='review'){
   r.title='核对表有 '+(issues.length||1)+' 处需要修改';r.actionLabel='去填写';
   r.solution='请到提示的工作表和单元格修改最终分类；无需询价的材料选择“无需询价”。如果材料名称、数量或行结构被修改，请先恢复原值，再整表确认。';
  }else if(p.stage==='brands'){
   r.title='品牌和供应商填写有问题';r.actionLabel='去修改';
   r.solution='请在对应类别的黄色区域补齐成对的品牌和供应商，删除重复组合；填写多组时选择“合成一份”或“按品牌分别生成”。';
  }else if(p.stage==='header'){
   r.title='请补全询价抬头';r.actionLabel='去填写';r.solution='请填写项目名称、单位名称、材料经办人和联系方式，再生成询价表。';
  }
  if(p.status===409||/其他窗口|版本冲突|已被其他/.test(message)){r.title='项目尚未保存';r.solution='当前草稿已保留。请先保留本次填写，再打开最新项目记录核对后保存，不能覆盖其他窗口的新记录。';}
  else if(/已存在|同名|EEXIST/.test(message)){r.title='目标位置已有同名文件';r.solution='请选择新的输出文件夹或另存新文件名；已有文件不会覆盖。';r.actionLabel='更换保存位置';}
  else if(/不可写|无权|只读|EACCES|EPERM/.test(message)){r.title='所选位置不能保存文件';r.solution='请改选有写入权限的文件夹，例如桌面上的新文件夹；若文件被占用，请关闭该文件后重试。';r.actionLabel='更换保存位置';}
  else if(/过期|已变化/.test(message)){r.title='上一步内容已变化';r.solution='请返回发生修改的步骤重新核对并生成，再继续本步。已经生成的旧文件会保留。';}
  else if(/文件.*不存在|文件.*缺失/.test(message)){r.title='找不到项目文件';r.solution='请在项目设置中重新定位文件；若已删除，请回到对应步骤重新生成。';}
  if(p.solution)r.solution=p.solution;
  return r;
 }
 return {describe:describe,unique:unique,column:column};
}));
