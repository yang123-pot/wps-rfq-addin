(function(){
 'use strict';
 // 项目助手只保留独立窗口入口，不读取或渲染完整学习库。
 function create(options){
  var open=document.getElementById('library-open');
  if(open)open.onclick=function(){try{RfqLibraryWindow.open(options.application||window.Application);}catch(e){document.getElementById('library-message').textContent=e.message;}};
  var applying=false;
  async function applyRequest(){
   var storage=options.application&&options.application.PluginStorage;if(applying||!storage||!storage.getItem)return;
   var raw=storage.getItem('rfq.library.apply.request');if(!raw)return;
   var request;try{request=JSON.parse(raw);}catch(_){return;}
   if(request.projectId!==(options.getProjectId&&options.getProjectId()))return;
   if(storage.removeItem)storage.removeItem('rfq.library.apply.request');else storage.setItem('rfq.library.apply.request','');
   if(options.isConfirmed&&options.isConfirmed()){document.getElementById('library-message').textContent='当前项目已经确认，保留原分类；库合并用于后续项目。';return;}
   applying=true;try{var response=await fetch('/api/library/classify-index',{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},body:'{}'}),state=await response.json();if(!response.ok)throw Error(state.error||'分类索引读取失败。');
    if(request.projectId!==(options.getProjectId&&options.getProjectId())||(options.isConfirmed&&options.isConfirmed()))return;
    if(options.onChange)options.onChange(state);
   }catch(e){document.getElementById('library-message').textContent=e.message;}finally{applying=false;}
  }
  if(window.addEventListener)window.addEventListener('focus',applyRequest);
  if(window.setInterval)window.setInterval(function(){if(document.visibilityState!=='hidden')applyRequest();},1000);
  return {load:function(){},current:function(){return null;},adopt:function(){},adoptMemory:function(){}};
 }
 window.RfqLibraryUI={create:create};
}());
