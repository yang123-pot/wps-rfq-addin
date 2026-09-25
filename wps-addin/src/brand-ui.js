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
