// Optional DOM integration checks using a synthetic WPS host; not a WPS acceptance test.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const {createServer} = require('../dev/server.cjs');
(async()=>{
  const server=createServer({root:path.resolve(__dirname,'..')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:380,height:900}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const values=[['工程名称：测试楼','','','','',''],['序号','项目编码','项目名称','项目特征描述','单位','工程量'],
        [1,1,'水龙头','铜制','个','0.1'],['','','','含配件','',''],[2,'002','水龙头','钢制','个','0.2'],
        ['','','通风机','','',''],[3,'003','阀门','DN50','个','1'],['编制说明','','','','','']];
      window.__codeFormat='General';
      const sheet={Name:'清单',UsedRange:{Row:1,Column:1,Rows:{Count:8},Columns:{Count:6},Value2:values},Activate(){},Cells:{Item(){return {get NumberFormat(){return window.__codeFormat;},Select(){}};}}};
      window.Application={ActiveWorkbook:{Name:'核对测试.xlsx',FullName:'C:\\核对测试.xlsx',Worksheets:{Count:1,Item(){return sheet;}}}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/taskpane.html');
    await page.locator('#read-workbook').click();
    await page.waitForFunction(()=>document.querySelector('#material-count').textContent==='3');
    const original=await page.evaluate(()=>JSON.stringify(window.Application.ActiveWorkbook.Worksheets.Item(1).UsedRange.Value2));
    let first=page.locator('#preview-list > li').first();
    await first.locator('.review-editor > summary').click();
    assert.equal(await first.getByLabel('项目编码',{exact:true}).inputValue(),'');
    assert.equal(await first.getByLabel('已核对原清单，确认无项目编码').isDisabled(),true);
    await first.getByLabel('项目编码',{exact:true}).fill('0001');
    await first.getByLabel('已核对原表编码显示格式及前导零').check();
    await first.getByLabel('工程量',{exact:true}).fill('bad');
    await first.getByRole('button',{name:'确认本行核对'}).click();
    assert.match(await page.locator('#message').innerText(),/工程量/);
    await first.getByLabel('工程量',{exact:true}).fill('0.1');
    await first.getByRole('button',{name:'确认本行核对'}).click();
    await first.locator('.review-editor > summary').click();
    await first.getByLabel('归属材料行号').fill('5');
    await first.getByRole('button',{name:'确认第 4 行归属'}).click();
    await page.locator('#preview-list > li').nth(1).locator('details').first().locator('summary').click();
    assert.match(await page.locator('#preview-list > li').nth(1).innerText(),/钢制\n含配件/);
    assert.doesNotMatch(await first.locator('.feature').first().innerText(),/含配件/);
    await page.locator('#preview-mode').selectOption('issues');
    let section=page.locator('#preview-list > li').filter({hasText:'此行仅有项目名称'});
    await section.locator('.review-editor > summary').click();
    await section.getByLabel('此行是什么').selectOption('material');
    await section.getByLabel('项目编码',{exact:true}).fill('004');
    await section.getByLabel('单位',{exact:true}).fill('台');
    await section.getByLabel('工程量',{exact:true}).fill('2');
    await section.getByLabel('工程名称',{exact:true}).fill('测试楼');
    await section.getByLabel('专业',{exact:true}).fill('暖通');
    await section.getByRole('button',{name:'确认本行核对'}).click();
    assert.equal(await page.locator('#material-count').innerText(),'4');
    assert.match(await page.locator('#sheets').textContent(),/4 项/);
    assert.match(await page.locator('#preview-list').innerText(),/工程名称或专业来源不明确/);
    const unknown=page.locator('#preview-list > li').filter({hasText:'此非空行未识别'});
    await unknown.locator('.review-editor > summary').click();
    await unknown.getByLabel('此行是什么').selectOption('nonmaterial');
    await unknown.getByLabel('核对理由').fill('已核对，为编制说明');
    await unknown.getByRole('button',{name:'确认行类型'}).click();
    assert.doesNotMatch(await page.locator('#preview-list').innerText(),/此非空行未识别/);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.Application.ActiveWorkbook.Worksheets.Item(1).UsedRange.Value2)),original);
    await page.evaluate(()=>{window.__codeFormat='000000';});
    await page.locator('#save-review').click();
    assert.match(await page.locator('#message').innerText(),/工作簿内容已变化/,'仅修改数值编码显示格式也应阻断旧核对记录');
    assert.match(await page.locator('#review-status').innerText(),/未保存/);
    assert.match(await page.locator('#review-status').innerText(),/工作簿内容已变化/,'保存按钮旁必须解释拒绝原因，不能只在屏幕外的顶部提示');
    await page.locator('#restore-review').click();
    assert.match(await page.locator('#review-status').innerText(),/4 项核对记录 · 有修改未保存。恢复未完成：工作簿内容已变化/);
    await page.evaluate(()=>{window.__codeFormat='General';});
    // Failing storage must keep unsaved data and never show a success state.
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('QuotaExceededError');};});
    await page.locator('#save-review').click();
    assert.match(await page.locator('#message').innerText(),/保存失败/);
    assert.match(await page.locator('#review-status').innerText(),/未保存/);
    assert.match(await page.locator('#review-status').innerText(),/保存失败/);
    await page.locator('#preview-mode').selectOption('decisions');
    assert.equal(await page.locator('#preview-list > li').count(),4);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(process.env.RFQ_UI_REVIEW_SCREENSHOT) await page.screenshot({path:process.env.RFQ_UI_REVIEW_SCREENSHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: validation errors, continuation transfer, section promotion and downstream reparse, nonmaterial reason, unchanged host cells, storage failure, narrow layout.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
