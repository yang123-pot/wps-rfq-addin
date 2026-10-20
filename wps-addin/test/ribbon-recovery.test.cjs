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
// 简版：功能区只保留三个大入口，内部仍映射到既有七阶段。
const STAGE_BUTTONS=[
 ['rfqStepImport','选择清单','import'],
 ['rfqStepBrands','填写品牌','brands'],
 ['rfqStepInquiry','生成文件','inquiry'],
 ['rfqOpenProject','打开项目','project'],
 ['rfqHelp','帮助','help']
];
function load(options={}){
 const events=[];let paneVisible=true,exists=options.hasPane!==false;
 const pane={ID:7,
  get Visible(){return paneVisible;},
  set Visible(value){if(options.refuseShow)throw Error('宿主拒绝显示');paneVisible=value;events.push(['visible',value]);},
  Delete(){events.push(['delete']);if(options.failDelete)throw Error('销毁失败');exists=false;}};
 const values=new Map();
 if(exists)values.set('rfq.webdialog.id','7');
 const store={getItem(key){return values.has(key)?values.get(key):null;},
  setItem(key,value){values.set(key,String(value));events.push(['store',key,value]);},
  removeItem(key){values.delete(key);events.push(['remove',key]);}};
 const application={PluginStorage:store,GetWebDialog(){if(options.failGet)throw Error('窗口查询失败');return exists?pane:null;},
  CreateWebDialog(url,title,width,height,modal){events.push(['create',url,modal]);exists=true;return pane;}};
 const context={document:{write(){}},window:{Application:application,location:{href:'http://127.0.0.1:38891/main.js'}},
  confirm(){events.push(['confirm']);return options.confirm!==false;},alert(message){events.push(['alert',message]);}};
 if(!options.skipNav)vm.runInNewContext(navCode,context,{filename:'ribbon-navigation.js'});
 vm.runInNewContext(code,context,{filename:'main.js'});
 return {context,events,pane,store};
}

test('普通打开复用现有窗口且不重载页面内存',()=>{
 const {context,events}=load();
 assert.equal(context[buttonAction('rfqOpenPane')](),true);
 assert.equal(events.some(event=>event[0]==='navigate'),false);
});

