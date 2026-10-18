const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const DRAIN=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['SB-001','水泵','DN50','台','1'],['SB-002','水泵','DN65','台','1'],['FM-001','阀门','DN50','个','20'],
 ['FM-002','阀门','DN65','个','12'],['GS-001','钢索','规格C','m','10']];
const MEP=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['','给排水','','',''],['SB-101','水泵','DN50','台','1'],['SB-102','水泵','DN65','台','2'],
 ['','暖通','','',''],['FJ-101','送风机','规格A','台','2'],['FJ-102','排风机','规格B','台','3'],
 ['','强电','','',''],['CD-101','充电桩配电箱','充电桩配套','台','1']];
const LABELS=['导入与合并','自动分类','表内审核','分类工作簿','品牌汇总','询价表','拆分文件'];
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-workflow-')),files=[path.join(root,'给排水清单.xlsx'),path.join(root,'机电清单.xlsx')];
 await fs.writeFile(files[0],'drain');await fs.writeFile(files[1],'mep');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
  // 用隔离分类库，保证与图02一致：7行有建议＋1行冲突；不触碰生产defaults。
  await createLibraryStore({directory:path.join(root,'library')})
   .save({expectedRevision:0,library:sample.library,memory:sample.createMemory()});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:380,height:900}}),errors=[];
  async function showSimple(){await page.evaluate(()=>document.getElementById('simple-mode-toggle').click());}
  async function showDetail(){await page.evaluate(()=>{document.getElementById('simple-settings-toggle').click();document.getElementById('simple-detail-link').click();});}
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({files,drain,mep})=>{
   window.__copyNames={};
   const nativeFetch=window.fetch;
   window.fetch=async function(...args){
    const response=await nativeFetch(...args);
    if(String(args[0])==='/api/import/prepare'&&response.ok){
     const data=await response.clone().json();
     if(Array.isArray(data.files))data.files.forEach(m=>{window.__copyNames[m.copyPath]=m.originalName;});
    }
    return response;
   };
   const grids={'给排水清单.xlsx':{sheet:'给排水',values:drain},'机电清单.xlsx':{sheet:'机电安装',values:mep}};
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
    Workbooks:{Count:1,Item(){return previous;},Open(file){
     if(files.includes(file))throw Error('original was opened');
     const name=window.__copyNames[file];if(!name)throw Error('unknown copy');
     const grid=grids[name];
     const sheet={Name:grid.sheet,UsedRange:{Row:1,Column:1,Rows:{Count:grid.values.length},Columns:{Count:5},Value2:grid.values}};
     const book={Name:name,FullName:file,Worksheets:{Count:1,Item(){return sheet;}},Activate(){app.ActiveWorkbook=this;},Close(){}};
     app.ActiveWorkbook=book;return book;
    }}};
   // R12-K：功能区页与侧栏页共用 Application.PluginStorage；用 sessionStorage 承载，模拟侧栏重建后请求仍在。
   const backing=window.sessionStorage;
   app.PluginStorage={
    getItem(key){return backing.getItem('plugin:'+key);},
    setItem(key,value){backing.setItem('plugin:'+key,String(value));},
    removeItem(key){backing.removeItem('plugin:'+key);}
   };
   window.Application=app;window.__files=files;
  },{files,drain:DRAIN,mep:MEP});
  const origin='http://127.0.0.1:'+server.address().port;
  await require('./assistant-test-ui.cjs').acknowledgeProblems(page);
  await page.goto(origin+'/taskpane.html?mode=detail');
  await page.evaluate(()=>{
   window.__previews=[];
   window.RfqExportHost.showPreview=(app,model)=>{window.__previews.push(model);return {name:'插件预览'};};
  });

  // 步骤骨架：七个阶段、当前为第1步；默认“分别保留清单”。
  const labels=await page.locator('#workflow-nav .workflow-step-label').allInnerTexts();
  assert.deepEqual(labels,LABELS,'侧栏主流程必须是获批的七步');
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'import');
  assert.equal(await page.locator('#merge-separate').isChecked(),true,'默认分别保留清单');
  assert.equal(await page.locator('#merge-identical').isChecked(),false,'默认不合并');
  assert.equal(await page.locator('#merge-section').isHidden(),true,'未导入前不显示合并选择');
  assert.match(await page.locator('#workflow-note').innerText(),/尚未导入清单/);
  assert.equal(await page.locator('#confirm-merge').innerText(),'确认选择，开始自动分类','主按钮必须与图01一致');
  assert.equal(await page.locator('#merge-detail').innerText(),'查看合并明细');

  // 导入两份清单：显示文件与行数，合并前不进入匹配。
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  assert.match(await page.locator('#workflow-note').innerText(),/已成功导入 2 个文件，共 10 行数据/);
  assert.match(await page.locator('#workflow-note').innerText(),/先查看导入预览/);
  assert.equal(await page.locator('#preview-gate').isVisible(),true,'导入后先显示预览确认入口');
  assert.equal(await page.locator('#merge-section').isHidden(),true,'预览完成前不得出现合并选择');
  assert.equal(await page.locator('#workflow-rows').innerText(),'10','导入总行数');
  assert.equal(await page.locator('#workflow-merged').innerText(),'10','未合并时预览行数保持10');
  assert.deepEqual(await page.evaluate(()=>window.__previews[0].sheets.map(s=>s.name)),['导入预览'],
   '预览完成前只显示工作簿和工作表结构');
  assert.equal(await page.evaluate(()=>window.__previews[0].previewOnly),true);
  await showSimple();
  assert.equal(await page.locator('#simple-home').isVisible(),true);
  assert.equal(await page.locator('#stage-panel-import').isHidden(),true,'预览阶段不展开技术面板');
  assert.equal(await page.locator('#simple-merge-choice').isHidden(),true,'预览完成前不显示合并选项');
  assert.match(await page.locator('#simple-title').innerText(),/先看一下清单/);
  assert.equal(await page.locator('#simple-primary').innerText(),'我已看完预览');
  if(process.env.RFQ_PREVIEW_GATE_SCREENSHOT)await page.screenshot({path:process.env.RFQ_PREVIEW_GATE_SCREENSHOT,fullPage:true});
  await page.locator('#simple-primary').click();
  await page.waitForFunction(()=>document.querySelector('#merge-section').hidden===false);
  assert.equal(await page.locator('#preview-gate').isHidden(),true,'预览确认后收起预览确认入口');
  assert.deepEqual(await page.evaluate(()=>window.__previews.at(-1).sheets.map(s=>s.name)),['导入预览','合并明细'],
   '预览确认后才显示材料处理预览');
  await showDetail();
  assert.equal(await page.locator('#stage-panel-import').isHidden(),false);
  assert.equal(await page.locator('#stage-panel-matching').isHidden(),true);
  if(process.env.RFQ_WORKFLOW_MULTI_SCREENSHOT)await page.locator('#merge-section').screenshot({path:process.env.RFQ_WORKFLOW_MULTI_SCREENSHOT});

  // 简版始终停留在当前步骤卡片，只显示材料处理选择、结果摘要和下一步按钮。
  await showSimple();
  assert.equal(await page.locator('#simple-home').isVisible(),true);
  assert.equal(await page.locator('#stage-panel-import').isHidden(),true,'简版不展开识别预览技术面板');
  assert.equal(await page.locator('#simple-merge-choice').isVisible(),true,'导入后显示材料处理选择');
  assert.equal(await page.locator('#assistant-files').isHidden(),true,'预览确认后按效果图收起文件树');
  assert.match(await page.locator('#merge-summary').innerText(),/10[\s\S]*10/,'材料处理摘要仍由工作表预览提供');
  assert.equal(await page.locator('#simple-primary').innerText(),'确认选择，开始自动分类','完成后在同一位置显示下一步按钮');
  if(process.env.RFQ_PREVIEW_READY_SCREENSHOT)await page.screenshot({path:process.env.RFQ_PREVIEW_READY_SCREENSHOT,fullPage:true});
  assert.equal(await page.locator('#simple-merge-all').isChecked(),false,'默认不合并全部工作簿');
  assert.equal(await page.locator('#simple-duplicate-merge').isChecked(),false,'默认分别保留');
  await page.locator('#simple-merge-all').check();
  assert.equal(await page.locator('#merge-all-workbooks').isChecked(),true,'简版工作簿选择必须同步');
  await page.locator('#simple-merge-all').uncheck();
  assert.equal(await page.locator('#merge-all-workbooks').isChecked(),false);
  await page.locator('#simple-duplicate-merge').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='8');
  assert.equal(await page.locator('#merge-identical').isChecked(),true,'简版选择必须同步到实际处理方式');
  await page.locator('#simple-duplicate-merge').uncheck();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='10');
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true,'简版不得横向溢出');
  if(process.env.RFQ_SIMPLE_FOCUS_SCREENSHOT)await page.screenshot({path:process.env.RFQ_SIMPLE_FOCUS_SCREENSHOT,fullPage:true});
  await showDetail();
  assert.equal(await page.locator('#preview-section').isVisible(),true,'详细模式仍保留识别预览');

  await page.locator('#aux-section > summary').click();
  const obsoleteActions=await page.getByRole('button',{name:/批量确认选中行|写入工作副本|生成分类品牌表|读取并核对品牌表|确认写入项目/}).allTextContents();
  const designIssues=[];
  if(obsoleteActions.length)designIssues.push('仍可进入旧分类/品牌确认：'+obsoleteActions.join('、'));
  assert.match(await page.locator('#classification-review-banner').innerText(),/尚未自动分类/);

  // 选择“合并完全相同项”才更新精确预览：10→8。
  assert.equal(await page.locator('#merge-list > li').count(),10,'分别保留时逐条预览');
  await page.locator('#merge-all-workbooks').check();
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='8');
  assert.equal(await page.locator('#workflow-merged').innerText(),'8','合并后行数');
  assert.equal(await page.evaluate(()=>window.__previews.at(-1).outputCount),8,'合并选择应同步更新主工作表');
  assert.equal(await page.locator('#merge-separate').isChecked(),false,'两个选项互斥');
  assert.equal(await page.locator('#merge-list > li').count(),8,'合并预览只显示合并结果');
  await page.locator('#merge-separate').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='10');
  await page.locator('#merge-identical').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='8');

  // 查看合并明细与“确认前不匹配”。
  await page.locator('#merge-detail').click();
  assert.match(await page.locator('#import-message').innerText(),/合并预览明细/);
  assert.match(await page.locator('#classification-review-banner').innerText(),/尚未自动分类/,'未确认前不得匹配');

  // 简版确认后留在当前步骤卡片，并在原位置出现下一步“生成审核成果表”。
  await showSimple();
  assert.equal(await page.locator('#simple-primary').innerText(),'确认选择，开始自动分类');
  await page.locator('#simple-primary').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
  await page.waitForFunction(()=>/生成分类核对表/.test(document.querySelector('#simple-primary').textContent));
  assert.match(await page.locator('#simple-title').innerText(),/自动分类完成/);
  assert.equal(await page.locator('#simple-primary').innerText(),'生成分类核对表','完成后必须直接显示下一步操作');
  assert.equal(await page.locator('#stage-panel-matching').isHidden(),true,'简版不展开自动分类技术面板');
  if(process.env.RFQ_SIMPLE_NEXT_SCREENSHOT)await page.screenshot({path:process.env.RFQ_SIMPLE_NEXT_SCREENSHOT,fullPage:true});
  await showDetail();
  assert.equal(await page.locator('#stage-panel-import').isHidden(),true,'确认后进入下一阶段');
  assert.equal(await page.locator('#stage-panel-matching').isHidden(),false);
  // R4：自动分类完成后显示“自动匹配完成”，但仍写明尚未人工确认。
  await page.waitForFunction(()=>/自动匹配完成/.test(document.querySelector('#classification-review-banner').textContent));
  if(/已写入成果表/.test(await page.locator('#classification-review-stats').innerText()))
   designIssues.push('尚无成果文件却显示已写入成果表');
  assert.match(await page.locator('#classification-review-stats').innerText(),/7 行有建议 · 1 行需重点核对/,'7行建议＋1行重点核对');
  assert.match(await page.locator('#classification-review-stats').innerText(),/尚未人工确认/,'自动建议不得当成人工确认');
  assert.equal(await page.locator('#classification-review-open').isDisabled(),true,'尚未生成成果表时不能打开');
  assert.equal(await page.locator('#classification-review-generate').innerText(),'生成审核成果表');
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'matching');
  assert.deepEqual(designIssues,[],'获批图02/03/05：状态必须真实，旧确认入口不得继续暴露');

  // 生成独立成果簿：过真实prepare/commit/verify，只把写盘换成夹具，并核对成果簿内容与绑定。
  const reviewTarget=path.join(root,'示例园区_分类审核成果.xlsx');
  await page.exposeFunction('__writeReviewFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  await page.evaluate(target=>{
   window.__reviewWritten=null;
   window.__realPathPicker=window.__realPathPicker||window.RfqPathPicker.open;
   window.RfqPathPicker.open=function(options){options.onConfirm({directory:null,name:'示例园区_分类审核成果.xlsx',target:target});return null;};
   window.RfqClassificationReviewHost.openForEditing=()=>({path:target,opened:true});
   window.RfqClassificationReviewHost.write=async(app,result,stagePath,opts)=>{
    window.__reviewWritten={result:result,stagePath:stagePath,title:opts&&opts.title,
     sheet:window.RfqClassificationReviewModel.mainSheet(result,{title:opts&&opts.title})};
    window.__reviewWriteCalled=true;
    await window.__writeReviewFixture(stagePath);};
  },reviewTarget);
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  assert.equal(require('node:fs').existsSync(reviewTarget),true,'成果表必须真实发布到所选位置');
  assert.equal(await page.locator('#classification-review-open').isDisabled(),false,'生成后才能打开成果表审核');
  assert.equal(await page.locator('#classification-review-generate').innerText(),'重新生成审核成果表');
  assert.match(await page.locator('#classification-review-stats').innerText(),/8 行结果已写入成果表/,'文件发布校验后才能显示已写入');
  const written=await page.evaluate(()=>window.__reviewWritten);
  assert.equal(written.title,'示例园区_分类审核成果.xlsx','文件名按“项目名_分类审核成果.xlsx”');
  assert.deepEqual(written.result.counts,{rows:8,suggested:6,skip:1,conflict:1,none:0,pending:8});
  assert.deepEqual(written.sheet.values[2].slice(0,9),['序号','项目名称','规格','单位','工程量','自动建议','匹配情况','最终分类','审核备注'],'图03列序');
  assert.equal(written.sheet.layout.columns[10].hidden,true,'随行行标识列必须隐藏');
  assert.equal(written.sheet.layout.validations.length,1,'最终分类列挂区域下拉');
  await page.evaluate(()=>{window.RfqClassificationReviewHost.write=async()=>{};});
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  const storedReview=JSON.parse(await fs.readFile(path.join(root,'projects',(await fs.readdir(path.join(root,'projects')))[0]),'utf8'));
  assert.equal(storedReview.matching.path,reviewTarget,'项目记录必须保存成果簿路径');
  assert.equal(storedReview.matching.rowIds.length,8);
  assert.equal(storedReview.matching.fields.length,8);
  assert.match(storedReview.matching.inputKey,/^ck2-[0-9a-f]{16}$/);
  assert.match(await page.locator('#project-status').innerText(),/自动分类：已确认/,'自动分类完成后阶段必须按真实条件置为已确认');
  assert.match(await page.locator('#project-status').innerText(),/表内审核：未完成/,'R5未实现前不得把表内审核显示为已确认');

  // 取消不变阶段：save模式选择器取消时只回调取消，不推进、不返回目标。
  const cancelled=await page.evaluate(async()=>{
   let confirmed='none',cancelledFlag=false;
   if(window.__realPathPicker)window.RfqPathPicker.open=window.__realPathPicker;
   window.RfqPathPicker.open({mode:'save',token:window.__RFQ_IMPORT__.token,title:'另存汇总表',fileName:'分类汇总表.xlsx',
    startPath:'',onConfirm:function(value){confirmed=JSON.stringify(value);},onCancel:function(){cancelledFlag=true;}});
   await new Promise(r=>setTimeout(r,50));
   const picker=document.querySelector('.rfq-picker');
   const hasName=!!picker.querySelector('.rfq-picker-name');
   picker.querySelector('.rfq-picker-foot .locate').click();
   await new Promise(r=>setTimeout(r,30));
   return {hasName,cancelledFlag,confirmed,gone:!document.querySelector('.rfq-picker')};
  });
  assert.equal(cancelled.hasName,true,'save模式必须有文件名输入');
  assert.equal(cancelled.cancelledFlag,true,'取消要回调onCancel');
  assert.equal(cancelled.confirmed,'none','取消不得返回目标路径');
  assert.equal(cancelled.gone,true,'取消后选择器关闭');
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'matching',
   '取消不得改变当前阶段');

  // F3 三态（missing）：未完成的阶段必须有可见提示，且阶段导航不得解锁主操作、绕过业务前置条件。
  // 表内审核的“整表确认”是动作级校验入口（按钮可用但必须按现表逐行通过才确认），不属于被导航解锁的
  // 下游动作，因此只核对它的可见“未完成”提示，不对它做禁用断言。
  const missingGates=[['review','表内审核',[],false],
   ['categories','分类工作簿',['categories-generate','categories-summary','categories-layout'],true],
   ['brands','品牌汇总',['brands-generate','brands-confirm','brands-layout'],true],
   ['inquiry','询价表',['inquiry-generate','inquiry-next'],true],
   ['split','拆分文件',['split-run'],true]];
  // 未完成/过期阶段里任何可见的“生成/确认/拆分/重试/写入”按钮都必须保持禁用，不能被导航解锁。
  const visibleActionButtons=async stage=>page.evaluate(target=>{
   const panel=document.getElementById('stage-panel-'+target);
   return [...panel.querySelectorAll('button')].filter(button=>!button.hidden&&button.offsetParent!==null)
    .map(button=>({id:button.id,text:button.textContent.trim(),disabled:button.disabled}));
  },stage);
  for(const [stage,label,controls,generic] of missingGates){
   await page.locator('#workflow-nav .workflow-step-button[data-stage="'+stage+'"]').click();
   await page.waitForFunction(target=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')===target,stage);
   assert.match(await page.locator('#project-status').innerText(),new RegExp(label+'：未完成'),
    '第'+label+'阶段未完成时必须有可见的“未完成”提示');
   for(const control of controls)
    assert.equal(await page.locator('#'+control).isDisabled(),true,
     '未完成阶段的“'+control+'”必须保持禁用，阶段导航不得绕过前置条件');
   if(generic)for(const button of await visibleActionButtons(stage))
    if(/生成|确认|拆分|重试|重建|写入/.test(button.text))
     assert.equal(button.disabled,true,'未完成阶段不得暴露可用的动作按钮：'+JSON.stringify(button));
  }
  assert.match(await page.locator('#project-status').innerText(),/自动分类：已确认/,'已完成阶段仍显示已确认');

  // F3 三态（stale）：改回“分别保留”再次确认后，下游已确认阶段必须显示“已过期”且主操作仍未解锁。
  await page.locator('#workflow-nav .workflow-step-button[data-stage="import"]').click();
  await page.locator('#merge-separate').check();
  await page.waitForFunction(()=>document.querySelector('#workflow-merged').textContent==='10');
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>/自动匹配完成|尚未自动分类/.test(document.querySelector('#classification-review-banner').textContent));
  await page.waitForFunction(()=>/分类工作簿：(已过期|未完成)/.test(document.querySelector('#project-status').textContent));
  const staleStatus=await page.locator('#project-status').innerText();
  assert.doesNotMatch(staleStatus,/分类工作簿：已确认/,'上游变化后下游阶段不得继续显示已确认');
  assert.doesNotMatch(staleStatus,/品牌汇总：已确认/,'上游变化后下游阶段不得继续显示已确认');
  for(const [stage,label,controls,generic] of missingGates){
   await page.locator('#workflow-nav .workflow-step-button[data-stage="'+stage+'"]').click();
   await page.waitForFunction(target=>document.querySelector('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage')===target,stage);
   assert.match(await page.locator('#project-status').innerText(),new RegExp(label+'：(已过期|未完成)'),
    '上游变化后第'+label+'阶段必须有可见的过期/未完成提示');
   for(const control of controls)
    assert.equal(await page.locator('#'+control).isDisabled(),true,
     '过期阶段的“'+control+'”必须保持禁用，阶段导航不得绕过前置条件');
   if(generic)for(const button of await visibleActionButtons(stage))
    if(/生成|确认|拆分|重试|重建|写入/.test(button.text))
     assert.equal(button.disabled,true,'过期阶段不得暴露可用的动作按钮：'+JSON.stringify(button));
  }

  // R12-K：功能区阶段快捷入口只导航，不触发确认/学习/写表/拆分。
  await page.evaluate(()=>{
   window.__rfqSideEffects={writes:0,confirms:0,fetch:0};
   ['RfqClassificationReviewHost','RfqCategoryWorkbooks','RfqBrandHost','RfqExportHost'].forEach(name=>{
    const host=window[name];if(!host||typeof host!=='object')return;
    Object.keys(host).forEach(key=>{
     const fn=host[key];
     if(typeof fn!=='function'||!/(write|generate|commit)/i.test(key))return;
     host[key]=function(){window.__rfqSideEffects.writes++;return fn.apply(this,arguments);};
    });
   });
   const nativeConfirm=window.confirm;
   window.confirm=function(){window.__rfqSideEffects.confirms++;return nativeConfirm.apply(window,arguments);};
   const nativeFetch=window.fetch;
   window.fetch=function(){window.__rfqSideEffects.fetch++;return nativeFetch.apply(window,arguments);};
  });
  const navStages=['import','matching','review','categories','brands','inquiry','split'];
  const navLabels=['导入与合并','自动分类','表内审核','分类工作簿','品牌汇总','询价表','拆分文件'];
  for(let index=0;index<navStages.length;index++){
   await page.evaluate(stage=>{
    window.Application.PluginStorage.setItem('rfq.window.nav.request',JSON.stringify({id:'nav-ui-'+Date.now()+'-'+stage,stage:stage}));
    window.dispatchEvent(new Event('focus'));
   },navStages[index]);
   await page.waitForFunction(stage=>{
    const current=document.querySelector('#workflow-nav .workflow-step-button.is-current');
    return !!current&&current.getAttribute('data-stage')===stage;
   },navStages[index]);
   assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current .workflow-step-label').innerText(),
    navLabels[index],'阶段入口应定位到对应步骤');
   assert.equal(await page.evaluate(()=>window.Application.PluginStorage.getItem('rfq.window.nav.request')),null,
    '导航请求只消费一次，消费后立即移除');
  }
  // 非法阶段：不改变当前阶段，请求被丢弃。
  await page.evaluate(()=>{
   window.Application.PluginStorage.setItem('rfq.window.nav.request',JSON.stringify({id:'nav-ui-bad',stage:'not-a-stage'}));
   window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'split',
   '非法阶段不得改变当前阶段');
  assert.equal(await page.evaluate(()=>window.Application.PluginStorage.getItem('rfq.window.nav.request')),null,'非法请求应被丢弃');
  const sideEffects=await page.evaluate(()=>window.__rfqSideEffects);
  assert.deepEqual(sideEffects,{writes:0,confirms:0,fetch:0},'快捷导航不得触发业务动作：'+JSON.stringify(sideEffects));
  // 侧栏重建：未消费的请求在打开时应用；已消费的请求不重播。
  // 请求在重建页初始化前写入共享存储（sessionStorage键plugin:rfq.window.nav.request），避免加载页内的
  // 低频检查在重建前抢先消费；只播种一次，第二次重建不得再写入。
  await page.addInitScript(()=>{
   const seeded='plugin:f3.nav.seeded';
   if(window.sessionStorage.getItem(seeded))return;
   window.sessionStorage.setItem(seeded,'1');
   window.sessionStorage.setItem('plugin:rfq.window.nav.request',
    JSON.stringify({id:'nav-ui-rebuild',stage:'categories'}));
  });
  await page.reload();
  try{
   await page.waitForFunction(()=>{
    const current=document.querySelector('#workflow-nav .workflow-step-button.is-current');
    return !!current&&current.getAttribute('data-stage')==='categories';
   },null,{timeout:10000});
  }catch(error){
   throw Error('重建后未应用未消费请求：当前阶段='+await page.locator('#workflow-nav .workflow-step-button.is-current')
    .getAttribute('data-stage')+'，请求='+await page.evaluate(()=>window.Application.PluginStorage.getItem('rfq.window.nav.request'))
    +'，页面错误='+JSON.stringify(errors));
  }
  assert.equal(await page.evaluate(()=>window.Application.PluginStorage.getItem('rfq.window.nav.request')),null,
   '重建后请求只消费一次');
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#workflow-nav .workflow-step').length===7);
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'import',
   '侧栏重建不得重播已消费的导航请求');

  // F3：精确CSS320窄宽。用视口宽度＝CSS像素320核对（不是窗口外框320）：七阶段主按钮必须换行、
  // 标签不被裁切、没有横向滚动，且主按钮区可以真实滚到。
  await page.setViewportSize({width:320,height:900});
  await page.waitForFunction(()=>document.querySelectorAll('#workflow-nav .workflow-step').length===7);
  const narrow=await page.evaluate(()=>{
   const rects=[...document.querySelectorAll('#workflow-nav .workflow-step-button')].map(button=>{
    const box=button.getBoundingClientRect();
    return {stage:button.getAttribute('data-stage'),left:box.left,right:box.right,top:Math.round(box.top),width:box.width};});
   const labels=[...document.querySelectorAll('#workflow-nav .workflow-step-label')].map(label=>{
    const box=label.getBoundingClientRect();
    return {text:label.textContent,clipped:label.scrollWidth>label.clientWidth+1,left:box.left,right:box.right};});
   return {cssWidth:window.innerWidth,devicePixelRatio:window.devicePixelRatio,
    scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
    scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight,
    steps:document.querySelectorAll('#workflow-nav .workflow-step').length,rows:new Set(rects.map(item=>item.top)).size,
    rects,labels};});
  assert.equal(narrow.cssWidth,320,'必须按CSS像素320核对，不能用窗口外框宽度');
  assert.equal(narrow.steps,7);
  assert.ok(narrow.rows>=2,'CSS320下七阶段主按钮必须换行：'+JSON.stringify(narrow.rects));
  assert.ok(narrow.rects.every(item=>item.left>=-0.5&&item.right<=320.5),
   'CSS320下按钮不得超出视口：'+JSON.stringify(narrow.rects));
  assert.ok(narrow.labels.every(item=>!item.clipped),'CSS320下阶段标签不得被裁切：'+JSON.stringify(narrow.labels));
  assert.ok(narrow.scrollWidth<=narrow.clientWidth+1,'CSS320下不得出现横向滚动：'+JSON.stringify(narrow));
  assert.ok(narrow.scrollHeight>narrow.innerHeight,'CSS320下内容应可纵向滚动');
  const scrolled=await page.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);return window.scrollY;});
  assert.ok(scrolled>0,'CSS320下必须能真实滚到主按钮区');
  await page.evaluate(()=>window.scrollTo(0,0));
  if(process.env.RFQ_UI_WORKFLOW_SCREENSHOT)await page.screenshot({path:process.env.RFQ_UI_WORKFLOW_SCREENSHOT});
  if(process.env.RFQ_UI_WORKFLOW_EVIDENCE)await fs.writeFile(path.join(process.env.RFQ_UI_WORKFLOW_EVIDENCE,'css320-narrow.json'),
   JSON.stringify(narrow,null,2));
  assert.deepEqual(errors,[]);
  console.log('PASS: 七步导航＋图01导入合并选择：默认分别保留、选择合并才更新精确预览、确认前不匹配、取消不推进。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
