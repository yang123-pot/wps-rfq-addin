(function(){
 'use strict';
 var key='rfq.library.webdialog.id',retained=null;
 function open(app){
  if(!app||!app.PluginStorage||typeof app.CreateWebDialog!=='function'||typeof app.GetWebDialog!=='function')throw Error('当前WPS不支持分类学习库独立窗口。');
  if(retained&&retained.app!==app)throw Error('分类学习库窗口身份待恢复。');
  var storage=app.PluginStorage,raw=retained?retained.id:storage.getItem(key),dialog=null;
  if(raw){var id=Number(raw);if(!Number.isSafeInteger(id)||id<1)throw Error('分类学习库窗口编号无效。');dialog=app.GetWebDialog(id);if(dialog&&Number(dialog.ID)!==id)throw Error('分类学习库窗口身份不符。');}
  if(!dialog){
   var href=String(window.location.href).split('?')[0],url=href.slice(0,href.lastIndexOf('/')+1)+'library.html';
   dialog=app.CreateWebDialog(url,'分类学习库',960,720,false);
   if(!dialog||!Number.isSafeInteger(Number(dialog.ID))||Number(dialog.ID)<1)throw Error('WPS未返回分类学习库窗口。');
   retained={app:app,id:Number(dialog.ID)};
   try{storage.setItem(key,dialog.ID);retained=null;}catch(error){try{dialog.Delete();retained=null;}catch(_){}throw error;}
  }else if(retained){storage.setItem(key,dialog.ID);retained=null;}
  dialog.Visible=true;if(dialog.Visible!==true)throw Error('WPS未显示分类学习库窗口。');return dialog;
 }
 window.RfqLibraryWindow={open:open,KEY:key};
}());
