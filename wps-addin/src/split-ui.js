(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  options=options||{};
  var message=document.getElementById('split-message'),status=document.getElementById('split-status'),
    chooseDirectory=document.getElementById('split-directory'),directoryLabel=document.getElementById('split-directory-label'),
    previewList=document.getElementById('split-preview'),runButton=document.getElementById('split-run'),
    retryButton=document.getElementById('split-retry');
  var directory='',receipt=null,busy=false;
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function generation(){return options.generation?options.generation():null;}
  function plan(){
   var current=generation(),ctx=options.context?options.context():null;
   if(!current||!current.modelSnapshot)throw Error('请先生成并校验总询价工作簿。');
   return RfqSplitPlan.build({model:current.modelSnapshot,generation:current,targetDirectory:directory,
    currentKey:ctx?ctx.inputKey:null});
  }
  function currentReceipt(built){
   if(receipt&&receipt.inputKey===built.inputKey&&receipt.generationSha256===
    (generation()&&generation().sha256||''))return receipt;
   return RfqSplitState.create(built,generation()?generation().sha256:'');
  }
  function render(){
   var built=null,error=null;
   try{built=plan();}catch(problem){error=problem.message;}
   if(directoryLabel)directoryLabel.textContent=directory?('输出目录：'+directory):'尚未选择输出目录。';
   runButton.disabled=busy||!built||!built.canPublish;
   previewList.textContent='';
   if(error){status.textContent='还不能拆分：'+error;retryButton.disabled=true;return;}
   receipt=currentReceipt(built);
   var summary=RfqSplitState.summarize(receipt);
   status.textContent='计划 '+built.files.length+' 个文件 · 完成 '+summary.succeeded.length+' · 失败 '+summary.failed.length+
    ' · 待处理 '+summary.pending.length+(summary.needsVerification.length?' · 待核对 '+summary.needsVerification.length:'')+
    (built.conflicts.length?(' · 冲突 '+built.conflicts.length+'：'+built.conflicts[0].message):'');
   retryButton.disabled=busy||!(summary.failed.length||summary.pending.length||summary.needsVerification.length)||!built.canPublish;
   built.files.forEach(function(file){
    var record=receipt.files.filter(function(item){return item.fileId===file.fileId;})[0]||{state:'pending'};
    var li=node('li');li.setAttribute('data-split-file',file.fileId);
    li.appendChild(node('strong',file.name));
    li.appendChild(node('p',file.categoryName+' · '+(file.brand||'（无品牌）')+' · '+(file.supplier||'（无供应商）')+
     ' · 材料 '+file.materialRows+' 行 · 状态：'+record.state+(record.error?'（'+record.error+'）':''),'source'));
    li.appendChild(node('p',file.target,'source'));
    previewList.appendChild(li);
   });
   built.conflicts.forEach(function(conflict){
    var li=node('li',null,'review-note');li.appendChild(node('strong','冲突：'));
    li.appendChild(node('span',conflict.message));previewList.appendChild(li);
   });
   if(!built.files.length)previewList.appendChild(node('li','没有可拆分的询价页。','empty'));
  }
  function sheetWorkbook(sheet){return {mode:'inquiry',inputKey:'',sheets:[{name:sheet.name,values:sheet.values}]};}
  function requests(action,payload){
   var token=window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token;
   if(!token)return Promise.reject(Error('当前会话未启用拆分，请启动最新开发服务并重新打开侧栏。'));
   return fetch('/api/export/'+action,{method:'POST',
    headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(payload||{})})
    .then(function(response){return response.text().then(function(body){
     var result;try{result=JSON.parse(body);}catch(_){result={};}
     if(!response.ok){var error=Error(result.error||'拆分请求失败。');error.status=response.status;throw error;}
     return result;});});
  }
  async function publish(file,sheet){
   var prepared=await requests('prepare',{target:file.target});
   if(!prepared||typeof prepared.ticket!=='string'||typeof prepared.stagePath!=='string')
    throw Error('拆分会话信息不完整，未写入。');
   await RfqBrandHost.write(options.application,sheetWorkbook(sheet),prepared.stagePath);
   var result;
   try{result=await requests('commit',{ticket:prepared.ticket});}
   catch(error){if(error.status&&error.status<500)throw error;result=await requests('commit',{ticket:prepared.ticket});}
   if(!result||result.target!==prepared.target||!/^[a-f\d]{64}$/i.test(result.sha256))
    throw Error('未取得有效保存回执，请检查目标文件。');
   return result.sha256;
  }
  async function execute(onlyPending){
   if(busy)return;
   var built,summary;
   try{built=plan();}catch(error){tell(error.message,true);return;}
   if(!built.canPublish){tell('还有冲突未解决，未开始拆分：'+built.conflicts.map(function(item){return item.message;}).join('；'),true);return;}
   receipt=currentReceipt(built);
   summary=RfqSplitState.summarize(receipt);
   var todo=summary.pending.concat(summary.failed,summary.needsVerification);
   if(onlyPending===false)todo=receipt.files;
   if(!todo.length){tell('所有文件都已成功，无需重做。');return;}
   try{
    busy=true;if(options.onBusy)options.onBusy(true);render();
    var done=0,failed=0,index;
    for(index=0;index<todo.length;index++){
     var file=built.files.filter(function(item){return item.fileId===todo[index].fileId;})[0];
     if(!file){continue;}
     var sheet=(generation().modelSnapshot.sheets||[]).filter(function(item){return item.sheetId===file.sheetId;})[0];
     tell('正在拆分 '+(index+1)+' / '+todo.length+'：'+file.name);
     try{
      if(!sheet)throw Error('生成快照里找不到对应询价页。');
      var sha=await publish(file,sheet);
      receipt=RfqSplitState.mark(receipt,file.fileId,'succeeded',sha);done++;
     }catch(error){receipt=RfqSplitState.mark(receipt,file.fileId,'failed',error.message);failed++;}
     if(options.onSplit)options.onSplit(receipt);
     render();
    }
    tell('拆分完成'+done+'份，失败'+failed+'份。'+(failed?'可以点“重试未完成”只补做失败的文件。':'全部文件都已成功并记录SHA。'),
     failed>0);
   }finally{busy=false;if(options.onBusy)options.onBusy(false);render();}
  }
  if(chooseDirectory)chooseDirectory.addEventListener('click',function(){
   try{
    var picked=options.application.GetSaveAsFilename('请选择拆分输出目录（任取一个文件名即可）','Excel 工作簿 (*.xlsx),*.xlsx',1,'选择拆分输出目录');
    if(picked===false||picked===null||picked===''){tell('已取消选择输出目录。');return;}
    if(!/^(?:[a-z]:[\\/]|\\\\)/i.test(picked))throw Error('请选择绝对路径。');
    directory=picked.replace(/[\\\/][^\\\/]*$/,'');
    tell('拆分输出目录：'+directory);
   }catch(error){tell(error.message,true);}
   render();
  });
  if(runButton)runButton.addEventListener('click',function(){execute(false);});
  if(retryButton)retryButton.addEventListener('click',function(){execute(true);});
  render();
  return {refresh:render,receipt:function(){return receipt;},restore:function(value){receipt=value||null;render();},
   verdict:function(){
    if(!receipt||!receipt.files||!receipt.files.length)return {ready:false,detail:'尚未完成拆分'};
    var summary=RfqSplitState.summarize(receipt);
    if(summary.needsVerification.length)return {ready:false,detail:'有文件被外部改写，需要核对后重新拆分'};
    if(!summary.done)return {ready:false,detail:'还有文件未成功：'+String(summary.failed.length+summary.pending.length)+'份'};
    return {ready:true,detail:'拆分已完成并记录SHA'};
   }};
 }
 window.RfqSplitUI={create:create};
}());
