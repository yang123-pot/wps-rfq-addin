const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../dev/server.cjs');

(async () => {
  const server = createServer({ root: path.resolve(__dirname, '..') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 380, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const backing = window.sessionStorage;
      window.Application = {
        ActiveWorkbook: null,
        AutomationSecurity: 1,
        Workbooks: { Count: 0, Item() { return null; } },
        GetOpenFilename() { return false; },
        PluginStorage: {
          getItem(key) { return backing.getItem('plugin:' + key); },
          setItem(key, value) { backing.setItem('plugin:' + key, String(value)); },
          removeItem(key) { backing.removeItem('plugin:' + key); }
        }
      };
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/taskpane.html');

    assert.equal(await page.locator('header h1').innerText(), '材料整理助手');
    assert.equal(await page.locator('#simple-home').isVisible(), true, '默认显示七步简版');
    assert.equal(await page.locator('#workflow-section').isHidden(), true, '默认不铺开七步详细流程');
    assert.match(await page.locator('#simple-title').innerText(), /选择清单/);
    assert.equal(await page.locator('#simple-seven-list .simple-seven-row').count(), 7, '七步列表全部可见');
    assert.equal(await page.locator('#simple-seven-list .simple-seven-row.current .label').innerText(), '选择清单');
    assert.equal(await page.locator('header img').isHidden(), true, '效果图页头不显示独立图标');
    assert.equal(await page.locator('#simple-mode-toggle').evaluate(el=>getComputedStyle(el).opacity),'0','详细步骤入口收进设置，页头只保留齿轮');
    assert.equal(await page.locator('#simple-mode-toggle').evaluate(el=>getComputedStyle(el).pointerEvents),'auto','隐藏入口不影响自动化/键盘可用性');
    assert.equal(await page.locator('#simple-seven-list').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),7,'七步按效果图单行排列');
    assert.equal(await page.locator('#simple-progress-text').innerText(),'第 1 步 / 共 7 步');
    assert.equal(await page.locator('#simple-home .simple-primary').count(), 1, '当前步骤只有一个主按钮');
    assert.equal(await page.locator('#simple-settings').isHidden(), true);
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= 380), true, '简版在窄侧栏不得横向溢出');

    await page.locator('#simple-settings-toggle').click();
    assert.equal(await page.locator('#simple-settings').isVisible(), true);
    assert.equal(await page.locator('#simple-home').isHidden(), true);
    assert.equal(await page.locator('#simple-settings .simple-setting').count() >= 5, true, '设置包含项目/单位/分类/帮助/详细步骤');
    await page.locator('#simple-settings-close').click();
    for(const id of ['header-section','library-section','brand-reference-section','export-section']){
      await page.locator('#simple-settings-toggle').click();
      await page.locator('[data-simple-section="'+id+'"]').click();
      await page.locator('#'+id+' [data-aux-back]').click();
      assert.equal(await page.locator('#simple-settings').isVisible(),true,id+'返回设置');
      await page.locator('#simple-settings-close').click();
    }
    await page.evaluate(()=>{RfqRibbonNavigation.request(Application.PluginStorage,'help');window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>!document.getElementById('simple-help').hidden);
    await page.locator('#simple-help').getByRole('button',{name:'返回上一步',exact:true}).click();
    assert.equal(await page.locator('#simple-help').isHidden(),true,'帮助页能返回当前操作');
    assert.equal(await page.locator('#simple-settings').isHidden(), true);
    assert.equal(await page.locator('#simple-home').isVisible(), true);
    assert.match(await page.locator('#simple-result').innerText(),/已返回/,'关闭设置返回当前操作页并反馈');
    await page.locator('#simple-settings-toggle').click();
    await page.locator('[data-simple-section="project-section"]').click();
    await page.locator('#project-section [data-aux-back]').click();
    assert.equal(await page.locator('#simple-settings').isVisible(),true,'项目操作页返回设置');
    assert.match(await page.locator('#simple-settings-navigation').innerText(),/已返回设置/);
    await page.locator('#simple-settings-close').click();

    await page.evaluate(()=>{RfqRibbonNavigation.request(Application.PluginStorage,'help');window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>!document.getElementById('simple-help').hidden);
    assert.equal(await page.locator('#simple-help').isVisible(),true,'功能区帮助必须出现在当前可见页面');

    await page.locator('#simple-settings-toggle').click();
    await page.locator('#simple-detail-link').click();
    assert.equal(await page.locator('#simple-home').isHidden(), true);
    assert.equal(await page.locator('#workflow-section').isVisible(), true);
    assert.equal(await page.locator('#workflow-nav .workflow-step').count(), 7, '详细模式保留完整七步');
    assert.equal(await page.locator('#simple-mode-toggle').innerText(), '简版');
    assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'), 'import');

    await page.locator('#simple-mode-toggle').click();
    assert.equal(await page.locator('#simple-home').isVisible(), true);
    await page.locator('#simple-primary').click();
    assert.equal(await page.locator('#simple-home').isVisible(), true, '操作时始终停留在当前步骤卡片');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('simple-task-mode')), false, '简版不展开技术面板');
    assert.equal(await page.locator('#workflow-section').isHidden(), true, '简版任务视图不显示七步导航');
    assert.equal(await page.locator('#stage-panel-import').isHidden(), true, '简版不显示识别预览技术面板');
    assert.equal(await page.locator('.import-more').isHidden(), true, '简版隐藏备用导入入口');
    assert.equal(await page.locator('#stage-panel-import > section.card[aria-label="当前工作簿"]').isHidden(), true, '简版隐藏单簿读取入口');
    assert.equal(await page.locator('#simple-seven-list .simple-seven-row[role="button"]').count(), 0, '简版步骤列表只显示进度，不跳入技术页');

    // 页面说明文字不会推进业务进度。
    await page.evaluate(()=>{document.getElementById('project-status').textContent='分类工作簿：已确认';document.dispatchEvent(new Event('rfq:project-status'));});
    assert.equal(await page.locator('#simple-primary').innerText(),'选择清单文件');
    await page.evaluate(()=>RfqAssistant.set({reviewConfirmed:true,categoriesReady:true,summaryReady:true,brandsOpened:true}));
    assert.equal(await page.locator('#simple-primary').innerText(),'下一步：生成询价表');
    await page.evaluate(()=>RfqAssistant.set({brandsReady:true,expectedSheets:5}));
    assert.equal(await page.locator('#simple-primary').innerText(),'生成询价总表');
    assert.equal(await page.locator('#assistant-header #header-fax').isVisible(),true,'简版第6步可填写传真');
    assert.equal(await page.locator('#assistant-header #header-email').isVisible(),true,'简版第6步可填写邮箱');
    assert.equal(await page.locator('#assistant-header #header-address').isVisible(),true,'简版第6步直接填写公司地址');
    assert.match(await page.locator('#header-contact').getAttribute('aria-label'),/^材料经办人及联系电话$/);
    await page.setViewportSize({width:400,height:768});
    assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=400),true,'新增字段不导致窄窗横向溢出');
    if(process.env.RFQ_UI_SIMPLE_HEADER_SCREENSHOT)await page.screenshot({path:process.env.RFQ_UI_SIMPLE_HEADER_SCREENSHOT,fullPage:true});
    await page.evaluate(()=>RfqAssistant.set({inquiryReady:true}));
    assert.equal(await page.locator('#simple-primary').innerText(),'下一步：拆分询价文件');
    await page.evaluate(()=>RfqAssistant.set({splitStarted:true}));
    assert.equal(await page.locator('#simple-primary').innerText(),'选择输出文件夹');
    await page.evaluate(()=>RfqAssistant.set({outputDirectory:'D:/test'}));
    assert.equal(await page.locator('#simple-primary').innerText(),'开始拆分');
    await page.evaluate(()=>RfqAssistant.set({splitVerified:true,split:{planned:5,complete:5,failed:0,pending:0,needsVerification:0}}));
    assert.equal(await page.locator('#simple-primary').innerText(),'打开文件夹');
    assert.deepEqual(errors, [], '简版页面不得有脚本错误');
    process.stdout.write('PASS: 材料整理助手七步简版、设置抽屉和详细模式切换。\n');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });    // 技术说明文字不再决定进度；只消费业务模块发布的显式状态。
