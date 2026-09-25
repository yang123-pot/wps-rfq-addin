(function(){
 'use strict';
 var FIELD_LABELS={name:'名称',feature:'项目特征',unit:'单位',text:'名称+特征'};
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function split(text){return String(text==null?'':text).split(/[，,、;；\s]+/).filter(function(keyword){return keyword.trim();});}
 function create(options){
  options=options||{};
  var message=document.getElementById('library-message'),status=document.getElementById('library-status'),
    saveButton=document.getElementById('library-save'),reloadButton=document.getElementById('library-reload'),
    addCategory=document.getElementById('library-add-category'),addRule=document.getElementById('library-add-rule'),
    categoryList=document.getElementById('library-categories'),ruleList=document.getElementById('library-rules'),
    memoryFilter=document.getElementById('library-memory-filter'),memoryList=document.getElementById('library-memories');
  var revision=0,draft=null,loaded=false,busy=false,dirty=false;
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function current(){return {revision:revision,library:draft.library,memory:draft.memory};}
  function changed(){dirty=true;render();}
  function request(action,data){
   var token=window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token;
   if(!token)return Promise.reject(Error('当前会话未启用本机分类库。'));
   return fetch('/api/library/'+action,{method:'POST',
    headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(data||{})})
    .then(function(response){return response.text().then(function(text){
     var result;try{result=JSON.parse(text);}catch(_){result={};}
     if(!response.ok){var error=Error(result.error||('分类库请求失败（HTTP '+response.status+'）。'));error.status=response.status;throw error;}
     return result;});});
  }
  function fieldSelect(value,onChange){
   var select=document.createElement('select');
   select.setAttribute('aria-label','条件字段');
   RfqCategoryLibrary.FIELDS.forEach(function(field){
    var option=document.createElement('option');option.value=field;option.textContent=FIELD_LABELS[field]||field;
    if(field===value)option.selected=true;select.appendChild(option);});
   select.addEventListener('change',function(){onChange(select.value);});
   return select;
  }
  function conditionRow(condition,owner,index,removable){
   var row=node('div','','condition-row');
   row.appendChild(fieldSelect(condition.field||'name',function(value){owner[index].field=value;changed();}));
   var input=document.createElement('input');
   input.setAttribute('aria-label','关键词');
   input.value=(condition.any||[]).join('、');
   input.placeholder='用、或空格分隔；清空即移除此条件';
   input.addEventListener('change',function(){
    var keywords=split(input.value);
    if(!keywords.length){owner.splice(index,1);changed();return;}
    owner[index].any=keywords;changed();});
   row.appendChild(input);
   if(removable){
    var remove=node('button','移除','locate');remove.type='button';
    remove.addEventListener('click',function(){owner.splice(index,1);changed();});
    row.appendChild(remove);
   }
   return row;
  }
  function renderCategories(){
   categoryList.textContent='';
   (draft.library.categories||[]).forEach(function(category){
    var li=node('li');li.setAttribute('data-category-id',category.id);
    var input=document.createElement('input');input.setAttribute('aria-label','类别名称');
    input.value=category.name;
    input.addEventListener('change',function(){
     if(!input.value.trim()){tell('类别名称不能为空，已恢复原名称。',true);input.value=category.name;return;}
     category.name=input.value.trim();changed();});
    li.appendChild(input);
    li.appendChild(node('p',category.id+(category.state==='disabled'?' · 已停用':' · 可推荐'),'source'));
    var toggle=node('button',category.state==='disabled'?'启用':'停用','locate');toggle.type='button';
    if(category.id===RfqCategoryLibrary.DECISION){
     toggle.disabled=true;toggle.title='“无需询价”是固定的人工决策入口，不能停用。';
    }else toggle.addEventListener('click',function(){
     category.state=category.state==='disabled'?'active':'disabled';changed();});
    li.appendChild(toggle);categoryList.appendChild(li);
   });
  }
  function renderRules(){
   ruleList.textContent='';
   (draft.library.rules||[]).forEach(function(rule){
    var li=node('li');li.setAttribute('data-rule-id',rule.id);
    var select=document.createElement('select');select.setAttribute('aria-label','规则类别');
    var placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='请选择类别';
    select.appendChild(placeholder);
    (draft.library.categories||[]).forEach(function(category){
     var option=document.createElement('option');option.value=category.id;option.textContent=category.name;
     if(category.id===rule.categoryId)option.selected=true;select.appendChild(option);});
    select.addEventListener('change',function(){rule.categoryId=select.value;changed();});
    li.appendChild(select);
    li.appendChild(node('p','匹配条件（全部命中才推荐）','card-label'));
    if(!Array.isArray(rule.match))rule.match=[];
    rule.match.forEach(function(condition,index){li.appendChild(conditionRow(condition,rule.match,index,true));});
    var addMatch=node('button','添加匹配条件','locate');addMatch.type='button';
    addMatch.addEventListener('click',function(){rule.match.push({field:'text',any:['新关键词']});changed();});
    li.appendChild(addMatch);
    li.appendChild(node('p','排除条件（命中任一项就不推荐）','card-label'));
    if(!Array.isArray(rule.exclude))rule.exclude=[];
    rule.exclude.forEach(function(condition,index){li.appendChild(conditionRow(condition,rule.exclude,index,true));});
    var addExclude=node('button','添加排除条件','locate');addExclude.type='button';
    addExclude.addEventListener('click',function(){rule.exclude.push({field:'feature',any:['排除词']});changed();});
    li.appendChild(addExclude);
    var alias=document.createElement('input');alias.setAttribute('aria-label','别名');
    alias.value=(RfqCategoryLibrary.aliases(rule)).join('、');alias.placeholder='别名，用、或空格分隔';
    alias.addEventListener('change',function(){rule.aliases=split(alias.value);changed();});
    li.appendChild(alias);
    var basis=document.createElement('input');basis.setAttribute('aria-label','依据');
    basis.value=rule.basis||'';basis.placeholder='依据说明，例如：用户已确认……';
    basis.addEventListener('change',function(){rule.basis=basis.value;changed();});
    li.appendChild(basis);
    var toggle=node('button',rule.state==='disabled'?'启用规则':'停用规则','locate');toggle.type='button';
    toggle.addEventListener('click',function(){rule.state=rule.state==='disabled'?'active':'disabled';changed();});
    li.appendChild(toggle);ruleList.appendChild(li);
   });
   if(!(draft.library.rules||[]).length)ruleList.appendChild(node('li','还没有规则，可点“新增规则”为某个类别补充关键词。','empty'));
  }
  function renderMemories(){
   memoryList.textContent='';
   var mode=memoryFilter.value,list=(draft.memory.memories||[]).filter(function(record){
    if(mode==='active')return record.state==='active';
    if(mode==='revoked')return record.state==='revoked';
    return true;});
   list.forEach(function(record){
    var li=node('li');li.setAttribute('data-memory-id',record.id);
    li.appendChild(node('strong',record.item&&record.item.name||'材料待补'));
    li.appendChild(node('p','类别 '+record.categoryName+'（'+record.categoryId+'） · '+
     (record.scope==='project'?'仅本项目':'本机通用')+' · '+(record.state==='active'?'有效':'已失效'),'source'));
    li.appendChild(node('p','确认来源 '+((record.sources||[]).length?record.sources.map(function(source){
     return (source.sourceProjectId||'未记录项目')+'/'+(source.sourceRowId||'未记录行');}).join('；'):'未记录')+
     ' · 确认时间 '+(record.learnedAt||'未记录'),'source'));
    if(record.state==='active'){
     var revoke=node('button','撤销这条记忆','locate');revoke.type='button';
     revoke.addEventListener('click',function(){draft.memory=RfqCategoryMemory.revoke(draft.memory,record.id);changed();});
     li.appendChild(revoke);
    }
    memoryList.appendChild(li);
   });
   if(!list.length)memoryList.appendChild(node('li','此范围没有记忆记录。','empty'));
  }
  function render(){
   if(!loaded){
    categoryList.textContent='';ruleList.textContent='';memoryList.textContent='';
    status.textContent='分类库未加载，请先点“重新加载”；加载前不会显示可编辑的类别或规则。';
    saveButton.disabled=true;
    return;
   }
   var summary=RfqCategoryMemory.summary(draft.memory);
   status.textContent='本机分类库版本 '+revision+' · 类别 '+(draft.library.categories||[]).length+' · 规则 '+
    (draft.library.rules||[]).length+' · 有效记忆 '+summary.active+(summary.revoked?' · 已失效 '+summary.revoked:'')+
    (dirty?' · 有未保存修改':'');
   saveButton.disabled=busy;
   renderCategories();renderRules();renderMemories();
  }
  function ensureDecision(library){
   if(!(library.categories||[]).some(function(category){return category.id===RfqCategoryLibrary.DECISION;}))
    library.categories=(library.categories||[]).concat([{id:RfqCategoryLibrary.DECISION,name:'无需询价',state:'active'}]);
  }
  function adopt(state){
   revision=Number.isSafeInteger(state.revision)?state.revision:0;
   draft={library:copy(state.library),memory:copy(state.memory)};
   ensureDecision(draft.library);
   loaded=true;dirty=false;
   if(options.onChange)options.onChange(current());
   render();
  }
  function load(keepDraft){
   if(busy)return;
   if(keepDraft&&dirty&&!window.confirm('重新加载会丢弃本页未保存的分类库修改，是否继续？'))return;
   busy=true;tell('正在读取本机分类库…');render();
   request('load').then(function(state){
    if(!state||!state.library||!state.memory)throw Error('分类库返回不完整。');
    busy=false;adopt(state);
    tell('已读取本机分类库（版本 '+revision+'）。'+(state.persisted?'':'当前使用的是默认分类库。'));
   }).catch(function(error){
    busy=false;loaded=false;tell('分类库未加载，请重试：'+error.message,true);render();
   });
  }
  function save(){
   if(busy||!loaded)return;
   var check=RfqCategoryLibrary.validate(draft.library);
   if(!check.ok){tell('分类库校验未通过，未保存：'+check.errors.join('；'),true);return;}
   var memoryCheck=RfqCategoryMemory.validate(draft.memory);
   if(!memoryCheck.ok){tell('习惯记忆校验未通过，未保存：'+memoryCheck.errors.join('；'),true);return;}
   busy=true;tell('正在保存分类库…');render();
   request('save',{expectedRevision:revision,library:draft.library,memory:draft.memory}).then(function(result){
    busy=false;revision=Number.isSafeInteger(result.revision)?result.revision:revision+1;dirty=false;
    if(options.onChange)options.onChange(current());
    render();tell('分类库已保存到本机（版本 '+revision+'）。未确认行的建议已按新库刷新，已确认行保留原决策。');
   }).catch(function(error){
    busy=false;render();
    tell(error.status===409?('分类库版本冲突：'+error.message+'请先点“重新加载”，本页草稿没有被覆盖。')
     :('分类库未保存，草稿保留在本页：'+error.message),true);
   });
  }
  function addCategoryRecord(){
   if(!loaded)return;
   draft.library.categories=(draft.library.categories||[]).concat([{id:RfqCategoryLibrary.newId(draft.library,'category'),
    name:'新类别',state:'active'}]);
   changed();tell('已新增类别，请修改名称后保存。');
  }
  function addRuleRecord(){
   if(!loaded)return;
   var first=(draft.library.categories||[])[0];
   draft.library.rules=(draft.library.rules||[]).concat([{id:RfqCategoryLibrary.newId(draft.library,'rule'),
    categoryId:first?first.id:'',match:[{field:'text',any:['新关键词']}],exclude:[],aliases:[],basis:'',state:'active'}]);
   changed();tell('已新增规则，请选择类别并填写关键词后保存。');
  }
  saveButton.addEventListener('click',save);
  reloadButton.addEventListener('click',function(){load(true);});
  addCategory.addEventListener('click',addCategoryRecord);
  addRule.addEventListener('click',addRuleRecord);
  memoryFilter.addEventListener('change',render);
  render();
  var api={load:function(){load(false);},current:current,adopt:adopt};
  api.adoptMemory=function(state){
   if(!loaded)return;
   if(Number.isSafeInteger(state&&state.revision))revision=state.revision;
   if(state&&state.memory)draft.memory=copy(state.memory);
   render();
  };
  load(false);
  return api;
 }
 window.RfqLibraryUI={create:create};
}());
