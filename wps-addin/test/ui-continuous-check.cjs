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
   RfqCategoryWorkbooks.writeAll=async(app,plan,file,opts)=>{window.__summary=opts.summarySheet;window.__plan=plan;await window.__writeFixture(file,[opts.summarySheet]);};
   RfqCategoryWorkbooks.verifySheets=(app,file,expected)=>({ok:true,issues:[],sheets:expected.map((s,i)=>({index:i+1,sheetName:s.sheetName,rowCount:s.rowCount}))});
   RfqBrandHost.openSummary=(app,file)=>{window.__openedSummary=file;app.Workbooks.Open(file).Activate();return {path:file,opened:true};};
   RfqBrandHost.selectTarget=()=>inquiryTarget;
   RfqBrandHost.write=async(app,model,file,opts)=>{window.__inquiry=model;await window.__writeFixture(file,model.sheets);if(opts&&opts.finalizeFreeze)await opts.finalizeFreeze();};
   RfqBrandHost.openDirectory=()=>{};
  },{reviewTarget,inquiryTarget,out});
  const primary=page.locator('#simple-primary');
  async function action(label){try{await page.waitForFunction(text=>document.getElementById('simple-primary').textContent===text&&!document.getElementById('simple-primary').disabled,label);}catch(e){throw Error(label+' 未就绪：'+JSON.stringify(await page.evaluate(()=>({state:RfqAssistant.snapshot(),problem:document.getElementById('assistant-problem').textContent,message:document.getElementById('import-message').textContent})))+'；'+errors.join('；'));}await primary.click();console.log('操作：'+label);}
  async function shot(name){await page.waitForFunction(()=>!RfqAssistant.snapshot().busy);if(process.env.RFQ_UI_V2_SCREENSHOTS){await fs.mkdir(process.env.RFQ_UI_V2_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.RFQ_UI_V2_SCREENSHOTS,name+'.png')});}}
  await action('选择清单文件');await action('我已看完预览');
  await page.locator('#simple-duplicate-merge').check();
  assert.match(await page.locator('#simple-merge-summary').innerText(),/10.*8/);await shot('01-merge');
  await action('确认选择，开始自动分类');await shot('02-classified');
  await action('生成分类核对表');await page.waitForFunction(()=>RfqAssistant.view().step===3);
  assert.equal(await primary.innerText(),'核对完成，生成分类工作簿');await shot('03-review');
  // 错误先集中提醒，去修改定位到成果表；关闭后保留摘要。
  await primary.click();await page.getByRole('alertdialog').waitFor();assert.match(await page.getByRole('alertdialog').innerText(),/分类/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#assistant-problem').isVisible(),true);
  await page.evaluate(row=>window.__setCell(row,9,'汽车充电桩'),fixture.CONFLICT_ROW);
  await action('核对完成，生成分类工作簿');
  await page.waitForFunction(()=>RfqAssistant.view().action==='continueBrands');
  assert.equal(await page.evaluate(()=>RfqAssistant.snapshot().categoryCount),4);await shot('04-categories');
  // 旧分类簿仍在项目里，新版分类簿的保存失败时不能借旧绑定推进。
  await page.route('**/api/project/save',route=>{const p=route.request().postDataJSON().project;
   return p.review&&p.review.revision===2&&p.categories&&p.categories.reviewRevision===2
    ?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'模拟新版分类簿绑定保存失败'})}):route.continue();});
  await showDetail();await page.locator('[data-stage="review"].workflow-step-button').click();
  await page.evaluate(row=>window.__setCell(row,10,'新版审核备注'),fixture.CONFLICT_ROW);await page.locator('#sheet-review-confirm').click();
  await page.waitForFunction(()=>document.getElementById('project-message').textContent.includes('模拟新版分类簿绑定保存失败'));
  if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');await showSimple();
  assert.equal(await page.evaluate(()=>RfqAssistant.view().action),'saveProject','不能用上版已保存分类簿代替本版保存');
  await page.unroute('**/api/project/save');await action('重试保存项目');
  await page.route('**/api/project/save',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'模拟磁盘保存失败'})}));
  for(let attempt=0;attempt<2;attempt++){
   await action('下一步：填写品牌和供应商');await page.waitForFunction(()=>!RfqAssistant.snapshot().busy);
   if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>RfqAssistant.view().step),4,'汇总绑定未保存，重复点击也不能推进到填写品牌');
  }
  await page.unroute('**/api/project/save');
  await action('下一步：填写品牌和供应商');await page.waitForFunction(()=>RfqAssistant.view().step===5);
  const record=async()=>JSON.parse(await fs.readFile(path.join(projectDirectory,(await fs.readdir(projectDirectory)).find(n=>n.endsWith('.json'))),'utf8'));
  const saved=await record(),summary=await page.evaluate(()=>({values:window.__summary.values,layout:window.__summary.layout.metadata.layout}));
  await page.evaluate(({file,values})=>window.__seedSummary(file,values),{file:saved.summary.path,values:fixture.fillSummaryGrid(summary,fixture.SUMMARY_FILLS)});
  await shot('05-brands');await action('填写完成，下一步');await page.waitForFunction(()=>RfqAssistant.view().step===6);
  await action('生成询价总表');await page.getByRole('alertdialog').waitFor();await page.getByRole('alertdialog').getByRole('button',{name:'去填写'}).click();
  assert.equal(await page.locator('#header-projectName').evaluate(n=>n===document.activeElement),true);
  for(const [key,value] of Object.entries({projectName:'示例园区',company:'示例建设公司',contact:'测试员',phone:'示例联系方式'}))await page.locator('#header-'+key).fill(value);
  assert.equal(await page.locator('#assistant-header [aria-invalid=true]').count(),0,'填好后立即移除错误红框，不等待再点击生成');
  await shot('06-header');await action('生成询价总表');await page.waitForFunction(()=>RfqAssistant.view().action==='goSplit');
  const generated=await record();assert.equal(generated.generation.modelSnapshot.sheets.length,5);
  const valve=generated.generation.modelSnapshot.sheets.find(s=>s.name==='阀门_合成询价');assert.deepEqual(valve.values.slice(7,9).map(r=>r[5]),['20','12']);assert.equal(valve.values[7][6],'通达 / 海岳');
  await action('下一步：拆分询价文件');await action('选择输出文件夹');await shot('07-split-ready');
  // 拆分写入复用业务模型与真实发布/冻结/回执链；只替代宿主落盘。
  await page.evaluate(()=>{RfqExportHost.writeWorkbook=async(app,model,file,opts)=>{await window.__writeFixture(file,model.sheets);if(opts&&opts.finalizeFreeze)await opts.finalizeFreeze();};});
  await page.evaluate(()=>{window.__supplierWriteCount=0;const write=RfqBrandHost.write;RfqBrandHost.write=async function(){window.__supplierWriteCount++;return write.apply(this,arguments);};});
  await page.route('**/api/split/copy-complete',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'模拟完整总表导出失败'})}));
  await action('开始拆分');await page.waitForFunction(()=>!RfqAssistant.snapshot().busy);
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),7,'完整文件失败时不得显示全部完成');
  assert.equal(await page.evaluate(()=>window.__supplierWriteCount),5);assert.equal((await fs.readdir(out)).length,5);
  if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');
  await page.unroute('**/api/split/copy-complete');await action('重试未完成文件');
  await page.waitForFunction(()=>RfqAssistant.view().step===8,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.__supplierWriteCount),5,'仅补完整文件，不重写成功的五个供应商文件');
  const done=await record();assert.equal(done.split.files.filter(f=>f.state==='succeeded').length,6);assert.equal((await fs.readdir(out)).length,6);assert.equal(await page.locator('#assistant-output-files li').count(),6);
  const complete=done.split.files.find(f=>f.kind==='complete-workbook');assert.ok(complete);assert.deepEqual(await fs.readFile(complete.target),await fs.readFile(inquiryTarget),'导出的完整工作簿必须原样保留');
  assert.match(await page.locator('#simple-desc').innerText(),/5.*供应商.*1.*完整.*6/);await shot('08-complete');
  const stores=await page.evaluate(()=>window.__stores);await page.addInitScript(stored=>{window.__stores=stored;},stores);
  await page.reload();await page.evaluate(()=>{RfqExportHost.showPreview=(app,model)=>({name:'预览'});});await page.locator('#simple-settings-toggle').click();await page.locator('[data-simple-section="project-section"]').click();
  await page.locator('#open-project').click();await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  assert.equal(await page.getByRole('alertdialog').count(),0,'恢复不能出现异常：'+await page.locator('#assistant-problem').textContent());
  await showDetail();await page.waitForFunction(()=>RfqAssistant.view().step===8);
  assert.equal(await primary.innerText(),'打开文件夹');assert.equal((await record()).split.files.length,6);await shot('09-restored');
  await fs.unlink(inquiryTarget);await page.reload();await page.evaluate(()=>{RfqExportHost.showPreview=()=>({name:'预览'});});
  await page.locator('#simple-settings-toggle').click();await page.locator('[data-simple-section="project-section"]').click();
  await page.locator('#open-project').click();await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');await showSimple();
  assert.equal(await page.evaluate(()=>RfqAssistant.view().step),6,'恢复检查发现总询价文件缺失时不得继续显示完成或允许拆分');
  assert.deepEqual(errors,[]);console.log('PASS: 新版单主按钮真实服务链10→8→整表确认→4类→5询价→5供应商，错误集中提醒及抬头聚焦。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
