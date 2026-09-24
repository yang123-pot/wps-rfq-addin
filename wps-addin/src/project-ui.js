(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  var saveButton=document.getElementById('save-project'),openButton=document.getElementById('open-project'),
    refreshButton=document.getElementById('refresh-projects'),message=document.getElementById('project-message'),
    status=document.getElementById('project-status'),list=document.getElementById('project-list');
  var current=null,busy=false;
  var STATE={ready:'已确认',stale:'已过期',missing:'未完成'};
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function stageText(project){
    return RfqProject.STAGES.map(function(stage){
      return RfqProject.STAGE_LABELS[stage]+'：'+(STATE[RfqProject.stageState(project,stage)]||'未完成');
    }).join(' · ');
  }
  function renderStatus(){
    if(!current){status.textContent='尚未保存项目记录。导入清单后可保存，重启WPS后再打开恢复。';return;}
    status.textContent='项目 '+current.projectId+' · 版本 '+current.revision+' · '+(current.mergeIdentical?'精确合并':'分别保留')+'\n'+stageText(current);
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
  async function saveProject(){
    if(busy)return null;
    var collection=options.getCollection();
    if(!collection.entries.length){tell('请先导入清单，再保存项目。',true);return null;}
    busy=true;if(options.onBusy)options.onBusy(true);
    try{
      tell('正在保存项目记录…');
      var next=current?RfqProject.refresh(current,collection,options.mergeIdentical()):RfqProject.create(collection,options.mergeIdentical());
      if(options.getClassification)next.classification=options.getClassification();
      RfqProject.assertValid(next);
      var receipt=await request('save',{project:next});
      current=next;renderStatus();await listProjects();
      tell('项目已保存到本机：'+next.projectId+'（版本 '+next.revision+'）。项目记录不上传。');
      return receipt;
    }catch(error){tell('项目未保存。'+error.message,true);return null;}
    finally{busy=false;if(options.onBusy)options.onBusy(false);}
  }
  async function openProject(projectId){
    if(busy)return false;
    busy=true;if(options.onBusy)options.onBusy(true);
    try{
      tell('正在打开项目记录…');
      var result=await request('load',{projectId:projectId});
      if(!result.project)throw Error('项目记录不存在或已被移除。');
      RfqProject.assertValid(result.project);
      var sources=result.project.sources||[],rebuilt=0,failed=[];
      for(var index=0;index<sources.length;index++){
        try{
          var copy=await request('restore-copy',{source:sources[index]});
          if(!copy||typeof copy.copyPath!=='string')throw Error('未返回工作副本路径。');
          if(copy.rebuilt)rebuilt++;
          sources[index].copyPath=copy.copyPath;
        }catch(error){failed.push((sources[index].originalName||sources[index].originalPath)+'：'+error.message);}
      }
      if(failed.length)throw Error('原件已变化或不可读取，旧进度不能沿用，请重新导入：'+failed.join('；'));
      if(!options.restore||options.restore(result.project)===false)throw Error('项目内容无法恢复到侧栏。');
      if(options.restoreClassification)options.restoreClassification(result.project.classification);
      current=result.project;renderStatus();
      tell('已恢复项目'+result.projectId+'（版本 '+result.project.revision+'）。'+(rebuilt?'已按原件SHA校验重建'+rebuilt+'份工作副本。':'工作副本完整。')+'原件不变，快照可用于继续核对。');
      return true;
    }catch(error){tell('项目未打开。'+error.message,true);return false;}
    finally{busy=false;if(options.onBusy)options.onBusy(false);}
  }
  saveButton.addEventListener('click',saveProject);
  openButton.addEventListener('click',listProjects);
  refreshButton.addEventListener('click',listProjects);
  renderStatus();
  return {refresh:renderStatus,current:function(){return current;},reload:listProjects};
 }
 window.RfqProjectUI={create:create};
}());
