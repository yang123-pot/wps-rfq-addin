const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'main.js'),'utf8');
const navCode=fs.readFileSync(path.join(root,'src','ribbon-navigation.js'),'utf8');
const ribbon=fs.readFileSync(path.join(root,'ribbon.xml'),'utf8');
function buttonAction(id){
 const tag=ribbon.match(new RegExp('<button\\b[^>]*\\bid="'+id+'"[^>]*>'));
 assert.ok(tag,'功能区必须有 '+id+' 按钮');
 const action=tag[0].match(/\bonAction="([^"]+)"/);
 assert.ok(action,'按钮必须连接回调');
 return action[1];
}
function buttonTag(id){
 const tag=ribbon.match(new RegExp('<button\\b[^>]*\\bid="'+id+'"[^>]*/>'));
 assert.ok(tag,'功能区必须有 '+id+' 按钮');
 return tag[0];
}
// R12-K：与获批图01/07一致的功能区阶段入口（按钮id、按钮文字、阶段ID）。
const STAGE_BUTTONS=[
 ['rfqStageImport','导入清单','import'],
 ['rfqStageMatching','自动分类','matching'],
 ['rfqStageReview','表内审核','review'],
 ['rfqStageCategories','分类工作簿','categories'],
 ['rfqStageBrands','品牌汇总','brands'],
 ['rfqStageInquiry','询价表','inquiry'],
 ['rfqStageSplit','拆分文件','split']
];
function load(options={}){
 const events=[];let paneVisible=true,paneWidth=380;
 const pane={ID:7,
  get Visible(){return paneVisible;},
  set Visible(value){if(options.refuseHide&&value===false)throw Error('宿主拒绝隐藏');paneVisible=value;events.push(['visible',value]);},
  get Width(){return paneWidth;},
  set Width(value){paneWidth=value;events.push(['width',value]);},
  Navigate(url){events.push(['navigate',url]);if(options.failNavigate)throw Error('导航失败');}};
 const values=new Map();
 const store={getItem(key){if(key==='rfq.taskpane.id')return options.hasPane===false?null:7;return values.has(key)?values.get(key):null;},
  setItem(key,value){values.set(key,String(value));events.push(['store',key,value]);},
  removeItem(key){values.delete(key);events.push(['remove',key]);}};
 const application={PluginStorage:store,GetTaskPane(){if(options.failGet)throw Error('旧面板不存在');return options.hasPane===false?null:pane;},
  CreateTaskPane(url){events.push(['create',url]);return pane;}};
 const context={document:{write(){}},window:{Application:application,location:{href:'http://127.0.0.1:38891/main.js'}},
  confirm(){events.push(['confirm']);return options.confirm!==false;},alert(message){events.push(['alert',message]);}};
 if(!options.skipNav)vm.runInNewContext(navCode,context,{filename:'ribbon-navigation.js'});
 vm.runInNewContext(code,context,{filename:'main.js'});
 return {context,events,pane,store};
}

test('普通打开复用现有侧栏且不重载页面内存',()=>{
 const {context,events}=load();
 assert.equal(context[buttonAction('rfqOpenPane')](),true);
 assert.equal(events.some(event=>event[0]==='navigate'),false);
});

