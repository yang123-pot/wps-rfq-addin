'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os');
const file=path.resolve(__dirname,'../install/desktop/engine.cjs');
const engine=fs.existsSync(file)?require(file):{};

test('WPS browser/renderer/cloud helpers without windows do not block installation',()=>{
 assert.equal(typeof engine.wpsActivity,'function');
 const activity=engine.wpsActivity([
  {pid:9384,name:'wps.exe',hasWindow:false,command:'wps.exe Run -Entry=EntryPoint addons/kcef/jsapibrowser.dll --server=browser.pipe'},
  {pid:24052,name:'wps.exe',hasWindow:false,command:'wps.exe Run -Entry=CefRenderEntryPoint --type=renderer'},
  {pid:13492,name:'wps.exe',hasWindow:false,command:'wps.exe Run addons/pool/aspcenter.dll --host'}
 ]);
 assert.equal(activity.running,false);assert.equal(activity.backgroundCount,3);
});
test('open or minimized editors and hidden automation remain installation blockers',()=>{
 const cases=[
  {pid:1,name:'et.exe',hasWindow:true,command:'et.exe sheet.xlsx'},
  {pid:2,name:'wps.exe',hasWindow:true,command:'wps.exe Run -Entry=CefRenderEntryPoint --type=renderer'},
  {pid:3,name:'et.exe',hasWindow:false,command:'et.exe -Embedding'},
  {pid:4,name:'wps.exe',hasWindow:false,command:null}
 ];
 for(const p of cases)assert.equal(engine.wpsActivity([p]).running,true,JSON.stringify(p));
});
test('custom installation keeps program/runtimes together while project data stays independent',()=>{
 assert.equal(typeof engine.selectLocation,'function');
 const base={data:'C:\\Users\\example\\AppData\\Local\\WpsRfqAddin',source:'C:\\Temp\\payload\\app',publish:'C:\\Users\\example\\AppData\\Roaming\\wps\\publish.xml'};
 const c=engine.selectLocation(base,'D:\\软件\\材料整理助手');
 assert.equal(c.app,'D:\\软件\\材料整理助手\\app');assert.equal(c.runtimeRoot,'D:\\软件\\材料整理助手\\runtime');
 assert.equal(c.managerRoot,'D:\\软件\\材料整理助手\\managers');assert.equal(c.data,base.data);
 const old={app:'D:\\软件\\材料整理助手\\app',data:base.data};
 assert.equal(engine.selectLocation(base,null,old).installRoot,'D:\\软件\\材料整理助手');
 assert.throws(()=>engine.selectLocation(base,'E:\\其他目录',old),/原安装位置/);
});
test('installation location rejects disk root, project-store overlap and foreign app folders',async t=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'rfq-location-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const base={source:path.join(root,'payload'),data:path.join(root,'data'),publish:path.join(root,'publish.xml')};
 assert.throws(()=>engine.selectLocation(base,path.parse(root).root));
 assert.throws(()=>engine.selectLocation(base,path.join(base.data,'projects','wrong')));
 const c=engine.selectLocation(base,path.join(root,'program'));await fsp.mkdir(c.app,{recursive:true});await fsp.writeFile(path.join(c.app,'package.json'),'{"name":"other-application"}');
 assert.equal(typeof engine.checkLocation,'function');await assert.rejects(engine.checkLocation(c),/其他程序|非本插件/);
});
test('package installation persists the chosen app, runtime and manager location for restart',async t=>{
 assert.equal(typeof engine.installBundle,'function');
 const {root,config,platform}=await fixture(t),bundle=path.join(root,'payload');
 Object.assign(config,engine.selectLocation(config,path.join(root,'用户 选择的程序目录')));
 await fsp.mkdir(path.join(bundle,'runtime','node'),{recursive:true});await fsp.mkdir(path.join(bundle,'runtime','powershell'),{recursive:true});
 await fsp.writeFile(path.join(bundle,'runtime','node','node.exe'),'node');await fsp.writeFile(path.join(bundle,'runtime','powershell','pwsh.exe'),'pwsh');
 await fsp.writeFile(path.join(bundle,'Launcher.exe'),'launcher');await fsp.writeFile(path.join(bundle,'bundle.json'),JSON.stringify({runtimeId:'test-runtime',build:'test-build'}));
 await engine.installBundle(config,bundle,()=>{},()=>platform);
 const saved=JSON.parse(await fsp.readFile(path.join(config.data,'installation.json'),'utf8'));
 assert.equal(saved.app,path.join(root,'用户 选择的程序目录','app'));assert.equal(saved.data,path.join(root,'data'));
 assert.equal(saved.node.startsWith(path.join(root,'用户 选择的程序目录','runtime')+path.sep),true);
 assert.equal(saved.manager.startsWith(path.join(root,'用户 选择的程序目录','managers')+path.sep),true);
 assert.equal(JSON.parse(await fsp.readFile(path.join(saved.manager,'config.json'),'utf8')).app,saved.app);
 await platform.stop();await engine.startService(saved,platform);assert.equal((await platform.health()).appDir,saved.app);
});

