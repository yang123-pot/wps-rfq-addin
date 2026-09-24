(function(){
 'use strict';
 var config=window.__RFQ_PANE_PROBE__;
 if(!config)return;
 var frameCount=0,lastEvent={},paneSession=('00000000'+Math.floor(Math.random()*0xffffffff).toString(16)).slice(-8)+
  ('00000000'+Math.floor(Math.random()*0xffffffff).toString(16)).slice(-8);
 function frame(){window.requestAnimationFrame(function(){frameCount++;});}
 function metrics(stage,event,target){
  var header=document.querySelector('header'),button=document.getElementById('import-files'),controls=document.getElementById('task-controls');
  var message=document.getElementById('import-message'),merge=document.getElementById('merge-identical');
  var summary=document.getElementById('merge-summary'),counts=summary&&summary.textContent.match(/原始\s*\d+\s*项\s*→\s*预览\s*(\d+)\s*项/);
  var el=target&&target.nodeType===1?target:null,action=el&&el.closest('button,input,label,summary,select,header');
  return {stage:stage,event:event||'',paneSession:paneSession,eventTarget:action?(action.id||action.tagName):(el?(el.id||el.tagName):null),
   readyState:document.readyState,visibility:document.visibilityState,
   hasFocus:document.hasFocus(),activeTag:document.activeElement&&document.activeElement.tagName,
   importCount:document.querySelectorAll('#imported-books > li').length,
   importComplete:!!message&&message.textContent.indexOf('已导入')>=0,
   mergeChecked:!!merge&&merge.checked,mergePreviewCount:counts?Number(counts[1]):null,
   controlsDisabled:!!controls&&controls.disabled,importDisabled:!!button&&button.disabled,
   scrollY:window.scrollY,scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight,
   headerTop:header?Math.round(header.getBoundingClientRect().top):null,
   importButtonTop:button?Math.round(button.getBoundingClientRect().top):null,frameCount:frameCount};
 }
 function report(stage,event,target){
  fetch('/__probe/report',{method:'POST',headers:{'content-type':'application/json','x-rfq-probe-token':config.token},
   body:JSON.stringify(metrics(stage,event,target))}).catch(function(){});
 }
 window.addEventListener('load',function(){
  frame();report('pane-ready');
  ['click','wheel','keydown','focusin','scroll'].forEach(function(type){
   window.addEventListener(type,function(event){
    if(type==='wheel'||type==='scroll'){
     var now=Date.now();if(now-(lastEvent[type]||0)<300)return;lastEvent[type]=now;
    }
    report('pane-event',type,event.target);
   },true);
  });
  window.setInterval(function(){report('pane-heartbeat');frame();},3000);
 });
 window.addEventListener('error',function(event){report('pane-error',String(event.message||'error').slice(0,300));});
 window.addEventListener('unhandledrejection',function(){report('pane-error','unhandledrejection');});
}());
