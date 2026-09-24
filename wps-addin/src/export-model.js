(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./collection.js'));
  else root.RfqExportModel=factory(root.RfqCollection);
}(typeof window==='object'?window:globalThis,function(collection){
  'use strict';
  function build(input,mergeIdentical){
    var result=collection.preview(input,mergeIdentical);
    if(!result.canFinalize)throw Error('清单为空或仍有待核对问题，不能另存。');
    var main=[['序号','项目编码','项目名称','项目特征描述','单位','工程量','清单来源','来源条数']];
    var sources=[['清单序号','原文件','原路径','文件SHA256','工作表','原行号','来源行号','原编码','核对编码','原工程量','核对工程量','单位','工程名称','专业','专业依据','归集范围','来源标识','原名称','原单位','原工程名称','原专业','核对追溯JSON']];
    result.groups.forEach(function(g,index){
      var codes=[];g.sources.forEach(function(s){if(codes.indexOf(s.code)<0)codes.push(s.code);});
      main.push([index+1,codes.join('；'),g.name,g.feature,g.unit,g.quantity,g.sourceLabels.join('；'),g.sources.length]);
      g.sources.forEach(function(s){
        var entry=input.entries.find(function(e){return e.metadata.originalPath===s.path;});
        if(!entry)throw Error('来源文件映射缺失，不能另存。');
        var original=s.review&&s.review.original||{};
        sources.push([index+1,s.file,s.path,entry.metadata.fingerprint,s.sheet,s.row,s.rows.join('、'),
          original.code==null?s.code:original.code,s.code,s.quantityRaw,s.quantity,s.unit,s.engineering,s.profession,
          s.professionBasis,g.scopeId,s.id,original.name==null?g.name:original.name,original.unit==null?s.unit:original.unit,
          original.engineering==null?s.engineering:original.engineering,original.profession==null?s.profession:original.profession,JSON.stringify(s)]);
      });
    });
    var sheets=[{name:'清单',values:main},{name:'来源明细',values:sources},{name:'处理记录',values:[
      ['项目','内容'],['格式版本','wps-rfq-merge-v1'],['归集模式',result.mode],['输入条数',result.inputCount],['输出条数',result.outputCount],
      ['生成时间',new Date().toISOString()],['用途','内部清单及来源记录，尚未分类，不作为供应商询价文件'],
      ['精度说明','编码与工程量以文本保存，保留前导零和十进制精度；后续计算须由插件处理'],
      ['来源分离',result.mode==='separate'?'未选择合并；后续处理必须保持不同来源的归集范围':'已选择按名称、特征、单位完全相同精确合并']
    ]}];
    var total=0;
    sheets.forEach(function(sheet){
      var cells=sheet.values.length*sheet.values[0].length;total+=cells;
      if(cells>1000000||total>3000000)throw Error('输出范围过大，请减少导入文件后重试。');
      sheet.values=sheet.values.map(function(row,index){return row.map(function(value){
        var text=value==null?'':String(value);
        if(text.length>32767||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw Error('“'+sheet.name+'”第'+(index+1)+'行含超长文本或不支持字符，未截断，不能另存。');
        return text;
      });});
    });
    return {mode:result.mode,inputCount:result.inputCount,outputCount:result.outputCount,sheets:sheets};
  }
  return {build:build};
}));
