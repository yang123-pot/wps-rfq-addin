(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  options=options||{};
  var message=document.getElementById('inquiry-message'),status=document.getElementById('inquiry-status'),
    previewList=document.getElementById('inquiry-preview'),generateButton=document.getElementById('inquiry-generate');
  var generation=null,busy=false;
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function context(){return options.context?options.context():null;}
  function draft(){
   var ctx=context();
   if(!ctx||!ctx.brandTable||!ctx.header)return null;
   return {brandTable:ctx.brandTable,header:ctx.header,groups:ctx.groups,classification:ctx.classification,
    inputKey:ctx.inputKey};
  }
  function buildModel(){
   var input=draft();
   if(!input)throw Error('请先完成分类与品牌，并填写询价抬头。');
   var model=RfqInquiryModel.build(input);
   model.inputKey=input.inputKey;
   return model;
  }
  function stale(){
   var ctx=context();
   return !generation||!ctx||RfqInquiryModel.isCurrent(generation,ctx.inputKey)===false;
  }
  function render(){
   var ctx=context();
   var model=null,error=null;
   if(ctx&&ctx.brandTable&&ctx.header){
    try{model=buildModel();}catch(problem){error=problem.message;}
   }
   if(error){status.textContent='还不能生成询价表：'+error;generateButton.disabled=true;}
   else if(!model){status.textContent='先完成导入、来源核对、合并确认、分类确认、品牌读取与抬头填写，再生成询价表。';generateButton.disabled=true;}
   else{
    status.textContent='抬头 '+RfqInquiryHeader.summary(ctx.header)+' · 询价页 '+model.sheets.length+' 张 · 材料行 '+model.rowCount+
     (generation?(RfqInquiryModel.isCurrent(generation,ctx.inputKey)?' · 已生成：'+generation.target:' · 旧生成文件已过期，需要重新生成'):' · 尚未生成');
    generateButton.disabled=busy||!options.application;
   }
   previewList.textContent='';
   if(model){
    model.sheets.forEach(function(sheet){
     var li=node('li');li.setAttribute('data-inquiry-sheet',sheet.sheetId);
     li.appendChild(node('strong',sheet.name));
     li.appendChild(node('p','品牌 '+(sheet.brand||'（空）')+' · 供应商 '+(sheet.supplier||'（空）')+
      ' · 材料 '+Math.max(0,sheet.values.length-(sheet.layout?sheet.layout.headerRow:0))+' 行 · 表头第'+
      ((sheet.layout?sheet.layout.headerRow:0)+1)+'行','source'));
     previewList.appendChild(li);
    });
    if(!model.sheets.length)previewList.appendChild(node('li','全部材料都是“无需询价”，无需生成询价表。','empty'));
   } else previewList.appendChild(node('li','还没有可预览的询价页。','empty'));
  }
  function requests(action,payload){
   var token=window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token;
   if(!token)return Promise.reject(Error('当前会话未启用生成，请启动最新开发服务并重新打开侧栏。'));
   return fetch('/api/export/'+action,{method:'POST',
    headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(payload||{})})
    .then(function(response){return response.text().then(function(body){
     var result;try{result=JSON.parse(body);}catch(_){result={};}
     if(!response.ok){var error=Error(result.error||'生成请求失败。');error.status=response.status;throw error;}
     return result;});});
  }
  async function generate(){
   if(busy)return;
   var model,book,prepared=null,target=null;
   try{
    model=buildModel();
    if(!model.sheets.length){tell('全部材料都是“无需询价”，没有需要生成的询价表。');return;}
    book=RfqInquiryModel.workbook(model,new Date().toISOString());
   }catch(error){tell(error.message,true);return;}
   target=RfqBrandHost.selectTarget(options.application,'项目询价_'+model.sheets.length+'张表.xlsx');
   if(!target){tell('已取消选择保存位置，原文件未改动。');return;}
   try{
    busy=true;if(options.onBusy)options.onBusy(true);render();
    tell('正在准备新文件…');
    prepared=await requests('prepare',{target:target});
    if(!prepared||typeof prepared.ticket!=='string'||typeof prepared.stagePath!=='string')throw Error('生成会话信息不完整，未写入。');
    tell('正在写入并重新打开校验…');
    await new Promise(function(resolve){setTimeout(resolve,0);});
    await RfqBrandHost.write(options.application,book,prepared.stagePath);
    tell('正在保存到所选位置…');
    var result;
    try{result=await requests('commit',{ticket:prepared.ticket});}
    catch(error){if(error.status&&error.status<500)throw error;result=await requests('commit',{ticket:prepared.ticket});}
    if(!result||result.target!==prepared.target||!/^[a-f\d]{64}$/i.test(result.sha256))
     throw Error('未取得有效保存回执，请检查目标文件。');
    generation=RfqInquiryModel.record(model,{target:result.target,sha256:result.sha256,generatedAt:new Date().toISOString()});
    if(options.onGeneration)options.onGeneration(generation);
    tell('询价工作簿已生成并校验：'+result.target+'（'+model.sheets.length+'张询价页，报价单价与金额留空）。');
   }catch(error){tell('询价表未确认成功。'+error.message+(prepared?' 请检查目标位置：'+prepared.target:''),true);}
   finally{busy=false;if(options.onBusy)options.onBusy(false);render();}
  }
  if(generateButton)generateButton.addEventListener('click',generate);
  render();
  return {refresh:render,generation:function(){return generation;},restore:function(value){generation=value||null;render();},
   verdict:function(){
    var ctx=context();
    if(!generation)return {ready:false,detail:'尚未生成总询价工作簿'};
    if(!ctx||!RfqInquiryModel.isCurrent(generation,ctx.inputKey))return {ready:false,detail:'旧生成文件已过期，需要重新生成'};
    return {ready:true,detail:'询价表已生成并校验'};
   }};
 }
 window.RfqInquiryUI={create:create};
}());
