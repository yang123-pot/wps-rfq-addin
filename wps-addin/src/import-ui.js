(function(){
  'use strict';
  function node(tag,text,className){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;}
  function button(text,action){var e=node('button',text,'locate');e.type='button';e.addEventListener('click',action);return e;}
  function create(options){
    var collection=RfqCollection.create(),selected=null,page=0,busy=false;
    var mergeConfirmedKey=null;
    var picker=document.getElementById('import-files'),message=document.getElementById('import-message');
    var merge=document.getElementById('merge-identical');merge.checked=false;
    var confirmMerge=document.getElementById('confirm-merge');
    var exporter=RfqExportUI.create({application:options.application,getCollection:function(){return collection;},
      mergeIdentical:function(){return merge.checked;},onBusy:function(value){busy=value;options.onBusy(value);}});
    var projects=RfqProjectUI.create({getCollection:function(){return collection;},mergeIdentical:function(){return merge.checked;},
      restore:function(project){return restoreProject(project);},getClassification:function(){return classifier.snapshot();},
      getClassificationRows:function(){return classifier.rows();},
      restoreClassification:function(value){classifier.restore(value);},
      getPreview:function(){return collection.entries.length?RfqCollection.preview(collection,merge.checked):null;},
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
    function brandContext(){
      var preview=collection.entries.length?RfqCollection.preview(collection,merge.checked):null;
      return {collection:collection,mergeIdentical:merge.checked===true,preview:preview,
        classification:classifier.snapshot(),rows:classifier.rows(),mergeConfirmedKey:mergeConfirmedKey};
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
      if(!collection.entries.length){exporter.refresh({canFinalize:false});classifier.refresh({groups:[]});if(brandPanel)brandPanel.refresh();return;}
      var result=RfqCollection.preview(collection,merge.checked),pages=Math.max(1,Math.ceil(result.groups.length/20));page=Math.min(page,pages-1);
      exporter.refresh(result);
      classifier.refresh(result);
      if(brandPanel)brandPanel.refresh();
      if(headerPanel)headerPanel.refresh();
      if(inquiryPanel)inquiryPanel.refresh();
      if(splitPanel)splitPanel.refresh();
      document.getElementById('merge-summary').textContent='原始 '+result.inputCount+' 项 → 预览 '+result.outputCount+' 项 · '+(merge.checked?'已选择精确合并':'按来源分别保留');
      var mergeConfirmed=mergeConfirmedKey===RfqProject.contentKey({collection:collection,mergeIdentical:merge.checked===true});
      confirmMerge.disabled=busy||!result.canFinalize;
      confirmMerge.textContent=mergeConfirmed?'已确认本次预览（可重新确认）':'确认本次合并预览';
      document.getElementById('merge-status').textContent=(result.canFinalize?'本次校验通过，预览尚未另存。':
        result.issues.length+' 个待核对问题仍阻断后续处理；请在上方选择文件逐项核对。')+
        (mergeConfirmed?' 本次预览已确认，可继续分类、品牌与生成。':' 预览确认后才能继续分类、品牌与生成。');
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
    merge.addEventListener('change',function(){page=0;render();});
    confirmMerge.addEventListener('click',function(){
      if(busy)return;
      var result=collection.entries.length?RfqCollection.preview(collection,merge.checked):null;
      if(!result||!result.canFinalize){tell('还有待核对问题，请先处理来源问题再确认预览。',true);return;}
      mergeConfirmedKey=RfqProject.contentKey({collection:collection,mergeIdentical:merge.checked===true});
      render();
      tell('已确认本次'+(merge.checked?'精确合并':'分别保留')+'预览；来源或合并方式变化后需要重新确认。');
    });
    document.getElementById('merge-prev').addEventListener('click',function(){page--;render();});
    document.getElementById('merge-next').addEventListener('click',function(){page++;render();});
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
