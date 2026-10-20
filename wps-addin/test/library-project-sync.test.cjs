const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('explicit merge sync applies only to the named unconfirmed project and rechecks identity after fetching',async()=>{
 let listener,confirmed=true,current='project-a',fetches=0,applied=0,resolveFetch;
 const storage=new Map([['rfq.library.apply.request',JSON.stringify({projectId:'project-a',revision:2})]]),message={textContent:''};
 const context={window:{__RFQ_IMPORT__:{token:'t'},addEventListener(name,fn){listener=fn;}},document:{getElementById(){return message;}},fetch:async()=>{fetches++;if(resolveFetch)await new Promise(r=>{resolveFetch=r;});return {ok:true,json:async()=>({revision:2,library:{},memory:{}})};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/library-ui.js'),'utf8'),context);
 context.window.RfqLibraryUI.create({application:{PluginStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)}},getProjectId:()=>current,isConfirmed:()=>confirmed,onChange(){applied++;}});
 await listener();assert.equal(fetches,0);assert.equal(applied,0);assert.match(message.textContent,/已经确认/);
 confirmed=false;storage.set('rfq.library.apply.request',JSON.stringify({projectId:'project-a',revision:2}));await listener();assert.equal(fetches,1);assert.equal(applied,1);
 storage.set('rfq.library.apply.request',JSON.stringify({projectId:'project-a',revision:2}));resolveFetch=true;const pending=listener();await new Promise(r=>setImmediate(r));current='project-b';resolveFetch();await pending;assert.equal(applied,1,'switching project during read cannot change the new project');
});
