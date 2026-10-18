(function(){
 'use strict';var store=window.RfqAssistant,home=document.getElementById('simple-home');if(!store||!home)return;
 function by(id){return document.getElementById(id);}
 function text(id,value){var n=by(id);if(n)n.textContent=value;}
 function render(s,v){
  text('simple-title',v.title);text('simple-desc',v.description);text('simple-progress-text',v.step===8?'全部完成':'第 '+v.step+' 步 / 共 7 步');
  var primary=by('simple-primary');primary.textContent=v.label;primary.disabled=!!v.disabled||!store.hasAction(v.action);
  by('simple-merge-choice').hidden=!v.mergeVisible;
  by('simple-merge-all').checked=!!s.mergeAll;
  by('simple-duplicate-merge').checked=!!s.mergeIdentical;
  text('simple-merge-summary','整理前 '+s.rows+' 条 → 整理后 '+s.mergedRows+' 条');
  var nav=by('simple-seven-list');nav.textContent='';
  store.LABELS.forEach(function(label,index){var item=document.createElement('div');item.className='simple-seven-row'+(v.step===index+1?' current':'')+(v.step>index+1?' done':'');item.setAttribute('data-stage',store.STAGES[index]);
   var num=document.createElement('span');num.className='n';num.textContent=v.step>index+1?'✓':String(index+1);
   var name=document.createElement('span');name.className='label';name.textContent=label;item.appendChild(num);item.appendChild(name);nav.appendChild(item);});
  var tree=by('assistant-files');tree.hidden=v.step!==1||!s.files.length;tree.textContent='';
  if(!tree.hidden)s.files.forEach(function(file){var li=document.createElement('li'),name=document.createElement('strong');name.textContent=file.name;li.appendChild(name);(file.sheets||[]).forEach(function(sheet){var p=document.createElement('p');p.textContent='▧ '+sheet;li.appendChild(p);});tree.appendChild(li);});
  text('simple-result',v.busy?(s.busyLabel||'正在处理，请稍候…'):s.statusMessage||((v.step===1&&s.files.length)?'已导入 '+s.files.length+' 本工作簿，共 '+s.rows+' 条材料。':''));
  by('simple-result').hidden=!by('simple-result').textContent;
  var header=by('header-section'),mount=by('assistant-header'),placeholder=by('assistant-header-origin');
  if(header&&mount&&placeholder){var inlineHeader=v.step===6&&!document.body.classList.contains('detail-mode');if(inlineHeader){if(header.parentNode!==mount)mount.appendChild(header);}else if(header.parentNode===mount)placeholder.after(header);mount.hidden=!inlineHeader;}
  var stats=by('assistant-stats');stats.hidden=!(v.step>=2&&v.step<=7);
  stats.textContent=v.step===2&&s.reviewPending!=null?'还有 '+s.reviewPending+' 处分类需要核对':v.step===5?'预计生成 '+s.expectedSheets+' 份询价文件':v.step===7&&s.split?'计划 '+s.split.planned+' · 完成 '+s.split.complete+' · 失败 '+s.split.failed+' · 待核对 '+s.split.needsVerification:'';
  stats.hidden=!stats.textContent;
  var dir=by('assistant-directory');dir.hidden=v.step!==7;text('assistant-directory-value',s.outputDirectory||'尚未选择文件夹');
  var files=by('assistant-output-files');files.textContent='';files.hidden=v.step<7;
  if(!files.hidden)(s.split&&s.split.files||[]).forEach(function(file){var li=document.createElement('li');li.textContent=(file.state==='succeeded'?'✓ ':file.state==='failed'?'⚠ ':'○ ')+(file.name||String(file.target||'').split(/[\\/]/).pop()||'询价文件');files.appendChild(li);});
  by('assistant-change-files').hidden=v.step!==1||!s.files.length;
  by('assistant-layout-row').hidden=v.step!==4;
  by('assistant-layout').value=s.layout||'separated';
  by('assistant-new-project').hidden=v.step!==8;
 }
 by('simple-primary').onclick=async function(){var v=store.view();RfqFeedback.arm();RfqFeedback.clear();try{await store.run(v.action);}catch(e){RfqFeedback.tell(e.message,true);}finally{RfqFeedback.finish();}};
 by('assistant-change-files').onclick=function(){RfqFeedback.arm();store.run('import').catch(function(e){RfqFeedback.notify({message:e.message});});};
 by('simple-duplicate-merge').onchange=function(){var target=by('merge-identical');target.checked=this.checked;target.dispatchEvent(new Event('change',{bubbles:true}));};
 by('assistant-change-directory').onclick=function(){store.run('chooseDirectory').catch(function(e){RfqFeedback.notify({message:e.message});});};
 by('assistant-layout').onchange=function(){var target=by('categories-layout');target.value=this.value;target.dispatchEvent(new Event('change',{bubbles:true}));};
 by('assistant-new-project').onclick=function(){store.run('newProject').catch(function(e){RfqFeedback.notify({message:e.message});});};
 store.subscribe(render);window.RfqAssistantUI={render:function(){render(store.snapshot(),store.view());}};
}());
