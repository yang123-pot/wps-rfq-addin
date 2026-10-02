(function(){
 'use strict';
 // R12-K：功能区“阶段快捷入口”与侧栏之间的导航桥。
 // 设计边界（按计划“R12-K”一节）：
 // - 只传一个导航请求 {id, stage}，不传任何材料内容，只允许既有7个阶段ID。
 // - 功能区页与侧栏页共用 WPS 的 Application.PluginStorage，所以请求写在这里；侧栏每个请求只消费一次，
 //   消费后立刻移除（并把已消费的id记下），因此侧栏重建/刷新不会重播上一次导航，重复读取也不会重复导航。
 // - 侧栏未打开时请求留在存储里，等侧栏打开时第一次检查就应用；侧栏已打开时靠一个低频“导航请求检查”接力。
 //   该检查只读一个存储键、不做页面重载，页面不可见时停掉，所以不是“常驻重载定时器”。
 // - 这里不做任何业务动作：确认、学习、写表、拆分都不在导航路径上触发，阶段自身的前置条件仍由各阶段原按钮判定。
 var KEY='rfq.nav.request',CONSUMED='rfq.nav.consumed';
 var STAGES=['import','matching','review','categories','brands','inquiry','split'];
 function isStage(stage){return STAGES.indexOf(stage)>=0;}
 function uniqueId(){return 'nav-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
 function parse(raw){
  var parsed=null;
  try{parsed=JSON.parse(raw);}catch(_){return null;}
  if(!parsed||typeof parsed!=='object')return null;
  if(typeof parsed.id!=='string'||!parsed.id)return null;
  if(!isStage(parsed.stage))return null;
  return {id:parsed.id,stage:parsed.stage};
 }
 // 功能区按钮既可能是字符串阶段，也可能是宿主传入的控件对象；tag 优先，缺 tag 时按按钮 id 推断。
 function stageFromControl(control){
  if(typeof control==='string')return isStage(control)?control:null;
  if(!control||typeof control!=='object')return null;
  var tag=control.tag||control.Tag;
  if(typeof tag==='string'&&isStage(tag))return tag;
  var id=control.id||control.Id;
  if(typeof id==='string'){
    var guess=id.replace(/^rfqStage/i,'').toLowerCase();
    if(isStage(guess))return guess;
  }
  return null;
 }
 function request(storage,stage){
  if(!storage||typeof storage.setItem!=='function')return null;
  if(!isStage(stage))return null;
  var req={id:uniqueId(),stage:stage};
  storage.setItem(KEY,JSON.stringify(req));
  return req;
 }
 function readRequest(storage){
  if(!storage||typeof storage.getItem!=='function')return null;
  var raw=null;
  try{raw=storage.getItem(KEY);}catch(_){return null;}
  if(!raw)return null;
  return parse(raw);
 }
 function forget(storage){
  if(!storage)return;
  if(typeof storage.removeItem==='function'){try{storage.removeItem(KEY);}catch(_){}return;}
  if(typeof storage.setItem==='function'){try{storage.setItem(KEY,'');}catch(_){}}
 }
 function consumedId(storage){
  if(!storage||typeof storage.getItem!=='function')return null;
  try{return storage.getItem(CONSUMED);}catch(_){return null;}
 }
 // 只做“一次性消费”：同一个请求重复读取不会重复导航；非法请求直接丢弃。
 function consume(storage,workflow,options){
  if(!storage||typeof storage.getItem!=='function')return null;
  var raw=null;
  try{raw=storage.getItem(KEY);}catch(_){return null;}
  if(!raw)return null;
  var req=parse(raw);
  if(!req){forget(storage);return null;}
  if(consumedId(storage)===req.id){forget(storage);return null;}
  if(!workflow||typeof workflow.goTo!=='function')return null;
  var applied=workflow.goTo(req.stage)===true;
  if(typeof storage.setItem==='function'){try{storage.setItem(CONSUMED,req.id);}catch(_){}}
  forget(storage);
  return {id:req.id,stage:req.stage,applied:applied};
 }
 function defaultPaneUrl(){
  var href=(typeof window!=='undefined'&&window.location&&window.location.href)?String(window.location.href):'';
  var base=href.split('?')[0];
  return base.slice(0,base.lastIndexOf('/')+1)+'taskpane.html';
 }
 // 复用既有的“打开/聚焦侧栏”行为：尽量复用已存在的面板，没有才新建，最后显示并设定宽度。
 function ensurePane(application,options){
  var opts=options||{};
  if(!application)return null;
  var id=null;
  try{id=application.PluginStorage.getItem('rfq.taskpane.id');}catch(_){id=null;}
  var pane=null;
  if(id){try{pane=application.GetTaskPane(id);}catch(_){pane=null;}}
  if(!pane){
    pane=application.CreateTaskPane(opts.url||defaultPaneUrl());
    try{application.PluginStorage.setItem('rfq.taskpane.id',pane.ID);}catch(_){}
  }
  try{pane.Visible=true;}catch(_){}
  try{pane.Width=380;}catch(_){}
  return pane;
 }
 // openStage：只打开/聚焦侧栏并写入导航请求，不执行任何业务动作，不返回材料内容。
 function openStage(application,stage,options){
  if(!isStage(stage))return false;
  if(!application)return false;
  var pane=ensurePane(application,options);
  if(!pane)return false;
  if(!application.PluginStorage)return false;
  return !!request(application.PluginStorage,stage);
 }
 // watch：侧栏启动时先处理一次遗留请求，再低频检查；页面不可见时暂停，恢复可见时立即补查。
 function watch(storage,workflow,options){
  var opts=options||{};
  var delay=Number(opts.intervalMs)>0?Number(opts.intervalMs):600;
  var schedule=opts.setTimeout||((typeof window!=='undefined'&&window.setTimeout)?window.setTimeout.bind(window):null);
  var cancel=opts.clearTimeout||((typeof window!=='undefined'&&window.clearTimeout)?window.clearTimeout.bind(window):null);
  if(!schedule)return null;
  var stopped=false,pending=null;
  function tick(){
   pending=null;
   if(stopped)return;
   consume(storage,workflow,opts);
   if(!stopped)pending=schedule(tick,delay);
  }
  function begin(){if(!stopped&&pending===null)pending=schedule(tick,delay);}
  function hold(){if(pending!==null&&cancel){try{cancel(pending);}catch(_){}pending=null;}}
  function check(){return consume(storage,workflow,opts);}
  function visible(){
   if(typeof document==='undefined')return true;
   return document.visibilityState!=='hidden';
  }
  function onVisibility(){if(visible()){check();begin();}else{hold();}}
  consume(storage,workflow,opts);
  if(visible())begin();
  if(typeof window!=='undefined'&&window.addEventListener){
   window.addEventListener('focus',function(){check();});
   window.addEventListener('pageshow',function(){check();});
  }
  if(typeof document!=='undefined'&&document.addEventListener){
   document.addEventListener('visibilitychange',onVisibility);
  }
  return {check:check,stop:function(){stopped=true;hold();},isRunning:function(){return !stopped;}};
 }
 window.RfqRibbonNavigation={STAGES:STAGES.slice(),isStage:isStage,stageFromControl:stageFromControl,
  request:request,readRequest:readRequest,consume:consume,watch:watch,ensurePane:ensurePane,openStage:openStage,
  KEY:KEY,CONSUMED:CONSUMED};
}());
