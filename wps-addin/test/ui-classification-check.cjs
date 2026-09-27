// 图02独立成果表：来源保护、精度、已有目标与过期绑定，替代旧侧栏逐行写回流程。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {initScript}=require('./ui-sheet-review-check.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-ui-classification-'));
 const files=[path.join(root,'给排水清单.xlsx'),path.join(root,'机电清单.xlsx')],target=path.join(root,'测试楼_分类审核成果.xlsx');
 await fs.writeFile(files[0],'original A');await fs.writeFile(files[1],'original B');
 const initial=await Promise.all(files.map(f=>fs.readFile(f)));
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const header=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量']];
  await page.addInitScript(initScript,{files,reviewTarget:target,reviewValues:[],
   drain:[...header,['000123','水管','DN50','m','0.1']],
   mep:[...header,['','给排水','','',''],['000456','水管','DN50','m','0.2'],['000789','水龙头','DN15','个','1']]});
  await page.exposeFunction('__writeReviewFixture',file=>fs.writeFile(file,Buffer.from([0x50,0x4b,3,4,1,2])));
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  await page.evaluate(target=>{
   window.__writes=0;
   window.RfqPathPicker.open=options=>options.onConfirm({target});
   window.RfqClassificationReviewHost.write=async(app,result,stage)=>{
    window.__writes++;window.__result=result;
    window.__seedReview(window.RfqClassificationReviewModel.mainSheet(result).values);
    await window.__writeReviewFixture(stage);
   };
  },target);
  await page.locator('#import-files').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  assert.equal(await page.locator('#classification-review-generate').isDisabled(),true);
  await page.locator('#confirm-merge').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-stats').textContent.includes('3 行'));
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  const separate=await page.evaluate(()=>window.__result);
  assert.equal(separate.rows.length,3);
  assert.deepEqual(separate.rows.slice(0,2).map(r=>r.quantity),['0.1','0.2']);
  assert.deepEqual(separate.rows.map(r=>r.code),['000123','000456','000789']);
  assert.equal(separate.counts.none,2);assert.equal(separate.rows[2].finalCategoryId,'water-valve');
  assert.equal(await page.evaluate(()=>window.__cellWrites.length),0,'生成成果不得回写导入副本');
  const firstBytes=await fs.readFile(target);
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('未生成'));
  assert.equal(await page.evaluate(()=>window.__writes),1,'已有同名文件在宿主写入前阻断');
  assert.deepEqual(await fs.readFile(target),firstBytes);
  await page.locator('#workflow-nav button[data-stage="import"]').click();
  await page.locator('#merge-identical').check();
  await page.locator('#confirm-merge').click();
  assert.equal(await page.locator('#classification-review-open').isDisabled(),true,'改合并选择旧成果必须失效');
  const mergedTarget=path.join(root,'合并审核成果.xlsx');
  await page.evaluate(target=>{window.RfqPathPicker.open=options=>options.onConfirm({target});
   window.RfqClassificationReviewHost.openForEditing=()=>({path:target,opened:true});},mergedTarget);
  await page.locator('#classification-review-generate').click();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('已生成并校验'));
  const merged=await page.evaluate(()=>window.__result);
  assert.equal(merged.rows.length,2);assert.equal(merged.rows[0].quantity,'0.3');
  assert.equal(merged.rows[0].sourceIds.length,2);
  await page.locator('#workflow-nav button[data-stage="import"]').click();
  await page.locator('#imported-books > li').nth(1).getByRole('button',{name:'移除此文件'}).click();
  assert.equal(await page.locator('#classification-review-open').isDisabled(),true,'来源变化禁止沿用旧审核文件');
  assert.equal(await page.locator('#classification-review-generate').isDisabled(),true,'来源变化须重新确认合并选择');
  await page.locator('#confirm-merge').click();
  const racingTarget=path.join(root,'过期请求.xlsx');
  await page.evaluate(target=>{window.RfqPathPicker.open=options=>options.onConfirm({target});},racingTarget);
  let release,started;
  const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/api/export/prepare',async route=>{
   started();await new Promise(resolve=>{release=resolve;});await route.continue();
  });
  await page.locator('#classification-review-generate').click();await waiting;
  await page.locator('#workflow-nav button[data-stage="import"]').click();
  await page.locator('#merge-separate').check();
  release();
  await page.waitForFunction(()=>document.querySelector('#classification-review-message').textContent.includes('未生成'));
  assert.match(await page.locator('#classification-review-message').textContent(),/变化/);
  assert.equal(await page.evaluate(()=>window.__writes),2,'等待服务期间来源或合并选择变化，宿主不得写入过期模型');
  assert.equal(await fs.stat(racingTarget).then(()=>true,()=>false),false,'过期生成不发布');
  assert.deepEqual(await Promise.all(files.map(f=>fs.readFile(f))),initial,'原始文件字节不变');
  assert.deepEqual(errors,[]);
  console.log('PASS: 新成果表保留分离来源/前导零/0.3精度，不回写副本，已有目标不覆盖，合并或来源变化使旧绑定失效。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
