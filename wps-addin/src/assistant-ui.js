(function(){
 'use strict';var store=window.RfqAssistant,home=document.getElementById('simple-home');if(!store||!home)return;
 var lastRenderKey='';
 function by(id){return document.getElementById(id);}
 function text(id,value){var n=by(id);if(n)n.textContent=value;}
 function render(s,v){
  text('simple-title',v.title);text('simple-desc',v.description);text('simple-progress-text',v.step===8?'全部完成':'第 '+v.step+' 步 / 共 7 步');
  text('simple-subtitle',s.projectName||'按提示一步一步做');
  home.dataset.step=String(v.step);home.classList.toggle('is-complete',v.step===8);
  var primary=by('simple-primary');primary.textContent=v.label;primary.disabled=!!v.disabled||!store.hasAction(v.action);
  by('simple-merge-choice').hidden=!v.mergeVisible;
  by('simple-duplicate-merge').checked=!!s.mergeIdentical;
  text('simple-merge-summary','整理前 '+s.rows+' 条 → 整理后 '+s.mergedRows+' 条');
  var nav=by('simple-seven-list');nav.textContent='';
  store.LABELS.forEach(function(label,index){var item=document.createElement('div');item.className='simple-seven-row'+(v.step===index+1?' current':'')+(v.step>index+1?' done':'');item.setAttribute('data-stage',store.STAGES[index]);
   var num=document.createElement('span');num.className='n';num.textContent=String(index+1);
   var name=document.createElement('span');name.className='label';name.textContent=label;item.appendChild(num);item.appendChild(name);nav.appendChild(item);});
  var tree=by('assistant-files');tree.hidden=v.step!==1||!s.files.length||v.importPhase==='options';tree.textContent='';
  if(!tree.hidden)s.files.forEach(function(file){var li=document.createElement('li'),name=document.createElement('strong');name.textContent=file.name;li.appendChild(name);(file.sheets||[]).forEach(function(sheet){var p=document.createElement('p');p.textContent=sheet;li.appendChild(p);});
   if(typeof file.remove==='function'){var remove=document.createElement('button');remove.type='button';remove.className='assistant-file-remove file-remove-action';remove.textContent='移除此文件';remove.onclick=function(){file.remove();};li.appendChild(remove);}tree.appendChild(li);});
  text('simple-result',v.busy?(s.busyLabel||'正在处理，请稍候…'):s.statusMessage||((v.step===1&&s.files.length&&!s.previewReviewed)?'已导入 '+s.files.length+' 本工作簿，共 '+s.rows+' 条材料。':''));
  by('simple-result').hidden=!by('simple-result').textContent;
  var fileNote=by('assistant-file-note');if(fileNote){var note=v.step===1&&s.files.length&&!s.previewReviewed?'原始文件不会修改。':v.step===5?'可再填写第三组品牌和供应商。':'';fileNote.textContent=note;fileNote.hidden=!note;}
  var changeFiles=by('assistant-change-files');if(changeFiles)changeFiles.hidden=!(v.step===1&&s.files.length&&v.importPhase!=='options');
  var header=by('header-section'),mount=by('assistant-header'),placeholder=by('assistant-header-origin');
  if(header&&mount&&placeholder){var inlineHeader=v.step===6&&!document.body.classList.contains('detail-mode');if(inlineHeader){if(header.parentNode!==mount)mount.appendChild(header);}else if(header.parentNode===mount)placeholder.after(header);mount.hidden=!inlineHeader;}
  var stats=by('assistant-stats'),statsText='',statsClass='assistant-stats';
  if(v.step===2){
   statsText='共 '+(s.mergedRows||0)+' 条材料\n有 '+(s.reviewPending==null?0:s.reviewPending)+' 处需要你填写\n接下来在表格中核对分类。';
  }else if(v.step===3){
   if(s.reviewPending===0){statsText='✓ '+(s.mergedRows||0)+' 条材料已填写完整';statsClass+=' is-success';}
   else if(s.reviewPending!=null){statsText='还有 '+s.reviewPending+' 处分类需要填写';statsClass+=' is-warning';}
  }else if(v.step===5){
   statsText=s.expectedSheets>0?'预计生成 '+s.expectedSheets+' 份询价文件':'预计份数将在读回汇总表后显示';
   statsClass+=' is-info';
  }
  stats.className=statsClass;stats.textContent=statsText;stats.hidden=!statsText;
  var dir=by('assistant-directory');dir.hidden=v.step!==7;text('assistant-directory-value',s.outputDirectory||'尚未选择文件夹');
  var files=by('assistant-output-files'),listed=(s.split&&s.split.files)||s.plannedSplitFiles||[];
  files.textContent='';files.hidden=v.step<7||!listed.length;files.className='assistant-output-files '+(v.step===8?'is-complete':'is-plan');
  if(!files.hidden)listed.forEach(function(file,index){var li=document.createElement('li');li.textContent=(v.step===8?'':file.state==='succeeded'?'✓ ':v.step===7?(index+1)+'. ':'')+(file.name||String(file.target||'').split(/[\\/]/).pop()||'询价文件');files.appendChild(li);});
  by('assistant-layout-row').hidden=true;
  by('assistant-layout').value=s.layout||'separated';
  by('assistant-new-project').hidden=v.step!==8;
  var back=by('simple-back');if(back){back.hidden=!v.canBack;back.disabled=!!v.busy;}
  var detailBack=by('workflow-back');if(detailBack)detailBack.disabled=!!v.busy;
  var importActive=document.querySelector('#workflow-nav .is-current[data-stage="import"]');
  if(importActive&&v.step===1){
   if(detailBack){detailBack.hidden=!v.canBack;detailBack.textContent='返回上一步';}
   var gate=by('preview-gate'),choice=by('merge-section');
   if(gate)gate.hidden=!s.files.length||v.importPhase!=='preview';
   if(choice)choice.hidden=!s.files.length||v.importPhase!=='options';
  }
  var saveReview=by('simple-save-review');if(saveReview)saveReview.hidden=v.step!==3;
  var key=[v.step,v.title,v.action,s.previewReviewed,s.reviewGenerated,s.reviewConfirmed,s.categoriesReady,s.summaryReady,s.brandsReady,s.inquiryReady,s.splitStarted,s.outputDirectory,s.splitVerified].join('|');
  if(key!==lastRenderKey){var scroll=document.querySelector('.assistant-scroll');if(scroll)scroll.scrollTop=0;lastRenderKey=key;}
 }
 by('simple-primary').onclick=async function(){var v=store.view();RfqFeedback.arm();RfqFeedback.clear();try{await store.run(v.action);}catch(e){RfqFeedback.tell(e.message,true);}finally{RfqFeedback.finish();}};
 by('assistant-change-files').onclick=function(){RfqFeedback.arm();store.run('import').catch(function(e){RfqFeedback.notify({message:e.message});});};
 by('simple-duplicate-merge').onchange=function(){var target=by('merge-identical');target.checked=this.checked;target.dispatchEvent(new Event('change',{bubbles:true}));};
 by('assistant-change-directory').onclick=function(){store.run('chooseDirectory').catch(function(e){RfqFeedback.notify({message:e.message});});};
 by('simple-back').onclick=function(){
  var step=store.view().step;
  if(store.view().canBack)document.dispatchEvent(new CustomEvent('rfq:simple-back',{detail:{step:step}}));
 };
 by('simple-save-review').onclick=function(){
  var save=by('sheet-review-save');
  if(save){store.set({statusMessage:'正在保存审核草稿…'});RfqFeedback.arm();save.click();}
 };
 by('assistant-layout').onchange=function(){var target=by('categories-layout');target.value=this.value;target.dispatchEvent(new Event('change',{bubbles:true}));};
 by('assistant-new-project').onclick=function(){store.run('newProject').catch(function(e){RfqFeedback.notify({message:e.message});});};
 store.subscribe(render);window.RfqAssistantUI={render:function(){render(store.snapshot(),store.view());}};
}());
