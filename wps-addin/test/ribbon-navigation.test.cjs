const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'src','ribbon-navigation.js'),'utf8');
const STAGES=['import','matching','review','categories','brands','inquiry','split'];

// 每个“页面”都有自己的模块实例，但共享同一个 PluginStorage：用它模拟侧栏重建（重新加载模块）。
function freshModule(){
 const context={window:{},console};
 vm.runInNewContext(code,context,{filename:'ribbon-navigation.js'});
 return context.window.RfqRibbonNavigation;
}
function storage(options={}){
 const map=new Map();
 return {
  map:map,
  getItem(key){return map.has(key)?map.get(key):null;},
  setItem(key,value){map.set(key,String(value));},
  removeItem(key){if(options.keepOnRemove)return;map.delete(key);}
 };
}
// 只记录被真正调用的方法；业务动作（确认/学习/写表/拆分）一旦被导航路径调用就会出现在这里。
function workflowSpy(){
 const calls=[];
 const spy={
  goTo(stage){calls.push(['goTo',stage]);return true;},
  current(){calls.push(['current']);return 'import';},
  confirm(){calls.push(['confirm']);return true;},
  learn(){calls.push(['learn']);return true;},
  write(){calls.push(['write']);return true;},
  split(){calls.push(['split']);return true;}
 };
 return {spy:spy,calls:calls,methods:function(){return calls.map(function(entry){return entry[0];});}};
}
function plain(value){return JSON.parse(JSON.stringify(value));}

test('阶段清单就是既有7个ID，非法stage一律拒绝',()=>{
 const nav=freshModule();
 assert.deepEqual(plain(nav.STAGES),STAGES);
 STAGES.forEach(stage=>assert.equal(nav.isStage(stage),true,stage+'应被接受'));
 ['Import','split-file','',null,undefined,'unknown',0].forEach(stage=>{
  assert.equal(nav.isStage(stage),false,String(stage)+'应被拒绝');
 });
});

test('快捷入口请求只含{id,stage}，不携带材料内容',()=>{
 const nav=freshModule(),store=storage();
 const req=nav.request(store,'split');
 assert.equal(req.stage,'split');
 assert.equal(typeof req.id,'string');
 assert.ok(req.id.length>0);
 const raw=store.getItem(nav.KEY);
 const parsed=JSON.parse(raw);
 assert.deepEqual(Object.keys(parsed).sort(),['id','stage'],'请求只允许带id与stage');
 assert.deepEqual(Object.keys(req).sort(),['id','stage']);
 assert.equal(raw.includes('material'),false);
 assert.equal(raw.includes('rows'),false);
});

test('写入侧拒绝非法stage：不返回请求也不写存储',()=>{
 const nav=freshModule(),store=storage();
 assert.equal(nav.request(store,'split-file'),null);
 assert.equal(nav.request(store,'import2'),null);
 assert.equal(nav.request(store,null),null);
 assert.equal(store.getItem(nav.KEY),null,'非法阶段不得写入任何请求');
});

test('按钮控件能按tag或id解析阶段，未知控件拒绝',()=>{
 const nav=freshModule();
 STAGES.forEach(stage=>{
  assert.equal(nav.stageFromControl(stage),stage);
  assert.equal(nav.stageFromControl({tag:stage}),stage);
  const id='rfqStage'+stage.charAt(0).toUpperCase()+stage.slice(1);
  assert.equal(nav.stageFromControl({Id:id}),stage,'按按钮id解析 '+id);
 });
 assert.equal(nav.stageFromControl({tag:'bogus'}),null);
 assert.equal(nav.stageFromControl({Id:'rfqOpenPane'}),null);
 assert.equal(nav.stageFromControl(null),null);
 assert.equal(nav.stageFromControl({}),null);
});

test('每个快捷入口只导航：确认/学习/写表/拆分调用计数均为0',()=>{
 STAGES.forEach(stage=>{
  const nav=freshModule(),store=storage(),spy=workflowSpy();
  nav.request(store,stage);
  const result=nav.consume(store,spy.spy);
  assert.equal(result.applied,true,stage+'应导航成功');
  assert.equal(result.stage,stage);
  assert.deepEqual(spy.calls,[['goTo',stage]],'导航路径只允许调用 goTo('+stage+')');
  ['confirm','learn','write','split'].forEach(name=>{
   assert.equal(spy.methods().includes(name),false,'快捷入口不得调用 '+name);
  });
 });
});

test('侧栏未打开：请求留在存储里，打开时消费一次并立刻移除',()=>{
 const nav=freshModule(),store=storage(),spy=workflowSpy();
 nav.request(store,'brands');
 assert.ok(store.getItem(nav.KEY),'侧栏未打开时请求必须保留');
 const result=nav.consume(store,spy.spy);
 assert.equal(result.stage,'brands');
 assert.deepEqual(spy.calls,[['goTo','brands']]);
 assert.equal(store.getItem(nav.KEY),null,'消费后必须移除请求');
});

