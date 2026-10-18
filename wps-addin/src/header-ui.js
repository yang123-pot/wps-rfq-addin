(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  options=options||{};
  var message=document.getElementById('header-message'),status=document.getElementById('header-status'),
    saveTemplate=document.getElementById('header-save-template'),templateName=document.getElementById('header-template-name'),
    templateSelect=document.getElementById('header-template-select'),applyTemplate=document.getElementById('header-apply-template'),
    deleteTemplate=document.getElementById('header-delete-template');
  var draft=RfqInquiryHeader.create(),revision=0,templates=[],busy=false;
  var inputs={};
  RfqInquiryHeader.FIELDS.forEach(function(field){
   inputs[field.key]=document.getElementById('header-'+field.key);
   if(!inputs[field.key])return;
   function changed(){
    draft[field.key]=inputs[field.key].value;render();
    // 抬头是询价生成的内容键之一：变化后要立即让询价/拆分面板按最新内容重算可用性。
    if(options.onChange)options.onChange(draft);}
   inputs[field.key].addEventListener('input',changed);
   inputs[field.key].addEventListener('change',changed);
  });
  function tell(text,error){message.textContent=text;message.className=error?'error':'';if(window.RfqFeedback)RfqFeedback.tell(text,error,'header');}
  function request(action,payload){
   var token=window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token;
   if(!token)return Promise.reject(Error('当前会话未启用本机抬头模板。'));
   return fetch('/api/header/'+action,{method:'POST',
    headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(payload||{})})
    .then(function(response){return response.text().then(function(body){
     var result;try{result=JSON.parse(body);}catch(_){result={};}
     if(!response.ok){var error=Error(result.error||'抬头模板请求失败。');error.status=response.status;throw error;}
     return result;});});
  }
  function render(){
   RfqInquiryHeader.FIELDS.forEach(function(field){
    if(inputs[field.key]&&inputs[field.key].value!==String(draft[field.key]||''))inputs[field.key].value=String(draft[field.key]||'');
    if(inputs[field.key]&&String(draft[field.key]||'').trim())inputs[field.key].removeAttribute('aria-invalid');
   });
   var check=RfqInquiryHeader.validate(draft);
   var problem=document.getElementById('assistant-problem');
   if(check.ok&&problem&&problem.dataset.stage==='header'&&window.RfqFeedback)RfqFeedback.clear();
   status.textContent=RfqInquiryHeader.summary(draft)+(check.ok?' · 抬头已齐全（生成询价表后写入文件前几行）':' · 还缺：'+check.errors.join('；'));
   if(templateSelect){
    templateSelect.textContent='';
    var placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='选择本机模板';
    templateSelect.appendChild(placeholder);
    templates.forEach(function(template){
     var option=document.createElement('option');option.value=template.templateId;option.textContent=template.name;
     templateSelect.appendChild(option);});
   }
   applyTemplate.disabled=busy||!templates.length;
   deleteTemplate.disabled=busy||!templates.length;
   saveTemplate.disabled=busy;
  }
  function loadTemplates(){
   return request('load').then(function(state){
    revision=Number.isSafeInteger(state.revision)?state.revision:0;
    templates=Array.isArray(state.templates)?state.templates:[];
    render();
    return state;
   }).catch(function(error){
    tell('本机抬头模板未读取：'+error.message,true);
    return null;
   });
  }
  function persist(nextTemplates,success){
   busy=true;render();
   return request('save',{expectedRevision:revision,templates:nextTemplates}).then(function(result){
    busy=false;revision=Number.isSafeInteger(result.revision)?result.revision:revision+1;
    return loadTemplates().then(function(){tell(success);return true;});
   }).catch(function(error){
    busy=false;render();
    tell(error.status===409?('抬头模板版本冲突：'+error.message+'请重新加载后再保存。')
     :('抬头模板未保存，本页草稿保留：'+error.message),true);
    return false;
   });
  }
  function saveTemplateNow(){
   var name=(templateName&&templateName.value||'').trim(),check=RfqInquiryHeader.validate(draft);
   if(!check.ok){tell('抬头必填项未填齐，未保存模板：'+check.errors.join('；'),true);return;}
   if(!name){tell('请先填写模板名称，例如“本公司询价抬头”。',true);return;}
   persist(templates.concat([{name:name,header:RfqInquiryHeader.normalize(draft)}]),'已保存本机抬头模板：'+name);
  }
  try{saveTemplate.addEventListener('click',saveTemplateNow);}catch(_){}
  try{applyTemplate.addEventListener('click',function(){
   var chosen=templateSelect&&templateSelect.value;
   if(!chosen){tell('请先选择要应用的模板。',true);return;}
   var found=templates.filter(function(template){return template.templateId===chosen;})[0];
   if(!found){tell('模板已不存在，请重新加载。',true);return;}
   draft=RfqInquiryHeader.normalize(found.header);
   render();if(options.onChange)options.onChange(draft);
   tell('已应用模板“'+found.name+'”（只改了本页草稿，没改已保存项目）。');
  });}catch(_){}
  try{deleteTemplate.addEventListener('click',function(){
   var chosen=templateSelect&&templateSelect.value;
   if(!chosen){tell('请先选择要删除的模板。',true);return;}
   persist(templates.filter(function(template){return template.templateId!==chosen;}),'已删除所选本机抬头模板。');
  });}catch(_){}
  render();
  if(window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token)loadTemplates();
  return {refresh:render,templates:function(){return templates;},header:function(){return draft;},
   restore:function(value){draft=RfqInquiryHeader.normalize(value||RfqInquiryHeader.create());render();
    if(options.onChange)options.onChange(draft);},
   verdict:function(){
    var check=RfqInquiryHeader.validate(draft);
    return {ready:check.ok,detail:check.ok?'抬头已填写完整':('抬头未填写完整：'+check.errors[0])};
   }};
 }
 window.RfqHeaderUI={create:create};
}());
