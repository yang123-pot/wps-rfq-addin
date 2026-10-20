const assert=require('node:assert/strict');const path=require('node:path');const {chromium}=require('playwright');const {createServer}=require('../dev/server.cjs');
(async()=>{const server=createServer({root:path.resolve(__dirname,'..')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage({viewport:{width:400,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.Application={ActiveWorkbook:null,AutomationSecurity:1,Workbooks:{Count:0,Item(){return null;}},PluginStorage:{getItem(){return null;},setItem(){},removeItem(){}},GetOpenFilename(){return false;}};});
  await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
  assert.equal(await page.locator('#assistant-files').count(),1,'导入预览必须有工作簿树');
  assert.equal(await page.locator('.simple-seven-row').count(),7);
  await page.waitForFunction(()=>RfqAssistant.hasAction('import'));
  await page.evaluate(()=>{RfqAssistant.register('probe',()=>new Promise(r=>{window.__releaseProbe=r;}));window.__probe=RfqAssistant.run('probe');});
  assert.equal(await page.locator('#save-project').isDisabled(),true,'处理中设置内的业务动作也不能同时触发');
  await page.evaluate(async()=>{window.__releaseProbe();await window.__probe;});
  for(const width of [320,400,500]){await page.setViewportSize({width,height:650});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const b=await page.locator('#simple-primary').boundingBox();assert.ok(b.y+b.height<=650&&b.y>=0,'底部按钮在可视范围');}
  await page.evaluate(()=>RfqAssistant.set({files:[{name:'一.xlsx',sheets:['材料']},{name:'二.xlsx',sheets:['材料']}],rows:10,mergedRows:8,previewAvailable:true,previewReviewed:false}));
  assert.match(await page.locator('#simple-primary').innerText(),/我已看完预览/);assert.equal(await page.locator('#simple-merge-choice').isHidden(),true);
  await page.evaluate(()=>RfqAssistant.set({previewReviewed:true}));assert.equal(await page.locator('#simple-merge-choice').isVisible(),true);
  await page.evaluate(()=>RfqAssistant.set({layout:'combined'}));assert.equal(await page.locator('#assistant-layout').inputValue(),'combined','恢复或详细模式改变布局后，简版选择也必须同步');
  await page.evaluate(()=>RfqAssistant.set({mergeConfirmed:true,reviewGenerated:true,reviewOpened:true}));assert.match(await page.locator('#simple-primary').innerText(),/核对完成/);
  assert.equal(await page.locator('#simple-back').isVisible(),true,'简版第3步必须能返回上一步');
  assert.equal(await page.locator('#simple-back').innerText(),'返回上一步');
  await page.setViewportSize({width:320,height:500});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,
   '第3步“返回上一步＋保存审核成果”不得横向溢出');
  await page.setViewportSize({width:400,height:768});
  assert.equal(await page.locator('#simple-save-review').innerText(),'保存审核成果','简版第3步必须能直接保存审核草稿');
  assert.equal(await page.locator('#simple-save-review').isVisible(),true);
  await page.evaluate(()=>{
   window.__simpleSaveClicks=0;
   var save=document.getElementById('sheet-review-save');save.disabled=false;
   save.addEventListener('click',function(event){
    window.__simpleSaveClicks++;event.stopImmediatePropagation();
   },{capture:true,once:true});
  });
  await page.locator('#simple-save-review').click();
  assert.equal(await page.evaluate(()=>window.__simpleSaveClicks),1,'简版保存入口必须触发真实草稿保存按钮');
  assert.match(await page.locator('#simple-result').innerText(),/正在保存审核草稿/);
  await page.locator('#simple-back').click();
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'matching',
   '简版返回必须进入上一步自动分类');
  assert.equal(await page.locator('#simple-home').isVisible(),true,'简版返回应留在简版，不把用户切到详细流程');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('detail-mode')),false);
  assert.equal(await page.locator('#simple-home').getAttribute('data-step'),'2','返回改变实际简版页面');
  await page.evaluate(()=>RfqAssistant.followProgress());
  await page.evaluate(()=>RfqAssistant.set({reviewConfirmed:true,categoriesReady:true,summaryReady:true,brandsOpened:true,brandsReady:true,expectedSheets:9}));
  // 1366×768/1920×1080 扣除功能区及常用缩放后的CSS等效操作区；真实WPS尺寸另行验收。
  for(const [width,height] of [[400,600],[400,900],[320,499],[320,360]]){
   await page.setViewportSize({width,height});const box=await page.locator('#simple-primary').boundingBox();
   assert.ok(box.y>=0&&box.y+box.height<=height,'抬头表单较长时主按钮也必须可见：'+width+'×'+height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:400,height:768});
  assert.equal(await page.locator('#assistant-header #header-phone').isVisible(),true,'抬头在当前步骤内');
  await page.locator('#simple-mode-toggle').click();await page.locator('#aux-section > summary').click();
  assert.equal(await page.locator('#header-section #header-phone').isVisible(),true,'详细模式和单位设置仍须能编辑抬头');
  await page.locator('#simple-mode-toggle').click();
  await page.evaluate(()=>RfqFeedback.notify({stage:'header',message:'缺少联系方式',force:true,resolve:()=>document.getElementById('header-phone').focus()}));
  assert.equal(await page.getByRole('alertdialog').count(),1);await page.getByRole('alertdialog').getByRole('button',{name:'去填写'}).click();assert.equal(await page.locator('#header-phone').evaluate(n=>n===document.activeElement),true);
  await page.evaluate(()=>RfqAssistant.set({inquiryReady:true}));assert.match(await page.locator('#simple-primary').innerText(),/下一步.*拆分/);
  await page.evaluate(()=>RfqAssistant.set({splitStarted:true,outputDirectory:'D:/test',split:{planned:9,complete:8,failed:1,pending:0,needsVerification:0,files:[]}}));assert.equal(await page.locator('#simple-primary').innerText(),'重试未完成文件');
  await page.evaluate(()=>{RfqFeedback.arm();RfqFeedback.notify({stage:'review',message:'空分类',issues:[{sheet:'分类审核成果',row:7,column:8,message:'最终分类为空'}]});RfqFeedback.notify({stage:'review',message:'空分类',issues:[{sheet:'分类审核成果',row:8,column:8,message:'最终分类为空'}]});});
  assert.equal(await page.getByRole('alertdialog').count(),1,'多问题只有一个弹窗');await page.keyboard.press('Escape');assert.equal(await page.getByRole('alertdialog').count(),0);
  assert.equal(await page.locator('#assistant-problem').isVisible(),true,'关闭弹窗后问题摘要仍可见');
  await page.evaluate(()=>RfqFeedback.notify({stage:'brands',force:true,message:'分类汇总表未打开：WPS中已打开另一目录的同名分类工作簿：F:\\同名簿B\\示例园区_分类工作簿.xlsx。请先保存并关闭该同名工作簿，再从当前项目重试；插件不会借用或关闭它。'}));
  const sameNameDialog=page.getByRole('alertdialog');
  assert.match(await sameNameDialog.locator('#assistant-error-description').innerText(),/处理方法：.*保存.*关闭.*重试/);
  assert.doesNotMatch(await sameNameDialog.innerText(),/请选择新的输出文件夹|另存新文件名/,
   '真实同名打开冲突不能被通用输出重名建议误导');
  await sameNameDialog.getByRole('button',{name:'返回上一步',exact:true}).click();
  await page.evaluate(()=>{RfqFeedback.arm();RfqFeedback.notify({stage:'review',message:'空分类',issues:[{sheet:'分类审核成果',row:7,column:8,message:'最终分类为空'}],resolve:()=>{}});RfqFeedback.tell('整表未通过校验',true,'review');});
  assert.match(await page.getByRole('alertdialog').innerText(),/H7/,'通用错误文字不能抹掉具体位置和去修改入口');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>RfqFeedback.notify({stage:'header',message:'返回测试',force:true}));
  await page.getByRole('alertdialog').getByRole('button',{name:'返回上一步',exact:true}).click();
  assert.equal(await page.getByRole('alertdialog').count(),0,'问题弹窗返回原操作页');
  assert.match(await page.locator('#simple-result').innerText(),/已返回/);
  await page.setViewportSize({width:400,height:500});
  await page.evaluate(()=>{
   RfqFeedback.arm();
   RfqFeedback.notify({stage:'source',message:'请处理以下19处问题，再确认整理方式。',resolve:()=>{},
    issues:Array.from({length:19},(_,index)=>({path:'C:\\Users\\刘杨\\Desktop\\先进材料创新研发基地项目(一期)(内装工程二标段).xlsx',
     file:'先进材料创新研发基地项目(一期)(内装工程二标段).xlsx',sheet:'表E.2.1 分部分项工程项目清单计价表【1-2#特殊4.1',
     row:443+index,column:6,code:'quantity-invalid',message:'工程量不是有效非负十进制数，已保留原值。'}))});
  });
  const sourceFix=page.getByRole('alertdialog').getByRole('button',{name:'去核对来源'});
  assert.equal(await sourceFix.isVisible(),true,'长问题列表不能把修正入口推到可视区外');
  const sourceFixBox=await sourceFix.boundingBox();
  assert.ok(sourceFixBox.y>=0&&sourceFixBox.y+sourceFixBox.height<=500,'修正入口必须在窄窗可视范围内');
  assert.match(await page.getByRole('alertdialog').innerText(),/仅显示前 8 项，共 19 项/);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);process.stdout.write('PASS: 新版固定操作区、七步状态、动态数量、弹窗和聚焦。\n');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
