const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('learning library owns a separate nonmodal dialog and reopening never touches project dialog',()=>{
 const window={location:{href:'http://127.0.0.1:38891/index.html'}},context=vm.createContext({window,Number,Error});
 vm.runInContext(fs.readFileSync(require.resolve('../src/library-window-host.js'),'utf8'),context);
 const storage=new Map([['rfq.webdialog.id',1]]),dialogs=new Map([[1,{ID:1,Visible:true}]]);let created=0;
 const app={PluginStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},GetWebDialog:id=>dialogs.get(id),CreateWebDialog(url,title,w,h,modal){assert.match(url,/library.html$/);assert.equal(modal,false);created++;const d={ID:created+1,Visible:false,Delete(){dialogs.delete(this.ID);}};dialogs.set(d.ID,d);return d;}};
 assert.equal(window.RfqLibraryWindow.open(app).ID,2);assert.equal(window.RfqLibraryWindow.open(app).ID,2);assert.equal(created,1);
 dialogs.get(2).Delete();assert.equal(window.RfqLibraryWindow.open(app).ID,3);assert.equal(storage.get('rfq.webdialog.id'),1);assert.equal(dialogs.get(1).Visible,true);
});
