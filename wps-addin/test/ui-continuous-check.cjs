// 默认新版界面从头到尾只点固定主按钮；真实本机服务与磁盘，WPS读写接口为合成宿主。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs'),sample=require('./fixtures/workflow-v3-sample.cjs');
const fixture=require('./ui-inquiry-check.cjs'),xlsx=require('./fixtures/xlsx-container.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-continuous-')),files=['给排水清单.xlsx','机电清单.xlsx'].map(n=>path.join(root,n));
 const reviewTarget=path.join(root,'核对.xlsx'),inquiryTarget=path.join(root,'询价总表.xlsx'),out=path.join(root,'拆分');
 for(const file of files)await fs.writeFile(file,path.basename(file));await fs.mkdir(out);
 const projectDirectory=path.join(root,'projects'),server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),projectDirectory,libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers'),splitDirectory:path.join(root,'splits')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));await createLibraryStore({directory:path.join(root,'library')}).save({expectedRevision:0,library:sample.library,memory:sample.createMemory()});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  async function showSimple(){await page.evaluate(()=>document.getElementById('simple-mode-toggle').click());}
  async function showDetail(){await page.evaluate(()=>{document.getElementById('simple-settings-toggle').click();document.getElementById('simple-detail-link').click();});}
  await page.addInitScript(fixture.initScript,{files,drain:fixture.DRAIN,mep:fixture.MEP,reviewTarget,reviewValues:fixture.REVIEW_VALUES,root});
  await page.exposeFunction('__writeFixture',(file,sheets)=>fs.writeFile(file,xlsx.workbook(sheets)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  await page.evaluate(({reviewTarget,inquiryTarget,out})=>{
   RfqExportHost.showPreview=(app,model)=>{window.__preview=model;return {name:'预览'};};
   RfqPathPicker.open=opts=>{if(opts.mode==='save')opts.onConfirm({target:reviewTarget,name:'核对.xlsx'});else if(opts.mode==='directory')opts.onConfirm([out]);};
   RfqPathPicker.selectFolder=()=>({supported:true,path:out});
   RfqClassificationReviewHost.write=async(app,model,file,opts)=>{const sheet=RfqClassificationReviewModel.mainSheet(model,{title:opts.title});window.__seedReview(sheet.values);await window.__writeFixture(file,[sheet]);};
   RfqCategoryWorkbooks.writeAll=async(app,plan,file,opts)=>{
    window.__summary=opts.summarySheet;window.__plan=plan;
    const sheets=[opts.summarySheet];
    (plan.files||[]).forEach(entry=>{
     const sheet=RfqCategoryWorkbooks.mainSheet(entry,{});sheet.name=entry.sheetName;sheets.push(sheet);
    });
    if(plan.noInquiry){
     const sheet=RfqCategoryWorkbooks.mainSheet(plan.noInquiry,{});sheet.name=plan.noInquiry.sheetName;sheets.push(sheet);
    }
    await window.__writeFixture(file,sheets);
   };
   RfqCategoryWorkbooks.verifySheets=(app,file,expected)=>({ok:true,issues:[],sheets:expected.map((s,i)=>({index:i+1,sheetName:s.sheetName,rowCount:s.rowCount}))});
   const openSummary=RfqBrandHost.openSummary;
   RfqBrandHost.openSummary=(app,file,options)=>{window.__openedSummary=file;if(!window.__stores[file])window.__seedSummary(file,window.__summary.values);return openSummary(app,file,options);};
   RfqBrandHost.selectTarget=()=>inquiryTarget;
   RfqBrandHost.write=async(app,model,file,opts)=>{window.__inquiry=model;await window.__writeFixture(file,model.sheets);if(opts&&opts.finalizeFreeze)await opts.finalizeFreeze();};
   RfqBrandHost.openDirectory=()=>{};
  },{reviewTarget,inquiryTarget,out});
  const primary=page.locator('#simple-primary');
  async function action(label){
   try{await page.waitForFunction(text=>document.getElementById('simple-primary').textContent===text&&!document.getElementById('simple-primary').disabled,label);}
   catch(e){throw Error(label+' 未就绪：'+JSON.stringify(await page.evaluate(()=>({state:RfqAssistant.snapshot(),problem:document.getElementById('assistant-problem').textContent,message:document.getElementById('import-message').textContent})))+'；'+errors.join('；'));}
   if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.assistant-overlay'));
   await primary.click();console.log('操作：'+label);
  }
  async function shot(name){await page.waitForFunction(()=>!RfqAssistant.snapshot().busy);if(process.env.RFQ_UI_V2_SCREENSHOTS){await fs.mkdir(process.env.RFQ_UI_V2_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.RFQ_UI_V2_SCREENSHOTS,name+'.png')});}}
  await action('选择清单文件');await action('我已看完预览');
  await page.locator('#simple-duplicate-merge').check();
  assert.match(await page.locator('#simple-merge-summary').innerText(),/10.*8/);await shot('01-merge');
  assert.equal(await page.locator('#simple-back').isVisible(),true,'选择整理方式也必须有返回上一步');
  await shot('back-options');
  await page.locator('#simple-back').click();
  assert.equal(await primary.innerText(),'我已看完预览');
  assert.equal(await page.locator('#assistant-files').isVisible(),true,'返回预览显示原工作表目录');
  assert.match(await page.locator('#simple-result').innerText(),/已返回.*预览/,'点击有明确反馈');
  await shot('back-preview-feedback');
  await page.locator('#simple-back').click();
  assert.equal(await primary.innerText(),'查看已选清单预览','再返回是选文件页，保留已选文件以便继续');
  assert.equal(await page.evaluate(()=>RfqAssistant.snapshot().files.length),2);
  await action('查看已选清单预览');await action('我已看完预览');
  assert.equal(await page.locator('#simple-duplicate-merge').isChecked(),true,'返回和重进保持合并选择');
  await action('确认选择，开始自动分类');await shot('02-classified');
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'1','第2步返回必须真的显示第1步');
  assert.equal(await page.locator('#simple-merge-choice').isVisible(),true);
  assert.equal(await page.evaluate(()=>RfqAssistant.snapshot().mergeConfirmed),true,'返回不撤销已确认选择');
  await action('确认选择，开始自动分类');
  await action('生成分类核对表');await page.waitForFunction(()=>RfqAssistant.view().step===3);
  assert.equal(await primary.innerText(),'核对完成，生成分类工作簿');await shot('03-review');
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'2','截图中的第3步返回必须显示第2步');
  assert.match(await page.locator('#simple-result').innerText(),/已返回.*第 2 步/);
  assert.equal(await primary.innerText(),'打开核对表','返回后复用已有成果，不要求重新生成');
  await action('打开核对表');await page.waitForFunction(()=>RfqAssistant.view().step===3);
  await showDetail();assert.equal(await page.locator('#workflow-nav .is-current').getAttribute('data-stage'),'review','打开核对表后切详细版也应是第3步');await showSimple();
  // 冲突已按学习经验/候选顺序预填；用户若清空，错误仍先集中提醒并去修改定位。
  await page.evaluate(row=>window.__setCell(row,9,''),fixture.CONFLICT_ROW);
  await primary.click();await page.getByRole('alertdialog').waitFor();assert.match(await page.getByRole('alertdialog').innerText(),/分类/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#assistant-problem').isVisible(),true);
  await page.evaluate(row=>window.__setCell(row,9,'汽车充电桩'),fixture.CONFLICT_ROW);
  await action('核对完成，生成分类工作簿');
  try{await page.waitForFunction(()=>RfqAssistant.view().action==='continueBrands');}
  catch(_){throw Error('分类工作簿未进入下一步：'+JSON.stringify(await page.evaluate(()=>({
   view:RfqAssistant.view(),categories:{banner:document.querySelector('#categories-banner').textContent,
    stats:document.querySelector('#categories-stats').textContent,status:document.querySelector('#categories-status').textContent,
    message:document.querySelector('#categories-message').textContent},
   receipt:RfqAssistant.snapshot().categories
  })))+'；'+errors.join('；'));}
  assert.equal(await page.evaluate(()=>RfqAssistant.snapshot().categoryCount),4);await shot('04-categories');
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'3','第4步返回核对页');
  await action('核对完成，生成分类工作簿');
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'4','内容未变的再次确认也能继续前进，不重复生成');
  // 旧分类簿仍在项目里，新版分类簿的保存失败时不能借旧绑定推进。
  await page.route('**/api/project/save',route=>{const p=route.request().postDataJSON().project;
   return p.review&&p.review.revision===2&&p.categories&&p.categories.reviewRevision===2
    ?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'模拟新版分类簿绑定保存失败'})}):route.continue();});
  await showDetail();await page.locator('[data-stage="review"].workflow-step-button').click();
  await page.evaluate(row=>window.__setCell(row,10,'新版审核备注'),fixture.CONFLICT_ROW);await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.getElementById('project-message').textContent.includes('模拟新版分类簿绑定保存失败'));
  await page.waitForFunction(()=>RfqAssistant.snapshot().categoriesPendingSave,
   null,{timeout:30000});
  if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');await showSimple();
  const afterFailure=await page.evaluate(()=>({action:RfqAssistant.view().action,state:RfqAssistant.snapshot(),
   projectMessage:document.querySelector('#project-message').textContent}));
  assert.equal(afterFailure.action,'saveProject','不能用上版已保存分类簿代替本版保存：'+JSON.stringify(afterFailure));
  await page.unroute('**/api/project/save');await action('重试保存项目');
  await page.route('**/api/project/save',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'模拟磁盘保存失败'})}));
  for(let attempt=0;attempt<2;attempt++){
   await action('下一步：填写品牌和供应商');await page.waitForFunction(()=>!RfqAssistant.snapshot().busy);
   if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>RfqAssistant.view().step),4,'汇总绑定未保存，重复点击也不能推进到填写品牌');
  }
  await page.unroute('**/api/project/save');
  // 改确认后生成的新批次与仍打开的旧分类簿同名：应先提示用户关闭旧簿，不能借用它推进。
  await action('下一步：填写品牌和供应商');
  await page.getByRole('alertdialog').waitFor();
  assert.match(await page.getByRole('alertdialog').innerText(),/另一目录.*同名.*请先保存并关闭/);
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),4,'冲突时保留第4步和新批次绑定');
  const closedOldBooks=await page.evaluate(()=>{
   const target=window.__openedSummary,name=target.replace(/\\/g,'/').split('/').pop();
   const previous=window.__openBooks.filter(book=>book.FullName!==target&&book.FullName.replace(/\\/g,'/').split('/').pop()===name);
   previous.forEach(book=>book.Close(false)); // 仅模拟用户关闭本夹具上一批次的分类簿。
   return previous.length;
  });
  assert.ok(closedOldBooks>0,'必须实际保留过旧批次同名簿，不能构造一个永远无冲突的夹具');
  await page.keyboard.press('Escape');
  await action('下一步：填写品牌和供应商');await page.waitForFunction(()=>RfqAssistant.view().step===5);
  await showDetail();assert.equal(await page.locator('#workflow-nav .is-current').getAttribute('data-stage'),'brands','打开品牌表后两种模式阶段一致');await showSimple();
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'4','第5步返回分类工作簿');
  await page.evaluate(file=>{Application.Workbooks.Open(file).Activate();window.__activeSheet=null;window.__selectedCell=null;},reviewTarget);
  await action('下一步：填写品牌和供应商');await page.waitForFunction(()=>RfqAssistant.view().step===5);
  const record=async()=>JSON.parse(await fs.readFile(path.join(projectDirectory,(await fs.readdir(projectDirectory)).find(n=>n.endsWith('.json'))),'utf8'));
  const saved=await record(),summary=await page.evaluate(()=>({values:window.__summary.values,layout:window.__summary.layout.metadata.layout}));
  assert.deepEqual(await page.evaluate(()=>({book:Application.ActiveWorkbook.FullName,sheet:window.__activeSheet,cell:window.__selectedCell})),
   {book:saved.summary.path,sheet:{file:saved.summary.path,name:'分类汇总表'},cell:{file:saved.summary.path,sheet:'分类汇总表',row:4,column:4}},'每次进入都激活正确工作簿、汇总页和首组品牌格');
  assert.match(await page.locator('#simple-result').innerText(),/已切换到分类汇总表/);
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),{file:saved.summary.path,values:fixture.fillSummaryGrid(summary,fixture.SUMMARY_FILLS)});
  await shot('05-brands');await action('下一步：生成询价表');await page.waitForFunction(()=>RfqAssistant.view().step===6);
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'5','第6步返回品牌汇总');
  await action('下一步：生成询价表');await page.waitForFunction(()=>RfqAssistant.view().step===6);
  await action('生成询价总表');await page.getByRole('alertdialog').waitFor();await page.getByRole('alertdialog').getByRole('button',{name:'去填写'}).click();
  assert.equal(await page.locator('#header-projectName').evaluate(n=>n===document.activeElement),true);
  for(const [key,value] of Object.entries({projectName:'示例园区',company:'示例建设公司',contact:'测试员',phone:'示例联系方式',address:'示例市示例路1号'}))await page.locator('#header-'+key).fill(value);
  assert.equal(await page.locator('#assistant-header [aria-invalid=true]').count(),0,'填好后立即移除错误红框，不等待再点击生成');
  await shot('06-header');await action('生成询价总表');await page.waitForFunction(()=>RfqAssistant.view().action==='goSplit');
  const generated=await record();assert.equal(generated.generation.modelSnapshot.sheets.length,5);
  assert.equal(generated.header.address,'示例市示例路1号','公司地址随项目保存');
  assert.equal(generated.generation.modelSnapshot.sheets[0].values[1][0],'公司地址：示例市示例路1号','公司地址带入询价表第二行');
  const valve=generated.generation.modelSnapshot.sheets.find(s=>s.name==='阀门_合成询价');assert.deepEqual(valve.values.slice(valve.headerRow).map(r=>r[5]),['20','12']);assert.equal(valve.values[valve.headerRow][6],'通达 / 海岳');
  await action('下一步：拆分询价文件');
  const preparedProjectSave=page.waitForResponse(response=>response.url().endsWith('/api/project/save')&&response.status()===200&&!!response.request().postDataJSON().project.split);
  await action('选择输出文件夹');await preparedProjectSave;await shot('07-split-ready');
  await page.waitForFunction(()=>!RfqAssistant.snapshot().busy&&!document.getElementById('simple-back').disabled);
  const beforeBack=await record();
  await page.locator('#simple-back').press('Enter');
  await page.waitForFunction(()=>document.getElementById('simple-home').dataset.step==='6',null,{timeout:3000});
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'6','第7步键盘返回询价表');
  assert.equal(await page.locator('#header-company').inputValue(),'示例建设公司','返回保留已填写抬头');
  assert.deepEqual(await record(),beforeBack,'返回不保存或改写业务记录');
  await action('下一步：拆分询价文件');await page.waitForFunction(()=>RfqAssistant.view().step===7);
  assert.equal(await page.evaluate(()=>RfqAssistant.snapshot().outputDirectory),out,'返回再前进保留输出目录');
  // 拆分写入复用业务模型与真实发布/冻结/回执链；只替代宿主落盘。
  await page.evaluate(()=>{RfqExportHost.writeWorkbook=async(app,model,file,opts)=>{await window.__writeFixture(file,model.sheets);if(opts&&opts.finalizeFreeze)await opts.finalizeFreeze();};});
  await page.evaluate(()=>{window.__supplierWriteCount=0;const write=RfqBrandHost.write;RfqBrandHost.write=async function(){window.__supplierWriteCount++;return write.apply(this,arguments);};});
  await page.route('**/api/split/copy-complete',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'模拟完整总表导出失败'})}));
  await action('开始拆分');await page.waitForFunction(()=>!RfqAssistant.snapshot().busy);
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),7,'完整文件失败时不得显示全部完成');
  assert.equal(await page.evaluate(()=>window.__supplierWriteCount),6,'五个供应商件和无需询价清单已写出');
  assert.equal((await fs.readdir(out)).length,6);
  if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');
  await page.unroute('**/api/split/copy-complete');await action('重试未完成文件');
  await page.waitForFunction(()=>RfqAssistant.view().step===8,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.__supplierWriteCount),6,'仅补完整文件，不重写供应商件和无需询价清单');
  const done=await record();assert.equal(done.split.files.filter(f=>f.state==='succeeded').length,7);
  assert.equal((await fs.readdir(out)).length,7);assert.equal(await page.locator('#assistant-output-files li').count(),7);
  const complete=done.split.files.find(f=>f.kind==='complete-workbook');assert.ok(complete);assert.deepEqual(await fs.readFile(complete.target),await fs.readFile(inquiryTarget),'导出的完整工作簿必须原样保留');
  assert.match(await page.locator('#simple-desc').innerText(),/7/);await shot('08-complete');
  await page.waitForLoadState('networkidle');
  const stableBeforeBack=await record();
  for(let expected=7;expected>=1;expected--){
   await page.locator('#simple-back').click();
   assert.equal(await page.locator('#simple-home').getAttribute('data-step'),String(expected),'完成后连续返回到第'+expected+'步');
   assert.equal(await page.locator('#simple-home').isVisible(),true);
   assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('detail-mode')),false,'返回仍为简版');
  }
  await page.locator('#simple-back').click();await page.locator('#simple-back').click();
  assert.equal(await primary.innerText(),'查看已选清单预览');
  assert.equal(await page.locator('#simple-back').isHidden(),true,'选文件起始页没有更早操作');
  assert.deepEqual(await record(),stableBeforeBack,'连续返回不清除确认、品牌、总表或拆分回执');
  await showDetail();
  for(const [stage,previous] of [['split','inquiry'],['inquiry','brands'],['brands','categories'],['categories','review'],['review','matching'],['matching','import']]){
   await page.locator('#workflow-nav [data-stage="'+stage+'"].workflow-step-button').click();
   await page.locator('#workflow-back').click();
   assert.equal(await page.locator('#workflow-nav .is-current').getAttribute('data-stage'),previous,'详细版'+stage+'返回'+previous);
   assert.equal(await page.locator('#stage-panel-'+previous).isVisible(),true);
  }
  assert.deepEqual(await record(),stableBeforeBack,'详细版全部返回同样不改业务记录');
  const stores=await page.evaluate(()=>window.__stores);await page.addInitScript(stored=>{window.__stores=stored;},stores);
  await page.reload();await page.evaluate(()=>{RfqExportHost.showPreview=(app,model)=>({name:'预览'});});await page.locator('#simple-settings-toggle').click();await page.locator('[data-simple-section="project-section"]').click();
  await page.locator('#open-project').click();await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  assert.equal(await page.getByRole('alertdialog').count(),0,'恢复不能出现异常：'+await page.locator('#assistant-problem').textContent());
  await showDetail();await page.waitForFunction(()=>RfqAssistant.view().step===8);
  assert.equal(await primary.innerText(),'打开文件夹');assert.equal((await record()).split.files.length,7);await shot('09-restored');
  await fs.unlink(inquiryTarget);await page.reload();await page.evaluate(()=>{RfqExportHost.showPreview=()=>({name:'预览'});});
  await page.locator('#simple-settings-toggle').click();await page.locator('[data-simple-section="project-section"]').click();
  await page.locator('#open-project').click();await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');await showSimple();
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),6,'恢复检查发现总询价文件缺失时不得继续显示完成或允许拆分');
  await showDetail();await page.locator('#workflow-nav [data-stage="review"].workflow-step-button').click();
  await page.evaluate(rows=>rows.forEach((row,index)=>{if(row[11])window.__setCell(index+1,9,'无需询价');}),fixture.REVIEW_VALUES);
  await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>RfqAssistant.snapshot().noInquiry&&!document.getElementById('sheet-review-confirm').disabled);
  await showSimple();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'8','全部无需询价应直接完成');
  // 本夹具保留了旧拆分批次；改成全无需询价后，旧批次不一致提示仍是合法边界。
  if(await page.getByRole('alertdialog').count()){
   assert.match(await page.getByRole('alertdialog').innerText(),/该批次回执与当前拆分清单不一致/);
   await page.keyboard.press('Escape');
  }
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'3','无需询价完成页返回审核');
  await action('核对完成，生成分类工作簿');
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'8','无需询价再次确认回到完成，不落入无材料的品牌流程');
  assert.deepEqual(errors,[]);console.log('PASS: 新版单主按钮真实服务链10→8→整表确认→4类→5询价→5供应商，错误集中提醒及抬头聚焦。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
