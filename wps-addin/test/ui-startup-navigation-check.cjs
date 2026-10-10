// Complete taskpane startup regression: a queued review request must not run
// its stage callback before the project and other business handles exist.
// All product scripts and the DOM are real; only the external WPS/API boundary
// is supplied in memory. No HTTP listener or native WPS session is started.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const sample = require('./fixtures/workflow-v3-sample.cjs');

const root = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:38892';
const stages = ['review', 'import', 'matching', 'categories', 'brands', 'inquiry', 'split'];
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml'};

async function startup(browser, {request = null, consumed = null, expectedStage = 'import'}) {
  const context = await browser.newContext({viewport:{width:380,height:900}});
  const page = await context.newPage();
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(origin + '/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      const responses = {
        '/api/library/load':{revision:0,library:sample.library,memory:sample.createMemory(),persisted:false},
        '/api/header/load':{revision:0,templates:[]}
      };
      if (!(url.pathname in responses)) writes.push(url.pathname);
      return route.fulfill({status:url.pathname in responses ? 200 : 400,
        contentType:'application/json',body:JSON.stringify(responses[url.pathname] || {error:'unexpected operation'})});
    }
    const asset = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    assert.ok(asset.startsWith(root + path.sep), 'static request must stay within the add-in');
    return route.fulfill({status:200,contentType:types[path.extname(asset)] || 'application/octet-stream',
      body:await fs.readFile(asset)});
  });
  await page.addInitScript(({request, consumed}) => {
    window.__RFQ_IMPORT__ = {token:'startup-test-token',browse:true};
    window.__hostWrites = [];
    const storage = window.sessionStorage;
    if (request) storage.setItem('plugin:rfq.window.nav.request', JSON.stringify(request));
    if (consumed) storage.setItem('plugin:rfq.window.nav.consumed', consumed);
    const denied = name => function() { window.__hostWrites.push(name); throw Error('unexpected host operation: ' + name); };
    const sheet = {Name:'用户表',UsedRange:{Row:1,Column:1,Rows:{Count:1},Columns:{Count:1}}};
    const book = {Name:'用户文件.xlsx',FullName:'C:\\startup-test\\用户文件.xlsx',
      Worksheets:{Count:1,Item(){return sheet;}},Activate:denied('Activate'),
      Save:denied('Save'),SaveAs:denied('SaveAs'),Close:denied('Close')};
    window.Application = {ActiveWorkbook:book,AutomationSecurity:1,
      Workbooks:{Count:1,Item(){return book;},Open:denied('Open'),Add:denied('Add')},
      GetOpenFilename:denied('GetOpenFilename'),GetSaveAsFilename:denied('GetSaveAsFilename'),
      PluginStorage:{getItem(key){return storage.getItem('plugin:' + key);},
        setItem(key,value){storage.setItem('plugin:' + key,String(value));},
        removeItem(key){storage.removeItem('plugin:' + key);}}};
  }, {request, consumed});
  try {
    await page.goto(origin + '/taskpane.html');
    assert.deepEqual(errors, [], 'queued navigation must not interrupt the complete taskpane initialization');
    await page.waitForFunction(() => document.querySelector('#connection').classList.contains('ready'));
    assert.equal(await page.locator('#read-workbook').isDisabled(), false, 'the taskpane must finish connecting');
    await page.waitForFunction(() => document.querySelector('#library-message').textContent.includes('已读取'));
    assert.equal(await page.locator('#workflow-nav .is-current').getAttribute('data-stage'), expectedStage);
    assert.equal(await page.locator('#stage-panel-' + expectedStage).isVisible(), true);
    const storage = await page.evaluate(() => ({request:window.Application.PluginStorage.getItem('rfq.window.nav.request'),
      consumed:window.Application.PluginStorage.getItem('rfq.window.nav.consumed')}));
    assert.equal(storage.request, null, 'the queued request must be removed after one consumption');
    if (request && stages.includes(request.stage)) assert.equal(storage.consumed, request.id);
    // Navigating away makes a replay visible: focus/pageshow and later ticks
    // must retain the user's new stage after the startup request was consumed.
    const nextStage = expectedStage === 'import' ? 'split' : 'import';
    await page.locator('#workflow-nav [data-stage="' + nextStage + '"] .workflow-step-button').click();
    await page.evaluate(() => {window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));});
    await page.waitForTimeout(750);
    assert.equal(await page.locator('#workflow-nav .is-current').getAttribute('data-stage'), nextStage,
      'startup navigation must not replay after a later user navigation');
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, [], 'navigation must not confirm, learn, publish or save a project');
    assert.deepEqual(await page.evaluate(() => window.__hostWrites), [], 'navigation must not mutate or open a workbook');
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const stage of stages) {
      await startup(browser, {request:{id:'nav-startup-' + stage,stage},expectedStage:stage});
      console.log('PASS: queued ' + stage + ' request completes real taskpane startup, consumes once, business writes 0');
    }
    await startup(browser, {});
    console.log('PASS: no queued request retains the import stage');
    await startup(browser, {request:{id:'nav-startup-invalid',stage:'unknown'}});
    console.log('PASS: invalid queued stage is removed without navigation');
    await startup(browser, {request:{id:'nav-startup-consumed',stage:'review'},consumed:'nav-startup-consumed'});
    console.log('PASS: already consumed review request does not replay during startup');
    console.log('PASS: startup navigation 10/10 (complete taskpane, simulated external host/API, no live WPS)');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode = 1;});
