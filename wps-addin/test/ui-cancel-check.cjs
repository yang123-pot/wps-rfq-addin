/*
 * R12-J 检查项2：对话框取消/右上角关闭。
 *
 * 本插件主流程不使用原生模态文件对话框（原生对话框会让侧栏停止出帧），
 * 选择文件/另存/选目录统一走侧栏内置 RfqPathPicker。这里对三种模式各取消一次
 * （取消按钮、右上角×、Esc），断言：只回调取消、不返回任何目标、不推进阶段、不创建半成品文件。
 */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os');
const {chromium}=require('playwright'),{createServer}=require('../dev/server.cjs');
const {createLibraryStore}=require('../dev/library-store.cjs');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const DRAIN=[['工程名称：示例园区','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
 ['SB-001','水泵','DN50','台','1'],['FM-001','阀门','DN50','个','20'],['GS-001','钢索','规格C','m','10']];
(async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'rfq-ui-cancel-'));
 const folder=path.join(root,'清单文件夹');
 await fsp.mkdir(folder);
 const files=[path.join(folder,'给排水清单.xlsx')];
 await fsp.writeFile(files[0],'drain');
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(root,'copies'),
  projectDirectory:path.join(root,'projects'),libraryDirectory:path.join(root,'library'),headerDirectory:path.join(root,'headers')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 await createLibraryStore({directory:path.join(root,'library')}).save({expectedRevision:0,library:sample.library,memory:sample.createMemory()});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:380,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({files,drain})=>{
   // 本检查只走取消路径，不真正导入；宿主只需提供最小可用形状。
   const previous={Name:'用户文件.xlsx',FullName:'C:\\用户文件.xlsx',Activate(){app.ActiveWorkbook=this;}};
   const app={ActiveWorkbook:previous,AutomationSecurity:1,
    Workbooks:{Count:1,Item(){return previous;},Open(){
     const sheet={Name:'给排水',UsedRange:{Row:1,Column:1,Rows:{Count:drain.length},Columns:{Count:5},Value2:drain}};
     const book={Name:'给排水清单.xlsx',FullName:files[0],Worksheets:{Count:1,Item(){return sheet;}},Activate(){app.ActiveWorkbook=this;},Close(){}};
     app.ActiveWorkbook=book;return book;}}};
   window.Application=app;window.__files=files;
  },{files,drain:DRAIN});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/taskpane.html?mode=detail');

  async function pickerCase(options,how){
   return await page.evaluate(async({options,how})=>{
    let confirmed='none',cancelledFlag=false;
    options.token=window.__RFQ_IMPORT__.token;
    options.onConfirm=function(value){confirmed=JSON.stringify(value);};
    options.onCancel=function(){cancelledFlag=true;};
    window.RfqPathPicker.open(options);
    await new Promise(r=>setTimeout(r,60));
    const picker=document.querySelector('.rfq-picker');
    if(!picker)return {missing:true};
    if(how==='x')picker.querySelector('.rfq-picker-close').click();
    else if(how==='esc')document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    else picker.querySelector('.rfq-picker-foot .locate').click();
    await new Promise(r=>setTimeout(r,40));
    return {confirmed,cancelledFlag,gone:!document.querySelector('.rfq-picker')};
   },{options,how});
  }
  const before=fs.readdirSync(root).sort().join('|');
  const cases=[
   {name:'选择文件-取消',options:{mode:'files',title:'选择清单',extensions:['.xls','.xlsx'],startPath:folder},how:'cancel'},
   {name:'选择文件-右上角关闭',options:{mode:'files',title:'选择清单',extensions:['.xls','.xlsx'],startPath:folder},how:'x'},
   {name:'另存-取消',options:{mode:'save',title:'另存成果表',fileName:'分类汇总表.xlsx',startPath:folder},how:'cancel'},
   {name:'另存-Esc',options:{mode:'save',title:'另存成果表',fileName:'分类汇总表.xlsx',startPath:folder},how:'esc'},
   {name:'选目录-取消',options:{mode:'directory',title:'选择拆分输出目录',startPath:folder},how:'cancel'},
   {name:'选目录-右上角关闭',options:{mode:'directory',title:'选择拆分输出目录',startPath:folder},how:'x'}
  ];
  const results=[];
  for(const item of cases){
   const result=await pickerCase(item.options,item.how);
   assert.equal(result.missing,undefined,item.name+': 选择器未打开');
   assert.equal(result.cancelledFlag,true,item.name+': 必须回调取消');
   assert.equal(result.confirmed,'none',item.name+': 取消不得返回任何目标');
   assert.equal(result.gone,true,item.name+': 取消后选择器必须关闭');
   results.push({name:item.name,how:item.how,confirmed:result.confirmed});
  }
  // 取消不得改变当前阶段，也不得产生任何半成品。
  assert.equal(await page.locator('#workflow-nav .workflow-step-button.is-current').getAttribute('data-stage'),'import','取消不得改变当前阶段');
  const after=fs.readdirSync(root).sort().join('|');
  assert.equal(after,before,'取消后不得创建半成品文件');
  assert.deepEqual(errors,[]);
  console.log('PASS: 选择文件/另存/选目录各取消与关闭一次，均只回调取消、不返回目标、不推进阶段、无半成品。');
 }finally{await browser.close();await new Promise(r=>server.close(r));await fsp.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
