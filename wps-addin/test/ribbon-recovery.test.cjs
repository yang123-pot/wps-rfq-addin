const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'main.js'),'utf8');
const ribbon=fs.readFileSync(path.join(root,'ribbon.xml'),'utf8');
function buttonAction(id){
 const tag=ribbon.match(new RegExp('<button\\b[^>]*\\bid="'+id+'"[^>]*>'));
 assert.ok(tag,'功能区必须有 '+id+' 按钮');
 const action=tag[0].match(/\bonAction="([^"]+)"/);
 assert.ok(action,'按钮必须连接回调');
 return action[1];
}
function load(options={}){
 const events=[],pane={ID:7,Visible:true,Width:380,Navigate(url){events.push(['navigate',url]);if(options.failNavigate)throw Error('导航失败');}};
 const store={getItem(){return options.hasPane===false?null:7;},setItem(key,value){events.push(['store',key,value]);}};
 const application={PluginStorage:store,GetTaskPane(){if(options.failGet)throw Error('旧面板不存在');return options.hasPane===false?null:pane;},
  CreateTaskPane(url){events.push(['create',url]);return pane;}};
 const context={document:{write(){}},window:{Application:application,location:{href:'http://127.0.0.1:38891/main.js'}},
  confirm(){events.push(['confirm']);return options.confirm!==false;},alert(message){events.push(['alert',message]);}};
 vm.runInNewContext(code,context,{filename:'main.js'});
 return {context,events,pane};
}

test('普通打开复用现有侧栏且不重载页面内存',()=>{
 const {context,events}=load();
 assert.equal(context[buttonAction('rfqOpenPane')](),true);
 assert.equal(events.some(event=>event[0]==='navigate'),false);
});

test('恢复按钮由用户确认后重载现有 WPS 侧栏',()=>{
 const {context,events}=load();
 assert.equal(context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(events,[['confirm'],['navigate','http://127.0.0.1:38891/taskpane.html']]);
});

test('取消恢复保留当前侧栏且不调用 Navigate',()=>{
 const {context,events}=load({confirm:false});
 assert.equal(context[buttonAction('rfqReloadPane')](),false);
 assert.deepEqual(events,[['confirm']]);
});

test('无旧侧栏时恢复按钮创建新侧栏，导航失败则提示失败',()=>{
 const missing=load({hasPane:false});
 assert.equal(missing.context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(missing.events,[['create','http://127.0.0.1:38891/taskpane.html'],['store','rfq.taskpane.id',7]]);
 const failed=load({failNavigate:true});
 assert.equal(failed.context[buttonAction('rfqReloadPane')](),false);
 assert.equal(failed.events.some(event=>event[0]==='alert'&&/导航失败/.test(event[1])),true);
});

test('旧面板编号失效时恢复按钮仍可新建侧栏',()=>{
 const {context,events}=load({failGet:true});
 assert.equal(context[buttonAction('rfqReloadPane')](),true);
 assert.deepEqual(events,[['create','http://127.0.0.1:38891/taskpane.html'],['store','rfq.taskpane.id',7]]);
});
