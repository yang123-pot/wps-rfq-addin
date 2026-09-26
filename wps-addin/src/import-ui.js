(function(){
  'use strict';
  function node(tag,text,className){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;}
  function button(text,action){var e=node('button',text,'locate');e.type='button';e.addEventListener('click',action);return e;}
  function create(options){
    var collection=RfqCollection.create(),selected=null,page=0,busy=false;
    var mergeConfirmedKey=null;
    var picker=document.getElementById('import-files'),message=document.getElementById('import-message');
    var merge=document.getElementById('merge-identical');merge.checked=false;
    var mergeSeparate=document.getElementById('merge-separate');
    var mergeDetail=document.getElementById('merge-detail');
    var workflow=window.RfqWorkflowUI?window.RfqWorkflowUI.create({}):null;
    var confirmMerge=document.getElementById('confirm-merge');
    var exporter=RfqExportUI.create({application:options.application,getCollection:function(){return collection;},
      mergeIdentical:function(){return merge.checked;},onBusy:function(value){busy=value;options.onBusy(value);}});
    var projects=RfqProjectUI.create({getCollection:function(){return collection;},mergeIdentical:function(){return merge.checked;},
      restore:function(project){return restoreProject(project);},getClassification:function(){return classifier.snapshot();},
      getReviewBinding:function(){return reviewBinding;},
      restoreReviewBinding:function(value){reviewBinding=value||null;return reviewBinding;},
      setReviewBinding:function(value){reviewBinding=value||null;},
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
      getBrandVerdict:function(){
        var brand=brandPanel?brandPanel.verdict():null;
        if(!brand||!brand.ready)return brand||{ready:false,detail:'尚未建立品牌行'};
        var head=headerPanel?headerPanel.verdict():null;
        if(!head||!head.ready)return head||{ready:false,detail:'询价抬头未填写'};
        return {ready:true,detail:'品牌、供应商与抬头已确认'};
      },
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
    function stageVerdicts(){
      var rows=classifier.rows(),snapshot=classifier.snapshot(),decided={};
      ((snapshot&&snapshot.decisions)||[]).forEach(function(d){if(d&&d.rowId)decided[d.rowId]=true;});
      var pending=rows.filter(function(row){return !row||!decided[row.rowId];}).length;
      var matched=!!reviewModel&&selectionConfirmed();
      return {
        matching:matched?{ready:true,detail:'自动匹配完成，尚未人工确认'}
          :{ready:false,detail:'尚未生成自动分类建议'},
        review:rows.length?(pending?{ready:false,detail:'还有'+pending+'行未确认分类'}
          :{ready:true,detail:'分类已确认（过渡期沿用侧栏逐行确认）'})
          :{ready:false,detail:'尚未生成自动分类建议'},
        categories:{ready:false,detail:'分类工作簿将在下一个开发包生成'}};
    }
    function brandContext(){
      var preview=collection.entries.length?RfqCollection.preview(collection,merge.checked):null,verdicts=stageVerdicts();
      return {collection:collection,mergeIdentical:merge.checked===true,preview:preview,
        classification:classifier.snapshot(),rows:classifier.rows(),mergeConfirmedKey:mergeConfirmedKey,
        matching:verdicts.matching,review:verdicts.review,categories:verdicts.categories};
    }
    var classifier=RfqClassificationUI.create({application:options.application,getCollection:function(){return collection;},
      mergeIdentical:function(){return merge.checked;},getMergedTarget:function(){return exporter.last();},
      getProjectId:function(){return projects.identity();},
      onMemoryChange:function(state){if(libraryPanel)libraryPanel.adoptMemory(state);},
      onChange:function(){if(brandPanel)brandPanel.refresh();},
      onBusy:function(value){busy=value;options.onBusy(value);}});
    libraryPanel=RfqLibraryUI.create({onChange:function(state){classifier.adopt(state);}});
    brandPanel=RfqBrandUI.create({application:options.application,context:brandContext,
      onChange:function(){if(inquiryPanel)inquiryPanel.refresh();if(splitPanel)splitPanel.refresh();},
      onBusy:function(value){busy=value;options.onBusy(value);}});
    headerPanel=RfqHeaderUI.create({});
    // 生成面板的输入：汇总表品牌数据、询价抬头、当前清单分组与分类确认，以及生成用内容键。
    function deliveryContext(){
      var ctx=brandContext();
      ctx.assignments=brandPanel?brandPanel.data():null;
      ctx.header=headerPanel?headerPanel.header():null;
      var report=RfqProject.assess(ctx);
      return {brandTable:ctx.assignments,header:ctx.header,
        groups:ctx.preview?ctx.preview.groups:[],classification:ctx.classification,inputKey:report.generationKey};
    }
    inquiryPanel=RfqInquiryUI.create({application:options.application,context:deliveryContext,
      onBusy:function(value){busy=value;options.onBusy(value);}});
    splitPanel=RfqSplitUI.create({application:options.application,context:deliveryContext,
      generation:function(){return inquiryPanel?inquiryPanel.generation():null;},
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
        if(brandPanel)brandPanel.refresh();return;
      }
      var result=RfqCollection.preview(collection,merge.checked),pages=Math.max(1,Math.ceil(result.groups.length/20));page=Math.min(page,pages-1);
      var mergeConfirmed=mergeConfirmedKey===RfqProject.contentKey({collection:collection,mergeIdentical:merge.checked===true,groups:result.groups});
      exporter.refresh(result);
      // R3：确认选择前不进入匹配——未确认时不给任何分类建议，避免越过“先选是否合并”。
      classifier.refresh(mergeConfirmed?result:{groups:[],inputCount:result.inputCount,outputCount:0,issues:[],canFinalize:false});
      // R4：确认合并选择后跑自动分类，得出建议并准备成果表；这一步不确认也不学习。
      reviewModel=mergeConfirmed?buildReview():null;
      renderReview();
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
      var section=document.getElementById('merge-section'),list=document.getElementById('merge-list');
      if(section)section.hidden=false;
      if(list&&typeof list.scrollIntoView==='function')list.scrollIntoView({block:'start'});
      tell('下方为合并预览明细：只显示会按“项目名称＋项目特征描述＋单位”完全一致合并的项目。');
    });
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
      if(stats)stats.textContent=summary.text+' · '+summary.detail+' · 尚未人工确认';
      var fresh=reviewBinding&&reviewBinding.inputKey===matchingKey();
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
      try{
        if(!selectionConfirmed())throw Error('请先确认合并选择，再生成成果表。');
        if(!reviewModel)reviewModel=buildReview();
        if(!reviewModel)throw Error('自动分类还没有结果，请先完成分类库加载。');
        var name=reviewTargetName(),selection=await pickReviewTarget(name);
        if(!selection||!selection.target){tell('已取消选择成果表位置，当前阶段不变。');return;}
        reviewBusy=true;renderReview();
        reviewTell('正在写入并重新打开校验成果表…');
        var prepared=await exportRequest('prepare',{target:selection.target,adjacent:true});
        // 宿主写入通常同步完成；这里await一层，保证任何异步实现（含测试夹具）先落地再发布。
        await RfqClassificationReviewHost.write(options.application,reviewModel,prepared.stagePath,{title:name});
        var receipt=await exportRequest('commit',{ticket:prepared.ticket});
        await exportRequest('verify',{ticket:prepared.ticket,target:receipt.target,sha256:receipt.sha256});
        reviewBinding=RfqClassificationReviewHost.bindingFor(receipt,reviewModel,{inputKey:matchingKey(),title:name});
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
      finally{reviewBusy=false;renderReview();}
    }
    var generateButton=reviewEl('classification-review-generate'),openButton=reviewEl('classification-review-open');
    if(generateButton)generateButton.addEventListener('click',generateReview);
    if(openButton)openButton.addEventListener('click',function(){
      if(!reviewBinding){reviewTell('还没有生成审核成果表。',true);return;}
      try{RfqClassificationReviewHost.openForEditing(options.application,reviewBinding.path);
        reviewTell('已打开审核成果表：'+reviewBinding.path);}
      catch(error){reviewTell('成果表未打开。'+error.message,true);}
    });
    if(options.restoreReviewBinding)reviewBinding=options.restoreReviewBinding()||null;
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
