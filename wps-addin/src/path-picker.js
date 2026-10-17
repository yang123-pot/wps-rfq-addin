/*
 * 侧栏内置路径选择器。
 *
 * 用途：代替 Application.GetOpenFilename / GetSaveAsFilename。实机证据（2026-09-26）显示，
 * 原生模态文件对话框会让侧栏内嵌网页停止出帧，画面冻结、只能重建侧栏；本组件全部用页面内的
 * HTML 完成选择，不创建任何原生窗口。目录列表由本机服务的只读接口 /api/fs/list 提供。
 *
 * 只做选择：不新建、不改名、不删除、不覆盖任何文件。
 */
(function(){
 'use strict';
 var MAX_FILES = 20;
 function element(tag, text, className){
  var node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(className)node.className=className;
  return node;
 }
 function normalizePath(value){return String(value==null?'':value).trim();}
 function fileKey(value){return String(value||'').replace(/[\\/]+/g,'/').toLowerCase();}
 function readableSize(bytes){
  if(typeof bytes!=='number'||!isFinite(bytes)||bytes<0)return '';
  if(bytes<1024)return bytes+' B';
  if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1024/1024).toFixed(1)+' MB';
 }
 function open(options){
  var config=options||{};
  var mode=config.mode==='directory'?'directory':(config.mode==='files'?'files':(config.mode==='save'?'save':'file'));
  var extensions=(config.extensions||[]).slice(0,20);
  var token=config.token;
  var onConfirm=typeof config.onConfirm==='function'?config.onConfirm:null;
  var onCancel=typeof config.onCancel==='function'?config.onCancel:null;
  if(!token){ if(typeof config.onError==='function')config.onError('侧栏文件浏览未启用，请重新打开侧栏或改用系统对话框。'); return null; }
  var previous=document.querySelector('.rfq-picker');
  if(previous)previous.remove();
  var state={path:normalizePath(config.startPath),parent:null,roots:[],entries:[],selected:[],loading:false,truncated:false,total:0,message:''};
  var requestId=0;
  var overlay=element('div',' ','rfq-picker');
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label',config.title||'选择文件');
  var panel=element('div',null,'rfq-picker-panel');
  var head=element('div',null,'rfq-picker-head');
  head.appendChild(element('strong',config.title||'选择文件','rfq-picker-title'));
  var close=element('button','×','rfq-picker-close');
  close.type='button';close.setAttribute('aria-label','关闭选择器');
  head.appendChild(close);
  panel.appendChild(head);
  var pathRow=element('div',null,'rfq-picker-path-row');
  var pathInput=element('input',null,'rfq-picker-path');
  pathInput.type='text';
  pathInput.setAttribute('aria-label','当前路径');
  pathInput.placeholder='可直接粘贴或输入完整路径';
  var go=element('button','转到','rfq-picker-go');
  go.type='button';
  pathRow.appendChild(pathInput);pathRow.appendChild(go);
  panel.appendChild(pathRow);
  // R3新增save模式：目录＋文件名＋已有目标提示；取消不改变阶段，后续另存/选目录统一复用本选择器。
  var nameRow=null,nameInput=null,existsNote=null;
  if(mode==='save'){
   nameRow=element('div',null,'rfq-picker-name-row');
   nameInput=element('input',null,'rfq-picker-name');
   nameInput.type='text';
   nameInput.setAttribute('aria-label','文件名');
   nameInput.value=normalizePath(config.fileName);
   nameInput.placeholder='文件名.xlsx';
   nameRow.appendChild(nameInput);
   panel.appendChild(nameRow);
   existsNote=element('p','','note rfq-picker-exists');
   existsNote.setAttribute('role','status');
   panel.appendChild(existsNote);
  }
  var note=element('p',config.hint||'只列目录和'+ (extensions.length?extensions.join(' / '):'全部') +'文件；先进入目录，再勾选文件。','note rfq-picker-hint');
  panel.appendChild(note);
  var list=element('ul',null,'rfq-picker-list');
  panel.appendChild(list);
  var status=element('p',null,'rfq-picker-status');
  status.setAttribute('role','status');
  panel.appendChild(status);
  var summary=element('p',null,'note rfq-picker-summary');
  panel.appendChild(summary);
  var foot=element('div',null,'review-actions rfq-picker-foot');
  var cancel=element('button','取消','locate');
  cancel.type='button';
  var confirm=element('button',config.confirmLabel||'确定','');
  confirm.type='button';
  foot.appendChild(cancel);foot.appendChild(confirm);
  panel.appendChild(foot);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function closePicker(){overlay.remove();document.removeEventListener('keydown',onKey,true);}
  function cancelPicker(){closePicker();if(onCancel)onCancel();}
  function selectedPaths(){return state.selected.slice();}
  function render(){
   // 不要覆盖用户正在输入或刚粘贴的路径：初次加载是异步的，直接回写会把输入清掉。
   if(document.activeElement!==pathInput)pathInput.value=state.path;
   list.textContent='';
   if(!state.path&&state.roots.length){
    state.roots.forEach(function(root){
     var li=element('li');
     var item=element('button',root.name,'rfq-picker-entry');
     item.type='button';item.setAttribute('data-type','directory');item.setAttribute('data-path',root.path);
     item.addEventListener('click',function(){load(root.path);});
     li.appendChild(item);list.appendChild(li);
    });
   }
   if(state.path&&state.parent){
    var up=element('li');
    var upButton=element('button','↑ 上级目录','rfq-picker-entry');
    upButton.type='button';upButton.setAttribute('data-type','directory');upButton.setAttribute('data-path',state.parent);
    upButton.addEventListener('click',function(){load(state.parent);});
    up.appendChild(upButton);list.appendChild(up);
   }
   state.entries.forEach(function(entry){
    var li=element('li');
    var item=element('button',null,'rfq-picker-entry');
    item.type='button';item.setAttribute('data-type',entry.type);item.setAttribute('data-path',entry.path);
    item.appendChild(element('span',entry.type==='directory'?'📁 '+entry.name:entry.name,'rfq-picker-name'));
    var extra=entry.type==='directory'?'目录':readableSize(entry.size);
    if(extra)item.appendChild(element('span',extra,'rfq-picker-meta'));
    if(entry.type==='directory'){
     item.addEventListener('click',function(){load(entry.path);});
    }else{
     item.setAttribute('aria-pressed',state.selected.some(function(path){return fileKey(path)===fileKey(entry.path);})?'true':'false');
     if(state.selected.some(function(path){return fileKey(path)===fileKey(entry.path);}))item.classList.add('selected');
     item.addEventListener('click',function(){toggle(entry.path);});
     item.addEventListener('dblclick',function(){toggle(entry.path,true);});
    }
    li.appendChild(item);list.appendChild(li);
   });
   if(!list.childNodes.length)list.appendChild(element('li','此目录没有可选项。','empty'));
   status.className='rfq-picker-status'+(state.message?' error':'');
   status.textContent=state.loading?'正在读取目录…':state.message;
   if(state.truncated)status.textContent=(state.message?state.message+' ':'')+'此目录共 '+state.total+' 项，只显示前 '+state.entries.length+' 项，请输入更具体的路径。';
   var paths=selectedPaths();
   var fileName=mode==='save'?String(nameInput.value||'').trim():'';
   var targetExists=mode==='save'&&!!fileName&&state.entries.some(function(entry){
    return entry.type==='file'&&fileKey(entry.name)===fileKey(fileName);});
   if(mode==='save'){
    summary.textContent=(state.path||'尚未选择目录')+(fileName?'\\'+fileName:'（请输入文件名）');
    if(existsNote)existsNote.textContent=targetExists?
      '该目录下已有同名文件：插件不会覆盖，请在“保存/发布”时改用新文件名。':'';
    if(existsNote)existsNote.className='note rfq-picker-exists'+(targetExists?' error':'');
   }
   else summary.textContent=mode==='directory'?(state.path||'尚未选择目录'):(paths.length?'已选 '+paths.length+' 项：'+paths.join('；'):'尚未选择文件');
   confirm.disabled=state.loading||(mode==='directory'?!state.path:(mode==='save'?(!state.path||!fileName):!paths.length));
  }
  function toggle(path,autoConfirm){
   var key=fileKey(path);
   var existsIndex=-1;
   state.selected.forEach(function(item,index){if(fileKey(item)===key)existsIndex=index;});
   if(mode==='files'){
    if(existsIndex>=0)state.selected.splice(existsIndex,1);
    else if(state.selected.length>=MAX_FILES){state.message='每批最多选择 '+MAX_FILES+' 份，请分批导入。';}
    else {state.selected.push(path);state.message='';}
   }else{
    state.selected=existsIndex>=0?[]:[path];
    state.message='';
   }
   render();
   if(autoConfirm&&mode!=='files'&&state.selected.length)finish();
  }
  function finish(){
   var paths=selectedPaths();
   if(mode==='directory'){
    if(!state.path){state.message='请先进入要输出的目录。';render();return;}
    closePicker();if(onConfirm)onConfirm([state.path]);return;
   }
   if(mode==='save'){
    var fileName=String(nameInput.value||'').trim();
    if(!state.path){state.message='请先进入要保存的目录。';render();return;}
    if(!fileName){state.message='请填写文件名。';render();return;}
    if(/[\\/]/.test(fileName)||/[<>:"|?*]|[. ]$/.test(fileName)){state.message='文件名不能包含 \\ / : * ? " < > | 或以点/空格结尾。';render();return;}
    var target=state.path.replace(/[\\/]+$/,'')+'\\'+fileName;
    closePicker();if(onConfirm)onConfirm({directory:state.path,name:fileName,target:target});return;
   }
   if(!paths.length){state.message='请先选择文件。';render();return;}
   if(mode==='file'&&paths.length!==1){state.message='这里只能选择一个文件。';render();return;}
   closePicker();if(onConfirm)onConfirm(paths);
  }
  async function load(target){
   var id=++requestId;
   var next=normalizePath(target);
   state.loading=true;state.message='';render();
   try{
    var response=await fetch('/api/fs/list',{method:'POST',
      headers:{'content-type':'application/json','x-rfq-import-token':token},
      body:JSON.stringify({path:next,extensions:extensions})});
    var data=await response.json();
    if(!response.ok)throw Error(data&&data.error?data.error:'读取目录失败。');
    if(!data||!Array.isArray(data.entries)||!Array.isArray(data.roots))throw Error('目录服务返回不完整，请重试。');
    if(id!==requestId)return; // 用户已经转到别的目录，丢弃过期响应。
    state.path=typeof data.path==='string'?data.path:'';
    state.parent=typeof data.parent==='string'?data.parent:null;
    state.roots=data.roots;state.entries=data.entries;state.truncated=!!data.truncated;state.total=data.total||data.entries.length;
    state.selected=state.selected.filter(function(path){return state.entries.some(function(entry){return fileKey(entry.path)===fileKey(path);});});
   }catch(error){
    if(id!==requestId)return;
    state.message=error.message;
   }
   if(id===requestId){state.loading=false;render();}
  }
  function onKey(event){
   if(event.key==='Escape'){event.preventDefault();cancelPicker();}
  }
  confirm.addEventListener('click',finish);
  cancel.addEventListener('click',cancelPicker);
  close.addEventListener('click',cancelPicker);
  go.addEventListener('click',function(){load(pathInput.value);});
  pathInput.addEventListener('keydown',function(event){
   if(event.key==='Enter'){event.preventDefault();load(pathInput.value);}
  });
  if(nameInput)nameInput.addEventListener('input',function(){render();});
  document.addEventListener('keydown',onKey,true);
  render();
  load(state.path);
  pathInput.focus();
  return {close:cancelPicker,reload:function(){load(state.path);}};
 }
 // 原生目录选择优先：WPS/Office 暴露 FileDialog(4) 时使用系统文件夹选择器；
 // 宿主没有该能力时返回 supported:false，由调用方回退到内嵌目录选择器。
 function selectFolder(app,startPath,title){
  if(!app)return {supported:false};
  try{
   var factory=app.FileDialog,dialog=null;
   if(typeof factory==='function')dialog=factory(4);
   else if(factory&&typeof factory.Show==='function')dialog=factory;
   if(dialog&&typeof dialog.Show==='function'){
    if(title&&'Title' in dialog)dialog.Title=title;
    if(startPath&&'InitialFileName' in dialog)dialog.InitialFileName=startPath;
    var shown=dialog.Show();
    if(shown===-1||shown===true){
     var items=dialog.SelectedItems;
     var picked=items&&typeof items.Item==='function'?items.Item(1):null;
     return {supported:true,path:picked?String(picked):null};
    }
    return {supported:true,path:null};
   }
   if(typeof app.GetFolder==='function'){
    var folder=app.GetFolder(startPath||'');
    return {supported:true,path:folder?String(folder):null};
   }
  }catch(error){return {supported:false,error:String(error&&error.message||error)};}
  return {supported:false};
 }
 window.RfqPathPicker={open:open,selectFolder:selectFolder};
}());
