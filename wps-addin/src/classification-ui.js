(function(){
 'use strict';
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  var message=document.getElementById('classification-message'),progress=document.getElementById('classification-progress'),
    filter=document.getElementById('classification-filter'),list=document.getElementById('classification-list'),
    batch=document.getElementById('batch-confirm'),write=document.getElementById('write-classification');
  var library=null,state=RfqClassification.create(),groups=[],busy=false,selected={};
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function loadLibrary(){
   if(library)return Promise.resolve(library);
   return fetch('/rules/defaults.json').then(function(response){
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
   }).then(function(data){
    var check=RfqCategoryLibrary.validate(data);
    if(!check.ok)throw Error(check.errors.join('；'));
    library=data;return library;
   }).catch(function(error){
    library={version:'unavailable',categories:[],rules:[]};
    tell('分类库未加载，只能手工选类别：'+error.message,true);
    return library;
   });
  }
  function suggestionFor(group){return RfqClassify.suggest({name:group.name,feature:group.feature,unit:group.unit},library,{});}
  function decide(rowId,row,groupId){
   var value=document.querySelector('[data-category="'+groupId+'"]');
   var categoryId=value&&value.value;
   if(!categoryId){tell('请先为第'+(Number(groupId)+1)+'行选择类别，或标记“无需询价”。',true);return;}
   var category=RfqCategoryLibrary.category(library,categoryId),candidate=row.suggestion.candidates.filter(function(item){
    return item.categoryId===categoryId;})[0];
   state=RfqClassification.setDecision(state,rowId,{categoryId:categoryId,categoryName:category?category.name:categoryId,
    skip:categoryId==='no-inquiry',matchLevel:candidate?candidate.matchLevel:'none',ruleId:candidate?candidate.ruleId:null,
    basis:candidate?candidate.basis:'人工选择',libraryVersion:library.version});
   tell('已确认第'+(Number(groupId)+1)+'行：'+(category?category.name:categoryId)+'。');
   render();
  }
  function render(){
   list.textContent='';
   var rows=groups.map(function(group){return {group:group,rowId:group.id||group.scopeId,suggestion:suggestionFor(group)};});
   var summary=RfqClassification.summary(state,rows.map(function(row){
    return {rowId:row.rowId,name:row.group.name,conflicts:row.suggestion.conflicts};}));
   progress.textContent='共 '+summary.total+' 行 · 已确认 '+summary.confirmed+' · 剩余 '+summary.remaining
     +(summary.conflicts.length?' · 冲突 '+summary.conflicts.length:'');
   var mode=filter.value;
   rows.forEach(function(row,index){
    var decided=RfqClassification.decisionFor(state,row.rowId),conflict=row.suggestion.conflicts.length>1;
    if(mode==='pending'&&decided)return;
    if(mode==='conflict'&&!conflict&&row.suggestion.matchLevel!=='none')return;
    var li=node('li'),label=node('label','选择','merge-option'),box=document.createElement('input');
    box.type='checkbox';box.checked=!!selected[row.rowId];box.setAttribute('data-select',String(index));
    box.addEventListener('change',function(){selected[row.rowId]=box.checked;});
    label.insertBefore(box,label.firstChild);li.appendChild(label);
    li.appendChild(node('strong',row.group.name||'名称待补'));
    li.appendChild(node('p','工程量 '+(row.group.quantity==null?'待核对':row.group.quantity)+' '+row.group.unit
      +(row.group.sourceLabels&&row.group.sourceLabels.length?' · '+row.group.sourceLabels.join('；'):''),'quantity'));
    var suggestion=row.suggestion.candidates.length
      ? row.suggestion.candidates.map(function(item){return item.categoryName+'（'+(item.matchLevel==='exact'?'完全匹配':'相近匹配')+'，依据：'+(item.basis||'规则')+'）';}).join(' / ')
      : '无可靠匹配，请人工选择类别或“无需询价”';
    li.appendChild(node('p','建议：'+suggestion,'note'));
    if(conflict)li.appendChild(node('p','多候选冲突，必须人工确认。','review-note'));
    var select=document.createElement('select');select.setAttribute('data-category',String(index));
    var placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='请选择类别';
    select.appendChild(placeholder);
    RfqCategoryLibrary.categories(library).forEach(function(category){
     var option=document.createElement('option');option.value=category.id;option.textContent=category.name;
     if(decided?decided.categoryId===category.id:(row.suggestion.candidates.length===1&&row.suggestion.candidates[0].categoryId===category.id))
      option.selected=true;
     select.appendChild(option);
    });
    li.appendChild(select);
    var confirm=node('button',decided?'改选并重新确认':'确认本行分类','locate');confirm.type='button';
    confirm.addEventListener('click',function(){decide(row.rowId,row,String(index));});li.appendChild(confirm);
    if(decided){
     var revoke=node('button','撤销确认','locate');revoke.type='button';
     revoke.addEventListener('click',function(){state=RfqClassification.removeDecision(state,row.rowId);
      tell('已撤销第'+(index+1)+'行的分类确认，后续生成重新阻断。');render();});
     li.appendChild(revoke);
     li.appendChild(node('p','已确认：'+decided.categoryName+'（'+(RfqClassification.LEVELS[decided.matchLevel]||'无可靠匹配')+'）','confirmed-note'));
    }
    list.appendChild(li);
   });
   if(!rows.length)list.appendChild(node('li','先在上方导入清单，再核对分类。','empty'));
   write.textContent='写入'+(options.mergeIdentical&&options.mergeIdentical()===true?'合并清单':'工作副本');
   write.disabled=busy||!options.application||!summary.canGenerateBrandTable;
  }
  function batchConfirm(){
   var applied=0,skipped=[];
   var rows=groups.map(function(group,index){return {group:group,index:index,rowId:group.id||group.scopeId,suggestion:suggestionFor(group)};});
   rows.forEach(function(row){
    if(!selected[row.rowId])return;
    if(RfqClassification.decisionFor(state,row.rowId))return;
    var candidate=row.suggestion.candidates.length===1?row.suggestion.candidates[0]:null;
    if(!candidate||row.suggestion.conflicts.length>1){skipped.push(row.group.name||('第'+(row.index+1)+'行'));return;}
    var category=RfqCategoryLibrary.category(library,candidate.categoryId);
    state=RfqClassification.setDecision(state,row.rowId,{categoryId:candidate.categoryId,
     categoryName:category?category.name:candidate.categoryName,skip:candidate.categoryId==='no-inquiry',
     matchLevel:candidate.matchLevel,ruleId:candidate.ruleId,basis:candidate.basis,libraryVersion:library.version});
    applied++;
   });
   tell(applied?('已批量确认'+applied+'行。'+(skipped.length?'以下行需要人工选择：'+skipped.join('、'):''))
     :('没有可批量确认的行。'+(skipped.length?'需人工选择：'+skipped.join('、'):'请先勾选明确的单候选行。')),!applied);
   render();
  }
  async function writeCopy(){
   if(busy)return;
   var useMergedTable=options.mergeIdentical&&options.mergeIdentical()===true;
   try{
    var collection=options.getCollection();
    var planOptions={requireAll:true};
    if(useMergedTable){
     var model=RfqExportModel.build(collection,true);
     planOptions.merged=true;planOptions.sheet=model.sheets[0].name;planOptions.headerRow=1;
     planOptions.column=model.sheets[0].values[0].length+1;
    }
    var plan=RfqClassification.planColumn(state,groups,collection.entries,planOptions);
    var written=0,tables=plan.plans.length,mergeTarget=null;
    var plannedState=state,plannedGroups=groups;
    var merged=null;
    if(useMergedTable){
     merged=options.getMergedTarget&&options.getMergedTarget();
     if(!merged||merged.mode!=='merge-identical'||typeof merged.target!=='string'||
        !/^[a-f\d]{64}$/i.test(merged.sha256||'')||typeof merged.ticket!=='string')
      throw Error('请先在“另存内部清单”按合并模式另存，再写入分类列。');
    }
    busy=true;render();
    if(merged){
     var response=await fetch('/api/export/verify',{method:'POST',headers:{'content-type':'application/json',
      'x-rfq-import-token':window.__RFQ_IMPORT__.token},body:JSON.stringify({ticket:merged.ticket,target:merged.target,sha256:merged.sha256})});
     var checked=await response.json();
     if(!response.ok)throw Error(checked.error||'合并表校验失败，未写入。');
     if(checked.target!==merged.target||checked.sha256!==merged.sha256)throw Error('合并表校验回执不一致，未写入。');
    }
    if(state!==plannedState||groups!==plannedGroups||options.getCollection()!==collection||
       (options.mergeIdentical&&options.mergeIdentical()===true)!==useMergedTable)
     throw Error('核对内容或合并选择已变化，请重新检查后写入。');
    plan.plans.forEach(function(item){
     if(item.entryId==null){
      RfqProjectHost.appendColumn(options.application,{copyPath:merged.target,fingerprint:merged.sha256},item);
      written+=item.rows.length;
      mergeTarget=merged.target;
      return;
     }
     var entry=collection.entries.filter(function(candidate){return candidate.id===item.entryId;})[0];
     if(!entry)throw Error('找不到对应工作副本，未写入。');
     RfqProjectHost.appendColumn(options.application,entry.metadata,
      {sheet:item.sheet,headerRow:item.headerRow,column:item.column,header:item.header,rows:item.rows});
     written+=item.rows.length;
    });
    tell('已把'+written+'行分类写入'+tables+'张工作表'+(mergeTarget?('（合并表：'+mergeTarget+'）'):'（独立工作副本）')+'，原表和行序未改变。');
   }catch(error){
    if(written>0)tell('分类写入未全部完成：已完成'+written+'行，其余未完成。请检查已写入的工作副本。'+error.message,true);
    else tell('未写入'+(useMergedTable?'合并清单':'工作副本')+'。'+error.message,true);
   }
   finally{busy=false;render();}
  }
  filter.addEventListener('change',render);
  batch.addEventListener('click',batchConfirm);
  write.addEventListener('click',writeCopy);
  loadLibrary().then(render);
  return {refresh:function(result){groups=(result&&result.groups)||[];selected={};render();},
   classification:function(){return state;},
   snapshot:function(){return state;},
   restore:function(value){
    state=value&&value.schemaVersion===RfqClassification.SCHEMA_VERSION?value:RfqClassification.create();
    selected={};render();
   }};
 }
 window.RfqClassificationUI={create:create};
}());
