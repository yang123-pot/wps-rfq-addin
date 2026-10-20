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
  // 单格“合并”（如A5:A5，供应商区只有一组时的产物）在真实WPS里 MergeCells 永远不是True：
  // 它没有任何版式意义，写入和读回都必须跳过，否则真机生成/核对会被误判失败。
  function mergeCells(merge){return (merge.rowSpan||1)*(merge.columnSpan||1)>1;}
  function realMerges(spec){return ((spec&&spec.merges)||[]).filter(mergeCells);}
  // 宿主读回差异：WPS表格部分版本会把区域引用的等号、引号或空白去掉后再回读Formula1。
  // 这里只归一化这些等价写法，真实不同的区域/来源仍然判为不生效，不放宽“有没有下拉”的结论。
  function normalizeFormula(value){
    return String(value==null?'':value).replace(/[\s\u3000]+/g,'').replace(/^=+/,'').replace(/'/g,'').toUpperCase();
  }
  function formulaMatches(actual,expected){return normalizeFormula(actual)===normalizeFormula(expected);}
  // R12-J 真机（2026-10-02）实测：WPS JSA 路径把跨表来源写成 '内部选项'!$B$2:$B$7 时，
  // 保存出来的是字面量 "内部选项'!$B$2:$B$7"，下拉只剩一个原始文本项（分类下拉等于失效）；
  // 简单名称（中文/字母/数字/下划线等，不含空格与特殊字符）不加引号，宿主才会存成区域引用。
  var SIMPLE_SHEET_NAME=/^[0-9A-Za-z_\u4e00-\u9fff.\-]+$/;
  function sheetReference(name){
    var raw=String(name==null?'':name);
    return SIMPLE_SHEET_NAME.test(raw)?raw:"'"+raw.replace(/'/g,"''")+"'";
  }
  function validationFormula(rule){return '='+sheetReference(rule.listSheet)+'!'+rule.listRange;}
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
      // F5最终JSA实测：即使NumberFormat='@'，Value2仍把文本开头的单引号当输入前缀吞掉。
      // 仅在本次新簿写入且读回恰好少了这一个字符时补一个输入前缀，再按原矩阵逐值核对。
      // 已保存文件的核对不修写；其它差异也不归一化，业务原文与模型始终保留。
      if(write&&Array.isArray(actual)&&actual.length===rows.length){
        var repair=false,escaped=rows.map(function(row,r){
          return row.map(function(v,c){
            if(typeof v==='string'&&v.charAt(0)==="'"&&Array.isArray(actual[r])&&actual[r][c]===v.slice(1)){
              repair=true;return "'"+v;
            }
            return v;
          });
        });
        if(repair){range.Value2=escaped;actual=range.Value2;
          if(range.HasFormula!==false)throw Error('输出检测到公式或无法确认公式状态，已停止另存。');}
      }
      if(!Array.isArray(actual)||actual.length!==rows.length||rows.some(function(row,r){
        return !Array.isArray(actual[r])||actual[r].length!==row.length||row.some(function(v,c){return (actual[r][c]==null?'':actual[r][c])!==v;});
      })){
        var detail='';
        if(Array.isArray(actual)){
          for(var r=0;r<rows.length&&!detail;r++){
            if(!Array.isArray(actual[r]))continue;
            for(var c=0;c<rows[r].length;c++){
              var value=actual[r][c]==null?'':actual[r][c];
              if(value!==rows[r][c]){
                detail='（首个差异：'+columnName(c+1)+(start+r+1)+'，期望'+
                  JSON.stringify(String(rows[r][c]).slice(0,120))+'，读回'+JSON.stringify(String(value).slice(0,120))+'）';
                break;
              }
            }
          }
        }
        throw Error('“'+sheet.Name+'”保存值与预览不一致'+detail+'，已停止另存。');
      }
    }
  }
  function verify(book,model){
    if(Number(book.Worksheets.Count)!==model.sheets.length)throw Error('输出工作表数量不一致。');
    model.sheets.forEach(function(s){chunks(book.Worksheets.Item(s.name),s.values,false);});
  }
  // F1：内部技术页（内部选项/内部绑定）只服务于读回校验与跨表下拉来源，必须在生成时真正隐藏，
  // 让用户只看到公开页（图03标签栏一张表）。隐藏前先激活第一张公开页：宿主不允许隐藏活动工作表。
  // 宿主缺少Worksheet.Visible或写入未落地时明确失败，绝不产出“看起来已隐藏”的成果表。
  function applySheetVisibility(book,model){
    var hidden=model.sheets.filter(function(s){return s.layout&&s.layout.hidden===true;});
    if(!hidden.length)return;
    var first=book.Worksheets.Item(1);
    if(typeof first.Activate==='function')first.Activate();
    hidden.forEach(function(s){
      var sheet=book.Worksheets.Item(s.name);
      if(typeof sheet.Visible==='undefined')
        throw Error('当前WPS不支持工作表隐藏API（Worksheet.Visible），未按获批版式输出“'+s.name+'”。');
      sheet.Visible=0;
      if(Number(sheet.Visible)!==0)throw Error('“'+s.name+'”内部工作表未隐藏，未保存文件。');
    });
  }
  function deep(model,sheet){return model.sheets.filter(function(item){return item.name===sheet.Name;})[0]||null;}
  // FreezePanes=true不能证明冻结在要求的表头处：F5隔离宿主曾把A4/A10收缩成A2。
  // 写入后及保存重开后都核对实际分割行/列；读不回位置就不能确认获批版式。
  function freezePosition(window){return String(window.SplitRow)+'/'+String(window.SplitColumn);}
  function freezeFailureContext(window,context){
    var details=context?String(context):'';
    // Failure-only window metadata; no material content, paths or recurring probes.
    try{if(window.ScrollRow!=null)details+='；滚动行='+window.ScrollRow;}catch(_){}
    try{if(window.ScrollColumn!=null)details+='；滚动列='+window.ScrollColumn;}catch(_){}
    try{if(window.Zoom!=null)details+='；缩放='+window.Zoom;}catch(_){}
    return details?'（'+details+'）':'';
  }
  function verifyFreeze(app,sheet,freeze,context){
    var window=app.ActiveWindow;
    if(!window||window.FreezePanes!==true)throw Error('“'+sheet.Name+'”冻结窗格未生效。'+(window?freezeFailureContext(window,context):''));
    var row=window.SplitRow,column=window.SplitColumn;
    if(row==null||column==null||!isFinite(Number(row))||!isFinite(Number(column)))
      throw Error('当前WPS不支持冻结位置读回API（Window.SplitRow/SplitColumn），未确认“'+sheet.Name+'”版式。');
    var expectedRow=(freeze.row||1)-1,expectedColumn=(freeze.column||1)-1;
    if(Number(row)!==expectedRow||Number(column)!==expectedColumn)
      throw Error('“'+sheet.Name+'”冻结位置读回不一致：期望行/列'+expectedRow+'/'+expectedColumn+
        '，实际'+row+'/'+column+'。'+freezeFailureContext(window,context));
  }
  // 版式落地：等宽矩阵之上再写列宽、行高、合并、浅色填充、冻结、打印、原生链接与区域下拉。
  // 宿主缺API时明确报出具体缺哪一个，绝不静默产出“看起来像获批版式”的文件。
  function alignmentValue(value){return {left:-4131,center:-4108,right:-4152,top:-4160,bottom:-4107}[value];}
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
    realMerges(spec).forEach(function(merge){
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
      // Native F5: selecting a tall wrapped row can scroll the viewport and shift FreezePanes.
      // Restore the origin before setting the model's split; keep strict position checks below.
      window.ScrollRow=1;
      // Selection alone can freeze one row short in WPS. Write the model's exact split before freezing.
      if(window.SplitRow==null||window.SplitColumn==null)
        throw Error('当前WPS不支持冻结位置读回API（Window.SplitRow/SplitColumn），未确认“'+sheet.Name+'”版式。');
      var freezeTrace=['阶段=写入冻结','选中后'+freezePosition(window)];
      window.FreezePanes=false;
      freezeTrace.push('取消后'+freezePosition(window));
      window.SplitRow=(spec.freeze.row||1)-1;
      freezeTrace.push('设置行后'+freezePosition(window));
      window.SplitColumn=(spec.freeze.column||1)-1;
      freezeTrace.push('设置列后'+freezePosition(window));
      if(spec.freeze.column||spec.freeze.row)window.FreezePanes=true;
      freezeTrace.push('启用后'+freezePosition(window));
      verifyFreeze(app,sheet,spec.freeze,freezeTrace.join('；'));
    }
    (spec.hyperlinks||[]).forEach(function(link){
      if(!sheet.Hyperlinks||typeof sheet.Hyperlinks.Add!=='function')
        throw Error('当前WPS不支持原生超链接API（Hyperlinks.Add），未按获批版式输出“'+sheet.Name+'”。');
      var anchor=sheet.Range(address(link));
        // 用原生超链接，不用HYPERLINK公式：显示类别名。独立文件模式地址指向对应分类工作簿；
        // 一本多页模式地址留空、用 SubAddress＝页名!A1 做文件内跳转（用户要求：汇总表名称跳到对应分类页）。
      sheet.Hyperlinks.Add(anchor,link.address,link.subAddress||'',link.screenTip||'',link.display==null?'':String(link.display));
      if(anchor.Hyperlinks&&typeof anchor.Hyperlinks.Count==='number'&&anchor.Hyperlinks.Count<1)
        throw Error('“'+sheet.Name+'”超链接未生效：'+address(link));
    });
    // 字体样式（名称超链接的蓝色下划线等）：必须在原生链接之后落地。
    // 实测WPS表格在Hyperlinks.Add时会按宿主“链接”样式改写该单元格字体，先设颜色会被覆盖，读回就成了宿主链接色。
    (spec.fonts||[]).forEach(function(font){
      var range=sheet.Range(address(font));
      if(!range.Font)throw Error('当前WPS不支持字体样式API（Range.Font），未按获批版式输出“'+sheet.Name+'”。');
      if(font.name!=null)range.Font.Name=font.name;
      if(font.size!=null)range.Font.Size=font.size;
      if(font.color!=null)range.Font.Color=layout.toColor(font.color);
      if(font.bold!=null)range.Font.Bold=font.bold===true;
      if(font.underline!=null)range.Font.Underline=font.underline===true?2:0;
    });
    (spec.alignments||[]).forEach(function(item){
      var range=sheet.Range(address(item));
      if(item.horizontal!=null)range.HorizontalAlignment=alignmentValue(item.horizontal);
      if(item.vertical!=null)range.VerticalAlignment=alignmentValue(item.vertical);
    });
    (spec.validations||[]).forEach(function(rule){
      var range=sheet.Range(address(rule));
      if(!range.Validation||typeof range.Validation.Add!=='function')
        throw Error('当前WPS不支持数据有效性API（Validation.Add），未按获批版式输出“'+sheet.Name+'”。');
      var formula=validationFormula(rule);
      if(typeof range.Validation.Delete==='function')range.Validation.Delete();
      range.Validation.Add(3,1,1,formula,'');
      range.Validation.InCellDropdown=rule.inCellDropdown!==false;
      range.Validation.IgnoreBlank=rule.allowBlank!==false;
      // 2026-10-11：最终分类列保留下拉但允许直接输入新类别名（关闭校验错误提示＝“允许其他值”）。
      if(rule.allowOtherInput===true)range.Validation.ShowError=false;
      if(!formulaMatches(range.Validation.Formula1,formula)){
        // 实测WPS表格不接受带等号的区域引用时回读为空：改写成不带等号的同一区域再确认一次。
        try{range.Validation.Add(3,1,1,formula.replace(/^=/,''),'');}catch(_){}
        range.Validation.InCellDropdown=rule.inCellDropdown!==false;
        range.Validation.IgnoreBlank=rule.allowBlank!==false;
        if(rule.allowOtherInput===true)range.Validation.ShowError=false;
      }
      // 真机实测：WPS 12.1.0.29161 会把区域引用的单引号/等号写法归一化后原样回读，因此必须读回等价区域。
      // 类型为 3 只说明“这里是下拉”，不能证明来源正确；指到别的区域同样要拒绝，不能靠类型放行。
      var typeOk=range.Validation.Type==null||Number(range.Validation.Type)===3;
      var applied=typeOk&&formulaMatches(range.Validation.Formula1,formula);
      if(!applied)throw Error('“'+sheet.Name+'”分类下拉未生效：'+address(rule)+
        '（期望'+formula+'，实际'+String(range.Validation.Formula1==null||range.Validation.Formula1===''?'空':range.Validation.Formula1)+
        '，类型'+String(range.Validation.Type)+'）');
    });
    if(spec.print){
      var pageSetup=sheet.PageSetup;
      if(!pageSetup)throw Error('当前WPS不支持打印设置API（PageSetup），未按获批版式输出“'+sheet.Name+'”。');
      // WPS 12.1.0.29161 未显式设纸张时会在SaveAs省略pageSetup，重开丢失方向/页高。
      // 纸张来自版式模型；先初始化，再设置方向与缩放，仍须保存重开逐项核实。
      if(spec.print.paperSize!=null)pageSetup.PaperSize=spec.print.paperSize;
      if(spec.print.area)pageSetup.PrintArea=address(spec.print.area);
      if(spec.print.repeatRow)pageSetup.PrintTitleRows='$'+spec.print.repeatRow+':$'+spec.print.repeatRow;
      if(spec.print.orientation)pageSetup.Orientation=spec.print.orientation==='landscape'?2:1;
      if(spec.print.fitToWidth!=null){
        pageSetup.Zoom=false;
        pageSetup.FitToPagesWide=spec.print.fitToWidth;
        pageSetup.FitToPagesTall=spec.print.fitToHeight==null?0:spec.print.fitToHeight;
      }
    }
  }
  // 重开后的版式读回：只核对能证明“公开值＋必要版式”的关键项。
  // 宿主相对链接必须从最终汇总目录解析出完整目标；只比尾部文件名会把别处的同名文件当成同一个。
  function pathParts(value){return String(value==null?'':value).replace(/[\\/]+/g,'\\').split('\\').filter(function(part){return part!=='';});}
  function normalizeTarget(value){
    var parts=pathParts(value),stack=[],index,part;
    for(index=0;index<parts.length;index++){
      part=parts[index];
      if(part==='.')continue;
      if(part==='..'){if(stack.length>1)stack.pop();continue;}
      stack.push(part);
    }
    return stack.join('\\').toLowerCase();
  }
  function dirName(value){var parts=pathParts(value);parts.pop();return parts.join('\\');}
  function resolveTarget(baseDirectory,address){
    var value=String(address==null?'':address);
    if(/^(?:[a-z]:[\\/]|\\\\)/i.test(value))return normalizeTarget(value);
    return normalizeTarget(baseDirectory+'\\'+value);
  }
  // 一本多页（2026-10-11）：汇总表名称列改为文件内跳转（Address 为空、SubAddress＝页名!A1）。
  // 读回只认“同一个工作簿内的同一页同一格”，宿主把 SubAddress 归一化成等价写法（去引号/去空白）仍算通过。
  function normalizeSubAddress(value){
    return String(value==null?'':value).replace(/[\s\u3000]+/g,'').replace(/'/g,'').toUpperCase();
  }
  function verifyLayout(app,book,model,stagePath){
    // 相对链接要按“这份工作簿最终落盘的目录”解析；模型声明的 directory 是汇总表最终目录，
    // 实际读回地址按暂存文件当前所在目录解析，两者都归一到完整目标再比对。
    var actualBase=dirName(stagePath);
    var finalBase=(model&&typeof model.directory==='string'&&/^(?:[a-z]:[\\/]|\\\\)/i.test(model.directory))
      ?model.directory:actualBase;
    model.sheets.forEach(function(s){
      var spec=s.layout;
      if(!spec)return;
      var sheet=book.Worksheets.Item(s.name);
      if(spec.freeze){
        if(typeof sheet.Activate!=='function')throw Error('当前WPS不支持工作表激活API，无法读回“'+s.name+'”冻结位置。');
        sheet.Activate();verifyFreeze(app,sheet,spec.freeze,'阶段=保存重开');
      }
      if(typeof sheet.Visible!=='undefined'){
        // 可见的编码在不同宿主上可能是-1或1，所以只核“该隐藏的确实隐藏、该可见的确实可见”。
        var wantHidden=spec.hidden===true;
        if((Number(sheet.Visible)===0)!==wantHidden)
          throw Error('“'+s.name+'”工作表隐藏状态读回不一致：期望'+(wantHidden?'隐藏':'可见')+
           '，实际'+String(sheet.Visible));
      }
      if(typeof sheet.Columns!=='object'||typeof sheet.Columns.Item!=='function')return;
      (spec.columns||[]).forEach(function(column){
        var target=sheet.Columns.Item(column.index);
        if(column.hidden===true){
          // 实测WPS表格（同Excel）里隐藏列的ColumnWidth恒为0，列宽读不回来；
          // 隐藏辅助列只核“是否真的隐藏”，不再拿宽度当失败条件。
          if(target.Hidden!==true)throw Error('“'+s.name+'”隐藏辅助列未生效：第'+column.index+'列');
          return;
        }
        if(column.width==null)return;
        var actual=target.ColumnWidth;
        if(Number(actual)!==Number(column.width))
          throw Error('“'+s.name+'”列宽读回不一致：第'+column.index+'列期望'+column.width+'，实际'+String(actual));
      });
      realMerges(spec).forEach(function(merge){
        var range=sheet.Range(address(merge));
        if(range.MergeCells!==true)throw Error('“'+s.name+'”合并读回不一致：'+address(merge));
      });
      (spec.rows||[]).forEach(function(row){
        var actual=sheet.Rows.Item(row.index).RowHeight;
        if(!Number.isFinite(Number(actual))||Math.abs(Number(actual)-row.height)>0.75||actual==null)
          throw Error('“'+s.name+'”行高读回不一致：第'+row.index+'行');
      });
      (spec.fonts||[]).forEach(function(font){
        var range=sheet.Range(address(font)),target=range.Font||{};
        if(font.name!=null&&target.Name!==font.name)
          throw Error('“'+s.name+'”字体名称读回不一致：'+address(font));
        if(font.size!=null&&Number(target.Size)!==font.size)
          throw Error('“'+s.name+'”字号读回不一致：'+address(font));
        if(font.underline===true&&!target.Underline)
          throw Error('“'+s.name+'”下划线读回缺失：'+address(font));
        // 真机实测：先在锚点上落地获批蓝色再建原生链接会被宿主链接样式覆盖；把字体放到链接之后写，
        // 保存重开读回与获批色完全一致（#0563C1→12673797）。因此这里保持精确比对，不靠“蓝色系”容差放行。
        if(font.color!=null&&target.Color!=null&&Number(target.Color)!==Number(layout.toColor(font.color)))
          throw Error('“'+s.name+'”字体颜色读回不一致：'+address(font)+
            '（期望'+font.color+'/'+Number(layout.toColor(font.color))+'，实际'+String(target.Color)+'）');
      });
      (spec.alignments||[]).forEach(function(item){
        var range=sheet.Range(address(item));
        if((item.horizontal!=null&&Number(range.HorizontalAlignment)!==alignmentValue(item.horizontal))||
           (item.vertical!=null&&Number(range.VerticalAlignment)!==alignmentValue(item.vertical)))
          throw Error('“'+s.name+'”对齐读回不一致：'+address(item));
      });
      (spec.hyperlinks||[]).forEach(function(link){
        var anchor=sheet.Range(address(link));
        var count=anchor.Hyperlinks&&anchor.Hyperlinks.Count;
        if(count==null)throw Error('“'+s.name+'”无法读回超链接，未确认获批版式：'+address(link));
        if(Number(count)<1)throw Error('“'+s.name+'”超链接读回缺失：'+address(link));
        var item=anchor.Hyperlinks.Item(1);
        if(link.internal===true){
          var expectedSub=normalizeSubAddress(link.subAddress),actualSub=normalizeSubAddress(item.SubAddress);
          if(!expectedSub||actualSub!==expectedSub)
            throw Error('“'+s.name+'”文件内跳转读回不一致：期望'+link.subAddress+'，实际'+String(item.SubAddress));
          var storedAddress=String(item.Address==null?'':item.Address);
          if(storedAddress&&normalizeTarget(storedAddress)!==normalizeTarget(String(book.FullName||stagePath)))
            throw Error('“'+s.name+'”文件内跳转被写成外部地址：'+storedAddress+'，未确认获批版式：'+address(link));
          return;
        }
        var actual=item.Address;
        // 相对链接按目录整体搬移仍可用：读回可能是原样相对路径，也可能是WPS解析后的绝对路径。
        // 但两者都要从本文件所在目录解析成完整目标再比对，别处目录的同名文件不能蒙混通过。
        var expected=resolveTarget(finalBase,link.address),resolved=resolveTarget(actualBase,actual);
        if(resolved!==expected)
          throw Error('“'+s.name+'”超链接地址读回不一致：期望'+link.address+'（目标'+expected+
            '），实际'+String(actual)+'（目标'+resolved+'）');
      });
      (spec.validations||[]).forEach(function(rule){
        var range=sheet.Range(address(rule));
        var formula=validationFormula(rule);
        var typeOk=!!(range.Validation&&(range.Validation.Type==null||Number(range.Validation.Type)===3));
        if(!(typeOk&&formulaMatches(range.Validation&&range.Validation.Formula1,formula)))
          throw Error('“'+s.name+'”分类下拉读回不一致：'+address(rule));
        if(rule.allowOtherInput===true&&range.Validation&&range.Validation.ShowError===true)
          throw Error('“'+s.name+'”最终分类未允许输入下拉以外的值：'+address(rule));
      });
      if(spec.print){
        var page=sheet.PageSetup;
        if(!page)throw Error('“'+s.name+'”打印设置无法读回。');
        if(spec.print.paperSize!=null&&Number(page.PaperSize)!==spec.print.paperSize)
          throw Error('“'+s.name+'”打印纸张读回不一致。');
        if(spec.print.area&&String(page.PrintArea).replace(/\$/g,'')!==address(spec.print.area))
          throw Error('“'+s.name+'”打印区域读回不一致。');
        if(spec.print.repeatRow&&String(page.PrintTitleRows)!=='$'+spec.print.repeatRow+':$'+spec.print.repeatRow)
          throw Error('“'+s.name+'”打印重复表头读回不一致。');
        if(spec.print.orientation&&Number(page.Orientation)!==(spec.print.orientation==='landscape'?2:1))
          throw Error('“'+s.name+'”打印方向读回不一致（期望'+(spec.print.orientation==='landscape'?2:1)+'，实际'+String(page.Orientation)+'）。');
        if(spec.print.fitToWidth!=null&&(page.Zoom!==false||Number(page.FitToPagesWide)!==spec.print.fitToWidth||
          Number(page.FitToPagesTall)!==(spec.print.fitToHeight==null?0:spec.print.fitToHeight)))
          throw Error('“'+s.name+'”打印页宽设置读回不一致。');
      }
    });
  }
  function write(app,model,stagePath){
    if(typeof stagePath!=='string'||!/^(?:[a-z]:[\\/]|\\\\)/i.test(stagePath)||!/^.+\.xlsx$/i.test(stagePath))throw Error('暂存路径无效。');
    for(var n=1;n<=app.Workbooks.Count;n++)if(key(app.Workbooks.Item(n).FullName)===key(stagePath))throw Error('暂存文件已打开，未创建工作簿。');
    if(app.FileSystem.Exists(stagePath))throw Error('暂存文件已存在，未覆盖。');
    var previous=app.ActiveWorkbook,security=app.AutomationSecurity,created=null,reopened=null,error=null;
    if(typeof security!=='number')throw Error('不能读取宏安全设置，未创建文件。');
    try{
      var beforeCount=Number(app.Workbooks.Count),beforeNames={};
      for(var index=1;index<=beforeCount;index++)beforeNames[key(app.Workbooks.Item(index).FullName)]=true;
      created=app.Workbooks.Add(-4167);
      // 部分WPS调用会完成新建但返回null。只接管集合中本次唯一新增的未保存簿；
      // 不能把当前活动簿当成输出，也不能重试Add制造更多窗口。
      if(!created&&Number(app.Workbooks.Count)===beforeCount+1){
        var candidates=[];
        for(var item=1;item<=app.Workbooks.Count;item++){
          var candidate=app.Workbooks.Item(item),name=previewIdentity(candidate);
          if(name&&!beforeNames[key(name)])candidates.push(candidate);
        }
        if(candidates.length===1)created=candidates[0];
      }
      if(!created||!created.Worksheets)throw Error('WPS新建输出工作簿未返回有效对象，未写入所选目标。请确认WPS没有未关闭的对话框，保留填写内容后重试。');
      model.sheets.forEach(function(s,i){
        var sheet=i===0?created.Worksheets.Item(1):created.Worksheets.Add(null,created.Worksheets.Item(i));
        sheet.Name=s.name;chunks(sheet,s.values,true);
        var used=sheet.Range('A1:'+columnName(s.values[0].length)+s.values.length);
        used.Font.Size=(s.layout&&s.layout.fontSize)||layout.FONT_SIZE;used.WrapText=true;
        sheet.Range('A1:'+columnName(s.values[0].length)+'1').Font.Bold=true;
        // TRIAL-002：导入统计页的专业/区段是换行长文本；未手动设行高时由宿主按内容撑高，
        // 避免多标题被固定行高裁切。标题行高度随后由layout覆盖为固定值。
        if(s.name==='导入预览'&&used.Rows&&typeof used.Rows.AutoFit==='function')used.Rows.AutoFit();
        if(s.name==='来源明细'&&s.values.length>1){
          ['原路径','文件SHA256','来源标识','核对追溯JSON'].forEach(function(header){
            var index=s.values[0].indexOf(header);
            if(index>=0)sheet.Range(columnName(index+1)+'2:'+columnName(index+1)+s.values.length).WrapText=false;
          });
          used.Rows.AutoFit();
        }
      });
      // 审核主表的下拉引用后面的“内部选项”页；先创建并写齐所有页，避免向尚不存在的页建区域引用。
      model.sheets.forEach(function(s){
        var sheet=created.Worksheets.Item(s.name);
        if(typeof sheet.Activate==='function')sheet.Activate();
        else if(s.layout&&s.layout.freeze)
          throw Error('当前WPS不支持工作表激活API（Worksheet.Activate），未冻结“'+s.name+'”。');
        applyLayout(app,sheet,model,s.layout);
      });
      applySheetVisibility(created,model);
      verify(created,model);
      created.SaveAs(stagePath,51);created.Close(false);created=null;
      app.AutomationSecurity=3;if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未重新打开暂存文件。');
      var candidate=app.Workbooks.Open(stagePath,0,true);
      if(!candidate||key(candidate.FullName)!==key(stagePath))throw Error('WPS未返回指定暂存文件。');
      reopened=candidate;verify(reopened,model);verifyLayout(app,reopened,model,stagePath);
    }catch(e){error=e;}
    finally{
      try{if(reopened)reopened.Close(false);if(created)created.Close(false);}catch(e){error=Error('输出工作簿清理失败：'+e.message);}
      try{app.AutomationSecurity=security;}catch(e){error=Error('宏安全设置恢复失败：'+e.message);}
      try{if(previous)previous.Activate();}catch(e){error=Error('原工作簿恢复失败：'+e.message);}
    }
    if(error)throw error;
  }
  // File-freeze output has a deliberately unpublished phase. No native pane setters
  // run here; the final read-only reopen still checks the ORIGINAL complete model.
  function freezePlan(model){
    return model.sheets.map(function(s){
      var spec=s.layout;
      if(spec)layout.assertValid(spec,{rowCount:s.values.length,columnCount:spec.columns.length});
      return {name:s.name,freeze:spec&&spec.freeze?{row:spec.freeze.row||1,column:spec.freeze.column||1}:null};
    });
  }
  function verifySavedStage(app,model,stagePath){
    var previous=app.ActiveWorkbook,security=app.AutomationSecurity,opened=null,error=null;
    if(typeof security!=='number')throw Error('不能读取宏安全设置，未核对暂存文件。');
    for(var n=1;n<=app.Workbooks.Count;n++)if(key(app.Workbooks.Item(n).FullName)===key(stagePath))
      throw Error('暂存文件已打开，未完成只读重开核验。');
    try{
      app.AutomationSecurity=3;if(app.AutomationSecurity!==3)throw Error('无法禁用自动宏，未核对暂存文件。');
      var candidate=app.Workbooks.Open(stagePath,0,true);
      if(!candidate||key(candidate.FullName)!==key(stagePath))throw Error('WPS未返回指定暂存文件。');
      opened=candidate;verify(opened,model);verifyLayout(app,opened,model,stagePath);
    }catch(e){error=e;}
    finally{
      try{if(opened)opened.Close(false);}catch(e){error=Error('暂存文件只读关闭失败：'+e.message);}
      try{app.AutomationSecurity=security;}catch(e){error=Error('宏安全设置恢复失败：'+e.message);}
      try{if(previous)previous.Activate();}catch(e){error=Error('原工作簿恢复失败：'+e.message);}
    }
    if(error)throw error;
  }
  async function writeWithFileFreeze(app,model,stagePath,finalizeStage){
    if(typeof finalizeStage!=='function')throw Error('缺少文件层冻结步骤，未写入。');
    var plan=freezePlan(model),pending=Object.assign({},model,{sheets:model.sheets.map(function(s){
      return Object.assign({},s,{layout:s.layout?Object.assign({},s.layout,{freeze:null}):s.layout});
    })});
    write(app,pending,stagePath);
    await finalizeStage(plan);
    verifySavedStage(app,model,stagePath);
  }
  // 图01预览只占用插件自己新建且尚未另存的工作簿；绝不把当前活动簿当预览目标。
  // 草稿簿身份：未另存时宿主给的FullName就是名字本身，不含路径分隔符；一旦另存就不再属于插件预览。
  function previewIdentity(book){
    try{
      var full=book&&book.FullName;
      if(typeof full!=='string'||!full||full.indexOf('\\')>=0||full.indexOf('/')>=0)return null;
      return full;
    }catch(_){return null;}
  }
  function previewShapeMatches(book,model){
    try{
      var names=model.sheets.map(function(sheet){return sheet.name;});
      (model.sourceCopies||[]).forEach(function(source){source.sheets.forEach(function(sheet){names.push(sheet.previewName);});});
      if(!book||book.Worksheets.Count!==names.length)return false;
      for(var n=0;n<names.length;n++)if(book.Worksheets.Item(n+1).Name!==names[n])return false;
      return true;
    }catch(_){return false;}
  }
  // 预览草稿簿归属证明：只靠“名字＋表形状”无法区分用户自己新建的同名同结构工作簿，
  // 所以在插件自建草稿里写一个工作簿级定义名作标记；只有标记与PluginStorage一致才允许复用，
  // 宿主不支持定义名时宁可新开，也不冒写用户工作簿的风险。
  var PREVIEW_MARK='RFQ_PREVIEW_TOKEN';
  function previewTokenOf(book){
    try{
      var names=book&&book.Names;
      if(!names||typeof names.Item!=='function')return null;
      var entry=names.Item(PREVIEW_MARK);
      var match=String((entry&&entry.RefersTo)==null?'':entry.RefersTo).match(/rfq-preview-[a-z0-9-]+/i);
      return match?match[0]:null;
    }catch(_){return null;}
  }
  function createPreviewToken(){return 'rfq-preview-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1679616).toString(36);}
  function stampPreview(book){
    var existing=previewTokenOf(book);
    if(existing)return existing;
    var token=createPreviewToken();
    try{book.Names.Add(PREVIEW_MARK,'="'+token+'"');}catch(_){return null;}
    return previewTokenOf(book)===token?token:null;
  }
  function storedPreview(app){
    try{
      return {name:app.PluginStorage.getItem('rfq.preview.book')||null,
        token:app.PluginStorage.getItem('rfq.preview.token')||null,sourceKey:app.PluginStorage.getItem('rfq.preview.sources')||''};
    }catch(_){return {name:null,token:null};}
  }
  function previewSourceKey(model){return JSON.stringify(model.sourceCopies||[]);}
  function rememberPreview(app,book,model){
    var name=previewIdentity(book),token=name?stampPreview(book):null;
    try{
      if(name&&token){
        app.PluginStorage.setItem('rfq.preview.book',name);
        app.PluginStorage.setItem('rfq.preview.token',token);
        app.PluginStorage.setItem('rfq.preview.sources',previewSourceKey(model));
      }else if(typeof app.PluginStorage.removeItem==='function'){
        app.PluginStorage.removeItem('rfq.preview.book');app.PluginStorage.removeItem('rfq.preview.token');
      }
    }catch(_){/* 存储不可用时保持旧行为 */}
  }
  // 侧栏重建/刷新会丢掉内存句柄：按名字、工作表形状和归属标记三者同时命中才找回同一个草稿簿。
  function findStoredPreview(app,model){
    var stored=storedPreview(app);
    if(!stored.name||!stored.token||((model.sourceCopies||[]).length&&stored.sourceKey!==previewSourceKey(model)))return null;
    for(var n=1;n<=app.Workbooks.Count;n++){
      var candidate=app.Workbooks.Item(n);
      try{
        if(previewIdentity(candidate)!==stored.name)continue;
        if(!previewShapeMatches(candidate,model))continue;
        if(previewTokenOf(candidate)!==stored.token)continue;
        return candidate;
      }catch(_){continue;}
    }
    return null;
  }
  function showPreview(app,model,handle){
    var book=null,previous=app.ActiveWorkbook;
    if(handle&&handle.book){
      try{
        if(handle.book.FullName===handle.name&&previewShapeMatches(handle.book,model)&&
            (!(model.sourceCopies||[]).length||handle.sourceKey===previewSourceKey(model))){
          for(var n=1;n<=app.Workbooks.Count;n++)if(app.Workbooks.Item(n)===handle.book)book=handle.book;
        }
      }catch(_){book=null;}
    }
    if(!book)book=findStoredPreview(app,model);
    var reused=!!book;
    if(!book)book=app.Workbooks.Add(-4167);
    try{
      book.Activate();
      model.sheets.forEach(function(s,i){
        var sheet=reused?book.Worksheets.Item(i+1):(i===0?book.Worksheets.Item(1):book.Worksheets.Add(null,book.Worksheets.Item(i)));
        if(reused){sheet.UsedRange.UnMerge();sheet.UsedRange.Clear();}
        sheet.Name=s.name;
        if(typeof sheet.Activate==='function')sheet.Activate();
        chunks(sheet,s.values,true);
        var used=sheet.Range('A1:'+columnName(s.values[0].length)+s.values.length);
        used.Font.Size=(s.layout&&s.layout.fontSize)||layout.FONT_SIZE;used.WrapText=true;
        if(app.ActiveWindow)app.ActiveWindow.FreezePanes=false;
        applyLayout(app,sheet,model,s.layout);
      });
      applySheetVisibility(book,model);
      if(reused&&(model.sourceCopies||[]).length){
        if(!previewShapeMatches(book,model))throw Error('来源预览页数量或顺序不一致。');
        model.sheets.forEach(function(sheet){chunks(book.Worksheets.Item(sheet.name),sheet.values,false);});
      }else verify(book,model);
      if(!reused)copyPreviewSources(app,book,model.sourceCopies||[]);
      if((model.sourceCopies||[]).length&&!previewShapeMatches(book,model))throw Error('来源预览页复制不完整。');
      var first=book.Worksheets.Item(1);if(typeof first.Activate==='function')first.Activate();
      rememberPreview(app,book,model);
      return {book:book,name:book.FullName,sourceKey:previewSourceKey(model)};
    }catch(error){
      // 新建失败簿由插件负责清理；已有预览保持打开，避免丢失用户可能的另存操作。
      if(!reused)try{book.Close(false);}catch(_){}
      try{if(previous)previous.Activate();}catch(_){}
      throw error;
    }
  }
  // 以WPS原生整张工作表Copy保留格式/小标题；只打开导入副本，不把快照材料重排成原表。
  function copyPreviewSources(app,target,sources){
    if(!sources.length)return;
    var security=app.AutomationSecurity;
    if(typeof security!=='number')throw Error('无法读取宏安全设置，未打开来源副本。');
    try{
      app.AutomationSecurity=3;
      if(app.AutomationSecurity!==3)throw Error('无法禁用来源副本自动宏。');
      sources.forEach(function(source){
        if(!source.copyPath||!source.originalPath||key(source.copyPath)===key(source.originalPath)||
            !/^[a-f\d]{64}$/i.test(source.fingerprint||''))throw Error('缺少可核对的来源工作副本。');
        var copy=findOpenBook(app,source.copyPath),owned=false;
        if(copy&&(copy.ReadOnly!==true||copy.Saved===false))throw Error('来源副本已打开且可能有修改，请先保存项目并关闭副本。');
        try{
          if(!copy){copy=app.Workbooks.Open(source.copyPath,0,true);owned=!!copy&&key(copy.FullName)===key(source.copyPath);}
          if(!copy||key(copy.FullName)!==key(source.copyPath)||copy.Worksheets.Count!==source.sheets.length)
            throw Error('来源副本工作表数量不一致，不能显示不完整原表。');
          source.sheets.forEach(function(plan,index){
            var original=copy.Worksheets.Item(index+1),count=target.Worksheets.Count;
            if(original.Name!==plan.sourceName||typeof original.Copy!=='function')throw Error('无法原样复制来源工作表：'+plan.sourceName);
            original.Copy(null,target.Worksheets.Item(count));
            if(target.Worksheets.Count!==count+1)throw Error('来源工作表复制未完成：'+plan.sourceName);
            target.Worksheets.Item(count+1).Name=plan.previewName;
          });
        }finally{if(owned)copy.Close(false);}
      });
    }finally{app.AutomationSecurity=security;}
  }
  // R12-E：拆分待核对的内容证明。打开已有供应商文件，逐值核公开值、工作表/隐藏列范围、必需合并与抬头，
  // 并在核对前后各取一次本机实际SHA；只读核对，绝不覆盖或改写外部文件，也不把“首次观察SHA”当证明。
  function findOpenBook(app,target){
    for(var n=1;n<=app.Workbooks.Count;n++){
      var candidate=app.Workbooks.Item(n);
      try{if(key(candidate.FullName)===key(target))return candidate;}catch(_){}
    }
    return null;
  }
  function readPublicValues(sheet,rowCount,columnCount){
    var values=[];
    for(var start=0;start<rowCount;start+=500){
      var length=Math.min(500,rowCount-start),
        requestedAddress='A'+(start+1)+':'+columnName(columnCount)+(start+length),
        range=sheet.Range(requestedAddress);
      if(range.HasFormula!==false)throw Error('“'+sheet.Name+'”公开值区域检测到公式或无法确认公式状态。');
      var actual=range.Value2;
      if(!Array.isArray(actual)||actual.length!==length)
        throw Error('“'+sheet.Name+'”公开值读回行数不一致['+requestedAddress+']（期望'+length+'行，实际'+
         (Array.isArray(actual)?actual.length:'非二维区域')+'）。');
      for(var r=0;r<length;r++){
        var row=actual[r];
        if(!Array.isArray(row)||row.length<columnCount)throw Error('“'+sheet.Name+'”公开值读回列数不足。');
        values.push(row.slice(0,columnCount));
      }
    }
    return values;
  }
  function comparePublicValues(sheet,expectedValues){
    var mismatches=[],columnCount=expectedValues[0].length,
      actual=readPublicValues(sheet,expectedValues.length,columnCount);
    for(var r=0;r<expectedValues.length&&mismatches.length<5;r++)for(var c=0;c<columnCount;c++){
      var want=expectedValues[r][c]==null?'':String(expectedValues[r][c]),
        cell=actual[r]?actual[r][c]:null,got=cell==null?'':String(cell);
      if(got!==want){mismatches.push('公开值不一致：'+columnName(c+1)+(r+1)+'期望“'+want+'”，实际“'+got+'”。');break;}
    }
    return mismatches;
  }
  function verifyExistingOutput(app,file,expectedSheet,inspectTarget){
    if(!app||!app.Workbooks)return Promise.reject(Error('当前WPS不支持打开工作簿核对已有文件。'));
    if(!file||typeof file.target!=='string'||!file.target)return Promise.reject(Error('缺少待核对的目标路径。'));
    if(!expectedSheet||!Array.isArray(expectedSheet.values)||!expectedSheet.values.length)
      return Promise.reject(Error('缺少冻结的询价页快照，不能核对内容。'));
    if(typeof inspectTarget!=='function')return Promise.reject(Error('缺少本机文件核验接口，不能核对内容。'));
    var target=file.target,mismatches=[],layoutIssues=[];
    return Promise.resolve().then(function(){return inspectTarget(target);}).then(function(before){
      if(!before||before.exists!==true)
        return {ok:false,sha256:null,mismatches:['目标文件不存在，不能核对为成功。'],layoutIssues:[]};
      var beforeSha=before.sha256?String(before.sha256).toLowerCase():null;
      if(!/^[a-f\d]{64}$/i.test(String(beforeSha||'')))
        return {ok:false,sha256:null,mismatches:['无法取得目标文件的实际SHA256，不能核对内容。'],layoutIssues:[]};
      var book=null,opened=false,previous=app.ActiveWorkbook,security=app.AutomationSecurity,error=null;
      try{
        book=findOpenBook(app,target);
        if(!book){
          if(typeof app.AutomationSecurity==='number')app.AutomationSecurity=3;
          book=app.Workbooks.Open(target,0,true);opened=true;
        }
        if(!book)throw Error('WPS未返回待核对的目标工作簿。');
        var count=null;
        try{count=Number(book.Worksheets.Count);}catch(_){count=null;}
        if(count!==1)mismatches.push('工作表数量应为1张，实际'+String(count)+'张；供应商件不能带内部/隐藏页。');
        var expectedName=String(expectedSheet.name||''),sheet=null;
        try{sheet=book.Worksheets.Item(expectedName);}catch(_){sheet=null;}
        if(!sheet)mismatches.push('找不到期望的公开工作表：'+expectedName+'。');
        if(sheet){
          try{mismatches=mismatches.concat(comparePublicValues(sheet,expectedSheet.values));}
          catch(readError){mismatches.push(readError.message);}
          var spec=expectedSheet.layout||{};
          if(spec.freeze){
            try{
              if(typeof sheet.Activate!=='function')throw Error('当前WPS不支持工作表激活API，无法读回冻结位置。');
              sheet.Activate();verifyFreeze(app,sheet,spec.freeze,'阶段=已有文件核对');
            }catch(freezeError){layoutIssues.push(freezeError.message);}
          }
          if(typeof sheet.Columns==='object'&&typeof sheet.Columns.Item==='function'){
            (spec.columns||[]).forEach(function(column,position){
              var index=column.index||position+1,actualColumn=sheet.Columns.Item(index);
              if(column.hidden===true){
                if(actualColumn.Hidden!==true)layoutIssues.push('隐藏辅助列未生效：第'+index+'列。');
              }else if(actualColumn.Hidden===true)layoutIssues.push('公开列被隐藏：第'+index+'列。');
            });
            var publicColumns=expectedSheet.values[0].length;
            for(var index=publicColumns+1;index<=publicColumns+8;index++){
              var extra=sheet.Columns.Item(index);
              if(extra&&extra.Hidden===true){layoutIssues.push('公开列范围外存在隐藏辅助列：第'+index+'列。');break;}
            }
          }
          realMerges(spec).forEach(function(merge){
            var range=sheet.Range(address(merge));
            if(range.MergeCells!==true)layoutIssues.push('必需合并未生效：'+address(merge)+'。');
          });
          try{
            var used=sheet.UsedRange;
            if(used&&used.Columns&&Number.isFinite(Number(used.Columns.Count))&&
             Number(used.Columns.Count)>expectedSheet.values[0].length)
              layoutIssues.push('存在公开列范围外的额外列（UsedRange '+String(used.Columns.Count)+' 列）。');
          }catch(_){}
        }
      }catch(e){error=e;}
      finally{
        try{if(book&&opened)book.Close(false);}catch(closeError){if(!error)error=closeError;}
        try{app.AutomationSecurity=security;}catch(_){}
        try{if(previous)previous.Activate();}catch(_){}
      }
      if(error)return {ok:false,sha256:beforeSha,
        mismatches:mismatches.concat(['打开或读取已有文件失败：'+error.message]),layoutIssues:layoutIssues};
      return inspectTarget(target).then(function(after){
        var afterSha=after&&after.sha256?String(after.sha256).toLowerCase():null;
        if(!after||after.exists!==true||!/^[a-f\d]{64}$/i.test(String(afterSha||'')))
          return {ok:false,sha256:beforeSha,mismatches:mismatches.concat(['核对后无法再次取得目标文件SHA256。']),
           layoutIssues:layoutIssues};
        if(afterSha!==beforeSha)
          mismatches.push('目标文件在核对过程中被改写（SHA256发生变化），需要重新核对。');
        return {ok:mismatches.length===0&&layoutIssues.length===0,sha256:afterSha,
         mismatches:mismatches,layoutIssues:layoutIssues};
      });
    });
  }
  return {selectTarget:selectTarget,write:write,writeWithFileFreeze:writeWithFileFreeze,freezePlan:freezePlan,showPreview:showPreview,address:address,
   verifyExistingOutput:verifyExistingOutput};
}));
