(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  var saveButton=document.getElementById('save-project'),openButton=document.getElementById('open-project'),
    refreshButton=document.getElementById('refresh-projects'),message=document.getElementById('project-message'),
    status=document.getElementById('project-status'),list=document.getElementById('project-list');
  var current=null,busy=false,pendingId=null,lastReport=null;
  // R5：整表审核确认快照与草稿。只有确认快照存在（且inputKey仍是本次内容）才把“表内审核”置为已确认。
  var reviewConfirmation=null,reviewDraft=null,lastError=null;
  var STATE={ready:'已确认',stale:'已过期',missing:'未完成'};
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  // 未保存项目也要有稳定身份，本机分类习惯按它记录确认来源；保存或打开其他项目前不重新生成。
  function identity(){
    if(current&&current.projectId)return current.projectId;
    if(!pendingId)pendingId=RfqProject.newId();
    return pendingId;
  }
  function stageText(project){
    return RfqProject.STAGES.map(function(stage){
      var detail=lastReport&&lastReport[stage]?lastReport[stage].detail:'';
      return RfqProject.STAGE_LABELS[stage]+'：'+(STATE[RfqProject.stageState(project,stage)]||'未完成')+(detail?'（'+detail+'）':'');
    }).join(' · ');
  }
  function renderStatus(){
    if(!current){status.textContent='尚未保存项目记录。导入清单后可保存，重启WPS后再打开恢复。';return;}
    status.textContent='项目 '+current.projectId+' · 版本 '+current.revision+' · '+(current.mergeIdentical?'精确合并':'分别保留')+'\n'+stageText(current);
  }
  // 阶段只按当前真实内容判定：导入集合、来源问题、本次预览确认、逐行分类确认，以及后续阶段的明确结论。
  // R1过渡期：侧栏仍是旧的逐行分类/品牌/生成面板，这里把已有结论映射到v2的matching/review/brands/inquiry/split；
  // 分类工作簿（categories）等尚未实现的阶段一律保持未完成，绝不因旧数据误报完成。
  function classificationProgress(){
    var rows=options.getClassificationRows?options.getClassificationRows():[];
    var snapshot=options.getClassification?options.getClassification():null;
    var decided={};
    ((snapshot&&snapshot.decisions)||[]).forEach(function(decision){if(decision&&decision.rowId)decided[decision.rowId]=true;});
    var pending=rows.filter(function(row){return !row||!decided[row.rowId];}).length;
    return {rows:rows,pending:pending};
  }
  // 通过整表确认的行集合是“表内审核”的唯一依据；过渡期侧栏逐行确认不再代表该阶段完成。
  function reviewVerdict(){
    var confirmation=reviewConfirmation;
    if(confirmation&&Array.isArray(confirmation.rows)&&confirmation.rows.length)
      return {ready:true,detail:'整表已确认并保存快照（'+confirmation.rows.length+' 行）',rows:confirmation.rows};
    return {ready:false,detail:reviewDraft?('审核草稿已保存（'+reviewDraft.counts.filled+' / '+reviewDraft.counts.rows+' 行已填），尚未整表确认')
      :'尚未完成整表审核确认'};
  }
  function resolvedReviewVerdict(){
    var verdicts=options.getStageVerdicts?options.getStageVerdicts():null;
    return (verdicts&&verdicts.review)||reviewVerdict();
  }
  function assessmentInputs(){
    var progress=classificationProgress(),review=resolvedReviewVerdict();
    var verdicts=options.getStageVerdicts?options.getStageVerdicts():null;
    return {collection:options.getCollection(),mergeIdentical:options.mergeIdentical()===true,
      preview:options.getPreview?options.getPreview():null,
      mergeConfirmedKey:options.getMergeConfirmation?options.getMergeConfirmation():null,
      classification:options.getClassification?options.getClassification():null,
      rows:progress.rows,
      assignments:options.getAssignments?options.getAssignments():null,
      header:options.getHeader?options.getHeader():null,
      matching:(verdicts&&verdicts.matching)||(progress.rows.length?{ready:true,detail:'自动分类建议已生成，尚未人工确认'}
        :{ready:false,detail:'尚未生成自动分类建议'}),
      review:review,
      categories:(verdicts&&verdicts.categories)||{ready:false,detail:'分类工作簿将在下一个开发包生成'},
      brands:options.getBrandVerdict?options.getBrandVerdict():null,
      inquiry:options.getGenerationVerdict?options.getGenerationVerdict():null,
      split:options.getSplitVerdict?options.getSplitVerdict():null};
  }
  // 未来字段与项目一起保存；对应功能未接入时保持缺失，不拿空对象冒充已完成。
  // R1过渡期：旧侧栏的分类/品牌/生成面板仍沿用v1字段名暂存，R4–R9会替换为
  // matching/review/categories/brands/inquiry等v2对象；这些暂存字段不参与阶段判定。
  function collectFutureFields(project){
    project.mergeKey=options.getMergeConfirmation?options.getMergeConfirmation()||null:null;
    project.matching=options.getReviewBinding?options.getReviewBinding()||null:null;
    project.review=reviewConfirmation;
    project.reviewDraft=reviewDraft;
    project.categories=options.getCategories?options.getCategories()||null:null;
    project.summary=options.getSummary?options.getSummary()||null:null;
    project.classification=options.getClassification?options.getClassification():null;
    project.assignments=options.getAssignments?options.getAssignments():null;
    project.header=options.getHeader?options.getHeader():null;
    project.generation=options.getGeneration?options.getGeneration():null;
    project.split=options.getSplit?options.getSplit():null;
    return project;
  }
  function restoreFutureFields(project){
    if(options.restoreMergeConfirmation)options.restoreMergeConfirmation(project.mergeKey||null);
    if(options.restoreReviewBinding)options.restoreReviewBinding(project.matching||null);
    reviewConfirmation=project.review||null;
    reviewDraft=project.reviewDraft||null;
    if(options.restoreReviewConfirmation)options.restoreReviewConfirmation(reviewConfirmation);
    if(options.restoreReviewDraft)options.restoreReviewDraft(reviewDraft);
    if(options.restoreCategories)options.restoreCategories(project.categories||null);
    if(options.restoreSummary)options.restoreSummary(project.summary||null);
    if(options.restoreAssignments)options.restoreAssignments(project.assignments||null);
    if(options.restoreHeader)options.restoreHeader(project.header||null);
    if(options.restoreGeneration)options.restoreGeneration(project.generation||null);
    if(options.restoreSplit)options.restoreSplit(project.split||null);
  }
  function syncStages(project){
    lastReport=RfqProject.assess(assessmentInputs());
    return RfqProject.sync(project,lastReport);
  }
  async function request(action,data){
    var response=await fetch('/api/project/'+action,{method:'POST',
      headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},body:JSON.stringify(data)});
    var result=await response.json();
    if(!response.ok){var error=Error(result.error||'项目请求失败。');error.status=response.status;throw error;}
    return result;
  }
  async function listProjects(){
    try{
      var result=await request('list',{}),items=result.projects||[];
      list.textContent='';
      if(!items.length){list.appendChild(node('li','本机还没有已保存的项目。'));return items;}
      items.slice(0,20).forEach(function(item){
        var li=node('li');
        li.appendChild(node('strong',item.name));
        li.appendChild(node('p',item.projectId+' · 版本 '+item.revision+' · '+item.sourceCount+' 份来源','source'));
        var button=node('button','打开','locate');button.type='button';
        button.addEventListener('click',function(){openProject(item.projectId);});
        li.appendChild(button);list.appendChild(li);
      });
      return items;
    }catch(error){tell('读取项目列表失败。'+error.message,true);return [];}
  }
  // 保存项目记录：整表确认快照必须在这里先落盘，成功后才允许学习习惯。
  async function persist(){
    if(busy)return null;
    var collection=options.getCollection();
    if(!collection.entries.length){tell('请先导入清单，再保存项目。',true);return null;}
    busy=true;if(options.onBusy)options.onBusy(true);
    try{
      tell('正在保存项目记录…');
      var next=current?RfqProject.refresh(current,collection,options.mergeIdentical())
        :RfqProject.create(collection,options.mergeIdentical(),{projectId:identity()});
      next=collectFutureFields(next);
      next=syncStages(next);
      RfqProject.assertValid(next);
      var expectedRevision=current?current.revision:0;
      var receipt=await request('save',{project:next,expectedRevision:expectedRevision});
      current=Object.assign({},next,{revision:Number(receipt.revision)});
      pendingId=null;lastError=null;renderStatus();await listProjects();
      return receipt;
    }catch(error){
      lastError=error;
      if(error.status===409)tell('项目未被覆盖：该记录已被其他窗口保存。侧栏草稿保留，请重新打开最新记录后再保存。',true);
      else tell('项目未保存。'+error.message,true);
      return null;
    }
    finally{busy=false;if(options.onBusy)options.onBusy(false);}
  }
  async function saveProject(){
    var receipt=await persist();
    if(receipt)tell('项目已保存到本机：'+current.projectId+'（版本 '+current.revision+'）。项目记录不上传。');
    return receipt;
  }
  // R5两条写入路径：草稿只存进度，确认快照才代表“整表一次确认”，两者都按项目乐观锁落盘。
  async function commitReview(confirmation,extra){
    var input=extra||{};
    if(input.draft)reviewDraft=input.draft;
    if(confirmation)reviewConfirmation=confirmation;
    var receipt=await persist();
    if(receipt)tell('整表审核确认已保存到项目记录（版本 '+current.revision+'）。');
    return receipt;
  }
  async function commitReviewDraft(draft){
    if(draft)reviewDraft=draft;
    var receipt=await persist();
    if(receipt)tell('审核草稿已保存到项目记录（版本 '+current.revision+'），尚未确认。');
    return receipt;
  }
  async function openProject(projectId){
    if(busy)return false;
    busy=true;if(options.onBusy)options.onBusy(true);
    try{
      tell('正在打开项目记录…');
      var result=await request('load',{projectId:projectId});
      if(!result.project)throw Error('项目记录不存在或已被移除。');
      RfqProject.assertValid(result.project);
      var loaded=result.project,upgradedFrom=null;
      // v1原文件保留不动；用户选择继续时另存为v2副本，来源可验证复用，但必须重新整表确认。
      if(RfqProject.isLegacy(loaded)){
        var carried=RfqProject.upgradeV1(loaded,{});
        var receipt=await request('save',{project:carried,expectedRevision:0});
        carried.revision=Number(receipt.revision);
        upgradedFrom=loaded.projectId;loaded=carried;
      }
      var sources=loaded.sources||[],rebuilt=0,failed=[];
      for(var index=0;index<sources.length;index++){
        try{
          var copy=await request('restore-copy',{source:sources[index]});
          if(!copy||typeof copy.copyPath!=='string')throw Error('未返回工作副本路径。');
          if(copy.rebuilt)rebuilt++;
          sources[index].copyPath=copy.copyPath;
        }catch(error){failed.push((sources[index].originalName||sources[index].originalPath)+'：'+error.message);}
      }
      if(failed.length)throw Error('原件已变化或不可读取，旧进度不能沿用，请重新导入：'+failed.join('；'));
      if(!options.restore||options.restore(loaded)===false)throw Error('项目内容无法恢复到侧栏。');
      if(options.restoreClassification)options.restoreClassification(
        loaded.classification||(loaded.carried&&loaded.carried.classification)||null);
      restoreFutureFields(loaded);
      // 先按恢复后的合并确认键重算一次侧栏，再判阶段；否则会误判为“尚未生成自动分类建议”。
      if(options.afterRestore)options.afterRestore(loaded);
      current=syncStages(loaded);
      if(options.afterRestore)options.afterRestore(loaded);
      pendingId=null;
      renderStatus();
      var recomputed=JSON.stringify(current.stages)!==JSON.stringify(loaded.stages);
      tell('已恢复项目'+loaded.projectId+'（版本 '+loaded.revision+'）。'+(upgradedFrom?'旧版项目'+upgradedFrom+'已保留，本次继续写入v2副本，需重新确认合并与整表审核。':'')+
        (rebuilt?'已按原件SHA校验重建'+rebuilt+'份工作副本。':'工作副本完整。')+
        '原件不变，快照可用于继续核对。'+(recomputed?'阶段状态已按当前来源与确认内容重算，保存后写回项目记录。':''));
      return true;
    }catch(error){tell('项目未打开。'+error.message,true);return false;}
    finally{busy=false;if(options.onBusy)options.onBusy(false);}
  }
  saveButton.addEventListener('click',saveProject);
  openButton.addEventListener('click',listProjects);
  refreshButton.addEventListener('click',listProjects);
  renderStatus();
  return {refresh:renderStatus,current:function(){return current;},identity:identity,reload:listProjects,
   assessment:function(){return lastReport;},commitReview:commitReview,commitReviewDraft:commitReviewDraft,
   reviewConfirmation:function(){return reviewConfirmation;},reviewDraft:function(){return reviewDraft;},
   lastError:function(){return lastError;},save:saveProject};
 }
 window.RfqProjectUI={create:create};
}());
