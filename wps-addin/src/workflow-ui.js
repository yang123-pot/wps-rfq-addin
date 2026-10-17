(function(){
 'use strict';
 // R3：主流程七步导航。步骤名与handoff第4.2节阶段一致，侧栏只显示当前阶段的说明、统计与操作。
 // 未实现阶段只给说明/状态/下一步，不提供侧栏逐行确认或品牌编辑入口。
 var STEPS=[
  {id:'import',label:'导入与合并',title:'01 导入后选择材料处理方式',owner:'R3',
   detail:'多个工作簿归入同一项目、生成同一份审核成果；默认按来源分别保留，选择“合并完全相同项”后才累加完全相同的材料。'},
  {id:'matching',label:'自动分类',title:'02 自动分类后生成审核成果表',owner:'R4',
   detail:'按已确认的合并选择调用分类库与习惯记忆给出建议，生成独立审核成果工作表；自动建议不等于人工确认。'},
  {id:'review',label:'表内审核',title:'03 在表格中修改，整表一次确认',owner:'R5',
   detail:'在成果表内直接修改“最终分类”“审核备注”，全部核对完成后整表一次确认；空分类或异常行定位到具体单元格。'},
  {id:'categories',label:'分类工作簿',title:'04 按审核结果生成独立分类工作簿',owner:'R6',
   detail:'每个询价类别一个独立xlsx，材料明细10列，品牌/报价单价/金额留空；无需询价行只留在审核成果中。'},
  {id:'brands',label:'品牌汇总',title:'05 分类汇总表内填写品牌与供应商',owner:'R7/R8',
   detail:'一类一行，名称带蓝色下划线超链接指向对应分类工作簿；在黄色区域填写1至3组品牌与供应商并选择询价生成方式。'},
  {id:'inquiry',label:'询价表',title:'06 品牌与供应商带入询价表',owner:'R9',
   detail:'按各类选定方式生成总询价工作簿：合成一份时材料行只出现一次，分别生成时每份含本类完整材料。'},
  {id:'split',label:'拆分文件',title:'07 一键拆分，输出可发送的询价文件',owner:'R10',
   detail:'每张询价表一个独立xlsx，已有文件不覆盖、失败可重试，逐份显示状态并保留分类簿与汇总表。'}
 ];
  var SIMPLE_LABELS=['选清单','核对分类','审核确认','分类工作簿','填品牌','生成询价表','拆分文件'];
 function node(tag,text,className){
  var element=document.createElement(tag);
  if(text!=null)element.textContent=text;
  if(className)element.className=className;
  return element;
 }
 function create(options){
  var config=options||{};
  var nav=document.getElementById('workflow-nav'),note=document.getElementById('workflow-note'),
    rowsCell=document.getElementById('workflow-rows'),mergedCell=document.getElementById('workflow-merged'),
    host=document.getElementById('workflow-stage-extra'),importPanel=document.getElementById('stage-panel-import');
  var simpleHome=document.getElementById('simple-home'),simpleSettings=document.getElementById('simple-settings'),
    simpleModeToggle=document.getElementById('simple-mode-toggle'),simpleSettingsToggle=document.getElementById('simple-settings-toggle'),
    simpleProgress=document.getElementById('simple-progress-text'),simpleBar=document.getElementById('simple-bar-fill'),
    simpleSevenList=document.getElementById('simple-seven-list'),simpleTitle=document.getElementById('simple-title'),
    simpleDesc=document.getElementById('simple-desc'),simpleExample=document.getElementById('simple-example'),
    simplePrimary=document.getElementById('simple-primary'),simpleExampleLink=document.getElementById('simple-example-link'),
    simpleMergeChoice=document.getElementById('simple-merge-choice'),simpleMergeSummary=document.getElementById('simple-merge-summary'),
    simpleMergeAll=document.getElementById('simple-merge-all'),
    simpleResult=document.getElementById('simple-result'),
    simpleGuide=document.getElementById('simple-guide'),simpleHelp=document.getElementById('simple-help');
  var simpleMergeRadios=simpleMergeChoice?simpleMergeChoice.querySelectorAll('input[name="simple-merge-mode"]'):[];
  var current='import',stats={files:0,rows:0,mergedRows:0},stageState={},panels={},buttons={},navigationWatch=null;
  var viewMode='home';
  if(!nav||!host||!importPanel)return null;
  function statsText(){
   if(rowsCell)rowsCell.textContent=String(stats.rows||0);
   if(mergedCell)mergedCell.textContent=String(stats.mergedRows||0);
  }
  function stateText(stage){
   var value=stageState[stage];
   if(value==='ready')return '已确认';
   if(value==='stale')return '已过期';
   return '未完成';
  }
  function splitComplete(){
   var status=document.getElementById('split-status');
   return !!status&&/完成\s*[1-9]\d*\s*·\s*失败\s*0\s*·\s*待处理\s*0/.test(status.textContent||'');
  }
  function syncFromProjectStatus(){
   var status=document.getElementById('project-status');
   if(!status)return;
   var text=status.textContent||'';
   var labels={import:'导入与合并',matching:'自动分类',review:'表内审核',categories:'分类工作簿',brands:'品牌汇总',inquiry:'询价表',split:'拆分文件'};
   Object.keys(labels).forEach(function(stage){
    var match=text.match(new RegExp(labels[stage]+'：(已确认|已过期|未完成)'));
    if(match)stageState[stage]=match[1]==='已确认'?'ready':match[1]==='已过期'?'stale':'missing';
   });
   renderSimple();
  }
  var simpleFlags={reviewOpened:false,summaryGenerated:false,brandsOpened:false,inquiryNext:false};
  function previewReady(){
   var section=document.getElementById('merge-section');
   return !!section&&!section.hidden;
  }
  function reviewGenerated(){
   var status=document.getElementById('classification-review-stats');
   var open=document.getElementById('classification-review-open');
   return !!(status&&/已写入成果表|已生成并校验/.test(status.textContent||''))||!!(open&&!open.disabled);
  }
  function summaryGenerated(){
   var open=document.getElementById('brands-open');
   return !!(open&&!open.disabled)||simpleFlags.summaryGenerated;
  }
  function splitDirectoryChosen(){
   var label=document.getElementById('split-directory-label');
   var text=label?String(label.textContent||'').trim():'';
   return !!text&&!/^尚未选择/.test(text);
  }
  function simpleStageIndex(){
   var step=1,currentSteps={import:1,matching:2,review:3,categories:4,brands:5,inquiry:6,split:7};
   if(stageState.split==='ready'||splitComplete())step=8;
   else if(stageState.inquiry==='ready')step=simpleFlags.inquiryNext?7:6;
   else if(stageState.brands==='ready')step=6;
   else if(stageState.categories==='ready')step=summaryGenerated()?5:4;
   else if(stageState.review==='ready')step=4;
   else if(stageState.matching==='ready'||simpleFlags.reviewOpened)step=simpleFlags.reviewOpened?3:2;
   return Math.max(step,currentSteps[current]||1);
  }
  function clickStageButton(stage,ids,after){
   if(stage)goTo(stage);
   setTimeout(function(){
    var list=Array.isArray(ids)?ids:[ids];
    for(var i=0;i<list.length;i++){
     var button=document.getElementById(list[i]);
     if(button&&!button.hidden&&!button.disabled){
      if(simpleResult){simpleResult.textContent='正在处理，请稍候…';simpleResult.hidden=false;}
      button.click();
      if(after)after();
      setTimeout(renderSimple,0);
      return;
     }
    }
    showSimpleHelp('这一步还不能操作，请先完成上一步，或点“详细步骤”查看原因。');
   },30);
  }
  function setViewMode(mode){
   viewMode=mode==='detail'?'detail':mode==='task'?'task':'home';
   if(document.body){
    document.body.classList.toggle('detail-mode',viewMode==='detail');
    document.body.classList.toggle('simple-task-mode',viewMode==='task');
   }
   if(simpleHome)simpleHome.hidden=viewMode!=='home';
   if(simpleSettings)simpleSettings.hidden=true;
   if(simpleModeToggle)simpleModeToggle.textContent=viewMode==='home'?'详细步骤':'简版';
   show();
   renderSimple();
  }
  function openDetail(stage){
   setViewMode('detail');
   if(stage)goTo(stage);
  }
  function openTask(stage){
   if(stage)goTo(stage);
   setViewMode('home');
  }
  function renderSimple(){
   if(!simpleHome)return;
   var step=simpleStageIndex(),title,desc,example,primary,action,linkText,resultText;
   if(step===1){
    if(stageState.import!=='ready'&&!stats.files){
     title='选清单';desc='把要询价的表格选进来。插件只读取副本，不会修改原件。';
     example='支持 .xls / .xlsx，一次可选多份；选完再确认怎么合并。';
     primary='选择清单文件';action=function(){clickStageButton('import',['import-files','browse-files']);};
    }else if(!previewReady()){
     title='预览导入内容';desc='先查看导入预览中的工作簿和工作表，确认没有漏选或重复。';
     example='当前只展示导入结构，尚未合并全部工作簿。';
     primary='我已看完预览，选择处理方式';action=function(){clickStageButton('import','preview-confirm');};
    }else if(stageState.matching!=='ready'){
     title='选清单';desc='所有工作簿已进入当前项目。确认材料处理方式后，进入自动分类和核对。';
     example='默认按工作簿分组保留来源；只有完全相同的材料才需要累加。';
     primary='确认材料处理方式，继续';action=function(){clickStageButton('import','confirm-merge');};
    }else{
     title='核对分类';desc='系统已生成建议。打开成果表，确认每一行属于哪一类。';
     example='有冲突或空分类的行会被标出来。';
     primary=reviewGenerated()?'打开成果表核对':'生成审核成果表';
     action=reviewGenerated()?function(){clickStageButton('matching','classification-review-open',function(){simpleFlags.reviewOpened=true;});}:function(){clickStageButton('matching','classification-review-generate');};
    }
   }else if(step===2){
    title='核对分类';desc='系统已生成建议。打开成果表，确认每一行属于哪一类。';
    example='有冲突或空分类的行会被标出来。';
    primary=reviewGenerated()?'打开成果表核对':'生成审核成果表';
    action=reviewGenerated()?function(){clickStageButton('matching','classification-review-open',function(){simpleFlags.reviewOpened=true;});}:function(){clickStageButton('matching','classification-review-generate');};
   }else if(step===3){
    title='审核确认';desc='检查最终分类和备注。整张表没有问题后，一次确认并生成分类工作簿。';
    example='确认前仍可修改；空分类或冲突会定位到具体单元格。';
    primary='确认并生成分类工作簿';action=function(){clickStageButton('review','sheet-review-confirm');};
   }else if(step===4){
    title='分类工作簿';desc='把同一类材料整理到一本工作簿。';
    example='第1页是汇总，后面每个类别一页。';
    if(stageState.categories!=='ready'){
     primary='生成分类工作簿';action=function(){clickStageButton('categories','categories-generate');};
    }else if(!summaryGenerated()){
     primary='生成分类汇总表';action=function(){clickStageButton('categories','categories-summary',function(){simpleFlags.summaryGenerated=true;});};
    }else{
     primary='下一步：填写品牌';action=function(){simpleFlags.summaryGenerated=true;goTo('brands');renderSimple();};
    }
   }else if(step===5){
    title='填写品牌和供应商';desc='在表格的黄色区域填写。每一类至少填一个品牌和一个供应商，填完保存。';
    example='例：水泵 → 品牌：青源；供应商：华川设备';
    if(!simpleFlags.brandsOpened){
     primary='打开品牌表';action=function(){clickStageButton('brands','brands-open',function(){simpleFlags.brandsOpened=true;});};
    }else{
     primary='填写完成，生成询价表';action=function(){clickStageButton('brands','brands-confirm');};
    }
   }else if(step===6){
    title='生成询价表';desc='按汇总表生成供应商询价表，报价单价和金额留空。';
    example='预计 5 份：水泵 2 份，阀门、风机、汽车充电桩各 1 份。';
    if(stageState.inquiry!=='ready'){
     primary='生成询价表';action=function(){clickStageButton('inquiry','inquiry-generate');};
    }else{
     primary='下一步：拆分供应商文件';action=function(){simpleFlags.inquiryNext=true;clickStageButton('inquiry','inquiry-next',function(){simpleFlags.inquiryNext=true;});};
    }
   }else if(step===7){
    title='拆分供应商文件';desc='每张询价页拆成一个独立文件，已有同名文件不会覆盖。';
    example='计划 5 份；失败的文件可以单独重试。';
    if(!splitDirectoryChosen()){
     primary='选择输出文件夹';action=function(){clickStageButton('split','split-directory');};
    }else{
     primary='一键拆分';action=function(){clickStageButton('split','split-run');};
    }
   }else{
    title='完成了';desc='供应商文件已生成，可以直接发给供应商。';
    example='文件已保存到输出文件夹。';
    primary='打开文件夹';action=function(){clickStageButton('split','split-open');};linkText='再做一单';
   }
   if(step===1)resultText=stats.files?(previewReady()?('已导入 '+stats.files+' 份清单，共 '+stats.rows+
     ' 项。请选择是否合并全部工作簿。'):('已导入 '+stats.files+' 份清单，共 '+stats.rows+' 项，预览已生成。')):'';
   else if(step===2)resultText=reviewGenerated()?'成果表已生成。下一步打开表格，核对分类。':'清单已确认。点下方按钮生成审核成果表。';
   else if(step===3)resultText='请在审核成果表中检查分类和备注，完成后点下方按钮。';
   else if(step===4)resultText=stageState.categories!=='ready'?'审核已确认。点下方按钮生成分类工作簿。':
    (!summaryGenerated()?'分类工作簿已生成。点下方按钮生成分类汇总表。':'分类汇总表已生成。下一步填写品牌和供应商。');
   else if(step===5)resultText=simpleFlags.brandsOpened?'填完品牌和供应商并保存后，点下方按钮继续。':'点下方按钮打开表格，在黄色区域填写。';
   else if(step===6)resultText=stageState.inquiry!=='ready'?'品牌已读回。点下方按钮生成询价表。':'询价表已生成。下一步拆分供应商文件。';
   else if(step===7)resultText=splitDirectoryChosen()?'文件夹已选好。点下方按钮开始拆分。':'先选择保存供应商文件的文件夹。';
   else resultText='供应商文件已生成。';
   if(simpleProgress)simpleProgress.textContent=step===8?'已完成':'第'+step+'步 / 共7步';
   if(simpleBar)simpleBar.style.width=(Math.min(step,7)/7*100)+'%';
   if(simpleTitle)simpleTitle.textContent=title;
   if(simpleDesc)simpleDesc.textContent=desc;
   var chooseMerge=step===1&&stats.files>0&&previewReady()&&stageState.matching!=='ready';
   if(simpleExample){simpleExample.textContent=example;simpleExample.hidden=chooseMerge;}
   if(simpleMergeChoice){
    simpleMergeChoice.hidden=!chooseMerge;
    var mergeChecked=!!(document.getElementById('merge-identical')&&document.getElementById('merge-identical').checked);
    Array.prototype.forEach.call(simpleMergeRadios,function(radio){
     radio.checked=radio.value===(mergeChecked?'merge':'separate');
    });
    var detailedSummary=document.getElementById('merge-summary');
    if(simpleMergeSummary)simpleMergeSummary.textContent=detailedSummary?detailedSummary.textContent:'';
    if(simpleMergeAll)simpleMergeAll.checked=!!(document.getElementById('merge-all-workbooks')&&document.getElementById('merge-all-workbooks').checked);
   }
   if(simpleResult){simpleResult.textContent=resultText||'';simpleResult.hidden=!resultText;}
   if(simplePrimary){simplePrimary.textContent=primary;simplePrimary.onclick=action;}
   if(simpleExampleLink){
    simpleExampleLink.hidden=false;
    simpleExampleLink.textContent=linkText||'不知道怎么填？看示例';
    simpleExampleLink.onclick=linkText?function(){if(confirm('开始一单新的材料整理？当前项目已保存。'))location.reload();}:function(){showSimpleHelp('先做当前这一步。需要保存、恢复、重试或查看技术信息时，点“设置”或“详细步骤”。');};
   }
   if(simpleSevenList){
    simpleSevenList.innerHTML='';
    STEPS.forEach(function(item,index){
     var n=index+1,row=document.createElement('div');
     row.className='simple-seven-row'+(step===8||n<step?' done':'')+(n===step?' current':'');
     row.setAttribute('data-stage',item.id);
     var num=document.createElement('span');num.className='n';num.textContent=(step===8||n<step)?'✓':String(n);
     var label=document.createElement('span');label.className='label';label.textContent=SIMPLE_LABELS[index]||item.label;
     var state=document.createElement('span');state.className='state';state.textContent=(step===8||n<step)?'已完成':(n===step?'当前':'未开始');
     row.appendChild(num);row.appendChild(label);row.appendChild(state);
     simpleSevenList.appendChild(row);
    });
   }
  }
  function showSimpleHelp(text){
   if(!simpleHelp)return;
   simpleHelp.textContent=text;
   simpleHelp.hidden=!simpleHelp.hidden;
  }
  function noteFor(step){
   if(step.id==='import'){
    if(!stats.files)return '尚未导入清单：请选择本机文件；插件只复制并读取副本，不会改动原件。';
    return '已成功导入 '+stats.files+' 个文件，共 '+stats.rows+' 行数据。请先查看导入预览，再选择是否合并全部工作簿。';
   }
   return step.detail;
  }
  function stepPanel(step){
   if(step.id==='import')return importPanel;
   if(panels[step.id])return panels[step.id];
   // 页面里已经声明过的阶段面板（例如R4的自动分类面板）直接复用，不再生成占位内容。
   var declared=document.getElementById('stage-panel-'+step.id);
   if(declared){panels[step.id]=declared;return declared;}
   var panel=node('section',null,'stage-panel');
   panel.id='stage-panel-'+step.id;
   panel.setAttribute('aria-label',step.title);
   panel.appendChild(node('h2',step.title));
   var info=node('div',null,'stage-info');
   info.appendChild(node('p',step.detail,'note'));
   info.appendChild(node('p','本阶段将在 '+step.owner+' 开发包实现；未完成前不提供侧栏逐行确认或品牌二次编辑。','note'));
   panel.appendChild(info);
   var status=node('p',null,'note stage-status');
   status.id='stage-status-'+step.id;
   panel.appendChild(status);
   host.appendChild(panel);
   panels[step.id]=panel;
   return panel;
  }
  function refreshStatus(){
   var status=document.getElementById('stage-status-'+current);
   if(status)status.textContent='当前状态：'+stateText(current)+'（按真实内容判定，未实现的阶段不会显示已确认）';
  }
  function show(){
   STEPS.forEach(function(step){
    var panel=stepPanel(step);
    panel.hidden=step.id!==current;
    var button=buttons[step.id];
    if(!button)return;
    button.classList.toggle('is-current',step.id===current);
    button.classList.toggle('is-done',stageState[step.id]==='ready'&&step.id!==current);
    button.setAttribute('aria-current',step.id===current?'step':'false');
   });
   if(viewMode==='task'){
    Array.prototype.forEach.call(document.querySelectorAll('.stage-panel'),function(panel){panel.classList.remove('simple-task-active');});
    var activePanel=stepPanel(STEPS.filter(function(item){return item.id===current;})[0]||STEPS[0]);
    if(activePanel)activePanel.classList.add('simple-task-active');
   }
   var step=STEPS.filter(function(item){return item.id===current;})[0]||STEPS[0];
   if(note)note.textContent=noteFor(step);
   statsText();
   refreshStatus();
   renderSimple();
  }
  function goTo(stage){
   if(!STEPS.some(function(item){return item.id===stage;}))return false;
   current=stage;
   show();
   var panel=stepPanel(STEPS.filter(function(item){return item.id===stage;})[0]);
   if(panel&&typeof panel.scrollIntoView==='function')panel.scrollIntoView({block:'start'});
   if(config&&typeof config.onStageChange==='function')config.onStageChange(stage);
   return true;
  }
  STEPS.forEach(function(step,index){
   var item=node('li',null,'workflow-step');
   item.setAttribute('data-stage',step.id);
   var button=node('button',null,'workflow-step-button');
   button.type='button';
   button.setAttribute('data-stage',step.id);
   button.setAttribute('title',step.title);
   button.appendChild(node('span',String(index+1),'workflow-step-number'));
   button.appendChild(node('span',step.label,'workflow-step-label'));
   button.addEventListener('click',function(){goTo(step.id);});
   item.appendChild(button);
   nav.appendChild(item);
   buttons[step.id]=button;
  });
  if(config.stageState)stageState=config.stageState;
  show();
  function openSettings(){
   if(viewMode!=='home')setViewMode('home');
   if(simpleHome)simpleHome.hidden=true;
   if(simpleSettings)simpleSettings.hidden=false;
  }
  function closeSettings(){
   if(simpleSettings)simpleSettings.hidden=true;
   if(simpleHome)simpleHome.hidden=viewMode!=='home';
  }
  if(simpleModeToggle)simpleModeToggle.addEventListener('click',function(){setViewMode(viewMode==='home'?'detail':'home');});
  if(simpleSettingsToggle)simpleSettingsToggle.addEventListener('click',openSettings);
  if(simpleSettings){
   var settingsClose=document.getElementById('simple-settings-close');
   if(settingsClose)settingsClose.addEventListener('click',closeSettings);
   Array.prototype.forEach.call(simpleSettings.querySelectorAll('[data-simple-section]'),function(button){
    button.addEventListener('click',function(){
     var id=button.getAttribute('data-simple-section');
     closeSettings();
     setViewMode('detail');
     var aux=document.getElementById('aux-section');if(aux)aux.open=true;
     var target=document.getElementById(id);if(target&&typeof target.scrollIntoView==='function')target.scrollIntoView({block:'start'});
    });
   });
   var helpSetting=document.getElementById('simple-help-setting');
   var settingHelp=document.getElementById('simple-setting-help');
   if(helpSetting&&settingHelp)helpSetting.addEventListener('click',function(){
    settingHelp.textContent='如果画面卡住：先保存项目，再点功能区“重建窗口”。项目、分类库和已生成文件都不会删除。需要逐步排查时，点“详细步骤”。';
    settingHelp.hidden=!settingHelp.hidden;
   });
   var detailLink=document.getElementById('simple-detail-link');
   if(detailLink)detailLink.addEventListener('click',function(){closeSettings();setViewMode('detail');});
  }
  if(simpleGuide)simpleGuide.addEventListener('click',function(){
   showSimpleHelp('七步：选清单、核对分类、审核确认、分类工作簿、填品牌、生成询价表、拆分文件。第一次只做当前这一步即可，遇到问题再打开右上角“设置”。');
  });
  Array.prototype.forEach.call(simpleMergeRadios,function(radio){
   radio.addEventListener('change',function(){
    if(!radio.checked)return;
    var target=document.getElementById(radio.value==='merge'?'merge-identical':'merge-separate');
    if(target&&!target.checked)target.click();
    renderSimple();
   });
  });
  if(simpleMergeAll)simpleMergeAll.addEventListener('change',function(){
   var target=document.getElementById('merge-all-workbooks');
   if(target&&target.checked!==simpleMergeAll.checked)target.click();
   else renderSimple();
  });
  var splitStatus=document.getElementById('split-status');
  if(splitStatus&&window.MutationObserver)new MutationObserver(renderSimple).observe(splitStatus,{childList:true,subtree:true,characterData:true});
  var splitDirectoryLabel=document.getElementById('split-directory-label');
  if(splitDirectoryLabel&&window.MutationObserver)new MutationObserver(renderSimple).observe(splitDirectoryLabel,{childList:true,subtree:true,characterData:true});
  ['classification-review-stats','classification-review-open','brands-open','categories-banner','sheet-review-banner','inquiry-banner'].forEach(function(id){
   var target=document.getElementById(id);
   if(target&&window.MutationObserver)new MutationObserver(renderSimple).observe(target,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});
  });
  var projectStatus=document.getElementById('project-status');
  if(projectStatus&&window.MutationObserver)new MutationObserver(syncFromProjectStatus).observe(projectStatus,{childList:true,subtree:true,characterData:true});
  if(document.addEventListener)document.addEventListener('rfq:project-status',syncFromProjectStatus);
  if(typeof location!=='undefined'&&/[?&]mode=detail(?:&|$)/.test(location.search||''))setViewMode('detail');
  renderSimple();
  var handle={goTo:goTo,current:function(){return current;},
   panel:function(stage){
    var found=STEPS.filter(function(item){return item.id===stage;})[0];
    return found?stepPanel(found):null;
   },
   setStats:function(values){
    var next=values||{};
    ['files','rows','mergedRows'].forEach(function(key){if(next[key]!=null)stats[key]=Number(next[key])||0;});
    if(current==='import'&&note)note.textContent=noteFor(STEPS[0]);
    statsText();
    renderSimple();
   },
   setStageState:function(values){
    if(!values)return;
    Object.keys(values).forEach(function(key){stageState[key]=values[key];});
    show();
   },
   refresh:show,
   // watch 会立即消费遗留请求；业务协调器准备好后才启动，避免 review 回调访问尚未赋值的项目句柄。
   startRibbonNavigation:function(){
    if(!navigationWatch&&window.RfqRibbonNavigation&&window.Application&&window.Application.PluginStorage){
     navigationWatch=window.RfqRibbonNavigation.watch(window.Application.PluginStorage,handle);
    }
    return navigationWatch;
   }};
  return handle;
 }
 window.RfqWorkflowUI={create:create,STEPS:STEPS};
}());
