(function(){
 'use strict';
 // R10（图07）：一键拆分、持久回执与失败续作。每张询价页独立暂存、重开核、独占发布、立即保存服务端回执。
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function samePath(left,right){return String(left||'').replace(/[\\/]+/g,'/').toLowerCase()===String(right||'').replace(/[\\/]+/g,'/').toLowerCase();}
 function stateLabel(value){
  if(value==='succeeded')return '已完成';
  if(value==='failed')return '失败';
  if(value==='needs-verification')return '待核对';
  return '待处理';
 }
 function create(options){
  options=options||{};
  var message=document.getElementById('split-message'),status=document.getElementById('split-status'),
    chooseDirectory=document.getElementById('split-directory'),directoryLabel=document.getElementById('split-directory-label'),
    previewList=document.getElementById('split-preview'),runButton=document.getElementById('split-run'),
    retryButton=document.getElementById('split-retry'),openButton=document.getElementById('split-open');
  var directory='',receipt=null,revision=0,batchId='',prepared=null,prepareError=null,preparing=false,busy=false,resultOverlay=null,
    notifiedReceipt='';
  function tell(text,error){if(!message)return;message.textContent=text;message.className=error?'error':'';if(window.RfqFeedback)RfqFeedback.tell(text,error,'split');}
  function newId(){
   if(window.RfqProject&&typeof window.RfqProject.newId==='function')return window.RfqProject.newId();
   return 'b-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }
  function receiptFingerprint(value){
   if(!value)return '';
   return JSON.stringify({projectId:value.projectId,batchId:value.batchId,inputKey:value.inputKey,
    generationSha256:value.generationSha256,directory:value.outputDirectory||value.directory,files:value.files||[]});
  }
  function notifyReceipt(value,meta){
   var fingerprint=receiptFingerprint(value);
   if(!fingerprint||fingerprint===notifiedReceipt)return;
   notifiedReceipt=fingerprint;
   if(options.onReceipt)options.onReceipt(value,meta||{});
  }
  function generation(){return options.generation?options.generation():null;}
  function context(){return options.context?options.context():null;}
  function projectId(){
   var value=options.projectId?options.projectId():'';
   if(!value)throw Error('项目编号尚未建立，不能保存拆分回执。');
   return String(value);
  }
  function currentGeneration(){
   var value=generation();
   if(!value||!value.modelSnapshot||!value.target||!value.sha256)return null;
   return value;
  }
  function localPlan(){
   var current=currentGeneration(),ctx=context();
   if(!current)throw Error('请先生成并校验总询价工作簿。');
   return RfqSplitPlan.build({model:current.modelSnapshot,generation:current,targetDirectory:directory,
    currentKey:ctx?ctx.inputKey:null});
  }
  function receiptMatches(){
   var current=currentGeneration(),ctx=context();
   return !!receipt&&!!current&&receipt.inputKey===current.inputKey&&
    String(receipt.generationSha256||'').toLowerCase()===String(current.sha256||'').toLowerCase()&&
    samePath(receipt.outputDirectory||receipt.directory,directory)&&
    String(receipt.projectId||'')===projectId()&&!!receipt.batchId;
  }
  function ensureBatch(){
   var current=currentGeneration();
   if(receiptMatches())return receipt.batchId;
   if(receipt)batchId='';
   if(!batchId)batchId=newId();
   return batchId;
  }
  function request(route,payload){
   var token=window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token;
   if(!token)return Promise.reject(Error('当前会话未启用拆分，请启动最新开发服务并重新打开侧栏。'));
   return fetch(route,{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':token},
    body:JSON.stringify(payload||{})}).then(function(response){
    return response.text().then(function(body){
     var result;try{result=JSON.parse(body);}catch(_){result={};}
     if(!response.ok){var error=Error(result.error||'拆分请求失败。');error.status=response.status;throw error;}
     return result;});
  });
  }
  function splitRequest(action,payload){return request('/api/split/'+action,payload);}
  function exportRequest(action,payload){return request('/api/export/'+action,payload);}
  function renderPreview(built,record){
   if(!previewList)return;
   previewList.textContent='';
   var files=built&&built.files||[];
   files.forEach(function(file){
    var state=record&&record.files?record.files.filter(function(item){return item.fileId===file.fileId;})[0]:null;
    var li=node('li');li.setAttribute('data-split-file',file.fileId);
    li.appendChild(node('strong',file.name));
    li.appendChild(node('p',file.categoryName+' · '+(file.brand||'（无品牌）')+' · '+(file.supplier||'（无供应商）')+
     ' · 材料 '+file.materialRows+' 行 · 状态：'+stateLabel(state&&state.state)+(state&&state.error?'（'+state.error+'）':''),'source'));
    li.appendChild(node('p',file.target,'source'));
    previewList.appendChild(li);
   });
   if(!files.length)previewList.appendChild(node('li','没有可拆分的询价页。','empty'));
   // 待核对单独列出：这些目标已经存在但还没有内容证明，重复刷新/重启都不会变成成功。
   var blockedFiles=record&&record.files?record.files.filter(function(item){return item.state==='needs-verification';}):[];
   if(blockedFiles.length){
    var block=node('li',null,'review-note');block.setAttribute('data-split-blocked','');
    block.appendChild(node('strong','待核对（需逐值核对已有文件，原文件不覆盖）：'));
    blockedFiles.forEach(function(item){
     var file=files.filter(function(candidate){return candidate.fileId===item.fileId;})[0]||{};
     block.appendChild(node('span',(file.name||item.fileId)+' —— '+(item.error||'需要核对实际内容')+
      '（'+String(item.target)+'）','source'));
    });
    previewList.appendChild(block);
   }
   (built&&built.conflicts||[]).forEach(function(conflict){
    var li=node('li',null,'review-note');li.appendChild(node('strong','冲突：'));li.appendChild(node('span',conflict.message));
    previewList.appendChild(li);
   });
  }
  function render(){
   var built=null,error=null,current=currentGeneration();
   try{built=localPlan();}catch(problem){error=problem.message;}
   if(directoryLabel)directoryLabel.textContent=directory?('输出目录：'+directory):'尚未选择输出目录。';
   if(error){
    if(status)status.textContent='还不能拆分：'+error;
    if(runButton)runButton.disabled=true;
    if(retryButton)retryButton.disabled=true;
    if(openButton)openButton.disabled=true;
    renderPreview(null,null);return;
   }
   var effective=prepared&&prepared.plan?prepared.plan:built;
   var record=receiptMatches()?receipt:null;
   var summary=RfqSplitState.summarize(record);
   var retryable=RfqSplitState.pending(record);
   var blocked=RfqSplitState.blocked(record);
   if(status){
    status.textContent=(preparing?'正在核对总询价工作簿、回执与全部目标… · ':'')+
     '计划 '+effective.files.length+' 个文件 · 完成 '+summary.succeeded.length+' · 失败 '+summary.failed.length+
     ' · 待处理 '+summary.pending.length+(blocked.length?' · 待核对 '+blocked.length:'')+
     (prepareError?(' · '+prepareError):'')+
     (effective.conflicts.length?(' · 冲突 '+effective.conflicts.length+'：'+effective.conflicts[0].message):'');
   }
   if(runButton)runButton.disabled=busy||preparing||!current||!directory||!prepared||!prepared.canPublish;
   if(retryButton){
    var actionAllowed=!!prepared&&(prepared.canPublish===true||prepared.canVerify===true);
    retryButton.disabled=busy||preparing||!current||!directory||!actionAllowed||(!retryable.length&&!blocked.length);
    retryButton.textContent=blocked.length?('核对已有文件（待核对'+blocked.length+' · 未完成'+retryable.length+'）'):
     (retryable.length?('重试未完成（'+retryable.length+'）'):'重试未完成');
   }
   if(openButton)openButton.disabled=busy||!directory;
   renderPreview(effective,record&&recordMatchesPlan(record,effective)?record:null);
  }
  function recordMatchesPlan(record,built){
   if(!record)return false;
   var ids={};built.files.forEach(function(file){ids[file.fileId]=true;});
   return record.files.length===built.files.length&&record.files.every(function(file){return ids[file.fileId];});
  }
  function preparePayload(){
   var current=currentGeneration(),ctx=context();
   return {projectId:projectId(),batchId:ensureBatch(),generation:current,targetDirectory:directory,
    currentKey:ctx?ctx.inputKey:null};
  }
  async function syncPlan(){
   if(!directory||!currentGeneration()){prepared=null;prepareError=null;render();return null;}
   var id=++syncPlan.id;
   preparing=true;prepareError=null;render();
   try{
    var result=await splitRequest('prepare',preparePayload());
    if(id!==syncPlan.id)return null;
    prepared=result&&result.plan?result:(null);
    if(prepared){
     if(result.receipt){
      receipt=result.receipt;revision=Number(result.receipt.revision)||0;batchId=result.receipt.batchId||batchId;
      notifyReceipt(receipt,{saved:true,prepared:true});
     }
     prepareError=prepared.conflicts&&prepared.conflicts.length?prepared.conflicts[0].message:'';
     var pendingVerify=RfqSplitState.summarize(result.receipt||receipt).needsVerification;
     if(prepared.canVerify&&pendingVerify.length&&!busy)
      tell('有 '+pendingVerify.length+' 份文件已存在但未记账，请点“核对已有文件”逐值核对；核对不通过保留原文件、不覆盖。',true);
    }else prepareError='拆分准备返回不完整。';
    return prepared;
   }catch(error){
    if(id!==syncPlan.id)return null;
    prepared=null;prepareError=error.message;tell('拆分准备失败：'+error.message,true);return null;
   }finally{
    if(id===syncPlan.id){preparing=false;render();}
   }
  }
  syncPlan.id=0;
  function saveReceipt(next){
   return splitRequest('save',{receipt:next,expectedRevision:revision}).then(function(saved){
    receipt=saved&&saved.receipt?saved.receipt:next;revision=Number(saved&&saved.revision);
    if(!Number.isSafeInteger(revision)||revision<0)revision=Number(receipt.revision)||0;
    batchId=receipt.batchId||batchId;
    notifyReceipt(receipt,{saved:true});
    return receipt;
   });
  }
  async function refreshReceiptAfterFailure(next,fileId,detail,observedSha256){
   var local=RfqSplitState.mark(next,fileId,'needs-verification',detail,{observedSha256:observedSha256});
   try{
    var loaded=await splitRequest('load',{projectId:projectId(),batchId:batchId});
    if(loaded&&loaded.receipt){receipt=loaded.receipt;revision=Number(loaded.receipt.revision)||0;return saveReceipt(local);}
   }catch(_){}
   receipt=local;notifyReceipt(receipt,{saved:false});return local;
  }
  function sheetWorkbook(sheet){
   return {mode:'inquiry',inputKey:'',sheets:[{name:sheet.name,values:sheet.values,layout:sheet.layout}]};
  }
  function inspectFile(path){
   return exportRequest('inspect',{target:path}).then(function(result){return result||{target:path,exists:false,sha256:null};},
    function(){return {target:path,exists:false,sha256:null};});
  }
  // 保存核对结果失败（含409）时，先读回服务端真实回执；绝不用内存里的成功覆盖服务端。
  async function reloadAfterSaveFailure(local,fileId,detail,observedSha256){
   try{
    var loaded=await splitRequest('load',{projectId:projectId(),batchId:batchId});
    if(loaded&&loaded.receipt){receipt=loaded.receipt;revision=Number(loaded.receipt.revision)||0;
     batchId=receipt.batchId||batchId;}
   }catch(_){}
   receipt=RfqSplitState.mark(receipt,fileId,'needs-verification',detail,{observedSha256:observedSha256});
   notifyReceipt(receipt,{saved:false});
   return receipt;
  }
  async function publish(file,sheet){
   var workbook=sheetWorkbook(sheet);
   var preparedFile=await exportRequest('prepare',{target:file.target,freezePlan:RfqBrandHost.freezePlan(workbook)});
   if(!preparedFile||typeof preparedFile.ticket!=='string'||typeof preparedFile.stagePath!=='string')
    throw Error('拆分暂存信息不完整，未写入。');
   await RfqBrandHost.write(options.application,workbook,preparedFile.stagePath,{finalizeFreeze:function(){
    return exportRequest('freeze',{ticket:preparedFile.ticket});
   }});
   var result;
   try{result=await exportRequest('commit',{ticket:preparedFile.ticket});}
   catch(error){if(error.status&&error.status<500)throw error;result=await exportRequest('commit',{ticket:preparedFile.ticket});}
   if(!result||result.target!==preparedFile.target||!/^[a-f\d]{64}$/i.test(result.sha256))
    throw Error('未取得有效保存回执，请检查目标文件。');
   await exportRequest('verify',{ticket:preparedFile.ticket,target:result.target,sha256:result.sha256});
   return result.sha256;
  }
  function findSheet(file){
   var current=currentGeneration(),sheets=current&&current.modelSnapshot&&current.modelSnapshot.sheets||[];
   return sheets.filter(function(sheet){return sheet.sheetId===file.sheetId&&sheet.kind==='inquiry';})[0]||null;
  }
  function showResult(plan,record){
   if(!document.body)return;
   if(resultOverlay)resultOverlay.remove();
   var summary=RfqSplitState.summarize(record);
   resultOverlay=node('div',null,'rfq-split-result');resultOverlay.setAttribute('role','dialog');
   resultOverlay.setAttribute('aria-modal','true');resultOverlay.setAttribute('aria-label','拆分完成');
   var panel=node('div',null,'rfq-split-result-panel');
   panel.appendChild(node('h2','本次拆分：'+summary.succeeded.length+' 份已完成'));
   panel.appendChild(node('p','原分类工作簿与汇总表保留。','note'));
   var list=node('ol',null,'rfq-split-result-list');
   (plan.files||[]).forEach(function(file){
    var recordFile=(record.files||[]).filter(function(item){return item.fileId===file.fileId;})[0]||{state:'pending'};
    var li=node('li');li.setAttribute('data-result-file',file.fileId);
    li.appendChild(node('strong',file.name));
    li.appendChild(node('span',stateLabel(recordFile.state),recordFile.state==='succeeded'?'is-done':'is-failed'));
    list.appendChild(li);
   });
   panel.appendChild(list);
   var summaryLine=node('p','完成 '+summary.succeeded.length+' 份 · 失败 '+summary.failed.length+' 份'+
    (summary.needsVerification.length?' · 待核对 '+summary.needsVerification.length+' 份':'')+
    '。已有文件不覆盖，失败项可单独重试。','note');
   panel.appendChild(summaryLine);
   var close=node('button','关闭','locate');close.type='button';close.addEventListener('click',function(){resultOverlay.remove();resultOverlay=null;});
   panel.appendChild(close);resultOverlay.appendChild(panel);document.body.appendChild(resultOverlay);
  }
  function openDirectory(){
   var app=options.application;
   if(!app)throw Error('请在WPS内打开侧栏后再打开输出文件夹。');
   if(app.OAAssist&&typeof app.OAAssist.ShellExecute==='function'){
    app.OAAssist.ShellExecute('explorer.exe','"'+String(directory).replace(/"/g,'')+'"');
    return;
   }
   if(typeof app.Shell==='function'){
    app.Shell('explorer.exe "'+String(directory).replace(/"/g,'')+'"',1,false);
    return;
   }
   if(typeof app.ShellExecute==='function'){
    app.ShellExecute('explorer.exe','"'+String(directory).replace(/"/g,'')+'"','',1);
    return;
   }
   throw Error('当前WPS版本不支持直接打开文件夹，请按上方路径手动打开：'+directory);
  }
  // 显式内容核对：已有但未记账的文件先按冻结快照逐值核对，核对通过且SHA稳定才用带expectedRevision的save记账成功；
  // 不一致或保存冲突保留原文件并继续待核对，绝不覆盖、也不因重复刷新自动成功。
  async function verifyBlocked(plan,items){
   var report=[];
   for(var index=0;index<items.length;index++){
    var item=items[index],file=plan.files.filter(function(candidate){return candidate.fileId===item.fileId;})[0];
    if(!file)continue;
    if(!receiptMatches()){report.push('来源或总簿已变化，停止核对。');break;}
    tell('正在核对已有文件 '+(index+1)+' / '+items.length+'：'+file.name);
    await new Promise(function(resolve){setTimeout(resolve,0);});
    var outcome;
    try{
     var sheet=findSheet(file);
     if(!sheet)throw Error('冻结快照里找不到对应询价页，无法核对。');
     outcome=await RfqExportHost.verifyExistingOutput(options.application,file,sheet,inspectFile);
    }catch(error){outcome={ok:false,sha256:null,mismatches:[error.message],layoutIssues:[]};}
    if(!receiptMatches()){report.push('核对期间来源或总簿已变化，未记账成功。');break;}
    if(outcome.ok){
     var again=await inspectFile(file.target);
     if(!again||again.exists!==true||String(again.sha256||'').toLowerCase()!==String(outcome.sha256||'').toLowerCase())
      outcome={ok:false,sha256:null,mismatches:['目标文件在核对后再次检查时已变化，未记账成功。'],layoutIssues:[]};
    }
    if(outcome.ok){
     receipt=RfqSplitState.mark(receipt,file.fileId,'succeeded',outcome.sha256,{proof:'content-check'});
     try{await saveReceipt(receipt);}
     catch(saveError){
      report.push(file.name+'：核对通过但回执未记账（'+saveError.message+'），保持待核对。');
      receipt=await reloadAfterSaveFailure(receipt,file.fileId,
       '内容核对通过但回执未记账：'+saveError.message,outcome.sha256);
     }
    }else{
     var detail='待核对：'+((outcome.mismatches||[]).concat(outcome.layoutIssues||[]).join('；')||
      '实际内容与冻结快照不一致')+'。原文件保留在 '+file.target+'，不覆盖。';
     receipt=RfqSplitState.mark(receipt,file.fileId,'needs-verification',detail,{observedSha256:outcome.sha256});
     try{await saveReceipt(receipt);}catch(saveError){
      receipt=await reloadAfterSaveFailure(receipt,file.fileId,detail,outcome.sha256);
     }
     report.push(file.name+'：'+detail);
    }
    render();
   }
   return report;
  }
  async function execute(){
   if(busy)return;
   if(!directory){tell('请先选择拆分输出目录。',true);return;}
   await syncPlan();
   if(!prepared||(prepared.canPublish!==true&&prepared.canVerify!==true)){
    tell('还有冲突未解决，未开始拆分：'+((prepared&&prepared.conflicts||[]).map(function(item){return item.message;}).join('；')||
     prepareError||'请检查总询价工作簿、输出目录和已有文件。'),true);return;}
   var plan=prepared.plan,record=receipt;
   if(!record){tell('拆分回执尚未建立，未开始拆分。',true);return;}
   var blocked=RfqSplitState.blocked(record),todo=RfqSplitState.pending(record);
   if(!blocked.length&&!todo.length){
    if(options.onComplete)await options.onComplete();
    tell('所有文件都已成功并核对通过，无需重做。',false);if(document.body.classList.contains('detail-mode'))showResult(plan,record);return;}
   busy=true;if(options.onBusy)options.onBusy(true);render();
   try{
    if(blocked.length){
     var verifyReport=await verifyBlocked(plan,blocked);
     if(verifyReport.length)tell('已有文件核对结果：'+verifyReport.join('；'),true);
    }
    record=receipt;todo=RfqSplitState.pending(record);
    for(var index=0;index<todo.length;index++){
     var item=todo[index],file=plan.files.filter(function(candidate){return candidate.fileId===item.fileId;})[0];
     if(!file)continue;
     tell('正在拆分 '+(index+1)+' / '+todo.length+'：'+file.name);
     await new Promise(function(resolve){setTimeout(resolve,0);});
     try{
      var sheet=findSheet(file);
      if(!sheet)throw Error('生成快照里找不到对应询价页。');
      var sha=await publish(file,sheet);
      record=RfqSplitState.mark(record,file.fileId,'succeeded',sha);
      try{await saveReceipt(record);}
      catch(saveError){
       record=await refreshReceiptAfterFailure(record,file.fileId,'文件已发布但回执未记账：'+saveError.message,sha);
      }
     }catch(error){
      var seen=await inspectFile(file.target);
      var detail=seen.exists?('文件已存在但未完成记账：'+error.message):error.message;
      record=RfqSplitState.mark(record,file.fileId,seen.exists?'needs-verification':'failed',detail,
       {observedSha256:seen.exists?seen.sha256:null});
      try{await saveReceipt(record);}catch(saveError){
       record=await refreshReceiptAfterFailure(record,file.fileId,'回执保存失败：'+saveError.message,
        seen.exists?seen.sha256:null);
      }
     }
     render();
    }
    await syncPlan();
    var summary=receipt?RfqSplitState.summarize(receipt):{succeeded:[],failed:[],needsVerification:[]};
    tell('拆分完成'+summary.succeeded.length+'份，失败'+summary.failed.length+'份'+
      (summary.needsVerification.length?('，待核对'+summary.needsVerification.length+'份'):'')+
      (summary.failed.length||summary.needsVerification.length?
       '；待核对项已列出原文件位置，逐值核对通过才记账成功，原文件不覆盖。':'。'),
      !!(summary.failed.length||summary.needsVerification.length));
    if(options.onComplete)await options.onComplete();
    if(receipt&&document.body.classList.contains('detail-mode'))showResult(plan,receipt);
   }finally{busy=false;if(options.onBusy)options.onBusy(false);render();}
  }
  if(chooseDirectory)chooseDirectory.addEventListener('click',function(){
   if(!window.RfqPathPicker){tell('当前侧栏不支持目录选择，请重新打开侧栏。',true);return;}
   if(typeof RfqPathPicker.selectFolder==='function'){
    var native=RfqPathPicker.selectFolder(options.application,directory,'选择拆分输出文件夹');
    if(native&&native.supported){
     if(native.path){directory=native.path;batchId=ensureBatch();syncPlan();}
     return;
    }
   }
   RfqPathPicker.open({mode:'directory',token:window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token,
    startPath:directory,title:'选择拆分输出文件夹',confirmLabel:'使用此文件夹',
    onConfirm:function(paths){directory=paths&&paths[0]||'';batchId=ensureBatch();syncPlan();},
    onError:function(text){tell(text,true);}});
  });
  if(runButton)runButton.addEventListener('click',function(){execute();});
  if(retryButton)retryButton.addEventListener('click',function(){execute();});
  if(openButton)openButton.addEventListener('click',function(){
   try{openDirectory();tell('已请求打开输出文件夹：'+directory);}catch(error){tell(error.message,true);}
  });
  render();
  async function chooseOutputDirectory(){
   if(!window.RfqPathPicker)throw Error('目录选择器未加载，请重新打开助手。');
   if(typeof RfqPathPicker.selectFolder==='function'){var native=RfqPathPicker.selectFolder(options.application,directory,'选择拆分输出文件夹');
    if(native&&native.supported){if(native.path){directory=native.path;batchId=ensureBatch();await syncPlan();}return;}}
   return new Promise(function(resolve){RfqPathPicker.open({mode:'directory',token:window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token,startPath:directory,title:'选择拆分输出文件夹',confirmLabel:'使用此文件夹',onConfirm:async function(paths){directory=paths&&paths[0]||'';batchId=ensureBatch();await syncPlan();resolve();},onCancel:resolve,onError:function(text){tell(text,true);resolve();}});});
  }
  return {execute:execute,chooseDirectory:chooseOutputDirectory,openDirectory:openDirectory,directory:function(){return directory;},refresh:function(){return syncPlan();},receipt:function(){return receipt;},
   restore:function(value){
    if(value&&value.projectId&&value.batchId&&Array.isArray(value.files)){
     receipt=RfqSplitState.demoteUnproven(value);revision=Number(receipt.revision)||0;batchId=receipt.batchId;
     directory=receipt.outputDirectory||receipt.directory||'';
     notifiedReceipt=receiptFingerprint(receipt);
    }
    syncPlan();
   },
   prepare:syncPlan,
   verdict:function(){
    if(!receipt||!receipt.files||!receipt.files.length)return {ready:false,detail:'尚未完成拆分'};
    if(!receiptMatches())return {ready:false,detail:'总询价工作簿或输出目录已变化，需要重新拆分'};
    var summary=RfqSplitState.summarize(receipt);
    if(summary.needsVerification.length)return {ready:false,detail:'有文件待核对，不能沿用旧成功记录'};
    if(!summary.done)return {ready:false,detail:'还有文件未成功：'+String(summary.failed.length+summary.pending.length)+'份'};
    return {ready:true,detail:'拆分已完成并记录SHA'};
   }};
 }
 window.RfqSplitUI={create:create};
}());
