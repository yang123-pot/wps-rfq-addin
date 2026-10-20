(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqSplitState=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,STATES=['pending','succeeded','failed','needs-verification'],
  PROOFS=['publish','content-check'],SHA_PATTERN=/^[a-f\d]{64}$/i,
  ID_PATTERN=/^[a-z0-9-]{8,64}$/;
 function text(value){return value==null?'':String(value).trim();}
 function clone(value){return JSON.parse(JSON.stringify(value));}
 function validate(receipt){
  var errors=[];
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return {ok:false,errors:['拆分回执不是有效对象。']};
  if(receipt.schemaVersion!==SCHEMA_VERSION)errors.push('拆分回执版本不支持：'+String(receipt.schemaVersion));
  if(!ID_PATTERN.test(String(receipt.projectId||'')))errors.push('拆分回执缺少有效项目编号。');
  if(!ID_PATTERN.test(String(receipt.batchId||'')))errors.push('拆分回执缺少有效批次编号。');
  if(!Number.isSafeInteger(receipt.revision)||receipt.revision<0)errors.push('拆分回执缺少有效版本号。');
  if(typeof receipt.inputKey!=='string'||!receipt.inputKey)errors.push('拆分回执缺少内容键。');
  if(!SHA_PATTERN.test(String(receipt.generationSha256||'')))errors.push('拆分回执缺少总工作簿SHA256。');
  if(!Array.isArray(receipt.files))errors.push('拆分回执缺少文件清单。');
  else receipt.files.forEach(function(file,index){
   var at='第'+(index+1)+'个文件';
   if(!file||typeof file!=='object'){errors.push(at+'无效。');return;}
   if(typeof file.fileId!=='string'||!file.fileId)errors.push(at+'缺少标识。');
   if(typeof file.target!=='string'||!file.target)errors.push(at+'缺少目标路径。');
   if(STATES.indexOf(file.state)<0)errors.push(at+'状态无效。');
   if(file.state==='succeeded'&&!SHA_PATTERN.test(String(file.sha256||'')))errors.push(at+'缺少SHA256。');
   else if(file.state!=='succeeded'&&file.sha256!=null&&!SHA_PATTERN.test(String(file.sha256)))
    errors.push(at+'SHA256无效。');
   if(file.observedSha256!=null&&!SHA_PATTERN.test(String(file.observedSha256)))
    errors.push(at+'观察到的SHA256无效。');
   if(file.verifiedBy!=null&&PROOFS.indexOf(String(file.verifiedBy))<0)errors.push(at+'核对证明无效。');
  });
  return {ok:errors.length===0,errors:errors};
 }
 function summarize(receipt){
  var files=(receipt&&receipt.files)||[];
  return {total:files.length,
   succeeded:files.filter(function(file){return file.state==='succeeded';}),
   failed:files.filter(function(file){return file.state==='failed';}),
   pending:files.filter(function(file){return file.state==='pending';}),
   needsVerification:files.filter(function(file){return file.state==='needs-verification';}),
   done:files.length>0&&files.every(function(file){return file.state==='succeeded';})};
 }
 function create(plan,generationSha256,options){
  if(!plan||!Array.isArray(plan.files))throw Error('缺少拆分计划。');
  var input=options||{},projectId=text(input.projectId),batchId=text(input.batchId);
  if(!ID_PATTERN.test(projectId))throw Error('拆分回执需要有效项目编号。');
  if(!ID_PATTERN.test(batchId))throw Error('拆分回执需要有效批次编号。');
  return {schemaVersion:SCHEMA_VERSION,projectId:projectId,batchId:batchId,revision:0,
   inputKey:text(plan.inputKey),generationSha256:text(generationSha256),
   outputDirectory:text(input.outputDirectory||plan.directory||''),
   updatedAt:new Date().toISOString(),
   files:plan.files.map(function(file){return {kind:file.kind||'inquiry',fileId:file.fileId,sheetId:file.sheetId||null,name:file.name||'',
    target:file.target,state:'pending',sha256:null,observedSha256:null,verifiedBy:null,verifiedAt:null,error:null};})};
 }
 // mark是唯一的“记账成功”入口：succeeded必须带核对证明（真实发布写回或显式内容核对）；
 // pending/failed/needs-verification只能记观察到的SHA，绝不写进经核对的SHA。
 function mark(receipt,fileId,state,detail,options){
  var next=clone(receipt),file=next.files.filter(function(item){return item.fileId===fileId;})[0],
   request=options&&typeof options==='object'?options:{};
  if(!file)throw Error('拆分回执里没有这个文件：'+text(fileId));
  if(STATES.indexOf(state)<0)throw Error('拆分回执状态无效：'+text(state));
  file.state=state;
  if(state==='succeeded'){
   file.sha256=String(text(detail)).toLowerCase();
   file.observedSha256=null;file.error=null;
   file.verifiedBy=PROOFS.indexOf(String(request.proof))>=0?String(request.proof):'publish';
   file.verifiedAt=new Date().toISOString();
  }
  else{
   file.sha256=null;file.verifiedBy=null;file.verifiedAt=null;
   file.observedSha256=SHA_PATTERN.test(String(request.observedSha256||''))?
    String(request.observedSha256).toLowerCase():null;
   file.error=text(detail)||null;
  }
  next.updatedAt=new Date().toISOString();
  return next;
 }
 // 旧回执迁移：没有核对证明的succeeded一律保守降为待核对，观察到的SHA单独留下供内容核对比对。
 function demoteUnproven(receipt){
  var next=clone(receipt);
  (next.files||[]).forEach(function(file){
   if(file.state!=='succeeded'||PROOFS.indexOf(String(file.verifiedBy))>=0)return;
   file.observedSha256=file.observedSha256||(SHA_PATTERN.test(String(file.sha256||''))?String(file.sha256).toLowerCase():null);
   file.state='needs-verification';file.sha256=null;file.verifiedBy=null;file.verifiedAt=null;
   file.error=file.error||'旧回执没有内容核对证明，需要核对实际文件后才能确认成功。';
  });
  return next;
 }
 // 重启后按文件实况核对：有核对证明且SHA一致的成功件才跳过；被外部改写、缺证明、发布响应丢失一律待核对；
 // 文件缺失退回待处理。这里绝不写成功，成功只能由真实发布写回或显式内容核对(mark)落地。
 function reconcile(receipt,checks){
  var list=Array.isArray(checks)?checks:[],next=clone(receipt);
  list.forEach(function(check){
   var file=next.files.filter(function(item){return item.fileId===check.fileId;})[0];
   if(!file)return;
   var actual=SHA_PATTERN.test(String(check.sha256||''))?String(check.sha256).toLowerCase():null,
    expected=String(file.sha256||'').toLowerCase(),previousState=file.state;
   if(!check.exists){
    if(file.state==='failed')return;
    file.state='pending';file.sha256=null;file.observedSha256=null;file.verifiedBy=null;file.verifiedAt=null;
    file.error='文件不存在，等待生成。';return;
   }
   if(file.state==='succeeded'){
    if(PROOFS.indexOf(String(file.verifiedBy))<0){
     file.state='needs-verification';file.sha256=null;file.observedSha256=actual;
     file.verifiedBy=null;file.verifiedAt=null;
     file.error='旧回执没有内容核对证明，需要核对实际文件后才能确认成功。';return;
    }
    if(!actual||actual!==expected){
     file.state='needs-verification';file.sha256=null;file.observedSha256=actual;
     file.verifiedBy=null;file.verifiedAt=null;
     file.error='文件已被外部改写，需要核对实际内容后重新拆分。';
    }else file.error=null;
    return;
   }
   // pending/failed/needs-verification：文件存在但没有内容核对证明，只能待核对，重复刷新也不提升。
   file.state='needs-verification';file.sha256=null;file.observedSha256=actual;
   file.verifiedBy=null;file.verifiedAt=null;
   file.error=previousState==='needs-verification'&&file.error?
    file.error:'文件已存在但回执未记账，需要核对实际内容后才能确认成功。';
  });
  next.updatedAt=new Date().toISOString();
  return next;
 }
 function pending(receipt){
  var summary=summarize(receipt);
  return summary.pending.concat(summary.failed);
 }
 function blocked(receipt){return summarize(receipt).needsVerification;}
 return {SCHEMA_VERSION:SCHEMA_VERSION,STATES:STATES.slice(),PROOFS:PROOFS.slice(),ID_PATTERN:ID_PATTERN,
  validate:validate,summarize:summarize,create:create,mark:mark,demoteUnproven:demoteUnproven,
  reconcile:reconcile,pending:pending,blocked:blocked};
}));
