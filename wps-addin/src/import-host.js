(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./host.js'));
  else root.RfqImportHost=factory(root.WpsHost);
}(typeof window==='object'?window:globalThis,function(host){
  'use strict';
  function key(path){return String(path||'').replace(/[\\/]+/g,'/').toLowerCase();}
  function selectFiles(application){
    if(!application)throw new Error('请在WPS中选择清单文件。');
    var selected=application.GetOpenFilename('清单文件 (*.xls;*.xlsx),*.xls;*.xlsx',1,'选择要导入的清单（可多选）',null,true);
    if(selected===false||selected===null||selected==='')return [];
    var paths=typeof selected==='string'?[selected]:selected;
    if(!Array.isArray(paths)||!paths.length||paths.length>20||paths.some(function(p){return typeof p!=='string'||!p.trim();})) {
      throw new Error('文件选择器未返回有效路径，请重试或分批选择（每批最多20份）。');
    }
    return paths;
  }
  function validate(meta){
    if(!meta||typeof meta.originalPath!=='string'||typeof meta.originalName!=='string'||typeof meta.copyPath!=='string'||
      !/^[a-f\d]{64}$/i.test(meta.fingerprint)||key(meta.originalPath)===key(meta.copyPath))throw new Error('缺少安全工作副本，已停止打开文件。');
  }
  function findOpen(application,path){
    for(var i=1;i<=application.Workbooks.Count;i++){var book=application.Workbooks.Item(i);if(key(book.FullName)===key(path))return book;}
    return null;
  }
  function readCopy(application,meta){
    validate(meta);
    if(findOpen(application,meta.copyPath))throw new Error('此工作副本已打开，请关闭副本后重新导入；用户工作簿未关闭。');
    var previous=application.ActiveWorkbook,security=application.AutomationSecurity,copy=null,result,failure=null;
    if(typeof security!=='number')throw new Error('当前WPS不能读取宏安全设置，未打开文件。');
    try {
      application.AutomationSecurity=3;
      if(application.AutomationSecurity!==3)throw new Error('无法禁用自动宏，未打开文件。');
      copy=application.Workbooks.Open(meta.copyPath,0,true);
      if(!copy||key(copy.FullName)!==key(meta.copyPath))throw new Error('WPS未返回指定工作副本。');
      result=host.readWorkbook({ActiveWorkbook:copy});
      result.path=meta.originalPath;result.name=meta.originalName;result.fingerprint=meta.fingerprint;
    } catch(error){failure=error;}
    finally {
      try{if(copy&&key(copy.FullName)===key(meta.copyPath))copy.Close(false);}catch(e){failure=new Error('工作副本关闭失败：'+e.message);}
      try{application.AutomationSecurity=security;}catch(e){failure=new Error('宏安全设置恢复失败：'+e.message);}
      try{if(previous)previous.Activate();}catch(e){failure=new Error('原活动工作簿恢复失败：'+e.message);}
    }
    if(failure)throw failure;
    return result;
  }
  function locateCopy(application,meta,source){
    validate(meta);
    if(!source||key(source.path)!==key(meta.originalPath)||source.file!==meta.originalName||
      typeof source.sheet!=='string'||!source.sheet.trim()||!Number.isSafeInteger(source.row)||source.row<1||
      !Number.isSafeInteger(source.column)||source.column<1)throw new Error('来源标识或行列无效，请重新读取清单。');
    var copy=findOpen(application,meta.copyPath),security=application.AutomationSecurity,previous=application.ActiveWorkbook,owned=false;
    if(copy&&(copy.Saved===false||copy.ReadOnly===false))throw new Error('已打开的工作副本有修改或可写，不能用于定位旧快照；请保留修改并关闭副本后重试。');
    try{
      if(!copy){
        if(typeof security!=='number')throw new Error('不能读取宏安全设置，未打开副本。');
        try{
          application.AutomationSecurity=3;if(application.AutomationSecurity!==3)throw new Error('无法禁用自动宏。');
          copy=application.Workbooks.Open(meta.copyPath,0,true);
          owned=!!copy&&key(copy.FullName)===key(meta.copyPath);
        }finally{application.AutomationSecurity=security;}
      }
      if(!copy||key(copy.FullName)!==key(meta.copyPath))throw new Error('找不到对应工作副本。');
      copy.Activate();
      host.locateSource(application,{path:meta.copyPath,file:meta.originalName,sheet:source.sheet,row:source.row,column:source.column});
    }catch(error){
      try{if(owned)copy.Close(false);}finally{if(previous)previous.Activate();}
      throw error;
    }
  }
  return {selectFiles:selectFiles,readCopy:readCopy,locateCopy:locateCopy};
}));
