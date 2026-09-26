/*
 * A2 最小回归：导入两份清单后，侧栏必须继续出帧。
 *
 * 实机证据（2026-09-26，outputs/wps-acceptance-20260926/probe/pane-report.json）：导入点击与原生模态
 * 文件对话框出现的同一时刻，侧栏内嵌网页的 requestAnimationFrame 停止回调（frameCount 停在 21、
 * framePendingMs 一路涨到 26 分钟），之后导入继续完成、DOM 高度涨到 11187px，但画面再没更新过。
 *
 * 本检查用同一序列（导入两份清单 → 分类列表出现）在浏览器模拟宿主上量出帧统计：
 *   1. 走侧栏内置选择器，全程不得调用 GetOpenFilename（原生对话框就是停摆嫌疑触发点）；
 *   2. 导入完成、分类列表渲染之后，rAF 必须继续回调，且不得出现长时间出帧空档。
 * 浏览器模拟宿主不能复现 WPS 宿主的合成器停摆，这里量的是页面侧能控制的代价（导入后的大范围重排），
 * 用来证明“页面侧没有长时间阻塞渲染”，并作为实机对照的同一序列。
 */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');

(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-render-stall-'));
 const folder=path.join(root,'清单文件夹');
 await fs.mkdir(folder);
 const files=[path.join(folder,'验收清单A.xlsx'),path.join(folder,'验收清单B.xls')];
 await fs.writeFile(files[0],'fixture A');
 await fs.writeFile(files[1],'fixture B');
 await fs.writeFile(path.join(folder,'说明.txt'),'必须被扩展名过滤掉');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers'),projectDirectory:path.join(root,'projects')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true,
  args:['--explicitly-allowed-ports='+server.address().port]});
 try{
  const page=await browser.newPage({viewport:{width:380,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   // 与实机探针同一口径：数帧数，并记录相邻两帧的最大间隔。
   window.__frameStats={count:0,maxGap:0,last:null};
   (function tick(now){
    const stats=window.__frameStats;
    stats.count++;
    if(stats.last!==null){const gap=now-stats.last;if(gap>stats.maxGap)stats.maxGap=gap;}
    stats.last=now;
    window.requestAnimationFrame(tick);
   })(performance.now());
  });
  await page.addInitScript(({files})=>{
   // 合成 WPS 宿主：只允许打开服务复制出来的工作副本，绝不打开原件。
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,
    GetOpenFilename(){throw Error('本检查不允许使用系统文件对话框');},
    GetSaveAsFilename(){throw Error('本检查不允许使用系统另存对话框');},
    Workbooks:{Count:1,Item(){return previous;},Open(file){
     if(files.includes(file))throw Error('original was opened');
     const values=[['工程名称：测试楼','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
      ['001','水管','DN50','m','0.1'],['002','水龙头','DN25','个','0.2']];
     const sheet={Name:'给排水',UsedRange:{Row:1,Column:1,Rows:{Count:4},Columns:{Count:5},Value2:values}};
     const book={Name:String(file).split(/[\\/]/).pop(),FullName:file,Worksheets:{Count:1,Item(){return sheet;}},
      Activate(){app.ActiveWorkbook=this;},Close(){}};
     app.ActiveWorkbook=book;
     return book;
    }}};
   window.Application=app;
  },{files});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html');
  assert.equal(await page.locator('#browse-files').isVisible(),true,'服务注入只读目录接口后必须出现侧栏内浏览按钮');

  await page.locator('#browse-files').click();
  await page.waitForSelector('.rfq-picker');
  await page.fill('.rfq-picker-path',folder);
  await page.locator('.rfq-picker-go').click();
  await page.waitForFunction(()=>document.querySelectorAll('.rfq-picker-entry[data-type=file]').length===2);
  assert.match(await page.locator('.rfq-picker-list').innerText(),/上级目录/,'进入目录后必须能返回上级');
  assert.equal(await page.locator('.rfq-picker-list').innerText().then(text=>text.includes('说明.txt')),false,'非 xls/xlsx 必须被过滤');
  await page.locator('.rfq-picker-entry[data-type=file]').filter({hasText:'验收清单A.xlsx'}).click();
  await page.locator('.rfq-picker-entry[data-type=file]').filter({hasText:'验收清单B.xls'}).click();
  assert.equal(await page.locator('.rfq-picker-entry.selected').count(),2,'两份清单都必须处于选中状态');
  assert.match(await page.locator('.rfq-picker-summary').innerText(),/已选 2 项/);
  await page.getByRole('button',{name:'导入选中的清单'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#imported-books > li').length===2);
  assert.equal(await page.locator('.rfq-picker').count(),0,'确认后选择器必须关闭');
  assert.match(await page.locator('#import-message').innerText(),/已导入 2 份清单/);
  await page.waitForFunction(()=>document.querySelector('#classification-progress').textContent.includes('剩余'));

  const before=await page.evaluate(()=>window.__frameStats.count);
  await page.waitForTimeout(1500);
  const stats=await page.evaluate(()=>({count:window.__frameStats.count,maxGap:window.__frameStats.maxGap,
   scrollHeight:document.documentElement.scrollHeight,nodes:document.querySelectorAll('*').length,
   classificationRows:document.querySelectorAll('#classification-list > li').length,
   mergeRows:document.querySelectorAll('#merge-list > li').length}));
  assert.ok(stats.classificationRows>0,'导入后分类列表必须已经渲染');
  assert.ok(stats.mergeRows>0,'导入后合并预览列表必须已经渲染');
  assert.ok(stats.count-before>=10,'导入完成后侧栏必须继续出帧，实测只增加 '+(stats.count-before)+' 帧');
  assert.ok(stats.maxGap<1000,'导入与渲染过程中不得出现超过 1 秒的出帧空档，实测 '+stats.maxGap.toFixed(1)+'ms');
  assert.deepEqual(errors,[]);
  console.log('PASS: 内置选择器导入两份清单后仍持续出帧，无系统对话框；'+
   '帧数 '+stats.count+'（1.5 秒内 +'+(stats.count-before)+'）、最大出帧间隔 '+stats.maxGap.toFixed(1)+'ms、'+
   '内容高度 '+stats.scrollHeight+'px、节点 '+stats.nodes+'。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