test('desktop setup offers bundled runtimes without requiring commands on PATH',()=>{
 assert.equal(typeof engine.assess,'function','缺少桌面安装环境检测');
 const result=engine.assess({windows:true,x64:true,node:'v22.23.3',powershell:'7.6.7',wpsVersion:'12.1.0.29161',wpsPath:'C:\\WPS\\et.exe',running:false});
 assert.equal(result.ready,true);assert.equal(result.requiresConfirmation,false);
});
test('missing WPS blocks installation and exposes official installation action',()=>{
 const result=engine.assess({windows:true,x64:true,node:'22.23.3',powershell:'7.6.7',running:false});
 assert.equal(result.ready,false);assert.equal(result.wpsAction,'https://www.wps.cn/');
});
test('unverified WPS requires explicit confirmation instead of silent compatibility claim',()=>{
 const result=engine.assess({windows:true,x64:true,node:'22.23.3',powershell:'7.6.7',wpsVersion:'12.1.0.99999',wpsPath:'C:\\WPS\\et.exe',running:false});
 assert.equal(result.ready,true);assert.equal(result.requiresConfirmation,true);
});
test('old runtimes, unsupported OS and running WPS block changes',()=>{
 const base={windows:true,x64:true,node:'22.23.3',powershell:'7.6.7',wpsVersion:'12.1.0.29161',wpsPath:'C:\\WPS\\et.exe',running:false};
 for(const change of [{node:'20.19.0'},{node:'invalid'},{powershell:'5.1'},{powershell:'invalid'},{windows:false},{x64:false},{running:true}])assert.equal(engine.assess({...base,...change}).ready,false,JSON.stringify(change));
});
test('native WPS comma-delimited file version is recognized as verified',()=>{
 const e=engine.assess({windows:true,x64:true,node:'22.23.3',powershell:'7.6.7',wpsVersion:'12,1,0,29161',wpsPath:'C:\\WPS\\et.exe',running:false});
 assert.equal(e.requiresConfirmation,false);assert.equal(e.wpsVersion,'12.1.0.29161');
});
test('service identity rejects reused PID, foreign script and changed running code',()=>{
 const root=path.resolve(os.tmpdir(),'rfq-desktop-identity','app'),script=path.join(root,'dev','server.cjs');
 const health={service:'wps-rfq-addin',pid:123,scriptPath:script,appDir:root,startedAt:'2026-10-20T12:00:00.000Z',codeVersion:'a'.repeat(64)};
 const proc={pid:123,scriptPath:script,startedAt:'2026-10-20T12:00:01.000Z'};
 assert.equal(engine.sameService(health,proc,root,'a'.repeat(64)),true);
 for(const p of [{...proc,pid:456},{...proc,scriptPath:path.join(root,'other.cjs')},{...proc,startedAt:'2026-10-20T13:00:00Z'}])assert.equal(engine.sameService(health,p,root,'a'.repeat(64)),false);
 assert.equal(engine.sameService(health,proc,root,'b'.repeat(64)),false);
});
test('unsafe app/data/source overlap is rejected before any write',()=>{
 assert.equal(typeof engine.validatePaths,'function');
 const root=path.resolve(os.tmpdir(),'rfq-desktop-paths');
 assert.throws(()=>engine.validatePaths({source:path.join(root,'source'),app:path.join(root,'data'),data:path.join(root,'data','projects'),publish:path.join(root,'publish.xml')}));
 assert.throws(()=>engine.validatePaths({source:path.join(root,'source'),app:path.join(root,'source','app'),data:path.join(root,'data'),publish:path.join(root,'publish.xml')}));
});
test('concurrent desktop installations cannot switch the same app twice',async t=>{
 const {config,platform}=await fixture(t);let release;const held=new Promise(resolve=>{release=resolve;});
 const realStart=platform.start.bind(platform);platform.start=async()=>{await held;return realStart();};
 const first=engine.install(config,platform);
 for(let i=0;i<100&&!fs.existsSync(path.join(config.data,'setup.lock'));i++)await new Promise(r=>setTimeout(r,5));
 try{await assert.rejects(engine.install(config,platform),/安装.*进行|正在.*安装/);}finally{release();}
 await first;assert.equal(await fsp.readFile(path.join(config.app,'main.js'),'utf8'),'first');
});
async function fixture(t){
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'rfq-desktop-'));
 t.after(()=>fsp.rm(root,{recursive:true,force:true}));
 const config={source:path.join(root,'source'),app:path.join(root,'app'),data:path.join(root,'data'),publish:path.join(root,'publish.xml'),node:process.execPath,powershell:'unused',port:48891};
 await fsp.mkdir(path.join(config.source,'dev'),{recursive:true});
 await fsp.writeFile(path.join(config.source,'main.js'),'first');
 await fsp.writeFile(path.join(config.source,'package.json'),'{"name":"wps-rfq-addin"}');
 await fsp.writeFile(path.join(config.source,'dev','server.cjs'),'first');
 await fsp.writeFile(config.publish,'<jsplugins><jsplugin name="Other"/></jsplugins>');
 await fsp.mkdir(path.join(config.data,'projects'),{recursive:true});
 await fsp.writeFile(path.join(config.data,'projects','keep.json'),'keep');
 // Only the Windows process/XML boundary is substituted; actual staging,
 // rollback, immutable data protection and file contents remain real.
 let alive=null,number=100;
 const platform={
  async health(){return alive;},async occupied(){return false;},
  async query(pid){return alive&&{pid,scriptPath:alive.scriptPath,startedAt:alive.startedAt};},
  async codeVersion(dir){return require('node:crypto').createHash('sha256').update(await fsp.readFile(path.join(dir,'main.js'))).digest('hex');},
  async start(){alive={service:'wps-rfq-addin',pid:++number,scriptPath:path.join(config.app,'dev','server.cjs'),appDir:config.app,startedAt:new Date().toISOString(),codeVersion:await this.codeVersion(config.app)};return alive.pid;},
  async stop(){alive=null;},
  async registration(){await fsp.writeFile(config.publish,'<jsplugins><jsplugin name="Other"/><jspluginonline name="WpsRfqAddin"/></jsplugins>');}
 };
 return {root,config,platform};
}
test('desktop install and upgrade preserve five data folders and other registration',async t=>{
 const {config,platform}=await fixture(t);
 await engine.install(config,platform);
 for(const folder of ['imports','library','projects','headers','splits'])assert.equal(fs.statSync(path.join(config.data,folder)).isDirectory(),true);
 assert.equal(await fsp.readFile(path.join(config.app,'main.js'),'utf8'),'first');
 await fsp.writeFile(path.join(config.source,'main.js'),'second');
 await engine.install(config,platform);
 assert.equal(await fsp.readFile(path.join(config.app,'main.js'),'utf8'),'second');
 assert.match(await fsp.readFile(config.publish,'utf8'),/name="Other"/);
 assert.equal(await fsp.readFile(path.join(config.data,'projects','keep.json'),'utf8'),'keep');
});
test('failed new service restores old code, exact registration and old service',async t=>{
 const {config,platform}=await fixture(t);await engine.install(config,platform);
 const before=await fsp.readFile(config.publish);const realStart=platform.start.bind(platform);let attempt=0;
 platform.start=async()=>{if(++attempt===1)throw Error('启动失败');return realStart();};
 await fsp.writeFile(path.join(config.source,'main.js'),'broken-upgrade');
 await assert.rejects(engine.install(config,platform),/启动失败/);
 assert.equal(await fsp.readFile(path.join(config.app,'main.js'),'utf8'),'first');
 assert.deepEqual(await fsp.readFile(config.publish),before);
 assert.equal((await platform.health()).codeVersion,await platform.codeVersion(config.app));
 assert.equal(await fsp.readFile(path.join(config.data,'projects','keep.json'),'utf8'),'keep');
});
test('active installation metadata is committed with service and rolled back on write failure',async t=>{
 const {config,platform}=await fixture(t);config.manager=path.join(config.data,'managers','v1');
 await engine.install(config,platform);
 const first=JSON.parse(await fsp.readFile(path.join(config.data,'installation.json'),'utf8'));assert.equal(first.manager,config.manager);
 const before=await fsp.readFile(config.publish);
 await fsp.chmod(path.join(config.data,'installation.json'),0o444);
 t.after(()=>fsp.chmod(path.join(config.data,'installation.json'),0o666).catch(()=>{}));
 await fsp.writeFile(path.join(config.source,'main.js'),'next');
 await assert.rejects(engine.install(config,platform));
 assert.equal(await fsp.readFile(path.join(config.app,'main.js'),'utf8'),'first');assert.deepEqual(await fsp.readFile(config.publish),before);
 assert.equal((await platform.health()).codeVersion,await platform.codeVersion(config.app));
});
test('partial runtime copy never leaves a reusable final runtime directory',async t=>{
 assert.equal(typeof engine.prepareRuntime,'function');
 const {root,config}=await fixture(t),source=path.join(root,'runtime-source'),dest=path.join(config.data,'runtime');
 await fsp.mkdir(source);await fsp.writeFile(path.join(source,'node.exe'),'payload');
 const result=await engine.prepareRuntime(source,dest,'version');
 assert.equal(await fsp.readFile(path.join(result,'node.exe'),'utf8'),'payload');
 await assert.rejects(engine.prepareRuntime(path.join(root,'missing'),dest,'version'));
 assert.deepEqual(await fsp.readdir(dest),[path.basename(result)]);
});
test('shortcut failure restores earlier shortcuts and old application',async t=>{
 const {root,config,platform}=await fixture(t);await engine.install(config,platform);
 const oldLink=path.join(root,'old.lnk'),newLink=path.join(root,'new.lnk');await fsp.writeFile(oldLink,'old-target');
 config.manager=path.join(config.data,'managers','v2');
 platform.linkPaths=async()=>[oldLink,newLink];platform.shortcuts=async()=>{await fsp.writeFile(oldLink,'new-target');await fsp.writeFile(newLink,'new-target');throw Error('快捷方式写入失败');};
 await fsp.writeFile(path.join(config.source,'main.js'),'next');
 await assert.rejects(engine.install(config,platform),/快捷方式写入失败/);
 assert.equal(await fsp.readFile(oldLink,'utf8'),'old-target');assert.equal(fs.existsSync(newLink),false);
 assert.equal(await fsp.readFile(path.join(config.app,'main.js'),'utf8'),'first');
});
test('rollback will not stop a new process that reused the startup PID',async t=>{
 const {config,platform}=await fixture(t);config.manager=path.join(config.data,'managers','v1');
 await fsp.writeFile(path.join(config.data,'installation.json'),'old');await fsp.chmod(path.join(config.data,'installation.json'),0o444);
 t.after(()=>fsp.chmod(path.join(config.data,'installation.json'),0o666).catch(()=>{}));
 let calls=0,stopped=0;const query=platform.query.bind(platform);
 platform.query=async pid=>{const p=await query(pid);return ++calls>=3?{...p,startedAt:'2026-01-01T00:00:00Z'}:p;};
 platform.stop=async()=>{stopped++;};
 await assert.rejects(engine.install(config,platform),/创建身份已变化/);
 assert.equal(stopped,0);assert.equal(fs.existsSync(config.app),true,'身份不明时保留程序供人工处理');
});
test('simultaneous desktop and login launches share one healthy service',async t=>{
 assert.equal(typeof engine.startService,'function');
 const {config,platform}=await fixture(t);await engine.install(config,platform);await platform.stop();
 let launched=0;const start=platform.start.bind(platform);platform.start=async()=>{launched++;await new Promise(r=>setTimeout(r,60));return start();};
 const results=await Promise.all([engine.startService(config,platform),engine.startService(config,platform)]);
 assert.equal(results[0].pid,results[1].pid);assert.equal(launched,1);
});
test('unknown service prevents registration and code changes',async t=>{
 const {config,platform}=await fixture(t);const before=await fsp.readFile(config.publish);
 platform.health=async()=>({service:'wps-rfq-addin',pid:555,scriptPath:'C:\\other\\server.cjs'});
 await assert.rejects(engine.install(config,platform),/身份/);
 assert.equal(fs.existsSync(config.app),false);assert.deepEqual(await fsp.readFile(config.publish),before);
});
test('real Windows desktop transaction: install, upgrade, failed startup rollback and restart', {skip:process.platform!=='win32'},async t=>{
 const {spawnSync}=require('node:child_process');
 const found=spawnSync('pwsh',['-NoProfile','-Command','(Get-Process -Id $PID).Path'],{encoding:'utf8'});
 assert.equal(found.status,0,'开发测试需要 PowerShell；用户安装使用包内运行环境');
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'rfq-desktop-real-'));
 const server=require('node:net').createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const config={source:path.join(root,'source'),app:path.join(root,'app'),data:path.join(root,'data'),publish:path.join(root,'publish.xml'),node:process.execPath,powershell:found.stdout.trim(),port};
 const platform=engine.windowsPlatform(config);
 t.after(async()=>{
  const h=await platform.health();if(h&&h.appDir===config.app&&engine.sameService(h,await platform.query(h.pid),config.app,await platform.codeVersion(config.app)))await platform.stop(h.pid);
  await fsp.rm(root,{recursive:true,force:true});
 });
 const addin=path.resolve(__dirname,'..');await fsp.mkdir(config.source);
 for(const item of ['main.js','ribbon.xml','taskpane.html','styles.css','library.html','library.css','package.json','rules','src','dev','assets'])await fsp.cp(path.join(addin,item),path.join(config.source,item),{recursive:true});
 await fsp.writeFile(config.publish,'<jsplugins><jsplugin name="Other" url="http://127.0.0.1:38891/"/></jsplugins>');
 const first=await engine.install(config,platform);
 assert.equal((await platform.health()).pid,first.pid);
 await fsp.writeFile(path.join(config.data,'projects','keep.json'),'keep');
 await fsp.appendFile(path.join(config.source,'main.js'),'\n/* desktop upgrade */\n');
 const second=await engine.install(config,platform);
 assert.notEqual(second.codeVersion,first.codeVersion);assert.notEqual(second.pid,first.pid);
 const registration=await fsp.readFile(config.publish),code=await fsp.readFile(path.join(config.app,'main.js'));
 const sourceServer=path.join(config.source,'dev','server.cjs'),content=await fsp.readFile(sourceServer,'utf8');
 await fsp.writeFile(sourceServer,'if(!process.argv.includes("--code-version"))process.exit(1);\n'+content);
 await assert.rejects(engine.install(config,platform),/健康检查/);
 assert.deepEqual(await fsp.readFile(config.publish),registration);assert.deepEqual(await fsp.readFile(path.join(config.app,'main.js')),code);
 const recovered=await platform.health();assert.equal(recovered.codeVersion,second.codeVersion);
 await platform.stop(recovered.pid);const newPid=await platform.start();
 for(let i=0;i<100&&!await platform.health();i++)await new Promise(r=>setTimeout(r,100));
 assert.equal((await platform.health()).pid,newPid);
 assert.equal(await fsp.readFile(path.join(config.data,'projects','keep.json'),'utf8'),'keep');
 const xml=await fsp.readFile(config.publish,'utf8');assert.match(xml,/name="Other"/);assert.equal((xml.match(/name="WpsRfqAddin"/g)||[]).length,1);
});
