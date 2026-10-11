(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  var saveButton=document.getElementById('save-project'),openButton=document.getElementById('open-project'),
    refreshButton=document.getElementById('refresh-projects'),message=document.getElementById('project-message'),
    status=document.getElementById('project-status'),list=document.getElementById('project-list'),
    relocateButton=document.getElementById('relocate-project');
  var current=null,busy=false,pendingId=null,lastReport=null;
  // R5：整表审核确认快照与草稿。只有确认快照存在（且inputKey仍是本次内容）才把“表内审核”置为已确认。
  var reviewConfirmation=null,reviewDraft=null,lastError=null;
  var restoreBlocks={},restoreAudit=null,restoreRecord=null;
  var STATE={ready:'已确认',stale:'已过期',missing:'未完成'};
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function bindingSnapshot(stage){
   try{
    if(stage==='review')return {matching:options.getReviewBinding?options.getReviewBinding():null,
      review:reviewConfirmation,reviewDraft:reviewDraft};
    if(stage==='categories')return options.getCategories?options.getCategories():null;
    if(stage==='brands')return {summary:options.getSummary?options.getSummary():null,
      brands:options.getBrands?options.getBrands():null};
    if(stage==='inquiry')return options.getGeneration?options.getGeneration():null;
    if(stage==='split')return options.getSplit?options.getSplit():null;
   }catch(_){return null;}
   return null;
  }
  function blockDetail(stage){
   var block=restoreBlocks[stage];
   if(!block)return null;
   if(block.fingerprint!==JSON.stringify(bindingSnapshot(stage))){delete restoreBlocks[stage];return null;}
   return block.detail;
  }
  function gated(stage,verdict){var detail=blockDetail(stage);return detail?{ready:false,detail:detail}:verdict;}
  function applyRestoreAudit(project,audit){
   restoreAudit=audit||null;restoreRecord=project||null;restoreBlocks={};
   ((audit&&audit.blocks)?Object.keys(audit.blocks):[]).forEach(function(stage){
    restoreBlocks[stage]={detail:audit.blocks[stage],fingerprint:JSON.stringify(bindingSnapshot(stage))};
   });
   if(relocateButton)relocateButton.hidden=!(audit&&audit.relocatable);
  }
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
    if(restoreAudit&&restoreAudit.issues.length)
      status.textContent+='\n恢复核对：'+restoreAudit.issues.slice(0,3).map(function(issue){return issue.message;}).join('；')+
        (restoreAudit.issues.length>3?'；其余'+(restoreAudit.issues.length-3)+'项请重新定位或重做对应阶段':'');
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
    var matching=(verdicts&&verdicts.matching)||(progress.rows.length?{ready:true,detail:'自动分类建议已生成，尚未人工确认'}
      :{ready:false,detail:'尚未生成自动分类建议'});
    return {collection:options.getCollection(),mergeIdentical:options.mergeIdentical()===true,
      preview:options.getPreview?options.getPreview():null,
      mergeConfirmedKey:options.getMergeConfirmation?options.getMergeConfirmation():null,
      classification:options.getClassification?options.getClassification():null,
      rows:progress.rows,
      assignments:options.getAssignments?options.getAssignments():null,
      header:options.getHeader?options.getHeader():null,
      matching:matching,
      review:gated('review',review),
      categories:gated('categories',(verdicts&&verdicts.categories)||{ready:false,detail:'分类工作簿将在下一个开发包生成'}),
      brands:gated('brands',options.getBrandVerdict?options.getBrandVerdict():null),
      inquiry:gated('inquiry',options.getGenerationVerdict?options.getGenerationVerdict():null),
      split:gated('split',options.getSplitVerdict?options.getSplitVerdict():null)};
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
    project.brands=options.getBrands?options.getBrands()||null:null;
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
    if(options.restoreBrands)options.restoreBrands(project.brands||null);
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
  async function serviceRequest(route,data){
    var response=await fetch(route,{method:'POST',
      headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},body:JSON.stringify(data||{})});
    var result=await response.json();
    if(!response.ok){var error=Error(result.error||'恢复核对请求失败。');error.status=response.status;throw error;}
    return result;
  }
  async function inspectFile(path){
    try{return await serviceRequest('/api/export/inspect',{target:path});}
    catch(error){return {target:path,exists:false,sha256:null,error:error.message};}
  }
  async function auditRestore(project){
    var list=RfqProjectRestore&&RfqProjectRestore.requirements?RfqProjectRestore.requirements(project):[],checks={};
    for(var index=0;index<list.length;index++){
      var item=list[index],actual=await inspectFile(item.path);
      checks[item.path]={exists:actual.exists===true,sha256:actual.sha256||null,error:actual.error||null};
      // R12-C：审核成果表要在SHA之外核对业务内容。优先读同路径已打开簿（保留未保存修改）；
      // 读不到只保留SHA核对，不阻断打开，也不把读不到解释成“内容已一致”。
      if(item.stage==='review'&&actual.exists===true&&options.compareReviewContent){
        try{
          var content=await options.compareReviewContent(project);
          if(content)checks[item.path].content=content;
        }catch(error){/* 读不到成果表时仅按SHA核对 */}
      }
    }
    var audit=RfqProjectRestore.audit(project,checks);
    applyRestoreAudit(project,audit);
    return audit;
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
    var previousConfirmation=reviewConfirmation,previousDraft=reviewDraft;
    if(input.draft)reviewDraft=input.draft;
    if(confirmation)reviewConfirmation=confirmation;
    var receipt=await persist();
    if(!receipt){reviewConfirmation=previousConfirmation;reviewDraft=previousDraft;return null;}
    tell('整表审核确认已保存到项目记录（版本 '+current.revision+'）。');
    return receipt;
  }
  async function commitReviewDraft(draft){
    var previousDraft=reviewDraft;
    if(draft)reviewDraft=draft;
    var receipt=await persist();
    if(!receipt){reviewDraft=previousDraft;return null;}
    tell('审核草稿已保存到项目记录（版本 '+current.revision+'），尚未确认。');
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
      var audit=await auditRestore(loaded);
      // R12-C：业务内容与确认快照一致、仅另存/格式/排序造成SHA变化时不判外部改写，而是刷新物理校验。
      // F2：只有写回成功才算刷新；失败（409/写错误）时内存SHA与版本一起回滚，不改持久绑定语义。
      var physicalRefreshed=0,physicalRefreshFailed=null;
      if(audit.ok&&audit.physicalRefresh&&audit.physicalRefresh.length&&loaded.matching){
        var applied=[];
        audit.physicalRefresh.forEach(function(entry){
          if(entry.stage!=='review')return;
          applied.push(loaded.matching.sha256);
          loaded.matching.sha256=entry.sha256;
        });
        try{
          var syncReceipt=await request('save',{project:loaded,expectedRevision:loaded.revision});
          loaded.revision=Number(syncReceipt.revision);physicalRefreshed=audit.physicalRefresh.length;
        }catch(error){
          applied.forEach(function(previous){loaded.matching.sha256=previous;});
          physicalRefreshFailed=error;
        }
      }
      // 先按恢复后的合并确认键重算一次侧栏，再判阶段；否则会误判为“尚未生成自动分类建议”。
      if(options.afterRestore)options.afterRestore(loaded);
      current=syncStages(loaded);
      if(options.afterRestore)options.afterRestore(loaded);
      pendingId=null;
      renderStatus();
      var recomputed=JSON.stringify(current.stages)!==JSON.stringify(loaded.stages);
      tell('已恢复项目'+loaded.projectId+'（版本 '+loaded.revision+'）。'+(upgradedFrom?'旧版项目'+upgradedFrom+'已保留，本次继续写入v2副本，需重新确认合并与整表审核。':'')+
        (rebuilt?'已按原件SHA校验重建'+rebuilt+'份工作副本。':'工作副本完整。')+
        (audit.ok?'各阶段持久文件已核对。':'有'+audit.issues.length+'项持久文件未核对通过，未恢复为已完成；缺失文件可尝试“重新定位项目文件”。')+
        (physicalRefreshed?'审核成果表仅另存/格式变化，业务内容与已保存审核内容一致，物理校验已更新。':'')+
        (physicalRefreshFailed?('审核成果表仅另存/格式变化，业务内容与已保存审核内容一致，但物理校验未写回项目记录（'+
          physicalRefreshFailed.message+'）：已保存的物理校验与内容原样保留，请重试（重新打开项目或保存项目）。'):'')+
        '原件不变，快照可用于继续核对。'+(recomputed?'阶段状态已按当前来源与确认内容重算，保存后写回项目记录。':''),
        !audit.ok||!!physicalRefreshFailed);
      return true;
    }catch(error){tell('项目未打开。'+error.message,true);return false;}
    finally{busy=false;if(options.onBusy)options.onBusy(false);}
  }
  async function relocateProject(){
    if(busy||!restoreRecord||!restoreAudit||!restoreAudit.relocatable)return;
    if(!window.RfqPathPicker){tell('当前侧栏不支持目录选择，请重新打开侧栏。',true);return;}
    var fromRoot=restoreAudit.commonRoot;
    RfqPathPicker.open({mode:'directory',startPath:fromRoot,title:'选择搬移后的项目根目录',
      confirmLabel:'核验并重新定位',
      onConfirm:async function(paths){
        var target=paths&&paths[0];
        if(!target)return;
        busy=true;if(options.onBusy)options.onBusy(true);
        try{
          var relocated=RfqProjectRestore.relocate(restoreRecord,{fromRoot:fromRoot,toRoot:target});
          var audit=await auditRestore(relocated);
          if(!audit.ok)throw Error('重新定位后仍有文件未核对通过：'+audit.issues.map(function(issue){return issue.message;}).join('；'));
          var receipt=await request('save',{project:relocated,expectedRevision:restoreRecord.revision});
          relocated.revision=Number(receipt.revision);
          if(!options.restore||options.restore(relocated)===false)throw Error('项目内容无法恢复到侧栏。');
          if(options.restoreClassification)options.restoreClassification(
            relocated.classification||(relocated.carried&&relocated.carried.classification)||null);
          restoreFutureFields(relocated);
          restoreRecord=relocated;restoreAudit=audit;restoreBlocks={};
          if(relocateButton)relocateButton.hidden=true;
          if(options.afterRestore)options.afterRestore(relocated);
          current=syncStages(relocated);
          if(options.afterRestore)options.afterRestore(relocated);
          pendingId=null;renderStatus();
          tell('项目文件已重新定位并逐项核对通过：'+target+'。');
        }catch(error){tell('重新定位未完成：'+error.message,true);}
        finally{busy=false;if(options.onBusy)options.onBusy(false);}
      },
      onError:function(text){tell(text,true);}});
  }
  saveButton.addEventListener('click',saveProject);
  openButton.addEventListener('click',listProjects);
  refreshButton.addEventListener('click',listProjects);
  if(relocateButton)relocateButton.addEventListener('click',relocateProject);
  renderStatus();
  return {refresh:renderStatus,current:function(){return current;},identity:identity,reload:listProjects,
   assessment:function(){return lastReport;},commitReview:commitReview,commitReviewDraft:commitReviewDraft,
   reviewConfirmation:function(){return reviewConfirmation;},reviewDraft:function(){return reviewDraft;},
   lastError:function(){return lastError;},save:saveProject,open:openProject,
   restoreAudit:function(){return restoreAudit;}};
 }
 window.RfqProjectUI={create:create};
}());
