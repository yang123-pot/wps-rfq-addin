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
   detail:'一本分类工作簿，首页汇总，每类一页；明细10列，品牌/报价/金额留空。'},
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
  function renderSimple(){if(window.RfqAssistantUI)window.RfqAssistantUI.render();}
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
   if(stage==='project'||stage==='help'){if(stage==='project'){var aux=document.getElementById('aux-section');if(aux)aux.open=true;setViewMode('detail');document.getElementById('project-section').scrollIntoView({block:'start'});}else{closeSettings();setViewMode('home');if(simpleHelp){simpleHelp.textContent='按右侧主按钮逐步完成。需要保存、打开项目、选择布局或排查问题时使用设置。';simpleHelp.hidden=false;}}return true;}
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
  if(typeof location!=='undefined'&&/[?&]mode=detail(?:&|$)/.test(location.search||''))setViewMode('detail');
  if(simpleExampleLink)simpleExampleLink.onclick=function(){showSimpleHelp('选择清单→先看预览→确认整理方式→表内核对分类→汇总表填写品牌→填写抬头→拆分文件。每步完成后，下方主按钮会出现下一项操作。');};
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
