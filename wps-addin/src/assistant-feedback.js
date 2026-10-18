(function(){
 'use strict';var active=null,armed=false,operation=0,priorFocus=null,reported=false,structured=false;
 function el(tag,text){var n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
 function close(){if(active){active.remove();active=null;}if(priorFocus&&document.contains(priorFocus))priorFocus.focus();priorFocus=null;}
 function updateSummary(input){
  var p=RfqAssistantProblems.describe(input),summary=document.getElementById('assistant-problem');
  if(summary){summary.hidden=false;summary.dataset.stage=input.stage||'';summary.textContent=p.title+'：'+p.message;}
  return p;
 }
 function notify(input){
  var p=updateSummary(input);
  if(!armed&&!input.force)return;
  reported=true;structured=!!(input.issues||input.resolve||input.location);priorFocus=priorFocus||document.activeElement;
  if(!active){active=el('div');active.className='assistant-overlay';active.setAttribute('role','alertdialog');active.setAttribute('aria-modal','true');active.setAttribute('aria-labelledby','assistant-error-title');active.setAttribute('aria-describedby','assistant-error-description');document.body.appendChild(active);}
  active.textContent='';var box=el('section');box.className='assistant-dialog';
  var title=el('h2','⚠ '+p.title);title.id='assistant-error-title';box.appendChild(title);
  var body=el('div');body.id='assistant-error-description';body.appendChild(el('p',p.message));
  if(p.location)body.appendChild(el('strong','位置：'+p.location));
  body.appendChild(el('p','处理方法：'+p.solution));
  if(p.issues.length>1){var list=el('ul');p.issues.slice(0,10).forEach(function(item){list.appendChild(el('li',(item.path||item.file||'')+' '+(item.sheet||'')+' '+(item.row?RfqAssistantProblems.column(item.column||1)+item.row:'')+' '+item.message));});body.appendChild(list);}
  box.appendChild(body);var details=el('details');details.appendChild(el('summary','查看详情'));details.appendChild(el('pre',p.details));box.appendChild(details);
  var row=el('div');row.className='assistant-dialog-actions';var cancel=el('button','暂不处理');cancel.type='button';cancel.className='locate';cancel.onclick=close;row.appendChild(cancel);
  if(typeof input.resolve==='function'){var fix=el('button',p.actionLabel);fix.type='button';fix.onclick=async function(){close();try{await input.resolve();}catch(e){notify({message:e.message,force:true});}};row.appendChild(fix);}
  else cancel.textContent='我知道了';box.appendChild(row);active.appendChild(box);row.lastChild.focus();
 }
 document.addEventListener('keydown',function(event){if(!active)return;if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){var nodes=active.querySelectorAll('button,summary'),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
 document.addEventListener('click',function(event){if(event.target.closest('button')&&!event.target.closest('.assistant-overlay')){armed=true;operation++;reported=false;structured=false;priorFocus=null;}},true);
 window.RfqFeedback={notify:notify,updateSummary:updateSummary,close:close,reported:function(){return reported;},arm:function(){armed=true;reported=false;structured=false;operation++;priorFocus=null;return operation;},finish:function(){armed=false;},
  clear:function(stage){var summary=document.getElementById('assistant-problem');if(summary&&(!stage||summary.dataset.stage===stage)){summary.hidden=true;summary.textContent='';}},
  tell:function(message,error,stage){if(error&&!structured)notify({message:message,stage:stage});}};
}());
