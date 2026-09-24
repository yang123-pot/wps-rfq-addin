(function(root,factory){
  'use strict';var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RfqExportHost=api;
}(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function key(path){return String(path||'').replace(/[\\/]+/g,'/').toLowerCase();}
  function selectTarget(app,suggested){
    var target=app.GetSaveAsFilename(suggested,'Excel 工作簿 (*.xlsx),*.xlsx',1,'另存内部清单（不覆盖已有文件）');
    if(target===false||target===null||target==='')return null;
    if(typeof target!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(target)||!/^.+\.xlsx$/i.test(target))throw Error('请选择有效的xlsx绝对路径。');
    return target;
  }
  function column(index){var name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
  function chunks(sheet,values,write){
    for(var start=0;start<values.length;start+=500){
      var rows=values.slice(start,start+500),range=sheet.Range('A'+(start+1)+':'+column(rows[0].length)+(start+rows.length));
      if(write){range.NumberFormat='@';range.Value2=rows;}
      var actual=range.Value2;
      if(range.HasFormula!==false)throw Error('输出检测到公式或无法确认公式状态，已停止另存。');
      if(!Array.isArray(actual)||actual.length!==rows.length||rows.some(function(row,r){
        return !Array.isArray(actual[r])||actual[r].length!==row.length||row.some(function(v,c){return (actual[r][c]==null?'':actual[r][c])!==v;});
      }))throw Error('“'+sheet.Name+'”保存值与预览不一致，已停止另存。');
    }
  }
  function verify(book,model){
    if(Number(book.Worksheets.Count)!==model.sheets.length)throw Error('输出工作表数量不一致。');
    model.sheets.forEach(function(s){chunks(book.Worksheets.Item(s.name),s.values,false);});
  }
  function write(app,model,stagePath){
    if(typeof stagePath!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(stagePath)||!/^.+\.xlsx$/i.test(stagePath))throw Error('暂存路径无效。');
    for(var n=1;n<=app.Workbooks.Count;n++)if(key(app.Workbooks.Item(n).FullName)===key(stagePath))throw Error('暂存文件已打开，未创建工作簿。');
    if(app.FileSystem.Exists(stagePath))throw Error('暂存文件已存在，未覆盖。');
    var previous=app.ActiveWorkbook,security=app.AutomationSecurity,created=null,reopened=null,error=null;
    if(typeof security!=='number')throw Error('不能读取宏安全设置，未创建文件。');
    try{
      created=app.Workbooks.Add(-4167);
      model.sheets.forEach(function(s,i){
        var sheet=i===0?created.Worksheets.Item(1):created.Worksheets.Add(null,created.Worksheets.Item(i));
        sheet.Name=s.name;chunks(sheet,s.values,true);
        var used=sheet.Range('A1:'+column(s.values[0].length)+s.values.length);
        used.Font.Size=10;used.WrapText=true;used.ColumnWidth=18;
        sheet.Range('A1:'+column(s.values[0].length)+'1').Font.Bold=true;
        if(s.name==='来源明细'&&s.values.length>1){
          ['原路径','文件SHA256','来源标识','核对追溯JSON'].forEach(function(header){
            var index=s.values[0].indexOf(header);
            if(index>=0)sheet.Range(column(index+1)+'2:'+column(index+1)+s.values.length).WrapText=false;
          });
          used.Rows.AutoFit();
        }
      });
      verify(created,model);
      created.SaveAs(stagePath,51);created.Close(false);created=null;
      app.AutomationSecurity=3;if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未重新打开暂存文件。');
      var candidate=app.Workbooks.Open(stagePath,0,true);
      if(!candidate||key(candidate.FullName)!==key(stagePath))throw Error('WPS未返回指定暂存文件。');
      reopened=candidate;verify(reopened,model);
    }catch(e){error=e;}
    finally{
      try{if(reopened)reopened.Close(false);if(created)created.Close(false);}catch(e){error=Error('输出工作簿清理失败：'+e.message);}
      try{app.AutomationSecurity=security;}catch(e){error=Error('宏安全设置恢复失败：'+e.message);}
      try{if(previous)previous.Activate();}catch(e){error=Error('原工作簿恢复失败：'+e.message);}
    }
    if(error)throw error;
  }
  return {selectTarget:selectTarget,write:write};
}));
