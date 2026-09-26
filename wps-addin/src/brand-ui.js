(function(){
 'use strict';
 var FIELDS=[{key:'brand',label:'品牌'},{key:'supplier',label:'供应商'},{key:'note',label:'备注'}];
 function node(tag,text,className){var element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
 function create(options){
  options=options||{};
  var message=document.getElementById('brand-message'),status=document.getElementById('brand-status'),
    generateButton=document.getElementById('brand-generate'),readButton=document.getElementById('brand-read'),
    coverage=document.getElementById('brand-coverage'),categoryList=document.getElementById('brand-categories'),
    preview=document.getElementById('brand-preview'),previewList=document.getElementById('brand-preview-list'),
    confirmReadButton=document.getElementById('brand-confirm-read'),cancelReadButton=document.getElementById('brand-cancel-read');
  var data=null,pending=null,busy=false;
  function tell(text,error){message.textContent=text;message.className=error?'error':'';}
  function context(){return options.context?options.context():null;}
  function requiredIds(ctx){return ctx&&ctx.preview?RfqBrandTable.requiredRowIds(ctx.preview.groups,ctx.classification):[];}
  function report(){var ctx=context();return ctx&&ctx.preview?RfqProject.assess(ctx):null;}
  function sync(){
   var ctx=context();
   if(!ctx||!ctx.preview){data=null;return;}
   var current=report();
   if(!current||!current.classification.ready)return;
   if(data&&data.inputKey===current.brandKey)return;
   var rebuilt=!!data;
   try{
    data=RfqBrandTable.build(ctx.preview.groups,ctx.classification,current.brandKey);
    if(rebuilt)tell('来源或分类已变化，品牌行已按当前清单重建；请重新填写或读取品牌表。');
   }catch(error){data=null;tell(error.message,true);}
  }
  function fieldInput(assignment,key){
   var input=document.createElement('input');
   input.setAttribute('aria-label',key==='brand'?'品牌':key==='supplier'?'供应商':'备注');
   input.value=assignment[key]==null?'':String(assignment[key]);
   input.addEventListener('change',function(){assignment[key]=input.value;render();});
   return input;
  }
  function assignmentRow(category,assignment){
   var li=node('li');li.setAttribute('data-assignment-id',assignment.assignmentId);
   li.appendChild(node('p',assignment.assignmentId+' · 覆盖 '+assignment.rowIds.length+' 个材料行','source'));
   FIELDS.forEach(function(field){
    var label=node('label',field.label);label.appendChild(fieldInput(assignment,field.key));li.appendChild(label);
   });
   var rows=node('div','','brand-rows');
   brandRows(category).forEach(function(row){
    var label=node('label','','brand-row');
    var box=document.createElement('input');box.type='checkbox';
    box.checked=assignment.rowIds.indexOf(row.rowId)>=0;
    box.setAttribute('aria-label','材料');
    box.addEventListener('change',function(){
     assignment.rowIds=box.checked?assignment.rowIds.concat([row.rowId]):
      assignment.rowIds.filter(function(rowId){return rowId!==row.rowId;});
     render();});
    label.appendChild(box);
    label.appendChild(node('span',row.name+(row.feature?'（'+row.feature+'）':'')+' · '+row.quantity+' '+row.unit));
    rows.appendChild(label);
   });
   li.appendChild(node('p','本行覆盖的材料','card-label'));
   li.appendChild(rows);
   var remove=node('button','删除本行','locate');remove.type='button';
   remove.addEventListener('click',function(){
    data.assignments=data.assignments.filter(function(item){return item.assignmentId!==assignment.assignmentId;});
    render();});
   li.appendChild(remove);
   return li;
  }
  function brandRows(category){return RfqBrandTable.rowsOf(data,category.rowIds);}
  function coverageText(category){
   var covered={};
   RfqBrandTable.assignmentsFor(data,category.categoryId).forEach(function(assignment){
    assignment.rowIds.forEach(function(rowId){covered[rowId]=(covered[rowId]||0)+1;});});
   var missing=category.rowIds.filter(function(rowId){return !covered[rowId];});
   return '共 '+category.count+' 个材料条目 · 未覆盖 '+missing.length+' 行';
  }
  function render(){
   var ctx=context(),current=report();
   preview.hidden=!pending;
   if(!data){
    status.textContent=current&&current.classification.ready?'尚未建立品牌行：请新增品牌行并选择覆盖的材料。'
     :'先完成导入、来源核对、合并预览确认与全部分类确认，再建立品牌表。';
    categoryList.textContent='';generateButton.disabled=true;readButton.disabled=true;return;
   }
   coverage.value=data.coverageMode;
   var covered={},duplicated=0;
   data.assignments.forEach(function(assignment){
    assignment.rowIds.forEach(function(rowId){covered[rowId]=(covered[rowId]||0)+1;});
    if(assignment.rowIds.length!==(new Set(assignment.rowIds)).size)duplicated++;
   });
   var missing=RfqBrandTable.requiredRowIds(ctx&&ctx.preview?ctx.preview.groups:[],ctx&&ctx.classification).filter(function(rowId){return !covered[rowId];});
   var structure=RfqBrandTable.validate(data,requiredIds(ctx),RfqBrandTable.STRUCTURE);
   var complete=RfqBrandTable.validateBrands(data,requiredIds(ctx));
   status.textContent='类别 '+RfqBrandTable.categories(data).length+' · 品牌行 '+data.assignments.length+
    ' · 未覆盖材料 '+missing.length+(duplicated?' · 重复引用 '+duplicated:'')+
    (data.binding?(data.binding.inputKey===current.brandKey?' · 品牌表已生成：'+data.binding.path:' · 品牌表已过期，需要重新生成'):' · 尚未生成分类品牌表')+
    (structure.ok?'':' · 结构未通过：'+structure.errors.slice(0,2).join('；'))+
    (complete.ok?' · 品牌已填写完整':' · 还需完成：'+complete.errors.slice(0,2).join('；'));
   generateButton.disabled=busy||!options.application||!structure.ok;
   readButton.disabled=busy||!options.application||!data.binding;
   categoryList.textContent='';
   RfqBrandTable.categories(data).forEach(function(category){
    var li=node('li');li.setAttribute('data-category-id',category.categoryId);
    li.appendChild(node('strong',category.categoryName+'（'+category.count+' 个材料条目）'));
    li.appendChild(node('p',coverageText(category),'source'));
    var list=node('ul','','brand-assignments');
    RfqBrandTable.assignmentsFor(data,category.categoryId).forEach(function(assignment){
     list.appendChild(assignmentRow(category,assignment));});
    if(!RfqBrandTable.assignmentsFor(data,category.categoryId).length)
     list.appendChild(node('li','还没有品牌行。','empty'));
    li.appendChild(list);
    var add=node('button','新增品牌行','locate');add.type='button';
    add.addEventListener('click',function(){
     var uncovered=category.rowIds.filter(function(rowId){return !covered[rowId];});
     data.assignments=data.assignments.concat([RfqBrandTable.createAssignment(data,category.categoryId,
      uncovered.length?uncovered:category.rowIds.slice())]);
     render();});
    li.appendChild(add);
    categoryList.appendChild(li);
   });
   if(!RfqBrandTable.categories(data).length)
    categoryList.appendChild(node('li','当前清单全部标记为“无需询价”，无需生成品牌表；项目状态可以保存。','empty'));
  }
  function requests(action,payload){
   var token=window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.token;
   if(!token)return Promise.reject(Error('当前会话未启用品牌表生成，请启动最新开发服务并重新打开侧栏。'));
   return fetch('/api/export/'+action,{method:'POST',
    headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(payload||{})})
    .then(function(response){return response.text().then(function(text){
     var result;try{result=JSON.parse(text);}catch(_){result={};}
     if(!response.ok){var error=Error(result.error||'品牌表请求失败。');error.status=response.status;throw error;}
     return result;});});
  }
  async function generate(){
   if(busy||!data)return;
   var ctx=context(),structure=RfqBrandTable.validate(data,requiredIds(ctx),RfqBrandTable.STRUCTURE);
   if(!structure.ok){tell('品牌表结构还不能生成：'+structure.errors.join('；'),true);return;}
   var workbook,target,prepared=null;
   try{
    workbook=RfqBrandModel.buildWorkbook(data,new Date().toISOString());
   }catch(error){tell(error.message,true);return;}
   target=RfqBrandHost.selectTarget(options.application,'分类品牌表_'+data.assignments.length+'行.xlsx');
   if(!target){tell('已取消生成，原品牌表未改动。');return;}
   try{
    busy=true;if(options.onBusy)options.onBusy(true);render();
    tell('正在准备新文件…');
    prepared=await requests('prepare',{target:target});
    if(!prepared||typeof prepared.ticket!=='string'||typeof prepared.stagePath!=='string'||typeof prepared.target!=='string')
     throw Error('品牌表会话信息不完整，未写入。');
    tell('正在写入并重新打开校验…');
    await new Promise(function(resolve){setTimeout(resolve,0);});
    await RfqBrandHost.write(options.application,workbook,prepared.stagePath);
    tell('正在保存到所选位置…');
    var result;
    try{result=await requests('commit',{ticket:prepared.ticket});}
    catch(error){if(error.status&&error.status<500)throw error;result=await requests('commit',{ticket:prepared.ticket});}
    if(!result||result.target!==prepared.target||!/^[a-f\d]{64}$/i.test(result.sha256))
     throw Error('未取得有效保存回执，请检查目标文件。');
    data.binding=RfqBrandModel.bindingFor(result.target,workbook);
    data.binding.sha256=result.sha256;
    tell('分类品牌表已生成：'+result.target+'。请在WPS里只填写品牌、供应商、备注，然后回到这里点“读取并核对品牌表”。');
   }catch(error){tell('品牌表未确认成功。'+error.message+(prepared?' 请检查目标位置：'+prepared.target:''),true);}
   finally{busy=false;if(options.onBusy)options.onBusy(false);render();}
  }
  async function readBack(){
   if(busy||!data||!data.binding)return;
   try{
    busy=true;if(options.onBusy)options.onBusy(true);render();
    tell('正在按分配标识读取品牌表…');
    await new Promise(function(resolve){setTimeout(resolve,0);});
    var result=RfqBrandHost.read(options.application,data.binding);
    var changes=[];
    data.assignments.forEach(function(assignment){
     var found=result.assignments.filter(function(item){return item.assignmentId===assignment.assignmentId;})[0];
     if(!found)return;
     FIELDS.forEach(function(field){
      var before=assignment[field.key]==null?'':String(assignment[field.key]);
      if(before===found[field.key])return;
      changes.push({assignmentId:assignment.assignmentId,field:field,
       text:assignment.assignmentId+' '+field.label+'：“'+before+'”→“'+found[field.key]+'”'});
     });
    });
    pending={read:result,changes:changes};
    previewList.textContent='';
    if(!changes.length)previewList.appendChild(node('li','读取成功，品牌、供应商、备注没有变化。','empty'));
    changes.forEach(function(change){previewList.appendChild(node('li',change.text));});
    tell('品牌表读取成功（'+result.assignments.length+' 行）。请核对下方预览后确认写入项目。');
   }catch(error){pending=null;tell('品牌表未读取成功。'+error.message,true);}
   finally{busy=false;if(options.onBusy)options.onBusy(false);render();}
  }
  function confirmRead(){
   if(!pending||!data)return;
   try{
    data=RfqBrandModel.apply(data,pending.read);
    pending=null;render();
    tell('已按品牌表更新项目；如之后修改来源或分类，旧品牌表会标记过期。');
    if(options.onChange)options.onChange();
   }catch(error){tell('品牌表未写入项目。'+error.message,true);}
  }
  coverage.addEventListener('change',function(){
   if(!data)return;
   try{
    data=RfqBrandTable.setCoverageMode(data,coverage.value);
    tell('已把同类别多品牌口径设为：'+(RfqBrandTable.COVERAGE_LABELS[data.coverageMode]||data.coverageMode)+
     '。范围确认仍需在品牌与抬头确认页完成。');
   }catch(error){tell(error.message,true);}
   render();
  });
  generateButton.addEventListener('click',generate);
  // C4：品牌参考表只用于查看既有品牌写法，不改变分类结果，也不覆盖已填品牌。
  var referenceButton=document.getElementById('brand-reference'),referenceBlock=document.getElementById('reference-block'),
    referenceSheet=document.getElementById('reference-sheet'),referenceHeaderRow=document.getElementById('reference-header-row'),
    referenceCategory=document.getElementById('reference-category-column'),referenceBrand=document.getElementById('reference-brand-column'),
    referenceNote=document.getElementById('reference-note-column'),referenceParse=document.getElementById('reference-parse'),
    referenceClose=document.getElementById('reference-close'),referenceSearch=document.getElementById('reference-search'),
    referenceMessage=document.getElementById('reference-message'),referenceList=document.getElementById('reference-list');
  var referenceSnapshot=null,referenceParsed=null;
  function referenceTell(text,error){if(!referenceMessage)return;referenceMessage.textContent=text;referenceMessage.className=error?'error':'';}
  function fillColumns(){
   if(!referenceSnapshot)return;
   var mapping={sheet:referenceSheet.value,headerRow:Number(referenceHeaderRow.value)||1};
   var header=[];
   try{header=RfqBrandReference.headerOf(referenceSnapshot,mapping);}catch(_){header=[];}
   [referenceCategory,referenceBrand,referenceNote].forEach(function(select,position){
    if(!select)return;
    var previous=select.value;
    select.textContent='';
    if(position===2){
     var none=document.createElement('option');none.value='';none.textContent='（不使用）';select.appendChild(none);
    }
    header.forEach(function(item){
     var option=document.createElement('option');option.value=String(item.column);
     option.textContent=item.column+' · '+(item.label||'（空表头）');select.appendChild(option);
    });
    select.value=previous&&select.querySelector('option[value="'+previous+'"]')?previous:'';
   });
   if(referenceCategory&&!referenceCategory.value&&referenceCategory.options.length)referenceCategory.selectedIndex=0;
   if(referenceBrand&&!referenceBrand.value&&referenceBrand.options.length>1)referenceBrand.selectedIndex=referenceBrand.options.length>1?1:0;
  }
  function listReference(){
   if(!referenceList)return;
   referenceList.textContent='';
   if(!referenceParsed){referenceList.appendChild(node('li','还没有解析结果，请选择列映射后点“解析并查看”。','empty'));return;}
   var rows=RfqBrandReference.search(referenceParsed,referenceSearch?referenceSearch.value:'');
   rows.slice(0,80).forEach(function(row){
    var li=node('li');li.setAttribute('data-reference-row',String(row.sheetRow));
    li.appendChild(node('strong',row.category));
    li.appendChild(node('p','品牌 '+(row.brand||'（空）')+' · 备注 '+(row.note||'（空）')+' · 原表第'+row.sheetRow+'行','source'));
    referenceList.appendChild(li);
   });
   if(!rows.length)referenceList.appendChild(node('li','没有匹配的参考行。','empty'));
   else if(rows.length>80)referenceList.appendChild(node('li','只显示前80行，共'+rows.length+'行，可用搜索缩小范围。','note'));
  }
  if(referenceButton)referenceButton.addEventListener('click',function(){
   try{
    var app=options.application;
    if(!app)throw Error('请在WPS里连接后再导入品牌参考表。');
    var selected=app.GetOpenFilename('品牌参考表 (*.xls;*.xlsx),*.xls;*.xlsx',1,'选择品牌参考表（只读查看，不改原件）',null,false);
    if(selected===false||selected===null||selected===''){referenceTell('已取消选择，未读取任何文件。');return;}
    if(typeof selected!=='string'||!/\.xlsx?$/i.test(selected))throw Error('请选择xls或xlsx文件。');
    referenceSnapshot=RfqBrandReference.read(app,selected);
    referenceParsed=null;
    if(referenceSheet){
     referenceSheet.textContent='';
     RfqBrandReference.sheetNames(referenceSnapshot).forEach(function(name){
      var option=document.createElement('option');option.value=name;option.textContent=name;referenceSheet.appendChild(option);});
    }
    if(referenceHeaderRow)referenceHeaderRow.value='1';
    referenceBlock.hidden=false;
    fillColumns();
    referenceTell('已只读读取“'+referenceSnapshot.name+'”（'+referenceSnapshot.sheets.length+'张表）。请选择列映射后解析；原文件没有被修改。');
    listReference();
   }catch(error){referenceTell('品牌参考表未读取：'+error.message,true);}
  });
  [referenceSheet,referenceHeaderRow].forEach(function(element){
   if(element)element.addEventListener('change',fillColumns);});
  if(referenceParse)referenceParse.addEventListener('click',function(){
   try{
    if(!referenceSnapshot)throw Error('请先导入品牌参考表。');
    referenceParsed=RfqBrandReference.parse(referenceSnapshot,{sheet:referenceSheet.value,
     headerRow:Number(referenceHeaderRow.value)||1,categoryColumn:Number(referenceCategory.value)||0,
     brandColumn:Number(referenceBrand.value)||0,
     noteColumn:referenceNote&&referenceNote.value?Number(referenceNote.value):null});
    referenceTell('已解析'+referenceParsed.rows.length+'行'+(referenceParsed.issues.length?
     ('，另有'+referenceParsed.issues.length+'条提示：'+referenceParsed.issues.slice(0,2).map(function(item){return item.message;}).join('；')):'')+
     '。参考表只用于查看，不会改动分类或已填品牌。',referenceParsed.issues.some(function(item){
      return item.code==='empty-table'||item.code==='header-empty';}));
    listReference();
   }catch(error){referenceParsed=null;referenceTell('品牌参考表未解析：'+error.message,true);listReference();}
  });
  if(referenceSearch)referenceSearch.addEventListener('input',listReference);
  if(referenceClose)referenceClose.addEventListener('click',function(){
   referenceSnapshot=null;referenceParsed=null;referenceBlock.hidden=true;referenceMessage.textContent='';
   if(referenceList)referenceList.textContent='';
  });
  readButton.addEventListener('click',readBack);
  confirmReadButton.addEventListener('click',confirmRead);
  cancelReadButton.addEventListener('click',function(){pending=null;render();tell('已放弃本次读取，项目内容未改动。');});
  render();
  return {refresh:function(){sync();render();},data:function(){return data;},verdict:function(){
    if(!data)return {ready:false,detail:'尚未建立品牌行'};
    var ctx=context();
    if(!ctx||!ctx.preview)return {ready:false,detail:'清单或来源核对未完成'};
    var check=RfqBrandTable.validateBrands(data,requiredIds(ctx));
    if(!check.ok)return {ready:false,detail:check.errors[0]};
    if(!data.binding)return {ready:false,detail:'尚未生成分类品牌表'};
    var current=report();
    if(!current||data.binding.inputKey!==current.brandKey)return {ready:false,detail:'来源或分类已变化，品牌表已过期'};
    return {ready:true,detail:'品牌与供应商已确认'};
   },restore:function(value){data=value||null;pending=null;render();}};
 }
 window.RfqBrandUI={create:create};
}());
