(function(){
  'use strict';
  function node(tag,text,className){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;}
  function button(text,action){var e=node('button',text,'locate');e.type='button';e.addEventListener('click',action);return e;}
  function create(options){
    var collection=RfqCollection.create(),selected=null,page=0,busy=false;
    var mergeConfirmedKey=null;
    var importPreviewHandle=null,importPreviewKey=null;
    var picker=document.getElementById('import-files'),message=document.getElementById('import-message');
    var merge=document.getElementById('merge-identical');merge.checked=false;
    var mergeSeparate=document.getElementById('merge-separate');
    var mergeDetail=document.getElementById('merge-detail');
    // 切到“表内审核”时自动按稳定rowId读回成果表，侧栏直接显示当前填写进度（读不到就明确提示，不猜）。
    var workflow=window.RfqWorkflowUI?window.RfqWorkflowUI.create({onStageChange:function(stage){
      if(stage==='review')refreshReviewRead();
    }}):null;
    var confirmMerge=document.getElementById('confirm-merge');
    var exporter=RfqExportUI.create({application:options.application,getCollection:function(){return collection;},
      mergeIdentical:function(){return merge.checked;},onBusy:function(value){busy=value;options.onBusy(value);}});
    var projects=RfqProjectUI.create({getCollection:function(){return collection;},mergeIdentical:function(){return merge.checked;},
      restore:function(project){return restoreProject(project);},getClassification:function(){return classifier.snapshot();},
      getReviewBinding:function(){return reviewBinding;},
      restoreReviewBinding:function(value){reviewBinding=value||null;return reviewBinding;},
      setReviewBinding:function(value){reviewBinding=value||null;},
      // R12-C：项目重开时在SHA之外按业务内容核对审核成果表，优先读同路径已打开簿的未保存修改。
      compareReviewContent:function(project){
        if(!options.application||!project||!project.matching)return null;
        var snapshot=project.review||project.reviewDraft;
        if(!snapshot)return null;
        function refused(code,message){return {matches:false,source:null,differences:[{code:code,message:message}]};}
        // 草稿只属于保存时的本次清单；旧内容键不能授权刷新当前成果表的物理校验。
        if(!project.review&&(!snapshot.inputKey||snapshot.inputKey!==project.matching.inputKey||snapshot.inputKey!==matchingKey()))
          return refused('input-key-stale','已保存审核草稿不属于当前清单内容，无法沿用其物理校验。');
        // 损坏的保存快照不能以重复/空标识或抛错退回SHA核验的方式授权刷新。
        var snapshotRows=snapshot.rows,bindingIds=project.matching.rowIds;
        if(!Array.isArray(snapshotRows)||!snapshotRows.length||!Array.isArray(bindingIds)||snapshotRows.length!==bindingIds.length)
          return refused('snapshot-invalid','已保存审核内容的材料行结构不完整，请核对项目记录。');
        var expectedIds=Object.create(null),snapshotIds=Object.create(null);
        bindingIds.forEach(function(id){expectedIds[id]=true;});
        if(snapshotRows.some(function(row){
          var id=String(row&&row.rowId||'');
          if(!id||snapshotIds[id]||!expectedIds[id])return true;
          snapshotIds[id]=true;return false;
        }))return refused('snapshot-invalid','已保存审核内容的行标识缺失、重复或不属于当前成果表，请核对项目记录。');
        var read;
        try{read=RfqClassificationReviewHost.readBack(options.application,project.matching);}
        catch(error){return refused('read-failed','无法核对已保存审核内容：'+error.message);}
        var compared=RfqClassificationReviewHost.compareSnapshot(read,snapshot);
        // 固定字段/行标识损坏由真实读表报告；SHA相同也不能跳过这些问题。
        compared.differences=compared.differences.concat(read.issues||[]);
        // 未完成草稿允许空分类；未知非空文本同样没有类别ID，仍必须核对原始文字。
        var savedRows={};(snapshot.rows||[]).forEach(function(row){savedRows[row.rowId]=row;});
        (read.rows||[]).forEach(function(row){
          var saved=savedRows[row.rowId];
          if(!saved||saved.categoryId||row.finalCategoryId)return;
          var expected=String(saved.categoryName||''),actual=String(row.finalCategoryName||'');
          if(expected===actual)return;
          compared.differences.push({rowId:row.rowId,code:'category-changed',field:'categoryName',label:'最终分类',
            expected:expected,actual:actual,message:'“'+row.name+'”的“最终分类”与已保存审核内容不一致：原“'+
              (expected||'（空）')+'”，现“'+(actual||'（空）')+'”。'});
        });
        compared.matches=compared.differences.length===0;
        return compared;
      },
      getCategories:function(){return categoryReceipt;},
      restoreCategories:function(value){categoryReceipt=value||null;return categoryReceipt;},
      getClassificationRows:function(){return classifier.rows();},
      afterRestore:function(){render();},
      restoreClassification:function(value){classifier.restore(value);},
      getPreview:function(){return collection.entries.length?RfqCollection.preview(collection,merge.checked):null;},
      getStageVerdicts:function(){return stageVerdicts();},
      getMergeConfirmation:function(){return mergeConfirmedKey;},
      restoreMergeConfirmation:function(key){mergeConfirmedKey=typeof key==='string'&&key?key:null;},
      getAssignments:function(){return brandPanel?brandPanel.data():null;},
      restoreAssignments:function(value){if(brandPanel)brandPanel.restore(value);},
      getHeader:function(){return headerPanel?headerPanel.header():null;},
      restoreHeader:function(value){if(headerPanel)headerPanel.restore(value);},
      // R7起“品牌汇总”阶段只认分类汇总表：生成后仍需填写并读回（R8）才算完成，不再由侧栏品牌面板判定。
      getBrandVerdict:function(){return summaryVerdict();},
      getSummary:function(){return summaryReceipt;},
      restoreSummary:function(value){summaryReceipt=value||null;return summaryReceipt;},
      // R8：汇总表读回的品牌/供应商组随项目保存与恢复，是询价/拆分内容键的业务内容。
      getBrands:function(){return summaryRead;},
      restoreBrands:function(value){summaryRead=value||null;return summaryRead;},
      getGeneration:function(){return inquiryPanel?inquiryPanel.generation():null;},
      restoreGeneration:function(value){if(inquiryPanel)inquiryPanel.restore(value);},
      getGenerationVerdict:function(){return inquiryPanel?inquiryPanel.verdict():null;},
      getSplit:function(){return splitPanel?splitPanel.receipt():null;},
      restoreSplit:function(value){if(splitPanel)splitPanel.restore(value);},
      getSplitVerdict:function(){return splitPanel?splitPanel.verdict():null;},
      onBusy:function(value){busy=value;options.onBusy(value);}});
    var libraryPanel=null,brandPanel=null,headerPanel=null,inquiryPanel=null,splitPanel=null;
    // 品牌与供应商面板的输入：当前清单、合并方式、来源校验结果、逐行分类确认与合并预览确认键。
    // R1过渡期：把侧栏旧的逐行分类/品牌/生成结论映射到v2阶段；分类工作簿等未实现阶段保持未完成。
    // R5起“表内审核”只认整表确认快照：侧栏逐行确认（辅助功能里的过渡工具）不再代表该阶段完成。
    function stageVerdicts(){
      var matched=!!reviewModel&&selectionConfirmed();
      var confirmation=reviewConfirmation(),fresh=matched&&confirmation&&confirmation.inputKey===matchingKey();
      var draft=projects.reviewDraft?projects.reviewDraft():null;
      return {
        matching:matched?{ready:true,detail:'自动匹配完成，尚未人工确认'}
          :{ready:false,detail:'尚未生成自动分类建议'},
        review:fresh?{ready:true,detail:'整表已确认并保存快照（'+confirmation.rows.length+' 行）',rows:confirmation.rows}
          :{ready:false,detail:matched?(draft?('审核草稿已保存（'+draft.counts.filled+' / '+draft.counts.rows+' 行已填），尚未整表确认')
            :'尚未完成整表审核确认'):'尚未生成自动分类建议'},
        categories:categoryVerdict(),
        brands:summaryVerdict()};
    }
    function brandContext(){
      var preview=collection.entries.length?RfqCollection.preview(collection,merge.checked):null,verdicts=stageVerdicts();
      return {collection:collection,mergeIdentical:merge.checked===true,preview:preview,
        classification:classifier.snapshot(),rows:classifier.rows(),mergeConfirmedKey:mergeConfirmedKey,
        matching:verdicts.matching,review:legacyReviewVerdict(),categories:verdicts.categories};
    }
    // 辅助功能里的过渡面板（分类核对/分类品牌表）仍按逐行确认口径判断可操作性；
    // 正式阶段与主流程只认R5成果表内的整表一次确认快照，两者不混用。
    function legacyReviewVerdict(){
      var rows=classifier.rows(),snapshot=classifier.snapshot(),decided={};
      ((snapshot&&snapshot.decisions)||[]).forEach(function(decision){if(decision&&decision.rowId)decided[decision.rowId]=true;});
      if(!rows.length)return {ready:false,detail:'尚未生成自动分类建议'};
      var pending=rows.filter(function(row){return !row||!decided[row.rowId];}).length;
      return pending?{ready:false,detail:'还有'+pending+'行未确认分类'}
        :{ready:true,detail:'分类已确认（过渡期沿用侧栏逐行确认）'};
    }
    var classifier=RfqClassificationUI.create({application:options.application,getCollection:function(){return collection;},
      mergeIdentical:function(){return merge.checked;},getMergedTarget:function(){return exporter.last();},
      getProjectId:function(){return projects.identity();},
      onMemoryChange:function(state){if(libraryPanel)libraryPanel.adoptMemory(state);},
      onChange:function(){if(brandPanel)brandPanel.refresh();},
      onBusy:function(value){busy=value;options.onBusy(value);}});
    libraryPanel=RfqLibraryUI.create({onChange:function(state){
      if(classifier.adopt(state)){
        render();
        if(reviewBinding)reviewTell('分类库已更新，当前自动建议已刷新。已有成果表和人工确认保持原内容；需要采用新建议时请重新生成成果表。');
      }
    }});
    // 旧品牌编辑/预览确认不再接入页面；品牌参考保持只读独立入口。
    RfqBrandUI.createReference({application:options.application});
    headerPanel=RfqHeaderUI.create({onChange:function(){
      if(inquiryPanel)inquiryPanel.refresh();if(splitPanel)splitPanel.refresh();}});
    // 生成面板的输入：汇总表读回的品牌组、询价抬头、当前清单分组与分类确认，以及生成用内容键。
    // 品牌/供应商的唯一来源是分类汇总表读回（R8），侧栏不再二次编辑；抬头变化同样进入生成内容键。
    function deliveryContext(){
      var ctx=brandContext();
      ctx.header=headerPanel?headerPanel.header():null;
      // R8/R9：询价与拆分只取当前有效的汇总读回品牌组；未读回或已过期时为空，不沿用旧品牌。
      ctx.brands=currentBrandGroups();
      var report=RfqProject.assess(ctx);
      // 询价对象按稳定rowId归类：以R5整表确认快照为准（不是侧栏过渡期的逐行确认），避免改过冲突行后仍按旧建议。
      var confirmation=reviewConfirmation();
      return {brands:ctx.brands,groups:ctx.preview?ctx.preview.groups:[],
        classification:{decisions:(confirmation&&confirmation.rows)||[]},
        header:ctx.header,inputKey:report.generationKey,projectName:projectDisplayName(),
        summary:summaryVerdict(),summaryPath:summaryReceipt?summaryReceipt.path:null};
    }
    // R9：生成成功后把生成记录落盘，让“询价表”阶段按真实内容置为已确认。
    function afterInquiryGeneration(){render();if(projects&&projects.save)projects.save();}
    inquiryPanel=RfqInquiryUI.create({application:options.application,context:deliveryContext,
      onGeneration:afterInquiryGeneration,
      onNext:function(){if(workflow)workflow.goTo('split');},
      onBack:function(){if(workflow)workflow.goTo('brands');},
      onBusy:function(value){busy=value;options.onBusy(value);}});
    splitPanel=RfqSplitUI.create({application:options.application,context:deliveryContext,
      generation:function(){return inquiryPanel?inquiryPanel.generation():null;},
      projectId:function(){return projects.identity();},
      onReceipt:function(){if(projects&&projects.save)projects.save();},
      onBusy:function(value){busy=value;options.onBusy(value);}});
    function tell(text,error){message.textContent=text;message.className=error?'error':'';}
    function restoreProject(project){
      var inputs=(project.sources||[]).map(function(source){
        return {metadata:{originalPath:source.originalPath,originalName:source.originalName,copyPath:source.copyPath,fingerprint:source.fingerprint},snapshot:source.snapshot};
      });
      if(!inputs.length)throw Error('项目记录里没有来源清单，无法恢复。');
      collection=RfqCollection.add(RfqCollection.create(),inputs);
      selected=null;page=0;merge.checked=project.mergeIdentical===true;
      render();
      if(collection.entries.length)activate(collection.entries[0].id);
      return true;
    }
    function activate(id){
      var entry=collection.entries.find(function(e){return e.id===id;});
      if(entry&&options.onSelect(entry)!==false){selected=id;render();}
    }
    function sources(group){
      var details=node('details'),built=false;
      details.appendChild(node('summary','查看全部 '+group.sources.length+' 条来源'));
      details.addEventListener('toggle',function(){
        if(!details.open||built)return;built=true;
        var list=node('ul',null,'source-list'),controls=node('div',null,'pagination'),offset=0;
        function draw(){
          list.textContent='';controls.textContent='';
          group.sources.slice(offset,offset+20).forEach(function(s){
            var li=node('li');li.appendChild(node('strong',s.file));
            li.appendChild(node('p',s.path,'source'));
            li.appendChild(node('p',s.engineering+'—'+s.profession,'source'));
            li.appendChild(node('p',s.sheet+' · 行 '+s.rows.join('、'),'source'));
            var originalCode=s.review&&s.review.original?s.review.original.code:s.code;
            li.appendChild(node('p','原编码 '+originalCode+' · 核对编码 '+s.code,'source'));
            li.appendChild(node('p','原工程量 '+String(s.quantityRaw)+' · 核对量 '+(s.quantity===null?'异常':s.quantity)+' '+s.unit,'source'));
            li.appendChild(button('定位工作副本',function(){
              try{var entry=collection.entries.find(function(e){return e.metadata.originalPath===s.path;});
                if(!entry)throw Error('来源文件已移除。');RfqImportHost.locateCopy(options.application,entry.metadata,s);tell('已定位工作副本，原件未打开。');
              }catch(error){tell(error.message,true);}
            }));list.appendChild(li);
          });
          var prev=button('前20条',function(){offset-=20;draw();});prev.disabled=offset===0;
          var next=button('后20条',function(){offset+=20;draw();});next.disabled=offset+20>=group.sources.length;
          controls.appendChild(prev);controls.appendChild(node('span',(offset+1)+'–'+Math.min(offset+20,group.sources.length)));controls.appendChild(next);
        }
        details.appendChild(list);if(group.sources.length>20)details.appendChild(controls);draw();
      });return details;
    }
    function render(){
      var list=document.getElementById('imported-books');list.textContent='';
      collection.entries.forEach(function(e){
        var li=node('li',null,e.id===selected?'selected-file':'');
        li.appendChild(node('strong',e.metadata.originalName));li.appendChild(node('p',e.metadata.originalPath,'source'));
        li.appendChild(node('p',e.snapshot.sheets.length+' 张表 · '+e.parsed.materials.length+' 项 · '+e.parsed.issues.length+' 个问题'+(e.dirty?' · 核对未保存':''),'note'));
        li.appendChild(button('核对此文件',function(){activate(e.id);}));
        li.appendChild(button('移除此文件',function(){
          if(e.dirty&&!window.confirm('此文件有未保存核对，移除会丢失这些修改，是否继续？'))return;
          collection=RfqCollection.remove(collection,e.id);
          if(selected===e.id){selected=null;options.onRemove(e.id);if(collection.entries.length)activate(collection.entries[0].id);}
          render();tell('已从本次列表移除，原件和已保存核对记录保留。');
        }));list.appendChild(li);
      });
      document.getElementById('merge-section').hidden=!collection.entries.length;
      projects.refresh();
      if(!collection.entries.length){
        exporter.refresh({canFinalize:false});classifier.refresh({groups:[]});
        if(workflow)workflow.setStats({files:0,rows:0,mergedRows:0});
        if(brandPanel)brandPanel.refresh();renderCategories();renderBrands();return;
      }
      var result=RfqCollection.preview(collection,merge.checked),pages=Math.max(1,Math.ceil(result.groups.length/20));page=Math.min(page,pages-1);
      var mergeConfirmed=mergeConfirmedKey===RfqProject.contentKey({collection:collection,mergeIdentical:merge.checked===true,groups:result.groups});
      exporter.refresh(result);
      // R3：确认选择前不进入匹配——未确认时不给任何分类建议，避免越过“先选是否合并”。
      classifier.refresh(mergeConfirmed?result:{groups:[],inputCount:result.inputCount,outputCount:0,issues:[],canFinalize:false});
      // R4：确认合并选择后跑自动分类，得出建议并准备成果表；这一步不确认也不学习。
      reviewModel=mergeConfirmed?buildReview():null;
      renderReview();
      renderSheetReview();
      renderCategories();
      renderBrands();
      if(workflow){
        workflow.setStats({files:collection.entries.length,rows:result.inputCount,mergedRows:result.outputCount});
        var report=RfqProject.assess(brandContext());
        var states={};RfqProject.STAGES.forEach(function(stage){states[stage]=RfqProject.stageState(projects.current()||{stages:{}},stage);});
        workflow.setStageState(states);
      }
      if(brandPanel)brandPanel.refresh();
      if(headerPanel)headerPanel.refresh();
      if(inquiryPanel)inquiryPanel.refresh();
      if(splitPanel)splitPanel.refresh();
      document.getElementById('merge-summary').textContent='原始 '+result.inputCount+' 项 → 预览 '+result.outputCount+' 项 · '+(merge.checked?'已选择精确合并':'按来源分别保留');
      confirmMerge.disabled=busy||!result.canFinalize;
      confirmMerge.textContent=mergeConfirmed?'已确认本次选择（可重新确认并继续）':'确认选择，开始自动分类';
      document.getElementById('merge-status').textContent=(result.canFinalize?'本次校验通过，预览尚未另存。':
        result.issues.length+' 个待核对问题仍阻断后续处理；请在上方选择文件逐项核对。')+
        (mergeConfirmed?' 本次选择已确认，可继续自动分类。':' 确认选择后才能进入自动分类。');
      syncMergeChoices();
      syncImportPreview(false);
      var groups=document.getElementById('merge-list');groups.textContent='';
      result.groups.slice(page*20,(page+1)*20).forEach(function(g){
        var li=node('li');li.appendChild(node('strong',g.name||'名称待补'));
        li.appendChild(node('p','工程量 '+(g.quantity===null?'异常，待核对':g.quantity)+' '+g.unit,'quantity'));
        li.appendChild(node('p',g.sourceLabels.join('；'),'source'));
        var features=node('details');features.appendChild(node('summary','查看项目特征'));features.appendChild(node('p',g.feature||'（空）','feature'));li.appendChild(features);
        li.appendChild(sources(g));groups.appendChild(li);
      });
      document.getElementById('merge-pages').textContent=(page+1)+' / '+pages+' 页';
      document.getElementById('merge-prev').disabled=page===0;document.getElementById('merge-next').disabled=page+1>=pages;
    }
    // 图01的两个选项互斥：默认“分别保留清单”，勾选“合并完全相同项”才更新精确预览。
    function syncMergeChoices(){
      if(mergeSeparate)mergeSeparate.checked=!merge.checked;
      var separateRow=mergeSeparate&&mergeSeparate.parentNode,combinedRow=merge&&merge.parentNode;
      if(separateRow)separateRow.classList.toggle('is-selected',!merge.checked);
      if(combinedRow)combinedRow.classList.toggle('is-selected',merge.checked===true);
    }
    function chooseMode(combined){
      merge.checked=combined===true;
      page=0;render();
    }
    merge.addEventListener('change',function(){chooseMode(merge.checked);tell(merge.checked?'已选择“合并完全相同项”，下方预览按精确合并更新；确认后才进入自动分类。':'已选择“分别保留清单”，不做合并；确认后才进入自动分类。');});
    if(mergeSeparate)mergeSeparate.addEventListener('change',function(){chooseMode(false);tell('已选择“分别保留清单”，不做合并；确认后才进入自动分类。');});
    if(mergeDetail)mergeDetail.addEventListener('click',function(){
      syncImportPreview(true);
      tell('合并预览明细：请查看主工作簿中的“导入预览”和“合并明细”；原件不变，确认选择后才开始分类。');
    });
    function syncImportPreview(force){
      var box=document.getElementById('import-preview-status');
      if(!collection.entries.length||!options.application||!window.RfqImportPreviewModel)return;
      var key=mergeSelectionKey();
      if(!force&&importPreviewKey===key)return;
      try{
        var model=RfqImportPreviewModel.build(collection,merge.checked,{projectName:projectDisplayName()});
        importPreviewHandle=RfqExportHost.showPreview(options.application,model,importPreviewHandle);
        importPreviewKey=key;
        if(box){box.textContent='主表已显示导入预览与合并明细（'+model.inputCount+' → '+model.outputCount+' 行）。预览随选择刷新。';box.className='note';}
      }catch(error){
        // 只拦主表预览，不回滚已经核实的导入；用户可明确重试，不自动反复创建失败簿。
        importPreviewKey=key;
        if(box){box.textContent='主表预览未完成：'+error.message+' 可点“查看合并明细”重试。';box.className='error';}
      }
    }
    confirmMerge.addEventListener('click',function(){
      if(busy)return;
      var result=collection.entries.length?RfqCollection.preview(collection,merge.checked):null;
      if(!result||!result.canFinalize){tell('还有待核对问题，请先处理来源问题再确认预览。',true);return;}
      mergeConfirmedKey=RfqProject.contentKey({collection:collection,mergeIdentical:merge.checked===true,groups:result.groups});
      render();
      if(workflow)workflow.goTo('matching');
      tell('已确认本次'+(merge.checked?'精确合并':'分别保留')+'选择，开始自动分类；来源或合并方式变化后需要重新确认。');
    });
    document.getElementById('merge-prev').addEventListener('click',function(){page--;render();});
    document.getElementById('merge-next').addEventListener('click',function(){page++;render();});
    // R4：自动分类→审核成果表。只产出建议并把结果写进独立成果簿；不确认、不学习。
    var reviewModel=null,reviewBinding=null,reviewBusy=false;
    function reviewEl(id){return document.getElementById(id);}
    function reviewTell(text,error){var box=reviewEl('classification-review-message');if(box){box.textContent=text;box.className=error?'error':'';}}
    function currentLibrary(){return classifier.library?classifier.library():null;}
    function mergeSelectionKey(){
      var result=collection.entries.length?RfqCollection.preview(collection,merge.checked):null;
      return RfqProject.contentKey({collection:collection,mergeIdentical:merge.checked===true,groups:result?result.groups:[]});
    }
    function matchingKey(){
      var result=collection.entries.length?RfqCollection.preview(collection,merge.checked):null;
      return RfqProject.contentKey({stage:'matching',collection:collection,mergeIdentical:merge.checked===true,
        groups:result?result.groups:[]});
    }
    function selectionConfirmed(){return !!mergeConfirmedKey&&mergeConfirmedKey===mergeSelectionKey();}
    function buildReview(){
      var groups=classifier.groups?classifier.groups():[],source=currentLibrary();
      if(!groups.length||!source||!source.categories||!source.categories.length)return null;
      return RfqClassificationReviewModel.build(groups,{library:source,
        memory:classifier.memory?classifier.memory():null,projectId:projects.identity()});
    }
    function renderReview(){
      var banner=reviewEl('classification-review-banner'),stats=reviewEl('classification-review-stats'),status=reviewEl('classification-review-status'),
        generate=reviewEl('classification-review-generate'),open=reviewEl('classification-review-open');
      if(!banner)return;
      var confirmed=selectionConfirmed();
      if(!confirmed||!reviewModel){
        reviewModel=null;
        banner.textContent='尚未自动分类';
        banner.className='result-banner';
        if(stats)stats.textContent='确认合并选择后才会开始自动分类。';
        if(status)status.textContent='';
        if(generate)generate.disabled=true;
        if(open)open.disabled=true;
        return;
      }
      var summary=RfqClassificationReviewModel.summary(reviewModel);
      banner.textContent='自动匹配完成';
      banner.className='result-banner is-done';
      var fresh=reviewBinding&&reviewBinding.inputKey===matchingKey();
      if(stats)stats.textContent=summary.rows+(fresh?' 行结果已写入成果表':' 行自动分类结果待写入成果表')+
        ' · 当前自动建议：'+summary.detail+' · 尚未人工确认';
      if(status)status.textContent=fresh?'成果表已生成：'+reviewBinding.path+'（可打开审核）'
        :'尚未生成审核成果表：请先生成独立成果簿，再在表内审核。';
      if(generate)generate.textContent=fresh?'重新生成审核成果表':'生成审核成果表';
      if(generate)generate.disabled=reviewBusy||!options.application;
      if(open)open.disabled=!(fresh&&options.application);
    }
    function exportRequest(action,data){
      return fetch('/api/export/'+action,{method:'POST',
        headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},
        body:JSON.stringify(data)}).then(function(response){
        return response.json().then(function(result){
          if(!response.ok){var error=Error(result.error||'审核成果表请求失败。');error.status=response.status;throw error;}
          return result;
        });
      });
    }
    function reviewTargetName(){
      return RfqClassificationReviewHost.suggestedName(projectDisplayName());
    }
    // 项目名优先取清单里的“工程名称”（图02即示例园区），没有工程名时退回文件名。
    function projectDisplayName(){
      for(var index=0;index<collection.entries.length;index++){
        var parsed=collection.entries[index].parsed||{},materials=parsed.materials||[];
        for(var position=0;position<materials.length;position++){
          var source=materials[position].source||{},engineering=String(source.engineering||'').trim();
          if(engineering)return engineering;
        }
      }
      return collection.entries.length?String(collection.entries[0].metadata.originalName).replace(/\.[^.]+$/,''):'未命名项目';
    }
    function pickReviewTarget(suggested){
      return new Promise(function(resolve){
        if(!window.__RFQ_IMPORT__||!RfqPathPicker)return resolve(null);
        RfqPathPicker.open({mode:'save',token:window.__RFQ_IMPORT__.token,title:'选择成果表保存位置',
          fileName:suggested,startPath:'',confirmLabel:'生成到此位置',
          onConfirm:function(value){resolve(value&&value.target?value:null);},onCancel:function(){resolve(null);}});
      });
    }
    async function generateReview(){
      if(reviewBusy)return;
      var prepared=null,published=false;
      try{
        if(!selectionConfirmed())throw Error('请先确认合并选择，再生成成果表。');
        reviewModel=buildReview();
        if(!reviewModel)throw Error('自动分类还没有结果，请先完成分类库加载。');
        var plannedModel=reviewModel,plannedKey=matchingKey();
        function requireCurrent(){
          if(!selectionConfirmed()||matchingKey()!==plannedKey)
            throw Error('来源或合并选择已变化，请重新确认并生成审核成果表。');
        }
        var name=reviewTargetName(),selection=await pickReviewTarget(name);
        if(!selection||!selection.target){tell('已取消选择成果表位置，当前阶段不变。');return;}
        requireCurrent();
        reviewBusy=true;renderReview();
        reviewTell('正在写入并重新打开校验成果表…');
        prepared=await exportRequest('prepare',{target:selection.target,adjacent:true});
        requireCurrent();
        // 宿主写入通常同步完成；这里await一层，保证任何异步实现（含测试夹具）先落地再发布。
        await RfqClassificationReviewHost.write(options.application,plannedModel,prepared.stagePath,{title:name});
        requireCurrent();
        var receipt=await exportRequest('commit',{ticket:prepared.ticket});
        published=true;
        await exportRequest('verify',{ticket:prepared.ticket,target:receipt.target,sha256:receipt.sha256});
        requireCurrent();
        reviewBinding=RfqClassificationReviewHost.bindingFor(receipt,plannedModel,{inputKey:plannedKey,title:name});
        if(options.setReviewBinding)options.setReviewBinding(reviewBinding);
        tell('审核成果表已生成：'+receipt.target);
        try{
          // 打开只是方便用户立刻编辑；打不开不代表生成失败，可稍后点“打开成果表审核”重试。
          if(options.application)RfqClassificationReviewHost.openForEditing(options.application,receipt.target);
          reviewTell('审核成果表已生成并校验：'+receipt.target+'。请在表内修改“最终分类”“审核备注”，完成后回到侧栏。');
        }catch(openError){
          reviewTell('审核成果表已生成并校验：'+receipt.target+'，但未能自动打开（'+openError.message+'）。可点“打开成果表审核”重试。');
        }
      }catch(error){reviewTell('审核成果表未生成。'+error.message,true);}
      finally{
        // 未发布就失败/被取消时清掉本次相邻暂存，避免在用户成果目录留下点号临时文件。
        if(prepared&&!published){try{await exportRequest('discard',{ticket:prepared.ticket});}catch(_){}}
        reviewBusy=false;renderReview();
      }
    }
    var generateButton=reviewEl('classification-review-generate'),openButton=reviewEl('classification-review-open');
    if(generateButton)generateButton.addEventListener('click',generateReview);
    if(openButton)openButton.addEventListener('click',function(){
      if(!reviewBinding){reviewTell('还没有生成审核成果表。',true);return;}
      try{RfqClassificationReviewHost.openForEditing(options.application,reviewBinding.path);
        reviewTell('已打开审核成果表：'+reviewBinding.path+'。请在表内修改“最终分类”“审核备注”，完成后整表一次确认。');
        if(workflow)workflow.goTo('review');}
      catch(error){reviewTell('成果表未打开。'+error.message,true);}
    });
    if(options.restoreReviewBinding)reviewBinding=options.restoreReviewBinding()||null;
    // R5：表内审核→整表一次确认→学习。主按钮读回绑定成果簿全部行（含筛选隐藏行），按rowId校验材料与类别；
    // 空分类/未知分类/损坏行返回工作表＋单元格并定位。确认快照先落盘，落盘成功才学习，失败不回滚确认。
    var sheetReviewBusy=false,lastReviewRead=null,reviewDivergence=null;
    function sheetEl(id){return document.getElementById(id);}
    function sheetTell(text,error){var box=sheetEl('sheet-review-message');if(box){box.textContent=text;box.className=error?'error':'';}}
    function columnName(column){return Number.isSafeInteger(column)&&column>0&&column<=26?String.fromCharCode(64+column):'';}
    function reviewConfirmation(){return projects.reviewConfirmation?projects.reviewConfirmation():null;}
    function reviewFresh(){
      var confirmation=reviewConfirmation();
      return !!(reviewBinding&&selectionConfirmed()&&confirmation&&confirmation.inputKey===matchingKey());
    }
    function readReviewSheet(){
      var state=RfqClassificationReviewModel.bindingState(reviewBinding,matchingKey());
      if(!state.ok)throw Error(state.message);
      if(!options.application)throw Error('请在WPS内打开侧栏，才能读回审核成果表。');
      return RfqClassificationReviewHost.readBack(options.application,reviewBinding);
    }
    // R12-C：现表（打开簿/磁盘）与项目已保存的审核快照是否业务一致。
    // SHA相同不代表内容一致：H11磁盘空、快照汽车充电桩时必须在侧栏报出并给出恢复动作。
    function detectReviewDivergence(read){
      var confirmation=reviewConfirmation();
      if(confirmation&&confirmation.inputKey===matchingKey()){
        var against=RfqClassificationReviewHost.compareSnapshot(read,confirmation);
        if(against&&against.matches===false)
          return {kind:'confirmation',label:'整表确认快照',snapshot:confirmation,result:against};
      }
      var draft=projects.reviewDraft?projects.reviewDraft():null;
      if(draft){
        var againstDraft=RfqClassificationReviewHost.compareSnapshot(read,draft);
        if(againstDraft&&againstDraft.matches===false)
          return {kind:'draft',label:'审核草稿',snapshot:draft,result:againstDraft};
      }
      return null;
    }
    function renderReviewIssues(errors){
      var list=sheetEl('sheet-review-issues');if(!list)return;
      list.textContent='';
      (errors||[]).slice(0,20).forEach(function(issue){
        var li=node('li');
        li.appendChild(node('strong',(issue.title||'读回问题')+(issue.row==null?'':'（第'+issue.row+'行'+
          (columnName(issue.column)?' '+columnName(issue.column)+'列':'')+'）')));
        li.appendChild(node('p',issue.message,'note'));
        if(issue.row!=null)li.appendChild(button('定位到'+(columnName(issue.column)?' '+columnName(issue.column)+' 单元格':''),function(){
          try{
            RfqClassificationReviewHost.locate(options.application,reviewBinding,{row:issue.row,column:issue.column});
            sheetTell('已定位到成果表第'+issue.row+'行'+(columnName(issue.column)?'的'+(columnName(issue.column))+'列':'')+'，请就地修改后重新确认。');
          }catch(problem){sheetTell('未能定位到该单元格：'+problem.message,true);}
        }));
        list.appendChild(li);
      });
      if((errors||[]).length>20)list.appendChild(node('li','（仅显示前20处，修正后重新校验。）','note'));
    }
    function refreshMatchDisplay(checked){
      if(!checked||!checked.rows.length)return null;
      try{
        return RfqClassificationReviewHost.refreshMatchColumn(options.application,reviewBinding,
          checked.rows.map(function(row){return {row:row.row,label:row.match};}));
      }catch(error){return {error:error.message};}
    }
    function renderSheetReview(){
      var banner=sheetEl('sheet-review-banner'),progress=sheetEl('sheet-review-progress'),stats=sheetEl('sheet-review-stats'),
        status=sheetEl('sheet-review-status'),confirm=sheetEl('sheet-review-confirm'),save=sheetEl('sheet-review-save'),
        retry=sheetEl('sheet-review-memory-retry'),useSheet=sheetEl('sheet-review-use-sheet'),
        restoreCopy=sheetEl('sheet-review-restore-copy');
      if(!banner)return;
      var confirmation=reviewConfirmation(),draft=projects.reviewDraft?projects.reviewDraft():null;
      var ready=!!reviewBinding&&selectionConfirmed(),fresh=reviewFresh();
      if(!ready){
        banner.textContent='尚未生成审核成果表';
        banner.className='result-banner';
        progress.textContent='当前进度：等待自动分类完成';
        stats.textContent=selectionConfirmed()?'请先在“自动分类”阶段生成并打开审核成果表。'
          :'确认合并选择并完成自动分类后，才能进入表内审核。';
        status.textContent='';
      }else if(confirmation&&!fresh){
        banner.textContent='整表确认已过期';
        banner.className='result-banner';
        progress.textContent='当前进度 3 / 7 · 清单、合并选择或分类库已变化，需要重新生成成果表并整表确认。';
        stats.textContent='上次确认：'+confirmation.confirmedAt+'（'+confirmation.rows.length+' 行），不再作为当前依据。';
        status.textContent='旧确认不会自动沿用：请重新生成审核成果表，再按最新内容整表确认。';
      }else if(fresh){
        banner.textContent='整表已确认';
        banner.className='result-banner is-done';
        progress.textContent='当前进度 3 / 7 · 整表已确认（'+confirmation.rows.length+' 行），可以生成分类工作簿。';
        stats.textContent=confirmation.counts.consistent+' 行与自动建议一致 · '+confirmation.counts.different+
          ' 行存在差异 · '+confirmation.counts.noInquiry+' 行无需询价 · 审核备注 '+confirmation.counts.notes+' 条';
        status.textContent='确认快照：'+confirmation.confirmedAt+'（第 '+confirmation.revision+' 次确认）'+
          (confirmation.sheet?' · '+confirmation.sheet.path:'');
        if(!RfqClassificationReviewModel.bindingState(reviewBinding,matchingKey()).ok)
          status.textContent+=' · 成果表绑定的是旧内容：需重新生成审核成果表后才能再次整表确认。';
      }else{
        banner.textContent='自动匹配完成，尚未人工确认';
        banner.className='result-banner';
        progress.textContent='当前进度 3 / 7 · 正在进行表内审核，请完成整表修改后确认。';
        stats.textContent=lastReviewRead?(lastReviewRead.summary
          +(lastReviewRead.ok?' · 可以整表确认':' · '+lastReviewRead.errors.length+' 处待修改'))
          :(draft?('上次草稿：'+draft.counts.filled+' / '+draft.counts.rows+' 行已填（'+draft.savedAt+'），尚未确认')
            :'成果表：'+(reviewBinding?reviewBinding.path:'尚未生成'));
        status.textContent='确认后会把整表（'+((reviewBinding&&reviewBinding.rowIds&&reviewBinding.rowIds.length)||0)+
          ' 行）作为分类工作簿的依据并保存快照；“保存审核成果”只存草稿。';
      }
      if(confirm)confirm.disabled=sheetReviewBusy||!ready;
      if(save)save.disabled=sheetReviewBusy||!ready;
      // R12-C：SHA一致但业务内容与项目已保存的审核快照不同，给出双方并保留两种恢复动作，不静默覆盖/学习。
      if(useSheet)useSheet.hidden=!(ready&&reviewDivergence);
      if(restoreCopy)restoreCopy.hidden=!(ready&&reviewDivergence);
      if(ready&&reviewDivergence){
        var diff=reviewDivergence.result,differences=diff.differences||[];
        if(reviewDivergence.kind==='confirmation'){
          banner.textContent='成果表内容与已保存确认不一致';
          banner.className='result-banner';
        }
        stats.textContent='项目保存的'+reviewDivergence.label+'与当前成果表（'+
          (diff.source==='open'?'打开簿内容':'磁盘内容')+'）有 '+differences.length+' 处业务差异，SHA一致也不能当作已一致。';
        status.textContent='请选择：选用现表内容（按现表重新整表确认）或恢复项目草稿到新副本（把项目保存的审核写进新副本，不覆盖当前簿）。'+
          (differences[0]?'例：'+differences[0].message:'');
      }
      if(retry){
        var pending=classifier&&classifier.memoryPending?classifier.memoryPending():false;
        retry.hidden=!pending;
      }
    }
    function refreshReviewRead(silent){
      if(!sheetEl('sheet-review-banner'))return;
      if(!reviewBinding||!selectionConfirmed()){lastReviewRead=null;reviewDivergence=null;renderSheetReview();return;}
      try{
        var read=readReviewSheet();
        lastReviewRead=RfqClassificationReviewModel.validateRead(read,{categories:reviewBinding.categories});
        reviewDivergence=detectReviewDivergence(read);
        if(!silent&&!lastReviewRead.ok)renderReviewIssues(lastReviewRead.errors);
      }catch(error){
        lastReviewRead=null;reviewDivergence=null;
        if(!silent)sheetTell('未能读回成果表：'+error.message,true);
      }
      renderSheetReview();
    }
    async function saveReviewDraft(){
      if(sheetReviewBusy)return;
      try{
        var read=readReviewSheet();
        var result=RfqClassificationReviewModel.draft(read,{inputKey:matchingKey(),projectId:projects.identity(),
          binding:reviewBinding});
        var checked=RfqClassificationReviewModel.validateRead(read,{categories:reviewBinding.categories});
        lastReviewRead=checked;
        if(!result.ok){
          renderReviewIssues(result.errors);renderSheetReview();
          sheetTell('审核成果表未保存为草稿：'+result.errors[0].message,true);
          if(result.errors[0].row!=null){
            try{RfqClassificationReviewHost.locate(options.application,reviewBinding,result.errors[0]);}catch(_){}
          }
          return;
        }
        sheetReviewBusy=true;renderSheetReview();
        var receipt=await projects.commitReviewDraft(result.draft);
        if(!receipt){
          var reason=projects.lastError&&projects.lastError();
          sheetTell('审核草稿未保存：'+(reason?reason.message:'项目记录写入失败。'),true);
          refreshReviewRead(true);
          return;
        }
        refreshMatchDisplay(checked);
        reviewDivergence=detectReviewDivergence(read);
        renderReviewIssues(checked.errors);
        sheetTell('审核草稿已保存（'+result.draft.counts.filled+' / '+result.draft.counts.rows+
          ' 行已填），尚未确认、未学习、未生成分类工作簿。'+(checked.ok?'':('还有 '+checked.errors.length+' 处待修改。')));
      }catch(error){sheetTell('审核成果表未保存为草稿：'+error.message,true);}
      finally{sheetReviewBusy=false;renderSheetReview();}
    }
    async function confirmSheetReview(){
      if(sheetReviewBusy)return;
      var previous=reviewConfirmation();
      try{
        var read=readReviewSheet();
        var checked=RfqClassificationReviewModel.validateRead(read,{categories:reviewBinding.categories});
        lastReviewRead=checked;
        renderSheetReview();
        if(!checked.ok){
          renderReviewIssues(checked.errors);
          sheetTell('整表未通过校验：'+checked.errors.length+' 处待修改。'+checked.errors[0].message,true);
          if(checked.errors[0].row!=null){
            try{RfqClassificationReviewHost.locate(options.application,reviewBinding,checked.errors[0]);}catch(_){}
          }
          return;
        }
        var next=RfqClassificationReviewModel.confirmation(checked.rows,{projectId:projects.identity(),
          inputKey:matchingKey(),libraryVersion:(reviewModel&&reviewModel.libraryVersion)||null,binding:reviewBinding,
          revision:previous&&Number.isSafeInteger(previous.revision)?previous.revision+1:1});
        if(previous&&RfqClassificationReviewModel.sameRows(previous,next)){
          refreshMatchDisplay(checked);renderReviewIssues([]);
          sheetTell('整表内容与上次确认一致，未重复确认（'+next.rows.length+' 行）。');
          renderSheetReview();
          return;
        }
        sheetReviewBusy=true;renderSheetReview();
        sheetTell('正在保存整表确认快照…');
        var draftResult=RfqClassificationReviewModel.draft(read,{inputKey:matchingKey(),projectId:projects.identity(),binding:reviewBinding});
        var receipt=await projects.commitReview(next,{draft:draftResult.ok?draftResult.draft:null});
        if(!receipt){
          var reason=projects.lastError&&projects.lastError();
          sheetTell('整表确认未保存：'+(reason?reason.message:'项目记录写入失败。')+'（未学习、未放行）',true);
          refreshReviewRead(true);
          return;
        }
        var refreshed=refreshMatchDisplay(checked);
        reviewDivergence=detectReviewDivergence(read);
        renderReviewIssues([]);
        renderSheetReview();
        var items=checked.rows.map(function(row){
          var before=((previous&&previous.rows)||[]).filter(function(item){return item.rowId===row.rowId;})[0];
          return {item:{name:row.name,feature:row.feature,unit:row.unit},
            previousCategoryId:before?before.categoryId:'',
            decision:{rowId:row.rowId,categoryId:row.categoryId,categoryName:row.categoryName,skip:row.skip,
              note:row.note,confirmedAt:next.confirmedAt,revision:next.revision,libraryVersion:next.libraryVersion}};
        });
        var learned=await classifier.learnConfirmations(items).then(function(){return {ok:true};},
          function(error){return {ok:false,error:error};});
        renderSheetReview();
        var matchNote=refreshed&&!refreshed.error&&refreshed.updated>0?
          ('“匹配情况”列已刷新 '+refreshed.updated+' 处（未保存文件）。'):'';
        if(learned.ok)
          sheetTell('整表已确认（'+next.rows.length+' 行）：'+(checked.counts.consistent)+' 行与自动建议一致、'+
            checked.counts.different+' 行存在差异；分类习惯已保存。'+matchNote+'下一步生成分类工作簿。');
        else
          sheetTell('整表已确认并保存快照；分类习惯未保存，可点“习惯保存重试”：'+learned.error.message,'true');
        if(workflow)workflow.goTo('categories');
        // 图03主按钮“审核完成，生成分类工作簿”：确认快照落盘后才按新快照生成独立分类工作簿。
        generateCategoryWorkbooks({auto:true}).catch(function(error){
          categoryTell('分类工作簿未生成：'+error.message,true);
        });
      }catch(error){sheetTell('整表确认未完成：'+error.message,true);}
      finally{sheetReviewBusy=false;renderSheetReview();}
    }
    var sheetConfirmButton=sheetEl('sheet-review-confirm'),sheetSaveButton=sheetEl('sheet-review-save'),
      sheetRetryButton=sheetEl('sheet-review-memory-retry'),sheetUseSheetButton=sheetEl('sheet-review-use-sheet'),
      sheetRestoreCopyButton=sheetEl('sheet-review-restore-copy');
    if(sheetConfirmButton)sheetConfirmButton.addEventListener('click',confirmSheetReview);
    if(sheetSaveButton)sheetSaveButton.addEventListener('click',saveReviewDraft);
    // R12-C：以现表为准——按当前成果表内容重新整表一次确认（复用主流程确认，不新增阶段）。
    if(sheetUseSheetButton)sheetUseSheetButton.addEventListener('click',function(){
      if(sheetReviewBusy)return;
      sheetTell('正在按当前成果表内容整表确认…');
      confirmSheetReview();
    });
    // R12-C：把项目保存的审核快照写成新的成果副本，绝不覆盖当前打开的簿；成功后再把绑定切到新副本。
    if(sheetRestoreCopyButton)sheetRestoreCopyButton.addEventListener('click',async function(){
      if(sheetReviewBusy)return;
      var draft=projects.reviewDraft?projects.reviewDraft():null,confirmation=reviewConfirmation();
      var snapshot=(reviewDivergence&&reviewDivergence.snapshot)||confirmation||draft;
      if(!snapshot||!snapshot.rows||!snapshot.rows.length){sheetTell('没有可恢复的审核快照。',true);return;}
      if(!reviewBinding){sheetTell('缺少审核成果表绑定，无法恢复副本。',true);return;}
      var prepared=null,published=false;
      try{
        var restoredModel=RfqClassificationReviewModel.fromSnapshot(snapshot,reviewBinding,{});
        var name=String(reviewTargetName()).replace(/\.xlsx$/i,'')+'_恢复副本.xlsx';
        var selection=await pickReviewTarget(name);
        if(!selection||!selection.target){sheetTell('已取消恢复副本，当前内容不变。');return;}
        if(RfqProjectRestore&&RfqProjectRestore.key&&RfqProjectRestore.key(selection.target)===RfqProjectRestore.key(reviewBinding.path)){
          sheetTell('恢复副本不能写到当前成果表本身，请另选文件名。',true);return;}
        sheetReviewBusy=true;renderSheetReview();
        sheetTell('正在把项目保存的审核内容写成新副本…');
        prepared=await exportRequest('prepare',{target:selection.target,adjacent:true});
        await RfqClassificationReviewHost.write(options.application,restoredModel,prepared.stagePath,{title:name});
        var receipt=await exportRequest('commit',{ticket:prepared.ticket});
        published=true;
        await exportRequest('verify',{ticket:prepared.ticket,target:receipt.target,sha256:receipt.sha256});
        reviewBinding=RfqClassificationReviewHost.bindingFor(receipt,restoredModel,{inputKey:matchingKey(),title:name});
        if(options.setReviewBinding)options.setReviewBinding(reviewBinding);
        sheetTell('已把项目保存的审核内容写成新副本（未覆盖原成果表）：'+receipt.target+'。请核对后整表一次确认。');
        try{RfqClassificationReviewHost.openForEditing(options.application,receipt.target);}catch(_){}
        refreshReviewRead(true);
      }catch(error){sheetTell('恢复副本未完成：'+error.message,true);}
      finally{
        if(prepared&&!published){try{await exportRequest('discard',{ticket:prepared.ticket});}catch(_){}}
        sheetReviewBusy=false;renderSheetReview();
      }
    });
    if(sheetRetryButton)sheetRetryButton.addEventListener('click',function(){
      sheetTell('正在重新保存分类习惯…');
      classifier.retryMemory().then(function(ok){
        renderSheetReview();
        sheetTell(ok?'分类习惯已保存。':'分类习惯仍未保存，可再次重试。',!ok);
      });
    });
    // R6：独立分类工作簿。按整表确认快照的categoryId分组、排除无需询价，先预检全部目标（含非法名称/重名/已存在），
    // 再逐份写入→重开核→独占发布→记录SHA/状态；局部成功不显示全部完成，重试只处理未完成。
    var categoryReceipt=null,categoryPlan=null,categoryIssues=[],categoryBusy=false,categoryBlocked=null;
    function categoryEl(id){return document.getElementById(id);}
    function categoryTell(text,error){var box=categoryEl('categories-message');if(box){box.textContent=text;box.className=error?'error':'';}}
    function pad2(value){return (value<10?'0':'')+value;}
    function stampText(){
      var now=new Date();
      return String(now.getFullYear())+pad2(now.getMonth()+1)+pad2(now.getDate())+'-'+
        pad2(now.getHours())+pad2(now.getMinutes())+pad2(now.getSeconds());
    }
    function newBatchRoot(base){
      return base+'\\'+RfqCategoryWorkbooks.safeName(projectDisplayName())+'_'+stampText()+'_'+
        Math.random().toString(16).slice(2,8);
    }
    function selectedLayout(){
      var select=categoryEl('categories-layout');
      return select&&select.value?select.value:'separated';
    }
    function findCategoryFile(receipt,name){
      var found=((receipt&&receipt.files)||[]).filter(function(item){return item&&item.name===name;});
      return found.length?found[0]:null;
    }
    // 分类工作簿阶段只认“本次整表确认”的结果：成果表换新、确认版本变化都要重新生成（不覆盖旧批次）。
    function categoryVerdict(){
      if(!reviewFresh())return {ready:false,detail:'尚未完成整表审核确认'};
      if(!categoryReceipt)return {ready:false,detail:'尚未生成分类工作簿'};
      if(categoryReceipt.inputKey!==matchingKey())
        return {ready:false,detail:'分类工作簿绑定的是旧内容：请重新生成审核成果表并整表确认后再生成'};
      var confirmation=reviewConfirmation(),summary=RfqCategoryWorkbooks.summarize(categoryReceipt);
      if(!categoryReceipt.files.length)return {ready:true,detail:'全部为无需询价，无待输出的分类工作簿'};
      if(Number(categoryReceipt.reviewRevision)!==Number(confirmation.revision))
        return {ready:false,detail:'整表确认已更新（第'+(confirmation?confirmation.revision:'?')+'次），需要重新生成分类工作簿'};
      if(summary.status!=='complete')
        return {ready:false,detail:'已生成 '+summary.generated+' / '+summary.categories+' 份，尚未全部通过校验'};
      return {ready:true,detail:'分类工作簿已生成并校验（'+summary.categories+' 份）'};
    }
    function categoryFileLine(file){
      var li=node('li');
      li.appendChild(node('strong',file.name));
      li.appendChild(node('p',file.categoryName+' · '+file.rowCount+' 行 · '+
        (file.status==='succeeded'?'已生成并校验'+(file.sha256?'（SHA '+file.sha256.slice(0,12)+'…）':'')
          :(file.status==='needs-verification'?'待核对：文件被外部修改，未覆盖'
            :(file.status==='failed'?'未生成：'+(file.error||'未知原因'):'尚未生成'))),'note'));
      if(file.status==='succeeded'&&options.application){
        li.appendChild(button('打开该分类工作簿',function(){
          try{
            RfqCategoryWorkbooks.openForEditing(options.application,file.path);
            categoryTell('已打开分类工作簿：'+file.path);
          }catch(error){categoryTell('分类工作簿未打开：'+error.message,true);}
        }));
      }
      return li;
    }
    function renderCategories(){
      var banner=categoryEl('categories-banner'),progress=categoryEl('categories-progress'),stats=categoryEl('categories-stats'),
        status=categoryEl('categories-status'),list=categoryEl('categories-files'),generate=categoryEl('categories-generate'),
        retry=categoryEl('categories-retry'),rebuild=categoryEl('categories-rebuild'),layout=categoryEl('categories-layout'),
        summary=categoryEl('categories-summary'),issues=categoryEl('categories-issues');
      if(!banner)return;
      var confirmation=reviewConfirmation(),ready=!!reviewBinding&&selectionConfirmed(),fresh=reviewFresh();
      var verdict=categoryVerdict(),record=categoryReceipt;
      var counts=(record&&record.counts)||{},report=RfqCategoryWorkbooks.summarize(record);
      var generatedFiles=(record&&record.files)||[];
      if(!ready||!fresh){
        banner.textContent=ready?'整表确认已更新':'尚未完成整表审核确认';
        banner.className='result-banner';
        progress.textContent='当前进度 4 / 7 · 等待第3步整表确认';
        stats.textContent=ready?'请先在“表内审核”重新整表确认，再生成分类工作簿。'
          :'确认合并选择、生成审核成果表并整表确认后，才能生成分类工作簿。';
        status.textContent='';
      }else if(!record){
        banner.textContent='尚未生成分类工作簿';
        banner.className='result-banner';
        progress.textContent='当前进度 4 / 7 · 整表已确认（'+(confirmation?confirmation.rows.length:0)+' 行），等待生成分类工作簿';
        stats.textContent='每个询价类别一个独立.xlsx；无需询价行只保留在审核成果表中。';
        status.textContent=reviewBinding?('成果批次目录：'+RfqCategoryWorkbooks.rootOf(reviewBinding.path)+' · 分类工作簿子目录：'+
          RfqCategoryWorkbooks.batchDirectory(reviewBinding.path)):'';
      }else if(record.inputKey!==matchingKey()||Number(record.reviewRevision)!==Number(confirmation?confirmation.revision:NaN)){
        banner.textContent='分类工作簿已过期';
        banner.className='result-banner';
        progress.textContent='当前进度 4 / 7 · 清单、合并选择或整表确认已变化，需要重新生成分类工作簿';
        stats.textContent='上次生成 '+report.generated+' 份（'+(record.directory||'未记录目录')+'），不再作为当前依据。';
        status.textContent='旧文件保留且不覆盖；重新生成会创建新的成果批次目录。';
      }else if(!record.files.length){
        banner.textContent='无需输出分类工作簿';
        banner.className='result-banner is-done';
        progress.textContent='当前进度 4 / 7 · 全部为无需询价（'+counts.totalRows+' 行），没有待输出的分类工作簿';
        stats.textContent='无需询价保留在审核成果表中；不会生成空品牌表或空供应商文件。';
        status.textContent=record.createdAt?('确认时间：'+record.createdAt):'';
      }else if(report.status==='complete'){
        banner.textContent=report.text;
        banner.className='result-banner is-done';
        progress.textContent='当前进度 4 / 7 · 已生成并校验 '+report.categories+' 份分类工作簿';
        stats.textContent=report.detail+' · 无需询价保留在审核成果表。';
        status.textContent='实际目录：'+record.directory;
      }else{
        banner.textContent='已生成 '+report.generated+' / '+report.categories+' 份分类工作簿';
        banner.className='result-banner';
        progress.textContent='当前进度 4 / 7 · 分类工作簿尚未全部通过校验';
        stats.textContent=report.detail+' · 未完成 '+report.pending+' 份，可重试未完成文件。';
        status.textContent=record.directory?('实际目录：'+record.directory):'';
      }
      if(list){
        list.textContent='';
        generatedFiles.forEach(function(file){list.appendChild(categoryFileLine(file));});
      }
      if(issues){
        issues.textContent='';
        (categoryIssues||[]).slice(0,12).forEach(function(item){
          var li=node('li');
          li.appendChild(node('strong',item.title||'生成问题'));
          li.appendChild(node('p',item.message,'note'));
          issues.appendChild(li);
        });
      }
      if(generate){
        generate.disabled=categoryBusy||!ready||!fresh||!options.application;
        generate.textContent=record&&record.files.length?'重新生成分类工作簿（新批次）':'生成分类工作簿';
      }
      if(retry)retry.hidden=!(record&&record.files.length&&report.status!=='complete');
      if(retry)retry.disabled=categoryBusy||!options.application;
      if(rebuild)rebuild.hidden=!(categoryBlocked&&categoryBlocked.length);
      // 只有“本次整表确认对应的分类工作簿全部核实通过”才解锁布局与生成汇总；过期批次不得解锁。
      var unlocked=!!record&&report.status==='complete'&&verdict.ready===true;
      if(layout){layout.disabled=!unlocked;if(record&&record.layout)layout.value=record.layout;}
      if(summary)summary.disabled=!unlocked;
      if(status&&!verdict.ready&&verdict.detail)status.textContent=(status.textContent?status.textContent+' · ':'')+verdict.detail;
    }
    function categoryIssueText(list){
      return (list||[]).map(function(item){return item.title+'：'+item.message;}).join('；');
    }
    async function persistCategories(message,error){
      var receipt=await projects.save();
      if(!receipt){categoryTell(message+(projects.lastError&&projects.lastError()?('（项目记录未保存：'+projects.lastError().message+'）'):''),true);return null;}
      if(error)categoryTell(message,true);
      return receipt;
    }
    async function generateCategoryWorkbooks(opts){
      var input=opts||{};
      if(categoryBusy)return {ok:false,busy:true};
      if(!options.application){categoryTell('请在WPS内打开侧栏，才能生成分类工作簿。',true);return {ok:false};}
      var confirmation=reviewConfirmation();
      if(!reviewFresh()||!confirmation){categoryTell('请先在“表内审核”完成整表确认，再生成分类工作簿。',true);renderCategories();return {ok:false};}
      if(!reviewBinding||!reviewBinding.path){categoryTell('缺少审核成果表绑定，请重新生成审核成果表后整表确认。',true);return {ok:false};}
      categoryBlocked=null;
      var base=RfqCategoryWorkbooks.rootOf(reviewBinding.path);
      // 首次生成用成果表所在目录（图04：项目名/分类工作簿）；同一版整表确认的续作沿用已记录批次；
      // 重新生成或整表确认有变化时另建批次目录，不覆盖已生成的分类工作簿与已填汇总。
      var continuing=!input.force&&categoryReceipt&&categoryReceipt.inputKey===matchingKey()&&categoryReceipt.root&&
        Number(categoryReceipt.reviewRevision)===Number(confirmation.revision);
      var root=continuing?categoryReceipt.root:base,plan=null;
      if(!continuing){
        try{
          var probe=RfqCategoryWorkbooks.plan(confirmation,{binding:reviewBinding,
            directory:RfqCategoryWorkbooks.batchDirectory(reviewBinding.path),inputKey:matchingKey(),root:base});
          for(var index=0;index<probe.files.length;index++){
            var check=await exportRequest('inspect',{target:probe.files[index].path});
            if(check.exists){root=newBatchRoot(base);break;}
          }
        }catch(error){/* 预检问题留给正式plan报出 */ }
      }
      try{
        plan=RfqCategoryWorkbooks.plan(confirmation,{binding:reviewBinding,
          directory:RfqCategoryWorkbooks.workbookDirectory(root),inputKey:matchingKey(),root:root,
          batchId:continuing?(categoryReceipt&&categoryReceipt.batchId)||null:RfqProject.newId()});
      }catch(error){categoryTell('分类工作簿未生成：'+error.message,true);renderCategories();return {ok:false};}
      categoryPlan=plan;categoryIssues=plan.issues.slice();renderCategories();
      if(!plan.ok){categoryTell('分类工作簿未生成：'+categoryIssueText(plan.issues),true);return {ok:false};}
      if(!plan.files.length){
        categoryReceipt=RfqCategoryWorkbooks.receipt(plan,{layout:selectedLayout()});
        categoryReceipt.status='empty';categoryReceipt.reviewRevision=confirmation.revision;
        await persistCategories('本次全部为无需询价，无待输出的分类工作簿。');
        renderCategories();render();
        return {ok:true,empty:true,receipt:categoryReceipt};
      }
      categoryBusy=true;renderCategories();
      var receipt=(categoryReceipt&&categoryReceipt.inputKey===matchingKey()&&categoryReceipt.root===plan.root)?
        categoryReceipt:RfqCategoryWorkbooks.receipt(plan,{layout:selectedLayout()});
      var entriesByName={};
      plan.files.forEach(function(entry){entriesByName[entry.file]=entry;});
      receipt.layout=selectedLayout();receipt.reviewRevision=confirmation.revision;receipt.root=plan.root;
      receipt.directory=plan.directory;
      receipt.files.forEach(function(file){
        var previous=findCategoryFile(categoryReceipt,file.name);
        // 只有同一批次、同一路径的已成功文件才按记录SHA跳过；换批次不能沿用旧批次的状态。
        if(previous&&previous.path===file.path&&previous.sha256&&previous.status==='succeeded'){
          file.sha256=previous.sha256;file.bytes=previous.bytes;file.status='succeeded';
        }
      });
      categoryReceipt=receipt;
      try{
        // 1) 已成功的文件按记录SHA核对：通过则跳过，被外部改写时拒绝覆盖。
        var pending=[],blocked=[];
        for(index=0;index<receipt.files.length;index++){
          var record=receipt.files[index];
          if(record.status==='succeeded'){
            try{
              var actual=await exportRequest('inspect',{target:record.path,sha256:record.sha256});
              if(actual.matches){record.bytes=actual.bytes;continue;}
              record.status='needs-verification';
              record.error=actual.exists?'文件已被外部修改，未覆盖':'文件已不存在';
              blocked.push({file:record,error:record.error});
              continue;
            }catch(error){
              record.status='needs-verification';record.error=error.message;
              blocked.push({file:record,error:error.message});continue;
            }
          }
          pending.push(record);
        }
        if(blocked.length){
          categoryBlocked=blocked;
          receipt.updatedAt=new Date().toISOString();receipt.status=RfqCategoryWorkbooks.statusOf(receipt);
          await persistCategories('分类工作簿未全部生成：'+categoryIssueText(blocked.map(function(item){
            return {title:item.file.name,message:item.error};})),true);
          renderCategories();render();
          return {ok:false,blocked:blocked};
        }
        // 2) 先预检全部目标（目标是否存在、文件名是否合法、目录是否可用），全部通过才写第一份。
        var tickets=[];
        for(index=0;index<pending.length;index++){
          try{
            var prepared=await exportRequest('prepare',{target:pending[index].path,createParent:true});
            tickets.push({file:pending[index],ticket:prepared.ticket,stagePath:prepared.stagePath});
          }catch(error){
            blocked.push({file:pending[index],error:error.message});
          }
        }
        if(blocked.length){
          categoryBlocked=blocked;categoryIssues=categoryIssues.concat(blocked.map(function(item){
            return {code:'target-blocked',title:'目标不可用：'+item.file.name,message:item.error};}));
          categoryTell('分类工作簿未生成（先检查全部目标，未写任何文件）：'+categoryIssueText(blocked.map(function(item){
            return {title:item.file.name,message:item.error};})),true);
          renderCategories();render();
          return {ok:false,blocked:blocked};
        }
        // 3) 逐份写入→重开核→独占发布→记录SHA/状态；每份成功立即落盘回执。
        var succeededBefore=receipt.files.filter(function(file){return file.status==='succeeded';}).length,
          succeeded=0,failed=0;
        for(index=0;index<tickets.length;index++){
          var item=tickets[index];
          try{
            var entry=entriesByName[item.file.name];
            if(!entry)throw Error('本次分组里找不到“'+item.file.name+'”的材料行，请重新生成分类工作簿。');
            await RfqCategoryWorkbooks.write(options.application,entry,item.stagePath,{batchId:receipt.batchId});
            var published=await exportRequest('commit',{ticket:item.ticket});
            await exportRequest('verify',{ticket:item.ticket,target:published.target,sha256:published.sha256});
            item.file.status='succeeded';item.file.sha256=published.sha256;item.file.bytes=published.bytes;item.file.error=null;
            succeeded++;
          }catch(error){
            item.file.status='failed';item.file.error=error.message;failed++;
          }
          // 落盘前先按真实状态更新回执状态，避免侧栏显示“全部完成”时记录里还是未完成。
          receipt.updatedAt=new Date().toISOString();receipt.status=RfqCategoryWorkbooks.statusOf(receipt);
          if(succeeded>0||succeededBefore>0)await projects.save();
          renderCategories();
        }
        receipt.status=RfqCategoryWorkbooks.statusOf(receipt);
        categoryReceipt=receipt;
        if(succeeded>0||succeededBefore>0)await projects.save();
        // 4) 全部核实后才显示完成、真实目录、数量，并解锁布局选择与生成汇总。
        if(receipt.status==='complete'){
          var report=RfqCategoryWorkbooks.summarize(receipt),opened=[];
          receipt.files.forEach(function(file){
            try{RfqCategoryWorkbooks.openForEditing(options.application,file.path);opened.push(file.name);}catch(_){}
          });
          categoryTell('已生成并校验 '+report.categories+' 份分类工作簿（'+report.detail+'）：'+receipt.directory+
            (opened.length?'。已打开：'+opened.join('、'):'。可在下方逐份打开。'));
          renderCategories();render();
          return {ok:true,receipt:receipt,plan:plan};
        }
        categoryTell('分类工作簿未全部生成：'+succeeded+' / '+receipt.files.length+' 份成功'+
          (failed?'，'+failed+' 份失败':'')+'。可点“重试未完成文件”；已成功的文件按SHA跳过，原文件不变。',true);
        renderCategories();render();
        return {ok:false,receipt:receipt};
      }catch(error){
        categoryTell('分类工作簿未生成：'+error.message,true);
        return {ok:false};
      }finally{categoryBusy=false;renderCategories();}
    }
    var categoryGenerateButton=categoryEl('categories-generate'),categoryRetryButton=categoryEl('categories-retry'),
      categoryRebuildButton=categoryEl('categories-rebuild'),categorySummaryButton=categoryEl('categories-summary'),
      categoryLayoutSelect=categoryEl('categories-layout');
    if(categoryGenerateButton)categoryGenerateButton.addEventListener('click',function(){
      var regenerate=!!(categoryReceipt&&categoryReceipt.files.length);
      if(regenerate&&!window.confirm('重新生成会创建新的成果批次目录，不会覆盖已生成的分类工作簿和已填汇总，是否继续？'))return;
      generateCategoryWorkbooks(regenerate?{force:true}:{}).catch(function(error){
        categoryTell('分类工作簿未生成：'+error.message,true);
      });
    });
    if(categoryRetryButton)categoryRetryButton.addEventListener('click',function(){
      generateCategoryWorkbooks({}).catch(function(error){categoryTell('分类工作簿重试失败：'+error.message,true);});
    });
    if(categoryRebuildButton)categoryRebuildButton.addEventListener('click',function(){
      generateCategoryWorkbooks({force:true}).catch(function(error){categoryTell('分类工作簿未生成：'+error.message,true);});
    });
    if(categoryLayoutSelect)categoryLayoutSelect.addEventListener('change',function(){
      if(categoryReceipt)categoryReceipt.layout=selectedLayout();
      if(summaryLayoutSelect)summaryLayoutSelect.value=selectedLayout();
      categoryTell('品牌填写布局已选择为“'+(selectedLayout()==='combined'?'品牌与供应商同格填写':'品牌、供应商分列')+
        '”，将在生成分类汇总表时使用。');
      renderBrands();
    });
    if(categorySummaryButton)categorySummaryButton.addEventListener('click',function(){
      // 图04主按钮：切到第5步并按当前布局生成分类汇总表（同名文件已存在时另存新文件，不覆盖）。
      if(workflow)workflow.goTo('brands');
      generateSummary({auto:true}).catch(function(error){summaryTell('分类汇总表未生成：'+error.message,true);});
    });
    // R7：分类汇总表（图05A/05B）。按R6已核实的分类清单生成一类一行，名称加蓝色下划线原生链接指向对应
    // 独立分类工作簿；相邻暂存生成并核最终位置链接，两种布局功能一致，品牌与供应商初始空白由用户在表内填写。
    var summaryReceipt=null,summaryRead=null,summaryBusy=false,summaryIssues=[];
    function summaryEl(id){return document.getElementById(id);}
    function summaryTell(text,error){var box=summaryEl('brands-message');if(box){box.textContent=text;box.className=error?'error':'';}}
    function summaryLayoutLabel(value){return String(value)==='combined'?'品牌与供应商同格填写':'品牌、供应商分列';}
    function summaryDirectory(){return RfqCategoryWorkbooks.directoryOf(categoryReceipt.directory);}
    // 汇总表只收录R6已核实通过的分类工作簿；未完成或过期的批次不允许生成汇总。
    function summaryCategories(){
      return ((categoryReceipt&&categoryReceipt.files)||[]).filter(function(file){
        return file&&file.status==='succeeded';}).map(function(file){
        return {categoryId:file.categoryId,categoryName:file.categoryName,rowCount:file.rowCount,path:file.path,sha256:file.sha256};
      });
    }
    // 汇总表阶段只认“本次整表确认对应的分类工作簿＋本次布局”：任一变化都要重新生成，不沿用旧绑定。
    function summaryState(){
      var categories=categoryVerdict();
      if(!categories.ready)return {ok:false,reason:categories.detail||'分类工作簿未生成'};
      if(!summaryCategories().length)return {ok:false,reason:'没有需要询价的类别，无分类汇总表'};
      if(!summaryReceipt)return {ok:false,reason:'尚未生成分类汇总表'};
      if(summaryReceipt.inputKey!==matchingKey())return {ok:false,reason:'分类汇总表绑定的是旧内容：请重新生成'};
      var confirmation=reviewConfirmation();
      if(Number(summaryReceipt.reviewRevision)!==Number(confirmation?confirmation.revision:NaN))
        return {ok:false,reason:'整表确认已更新，需要重新生成分类汇总表'};
      if(summaryReceipt.categoryDirectory!==categoryReceipt.directory)
        return {ok:false,reason:'分类工作簿批次已更新，需要重新生成分类汇总表'};
      if(summaryReceipt.layout!==selectedLayout())
        return {ok:false,reason:'品牌填写布局已改变，需要按新布局重新生成分类汇总表'};
      var bound={},files=summaryCategories();
      (summaryReceipt.categories||[]).forEach(function(item){bound[item.categoryId]=true;});
      if(files.some(function(file){return !bound[file.categoryId];}))
        return {ok:false,reason:'分类清单已变化，需要重新生成分类汇总表'};
      return {ok:true,receipt:summaryReceipt};
    }
    // 图05→06的“品牌汇总”阶段：生成汇总表后仍需在表内填写并读回（R8）。只有按稳定类别ID读回、校验通过且绑定
    // 仍是当前内容/布局/文件时才算完成；读回结果里的品牌组就是询价与拆分的唯一品牌来源。
    function summaryVerdict(){
      var state=summaryState();
      if(!state.ok)return {ready:false,detail:state.reason};
      if(!summaryRead)return {ready:false,generated:true,detail:'分类汇总表已生成（'+summaryReceipt.categories.length+
        ' 类，'+summaryLayoutLabel(summaryReceipt.layout)+'），请在表内填写品牌与供应商后点“填写完成，生成询价表”读回'};
      if(summaryRead.inputKey!==matchingKey())return {ready:false,detail:'品牌读回绑定的是旧内容：请重新读回汇总表'};
      if(String(summaryRead.summaryPath||'')!==String(summaryReceipt.path||'')||summaryRead.layout!==summaryReceipt.layout)
        return {ready:false,detail:'汇总表已变化，请重新读回汇总表'};
      return {ready:true,generated:true,rows:summaryRead.categories,
        detail:'品牌与供应商已填写并读回（'+summaryRead.categories.length+' 类 · 预计 '+
          RfqBrandModel.summaryCountsText(summaryRead.categories)+'，共 '+summaryRead.expectedSheets+' 份询价表）'};
    }
    // 询价/拆分的业务内容：只取当前有效的读回结果，过期或未读回时为空，避免沿用旧品牌。
    function currentBrandGroups(){
      var verdict=summaryVerdict();
      return verdict.ready?verdict.rows:null;
    }
    function summaryFileLine(file){
      var li=node('li'),fileName=file.file||String(file.path||'').split(/[\\/]/).pop();
      li.appendChild(node('strong',file.categoryName));
      li.appendChild(node('p',file.rowCount+' 行 · 链接目标：'+fileName+(file.relative?'（'+file.relative+'）':''),'note'));
      if(options.application){
        li.appendChild(button('打开该分类工作簿',function(){
          try{
            RfqCategoryWorkbooks.openForEditing(options.application,file.path);
            summaryTell('已打开分类工作簿：'+file.path);
          }catch(error){summaryTell('分类工作簿未打开：'+error.message,true);}
        }));
      }
      return li;
    }
    function renderBrands(){
      var banner=summaryEl('brands-banner'),progress=summaryEl('brands-progress'),stats=summaryEl('brands-stats'),
        status=summaryEl('brands-status'),list=summaryEl('brands-list'),generate=summaryEl('brands-generate'),
        open=summaryEl('brands-open'),layoutSelect=summaryEl('brands-layout'),confirm=summaryEl('brands-confirm'),
        issues=summaryEl('brands-issues');
      if(!banner)return;
      var categories=categoryVerdict(),files=summaryCategories(),state=summaryState(),record=summaryReceipt;
      if(!categories.ready){
        banner.textContent='尚未生成分类工作簿';banner.className='result-banner';
        progress.textContent='当前进度 5 / 7 · 等待第4步分类工作簿全部核实通过';
        stats.textContent='确认合并选择、整表确认并生成独立分类工作簿后，才能生成分类汇总表。';
        status.textContent=categories.detail||'';
      }else if(!record){
        banner.textContent='尚未生成分类汇总表';banner.className='result-banner';
        progress.textContent='当前进度 5 / 7 · 分类工作簿已生成（'+files.length+' 类），等待生成分类汇总表';
        stats.textContent='一类一行；名称是蓝色下划线链接，点击打开对应独立分类工作簿；品牌与供应商初始空白。';
        status.textContent='汇总表目录：'+summaryDirectory();
      }else if(!state.ok){
        banner.textContent='分类汇总表已过期';banner.className='result-banner';
        progress.textContent='当前进度 5 / 7 · 分类工作簿或整表确认已变化，需要重新生成分类汇总表';
        stats.textContent='上次生成 '+record.categories.length+' 类（'+(record.path||'未记录路径')+'），不再作为当前依据。';
        status.textContent=state.reason;
      }else{
        var verdict=summaryVerdict();
        if(verdict.ready){
          banner.textContent='品牌与供应商已读回（'+record.categories.length+' 类）';banner.className='result-banner is-done';
          progress.textContent='当前进度 5 / 7 · 品牌与供应商已读回，可进入第6步生成询价表';
          stats.textContent='预计 '+summaryRead.expectedSheets+' 份询价表（'+RfqBrandModel.summaryCountsText(summaryRead.categories)+
            '）· 布局“'+summaryLayoutLabel(record.layout)+'”';
          status.textContent='实际文件：'+record.path;
        }else{
          banner.textContent='分类汇总表已生成（'+record.categories.length+' 类）';banner.className='result-banner is-done';
          progress.textContent='当前进度 5 / 7 · 在汇总表黄色区填写品牌与供应商后点“填写完成，生成询价表”';
          stats.textContent=record.categories.length+' 类 · '+record.categories.reduce(function(total,item){return total+item.rowCount;},0)+
            ' 行纳入询价 · 布局“'+summaryLayoutLabel(record.layout)+'”';
          status.textContent='实际文件：'+record.path+(verdict.detail?' · '+verdict.detail:'');
        }
      }
      if(list){
        list.textContent='';
        (record&&record.categories?record.categories:files).forEach(function(file){list.appendChild(summaryFileLine(file));});
      }
      if(issues){
        issues.textContent='';
        (summaryIssues||[]).slice(0,12).forEach(function(item){
          var li=node('li');
          li.appendChild(node('strong',item.title||'生成问题'));
          li.appendChild(node('p',item.message,'note'));
          issues.appendChild(li);
        });
      }
      if(generate){
        generate.disabled=summaryBusy||!categories.ready||!options.application;
        generate.textContent=record?'重新生成分类汇总表（新文件）':'生成分类汇总表';
      }
      if(open)open.disabled=summaryBusy||!record||!options.application;
      if(confirm){confirm.disabled=summaryBusy||!state.ok;confirm.textContent='填写完成，生成询价表';}
      if(layoutSelect){layoutSelect.disabled=!categories.ready;layoutSelect.value=selectedLayout();}
      if(status&&!state.ok&&state.reason&&record)status.textContent=(status.textContent?status.textContent+' · ':'')+state.reason;
    }
    async function generateSummary(){
      if(summaryBusy)return {ok:false,busy:true};
      if(!options.application){summaryTell('请在WPS内打开侧栏，才能生成分类汇总表。',true);return {ok:false};}
      var files=summaryCategories();
      if(!categoryVerdict().ready||!files.length){
        summaryTell('请先在第4步生成并核实全部独立分类工作簿，再生成分类汇总表。',true);renderBrands();return {ok:false};}
      summaryBusy=true;renderBrands();
      var prepared=null,published=null;
      try{
        var directory=summaryDirectory(),layoutName=selectedLayout(),target=directory+'\\分类汇总表.xlsx';
        // 同名文件已存在时另存时间戳新文件，绝不覆盖已生成的汇总表与已填内容。
        var probe=await exportRequest('inspect',{target:target});
        if(probe.exists)target=directory+'\\分类汇总表_'+stampText()+'.xlsx';
        var plan=RfqBrandModel.summaryPlan(files,{directory:directory,inputKey:matchingKey(),layout:layoutName,
          projectName:projectDisplayName()});
        summaryIssues=plan.issues.slice();renderBrands();
        if(!plan.ok){
          summaryTell('分类汇总表未生成：'+summaryIssues.map(function(item){return item.title+'：'+item.message;}).join('；'),true);
          return {ok:false};
        }
        // 相对链接必须在最终目录里的唯一相邻暂存生成，整目录搬移后链接仍然正确。
        prepared=await exportRequest('prepare',{target:target,adjacent:true});
        var workbook=RfqBrandModel.buildSummary(plan,{});
        await RfqBrandHost.summaryWrite(options.application,workbook,prepared.stagePath);
        published=await exportRequest('commit',{ticket:prepared.ticket});
        await exportRequest('verify',{ticket:prepared.ticket,target:published.target,sha256:published.sha256});
        var binding=RfqBrandModel.summaryBindingFor(published.target,workbook);
        summaryReceipt=Object.assign({},binding,{sha256:published.sha256,bytes:published.bytes,directory:directory,
          categoryDirectory:categoryReceipt.directory,reviewRevision:(reviewConfirmation()||{}).revision,
          categoryBatch:categoryReceipt.batchId,
          createdAt:new Date().toISOString(),status:'complete'});
        // 重新生成（含改布局另存新文件）后旧读回结果一律作废，必须重新读回才算完成。
        summaryRead=null;summaryIssues=[];
        await projects.save();
        summaryTell('已生成并校验分类汇总表（'+summaryReceipt.categories.length+' 类，'+summaryLayoutLabel(layoutName)+
          '）：'+summaryReceipt.path+'。请在黄色区域填写品牌与供应商。');
        renderBrands();render();
        return {ok:true,receipt:summaryReceipt};
      }catch(error){summaryTell('分类汇总表未生成：'+error.message,true);return {ok:false};}
      finally{
        // 未发布就失败/被取消时清掉本次相邻暂存，避免分类工作簿目录里留下点号临时文件。
        if(prepared&&!published){try{await exportRequest('discard',{ticket:prepared.ticket});}catch(_){}}
        summaryBusy=false;renderBrands();
      }
    }
    var summaryGenerateButton=summaryEl('brands-generate'),summaryOpenButton=summaryEl('brands-open'),
      summaryConfirmButton=summaryEl('brands-confirm'),summaryLayoutSelect=summaryEl('brands-layout');
    if(summaryGenerateButton)summaryGenerateButton.addEventListener('click',function(){
      var regenerate=!!summaryReceipt;
      if(regenerate&&!window.confirm('重新生成会另存新的分类汇总表文件，不覆盖已生成文件与已填内容，是否继续？'))return;
      generateSummary().catch(function(error){summaryTell('分类汇总表未生成：'+error.message,true);});
    });
    if(summaryOpenButton)summaryOpenButton.addEventListener('click',function(){
      if(!summaryReceipt){summaryTell('尚未生成分类汇总表。',true);return;}
      try{
        RfqBrandHost.openSummary(options.application,summaryReceipt.path);
        summaryTell('已打开分类汇总表：'+summaryReceipt.path);
      }catch(error){summaryTell('分类汇总表未打开：'+error.message,true);}
    });
    // R8主按钮：读取最新汇总表、按稳定类别ID校验并保存品牌组，显示有效类别与预计份数；无侧栏二次品牌确认。
    async function readSummaryBrands(){
      if(summaryBusy)return {ok:false,busy:true};
      if(!options.application){summaryTell('请在WPS内打开侧栏，才能读取分类汇总表。',true);return {ok:false};}
      var state=summaryState();
      if(!state.ok){summaryTell('还不能读取汇总表：'+state.reason,true);renderBrands();return {ok:false};}
      summaryBusy=true;renderBrands();
      try{
        var result=RfqBrandHost.readSummary(options.application,summaryReceipt);
        if(!result.ok){
          // 校验失败：保留用户在表内的填写，逐条定位到具体单元格，不放行也不改动汇总表。
          summaryIssues=(result.issues||[]).slice();renderBrands();
          // 当前表内内容已经和上次读回不一致，旧读回结果必须作废并落盘，阶段不得继续显示完成。
          if(summaryRead){summaryRead=null;try{await projects.save();}catch(_){}}
          var first=(result.issues||[]).slice(0,3).map(function(item){return item.message;}).join('；');
          summaryTell('汇总表未通过校验，请按下方定位在表内修改后重试：'+first,true);
          return {ok:false,result:result};
        }
        summaryIssues=[];
        // 表内填写保存后文件SHA会改变；重新读回通过时同步当前物理文件，避免重开误用生成空表时的SHA。
        var actualSummary=await exportRequest('inspect',{target:summaryReceipt.path});
        if(!actualSummary.exists||actualSummary.target!==summaryReceipt.path||!/^[a-f\d]{64}$/i.test(actualSummary.sha256||''))
          throw Error('分类汇总表文件校验未完成，请确认文件存在后重试。');
        summaryReceipt=Object.assign({},summaryReceipt,{sha256:actualSummary.sha256,bytes:actualSummary.bytes});
        summaryRead=Object.assign(RfqBrandModel.summaryReadRecord(result,{summaryPath:summaryReceipt.path,
          readAt:new Date().toISOString()}),{sourceSha256:summaryReceipt.sha256||null});
        renderBrands();
        await projects.save();
        summaryTell('已读回并校验汇总表：'+summaryRead.categories.length+' 类有效，预计 '+summaryRead.expectedSheets+
          ' 份询价表（'+RfqBrandModel.summaryCountsText(summaryRead.categories)+'）。品牌取自汇总表，改品牌请回汇总表修改并重新读回。');
        renderBrands();render();
        // 图05A→06：读回通过后进入第6步生成总询价工作簿（品牌唯一来源即本次读回结果）。
        if(workflow)workflow.goTo('inquiry');
        return {ok:true,read:summaryRead};
      }catch(error){summaryTell('汇总表未读回：'+error.message,true);return {ok:false};}
      finally{summaryBusy=false;renderBrands();}
    }
    if(summaryConfirmButton)summaryConfirmButton.addEventListener('click',function(){
      readSummaryBrands().catch(function(error){summaryTell('汇总表未读回：'+error.message,true);});
    });
    if(summaryLayoutSelect)summaryLayoutSelect.addEventListener('change',function(){
      if(categoryReceipt)categoryReceipt.layout=summaryLayoutSelect.value;
      if(categoryLayoutSelect)categoryLayoutSelect.value=summaryLayoutSelect.value;
      renderBrands();
      summaryTell('品牌填写布局已选择为“'+summaryLayoutLabel(summaryLayoutSelect.value)+'”，生成的分类汇总表将使用该布局。');
    });
    picker.disabled=!options.application||!window.__RFQ_IMPORT__;
    if(options.application&&!window.__RFQ_IMPORT__)tell('多文件导入需要启动最新开发服务并重新打开侧栏。');
    // 导入主体：选路径的方式（系统对话框或侧栏内置选择器）不同，复制、读取、渲染完全一致。
    async function runImport(select){
      if(busy)return;
      var added=false;
      try{
        var paths=await select();if(!paths.length){tell('已取消文件选择，原列表保留。');return;}
        busy=true;options.onBusy(true);tell('正在复制原件并检查重复…');
        var response=await fetch('/api/import/prepare',{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},
          body:JSON.stringify({paths:paths,existing:collection.entries.map(function(e){return e.metadata;})})});
        var prepared=await response.json();if(!response.ok)throw Error(prepared.error||'准备文件失败。');
        if(!prepared||!Array.isArray(prepared.files)||prepared.files.length!==paths.length||prepared.files.some(function(m){
          return !m||typeof m.originalPath!=='string'||!m.originalPath||typeof m.originalName!=='string'||!m.originalName||
            typeof m.copyPath!=='string'||!m.copyPath||!/^[a-f\d]{64}$/i.test(m.fingerprint);
        }))throw Error('服务返回的副本列表不完整，请重新打开侧栏后重试。');
        var entries=[];
        for(var i=0;i<prepared.files.length;i++){
          tell('正在读取工作副本 '+(i+1)+' / '+prepared.files.length+'：'+prepared.files[i].originalName);
          await new Promise(function(resolve){setTimeout(resolve,0);});
          prepared.files[i].importedAt=new Date().toISOString();
          entries.push({metadata:prepared.files[i],snapshot:RfqImportHost.readCopy(options.application,prepared.files[i])});
        }
        var next=RfqCollection.add(collection,entries);collection=next;added=true;render();
        if(!selected)activate(collection.entries[0].id);
        tell('已导入 '+entries.length+' 份清单。原件未打开；是否合并由下方选项决定。');
      }catch(error){tell((added?'文件已加入，但界面更新失败，请重新选择文件核对。':'本批未加入，已有列表保留。')+error.message,true);}
      // 导入结束后必须再渲染一次：导入过程中的渲染发生在busy=true时，控件会保持禁用。
      finally{busy=false;options.onBusy(false);render();}
    }
    picker.addEventListener('click',function(){return runImport(function(){return RfqImportHost.selectFiles(options.application);});});
    // 侧栏内置选择器：原生模态文件对话框会让侧栏停止出帧（2026-09-26实机证据），这里不创建任何原生窗口。
    var browse=document.getElementById('browse-files');
    var canBrowse=!!(options.application&&browse&&window.RfqPathPicker&&window.__RFQ_IMPORT__&&window.__RFQ_IMPORT__.browse);
    if(browse){
      browse.hidden=!canBrowse;browse.disabled=!canBrowse;
      browse.addEventListener('click',function(){
        if(!canBrowse||busy)return;
        browse.disabled=true;
        function done(){if(canBrowse)browse.disabled=false;}
        runImport(function(){
          var startPath='';
          try{startPath=window.localStorage.getItem('rfq-browse-import-v1')||'';}catch(_){startPath='';}
          return new Promise(function(resolve,reject){
            RfqPathPicker.open({mode:'files',extensions:['.xls','.xlsx'],token:window.__RFQ_IMPORT__.token,startPath:startPath,
              title:'选择要导入的清单',confirmLabel:'导入选中的清单',
              onConfirm:function(paths){
                try{window.localStorage.setItem('rfq-browse-import-v1',String(paths[0]).replace(/[\\/][^\\/]*$/,''));}catch(_){}
                resolve(paths);
              },
              onCancel:function(){resolve([]);},
              onError:function(message){reject(Error(message));}});
          });
        }).then(done,done);
      });
    }
    render();
    return {
      update:function(id,record,dirty){collection=RfqCollection.update(collection,id,record,dirty);render();},
      hasUnsaved:function(){return collection.entries.some(function(e){return e.dirty;});},
      clearSelection:function(){selected=null;render();}
    };
  }
  window.RfqImportUI={create:create};
}());
