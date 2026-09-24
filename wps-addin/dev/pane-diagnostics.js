(function(){
 'use strict';
 var config=window.__RFQ_PANE_PROBE__;
 if(!config)return;
 var frameCount=0;
 function frame(){window.requestAnimationFrame(function(){frameCount++;});}
 function metrics(stage,event){
  var header=document.querySelector('header'),button=document.getElementById('import-files'),controls=document.getElementById('task-controls');
  var message=document.getElementById('import-message');
  return {stage:stage,event:event||'',readyState:document.readyState,visibility:document.visibilityState,
   hasFocus:document.hasFocus(),activeTag:document.activeElement&&document.activeElement.tagName,
   importCount:document.querySelectorAll('#imported-books > li').length,
   importComplete:!!message&&message.textContent.indexOf('已导入')>=0,
   controlsDisabled:!!controls&&controls.disabled,importDisabled:!!button&&button.disabled,
   scrollY:window.scrollY,scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight,
   headerTop:header?Math.round(header.getBoundingClientRect().top):null,
   importButtonTop:button?Math.round(button.getBoundingClientRect().top):null,frameCount:frameCount};
 }
 function report(stage,event){
  fetch('/__probe/report',{method:'POST',headers:{'content-type':'application/json','x-rfq-probe-token':config.token},
   body:JSON.stringify(metrics(stage,event))}).catch(function(){});
 }
 window.addEventListener('load',function(){
  frame();report('pane-ready');
  ['click','wheel','keydown','focusin','scroll'].forEach(function(type){
   window.addEventListener(type,function(){report('pane-event',type);},true);
  });
  window.setInterval(function(){report('pane-heartbeat');frame();},3000);
 });
 window.addEventListener('error',function(event){report('pane-error',String(event.message||'error').slice(0,300));});
 window.addEventListener('unhandledrejection',function(){report('pane-error','unhandledrejection');});
}());