test('恢复按钮由用户确认后重载现有 WPS 侧栏',()=>{
 const {context,events}=load();
 assert.equal(context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(events,[['confirm'],['visible',false],['visible',true],['width',381],['width',380],
  ['navigate','http://127.0.0.1:38891/taskpane.html']],'停住后必须按重建处理：先隐藏再显示、改动宽度、最后导航');
});

test('取消恢复保留当前侧栏且不调用 Navigate',()=>{
 const {context,events}=load({confirm:false});
 assert.equal(context[buttonAction('rfqReloadPane')](),false);
 assert.deepEqual(events,[['confirm']]);
});

test('宿主不支持隐藏窗格时仍然导航重载，不让恢复入口失效',()=>{
 const {context,events}=load({refuseHide:true});
 assert.equal(context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(events,[['confirm'],['visible',true],['width',381],['width',380],
  ['navigate','http://127.0.0.1:38891/taskpane.html']]);
});

test('无旧侧栏时恢复按钮创建新侧栏，导航失败则提示失败',()=>{
 const missing=load({hasPane:false});
 assert.equal(missing.context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(missing.events,[['create','http://127.0.0.1:38891/taskpane.html'],['store','rfq.taskpane.id',7],
  ['visible',true],['width',380]]);
 const failed=load({failNavigate:true});
 assert.equal(failed.context[buttonAction('rfqReloadPane')](),false);
 assert.equal(failed.events.some(event=>event[0]==='alert'&&/导航失败/.test(event[1])),true);
});

test('旧面板编号失效时恢复按钮仍可新建侧栏',()=>{
 const {context,events}=load({failGet:true});
 assert.equal(context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(events,[['create','http://127.0.0.1:38891/taskpane.html'],['store','rfq.taskpane.id',7],
  ['visible',true],['width',380]]);
});

// R12-K：功能区补齐与获批图一致的阶段快捷入口，同时保留“打开/重建”入口。
test('功能区补齐与获批图一致的七步阶段入口，并保留打开与重建入口',()=>{
 STAGE_BUTTONS.forEach(function(entry){
  const tag=buttonTag(entry[0]);
  assert.match(tag,/onAction="OnGotoStage"/,entry[0]+'必须连接阶段导航回调');
  assert.match(tag,new RegExp('label="'+entry[1]+'"'),entry[0]+'按钮文字应与获批图一致');
  assert.match(tag,new RegExp('tag="'+entry[2]+'"'),entry[0]+'必须带阶段ID，且只使用既有7个ID');
  assert.match(tag,/size="large"/,'阶段入口应为大按钮，与获批图一致');
 });
 const group=ribbon.match(/<group\b[^>]*\bid="rfqStages"[^>]*>[\s\S]*?<\/group>/);
 assert.ok(group,'功能区必须有阶段导航分组');
 assert.equal((group[0].match(/<button\b/g)||[]).length,7,'阶段分组只放7个既有阶段入口');
 assert.equal(buttonAction('rfqOpenPane'),'OnOpenRfqPane','打开侧栏入口保持可用');
 assert.equal(buttonAction('rfqReloadPane'),'OnReloadRfqPane','手动重建入口保持可用');
});

test('阶段入口只写一次{id,stage}导航请求，不重载也不触发业务动作',()=>{
 STAGE_BUTTONS.forEach(function(entry){
  const {context,events}=load();
  assert.equal(context.OnGotoStage({tag:entry[2]}),true,entry[2]+'应导航成功');
  const stores=events.filter(function(event){return event[0]==='store';});
  assert.equal(stores.length,1,'每次点击只允许写一个请求');
  assert.equal(stores[0][1],'rfq.nav.request');
  const request=JSON.parse(stores[0][2]);
  assert.deepEqual(Object.keys(request).sort(),['id','stage'],'请求只允许带id与stage');
  assert.equal(request.stage,entry[2]);
  assert.equal(typeof request.id,'string');
  assert.ok(request.id.length>0);
  assert.equal(events.some(function(event){return event[0]==='navigate';}),false,'快捷导航不得重载侧栏页面');
  assert.equal(events.some(function(event){return event[0]==='create';}),false,'已有侧栏必须复用，不重建');
  assert.equal(events.some(function(event){return event[0]==='confirm';}),false,'快捷导航不得弹确认');
 });
});

test('非法阶段被功能区入口拒绝：不打开侧栏、不写请求',()=>{
 const {context,events}=load();
 assert.equal(context.OnGotoStage({tag:'bogus'}),false);
 assert.equal(context.OnGotoStage({Id:'rfqOpenPane'}),false);
 assert.equal(context.OnGotoStage('nope'),false);
 assert.equal(context.OnGotoStage(null),false);
 assert.deepEqual(events,[],'非法阶段不得产生任何宿主操作');
});

test('侧栏未打开时阶段入口先打开侧栏再写请求',()=>{
 const {context,events}=load({hasPane:false});
 assert.equal(context.OnGotoStage({tag:'matching'}),true);
 assert.deepEqual(events.slice(0,3),[['create','http://127.0.0.1:38891/taskpane.html'],
  ['store','rfq.taskpane.id',7],['visible',true]]);
 const request=events.filter(function(event){return event[0]==='store'&&event[1]==='rfq.nav.request';});
 assert.equal(request.length,1);
 assert.equal(JSON.parse(request[0][2]).stage,'matching');
});

test('侧栏已打开时阶段入口只聚焦写请求，不重载页面',()=>{
 const {context,events}=load();
 assert.equal(context.OnGotoStage({Id:'rfqStageReview'}),true);
 assert.deepEqual(events.filter(function(event){return event[0]==='visible';}),[['visible',true]]);
 assert.equal(events.some(function(event){return event[0]==='navigate';}),false);
});

test('阶段入口写入的请求能被侧栏一次消费并只导航',()=>{
 const {context,store}=load();
 assert.equal(context.OnGotoStage({tag:'split'}),true);
 const calls=[];
 const workflow={goTo:function(stage){calls.push(stage);return true;},current:function(){return 'import';}};
 const result=context.window.RfqRibbonNavigation.consume(store,workflow);
 assert.equal(result.stage,'split');
 assert.deepEqual(calls,['split'],'侧栏只导航一次，不触发业务动作');
 assert.equal(store.getItem('rfq.nav.request'),null,'请求只消费一次');
});

// 旧开发服务可能还没提供新增导航脚本：原有打开/重建入口必须不受影响，阶段入口只静默不导航。
test('未加载导航脚本时打开与重建仍可用，阶段入口静默不产生副作用',()=>{
 const opened=load({skipNav:true});
 assert.equal(opened.context.OnOpenRfqPane(),true,'无导航脚本时打开入口仍必须可用');
 assert.deepEqual(opened.events,[['visible',true],['width',380]]);
 const reloaded=load({skipNav:true});
 assert.equal(reloaded.context.OnReloadRfqPane(),true,'无导航脚本时重建入口仍必须可用');
 assert.deepEqual(reloaded.events,[['confirm'],['visible',false],['visible',true],['width',381],['width',380],
  ['navigate','http://127.0.0.1:38891/taskpane.html']]);
 const staged=load({skipNav:true});
 assert.equal(staged.context.OnGotoStage({tag:'split'}),false,'无导航脚本时阶段入口不得误报成功');
 assert.deepEqual(staged.events,[],'无导航脚本时阶段入口不得产生任何宿主操作');
});

// R12-L补验：七阶段各有可发布的本地图标，getImage只取资源，不执行导航或业务动作。
const STAGE_IMAGES=[
 ['rfqStageImport','assets/import.svg'],
 ['rfqStageMatching','assets/matching.svg'],
 ['rfqStageReview','assets/review.svg'],
 ['rfqStageCategories','assets/categories.svg'],
 ['rfqStageBrands','assets/brands.svg'],
 ['rfqStageInquiry','assets/inquiry.svg'],
 ['rfqStageSplit','assets/split.svg']
];
test('七阶段图标回调返回各自资源，不能再共用同一询价图标',()=>{
 const {context,events}=load({skipNav:true});
 const images=STAGE_IMAGES.map(([id,want])=>{
  const callback=/\bgetImage="([^"]+)"/.exec(buttonTag(id));
  assert.ok(callback,id+'必须有图标回调');
  const image=context[callback[1]]({Id:id});
  assert.equal(image,want,id+'必须显示对应阶段图标');
  assert.equal(context[callback[1]]({id:id}),want,'兼容既有小写控件id');
  return image;
 });
 assert.equal(new Set(images).size,7,'七个阶段必须有七个独立资源');
 assert.deepEqual(events,[],'取图标不能访问宿主、写存储、导航或弹确认');
});
test('七阶段图标资源实际存在且内容互异，无外部资源或脚本依赖',()=>{
 const contents=STAGE_IMAGES.map(([id,asset])=>{
  const filename=path.join(root,asset);
  assert.equal(fs.existsSync(filename),true,id+'的SVG资源必须存在');
  const svg=fs.readFileSync(filename,'utf8');
  assert.match(svg,/<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 32 32"/,'沿用现有32px图标体系');
  assert.doesNotMatch(svg,/<script\b|\bon\w+=|\b(?:href|src)\s*=|<foreignObject\b/i,'图标须是独立静态SVG');
  return svg;
 });
 assert.equal(new Set(contents).size,7,'换资源名不能掩盖图标内容仍相同');
});
test('图标回调保留打开入口及未知控件兜底，取图后七阶段仍只发送导航请求',()=>{
 const {context,events}=load();
 [undefined,null,{Id:'rfqOpenPane'},{Id:'unknown'}].forEach(control=>{
  assert.equal(context.GetRfqImage(control),'assets/inquiry.svg');
 });
 assert.deepEqual(events,[],'打开入口图标和未知控件兜底不得产生宿主动作');
 STAGE_BUTTONS.forEach(([id,,stage])=>{
  context.GetRfqImage({Id:id});
  assert.equal(context[buttonAction(id)]({Id:id}),true);
  assert.equal(JSON.parse(context.window.Application.PluginStorage.getItem('rfq.nav.request')).stage,stage);
 });
 assert.equal(events.filter(event=>event[0]==='store').length,7,'每阶段仍只写一次导航请求');
 assert.equal(events.some(event=>['confirm','navigate','create','alert'].includes(event[0])),false);
});
