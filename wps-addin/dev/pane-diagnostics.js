(function(){
 'use strict';
 var config=window.__RFQ_PANE_PROBE__;
 if(!config)return;
 var frameCount=0,pendingSince=null,stalled=false,visibleSince=Date.now(),lastEvent={},paneSession=('00000000'+Math.floor(Math.random()*0xffffffff).toString(16)).slice(-8)+
  ('00000000'+Math.floor(Math.random()*0xffffffff).toString(16)).slice(-8);
 function frame(){
  // A stopped compositor must not accumulate one callback per heartbeat.
  if(pendingSince!==null)return;
  pendingSince=Date.now();
  window.requestAnimationFrame(function(){
   frameCount++;pendingSince=null;
   if(stalled){stalled=false;report('pane-render-resumed');}
  });
 }
 function metrics(stage,event,target){
  var header=document.querySelector('header'),button=document.getElementById('import-files'),controls=document.getElementById('task-controls');
  var message=document.getElementById('import-message'),merge=document.getElementById('merge-identical');
  var summary=document.getElementById('merge-summary'),counts=summary&&summary.textContent.match(/原始\s*\d+\s*项\s*→\s*预览\s*(\d+)\s*项/);
  var el=target&&target.nodeType===1?target:null,action=el&&el.closest('button,input,label,summary,select,header');
  function text(id,limit){var node=document.getElementById(id);return node?String(node.textContent||'').slice(0,limit||120):null;}
  return {stage:stage,event:event||'',paneSession:paneSession,eventTarget:action?(action.id||action.tagName):(el?(el.id||el.tagName):null),
   readyState:document.readyState,visibility:document.visibilityState,
   hasFocus:document.hasFocus(),activeTag:document.activeElement&&document.activeElement.tagName,
   importCount:document.querySelectorAll('#imported-books > li').length,
   importComplete:!!message&&message.textContent.indexOf('已导入')>=0,
   mergeChecked:!!merge&&merge.checked,mergePreviewCount:counts?Number(counts[1]):null,
   controlsDisabled:!!controls&&controls.disabled,importDisabled:!!button&&button.disabled,
   scrollY:window.scrollY,scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight,
   headerTop:header?Math.round(header.getBoundingClientRect().top):null,
   importButtonTop:button?Math.round(button.getBoundingClientRect().top):null,frameCount:frameCount,
   framePendingMs:pendingSince===null?0:Math.max(0,Date.now()-pendingSince),
   // 诊断用：把侧栏上几条状态文字带回来，便于定位“红色提示到底说了什么”。
   messageText:text('message'),importMessageText:text('import-message'),mergeStatusText:text('merge-status'),
   classificationMessageText:text('classification-message'),classificationProgressText:text('classification-progress'),
   brandStatusText:text('brand-status'),inquiryStatusText:text('inquiry-status'),splitStatusText:text('split-status'),
   projectStatusText:text('project-status'),headerStatusText:text('header-status'),
   scriptError:window.__RFQ_LAST_ERROR__||null};
 }
 function report(stage,event,target){
  fetch('/__probe/report',{method:'POST',headers:{'content-type':'application/json','x-rfq-probe-token':config.token},
   body:JSON.stringify(metrics(stage,event,target))}).catch(function(){});
 }
 window.addEventListener('load',function(){
  frame();report('pane-ready');
  window.addEventListener('error',function(event){
   window.__RFQ_LAST_ERROR__={kind:'error',message:String(event.message||''),source:String(event.filename||''),
    line:event.lineno||0,column:event.colno||0,at:new Date().toISOString()};
   report('pane-error');
  });
  window.addEventListener('unhandledrejection',function(event){
   var reason=event.reason;
   window.__RFQ_LAST_ERROR__={kind:'unhandledrejection',
    message:String(reason&&reason.message?reason.message:reason||''),at:new Date().toISOString()};
   report('pane-error');
  });
  ['click','wheel','keydown','focusin','scroll'].forEach(function(type){
   window.addEventListener(type,function(event){
    if(type==='wheel'||type==='scroll'){
     var now=Date.now();if(now-(lastEvent[type]||0)<300)return;lastEvent[type]=now;
    }
    report('pane-event',type,event.target);
   },true);
  });
  ['visibilitychange','focus','blur','pageshow','pagehide','resize'].forEach(function(type){
   window.addEventListener(type,function(){
    if(type==='visibilitychange')visibleSince=Date.now();
    if(type==='resize'){
     var now=Date.now();if(now-(lastEvent[type]||0)<300)return;lastEvent[type]=now;
    }
    report('pane-lifecycle',type);
   });
  });
  window.setInterval(function(){
   if(!stalled&&document.visibilityState==='visible'&&pendingSince!==null&&
    Date.now()-pendingSince>=9000&&Date.now()-visibleSince>=9000){
    stalled=true;report('pane-render-stalled');
   }
   report('pane-heartbeat');frame();
  },3000);
 });
 window.addEventListener('error',function(event){report('pane-error',String(event.message||'error').slice(0,300));});
 window.addEventListener('unhandledrejection',function(){report('pane-error','unhandledrejection');});
}());
