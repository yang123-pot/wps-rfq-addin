(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RfqAssistantProblems=api;}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function column(n){var s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
 function unique(items){var seen=Object.create(null);return (items||[]).filter(function(p){var k=JSON.stringify([p.path,p.file,p.code,p.message,p.sheet,p.row,p.column,p.cell]);if(seen[k])return false;seen[k]=true;return true;});}
 function describe(input){
  var p=input||{},issues=unique(p.issues||[]),first=issues[0]||{},message=String(p.message||first.message||'本次操作未完成。');
  var cell=first.cell||((first.row&&first.column)?column(first.column)+first.row:'');
  var location=[first.path||first.file||'',first.sheet||p.sheet||'',cell||(first.row?'第 '+first.row+' 行':'')].filter(Boolean).join(' · ');
  var r={title:p.title||'这一步还不能完成',message:message,location:location,issues:issues,actionLabel:p.actionLabel||'去处理',solution:'请展开详情查看具体提示，保留当前填写内容后重试；仍失败时把详情提供给维护人员。',details:p.details||message};
  if(p.stage==='source'){
   r.title='还有 '+(issues.length||1)+' 处来源问题';r.actionLabel='去核对来源';
   var solutions={
    'quantity-invalid':'请对照原清单，在已展开的修正区填写正确的工程量，再点击“确认本行核对”。',
    'name-missing':'请对照原清单，在已展开的修正区补齐项目名称，再点击“确认本行核对”。',
    'unit-missing':'请对照原清单，在已展开的修正区补齐单位，再点击“确认本行核对”。',
    'code-missing':'请按原表填写项目编码；确实没有编码时勾选“已核对原清单，确认无项目编码”，再确认本行核对。',
    'code-display-unverified':'请按原表显示填写编码，保留前导零，并勾选已核对显示格式，再确认本行核对。',
    'feature-continuation':'请核对项目特征续行所属的材料行号，在修正区填写“归属材料行号”并确认归属。',
    'row-unrecognized':'请在已展开的修正区选择此行类型。材料行需补齐字段；非材料说明行需填写核对理由。'
   };
   r.solution=solutions[first.code]||'请查看对应行的修正说明；若问题不能在修正区处理，请对照清单修复原文件后重新导入，不能直接标为已解决。';
  }else if(p.stage==='review'){
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
