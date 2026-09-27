(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqSplitPlan=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,INQUIRY='inquiry',
  RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i,
  ILLEGAL=/[\\\/:\*\?"<>\|]/g,MAX_PATH=260;
 function text(value){return value==null?'':String(value);}
 function safeName(value){
  var cleaned=text(value).replace(ILLEGAL,'_').replace(/[\u0000-\u001f]/g,'').trim();
  return cleaned.replace(/[. ]+$/,'');
 }
 // 基础名保持“分类_供应商名称.xlsx”（Q4未定时不做自动改名，冲突一律阻断绝不覆盖）。
 function baseName(sheet){
  return safeName(text(sheet.categoryName)+'_'+text(sheet.supplier))+'.xlsx';
 }
 function join(directory,name){
  var separator=text(directory).indexOf('\\')>=0?'\\':'/';
  return text(directory).replace(/[\\\/]+$/,'')+separator+name;
 }
 function build(input){
  var source=input||{},model=source.model,generation=source.generation,
   directory=text(source.targetDirectory).trim(),conflicts=[],files=[],seen={};
  if(!model||!Array.isArray(model.sheets))throw Error('没有可拆分的询价模型。');
  if(!directory)conflicts.push({code:'no-directory',message:'请先选择拆分的输出目录。'});
  var sheets=model.sheets.filter(function(sheet){return sheet.kind===INQUIRY;});
  if(!sheets.length)conflicts.push({code:'no-inquiry-sheet',message:'没有kind=inquiry的询价页，不能拆分。'});
  if(generation&&model.inputKey&&generation.inputKey!==model.inputKey)
   conflicts.push({code:'generation-stale',message:'总询价工作簿与当前内容不一致，请重新生成后再拆分。'});
  if(generation&&source.currentKey&&generation.inputKey!==source.currentKey)
   conflicts.push({code:'current-key-stale',message:'总询价工作簿与当前内容不一致（来源、分类、品牌或抬头已变化），请重新生成后再拆分。'});
 if(generation&&(!/^[a-f\d]{64}$/i.test(String(generation.sha256||''))))
   conflicts.push({code:'generation-sha-missing',message:'总询价工作簿缺少可核对的SHA256，请重新生成。'});
 if(generation&&generation.target&&!/^.+\.xlsx$/i.test(String(generation.target)))
   conflicts.push({code:'generation-target-invalid',message:'总询价工作簿路径无效，请重新生成。'});
  if(!generation)conflicts.push({code:'no-generation',message:'请先生成并校验总询价工作簿。'});
  sheets.forEach(function(sheet,index){
   var name=baseName(sheet),fileId='file-'+text(sheet.sheetId||index),target=join(directory,name),issues=[];
   if(/[\\\/:\*\?"<>\|]/.test(text(sheet.supplier))||/[\\\/:\*\?"<>\|]/.test(text(sheet.categoryName)))
    issues.push({code:'illegal-character',message:'类别或供应商里有文件名非法字符，已替换为下划线：'+name});
   var stem=name.replace(/\.xlsx$/i,'');
   if(RESERVED.test(stem)||stem.split('_').some(function(part){return RESERVED.test(part);}))
    issues.push({code:'reserved-name',message:'文件名是Windows保留设备名，请改名：'+name});
   if(!safeName(text(sheet.categoryName))||!safeName(text(sheet.supplier)))
    issues.push({code:'empty-name',message:'类别或供应商为空，无法组成文件名。'});
   if(target.length>MAX_PATH)issues.push({code:'long-path',message:'输出路径过长，请选择更短的目录：'+target});
   var key=target.toLowerCase();
   if(seen[key])conflicts.push({code:'duplicate-target',message:'文件名重复（不区分大小写），请先区分品牌或供应商：'+name});
   seen[key]=true;
   var headerRow=sheet.layout&&sheet.layout.metadata&&Number.isSafeInteger(sheet.layout.metadata.headerRow)?
    sheet.layout.metadata.headerRow:(sheet.headerRow||0);
   files.push({fileId:fileId,sheetId:sheet.sheetId,assignmentId:sheet.assignmentId,categoryName:sheet.categoryName,
    brand:sheet.brand,brandLabel:sheet.brandLabel,supplier:sheet.supplier,sheetName:sheet.name,name:name,target:target,
    materialRows:sheet.values.length-headerRow,hasLayout:!!sheet.layout,issues:issues});
  });
  files.forEach(function(file){file.issues.forEach(function(issue){
   if(issue.code!=='illegal-character')conflicts.push({code:issue.code,fileId:file.fileId,message:issue.message});});});
 return {schemaVersion:SCHEMA_VERSION,inputKey:text(model.inputKey),generationSha256:text(generation&&generation.sha256||''),
  directory:directory,files:files,conflicts:conflicts,canPublish:conflicts.length===0&&files.length>0};
 }
 // 发布前仍要复核目标是否存在：预检通过不等于可以覆盖。
 function checkTargets(plan,existing){
  var list=(existing||[]).map(function(value){return text(value).toLowerCase();}),conflicts=[];
  (plan&&plan.files||[]).forEach(function(file){
   if(list.indexOf(text(file.target).toLowerCase())>=0)
    conflicts.push({code:'target-exists',fileId:file.fileId,message:'目标文件已存在，绝不覆盖：'+file.target});
  });
  return {ok:conflicts.length===0,conflicts:conflicts,canPublish:(plan&&plan.canPublish)===true&&conflicts.length===0};
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,INQUIRY:INQUIRY,MAX_PATH:MAX_PATH,safeName:safeName,baseName:baseName,build:build,checkTargets:checkTargets};
}));
