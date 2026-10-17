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
 // 与已加载的旧TaskPane隔离，旧页不能消费独立窗口的阶段请求。
 var KEY='rfq.window.nav.request',CONSUMED='rfq.window.nav.consumed';
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
    var simple={rfqStepImport:'import',rfqStepBrands:'brands',rfqStepInquiry:'inquiry'};
    if(simple[id])return simple[id];
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
 // 创建窗口：先按宿主文档的完整参数（含位置）创建；只认旧版最小签名的宿主会失败或返回无效对象，
 // 这时退回不定位的最小调用——定位能力缺失绝不能导致询价窗口打不开。
 function createDialog(application,url,target){
  var attempts=[];
  if(target)attempts.push({name:'extended',args:[url,'材料整理助手',target.width,target.height,false,
   true,2,'',0,true,false,target.x,target.y]});
  attempts.push({name:'minimal',args:[url,'材料整理助手',WINDOW_WIDTH,WINDOW_HEIGHT,false]});
  var lastError=null;
  for(var index=0;index<attempts.length;index++){
   try{
    var dialog=application.CreateWebDialog.apply(application,attempts[index].args);
    if(dialog&&Number.isSafeInteger(Number(dialog.ID))&&Number(dialog.ID)>0)
     return {dialog:dialog,createdWith:attempts[index].name};
    lastError=Error('宿主未返回有效的询价独立窗口。');
   }catch(error){lastError=error;}
  }
  throw lastError||Error('宿主未创建有效的询价独立窗口。');
 }
 var WINDOW_ID='rfq.webdialog.id';
 // 登记与清理同时失败时，在本功能区实例内保留所有权，禁止盲建第二份。
 var unregisteredWindow=null;
 // F3：询价窗口的位置/尺寸。宿主文档的CreateWebDialog(url,appName,width,height,modal,hasCaption,
 // resizeEdge,errorUrl,loadingTimeout,isChildWindow,isUseCookie,xPox,yPox,popupMode)支持位置参数，
 // WebDialog另有Move/Resize与只读Width/Height/Xpos/Ypos；不同版本可能忽略其中一部分，所以只
 // “尝试”定位并读回核对：核对不上就如实标记未定位，窗口仍照常打开，绝不因定位失败拒绝显示。
 var WINDOW_WIDTH=440,WINDOW_HEIGHT=720,WINDOW_MARGIN=16,RIBBON_CLEARANCE=180,BOUNDS_TOLERANCE=4;
 var lastPlacement=null;
 function screenArea(){
  var screen=(typeof window!=='undefined'&&window.screen)?window.screen:null;
  if(!screen)return null;
  var width=Number(screen.availWidth),height=Number(screen.availHeight);
  if(!(width>0)||!(height>0))return null;
  return {left:Number(screen.availLeft)||0,top:Number(screen.availTop)||0,width:width,height:height};
 }
 // 可复现布局：右边贴齐可用区域、顶边让出功能区/编辑栏，窗口绝不会盖住顶部关键入口；
 // 可用高度不足时按剩余空间收窄窗口高度（不低于360），保证窗口整体落在屏幕内。
 function placementFor(width,height,options){
  var opts=options||{},area=opts.area||screenArea();
  if(!area)return null;
  var margin=Number(opts.margin)>=0?Number(opts.margin):WINDOW_MARGIN;
  var clearance=Number(opts.ribbonClearance)>=0?Number(opts.ribbonClearance):RIBBON_CLEARANCE;
  var x=area.left+area.width-width-margin;
  var y=area.top+clearance;
  if(x<area.left+margin)x=area.left+margin;
  var available=area.top+area.height-margin-y,safeHeight=height;
  if(available<height)safeHeight=Math.max(360,available);
  return {x:Math.round(x),y:Math.round(y),width:width,height:Math.round(safeHeight)};
 }
 // 只读宿主几何属性；宿主不提供（undefined/NaN）时返回null，不能把读不到当成已定位。
 function dialogBounds(dialog){
  if(!dialog)return null;
  var x=Number(dialog.Xpos),y=Number(dialog.Ypos),width=Number(dialog.Width),height=Number(dialog.Height);
  if(!isFinite(x)||!isFinite(y)||!isFinite(width)||!isFinite(height))return null;
  return {x:x,y:y,width:width,height:height};
 }
 function boundsMatch(bounds,target){
  if(!bounds||!target)return false;
  return Math.abs(bounds.x-target.x)<=BOUNDS_TOLERANCE&&Math.abs(bounds.y-target.y)<=BOUNDS_TOLERANCE;
 }
 function callDialog(dialog,name,a,b){
  if(typeof dialog[name]!=='function')return false;
  if(b===undefined)dialog[name](a);else dialog[name](a,b);
  return true;
 }
 // 定位尝试：创建时的位置参数已生效即通过；否则用Move/Resize兜底；读不回来或对不上都记为未定位。
 function attemptPlacement(dialog,target){
  if(!target)return {placed:false,verified:false,reason:'no-screen',bounds:dialogBounds(dialog)};
  var bounds=dialogBounds(dialog);
  if(boundsMatch(bounds,target))
   return {placed:true,verified:true,via:'create',requested:target,bounds:bounds};
  var attempted=false;
  try{
   attempted=callDialog(dialog,'Resize',target.width,target.height);
   attempted=callDialog(dialog,'Move',target.x,target.y)||attempted;
  }catch(_){attempted=true;}
  bounds=dialogBounds(dialog);
  if(attempted&&boundsMatch(bounds,target))
   return {placed:true,verified:true,via:'move',requested:target,bounds:bounds};
  if(!bounds)return {placed:false,verified:false,reason:'host-unsupported',requested:target,bounds:null};
  return {placed:false,verified:false,reason:'readback-mismatch',requested:target,bounds:bounds};
 }
 function requireWindowApi(application){
  if(!application||typeof application.CreateWebDialog!=='function'||typeof application.GetWebDialog!=='function')
   throw Error('当前WPS不支持询价独立窗口，请使用支持CreateWebDialog和GetWebDialog的WPS表格版本。');
  if(!application.PluginStorage)throw Error('无法访问询价窗口的共享存储。');
 }
 function forgetWindow(application){
  var storage=application.PluginStorage;
  if(typeof storage.removeItem==='function')storage.removeItem(WINDOW_ID);
  else storage.setItem(WINDOW_ID,'');
 }
 // 查询异常代表状态未知，直接报错；只有宿主明确返回不存在时才允许创建。
 function getWindow(application){
  requireWindowApi(application);
  if(unregisteredWindow){
   if(unregisteredWindow.application!==application)throw Error('询价窗口登记尚未恢复，已停止创建新窗口。');
   var retained=application.GetWebDialog(unregisteredWindow.id);
   if(retained){
    if(Number(retained.ID)!==unregisteredWindow.id)throw Error('询价窗口身份不一致，已停止操作。');
    application.PluginStorage.setItem(WINDOW_ID,unregisteredWindow.id);
    unregisteredWindow=null;
    return retained;
   }
   unregisteredWindow=null;
  }
  var raw=application.PluginStorage.getItem(WINDOW_ID);
  if(!raw)return null;
  var id=Number(raw);
  if(!Number.isSafeInteger(id)||id<1)throw Error('询价窗口编号无效，请重新加载本插件。');
  var dialog=application.GetWebDialog(id);
  if(!dialog){forgetWindow(application);return null;}
  if(Number(dialog.ID)!==id)throw Error('询价窗口身份不一致，已停止操作。');
  return dialog;
 }
 // 不依赖永久“已打开”标记：关闭后宿主可返回不存在；隐藏但存活的窗口保留页面内存。
 function ensureWindow(application,options){
  var opts=options||{};
  var dialog=getWindow(application),created=false;
  if(!dialog){
   // F3：先按可复现布局请求右下位置；宿主不支持位置参数时忽略即可，随后再尝试Move/Resize并读回核对。
   var target=placementFor(WINDOW_WIDTH,WINDOW_HEIGHT,opts);
   var creation=createDialog(application,opts.url||defaultPaneUrl(),target);
   dialog=creation.dialog;
   if(!dialog||!Number.isSafeInteger(Number(dialog.ID))||Number(dialog.ID)<1)
    throw Error('宿主未创建有效的询价独立窗口。');
   lastPlacement=Object.assign(attemptPlacement(dialog,target),{createdWith:creation.createdWith});
   created=true;
   try{application.PluginStorage.setItem(WINDOW_ID,dialog.ID);}
   catch(error){
    unregisteredWindow={application:application,id:Number(dialog.ID)};
    try{dialog.Delete();unregisteredWindow=null;}catch(_){}
    throw error;
   }
  }
  try{
   dialog.Visible=true;
   if(dialog.Visible!==true)throw Error('宿主未显示询价独立窗口。');
  }catch(error){
   if(created){
    // 只释放本次刚创建的窗口；释放失败保留ID，下一次不得盲建第二份。
    try{dialog.Delete();forgetWindow(application);}catch(_){}
   }
   throw error;
  }
  return dialog;
 }
 function rebuildWindow(application,options){
  var opts=options||{},dialog=getWindow(application);
  if(dialog){
   if(typeof opts.confirm!=='function'||!opts.confirm())return false;
   dialog.Delete(); // 失败则保留ID并停止，不创建重复窗口。
   forgetWindow(application);
  }
  return !!ensureWindow(application,opts);
 }
 // openStage只显示窗口并写一次导航请求，既有业务前置条件仍由产品页处理。
 function openStage(application,stage,options){
  if(!isStage(stage))return false;
  if(!application)return false;
  var dialog=ensureWindow(application,options);
  if(!dialog)return false;
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
  request:request,readRequest:readRequest,consume:consume,watch:watch,
  getWindow:getWindow,ensureWindow:ensureWindow,rebuildWindow:rebuildWindow,openStage:openStage,
  // F3：窗口位置/尺寸能力与最近一次定位结果（供真机核对与测试读取，不参与业务判定）。
  placementFor:placementFor,screenArea:screenArea,placementReport:function(){return lastPlacement;},
  KEY:KEY,CONSUMED:CONSUMED,WINDOW_ID:WINDOW_ID};
}());
