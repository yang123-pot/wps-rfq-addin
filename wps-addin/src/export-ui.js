(function(){
  'use strict';
  function create(options){
    var button=document.getElementById('export-workbook'),message=document.getElementById('export-message'),busy=false;
    var last=null;
    function tell(text,error){message.textContent=text;message.className=error?'error':'';}
    async function request(action,data){
      var response=await fetch('/api/export/'+action,{method:'POST',headers:{'content-type':'application/json','x-rfq-import-token':window.__RFQ_IMPORT__.token},body:JSON.stringify(data)});
      var result=await response.json();
      if(!response.ok){var error=Error(result.error||'另存请求失败。');error.status=response.status;throw error;}
      return result;
    }
    button.addEventListener('click',async function(){
      if(busy)return;var target=null,prepared=null;
      try{
        var model=RfqExportModel.build(options.getCollection(),options.mergeIdentical());
        if(!window.confirm('确认按当前预览另存？\n'+(model.mode==='merge-identical'?'精确合并':'逐条保留来源')+'：'+model.inputCount+' 条 → '+model.outputCount+' 条。\n包含内部来源明细；编码和工程量按文本保留精度。')){tell('已取消确认，核对记录保留。');return;}
        target=RfqExportHost.selectTarget(options.application,model.mode==='merge-identical'?'项目_合并清单.xlsx':'项目_分离清单.xlsx');
        if(!target){tell('已取消选择保存位置，核对记录保留。');return;}
        busy=true;options.onBusy(true);tell('正在准备新文件…');
        prepared=await request('prepare',{target:target});
        if(!prepared||typeof prepared.ticket!=='string'||typeof prepared.stagePath!=='string'||typeof prepared.target!=='string')throw Error('另存会话信息不完整，未写入。');
        tell('正在写入并重新打开校验…');await new Promise(function(resolve){setTimeout(resolve,0);});
        await RfqExportHost.write(options.application,model,prepared.stagePath);
        tell('正在另存到所选位置…');
        var result;
        try{result=await request('commit',{ticket:prepared.ticket});}
        catch(error){if(error.status&&error.status<500)throw error;result=await request('commit',{ticket:prepared.ticket});}
        if(!result||result.target!==prepared.target||!/^[a-f\d]{64}$/i.test(result.sha256))throw Error('未取得有效保存回执，请检查目标文件。');
        last={ticket:prepared.ticket,target:result.target,sha256:result.sha256,bytes:result.bytes,mode:model.mode,outputCount:model.outputCount,at:new Date().toISOString()};
        tell('上次另存成功（'+model.outputCount+' 条，'+(model.mode==='merge-identical'?'已合并':'分别保留')+'）：'+result.target+'。原清单和核对记录保留。');
      }catch(error){tell('另存未确认成功。'+error.message+(prepared?' 请检查目标位置：'+prepared.target:''),true);}
      finally{busy=false;options.onBusy(false);}
    });
    return {refresh:function(result){button.disabled=!options.application||!window.__RFQ_IMPORT__||!result.canFinalize;},
      last:function(){return last;}};
  }
  window.RfqExportUI={create:create};
}());
