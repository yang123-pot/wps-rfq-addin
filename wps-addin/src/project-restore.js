(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqProjectRestore=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1;
 function text(value){return value==null?'':String(value);}
 function key(value){return text(value).replace(/[\\/]+/g,'/').toLowerCase();}
 function absolute(value){return typeof value==='string'&&/^(?:[a-z]:[\\/]|\\\\).+/i.test(value);}
 function copy(value){return value?JSON.parse(JSON.stringify(value)):value;}
 function isSha(value){return /^[a-f\d]{64}$/i.test(text(value));}
 function samePath(left,right){return key(left)===key(right);}
 function trimRoot(value){return text(value).replace(/[\\/]+$/,'');}
 function hasPrefix(path,root){
  var left=key(trimRoot(path)),right=key(trimRoot(root));
  return left===right||left.slice(0,right.length+1)===right+'/';
 }
 function rebase(path,root,toRoot){
  if(!hasPrefix(path,root))return path;
  var suffix=text(path).slice(trimRoot(root).length);
  return trimRoot(toRoot)+suffix;
 }
 function req(stage,path,sha,label,state,fileId){
  return {stage:stage,path:text(path),sha256:sha==null?null:text(sha),label:label||stage,
   state:state||null,fileId:fileId||null};
 }
 // R12-C：把业务内容差异压成一句人话，供侧栏提示；完整差异留在issue.differences里。
 function describeDifferences(list){
  var items=(list||[]).slice(0,3).map(function(item){return item&&item.message?item.message:'';}).filter(Boolean);
  return items.join('；')+((list||[]).length>3?'；其余'+((list||[]).length-3)+'处':'');
 }
 // 项目恢复前要核对的全部持久文件：审核成果、分类工作簿、汇总表、总询价簿和拆分回执中的目标。
 function requirements(project){
  var out=[],matching=project&&project.matching,categories=project&&project.categories,
   summary=project&&project.summary,generation=project&&project.generation,split=project&&project.split;
  if(matching&&matching.path)out.push(req('review',matching.path,matching.sha256,'审核成果表'));
  ((categories&&categories.files)||[]).forEach(function(file){
   out.push(req('categories',file&&file.path,file&&file.sha256,'分类工作簿：'+(file&&file.name||''),file&&file.status,file&&file.fileId));
  });
  if(summary&&summary.path)out.push(req('brands',summary.path,summary.sha256,'分类汇总表'));
  if(generation&&generation.target)out.push(req('inquiry',generation.target,generation.sha256,'总询价工作簿'));
  ((split&&split.files)||[]).forEach(function(file){
   out.push(req('split',file&&file.target,file&&file.sha256,'拆分文件：'+(file&&file.name||''),file&&file.state,file&&file.fileId));
  });
  return out;
}
 function audit(project,checks){
  var checkMap=checks||{},items=requirements(project),blocks={},issues=[],missing=[],physicalRefresh=[];
  items.forEach(function(item){
   if(item.state&&item.state!=='succeeded'&&item.stage==='split')
    issues.push({stage:item.stage,code:'not-succeeded',path:item.path,label:item.label,
     message:item.label+'仍是“'+item.state+'”，没有完成并核对。'});
   var actual=checkMap[key(item.path)]||checkMap[item.path]||null;
   if(!actual||actual.exists!==true){
    issues.push({stage:item.stage,code:'missing',path:item.path,label:item.label,
     message:item.label+'不存在或无法访问：'+item.path});
    missing.push(item.path);return;
   }
   if(!isSha(item.sha256)){
    issues.push({stage:item.stage,code:'sha-missing',path:item.path,label:item.label,
     message:item.label+'缺少可核对的SHA256，不能恢复为已完成。'});
    return;
   }
   var content=item.stage==='review'&&actual.content?actual.content:null,
    shaMatches=!!actual.sha256&&text(actual.sha256).toLowerCase()===text(item.sha256).toLowerCase();
   // 业务内容优先：SHA相同但磁盘/打开簿内容与确认快照不同，必须报出，不能用物理一致掩盖业务差异。
   if(content&&content.matches===false)
    issues.push({stage:item.stage,code:'content-different',path:item.path,label:item.label,
     differences:((content.differences||[]).slice()),
     source:content.source||null,
     message:item.label+'（'+(content.source==='open'?'打开簿内容':'磁盘内容')+
      '）的业务内容与项目确认快照不一致（SHA'+(shaMatches?'相同':'不同')+
      '也不能当作已一致）：'+describeDifferences(content.differences)});
   if(!shaMatches){
    if(content&&content.matches===true)
     // 仅另存/格式/排序造成的物理变化，业务内容仍与确认快照一致：登记物理校验刷新，不判外部改写。
     physicalRefresh.push({stage:item.stage,path:item.path,label:item.label,sha256:text(actual.sha256).toLowerCase()});
    else
     issues.push({stage:item.stage,code:'changed',path:item.path,label:item.label,
      message:item.label+'内容已被外部修改，不能沿用旧成功记录：'+item.path});
   }
  });
  issues.forEach(function(issue){if(!blocks[issue.stage])blocks[issue.stage]=issue.message;});
  var root=commonRoot(project),relocatable=missing.length>0&&!!root&&issues.every(function(issue){
   return issue.code==='missing';});
  return {schemaVersion:SCHEMA_VERSION,ok:issues.length===0,issues:issues,blocks:blocks,
   physicalRefresh:physicalRefresh,commonRoot:root,relocatable:relocatable,requirements:items};
 }
 function commonRoot(project){
  var paths=requirements(project).map(function(item){return item.path;}).filter(absolute);
  if(!paths.length)return null;
  var first=trimRoot(paths[0]).replace(/[\\/][^\\/]*$/,'');
  if(!first)return null;
  var root=first;
  paths.slice(1).forEach(function(path){
   var folder=trimRoot(path).replace(/[\\/][^\\/]*$/,'');
   while(root&&!hasPrefix(folder,root))root=root.replace(/[\\/][^\\/]*$/,'');
  });
  return root||null;
 }
 function relocate(project,options){
  var input=options||{},from=trimRoot(input.fromRoot),to=trimRoot(input.toRoot);
  if(!absolute(from)||!absolute(to))throw Error('目录搬移需要有效的原目录与新目录。');
  var next=copy(project);
  function fix(value){return rebase(value,from,to);}
  if(next.matching&&next.matching.path)next.matching.path=fix(next.matching.path);
  if(next.review&&next.review.sheet&&next.review.sheet.path)next.review.sheet.path=fix(next.review.sheet.path);
  if(next.reviewDraft&&next.reviewDraft.sheet&&next.reviewDraft.sheet.path)
   next.reviewDraft.sheet.path=fix(next.reviewDraft.sheet.path);
  if(next.categories){
   if(next.categories.root)next.categories.root=fix(next.categories.root);
   if(next.categories.directory)next.categories.directory=fix(next.categories.directory);
   (next.categories.files||[]).forEach(function(file){if(file&&file.path)file.path=fix(file.path);});
  }
  if(next.summary){
   if(next.summary.path)next.summary.path=fix(next.summary.path);
   if(next.summary.directory)next.summary.directory=fix(next.summary.directory);
   if(next.summary.categoryDirectory)next.summary.categoryDirectory=fix(next.summary.categoryDirectory);
  }
  if(next.brands&&next.brands.summaryPath)next.brands.summaryPath=fix(next.brands.summaryPath);
  if(next.generation&&next.generation.target)next.generation.target=fix(next.generation.target);
  if(next.split){
   if(next.split.outputDirectory)next.split.outputDirectory=fix(next.split.outputDirectory);
   (next.split.files||[]).forEach(function(file){if(file&&file.target)file.target=fix(file.target);});
  }
  return next;
}
 return {SCHEMA_VERSION:SCHEMA_VERSION,key:key,requirements:requirements,commonRoot:commonRoot,
  audit:audit,relocate:relocate};
}));
