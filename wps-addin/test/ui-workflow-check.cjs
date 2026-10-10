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
  await page.goto(origin+'/taskpane.html');
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
  assert.equal(await page.locator('#workflow-rows').innerText(),'10','导入总行数');
  assert.equal(await page.locator('#workflow-merged').innerText(),'10','未合并时预览行数保持10');
  assert.deepEqual(await page.evaluate(()=>window.__previews[0].sheets.map(s=>s.name)),['导入预览','合并明细'],
   '导入后必须向主工作表输出图01预览');
  assert.equal(await page.locator('#stage-panel-import').isHidden(),false);
  assert.equal(await page.locator('#stage-panel-matching').isHidden(),true);
  await page.locator('#aux-section > summary').click();
  const obsoleteActions=await page.getByRole('button',{name:/批量确认选中行|写入工作副本|生成分类品牌表|读取并核对品牌表|确认写入项目/}).allTextContents();
  const designIssues=[];
  if(obsoleteActions.length)designIssues.push('仍可进入旧分类/品牌确认：'+obsoleteActions.join('、'));
  assert.match(await page.locator('#classification-review-banner').innerText(),/尚未自动分类/);

  // 选择“合并完全相同项”才更新精确预览：10→8。
  assert.equal(await page.locator('#merge-list > li').count(),10,'分别保留时逐条预览');
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

  // 确认选择：来源问题清零时进入自动分类；期间未实现阶段保持未完成。
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次选择已确认'));
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
  await page.evaluate(()=>{
   window.Application.PluginStorage.setItem('rfq.window.nav.request',JSON.stringify({id:'nav-ui-rebuild',stage:'categories'}));
  });
  await page.reload();
  await page.waitForFunction(()=>{
   const current=document.querySelector('#workflow-nav .workflow-step-button.is-current');
   return !!current&&current.getAttribute('data-stage')==='categories';
  });
  assert.equal(await page.evaluate(()=>window.Application.PluginStorage.getItem('rfq.window.nav.request')),null,
   '重建后请求只消费一次');
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#workflow-nav .workflow-step').length===7);
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'import',
   '侧栏重建不得重播已消费的导航请求');

  // 窄侧栏可用：无横向滚动，七个步骤都在。
  await page.setViewportSize({width:340,height:900});
  const narrow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
   steps:document.querySelectorAll('#workflow-nav .workflow-step').length}));
  assert.equal(narrow.steps,7);
  assert.ok(narrow.scrollWidth<=narrow.clientWidth+1,'窄侧栏不得出现横向滚动：'+JSON.stringify(narrow));
  assert.deepEqual(errors,[]);
  console.log('PASS: 七步导航＋图01导入合并选择：默认分别保留、选择合并才更新精确预览、确认前不匹配、取消不推进。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
