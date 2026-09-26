const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs'),{createLibraryStore}=require('../dev/library-store.cjs');
const defaults=require('../rules/defaults.json'),Memory=require('../src/category-memory.js');
async function setInput(locator,value){
 await locator.fill(value);
 await locator.evaluate(element=>element.dispatchEvent(new Event('change',{bubbles:true})));
}
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-library-')),files=[path.join(root,'测试一.xlsx')];
 await fs.writeFile(files[0],'first file');
 const libraryDirectory=path.join(root,'library'),headerDirectory=path.join(root,'headers');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),headerDirectory:path.join(root,'headers'),libraryDirectory});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const store=createLibraryStore({directory:libraryDirectory});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:380,height:900}}),errors=[];
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
    '测试一.xlsx':[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
     ['001','水龙头','DN15','个','1'],['002','水表','DN50','个','2']]
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
  let failNextSave=false;
  await page.route('**/api/library/save',async route=>{
   if(failNextSave){failNextSave=false;
    return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'注入的保存失败'})});}
   return route.continue();
  });
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  await page.waitForFunction(()=>document.querySelector('#library-status').textContent.includes('本机分类库版本 0'));
  assert.equal(await page.locator('#library-categories > li').count(),4);
  assert.equal(await page.locator('#library-rules > li').count(),4);
  assert.equal(await page.locator('#library-categories > li[data-category-id="no-inquiry"]').getByRole('button').isDisabled(),true,
   '无需询价不能被停用');

  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===1);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 2'));
  const rows=page.locator('#classification-list > li');
  assert.equal(await rows.count(),2);
  assert.match(await rows.nth(0).innerText(),/水阀门/);
  assert.match(await rows.nth(1).innerText(),/无可靠匹配/);

  await store.save({expectedRevision:0,library:defaults,memory:Memory.create()});
  await page.locator('#library-add-category').click();
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('版本冲突'));
  assert.equal(await page.locator('#library-categories > li').count(),5,'版本冲突时本页草稿必须保留');
  await page.locator('#library-reload').click();
  await page.waitForFunction(()=>document.querySelector('#library-status').textContent.includes('本机分类库版本 1'));
  assert.equal(await page.locator('#library-categories > li').count(),4,'重新加载后回到已保存内容');

  await page.locator('#library-add-rule').click();
  const newRule=page.locator('#library-rules > li').last();
  await newRule.locator('select[aria-label="规则类别"]').selectOption('water-valve');
  await setInput(newRule.locator('input[aria-label="关键词"]').first(),'水表');
  await setInput(newRule.locator('input[aria-label="依据"]'),'测试新规则');
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('分类库已保存到本机'));
  assert.match(await page.locator('#library-status').innerText(),/版本 2/);
  await page.waitForFunction(()=>document.querySelector('#classification-list').textContent.includes('测试新规则'));
  assert.match(await page.locator('#classification-list > li').nth(1).innerText(),/水阀门/,'新规则要立刻反映到未确认行的建议');

  await page.locator('#library-rules > li').last().getByRole('button',{name:'添加排除条件'}).click();
  await setInput(page.locator('#library-rules > li').last().locator('input[aria-label="关键词"]').nth(1),'DN50');
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('分类库已保存到本机'));
  await page.waitForFunction(()=>document.querySelector('#classification-list > li:nth-child(2)').textContent.includes('无可靠匹配'));
  assert.match(await page.locator('#classification-list > li').nth(1).innerText(),/无可靠匹配/,'命中排除条件就不推荐');

  await page.locator('#library-categories > li[data-category-id="water-valve"]').getByRole('button',{name:'停用'}).click();
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('分类库已保存到本机'));
  await page.waitForFunction(()=>document.querySelector('#classification-list > li:nth-child(1)').textContent.includes('无可靠匹配'));
  const options=await page.locator('#classification-list > li').nth(0).locator('select option').allInnerTexts();
  assert.equal(options.includes('无需询价'),true,'停用其它类别后仍要能人工选择无需询价');

  await page.locator('#library-categories > li[data-category-id="water-valve"]').getByRole('button',{name:'启用'}).click();
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('分类库已保存到本机'));
  await page.waitForFunction(()=>document.querySelector('#classification-list > li:nth-child(1)').textContent.includes('水阀门'));

  await page.locator('#classification-list > li').nth(0).locator('button').first().click();
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余 1'));
  await page.waitForFunction(()=>document.querySelector('#memory-status').textContent.includes('已保存到本机分类库'));
  assert.match(await page.locator('#library-status').innerText(),/有效记忆 1/,'习惯保存后维护面板要同步到最新记忆');
  assert.match(await page.locator('#library-memories').innerText(),/确认来源 p-/,'记忆列表要显示确认来源');

  failNextSave=true;
  const categoryName=page.locator('#library-categories > li[data-category-id="water-valve"] input[aria-label="类别名称"]');
  await setInput(categoryName,'水阀门二');
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('草稿保留在本页'));
  assert.equal(await categoryName.inputValue(),'水阀门二','保存失败时本页草稿必须保留');
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('分类库已保存到本机'));
  assert.equal((await store.load()).library.categories.filter(category=>category.id==='water-valve')[0].name,'水阀门二');

  await page.locator('#library-memories > li').first().getByRole('button',{name:'撤销这条记忆'}).click();
  assert.match(await page.locator('#library-status').innerText(),/有效记忆 0/);
  await page.locator('#library-save').click();
  await page.waitForFunction(()=>document.querySelector('#library-message').textContent.includes('分类库已保存到本机'));
  const finalState=await store.load();
  assert.equal(finalState.memory.memories.length,1);
  assert.equal(finalState.memory.memories[0].state,'revoked');
  assert.equal(finalState.memory.memories[0].sources.length,1,'撤销记忆必须保留确认来源而不是硬删');
  await page.locator('#library-memory-filter').selectOption('revoked');
  assert.match(await page.locator('#library-memories').innerText(),/水龙头/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'380px窄侧栏不得横向溢出');
  assert.deepEqual(errors,[]);
  console.log('PASS: 分类库维护面板可新增类别/规则、排除条件生效、停用后无需询价仍可选、版本冲突与保存失败都不丢草稿、记忆撤销保留来源、习惯保存后建议即时刷新。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