test('同一请求重复消费不会重复导航',()=>{
 const nav=freshModule(),store=storage(),spy=workflowSpy();
 nav.request(store,'inquiry');
 assert.equal(nav.consume(store,spy.spy).stage,'inquiry');
 assert.equal(nav.consume(store,spy.spy),null,'第二次消费应无事可做');
 assert.equal(nav.consume(store,spy.spy),null);
 assert.deepEqual(spy.calls,[['goTo','inquiry']]);
});

test('侧栏重建不重播已消费的请求（即使宿主不支持removeItem）',()=>{
 const store=storage();
 const first=freshModule(),spy=workflowSpy();
 first.request(store,'categories');
 assert.equal(first.consume(store,spy.spy).stage,'categories');
 // 重建：全新模块实例（内存状态全丢），但共享存储。
 const rebuilt=freshModule(),rebuiltSpy=workflowSpy();
 assert.equal(rebuilt.consume(store,rebuiltSpy.spy),null,'已消费请求不得重播');
 assert.deepEqual(rebuiltSpy.calls,[]);
 // 宿主不支持removeItem：请求键仍在，但已消费的id必须拦住重播。
 const keep=storage({keepOnRemove:true});
 const a=freshModule(),aSpy=workflowSpy();
 a.request(keep,'split');
 assert.equal(a.consume(keep,aSpy.spy).stage,'split');
 assert.ok(keep.getItem(a.KEY),'keepOnRemove场景下键仍然存在');
 const b=freshModule(),bSpy=workflowSpy();
 assert.equal(b.consume(keep,bSpy.spy),null,'同一id不得因键未删除而重播');
 assert.deepEqual(bSpy.calls,[]);
});

test('非法请求被丢弃：坏JSON或未知阶段都不导航',()=>{
 const nav=freshModule(),spy=workflowSpy();
 const bad=storage();
 bad.setItem(nav.KEY,'{not json');
 assert.equal(nav.consume(bad,spy.spy),null);
 assert.equal(bad.getItem(nav.KEY),null,'坏请求应被清理');
 const unknown=storage();
 unknown.setItem(nav.KEY,JSON.stringify({id:'x-1',stage:'not-a-stage'}));
 assert.equal(nav.consume(unknown,spy.spy),null);
 assert.equal(unknown.getItem(nav.KEY),null,'未知阶段应被清理');
 assert.deepEqual(spy.calls,[]);
});

test('侧栏已打开：低频检查接力，一次导航且不重复',()=>{
 const nav=freshModule(),store=storage(),spy=workflowSpy();
 const jobs=[];let seq=0;
 const scheduler={
  setTimeout(handler){jobs.push(handler);return ++seq;},
  clearTimeout(){},
  run(){const pending=jobs.splice(0,jobs.length);pending.forEach(handler=>handler());return pending.length;}
 };
 const handle=nav.watch(store,spy.spy,{setTimeout:scheduler.setTimeout,clearTimeout:scheduler.clearTimeout,intervalMs:50});
 assert.ok(handle&&handle.isRunning());
 assert.deepEqual(spy.calls,[],'没有请求时不得导航');
 // 侧栏已经打开时功能区新写入请求 → 下一次检查消费。
 nav.request(store,'review');
 assert.equal(scheduler.run(),1,'应有一次排定的检查');
 assert.deepEqual(spy.calls,[['goTo','review']]);
 assert.equal(store.getItem(nav.KEY),null);
 // 再跑几轮不得重复导航。
 scheduler.run();scheduler.run();
 assert.deepEqual(spy.calls,[['goTo','review']]);
 handle.stop();
 assert.equal(handle.isRunning(),false);
});

test('openStage只保证侧栏打开并写入请求，非法stage直接拒绝',()=>{
 const nav=freshModule();
 const events=[];
 const pane={ID:7,set Visible(value){events.push(['visible',value]);},set Width(value){events.push(['width',value]);}};
 const appStorage=storage();
 appStorage.setItem('rfq.taskpane.id','7');
 const app={PluginStorage:appStorage,GetTaskPane(){return pane;}};
 assert.equal(nav.openStage(app,'split'),true);
 assert.deepEqual(events,[['visible',true],['width',380]]);
 const request=JSON.parse(app.PluginStorage.getItem(nav.KEY));
 assert.equal(request.stage,'split');
 assert.equal(nav.openStage(app,'nope'),false,'非法阶段不得打开侧栏或写请求');
 assert.equal(nav.openStage(null,'split'),false);
});
