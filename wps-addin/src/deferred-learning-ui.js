(function(){
 'use strict';
 function create(options){
  var host=document.createElement('section');host.id='learning-decision';host.className='card';host.hidden=true;
  var title=document.createElement('h2');title.textContent='是否保存本次分类习惯？';
  var note=document.createElement('p');note.textContent='保存本次全部已确认分类，供本机后续项目使用；相同材料和分类自动去重。';
  var status=document.createElement('p');status.id='learning-message';status.setAttribute('role','status');
  var save=document.createElement('button');save.id='learning-save';save.textContent='保存分类习惯';
  var skip=document.createElement('button');skip.id='learning-skip';skip.textContent='不保存';host.append(title,note,status,save,skip);document.querySelector('main').appendChild(host);
  var busy=false;
  async function request(route,data){var response=await fetch('/api/library/'+route,{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},body:JSON.stringify(data||{})}),result=await response.json();if(!response.ok)throw Error(result.error||'分类习惯未保存。');return result;}
  function render(){
   var project=options.projects.current(),review=options.projects.reviewConfirmation(),decision=options.projects.learningDecision();
   host.hidden=!project||!options.verdict().ready||!RfqDeferredLearning.pending(review,project.split,decision);
   save.disabled=skip.disabled=busy;if(!busy&&decision&&decision.status==='failed'){save.textContent='重试保存分类习惯';status.textContent=decision.error||'上次保存未完成；拆分成果已保留。';}
   else save.textContent='保存分类习惯';
  }
  async function decide(shouldSave){if(busy)return;var project=options.projects.current(),review=options.projects.reviewConfirmation();
   if(!project||!options.verdict().ready||!RfqDeferredLearning.pending(review,project.split,options.projects.learningDecision()))return;
   var identity=project.projectId,key=RfqDeferredLearning.key(review),projectRevision=project.revision,reviewInputKey=review.inputKey,reviewRevision=review.revision,reviewConfirmedAt=review.confirmedAt;busy=true;render();status.textContent=shouldSave?'正在保存分类习惯…':'正在记录不保存…';
   try{
    var summary=await request('window/summary'),receipt=await request(shouldSave?'learn-project':'skip-project',{expectedRevision:summary.revision,expectedProjectRevision:projectRevision,projectId:identity,reviewInputKey:reviewInputKey,reviewRevision:reviewRevision,reviewConfirmedAt:reviewConfirmedAt});
    if(options.projects.identity()!==identity||RfqDeferredLearning.key(options.projects.reviewConfirmation())!==key)throw Error('当前项目或确认版本已切换；原成果保留，请重开原项目核对学习决定。');
    var saved=await options.projects.commitLearning(RfqDeferredLearning.decide(review,shouldSave?'saved':'skipped',{libraryRevision:receipt?receipt.revision:null}));
    if(!saved)throw Error('分类学习决定尚未写入项目，可重试；已保存经验不会重复添加。');
    status.textContent=shouldSave?'分类习惯已保存。':'已记录不保存；项目与拆分成果保留。';
   }catch(error){status.textContent='拆分成果已保留；'+error.message;
    if(options.projects.identity()===identity&&RfqDeferredLearning.key(options.projects.reviewConfirmation())===key)
     await options.projects.commitLearning(RfqDeferredLearning.decide(review,'failed',{error:status.textContent}));
   }finally{busy=false;render();}
  }
  save.onclick=function(){decide(true);};skip.onclick=function(){decide(false);};return {render:render,decide:decide};
 }
 window.RfqDeferredLearningUI={create:create};
}());
