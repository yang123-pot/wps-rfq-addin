const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs'),{createLibraryStore}=require('../dev/library-store.cjs'),Memory=require('../src/category-memory.js');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'library-maintenance-')),libraryDirectory=path.join(root,'library'),store=createLibraryStore({directory:libraryDirectory}),s=await store.load();
 s.library.categories.push({id:'source-a',name:'测试源类',state:'active'},{id:'target-b',name:'测试目标类',state:'active'});
 s.memory=Memory.learn(s.memory,{categoryId:'source-a',categoryName:'测试源类',confirmedAt:'now',rowId:'r1'},{sourceProjectId:'p1',item:{name:'测试材料',feature:'DN50',unit:'个'}});
 await store.save({...s,expectedRevision:0});
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'imports'),libraryDirectory});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.type()==='prompt'?d.accept('测试改名'):d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+'/library.html');await page.waitForFunction(()=>document.querySelectorAll('#categories tr').length===6);
  assert.equal(await page.getByRole('checkbox',{name:'选择无需询价',exact:true}).isDisabled(),true);
  // 版本冲突保留输入，刷新后重试，不覆盖其他窗口。
  const loaded=await store.load();await store.save({...loaded,expectedRevision:loaded.revision});
  await page.locator('#new-name').fill('草稿保留');await page.locator('#add-form button').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('版本冲突'));
  assert.equal(await page.locator('#new-name').inputValue(),'草稿保留');await page.locator('#reload').click();await page.waitForTimeout(100);
  await page.locator('#add-form button').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('已保存'));assert.ok((await store.load()).library.categories.some(c=>c.name==='草稿保留'));
  const source=page.locator('#categories tr').filter({hasText:'测试源类'});await source.getByRole('button',{name:'归档',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('关联'));
  await source.getByRole('checkbox').check();await page.locator('#merge-target').selectOption('target-b');await page.locator('#preview-merge').click();await page.waitForFunction(()=>!document.querySelector('#merge-preview').hidden);
  assert.equal((await store.load()).library.categories.find(c=>c.id==='source-a').state,'active','预览不能合并');await page.locator('#merge-preview').getByRole('button',{name:'确认合并',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#merge-preview').hidden);
  let actual=await store.load();assert.equal(actual.library.categories.find(c=>c.id==='source-a').mergedInto,'target-b');assert.ok(actual.library.categories.find(c=>c.id==='target-b').aliases.includes('测试源类'));assert.equal(actual.memory.memories[0].categoryId,'target-b');
  // WPS WebDialog may suppress window.prompt; rename must expose an in-page editor.
  await page.evaluate(()=>{window.prompt=()=>null;});
  await page.locator('#categories tr').filter({hasText:'测试目标类'}).getByRole('button',{name:'改名',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'新的分类名称',exact:true}).count(),1,'clicking rename must create a visible editable field without a native prompt');
  const rename=page.getByRole('textbox',{name:'新的分类名称',exact:true});assert.equal(await rename.isVisible(),true);assert.equal(await rename.inputValue(),'测试目标类');
  await rename.fill('取消的名称');await page.getByRole('button',{name:'取消改名',exact:true}).click();
  assert.equal((await store.load()).library.categories.find(c=>c.id==='target-b').name,'测试目标类','cancel does not save');
  await page.locator('#categories tr').filter({hasText:'测试目标类'}).getByRole('button',{name:'改名',exact:true}).click();
  await rename.fill('测试改名');
  const renameConcurrent=await store.load();await store.save({...renameConcurrent,expectedRevision:renameConcurrent.revision});
  const renameConflict=page.waitForResponse(r=>r.url().endsWith('/api/library/window/mutate'));await page.getByRole('button',{name:'保存名称',exact:true}).click();
  assert.equal((await renameConflict).status(),409);await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('版本冲突'));
  assert.equal(await rename.inputValue(),'测试改名','failed save retains rename input');assert.equal(await rename.isVisible(),true);
  assert.equal((await store.load()).library.categories.find(c=>c.id==='target-b').name,'测试目标类');
  const oldRenameButton=await page.locator('#categories tr').filter({hasText:'测试目标类'}).getByRole('button',{name:'改名',exact:true}).elementHandle();
  await page.locator('#reload').click();await oldRenameButton.waitForElementState('hidden');
  // Explicitly selecting the refreshed row adopts its current revision and retains the draft.
  await page.locator('#categories tr').filter({hasText:'测试目标类'}).getByRole('button',{name:'改名',exact:true}).click();
  assert.equal(await rename.inputValue(),'测试改名');await page.getByRole('button',{name:'保存名称',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#categories').textContent.includes('测试改名'));
  assert.equal(await rename.isVisible(),false,'successful save closes the editor');
  assert.equal((await store.load()).memory.memories[0].categoryName,'测试改名');
  await page.locator('#advanced summary').click();await page.locator('#rule-category').selectOption('target-b');await page.locator('#rule-keywords').fill('测试材料');await page.locator('#rule-exclude').fill('DN65');await page.locator('#rule-form button').click();await page.waitForTimeout(100);actual=await store.load();assert.equal(actual.library.rules.at(-1).exclude[0].any[0],'DN65');
  // Reading another page at a newer revision must not make a stale rule safe to overwrite.
  await page.waitForFunction(()=>document.querySelector('#rules').textContent.includes('测试材料'));
  const concurrent=await store.load(),rule=concurrent.library.rules.at(-1);
  rule.exclude[0].any.push('消防');await store.save({...concurrent,expectedRevision:concurrent.revision});
  await page.locator('#category-search').fill('测试改名');await page.waitForFunction(()=>document.querySelectorAll('#categories tr').length===1);
  const toggled=page.waitForResponse(r=>r.url().endsWith('/api/library/window/mutate'));
  await page.locator('#rules li').filter({hasText:'测试材料'}).getByRole('button',{name:'停用',exact:true}).click();
  assert.equal((await toggled).status(),409,'old rendered rule must use its own revision');
  actual=await store.load();assert.deepEqual(actual.library.rules.at(-1).exclude[0].any,['DN65','消防']);assert.equal(actual.library.rules.at(-1).state,'active');
  await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('版本冲突'));
  await page.getByRole('tab',{name:'学习经验',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#memories li').length===1);await page.getByRole('button',{name:'撤销经验',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#memories').textContent.includes('没有学习经验'));
  actual=await store.load();assert.equal(actual.memory.memories[0].state,'revoked');assert.equal(actual.memory.memories[0].sources.length,1);await page.locator('#memory-state').selectOption('revoked');await page.waitForFunction(()=>document.querySelector('#memories').textContent.includes('测试材料'));
  assert.deepEqual(errors,[]);console.log('PASS library maintenance: conflict drafts, protected decision, archive guard, manual merge preview, aliases, rename, exclusion rule, revoke preserves sources');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
