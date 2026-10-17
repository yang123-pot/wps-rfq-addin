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
    assert.match(await page.locator('#simple-title').innerText(), /选清单/);
    assert.equal(await page.locator('#simple-seven-list .simple-seven-row').count(), 7, '七步列表全部可见');
    assert.equal(await page.locator('#simple-seven-list .simple-seven-row.current .label').innerText(), '选清单');
    assert.equal(await page.locator('#simple-home .simple-primary').count(), 1, '当前步骤只有一个主按钮');
    assert.equal(await page.locator('#simple-settings').isHidden(), true);
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= 380), true, '简版在窄侧栏不得横向溢出');

    await page.locator('#simple-settings-toggle').click();
    assert.equal(await page.locator('#simple-settings').isVisible(), true);
    assert.equal(await page.locator('#simple-home').isHidden(), true);
    assert.equal(await page.locator('#simple-settings .simple-setting').count() >= 5, true, '设置包含项目/单位/分类/帮助/详细步骤');
    await page.locator('#simple-settings-close').click();
    assert.equal(await page.locator('#simple-settings').isHidden(), true);
    assert.equal(await page.locator('#simple-home').isVisible(), true);

    await page.locator('#simple-mode-toggle').click();
    assert.equal(await page.locator('#simple-home').isHidden(), true);
    assert.equal(await page.locator('#workflow-section').isVisible(), true);
    assert.equal(await page.locator('#workflow-nav .workflow-step').count(), 7, '详细模式保留完整七步');
    assert.equal(await page.locator('#simple-mode-toggle').innerText(), '简版');
    assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'), 'import');

    await page.locator('#simple-mode-toggle').click();
    assert.equal(await page.locator('#simple-home').isVisible(), true);
    await page.locator('#simple-primary').click();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('simple-task-mode')), true, '主按钮进入简版任务视图');
    assert.equal(await page.locator('#workflow-section').isHidden(), true, '简版任务视图不显示七步导航');
    assert.equal(await page.locator('#stage-panel-import').isVisible(), true, '简版任务视图显示当前任务面板');
    await page.locator('#simple-mode-toggle').click();
    assert.equal(await page.locator('#simple-home').isVisible(), true, '顶部“简版”返回七步首页');

    await page.evaluate(() => {
      document.getElementById('project-status').textContent =
        '导入与合并：已确认 · 自动分类：已确认 · 表内审核：已确认 · 分类工作簿：已确认 · 品牌汇总：未完成 · 询价表：未完成 · 拆分文件：未完成';
      document.getElementById('brands-open').disabled = false;
      document.dispatchEvent(new Event('rfq:project-status'));
    });
    assert.match(await page.locator('#simple-title').innerText(), /填写品牌和供应商/);
    await page.evaluate(() => {
      document.getElementById('project-status').textContent =
        '导入与合并：已确认 · 自动分类：已确认 · 表内审核：已确认 · 分类工作簿：已确认 · 品牌汇总：已确认 · 询价表：未完成 · 拆分文件：未完成';
      document.dispatchEvent(new Event('rfq:project-status'));
    });
    assert.match(await page.locator('#simple-title').innerText(), /生成询价表/);
    await page.evaluate(() => {
      document.getElementById('project-status').textContent =
        '导入与合并：已确认 · 自动分类：已确认 · 表内审核：已确认 · 分类工作簿：已确认 · 品牌汇总：已确认 · 询价表：已确认 · 拆分文件：已确认';
      document.dispatchEvent(new Event('rfq:project-status'));
    });
    assert.match(await page.locator('#simple-title').innerText(), /完成了/);
    assert.deepEqual(errors, [], '简版页面不得有脚本错误');
    process.stdout.write('PASS: 材料整理助手七步简版、设置抽屉和详细模式切换。\n');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
