const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn,spawnSync}=require('node:child_process');
const addin=path.resolve(__dirname,'..');
function shell(){
 for(const candidate of ['pwsh','powershell']){
  const found=spawnSync(candidate,['-NoProfile','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8'});
  if(!found.error&&found.status===0)return found.stdout.trim()&&found.status===0?candidate:candidate;
 }
 return null;
}
const shellPath=shell();
function run(script,args){
 const result=spawnSync(shellPath,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(addin,'install',script)].concat(args),
  {encoding:'utf8'});
 assert.equal(result.status,0,script+' 运行失败：'+result.stderr+result.stdout);
 return (result.stdout||'')+(result.stderr||'');
}
function runRaw(script,args){
 return spawnSync(shellPath,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(addin,'install',script)].concat(args),
  {encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
}
function outputOf(result){return (result.stdout||'')+(result.stderr||'');}
function freePort(){
 return new Promise((resolve,reject)=>{
  const server=net.createServer();
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   const port=server.address().port;
   server.close(()=>resolve(port));
  });
 });
}
async function getHealth(port){
 try{
  const response=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(2000)});
  if(!response.ok)return null;
  return await response.json();
 }catch(_){return null;}
}
async function waitHealth(port,timeout=10000){
 const until=Date.now()+timeout;
 while(Date.now()<until){
  const health=await getHealth(port);
  if(health)return health;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 return null;
}
function processExists(pid){
 try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}
}
async function waitGone(pid,timeout=10000){
 const until=Date.now()+timeout;
 while(Date.now()<until){if(!processExists(pid))return true;await new Promise(resolve=>setTimeout(resolve,100));}
 return !processExists(pid);
}
async function stageSource(root,marker){
 const dir=path.join(root,'source-'+marker);
 await fs.mkdir(dir,{recursive:true});
 for(const item of ['main.js','ribbon.xml','taskpane.html','styles.css','package.json','rules','src','dev','assets']){
  await fs.cp(path.join(addin,item),path.join(dir,item),{recursive:true});
 }
 await fs.appendFile(path.join(dir,'main.js'),'\n/* '+marker+' */\n','utf8');
 return dir;
}
async function writeDataSentinels(dataRoot){
 const sentinels={};
 for(const name of ['imports','library','projects','headers','splits']){
  const file=path.join(dataRoot,name,'keep-'+name+'.txt');
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,name,'utf8');
  sentinels[name]=file;
 }
 return sentinels;
}
async function assertDataSentinels(sentinels){
 for(const [name,file] of Object.entries(sentinels)){
  assert.equal(await fs.readFile(file,'utf8'),name,'升级/卸载/重装不得删除 '+name+' 数据');
 }
}
function sampleProject(){
 const collection=require('../src/collection.js'),project=require('../src/project.js');
 const values=[['工程名称：F7测试','','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],['000123','水管','DN50','m','0.1']];
 const input={metadata:{originalPath:'C:\\samples\\a.xlsx',originalName:'a.xlsx',copyPath:'C:\\copies\\a.xlsx',fingerprint:'b'.repeat(64)},
  snapshot:{name:'a.xlsx',path:'C:\\samples\\a.xlsx',fingerprint:'b'.repeat(64),
   sheets:[{name:'给排水',startRow:1,startColumn:1,rowCount:3,columnCount:5,values}]}};
 return project.create(collection.add(collection.create(),[input]),false);
}
async function api(port,route,payload){
 const origin='http://127.0.0.1:'+port;
 const html=await (await fetch(origin+'/taskpane.html')).text();
 const match=html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/);
 assert.ok(match,'taskpane必须注入本机会话令牌');
 const token=JSON.parse(match[1]).token;
 const response=await fetch(origin+'/api/project/'+route,{method:'POST',
  headers:{'content-type':'application/json','x-rfq-import-token':token},body:JSON.stringify(payload)});
 return {status:response.status,body:await response.json()};
}
async function saveProject(port){
 const project=sampleProject();
 const saved=await api(port,'save',{project,expectedRevision:0});
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(saved.body.revision,1);
 return {project,projectId:project.projectId,path:saved.body.path};
}
async function loadProject(port,projectId){
 const loaded=await api(port,'load',{projectId});
 assert.equal(loaded.status,200,JSON.stringify(loaded.body));
 assert.ok(loaded.body.project,'重启/升级/重装后项目必须还能打开');
 return loaded.body.project;
}
function holdExclusive(file,readyFile){
 const quote=value=>String(value).replace(/'/g,"''");
 const script='$f=[System.IO.File]::Open(\''+quote(file)+'\',\'Open\',\'ReadWrite\',\'None\'); '+
  'Set-Content -LiteralPath \''+quote(readyFile)+'\' -Value locked; Start-Sleep -Seconds 60; $f.Dispose()';
 return spawn(shellPath,['-NoProfile','-Command',script],{stdio:'ignore'});
}
async function waitForFile(file,timeout=10000){
 const until=Date.now()+timeout;
 while(Date.now()<until){
  try{await fs.access(file);return true;}catch(_){}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 return false;
}
function killTestService(root){
 const dataRoot=path.join(root,'data'),pidFile=path.join(dataRoot,'server.pid');
 const script='$pidFile=\''+String(pidFile).replace(/'/g,"''")+'\'; '+
  'if(Test-Path -LiteralPath $pidFile){$value=(Get-Content -LiteralPath $pidFile -Raw).Trim(); if($value -match \'^\\d+$\'){'+
  '$p=Get-CimInstance Win32_Process -Filter "ProcessId=$value" -ErrorAction SilentlyContinue; '+
  'if($p -and $p.CommandLine -and $p.CommandLine -match \'rfq-install-\' -and $p.CommandLine -match \'server\\.cjs\'){'+
  'Stop-Process -Id ([int]$value) -Force -ErrorAction SilentlyContinue}}}';
 spawnSync(shellPath,['-NoProfile','-Command',script],{encoding:'utf8'});
}
const otherPlugin='<jsplugin name="OtherPlugin" guid="OtherPlugin" url="http://127.0.0.1:41111/" type="et" enable="true"/>';
const samePortPlugin='<jsplugin name="OtherSamePort" guid="OtherSamePort" url="http://127.0.0.1:38891/" type="et" enable="true"/>';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-install-'));
 t.after(async()=>{killTestService(root);await fs.rm(root,{recursive:true,force:true});});
 const publish=path.join(root,'publish.xml');
 await fs.writeFile(publish,'<?xml version="1.0" encoding="UTF-8"?><jsplugins>'+otherPlugin+samePortPlugin+'</jsplugins>','utf8');
 return {root,publish,appDir:path.join(root,'app'),dataRoot:path.join(root,'data')};
}
test('install only adds this plugin and never touches other plugin nodes',async t=>{
 assert.equal(shellPath!==null,true,'需要PowerShell执行安装脚本');
 const {root,publish,appDir,dataRoot}=await fixture(t);
 const output=run('install.ps1',['-SourceDir',addin,'-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-SkipService']);
 assert.match(output,/已写入本插件节点/);
 const xml=await fs.readFile(publish,'utf8');
 assert.match(xml,/WpsRfqAddin/);
 assert.equal((xml.match(/OtherPlugin/g)||[]).length,2,'其他插件节点必须原样保留（name与guid各一次）');
 assert.equal((xml.match(/OtherSamePort/g)||[]).length,2,'同端口但不同身份的插件也必须保留');
 // XmlDocument.Save会规范化格式，这里逐个核对其他插件节点的属性没有被改写。
 ['name="OtherPlugin"','guid="OtherPlugin"','url="http://127.0.0.1:41111/"','type="et"','enable="true"']
  .forEach(attribute=>assert.equal(xml.includes(attribute),true,'其他插件属性必须保留：'+attribute));
 const backups=(await fs.readdir(root)).filter(name=>name.startsWith('publish.xml.bak-'));
 assert.equal(backups.length,1,'安装前必须备份publish.xml');
 assert.equal(await fs.readFile(path.join(root,backups[0]),'utf8'),
  '<?xml version="1.0" encoding="UTF-8"?><jsplugins>'+otherPlugin+samePortPlugin+'</jsplugins>','备份必须与原文件一致');
 assert.equal(await fs.readFile(path.join(appDir,'main.js'),'utf8'),await fs.readFile(path.join(addin,'main.js'),'utf8'));
 for(const asset of ['import','matching','review','categories','brands','inquiry','split']){
  const relative=path.join('assets',asset+'.svg');
  assert.equal(require('node:fs').existsSync(path.join(appDir,relative)),true,asset+'功能区图标必须随发布包复制');
  assert.equal(await fs.readFile(path.join(appDir,relative),'utf8'),await fs.readFile(path.join(addin,relative),'utf8'));
 }
 const files=(await fs.readdir(path.join(appDir,'dev'))).join(',');
 assert.equal(/host-probe|pane-diagnostics|acceptance-probe/.test(files),false,'发布文件不得带探针或诊断脚本');
 assert.equal(require('node:fs').existsSync(path.join(appDir,'dev','server.cjs')),true,'本机服务必须随发布文件一起复制');
 assert.equal(require('node:fs').existsSync(dataRoot),true,'用户数据目录必须存在');
});
test('install is repeatable and stays at exactly one node for this plugin',async t=>{
 const {publish,appDir,dataRoot}=await fixture(t);
 run('install.ps1',['-SourceDir',addin,'-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-SkipService']);
 run('install.ps1',['-SourceDir',addin,'-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-SkipService']);
 const xml=await fs.readFile(publish,'utf8');
 assert.equal((xml.match(/name="WpsRfqAddin"/g)||[]).length,1,'重复安装不得留下多个本插件节点');
 assert.equal(xml.includes('guid="OtherPlugin"'),true);
 assert.equal((xml.match(/OtherSamePort/g)||[]).length,2,'重复安装不得按端口删除其他插件');
 const codeBackups=(await fs.readdir(path.dirname(appDir))).filter(name=>name.startsWith(path.basename(appDir)+'.bak-'));
 assert.equal(codeBackups.length>=1,true,'升级覆盖程序目录前必须备份代码');
});
test('uninstall removes only this plugin and keeps user data',async t=>{
 const {root,publish,appDir,dataRoot}=await fixture(t);
 run('install.ps1',['-SourceDir',addin,'-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-SkipService']);
 const sentinel=path.join(dataRoot,'projects','p-1.json');
 await fs.mkdir(path.dirname(sentinel),{recursive:true});
 await fs.writeFile(sentinel,'{"projectId":"p-1"}','utf8');
 const before=await fs.readFile(sentinel,'utf8');
 const output=run('uninstall.ps1',['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-SkipStopService']);
 assert.match(output,/已从publish.xml移除本插件节点/);
 const xml=await fs.readFile(publish,'utf8');
 assert.equal(xml.includes('WpsRfqAddin'),false,'卸载后本插件节点必须移除');
 assert.equal(xml.includes('guid="OtherPlugin"'),true,'其他插件节点必须保留');
 assert.equal(xml.includes('url="http://127.0.0.1:41111/"'),true);
 assert.equal((xml.match(/OtherSamePort/g)||[]).length,2,'卸载不得按端口删除其他插件');
 assert.equal(await fs.readFile(sentinel,'utf8'),before,'卸载不得删除项目数据');
 assert.equal(require('node:fs').existsSync(appDir),true,'默认保留程序目录，便于回退');
 assert.match(output,/用户数据未删除/);
});

test('F7 lifecycle: custom DataRoot, restart, upgrade, failure rollback, uninstall and reinstall keep project data',async t=>{
 assert.equal(shellPath!==null,true,'需要PowerShell执行安装脚本');
 const {root,publish,appDir,dataRoot}=await fixture(t);
 t.after(()=>killTestService(root));
 const port=await freePort();
 const v1=await stageSource(root,'f7-v1');
 const v2=await stageSource(root,'f7-v2');
 const v3=await stageSource(root,'f7-v3-copy-fail');
 const v4=await stageSource(root,'f7-v4-start-fail');
 await fs.writeFile(path.join(v4,'dev','server.cjs'),'process.exit(1);\n','utf8');
 const base=['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)];
 const install=source=>run('install.ps1',['-SourceDir',source].concat(base));

 install(v1);
 const sentinels=await writeDataSentinels(dataRoot);
 for(const name of ['imports','library','projects','headers','splits']){
  assert.equal((await fs.stat(path.join(dataRoot,name))).isDirectory(),true,'安装必须创建 '+name+' 子目录');
 }
 const first=await waitHealth(port);
 assert.ok(first,'安装后服务必须健康');
 assert.equal(first.service,'wps-rfq-addin');
 assert.equal(first.scriptPath,path.join(appDir,'dev','server.cjs'),'健康响应必须报告本插件绝对脚本路径');
 assert.equal(first.appDir,appDir,'健康响应必须报告实际运行目录');
 assert.match(first.codeVersion,/^[a-f0-9]{64}$/);
 assert.ok(first.pid>0);
 assert.ok(Math.abs(Date.now()-Date.parse(first.startedAt))<60000,'创建时间必须接近实际启动时间');
 const firstVersion=first.codeVersion;
 const opened=await saveProject(port);
 assert.equal(opened.path,path.join(dataRoot,'projects',opened.projectId+'.json'),'项目必须落在自定义DataRoot');

 install(v1);
 const second=await waitHealth(port);
 assert.notEqual(second.pid,first.pid,'重复安装必须重启旧健康服务以重新加载代码');
 assert.equal(second.codeVersion,firstVersion,'同一份代码重启后的运行版本必须一致');
 assert.equal((await loadProject(port,opened.projectId)).projectId,opened.projectId);
 await assertDataSentinels(sentinels);

 install(v2);
 const upgraded=await waitHealth(port);
 assert.notEqual(upgraded.codeVersion,firstVersion,'升级后健康响应必须报告新代码版本');
 assert.notEqual(upgraded.pid,second.pid,'升级必须实际替换旧服务进程');
 assert.equal(await waitGone(second.pid),true,'旧服务进程必须退出');
 assert.match(await (await fetch('http://127.0.0.1:'+port+'/main.js')).text(),/f7-v2/,'升级后服务实际提供新代码');
 assert.equal((await loadProject(port,opened.projectId)).revision,1,'升级不得改写项目');
 await assertDataSentinels(sentinels);

 const beforeCopyFailure=await fs.readFile(publish,'utf8');
 const lockReady=path.join(root,'lock-ready.txt');
 const lock=holdExclusive(path.join(v3,'src','classification-ui.js'),lockReady);
 try{
  assert.equal(await waitForFile(lockReady),true,'必须真实锁住待复制文件');
  const failedCopy=runRaw('install.ps1',['-SourceDir',v3].concat(base));
  assert.notEqual(failedCopy.status,0,'复制失败必须返回非零');
  assert.match(outputOf(failedCopy),/复制发布文件失败/,'必须由真实源文件占用触发复制失败');
  assert.equal(await fs.readFile(publish,'utf8'),beforeCopyFailure,'复制失败必须还原本插件注册且其他插件原样保留');
  assert.equal(await fs.readFile(path.join(appDir,'main.js'),'utf8'),await fs.readFile(path.join(v2,'main.js'),'utf8'),'复制失败必须保留旧程序');
  const afterCopyFailure=await getHealth(port);
  assert.equal(afterCopyFailure.codeVersion,upgraded.codeVersion,'复制失败不得改变正在运行的服务');
  assert.equal(afterCopyFailure.pid,upgraded.pid);
  assert.equal((await loadProject(port,opened.projectId)).revision,1);
  await assertDataSentinels(sentinels);
 }finally{
  lock.kill();
  await fs.rm(lockReady,{force:true}).catch(()=>{});
 }

 const beforeStartFailure=await fs.readFile(publish,'utf8');
 const failedStart=runRaw('install.ps1',['-SourceDir',v4].concat(base));
 assert.notEqual(failedStart.status,0,'启动失败必须返回非零');
  assert.match(outputOf(failedStart),/新服务未通过身份核对|服务未在20秒|安装失败，已回退/,'必须由真实启动失败触发回退');
 assert.equal(await fs.readFile(publish,'utf8'),beforeStartFailure,'启动失败必须还原本插件注册且其他插件原样保留');
 assert.equal(await fs.readFile(path.join(appDir,'main.js'),'utf8'),await fs.readFile(path.join(v2,'main.js'),'utf8'),'启动失败必须还原旧代码');
 const afterStartFailure=await waitHealth(port);
 assert.ok(afterStartFailure,'启动失败回退后旧服务必须恢复健康');
 assert.equal(afterStartFailure.codeVersion,upgraded.codeVersion,'回退后必须运行旧代码');
 assert.match(await (await fetch('http://127.0.0.1:'+port+'/main.js')).text(),/f7-v2/);
 assert.equal((await loadProject(port,opened.projectId)).revision,1);
 await assertDataSentinels(sentinels);

 const uninstalled=run('uninstall.ps1',['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)]);
 assert.match(uninstalled,/已停止本插件服务/);
 assert.equal(await waitGone(afterStartFailure.pid),true,'卸载必须停止身份已核实的本插件服务');
 assert.equal(await getHealth(port),null,'卸载后端口不得再有本插件服务');
 const afterUninstall=await fs.readFile(publish,'utf8');
 assert.equal(afterUninstall.includes('WpsRfqAddin'),false);
 assert.equal(afterUninstall.includes('OtherPlugin'),true);
 assert.equal(afterUninstall.includes('OtherSamePort'),true);
 assert.equal((await fs.stat(appDir)).isDirectory(),true,'默认卸载保留程序目录');
 await assertDataSentinels(sentinels);

 install(v2);
 const reinstalled=await waitHealth(port);
 assert.equal(reinstalled.codeVersion,upgraded.codeVersion,'重装后必须运行同一新版代码');
 const reopened=await loadProject(port,opened.projectId);
 assert.equal(reopened.revision,1,'重装后项目必须可恢复');
 await assertDataSentinels(sentinels);
});

test('F7 identity: uninstall never stops PID reuse, unreadable command lines or another server.cjs',async t=>{
 assert.equal(shellPath!==null,true,'需要PowerShell执行卸载脚本');
 const {root,publish,appDir,dataRoot}=await fixture(t);
 const port=await freePort();
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 t.after(()=>{try{unrelated.kill();}catch(_){}});
 await wait(300);
 await fs.mkdir(dataRoot,{recursive:true});
 await fs.writeFile(path.join(dataRoot,'server.pid'),String(unrelated.pid),'utf8');
 let output=run('uninstall.ps1',['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)]);
 assert.match(output,/未停止|不符|拒绝/);
 assert.equal(processExists(unrelated.pid),true,'PID复用指向无关进程时必须保持运行');

 const otherDir=path.join(root,'other');
 await fs.mkdir(otherDir,{recursive:true});
 const otherServer=path.join(otherDir,'server.cjs');
 await fs.writeFile(otherServer,'setInterval(()=>{},1000);','utf8');
 const other=spawn(process.execPath,[otherServer],{stdio:'ignore'});
 t.after(()=>{try{other.kill();}catch(_){}});
 await wait(300);
 await fs.writeFile(path.join(dataRoot,'server.pid'),String(other.pid),'utf8');
 output=run('uninstall.ps1',['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)]);
 assert.match(output,/未停止|不符|绝对|拒绝/);
 assert.equal(processExists(other.pid),true,'其他目录的server.cjs不得被停止');

 await fs.writeFile(path.join(dataRoot,'server.pid'),'4','utf8');
 output=run('uninstall.ps1',['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)]);
 assert.match(output,/命令行不可读|无法读取|未停止|拒绝/);
 assert.equal(processExists(4),true,'命令行不可读时不得停止System进程');
});

test('F7 path guard: install and remove refuse broad AppDir targets',async t=>{
 assert.equal(shellPath!==null,true,'需要PowerShell执行安装脚本');
 const {root,publish,dataRoot}=await fixture(t);
 const sentinel=path.join(root,'keep.txt');
 await fs.writeFile(sentinel,'keep','utf8');
 let result=runRaw('install.ps1',['-SourceDir',addin,'-AppDir',root,'-PublishPath',publish,'-DataRoot',dataRoot,'-SkipService']);
 assert.notEqual(result.status,0,'不得把数据/发布文件所在根目录当作AppDir');
 assert.match(outputOf(result),/AppDir|拒绝|范围|包含/);
 assert.equal(await fs.readFile(sentinel,'utf8'),'keep');
 result=runRaw('uninstall.ps1',['-AppDir',root,'-PublishPath',publish,'-DataRoot',dataRoot,'-RemoveAppDir','-SkipStopService']);
 assert.notEqual(result.status,0,'不得删除包含数据/发布文件的根目录');
 assert.match(outputOf(result),/AppDir|拒绝|范围|包含/);
 assert.equal(await fs.readFile(sentinel,'utf8'),'keep');
});

test('F7 start command starts a hidden single instance with all five DataRoot directories',async t=>{
 assert.equal(shellPath!==null,true,'需要PowerShell执行启动脚本');
 const {root,publish,appDir,dataRoot}=await fixture(t);
 const port=await freePort();
 const base=['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)];
 run('install.ps1',['-SourceDir',addin,'-SkipService'].concat(base));
 const started=runRaw('start.ps1',['-AppDir',appDir,'-DataRoot',dataRoot,'-PublishPath',publish,'-Port',String(port)]);
 assert.equal(started.status,0,outputOf(started));
 const health=await waitHealth(port);
 assert.ok(health,'start.ps1必须启动健康服务');
 const processInfo=spawnSync(shellPath,['-NoProfile','-Command',
  '$p=Get-CimInstance Win32_Process -Filter "ProcessId='+health.pid+'"; $p.CommandLine'],{encoding:'utf8'});
 const commandLine=processInfo.stdout||'';
 for(const name of ['imports','library','projects','headers','splits']){
  assert.match(commandLine,new RegExp('--'+name.replace(/s$/,'')+'-directory|--'+name+'-directory'),'必须显式传入 '+name+' 目录');
  assert.equal(commandLine.includes(path.join(dataRoot,name)),true,'命令行目录必须是自定义 DataRoot 下的 '+name);
 }
 const window=spawnSync(shellPath,['-NoProfile','-Command',
  '$p=Get-Process -Id '+health.pid+' -ErrorAction SilentlyContinue; if($p){$p.MainWindowHandle}'],{encoding:'utf8'});
 assert.equal((window.stdout||'').trim(),'0','后台服务必须没有可见主窗口');
 const again=run('start.ps1',['-AppDir',appDir,'-DataRoot',dataRoot,'-PublishPath',publish,'-Port',String(port)]);
 assert.match(again,/服务已在运行/);
 assert.equal((await waitHealth(port)).pid,health.pid,'重复start不得创建第二个实例');
 run('uninstall.ps1',['-AppDir',appDir,'-PublishPath',publish,'-DataRoot',dataRoot,'-Port',String(port)]);
 assert.equal(await waitGone(health.pid),true);

 const occupied=net.createServer();
 await new Promise(resolve=>occupied.listen(port,'127.0.0.1',resolve));
 try{
  const blocked=runRaw('start.ps1',['-AppDir',appDir,'-DataRoot',dataRoot,'-PublishPath',publish,'-Port',String(port)]);
  assert.notEqual(blocked.status,0,'端口被其他程序占用时必须失败');
  assert.match(outputOf(blocked),/已被其他程序占用/);
 }finally{
  await new Promise(resolve=>occupied.close(resolve));
 }
});
