// 来源核对必须通过真实项目保存/打开页面恢复；仅WPS宿主由模拟对象替代。
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const collection=require('../src/collection.js'),review=require('../src/review.js'),project=require('../src/project.js');
const {createProjectStore}=require('../dev/project-store.cjs');
async function run(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-source-review-'));
 const dirs={importDirectory:path.join(root,'copies'),projectDirectory:path.join(root,'projects'),
  libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers'),splitDirectory:path.join(root,'splits')};
 await fs.mkdir(dirs.importDirectory,{recursive:true});
 const originalPath=path.join(root,'input.xlsx'),copyPath=path.join(dirs.importDirectory,'input.xlsx'),bytes=Buffer.from('isolated source review fixture');
 await fs.writeFile(originalPath,bytes);await fs.writeFile(copyPath,bytes);
 const fingerprint=crypto.createHash('sha256').update(bytes).digest('hex');
 const snapshot={name:'input.xlsx',path:originalPath,fingerprint,sheets:[{name:'安装',startRow:1,startColumn:1,rowCount:5,columnCount:5,
  values:[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
   ['001','阀门','阀门首段','个','2'],['','','独立核对的续段','',''],['002','水泵','水泵首段','台','1']]}]};
 let c=collection.add(collection.create(),[{metadata:{originalPath,copyPath,originalName:'input.xlsx',fingerprint},snapshot}]);
 const entry=c.entries[0],record=review.setDecision(snapshot,entry.record,{kind:'continuation',sheet:'安装',row:4,targetRow:5});
 c=collection.update(c,entry.id,record,false);
 const saved=project.create(c,true,{projectId:'p-source-restore-ui'});saved.name='来源恢复测试';
 const store=createProjectStore({directory:dirs.projectDirectory});
 await store.save(saved,{expectedRevision:0});
 const unresolved=project.create(collection.add(collection.create(),[{metadata:entry.metadata,snapshot}]),true,{projectId:'p-source-unresolved-ui'});
 unresolved.name='未确认来源测试';await store.save(unresolved,{expectedRevision:0});
 const server=createServer({root:path.resolve(__dirname,'..'),...dirs});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.Application={ActiveWorkbook:null,AutomationSecurity:1,Workbooks:{Count:0}};});
  if(process.env.RFQ_SOURCE_REVIEW_OLD_IMPORT)
   await page.route('**/src/import-ui.js',route=>route.fulfill({contentType:'application/javascript',path:process.env.RFQ_SOURCE_REVIEW_OLD_IMPORT}));
  await page.route('**/src/taskpane.js',async route=>{
   const response=await route.fetch(),body=await response.text();
   // 只观测产品交给来源核对界面的实际entry，不替代恢复行为。
   const spy="const originalCreate=RfqImportUI.create; RfqImportUI.create=function(o){const select=o.onSelect;return originalCreate(Object.assign({},o,{onSelect:function(e){window.__sourceSelection=e;return select(e);}}));};\n";
   await route.fulfill({response,body:spy+body});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html?mode=detail');
  await page.locator('#aux-section > summary').click();
  await page.locator('#refresh-projects').click();
  await page.locator('#project-list li').filter({hasText:'来源恢复测试'}).getByRole('button',{name:'打开',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('project-message').textContent.includes('已恢复项目')||document.getElementById('project-message').textContent.includes('项目未打开'));
  const actual=await page.evaluate(()=>({message:document.getElementById('project-message').textContent,
   decisions:window.__sourceSelection?.record.decisions.length,
   rows:window.__sourceSelection?.parsed.materials.map(m=>[m.name,m.feature,m.quantity]),
   blockers:window.__sourceSelection?.parsed.issues.filter(i=>i.code==='feature-continuation').length,
   mergeStatus:document.getElementById('merge-status').textContent,
   confirmEnabled:!document.getElementById('confirm-merge').disabled}));
  assert.match(actual.message,/已恢复项目/);
  assert.equal(actual.decisions,1,'页面必须恢复已保存的来源核对，不重置为空记录');
  assert.deepEqual(actual.rows,[['阀门','阀门首段','2'],['水泵','水泵首段\n独立核对的续段','1']]);
  assert.equal(actual.blockers,0);assert.match(actual.mergeStatus,/本次校验通过/);assert.deepEqual(errors,[]);
  assert.equal(actual.confirmEnabled,true,'重开完成后必须解除按钮忙状态，允许继续确认合并选择');
  const persisted=await store.load(saved.projectId);
  assert.equal(persisted.revision,1);assert.deepEqual(persisted.sources[0].reviewRecord,record);
  await page.locator('#project-list li').filter({hasText:'未确认来源测试'}).getByRole('button',{name:'打开',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('project-message').textContent.includes('已恢复项目p-source-unresolved-ui'));
  assert.equal(await page.locator('#confirm-merge').isDisabled(),true,'没有真实来源核对记录仍须阻断');
  assert.equal(await page.evaluate(()=>window.__sourceSelection.record.decisions.length),0);
  assert.match(await page.locator('#merge-status').textContent(),/待核对问题仍阻断/);
  assert.deepEqual(errors,[]);
  console.log('ui-source-review-restore PASS');
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('rfq-source-review-'))throw Error('Unexpected cleanup target');
  await fs.rm(root,{recursive:true,force:true});
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
