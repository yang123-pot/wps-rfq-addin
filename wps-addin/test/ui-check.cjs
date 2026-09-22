// Optional browser verification: requires Playwright in the developer's Node module path.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const {createServer} = require('../dev/server.cjs');

(async()=>{
  const server=createServer({root:path.resolve(__dirname,'..')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[];
  try {
    const page=await browser.newPage({viewport:{width:380,height:850}});
    page.on('pageerror',error=>errors.push(error.message));
    const url='http://127.0.0.1:'+server.address().port+'/taskpane.html';
    await page.goto(url);
    assert.equal(await page.locator('#read-workbook').isDisabled(),true);
    assert.match(await page.locator('#message').innerText(),/WPS/);
    await page.addInitScript(()=>{
      const values=[['工程名称：演示楼给排水','','','','',''],['序号','项目编码','项目名称','项目特征描述','单位','工程量'],
        ...Array.from({length:27},(_,i)=>[i+1,'000'+i,'管道'+i,'DN50\n含接头','m',i===0?'待定':i])];
      const sheet={Name:'给排水清单',UsedRange:{Row:1,Column:1,Rows:{Count:values.length},Columns:{Count:6},Value2:values},
        Activate(){},Cells:{Item(row,column){return {Select(){window.__selection={row,column};}};}}};
      window.Application={ActiveWorkbook:{Name:'演示.xlsx',FullName:'C:\\演示.xlsx',Worksheets:{Count:1,Item(){return sheet;}}}};
    });
    await page.reload();
    await page.locator('#read-workbook').click();
    await page.waitForFunction(()=>document.querySelector('#material-count')?.textContent==='27');
    assert.equal(await page.locator('#issue-count').innerText(),'1');
    assert.equal(await page.locator('#preview-list > li').count(),20);
    await page.locator('#next-page').click();
    assert.equal(await page.locator('#preview-list > li').count(),7);
    await page.locator('#preview-mode').selectOption('reviews');
    assert.equal(await page.locator('#preview-list > li').count(),1);
    assert.match(await page.locator('#preview-list').innerText(),/工程量.*待定/);
    await page.locator('#preview-list button').click();
    assert.deepEqual(await page.evaluate(()=>window.__selection),{row:3,column:3});
    await page.locator('#preview-mode').selectOption('issues');
    assert.match(await page.locator('#preview-list').innerText(),/工程量为空或不是有效/);
    await page.evaluate(()=>{window.Application.ActiveWorkbook.FullName='C:\\其他.xlsx';window.__selection=null;});
    await page.locator('#preview-list button').click();
    assert.match(await page.locator('#message').innerText(),/切换|原工作簿/);
    assert.equal(await page.evaluate(()=>window.__selection),null);
    await page.evaluate(()=>{Object.defineProperty(window.Application.ActiveWorkbook.Worksheets.Item(1).UsedRange,'Value2',{get(){throw new Error('测试读取失败');}});});
    await page.locator('#read-workbook').click();
    await page.waitForFunction(()=>document.querySelector('#message').className==='error');
    assert.equal(await page.locator('#preview-section').isHidden(),true);
    assert.equal(await page.locator('#sheets-section').isHidden(),true);
    assert.equal(await page.locator('#read-workbook').isEnabled(),true);
    await page.reload();
    await page.locator('#read-workbook').click();
    await page.waitForFunction(()=>document.querySelector('#material-count')?.textContent==='27');
    await page.locator('#preview-mode').selectOption('reviews');
    if(process.env.RFQ_UI_SCREENSHOT) await page.screenshot({path:process.env.RFQ_UI_SCREENSHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: outside WPS, read/parse, pagination, review filter, issue list, source location, workbook switch guard, read failure reset.');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
