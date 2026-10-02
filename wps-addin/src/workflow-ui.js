(function(){
 'use strict';
 // R3：主流程七步导航。步骤名与handoff第4.2节阶段一致，侧栏只显示当前阶段的说明、统计与操作。
 // 未实现阶段只给说明/状态/下一步，不提供侧栏逐行确认或品牌编辑入口。
 var STEPS=[
  {id:'import',label:'导入与合并',title:'01 导入后先选择是否合并',owner:'R3',
   detail:'导入成功先展示文件与行数，默认“分别保留清单”；选择“合并完全相同项”后才更新精确预览，确认后再进入自动分类。'},
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
  var current='import',stats={files:0,rows:0,mergedRows:0},stageState={},panels={},buttons={};
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
  function noteFor(step){
   if(step.id==='import'){
    if(!stats.files)return '尚未导入清单：请选择本机文件；插件只复制并读取副本，不会改动原件。';
    return '已成功导入 '+stats.files+' 个文件，共 '+stats.rows+' 行数据。请先选择是否合并完全相同项，确认后再进行自动分类。';
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
   var step=STEPS.filter(function(item){return item.id===current;})[0]||STEPS[0];
   if(note)note.textContent=noteFor(step);
   statsText();
   refreshStatus();
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
   },
   setStageState:function(values){
    if(!values)return;
    Object.keys(values).forEach(function(key){stageState[key]=values[key];});
    show();
   },
   refresh:show};
  // R12-K：功能区阶段快捷入口只导航。导航请求写在共享的 Application.PluginStorage 上，这里每个请求只消费一次；
  // 未打开时留待本次启动消费，已打开时靠低频“导航请求检查”接力（不重载页面，也不触发确认/学习/写表/拆分）。
  if(window.RfqRibbonNavigation&&window.Application&&window.Application.PluginStorage){
   window.RfqRibbonNavigation.watch(window.Application.PluginStorage,handle);
  }
  return handle;
 }
 window.RfqWorkflowUI={create:create,STEPS:STEPS};
}());
