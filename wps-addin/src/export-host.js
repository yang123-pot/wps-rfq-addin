(function(root,factory){
  'use strict';
  var api=factory(typeof module==='object'&&module.exports?require('./workbook-layout.js'):root.RfqWorkbookLayout);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RfqExportHost=api;
}(typeof window==='object'?window:globalThis,function(layout){
  'use strict';
  function key(path){return String(path||'').replace(/[\\/]+/g,'/').toLowerCase();}
  function columnName(index){var name='';for(;index>0;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
  function address(item){
    var lastColumn=item.column+(item.columnSpan||1)-1,lastRow=item.row+(item.rowSpan||1)-1;
    return columnName(item.column)+item.row+':'+columnName(lastColumn)+lastRow;
  }
  function selectTarget(app,suggested){
    var target=app.GetSaveAsFilename(suggested,'Excel 工作簿 (*.xlsx),*.xlsx',1,'另存内部清单（不覆盖已有文件）');
    if(target===false||target===null||target==='')return null;
    if(typeof target!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(target)||!/^.+\.xlsx$/i.test(target))throw Error('请选择有效的xlsx绝对路径。');
    return target;
  }
  function chunks(sheet,values,write){
    for(var start=0;start<values.length;start+=500){
      var rows=values.slice(start,start+500),range=sheet.Range('A'+(start+1)+':'+columnName(rows[0].length)+(start+rows.length));
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
  function deep(model,sheet){return model.sheets.filter(function(item){return item.name===sheet.Name;})[0]||null;}
  // 版式落地：等宽矩阵之上再写列宽、行高、合并、浅色填充、冻结、打印、原生链接与区域下拉。
  // 宿主缺API时明确报出具体缺哪一个，绝不静默产出“看起来像获批版式”的文件。
  function applyLayout(app,sheet,model,spec){
    if(!spec)return;
    var rowCount=(deep(model,sheet)||{}).values;
    var check=layout.validate(spec,{rowCount:Array.isArray(rowCount)?rowCount.length:null,columnCount:spec.columns.length});
    if(!check.ok)throw Error('“'+sheet.Name+'”版式不合法，未写入：'+check.errors.join('；'));
    if(typeof sheet.Columns!=='object'||typeof sheet.Columns.Item!=='function')
      throw Error('当前WPS不支持列宽API（Worksheet.Columns），未按获批版式输出“'+sheet.Name+'”。');
    if(typeof sheet.Rows!=='object'||typeof sheet.Rows.Item!=='function')
      throw Error('当前WPS不支持行高API（Worksheet.Rows），未按获批版式输出“'+sheet.Name+'”。');
    spec.columns.forEach(function(column){
      var target=sheet.Columns.Item(column.index);
      if(column.width!=null)target.ColumnWidth=column.width;
      if(column.hidden===true)target.Hidden=true;
    });
    (spec.rows||[]).forEach(function(row){sheet.Rows.Item(row.index).RowHeight=row.height;});
    (spec.headerRows||[]).forEach(function(row){sheet.Rows.Item(row).Font.Bold=true;});
    (spec.merges||[]).forEach(function(merge){
      var range=sheet.Range(address(merge));
      if(typeof range.Merge!=='function')throw Error('当前WPS不支持合并单元格API（Range.Merge），未按获批版式输出“'+sheet.Name+'”。');
      range.Merge();
      if(range.MergeCells!==true)throw Error('“'+sheet.Name+'”合并单元格未生效：'+address(merge));
    });
    (spec.fills||[]).forEach(function(fill){
      var range=sheet.Range(address(fill));
      if(!range.Interior)throw Error('当前WPS不支持单元格填充API（Range.Interior），未按获批版式输出“'+sheet.Name+'”。');
      range.Interior.Color=layout.toColor(fill.color);
    });
    if(spec.freeze){
      var window=app.ActiveWindow;
      if(!window||typeof window.FreezePanes==='undefined')
        throw Error('当前WPS不支持冻结窗格API（Window.FreezePanes），未按获批版式输出“'+sheet.Name+'”。');
      var anchor=sheet.Cells.Item(spec.freeze.row||1,spec.freeze.column||1);
      if(typeof anchor.Select!=='function')throw Error('当前WPS不支持定位单元格API（Range.Select），未按获批版式输出“'+sheet.Name+'”。');
      anchor.Select();
      if(spec.freeze.column||spec.freeze.row)window.FreezePanes=true;
      if(window.FreezePanes!==true)throw Error('“'+sheet.Name+'”冻结窗格未生效。');
    }
    (spec.hyperlinks||[]).forEach(function(link){
      if(!sheet.Hyperlinks||typeof sheet.Hyperlinks.Add!=='function')
        throw Error('当前WPS不支持原生超链接API（Hyperlinks.Add），未按获批版式输出“'+sheet.Name+'”。');
      var anchor=sheet.Range(address(link));
      // 用原生超链接，不用HYPERLINK公式：显示类别名，地址指向对应分类工作簿。
      sheet.Hyperlinks.Add(anchor,link.address,link.subAddress||'',link.screenTip||'',link.display==null?'':String(link.display));
      if(anchor.Hyperlinks&&typeof anchor.Hyperlinks.Count==='number'&&anchor.Hyperlinks.Count<1)
        throw Error('“'+sheet.Name+'”超链接未生效：'+address(link));
    });
    (spec.validations||[]).forEach(function(rule){
      var range=sheet.Range(address(rule));
      if(!range.Validation||typeof range.Validation.Add!=='function')
        throw Error('当前WPS不支持数据有效性API（Validation.Add），未按获批版式输出“'+sheet.Name+'”。');
      var formula="='"+String(rule.listSheet).replace(/'/g,"''")+"'!"+rule.listRange;
      if(typeof range.Validation.Delete==='function')range.Validation.Delete();
      range.Validation.Add(3,1,1,formula,'');
      range.Validation.InCellDropdown=rule.inCellDropdown!==false;
      range.Validation.IgnoreBlank=rule.allowBlank!==false;
      if(String(range.Validation.Formula1||'')!==formula)throw Error('“'+sheet.Name+'”分类下拉未生效：'+address(rule));
    });
    if(spec.print){
      var pageSetup=sheet.PageSetup;
      if(!pageSetup)throw Error('当前WPS不支持打印设置API（PageSetup），未按获批版式输出“'+sheet.Name+'”。');
      if(spec.print.area)pageSetup.PrintArea=address(spec.print.area);
      if(spec.print.repeatRow)pageSetup.PrintTitleRows='$'+spec.print.repeatRow+':$'+spec.print.repeatRow;
    }
  }
  // 重开后的版式读回：只核对能证明“公开值＋必要版式”的关键项。
  function verifyLayout(app,book,model){
    model.sheets.forEach(function(s){
      var spec=s.layout;
      if(!spec)return;
      var sheet=book.Worksheets.Item(s.name);
      if(typeof sheet.Columns!=='object'||typeof sheet.Columns.Item!=='function')return;
      (spec.columns||[]).forEach(function(column){
        if(column.width==null)return;
        var actual=sheet.Columns.Item(column.index).ColumnWidth;
        if(Number(actual)!==Number(column.width))
          throw Error('“'+s.name+'”列宽读回不一致：第'+column.index+'列期望'+column.width+'，实际'+String(actual));
        if(column.hidden===true&&sheet.Columns.Item(column.index).Hidden!==true)
          throw Error('“'+s.name+'”隐藏辅助列未生效：第'+column.index+'列');
      });
      (spec.merges||[]).forEach(function(merge){
        var range=sheet.Range(address(merge));
        if(range.MergeCells!==true)throw Error('“'+s.name+'”合并读回不一致：'+address(merge));
      });
      (spec.hyperlinks||[]).forEach(function(link){
        var anchor=sheet.Range(address(link));
        var count=anchor.Hyperlinks&&anchor.Hyperlinks.Count;
        if(count==null)throw Error('“'+s.name+'”无法读回超链接，未确认获批版式：'+address(link));
        if(Number(count)<1)throw Error('“'+s.name+'”超链接读回缺失：'+address(link));
        var actual=anchor.Hyperlinks.Item(1).Address;
        if(key(actual)!==key(link.address))
          throw Error('“'+s.name+'”超链接地址读回不一致：期望'+link.address+'，实际'+String(actual));
      });
      (spec.validations||[]).forEach(function(rule){
        var range=sheet.Range(address(rule));
        var formula="='"+String(rule.listSheet).replace(/'/g,"''")+"'!"+rule.listRange;
        if(String(range.Validation&&range.Validation.Formula1||'')!==formula)
          throw Error('“'+s.name+'”分类下拉读回不一致：'+address(rule));
      });
    });
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
        var used=sheet.Range('A1:'+columnName(s.values[0].length)+s.values.length);
        used.Font.Size=(s.layout&&s.layout.fontSize)||layout.FONT_SIZE;used.WrapText=true;
        sheet.Range('A1:'+columnName(s.values[0].length)+'1').Font.Bold=true;
        if(s.name==='来源明细'&&s.values.length>1){
          ['原路径','文件SHA256','来源标识','核对追溯JSON'].forEach(function(header){
            var index=s.values[0].indexOf(header);
            if(index>=0)sheet.Range(columnName(index+1)+'2:'+columnName(index+1)+s.values.length).WrapText=false;
          });
          used.Rows.AutoFit();
        }
        applyLayout(app,sheet,model,s.layout);
      });
      verify(created,model);
      created.SaveAs(stagePath,51);created.Close(false);created=null;
      app.AutomationSecurity=3;if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未重新打开暂存文件。');
      var candidate=app.Workbooks.Open(stagePath,0,true);
      if(!candidate||key(candidate.FullName)!==key(stagePath))throw Error('WPS未返回指定暂存文件。');
      reopened=candidate;verify(reopened,model);verifyLayout(app,reopened,model);
    }catch(e){error=e;}
    finally{
      try{if(reopened)reopened.Close(false);if(created)created.Close(false);}catch(e){error=Error('输出工作簿清理失败：'+e.message);}
      try{app.AutomationSecurity=security;}catch(e){error=Error('宏安全设置恢复失败：'+e.message);}
      try{if(previous)previous.Activate();}catch(e){error=Error('原工作簿恢复失败：'+e.message);}
    }
    if(error)throw error;
  }
  return {selectTarget:selectTarget,write:write,address:address};
}));