test('恢复按钮由用户确认后销毁并重建自有窗口',()=>{
 const {context,events}=load();
 assert.equal(context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(events,[['confirm'],['delete'],['remove','rfq.webdialog.id'],
  ['create','http://127.0.0.1:38891/taskpane.html',false],['store','rfq.webdialog.id',7],['visible',true]]);
});

test('取消恢复保留当前窗口且不销毁',()=>{
 const {context,events}=load({confirm:false});
 assert.equal(context[buttonAction('rfqReloadPane')](),false);
 assert.deepEqual(events,[['confirm']]);
});

test('宿主拒绝显示时打开入口报告失败',()=>{
 const {context,events}=load({refuseShow:true});
 assert.equal(context[buttonAction('rfqOpenPane')](),false);
 assert.equal(events.some(event=>event[0]==='alert'&&/宿主拒绝显示/.test(event[1])),true);
});

test('无旧窗口时恢复按钮创建新窗口，销毁失败则提示失败',()=>{
 const missing=load({hasPane:false});
 assert.equal(missing.context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(missing.events,[['create','http://127.0.0.1:38891/taskpane.html',false],['store','rfq.webdialog.id',7],
  ['visible',true]]);
 const failed=load({failDelete:true});
 assert.equal(failed.context[buttonAction('rfqReloadPane')](),false);
 assert.equal(failed.events.some(event=>event[0]==='alert'&&/销毁失败/.test(event[1])),true);
});

test('窗口查询异常时明确失败，不能将未知状态当作关闭',()=>{
 const {context,events}=load({failGet:true});
 assert.equal(context[buttonAction('rfqReloadPane')](),false);
 assert.equal(events.some(event=>event[0]==='create'),false);
 assert.equal(events.some(event=>event[0]==='alert'&&/窗口查询失败/.test(event[1])),true);
});

// R12-K：功能区补齐与获批图一致的阶段快捷入口，同时保留“打开/重建”入口。
test('功能区提供五个新版入口，并保留打开与重建入口',()=>{
 STAGE_BUTTONS.forEach(function(entry){
  const tag=buttonTag(entry[0]);
  assert.match(tag,/onAction="OnGotoStage"/,entry[0]+'必须连接阶段导航回调');
  assert.match(tag,new RegExp('label="'+entry[1]+'"'),entry[0]+'按钮文字应与获批图一致');
  assert.match(tag,new RegExp('tag="'+entry[2]+'"'),entry[0]+'必须带阶段ID，且只使用既有阶段ID');
  assert.match(tag,/size="large"/,'阶段入口应为大按钮，与获批图一致');
 });
 const group=ribbon.match(/<group\b[^>]*\bid="rfqStages"[^>]*>[\s\S]*?<\/group>/);
 assert.ok(group,'功能区必须有三步入口分组');
 assert.equal((group[0].match(/<button\b/g)||[]).length,5,'新版分组只放五个大入口');
 assert.equal(buttonAction('rfqOpenPane'),'OnOpenRfqPane','打开侧栏入口保持可用');
 assert.equal(buttonAction('rfqReloadPane'),'OnReloadRfqPane','手动重建入口保持可用');
});

test('阶段入口只写一次{id,stage}导航请求，不重载也不触发业务动作',()=>{
 STAGE_BUTTONS.forEach(function(entry){
  const {context,events}=load();
  assert.equal(context.OnGotoStage({tag:entry[2]}),true,entry[2]+'应导航成功');
  const stores=events.filter(function(event){return event[0]==='store';});
  assert.equal(stores.length,1,'每次点击只允许写一个请求');
  assert.equal(stores[0][1],'rfq.window.nav.request');
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
 assert.deepEqual(events.slice(0,3),[['create','http://127.0.0.1:38891/taskpane.html',false],
  ['store','rfq.webdialog.id',7],['visible',true]]);
 const request=events.filter(function(event){return event[0]==='store'&&event[1]==='rfq.window.nav.request';});
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
 assert.equal(store.getItem('rfq.window.nav.request'),null,'请求只消费一次');
});

// 旧开发服务可能还没提供新增导航脚本：原有打开/重建入口必须不受影响，阶段入口只静默不导航。
test('未加载窗口管理脚本时打开与重建明确失败，阶段入口不产生副作用',()=>{
 const opened=load({skipNav:true});
 assert.equal(opened.context.OnOpenRfqPane(),false);
 assert.equal(opened.events.length,1);
 assert.equal(opened.events[0][0],'alert');
 const reloaded=load({skipNav:true});
 assert.equal(reloaded.context.OnReloadRfqPane(),false);
 assert.equal(reloaded.events.length,1);
 assert.equal(reloaded.events[0][0],'alert');
 const staged=load({skipNav:true});
 assert.equal(staged.context.OnGotoStage({tag:'split'}),false,'无导航脚本时阶段入口不得误报成功');
 assert.deepEqual(staged.events,[],'无导航脚本时阶段入口不得产生任何宿主操作');
});

// 简版三步各有可发布的本地图标，getImage只取资源，不执行导航或业务动作。
const STAGE_IMAGES=[
 ['rfqStepImport','assets/import.svg'],
 ['rfqStepBrands','assets/brands.svg'],
 ['rfqStepInquiry','assets/inquiry.svg']
];
test('三步图标回调返回各自资源，不能再共用同一询价图标',()=>{
 const {context,events}=load({skipNav:true});
 const images=STAGE_IMAGES.map(([id,want])=>{
  const callback=/\bgetImage="([^"]+)"/.exec(buttonTag(id));
  assert.ok(callback,id+'必须有图标回调');
  const image=context[callback[1]]({Id:id});
  assert.equal(image,want,id+'必须显示对应阶段图标');
  assert.equal(context[callback[1]]({id:id}),want,'兼容既有小写控件id');
  return image;
 });
 assert.equal(new Set(images).size,3,'三个入口必须有三个独立资源');
 assert.deepEqual(events,[],'取图标不能访问宿主、写存储、导航或弹确认');
});
test('三步图标资源实际存在且内容互异，无外部资源或脚本依赖',()=>{
 const contents=STAGE_IMAGES.map(([id,asset])=>{
  const filename=path.join(root,asset);
  assert.equal(fs.existsSync(filename),true,id+'的SVG资源必须存在');
  const svg=fs.readFileSync(filename,'utf8');
  assert.match(svg,/<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 32 32"/,'沿用现有32px图标体系');
  assert.doesNotMatch(svg,/<script\b|\bon\w+=|\b(?:href|src)\s*=|<foreignObject\b/i,'图标须是独立静态SVG');
  return svg;
 });
 assert.equal(new Set(contents).size,3,'换资源名不能掩盖图标内容仍相同');
});
test('图标回调保留打开入口及未知控件兜底，取图后三步仍只发送导航请求',()=>{
 const {context,events}=load();
 [undefined,null,{Id:'rfqOpenPane'},{Id:'unknown'}].forEach(control=>{
  assert.equal(context.GetRfqImage(control),'assets/inquiry.svg');
 });
 assert.deepEqual(events,[],'打开入口图标和未知控件兜底不得产生宿主动作');
 STAGE_BUTTONS.forEach(([id,,stage])=>{
  context.GetRfqImage({Id:id});
  assert.equal(context[buttonAction(id)]({Id:id}),true);
  assert.equal(JSON.parse(context.window.Application.PluginStorage.getItem('rfq.window.nav.request')).stage,stage);
 });
 assert.equal(events.filter(event=>event[0]==='store').length,STAGE_BUTTONS.length,'每个入口仍只写一次导航请求');
 assert.equal(events.some(event=>['confirm','navigate','create','alert'].includes(event[0])),false);
});
