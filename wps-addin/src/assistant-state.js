(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RfqAssistantState=api;root.RfqAssistant=api.create();}}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var STAGES=['import','matching','review','categories','brands','inquiry','split'];
 var LABELS=['选择清单','分类','核对','工作簿','填品牌','询价表','拆分'];
 function progressView(s){
  var v={step:1,title:'选择清单',description:'选择要整理的 .xls 或 .xlsx 文件，可以一次选择多份。',action:'import',label:'选择清单文件',mergeVisible:false,busy:!!s.busy};
  function at(step,title,description,action,label){Object.assign(v,{step:step,title:title,description:description,action:action,label:label});}
  var split=s.split||{};
  if(s.reviewConfirmed&&s.noInquiry)at(8,'核对已完成，无需生成询价文件','本次材料均为“无需询价”，核对记录已保留。','saveProject','保存项目');
  else if(s.splitVerified&&split.planned>0&&split.complete===split.planned&&!split.failed&&!split.pending&&!split.needsVerification)
   at(8,split.completeWorkbookCount?'文件已全部导出':'已生成 '+split.complete+' 个询价文件',
    split.completeWorkbookCount?split.supplierCount+' 个供应商文件＋'+(split.noInquiryCount?'1 份无需询价清单＋':'')+
     '1 份完整总表，共 '+split.complete+' 个文件已保存并核对。':'共 '+split.complete+' 个文件已保存并核对。','openFolder','打开文件夹');
  else if(s.brandsReady){
   at(6,'填写询价抬头','填写后会带到全部询价文件。','inquiryGenerate',s.inquiryStale?'重新生成询价总表':'生成询价总表');
   if(s.inquiryReady){
    at(6,'询价总表已生成','共 '+s.expectedSheets+' 张询价页，下一步生成可发送的独立文件。','goSplit','下一步：拆分询价文件');
    if(s.splitStarted){
     at(7,'生成供应商文件','每张询价表生成一个独立文件，同时单独保留无需询价清单和完整总表。','chooseDirectory','选择输出文件夹');
     if(s.outputDirectory)at(7,'生成供应商文件','每张询价表生成一个独立文件，同时单独保留无需询价清单和完整总表。','splitRun','开始拆分');
     if(split.failed||split.pending&&split.complete)Object.assign(v,{action:'splitRetry',label:'重试未完成文件'});
     if(split.needsVerification)Object.assign(v,{action:'splitVerify',label:'核对已有文件'});
    }
   }
   if(s.inquiryPendingSave)at(6,'询价文件已生成，项目尚未保存','保留已生成文件，保存成功后再继续。','saveProject','重试保存项目');
   if(s.splitPendingSave)at(7,'拆分文件已保留，项目尚未保存','保存成功后才显示全部完成，无需重新拆分。','saveProject','重试保存项目');
  }else if(s.reviewConfirmed){
   if(s.categoriesRecover&&!s.categoriesReady)
    at(4,'核对已有分类工作簿','分类工作簿和首页汇总表已经生成；这里只需核对现有文件，不会再写一份。','categoriesGenerate','核对现有分类工作簿');
   else
    at(4,'生成分类工作簿','首页是分类汇总表，后面每类材料一张工作表。','categoriesGenerate','生成分类工作簿');
   if(s.categoriesReady)at(4,'分类工作簿已生成',s.categoryCount+' 类询价材料，已放在同一本工作簿。首页是汇总表，每类材料一张工作表'+
     (s.noInquiryPage?'；“无需询价”明细在最后一张工作表。':'。'),'continueBrands','下一步：填写品牌和供应商');
   if(s.categoriesReady&&s.summaryReady&&s.brandsOpened)at(5,'填写品牌和供应商','可填写1至3组，也可以全部留空；直接下一步后，询价表对应位置保持空白。','brandsConfirm','下一步：生成询价表');
   if(s.categoriesPendingSave)at(4,'分类工作簿已生成，项目尚未保存','已生成文件会保留，请保存本次分类结果后继续。','saveProject','重试保存项目');
  }else if(s.mergeConfirmed){
   at(2,'自动分类完成','','reviewGenerate','生成分类核对表');
   if(s.reviewGenerated)Object.assign(v,{action:'reviewOpen',label:'打开核对表'});
   if(s.reviewGenerated&&s.reviewOpened)at(3,'核对材料分类','在黄色区域修改分类；不需要询价的材料选“无需询价”。','reviewConfirm','核对完成，生成分类工作簿');
  }else if(s.files&&s.files.length){
   at(1,'先看一下清单','请检查工作簿和工作表是否齐全。原始文件不会修改。','previewConfirm','我已看完预览');
   if(!s.previewAvailable)Object.assign(v,{action:'previewRetry',label:'重新打开清单预览'});
   if(s.previewReviewed){at(1,'选择整理方式','','mergeConfirm','确认选择，开始自动分类');v.mergeVisible=true;v.disabled=false;}
  }
  if(v.busy){v.disabled=true;v.label=s.busyLabel||'正在处理，请稍候…';}
  return v;
 }
 // 当前页与真实完成进度分开；返回只选择页面，不撤销审核或清除已生成记录。
 function view(s,selected,selectedImport){
  var result=progressView(s),progress=result.step;
  if(Number.isInteger(selected)&&selected>=1&&selected<progress){
   var page={step:selected,mergeVisible:false,busy:!!s.busy};
   function at(title,description,action,label){Object.assign(page,{title:title,description:description,action:action,label:label});}
   if(selected===1){
    at('选择清单','选择要整理的 .xls 或 .xlsx 文件，可以一次选择多份。','import','选择清单文件');
    if(s.files&&s.files.length){
     at('先看一下清单','请检查工作簿和工作表是否齐全。原始文件不会修改。',s.previewAvailable?'previewConfirm':'previewRetry',s.previewAvailable?'我已看完预览':'重新打开清单预览');
     if(s.previewReviewed){at('选择整理方式','','mergeConfirm','确认选择，开始自动分类');page.mergeVisible=true;}
    }
   }else if(selected===2)at('自动分类完成','',s.reviewGenerated?'reviewOpen':'reviewGenerate',s.reviewGenerated?'打开核对表':'生成分类核对表');
   else if(selected===3)at('核对材料分类','在黄色区域修改分类；不需要询价的材料选“无需询价”。','reviewConfirm','核对完成，生成分类工作簿');
   else if(selected===4){
    at('生成分类工作簿','首页是分类汇总表，后面每类材料一张工作表。','categoriesGenerate',s.categoriesRecover?'核对现有分类工作簿':'生成分类工作簿');
    if(s.categoriesReady)at('分类工作簿已生成',s.categoryCount+' 类询价材料，已放在同一本工作簿。首页是汇总表，每类材料一张工作表'+(s.noInquiryPage?'；“无需询价”明细在最后一张工作表。':'。'),'continueBrands','下一步：填写品牌和供应商');
    if(s.categoriesPendingSave)at('分类工作簿已生成，项目尚未保存','已生成文件会保留，请保存本次分类结果后继续。','saveProject','重试保存项目');
   }else if(selected===5)at('填写品牌和供应商','可填写1至3组，也可以全部留空；直接下一步后，询价表对应位置保持空白。','brandsConfirm','下一步：生成询价表');
   else if(selected===6){
    at('填写询价抬头','填写后会带到全部询价文件。','inquiryGenerate',s.inquiryStale?'重新生成询价总表':'生成询价总表');
    if(s.inquiryReady)at('询价总表已生成','共 '+s.expectedSheets+' 张询价页，下一步生成可发送的独立文件。','goSplit','下一步：拆分询价文件');
    if(s.inquiryPendingSave)at('询价文件已生成，项目尚未保存','保留已生成文件，保存成功后再继续。','saveProject','重试保存项目');
   }else if(selected===7){
    // 从完成页返回第7步，沿用已核对结果和打开目录动作，不重复拆分。
    Object.assign(page,result,{step:7});
   }
   if(page.busy){page.disabled=true;page.label=s.busyLabel||'正在处理，请稍候…';}
   result=page;
  }
  if(result.step===1){
   var phase=selectedImport||(s.files&&s.files.length?(s.previewReviewed?'options':'preview'):'select');
   result.importPhase=phase;
   if(phase==='preview')Object.assign(result,{title:'先看一下清单',description:'请检查工作簿和工作表是否齐全。原始文件不会修改。',mergeVisible:false,
    action:s.previewAvailable?'previewConfirm':'previewRetry',label:s.previewAvailable?'我已看完预览':'重新打开清单预览'});
   if(phase==='select')Object.assign(result,{title:'选择清单',description:'选择或调整要整理的文件；已选文件会保留。',mergeVisible:false,
    action:s.files&&s.files.length?'previewResume':'import',label:s.files&&s.files.length?'查看已选清单预览':'选择清单文件'});
   result.backTarget=phase==='options'?{step:1,phase:'preview'}:phase==='preview'?{step:1,phase:'select'}:null;
  }else result.backTarget={step:result.step===8?(s.noInquiry?3:7):result.step-1};
  result.canBack=!!result.backTarget;
  if(s.busy){result.disabled=true;result.label=s.busyLabel||'正在处理，请稍候…';}
  result.progressStep=progress;
  return result;
 }
 function create(initial){
  var state=Object.assign({files:[],rows:0,mergedRows:0,expectedSheets:0,categoryCount:0,split:{planned:0,complete:0,failed:0,pending:0,needsVerification:0,files:[]}},initial||{});
  var actions=Object.create(null),listeners=[],running=null,serial=0,selectedStep=null,selectedImport=null;
  function snapshot(){return Object.assign({},state);}
  function currentView(){return view(state,selectedStep,selectedImport);}
  function emit(){listeners.slice().forEach(function(listener){listener(snapshot(),currentView());});}
  function set(patch){
   Object.assign(state,patch||{});
   if((selectedImport&&!state.files.length)||(selectedImport==='options'&&!state.previewReviewed)){selectedStep=null;selectedImport=null;}
   if(selectedStep>=progressView(state).step&&!selectedImport)selectedStep=null;
   emit();return snapshot();
  }
  function navigate(stage,allowBusy){
   var step=typeof stage==='string'?STAGES.indexOf(stage)+1:stage;
   if((state.busy&&allowBusy!==true)||!Number.isInteger(step)||step<1||step>7||step>progressView(state).step)return false;
   selectedStep=step<progressView(state).step?step:null;selectedImport=null;emit();return true;
  }
  function navigateImport(phase,allowBusy){
   if((state.busy&&allowBusy!==true)||['select','preview','options'].indexOf(phase)<0||!state.files.length)return false;
   selectedStep=1;selectedImport=phase;emit();return true;
  }
  function followProgress(){selectedStep=null;selectedImport=null;emit();}
  async function run(name){
   if(running)return {skipped:true};
   if(typeof actions[name]!=='function')throw Error('当前操作尚未就绪，请重新打开助手。');
   var id=++serial;running=id;set({busy:true});
   try{return await actions[name]();}finally{if(running===id){running=null;set({busy:false,busyLabel:''});}}
  }
  return {snapshot:snapshot,set:set,view:currentView,navigate:navigate,navigateImport:navigateImport,followProgress:followProgress,subscribe:function(listener){listeners.push(listener);listener(snapshot(),currentView());return function(){listeners=listeners.filter(function(item){return item!==listener;});};},
   register:function(name,action){actions[name]=action;},run:run,hasAction:function(name){return typeof actions[name]==='function';},STAGES:STAGES.slice(),LABELS:LABELS.slice()};
 }
 return {create:create,view:view,STAGES:STAGES,LABELS:LABELS};
}));
