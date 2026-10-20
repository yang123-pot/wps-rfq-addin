const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function picker(){const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/path-picker.js'),'utf8'),context);return context.window.RfqPathPicker;}
test('原生目录选择保留Application接收者，使用FileDialog(4)并回传单一目录',()=>{
 const dialog={Title:'',InitialFileName:'',Show(){return -1;},SelectedItems:{Item(i){assert.equal(i,1);return 'C:\\询价输出';}}};
 const app={FileDialog(type){assert.equal(this,app);assert.equal(type,4);return dialog;}};
 const result=picker().selectFolder(app,'C:\\旧目录','选择拆分输出文件夹');
 assert.equal(result.supported,true);assert.equal(result.path,'C:\\询价输出');assert.equal(dialog.Title,'选择拆分输出文件夹');assert.equal(dialog.InitialFileName,'C:\\旧目录');
});
test('WPS可调用SelectedItems集合也可返回文件夹',()=>{
 const dialog={Show(){return -1;},SelectedItems(i){assert.equal(this,dialog);assert.equal(i,1);return 'D:\\输出';}};
 const result=picker().selectFolder({FileDialog(){return dialog;}});
 assert.equal(result.supported,true);assert.equal(result.path,'D:\\输出');
});
test('原生目录取消不读取SelectedItems，也不改用其他对话框',()=>{
 let shown=0;const app={FileDialog(){return {Show(){shown++;return 0;},get SelectedItems(){throw Error('取消不应读取');}};},GetFolder(){throw Error('取消不应再次弹窗');}};
 const result=picker().selectFolder(app);assert.equal(result.supported,true);assert.equal(result.path,null);assert.equal(shown,1);
});
test('原生目录确认但缺少有效返回路径必须区分于取消',()=>{
 const result=picker().selectFolder({FileDialog(){return {Show(){return -1;},SelectedItems:{Item(){return '';}}};}});
 assert.equal(result.supported,true);assert.match(result.error,/未返回.*目录/);
});
test('原生目录能力缺失或调用失败保留原因供第7步报错',()=>{
 assert.equal(picker().selectFolder({}).supported,false);
 const result=picker().selectFolder({FileDialog(){throw Error('native unavailable');}});
 assert.equal(result.supported,false);assert.match(result.error,/native unavailable/);
});
