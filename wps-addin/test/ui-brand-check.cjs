const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-brand-')),files=[path.join(root,'测试一.xlsx')];
 await fs.writeFile(files[0],'first file');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--explicitly-allowed-ports='+server.address().port]});
 let brandTarget=path.join(root,'分类品牌表.xlsx');
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(({files,root})=>{
   window.__copies=[];
   window.__root=String(root).replace(/\\/g,'/').toLowerCase()+'/';
   const nativeFetch=window.fetch;
   window.fetch=async function(...args){
    const response=await nativeFetch(...args);
    if(String(args[0])==='/api/import/prepare'&&response.ok){
     const data=await response.clone().json();
     if(Array.isArray(data.files))window.__copies=data.files;
    }
    return response;
   };
   const materialRows={
    '测试一.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
     ['001','水龙头','DN15','个','1'],['002','电动排烟阀手动开启钢索','','套','2']]
   };
   function sheetFor(path,name){
    window.__books=window.__books||{};
    window.__books[path]=window.__books[path]||{};
    if(!window.__books[path][name]){
     const original=(window.__copies.filter(item=>item.copyPath===path)[0]||{}).originalName;
     window.__books[path][name]={values:(materialRows[original]||[]).map(row=>row.slice())};
    }
    const store=window.__books[path][name];
    return {Name:name,UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:5},Value2:store.values}};
   }
   function bookFor(path){return {FullName:path,
    Worksheets:{Count:1,Item(name){return sheetFor(path,typeof name==='string'?name:'给排水');}},
    Activate(){app.ActiveWorkbook=this;},Close(){}};}
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
    GetSaveAsFilename(){return window.__saveAs;},
    Workbooks:{Count:1,Item(){return previous;},Open(file){
     if(files.includes(file))throw Error('original was opened');
     return bookFor(file);
    }}};
   window.Application=app;window.__files=files;
  },{files,root});
  await page.exposeFunction('__writeBrandFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  assert.match(await page.locator('#brand-status').innerText(),/先完成导入/,'分类未完成前不得建立品牌表');
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===1);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 2'));
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#merge-status').textContent.includes('本次预览已确认'));
  await page.waitForFunction(()=>document.querySelector('#brand-status').textContent.includes('分类'));
  const rows=page.locator('#classification-list > li');
  await rows.nth(0).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  await page.locator('#classification-list > li').nth(1).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  await page.waitForFunction(()=>document.querySelector('#brand-status').textContent.includes('尚未生成分类品牌表'));
  assert.match(await page.locator('#brand-categories').innerText(),/水阀门/,'按类别自动生成品牌行');
  assert.doesNotMatch(await page.locator('#brand-categories').innerText(),/无需询价/,'无需询价行不进入品牌表');
  assert.equal(await page.locator('#brand-categories [data-assignment-id]').count(),1);
  assert.match(await page.locator('#brand-status').innerText(),/品牌为空/,'没填品牌时品牌阶段不能完成');
  assert.equal(await page.locator('#brand-generate').isDisabled(),false,'结构通过即可生成待填写汇总表');

  await page.evaluate(target=>{
   window.RfqBrandHost.selectTarget=()=>target;
   window.RfqBrandHost.write=async(app,model,stagePath)=>{window.__brandModel=model;await window.__writeBrandFixture(stagePath);};
  },brandTarget);
  await page.locator('#brand-generate').click();
  await page.waitForFunction(()=>document.querySelector('#brand-message').textContent.includes('分类品牌表已生成'));
  assert.match(await page.locator('#brand-status').innerText(),/品牌表已生成：/,'生成后要记录品牌表路径');
  const model=await page.evaluate(()=>window.__brandModel);
  assert.deepEqual(model.sheets[0].values[1],['分配标识','类别','材料条目数','品牌','供应商','备注','材料行标识']);
  assert.equal(model.sheets[0].values[2][3],'','生成的汇总表品牌列必须是空的，等人工填写');
  assert.equal(model.sheets[0].values[2][4],'','供应商留到询价拆分步骤再补');
  const notes=model.sheets[2].values.map(row=>row[1]).join('；');
  assert.match(notes,/只能修改品牌、供应商、备注/,'汇总表要说明填写范围');
  assert.match(notes,/品牌列的唯一来源/,'汇总表要说明品牌与询价表联动');

  await page.evaluate(()=>{
   window.__readBinding=null;window.__readFails=null;
   window.RfqBrandHost.read=function(app,binding){
    window.__readBinding=binding;
    if(window.__readFails)throw Error(window.__readFails);
    const assignmentId=Object.keys(binding.rowMap)[0];
    return {path:binding.path,sheet:binding.sheet,inputKey:binding.inputKey,
     assignments:[{assignmentId:assignmentId,categoryId:'water-valve',brand:'品牌甲',supplier:'供应商A',note:'人工填写的品牌'}],rowCount:1};
   };
  });
  await page.locator('#brand-read').click();
  await page.waitForFunction(()=>!document.querySelector('#brand-preview').hidden);
  assert.match(await page.locator('#brand-preview-list').innerText(),/品牌：“”→“品牌甲”/,'读取后必须先给出逐项预览');
  assert.match(await page.locator('#brand-message').innerText(),/确认写入项目/);
  await page.locator('#brand-confirm-read').click();
  await page.waitForFunction(()=>document.querySelector('#brand-message').textContent.includes('已按品牌表更新项目'));
  assert.equal(await page.locator('#brand-categories input[aria-label="品牌"]').inputValue(),'品牌甲');
  assert.match(await page.locator('#brand-status').innerText(),/品牌已填写完整/);
  const binding=await page.evaluate(()=>window.__readBinding);
  assert.equal(binding.path,brandTarget);
  assert.match(String(binding.inputKey),/^ck1-[0-9a-f]{16}$/,'读回必须带生成时的内容键');
  assert.equal(Object.keys(binding.rowMap).length,1,'绑定必须按分配标识记录映射');

  await page.evaluate(()=>{window.__readFails='品牌表第3行的类别被改动（应为“水阀门”），不能读回。';});
  await page.locator('#brand-read').click();
  await page.waitForFunction(()=>document.querySelector('#brand-message').textContent.includes('类别被改动'));
  assert.equal(await page.locator('#brand-categories input[aria-label="品牌"]').inputValue(),'品牌甲','读取失败不得改动项目里的品牌');
  assert.match(await page.locator('#brand-message').innerText(),/品牌表未读取成功/);

  await page.locator('#brand-coverage').selectOption('material-subsets');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#project-status').innerText(),/品牌与抬头：未完成（抬头未填写完整/,
   '品牌填好但抬头为空时品牌阶段仍不能算完成');
  await page.evaluate(()=>{
   const values={'header-company':'测试安装工程有限公司','header-address':'测试市测试路1号',
    'header-phone':'010-12345678','header-projectName':'测试楼项目','header-contact':'测试员'};
   Object.keys(values).forEach(id=>{
    const input=document.getElementById(id);input.value=values[id];
    input.dispatchEvent(new Event('change',{bubbles:true}));});
  });
  await page.waitForFunction(()=>document.querySelector('#header-status').textContent.includes('抬头已齐全'));
  await page.locator('#header-save-template').click();
  await page.waitForFunction(()=>document.querySelector('#header-message').textContent.includes('请先填写模板名称'));
  await page.locator('#header-template-name').fill('本项目抬头');
  await page.locator('#header-save-template').click();
  await page.waitForFunction(()=>document.querySelector('#header-message').textContent.includes('已保存本机抬头模板'));
  assert.equal(await page.locator('#header-template-select option').count(),2,'保存后模板下拉里应出现该模板');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  assert.match(await page.locator('#project-status').innerText(),/品牌与抬头：已确认/,'人工填好品牌后品牌阶段必须置为已确认');
  assert.match(await page.locator('#project-status').innerText(),/生成询价表：未完成/);
  const saved=JSON.parse(await fs.readFile(path.join(root,'projects',(await fs.readdir(path.join(root,'projects')))[0]),'utf8'));
  assert.equal(saved.assignments.assignments[0].brand,'品牌甲','项目记录必须保存人工填写的品牌');
  assert.equal(saved.assignments.binding.path,brandTarget);
  assert.equal(saved.stages.brand.state,'ready');
  await page.reload();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  assert.equal(await page.locator('#brand-categories input[aria-label="品牌"]').inputValue(),'品牌甲','恢复项目后品牌与表路径要一致');
  assert.match(await page.locator('#brand-status').innerText(),/品牌表已生成：/);
  // D2：按品牌与抬头生成总询价工作簿，品牌列来自汇总表，报价单价与金额留空。
  const inquiryTarget=path.join(root,'项目询价.xlsx');
  await page.evaluate(target=>{
   window.__writtenModels=[];
   window.RfqBrandHost.selectTarget=()=>target;
   window.RfqBrandHost.write=async(app,model,stagePath)=>{
    window.__writtenModels.push(model);await window.__writeBrandFixture(stagePath);};
  },inquiryTarget);
  await page.locator('#inquiry-generate').click();
  await page.waitForFunction(()=>document.querySelector('#inquiry-message').textContent.includes('询价工作簿已生成'));
  assert.match(await page.locator('#inquiry-status').innerText(),/询价页 1 张/);
  assert.match(await page.locator('#inquiry-preview').innerText(),/品牌 品牌甲/);
  const written=await page.evaluate(()=>window.__writtenModels[window.__writtenModels.length-1]);
  assert.deepEqual(written.sheets[0].values[6].slice(0,10),
   ['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'],'对外列必须与白名单一致');
  assert.equal(written.sheets[0].values[7][6],'品牌甲','询价表品牌必须来自汇总表');
  assert.equal(written.sheets[0].values[7][7],'','报价单价留空');
  assert.equal(written.sheets[0].values[7][8],'','金额留空');
  assert.deepEqual(written.sheets.slice(1).map(sheet=>sheet.name),['内部追溯','处理记录'],'内部资料只留在内部页');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-status').textContent.includes('生成询价表：已确认'));

  // E2：一个询价页拆成一个文件，成功后写回执；输出目录必须先存在。
  const splitDirectory=path.join(root,'拆分');
  await fs.mkdir(splitDirectory,{recursive:true});
  await page.evaluate(target=>{window.__saveAs=target;},path.join(splitDirectory,'水阀门_供应商A.xlsx'));
  await page.locator('#split-directory').click();
  await page.waitForFunction(()=>document.querySelector('#split-status').textContent.includes('计划 1 个文件'));
  assert.match(await page.locator('#split-preview').innerText(),/水阀门_供应商A\.xlsx/);
  assert.match(await page.locator('#split-preview').innerText(),/品牌 品牌甲|品牌甲/);
  await page.locator('#split-run').click();
  await page.waitForFunction(()=>document.querySelector('#split-message').textContent.includes('拆分完成'));
  assert.match(await page.locator('#split-status').innerText(),/完成 1/);
  const splitFile=path.join(splitDirectory,'水阀门_供应商A.xlsx');
  assert.equal(require('node:fs').existsSync(splitFile),true,'拆分文件必须真实存在');
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-status').textContent.includes('拆分文件：已确认'));
  const afterSplit=JSON.parse(await fs.readFile(path.join(root,'projects',(await fs.readdir(path.join(root,'projects')))[0]),'utf8'));
  assert.equal(afterSplit.split.files.length,1);
  assert.equal(afterSplit.split.files[0].state,'succeeded');
  assert.match(afterSplit.split.files[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal(afterSplit.generation.target,inquiryTarget,'生成记录必须保存目标文件与内容键');
  assert.match(afterSplit.generation.inputKey,/^ck1-[0-9a-f]{16}$/);

  // 品牌变化后旧生成文件必须过期，拆分也不能继续沿用。
  await page.evaluate(()=>{
   window.RfqBrandHost.read=function(app,binding){
    const assignmentId=Object.keys(binding.rowMap)[0];
    return {path:binding.path,sheet:binding.sheet,inputKey:binding.inputKey,
     assignments:[{assignmentId:assignmentId,categoryId:'water-valve',brand:'品牌乙',supplier:'供应商A',note:''}],rowCount:1};
   };
  });
  await page.locator('#brand-read').click();
  await page.waitForFunction(()=>!document.querySelector('#brand-preview').hidden);
  await page.locator('#brand-confirm-read').click();
  await page.waitForFunction(()=>document.querySelector('#inquiry-status').textContent.includes('过期'));
  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-status').textContent.includes('旧生成文件已过期'));
  assert.match(await page.locator('#split-status').innerText(),/冲突 1：.*(不一致|重新生成)/,'过期后必须阻断旧拆分计划并说明原因');
  assert.equal(await page.locator('#split-run').isDisabled(),true,'过期计划不得再执行发布');
  assert.deepEqual(errors,[]);
  console.log('PASS: 品牌汇总表按类别自动生成与人工填品牌、抬头必填并保存本机模板、询价表按白名单生成且品牌来自汇总表、报价与金额留空、拆分一份一文件并写回执、品牌变化后旧生成文件与拆分计划立即阻断。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
