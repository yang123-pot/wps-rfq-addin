/*
 * 仅开发验收模式加载（`dev/server.cjs --report ... --probe-output ...`）。
 * 用途：WPS 侧栏是内嵌网页，自动化注入的滚轮/键盘都到不了页面，只有鼠标点击能到。
 * 这里在页面右上/右下角放两个固定按钮，用点击把页面向下/向上翻一屏，验收脚本就能
 * 走到下半部分的面板。发布构建按 F1 规则排除本文件，普通产品页面不会加载。
 */
(function(){
 'use strict';
 var config=window.__RFQ_PANE_PROBE__;
 if(!config)return;
 function report(step){
  try{
   fetch('/__probe/report',{method:'POST',headers:{'content-type':'application/json','x-rfq-probe-token':config.token},
    body:JSON.stringify({stage:'acceptance-scroll',event:step,scrollY:window.scrollY,
     scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight})}).catch(function(){});
  }catch(_){}
 }
 function make(label,delta,offset){
  var button=document.createElement('button');
  button.type='button';button.textContent=label;button.setAttribute('data-acceptance',label);
  button.style.cssText='position:fixed;right:10px;z-index:2147483647;width:46px;height:46px;border-radius:23px;'+
   'border:0;background:#237555;color:#fff;font-size:18px;line-height:1;cursor:pointer;box-shadow:0 2px 10px #0005;'+
   'top:calc(50% + '+offset+'px);';
  button.addEventListener('click',function(){
   window.scrollBy(0,delta);
   window.setTimeout(function(){report(label);},60);
  });
  return button;
 }
 function mount(){
  if(document.querySelector('button[data-acceptance]'))return;
  if(!document.body)return;
  document.body.appendChild(make('▼',560,20));
  document.body.appendChild(make('▲',-560,-26));
  report('mounted');
 }
 if(document.readyState==='complete'||document.readyState==='interactive')mount();
 else window.addEventListener('load',mount);
}());
