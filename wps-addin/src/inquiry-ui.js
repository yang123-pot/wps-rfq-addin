(function(){
 'use strict';
 // R9（图06）：第6步“品牌与供应商带入询价表”。品牌唯一来源是分类汇总表读回结果；
 // 主按钮生成总询价工作簿，辅助“返回汇总表修改”，主流程进入第7步拆分。
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function fileName(path){return String(path||'').split(/[\\/]/).pop()||'';}
 function create(options){
  options=options||{};
  var banner=document.getElementById('inquiry-banner'),progress=document.getElementById('inquiry-progress'),
    stats=document.getElementById('inquiry-stats'),status=document.getElementById('inquiry-status'),
    message=document.getElementById('inquiry-message'),workbook=document.getElementById('inquiry-workbook'),
    previewList=document.getElementById('inquiry-preview'),generateButton=document.getElementById('inquiry-generate'),
    nextButton=document.getElementById('inquiry-next'),backButton=document.getElementById('inquiry-back');
  var generation=null,busy=false,lastBrandsReady=false;
  function tell(text,error){if(!message)return;message.textContent=text;message.className=error?'error':'';if(window.RfqFeedback)RfqFeedback.tell(text,error,'inquiry');}
  function context(){return options.context?options.context():null;}
  function draft(){
   var ctx=context();
   if(!ctx||!ctx.brands||!ctx.header)return null;
   return {brands:ctx.brands,groups:ctx.groups||[],classification:ctx.classification,
    header:ctx.header,inputKey:ctx.inputKey,projectName:ctx.projectName||''};
  }
  function buildModel(){
   var input=draft();
   if(!input)throw Error('请先完成品牌汇总（读回分类汇总表）并填写询价抬头。');
   var model=RfqInquiryModel.build(input);
   model.inputKey=input.inputKey;
   return model;
  }
  function isCurrent(){var ctx=context();return !!generation&&!!ctx&&RfqInquiryModel.isCurrent(generation,ctx.inputKey);}
  function suggestedName(){
   var ctx=context(),name=ctx&&ctx.projectName?String(ctx.projectName):'项目';
   return name.replace(/[\\\/:\*\?"<>\|]/g,'_')+'_询价总表.xlsx';
  }
  function brandsReady(){var ctx=context();return !!(ctx&&ctx.brands&&ctx.brands.length);}
  function headerCheck(){var ctx=context();return RfqInquiryHeader.validate(ctx&&ctx.header);}
  // 图06侧栏：当前操作的工作簿、预计输出与每类方式、返回汇总表修改、进入拆分。
  function render(){
   var ctx=context(),model=null,error=null,ready=brandsReady(),header=headerCheck();
   lastBrandsReady=ready;
   if(ready&&header.ok){try{model=buildModel();}catch(problem){error=problem.message;}}
   var current=isCurrent();
   if(!ready){
    banner.textContent='尚未完成品牌汇总';banner.className='result-banner';
    progress.textContent='当前进度 6 / 7 · 等待第5步读取分类汇总表';
    stats.textContent='品牌与供应商取自分类汇总表；允许为空，空值会在询价表中保持空白。';
    status.textContent='在“品牌汇总”生成汇总表后点“读取汇总表，下一步”；品牌和供应商可以留空。';
   }else if(!header.ok){
    banner.textContent='询价抬头未填齐';banner.className='result-banner';
    progress.textContent='当前进度 6 / 7 · 品牌已读回，等待填写询价抬头';
    stats.textContent='抬头包含项目名称、单位名称、材料经办人、联系方式（必填）与原公司地址、传真、邮箱（可选）。';
    status.textContent='还缺：'+header.errors.join('；')+'。请在“辅助功能 → 询价抬头”里填写。';
   }else if(error){
    banner.textContent='询价表还不能生成';banner.className='result-banner';
    progress.textContent='当前进度 6 / 7 · 品牌或抬头与当前清单不一致';
    stats.textContent=RfqInquiryHeader.summary(ctx.header);
    status.textContent=error;
   }else if(!generation){
    banner.textContent='尚未生成总询价工作簿';banner.className='result-banner';
    progress.textContent='当前进度 6 / 7 · 品牌与抬头已就绪，等待生成总询价工作簿';
    stats.textContent='预计输出 '+model.sheetCount+' 份询价表（'+RfqInquiryModel.countsText(model)+'）· 报价单价与金额留空。';
    status.textContent=RfqInquiryHeader.summary(ctx.header);
   }else if(!current){
    banner.textContent='总询价工作簿已过期';banner.className='result-banner';
    progress.textContent='当前进度 6 / 7 · 内容或询价表样式已变化，需要重新生成总询价工作簿';
    stats.textContent='上次生成：'+fileName(generation.target)+'（'+generation.sheetIds.length+' 张询价页），不再作为当前依据。';
    status.textContent='内容或询价表样式更新后须重新生成，请另选新文件名保存；旧文件保留。';
   }else{
    banner.textContent='询价表已生成并校验';banner.className='result-banner is-done';
    progress.textContent='当前进度 6 / 7 · 总询价工作簿已生成，可进入第7步拆分';
    stats.textContent='共 '+generation.sheetIds.length+' 份询价表（'+RfqInquiryModel.countsText(model)+'）· 报价单价与金额留空。';
    status.textContent='实际文件：'+generation.target+'（SHA '+String(generation.sha256||'').slice(0,12)+'…）';
   }
   if(workbook)workbook.textContent=generation?fileName(generation.target):('尚未生成（预计文件名：'+suggestedName()+'）');
   if(previewList){
    previewList.textContent='';
    if(model)model.sheets.forEach(function(sheet){
     var li=node('li');li.setAttribute('data-inquiry-sheet',sheet.sheetId);
     li.appendChild(node('strong',sheet.name));
     li.appendChild(node('p','方式：'+RfqInquiryModel.modeLabel(sheet.mode)+' · 材料 '+sheet.rowIds.length+' 行 · 品牌 '+
      (sheet.brandLabel||'（空）')+' · 供应商 '+(sheet.groups||[]).map(function(group){return group.supplier;}).join('、'),'source'));
     previewList.appendChild(li);
    });
    if(!model)previewList.appendChild(node('li','品牌或抬头就绪后可预览询价页。','empty'));
   }
   if(generateButton){
    generateButton.disabled=busy||!ready||!header.ok||!!error||!options.application;
    generateButton.textContent=generation?'重新生成总询价工作簿':'生成总询价工作簿';
   }
   if(nextButton)nextButton.disabled=busy||!current;
   if(backButton)backButton.disabled=busy;
  }
  function headerEdited(value){
   var check=RfqInquiryHeader.validate(value);
   if(generateButton)generateButton.disabled=busy||!lastBrandsReady||!check.ok||!options.application;
   if(nextButton)nextButton.disabled=true;
   if(generation){
    banner.textContent='总询价工作簿已过期';banner.className='result-banner';
    status.textContent='抬头正在修改，填写完成后重新核对；旧询价文件暂不用于拆分。';
   }
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
    book=RfqInquiryModel.workbook(model,new Date().toISOString());
   }catch(error){tell(error.message,true);return;}
   target=RfqBrandHost.selectTarget(options.application,suggestedName());
   if(!target){tell('已取消选择保存位置，原文件未改动。');return;}
   try{
    busy=true;if(options.onBusy)options.onBusy(true);render();
    tell('正在准备新文件…');
    prepared=await requests('prepare',{target:target,freezePlan:RfqBrandHost.freezePlan(book)});
    if(!prepared||typeof prepared.ticket!=='string'||typeof prepared.stagePath!=='string')
     throw Error('生成会话信息不完整，未写入。');
    tell('正在写入并重新打开校验…');
    await new Promise(function(resolve){setTimeout(resolve,0);});
    await RfqBrandHost.write(options.application,book,prepared.stagePath,{finalizeFreeze:function(){
     return requests('freeze',{ticket:prepared.ticket});
    }});
    tell('正在保存到所选位置…');
    var result;
    try{result=await requests('commit',{ticket:prepared.ticket});}
    catch(error){if(error.status&&error.status<500)throw error;result=await requests('commit',{ticket:prepared.ticket});}
    if(!result||result.target!==prepared.target||!/^[a-f\d]{64}$/i.test(result.sha256))
     throw Error('未取得有效保存回执，请检查目标文件。');
    // 发布后再核一次真实文件SHA，与分类工作簿/汇总表同一口径。
    await requests('verify',{ticket:prepared.ticket,target:result.target,sha256:result.sha256});
    generation=RfqInquiryModel.record(model,{target:result.target,sha256:result.sha256,generatedAt:new Date().toISOString()});
    if(options.onGeneration){var saved=await options.onGeneration(generation);if(saved===null)throw Error('询价总表已生成，但项目记录未保存。请保存结果后继续。');}
    tell('总询价工作簿已生成并校验：'+result.target+'（'+model.sheets.length+' 张询价页，报价单价与金额留空）。品牌取自汇总表，改品牌请回汇总表修改并重新生成。');
   }catch(error){tell('询价表未确认成功。'+error.message+(prepared?' 请检查目标位置：'+prepared.target:''),true);}
   finally{busy=false;if(options.onBusy)options.onBusy(false);render();}
  }
  if(generateButton)generateButton.addEventListener('click',function(){generate();});
  if(nextButton)nextButton.addEventListener('click',function(){
   if(!isCurrent()){tell('请先生成并校验总询价工作簿，再进入拆分。',true);return;}
   if(options.onNext)options.onNext();
  });
  if(backButton)backButton.addEventListener('click',function(){
   if(options.onBack)options.onBack();
  });
  render();
  return {generate:generate,refresh:render,headerEdited:headerEdited,generation:function(){return generation;},restore:function(value){generation=value||null;render();},
   model:function(){try{return buildModel();}catch(_){return null;}},
   verdict:function(){
    if(!generation)return {ready:false,detail:'尚未生成总询价工作簿'};
    if(!isCurrent())return {ready:false,detail:'旧生成文件已过期，需要重新生成'};
    return {ready:true,detail:'询价表已生成并校验（'+generation.sheetIds.length+' 张询价页）'};
   }};
 }
 window.RfqInquiryUI={create:create};
}());
