// 不勾选“合并清单”时：两份来源各生成原表审核副本，UI 不调用单本扁平成果表写入；
// 读取汇总仍走同一整表确认链，确认快照包含全部 10 行。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs'),sample=require('./fixtures/workflow-v3-sample.cjs');
const fixture=require('./ui-inquiry-check.cjs'),xlsx=require('./fixtures/xlsx-container.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-source-review-'));
 const files=['给排水清单.xlsx','机电清单.xlsx'].map(name=>path.join(root,name));
 for(const file of files)await fs.writeFile(file,path.basename(file));
 const projectDirectory=path.join(root,'projects');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),projectDirectory,
  libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await createLibraryStore({directory:path.join(root,'library')}).save({expectedRevision:0,library:sample.library,memory:sample.createMemory()});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:768}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(fixture.initScript,{files,drain:fixture.DRAIN,mep:fixture.MEP,
   reviewTarget:path.join(root,'不应生成的扁平成果表.xlsx'),reviewValues:fixture.REVIEW_VALUES,root});
  await page.exposeFunction('__writeReviewFixture',(file,sheets)=>fs.writeFile(file,xlsx.workbook(sheets)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  await page.evaluate(({root})=>{
   RfqExportHost.showPreview=()=>({name:'预览'});
   RfqPathPicker.selectFolder=()=>({supported:true,path:root});
   window.__sourcePlans=[];window.__sourceOpened=0;window.__flatWrites=0;
   RfqSourceReviewHost.write=async(app,file,stage)=>{
    window.__sourcePlans.push(file);
    await window.__writeReviewFixture(stage,[{name:'审核占位',values:[['x']]}]);
   };
   RfqClassificationReviewHost.write=async()=>{window.__flatWrites++;};
   RfqClassificationReviewHost.openForEditing=()=>{window.__sourceOpened++;return {opened:true};};
  },{root});
  const primary=page.locator('#simple-primary');
  async function action(label){
   await page.waitForFunction(text=>document.getElementById('simple-primary').textContent===text&&
    !document.getElementById('simple-primary').disabled,label);
   if(await page.getByRole('alertdialog').count())await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.assistant-overlay'));
   await primary.click();
  }
  await action('选择清单文件');await action('我已看完预览');
  assert.equal(await page.locator('#simple-duplicate-merge').isChecked(),false,'默认不合并清单');
  await action('确认选择，开始自动分类');await action('生成分类核对表');
  await page.waitForFunction(()=>window.__sourcePlans.length===2&&RfqAssistant.view().step===3);
  assert.equal(await page.evaluate(()=>window.__flatWrites),0,'不得另造扁平审核成果表');
  assert.deepEqual(await page.evaluate(()=>window.__sourcePlans.map(file=>file.originalName)),
   ['给排水清单.xlsx','机电清单.xlsx']);
  assert.deepEqual(await page.evaluate(()=>window.__sourcePlans.map(file=>file.sheets.map(sheet=>sheet.name))),
   [['给排水'],['机电安装']]);
  assert.equal(await page.evaluate(()=>window.__sourcePlans.reduce((total,file)=>total+file.rowCount,0)),10);
  assert.match(await page.locator('#simple-result').innerText(),/2 份原表.*2 张工作表.*10 条材料/);
  assert.match(await page.locator('#classification-review-status').innerText(),/给排水清单.xlsx、机电清单.xlsx/);
  if(process.env.RFQ_SOURCE_REVIEW_SCREENSHOT)await page.screenshot({path:process.env.RFQ_SOURCE_REVIEW_SCREENSHOT,fullPage:true});
  await page.evaluate(()=>document.getElementById('save-project').click());
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  const record=JSON.parse(await fs.readFile(path.join(projectDirectory,(await fs.readdir(projectDirectory)).find(name=>name.endsWith('.json'))),'utf8'));
  assert.equal(record.matching.mode,'source-tables');
  assert.equal(record.matching.files.length,2);
  assert.equal(record.matching.fields.length,10);
  assert.equal(record.matching.files.every(file=>file.sheets.every(sheet=>sheet.rowIdColumn===sheet.originLastColumn+4)),true);
  // 模拟用户在每本原表右侧填写最终分类，整表读回仍应由统一确认链接收。
  await page.evaluate(()=>{
   const ids={水泵:'pump',阀门:'valve',风机:'fan',汽车充电桩:'ev-charger',无需询价:'no-inquiry'};
   const rows=window.__sourcePlans.flatMap(file=>file.sheets.flatMap(sheet=>sheet.rows.map(row=>{
    const finalName=row.autoCategoryName==='待核对'?'汽车充电桩':row.autoCategoryName;
    return {rowId:row.rowId,row:row.row,index:row.index,name:row.name,feature:row.feature,unit:row.unit,
     quantity:row.quantity,trace:row.trace,autoCategoryName:row.autoCategoryName,autoCategoryId:row.autoCategoryId,
     finalCategoryName:finalName,finalCategoryId:ids[finalName]||'',reviewNote:'',path:file.path,file:file.originalName,sheet:sheet.name};
   })));
   window.__sourceRead={rows:rows,issues:[],source:'source-tables'};
   RfqClassificationReviewHost.readBack=()=>window.__sourceRead;
   RfqClassificationReviewHost.refreshMatchColumn=()=>({updated:0,total:0});
   document.getElementById('sheet-review-confirm').click();
  });
  try{await page.waitForFunction(()=>document.querySelector('#sheet-review-message').textContent.includes('整表已确认'));}
  catch(error){throw Error('整表确认未完成：'+JSON.stringify(await page.evaluate(()=>({
   message:document.querySelector('#sheet-review-message').textContent,
   banner:document.querySelector('#sheet-review-banner').textContent,
   disabled:document.getElementById('sheet-review-confirm').disabled,
   state:RfqAssistant.snapshot(),view:RfqAssistant.view(),
   read:window.__sourceRead
  })))+'；'+error.message);}
  const confirmed=JSON.parse(await fs.readFile(path.join(projectDirectory,(await fs.readdir(projectDirectory)).find(name=>name.endsWith('.json'))),'utf8'));
  assert.equal(confirmed.review.rows.length,10);
  assert.equal(confirmed.review.counts.filled,10);
  assert.equal(confirmed.review.rows.find(row=>row.name==='充电桩配电箱').categoryName,'汽车充电桩');
  assert.equal(await page.evaluate(()=>window.__sourceOpened),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: 不合并清单时生成两份原表审核副本，保留原表结构并在右侧追加审核列；10行统一整表确认。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
