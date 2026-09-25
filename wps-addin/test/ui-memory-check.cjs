const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs'),{createLibraryStore}=require('../dev/library-store.cjs');
const STATE='library-state.json';
async function waitFor(check,label){
 for(let attempt=0;attempt<60;attempt++){
  const value=await check();
  if(value)return value;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('等待超时：'+label);
}
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-memory-')),files=[path.join(root,'一号.xlsx'),path.join(root,'二号.xls')];
 await fs.writeFile(files[0],'first file');await fs.writeFile(files[1],'second file');
 const libraryDirectory=path.join(root,'library'),stateFile=path.join(libraryDirectory,STATE);
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const store=createLibraryStore({directory:libraryDirectory});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const exists=async()=>{try{await fs.stat(stateFile);return true;}catch(_){return false;}};
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(({files,root})=>{
   window.__copies=[];window.__written=[];window.__books={};
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
    '一号.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['001','水龙头','DN15','个','1']],
    '二号.xls':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['002','水龙头','DN20','个','2']]
   };
   function sheetFor(path,name){
    window.__books[path]=window.__books[path]||{};
    if(!window.__books[path][name]){
     const original=(window.__copies.filter(item=>item.copyPath===path)[0]||{}).originalName;
     const seed=materialRows[original]||Array.from({length:3},()=>['','','','','']);
     window.__books[path][name]={values:seed.map(row=>row.slice()),cells:{}};
    }
    const store=window.__books[path][name];
    return {Name:name,
     UsedRange:{Row:1,Column:1,Rows:{Count:store.values.length},Columns:{Count:store.values[0].length},Value2:store.values},
     Cells:{Item(row,column){return {NumberFormat:'',
      get Value2(){const value=store.cells[row+':'+column];return value===undefined?null:value;},
      set Value2(value){store.cells[row+':'+column]=value;
       window.__written.push({path:path,sheet:name,row:row,column:column,value:value});},
      get HasFormula(){return false;}};}}};
   }
   function bookFor(path,readOnly){
    return {FullName:path,ReadOnly:!!readOnly,
     Worksheets:{Count:1,Item(name){return sheetFor(path,typeof name==='string'?name:'给排水');}},
     Activate(){app.ActiveWorkbook=this;},Save(){},Close(){}};
   }
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,GetOpenFilename(){return window.__files;},
    Workbooks:{Count:1,Item(){return previous;},Open(file,links,readOnly){
     if(files.includes(file))throw Error('original was opened');
     const isCopy=String(file).replace(/\\/g,'/').toLowerCase().startsWith(window.__root);
     if(!isCopy&&!window.__copies.some(item=>item.copyPath===file))throw Error('unknown copy');
     return bookFor(file,readOnly);
    }}};
   window.Application=app;window.__files=files;
  },{files,root});
  await page.exposeFunction('__writeExportFixture',async file=>{await fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2]));});
  let saveAttempts=0;
  await page.route('**/api/library/save',async route=>{
   saveAttempts++;
   if(saveAttempts===1)return route.fulfill({status:500,contentType:'application/json',
    body:JSON.stringify({error:'注入的保存失败'})});
   return route.continue();
  });
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 2'));
  assert.equal(await exists(),false,'只渲染建议不得写入习惯');

  const rows=page.locator('#classification-list > li');
  assert.equal(await rows.count(),2);
  await rows.nth(0).locator('select').selectOption('water-valve');
  await page.waitForTimeout(150);
  assert.equal(await exists(),false,'只选择下拉但未确认不得写入习惯');
  await rows.nth(0).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  await page.waitForFunction(()=>document.querySelector('#memory-status').textContent.includes('习惯未保存'));
  assert.equal(await page.locator('#memory-retry').isVisible(),true,'记忆保存失败必须给出可重试入口');
  assert.equal(await exists(),false,'记忆保存失败时不得留下半份数据');
  assert.equal((await page.locator('#classification-progress').innerText()).includes('已确认 1'),true,'记忆失败不得回滚分类确认');
  await page.locator('#memory-retry').click();
  await page.waitForFunction(()=>document.querySelector('#memory-status').textContent.includes('已保存'));
  const first=await store.load();
  assert.equal(first.revision,1);
  assert.equal(first.memory.memories.length,1);
  assert.equal(first.memory.memories[0].sources.length,1);
  assert.match(String(first.memory.memories[0].sources[0].sourceProjectId),/^p-[a-z0-9-]+$/,'确认来源必须带稳定项目身份');
  assert.equal(typeof first.memory.memories[0].sources[0].sourceRowId,'string');
  assert.ok(first.memory.memories[0].sources[0].sourceRowId.length>0,'确认来源必须带行标识');

  await rows.nth(0).locator('button').first().click();
  await page.waitForTimeout(300);
  const repeated=await store.load();
  assert.equal(repeated.memory.memories.length,1,'重复确认不得重复学习');
  assert.equal(repeated.memory.memories[0].sources.length,1,'重复确认不得新增重复依据');

  await rows.nth(0).locator('button').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 2'));
  const revoked=await waitFor(async()=>{
   const state=await store.load();
   return state.memory.memories.some(record=>record.state==='revoked')?state:null;
  },'撤销后的习惯状态');
  assert.equal(revoked.memory.memories.filter(record=>record.state==='active').length,0,'撤销本次确认后无其它有效来源，习惯必须失效');
  assert.equal(revoked.memory.history[revoked.memory.history.length-1].action,'release-revoke');

  await rows.nth(0).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  const relearned=await waitFor(async()=>{
   const state=await store.load();
   return state.memory.memories.filter(record=>record.state==='active').length===1?state:null;
  },'重新确认后的习惯状态');
  assert.equal(relearned.memory.memories.filter(record=>record.state==='active')[0].sources.length,1);

  await rows.nth(1).locator('input[type="checkbox"]').check();
  await page.locator('#batch-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  const batched=await waitFor(async()=>{
   const state=await store.load();
   return state.memory.memories.filter(record=>record.state==='active').length===2?state:null;
  },'批量确认后的习惯状态');
  const activeBatched=batched.memory.memories.filter(record=>record.state==='active');
  assert.equal(activeBatched.length,2,'两种材料各有一条有效习惯');
  assert.equal(activeBatched.every(record=>record.sources.length===1),true);
  assert.equal(batched.memory.memories.filter(record=>record.state==='revoked').length,1,'被撤销习惯保留历史而不是硬删');

  await page.locator('#save-project').click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已保存到本机'));
  const beforeReload=await fs.readFile(stateFile,'utf8');
  await page.reload();
  await page.locator('#open-project').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-list > li button').length>=1);
  await page.locator('#project-list > li button').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-message').textContent.includes('已恢复项目'));
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 0'));
  assert.equal(await fs.readFile(stateFile,'utf8'),beforeReload,'打开旧项目并恢复分类不得触发新的学习或改写习惯');
  assert.deepEqual(errors,[]);
  console.log('PASS: 未确认不学习、保存失败可重试且不回滚确认、重复确认不重复学习、撤销只失效本次来源、批量确认学习、恢复旧项目不改写习惯。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
