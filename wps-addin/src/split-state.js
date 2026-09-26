(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqSplitState=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,STATES=['pending','succeeded','failed','needs-verification'];
 function text(value){return value==null?'':String(value).trim();}
 function validate(receipt){
  var errors=[];
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return {ok:false,errors:['拆分回执不是有效对象。']};
  if(receipt.schemaVersion!==SCHEMA_VERSION)errors.push('拆分回执版本不支持：'+String(receipt.schemaVersion));
  if(typeof receipt.inputKey!=='string'||!receipt.inputKey)errors.push('拆分回执缺少内容键。');
  if(!/^[a-f\d]{64}$/i.test(String(receipt.generationSha256||'')))errors.push('拆分回执缺少总工作簿SHA256。');
  if(!Array.isArray(receipt.files))errors.push('拆分回执缺少文件清单。');
  else receipt.files.forEach(function(file,index){
   var at='第'+(index+1)+'个文件';
   if(!file||typeof file!=='object'){errors.push(at+'无效。');return;}
   if(typeof file.fileId!=='string'||!file.fileId)errors.push(at+'缺少标识。');
   if(typeof file.target!=='string'||!file.target)errors.push(at+'缺少目标路径。');
   if(STATES.indexOf(file.state)<0)errors.push(at+'状态无效。');
   if(file.state==='succeeded'&&!/^[a-f\d]{64}$/i.test(String(file.sha256||'')))errors.push(at+'缺少SHA256。');
   else if(file.state!=='succeeded'&&file.sha256!=null&&!/^[a-f\d]{64}$/i.test(String(file.sha256)))
    errors.push(at+'SHA256无效。');
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
 function create(plan,generationSha256){
  if(!plan||!Array.isArray(plan.files))throw Error('缺少拆分计划。');
  return {schemaVersion:SCHEMA_VERSION,inputKey:text(plan.inputKey),generationSha256:text(generationSha256),
   updatedAt:new Date().toISOString(),
   files:plan.files.map(function(file){return {fileId:file.fileId,target:file.target,state:'pending',sha256:null,error:null};})};
 }
 function mark(receipt,fileId,state,detail){
  var next=JSON.parse(JSON.stringify(receipt)),file=next.files.filter(function(item){return item.fileId===fileId;})[0];
  if(!file)throw Error('拆分回执里没有这个文件：'+text(fileId));
  file.state=state;
  if(state==='succeeded'){file.sha256=text(detail);file.error=null;}
  else file.error=text(detail)||null;
  next.updatedAt=new Date().toISOString();
  return next;
 }
 // 重启后按文件实况核对：SHA一致才算成功，被外部改写标记待核对，缺失退回待处理。
 function reconcile(receipt,checks){
  var list=Array.isArray(checks)?checks:[],next=JSON.parse(JSON.stringify(receipt));
  list.forEach(function(check){
   var file=next.files.filter(function(item){return item.fileId===check.fileId;})[0];
   if(!file)return;
   if(!check.exists){file.state='pending';file.sha256=null;file.error='文件不存在，等待重新生成。';return;}
   if(file.state==='succeeded'&&check.sha256&&check.sha256.toLowerCase()!==String(file.sha256||'').toLowerCase())
    {file.state='needs-verification';file.error='文件已被外部改写，需要核对后重新拆分。';return;}
   if(file.state==='needs-verification'&&check.sha256&&check.sha256.toLowerCase()===String(file.sha256||'').toLowerCase())
    file.state='succeeded';
  });
  next.updatedAt=new Date().toISOString();
  return next;
 }
 function pending(receipt){
  var summary=summarize(receipt);
  return summary.pending.concat(summary.failed,summary.needsVerification);
 }
 return {SCHEMA_VERSION:SCHEMA_VERSION,STATES:STATES.slice(),validate:validate,summarize:summarize,create:create,
  mark:mark,reconcile:reconcile,pending:pending};
}));
