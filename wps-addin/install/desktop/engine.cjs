'use strict';
// Desktop setup transaction. No shell file operations, PATH dependency or
// execution-policy changes. PowerShell is used only for Windows APIs/XML.
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),net=require('node:net');
const {spawn,spawnSync}=require('node:child_process');
const WPS_URL='https://www.wps.cn/',SUPPORTED_WPS='12.1.0.29161';
const DATA=['imports','library','projects','headers','splits'];
const RELEASE=['main.js','ribbon.xml','taskpane.html','styles.css','library.html','library.css','package.json','rules','src','dev','assets'];
const equal=(a,b)=>!!a&&!!b&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const within=(a,b)=>equal(a,b)||path.resolve(a).toLowerCase().startsWith(path.resolve(b).toLowerCase()+path.sep);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function wpsActivity(processes){
 const blocking=[],background=[];
 for(const p of processes||[]){
  if(!/^(et|wps|wpp)\.exe$/i.test(p.name||''))continue;
  const command=String(p.command||'');
  const helper=/jsapibrowser\.dll|CefRenderEntryPoint|aspcenter[^\\/\s]*\.dll|--type=(renderer|gpu-process|utility|crashpad-handler)(?:\s|$)/i.test(command);
  if(p.hasWindow===false&&helper&&!/(?:^|\s)[\/-](Embedding|Automation)(?:\s|$)/i.test(command))background.push(p);
  else blocking.push(p);
 }
 return {running:blocking.length>0,backgroundCount:background.length,blockingProcesses:blocking.map(p=>({pid:p.pid,name:p.name})),backgroundPids:background.map(p=>p.pid)};
}
function selectLocation(base,requested,record){
 if(record&&(!record.app||!path.isAbsolute(record.app)))throw Error('原安装记录不完整，请先修复原安装位置。');
 const original=record&&(record.installRoot||path.dirname(record.app));
 const installRoot=path.resolve(requested||original||base.data);
 if(requested&&!path.isAbsolute(requested))throw Error('安装位置必须是绝对路径。');
 if(original&&!equal(installRoot,original))throw Error('升级请沿用原安装位置；项目数据不会自动搬移。');
 if(equal(installRoot,path.parse(installRoot).root)||DATA.some(name=>within(installRoot,path.join(base.data,name))))throw Error('安装位置不能是磁盘根目录或项目数据目录。');
 for(const reserved of [process.env.USERPROFILE,process.env.LOCALAPPDATA,process.env.APPDATA,process.env.TEMP,process.env.WINDIR])if(reserved&&equal(installRoot,reserved))throw Error('请选择独立的程序安装文件夹。');
 const c={...base,installRoot,app:path.join(installRoot,'app'),runtimeRoot:path.join(installRoot,'runtime'),managerRoot:path.join(installRoot,'managers'),locationLocked:!!original};
 validatePaths(c);return c;
}
async function checkLocation(c){
 validatePaths(c);
 const root=c.installRoot||path.dirname(c.app);
 if(fs.existsSync(c.app)){
  const stat=await fsp.lstat(c.app);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('目标程序目录不是普通文件夹。');
  const names=await fsp.readdir(c.app);
  if(names.length){let pkg;try{pkg=JSON.parse(await fsp.readFile(path.join(c.app,'package.json'),'utf8'));}catch(_){}if(!pkg||pkg.name!=='wps-rfq-addin')throw Error('所选目录中存在其他程序，未覆盖非本插件的文件夹。');}
 }
 let ancestor=root;
 while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('无法访问所选安装位置。');ancestor=parent;}
 if(!(await fsp.stat(ancestor)).isDirectory())throw Error('所选安装位置不是文件夹。');
 const probe=path.join(ancestor,'.rfq-write-check-'+require('node:crypto').randomBytes(8).toString('hex'));
 let handle;try{handle=await fsp.open(probe,'wx');await handle.close();handle=null;}catch(error){throw Error('所选安装位置不可写，请选择当前用户有权限的文件夹。');}finally{if(handle)await handle.close();await fsp.rm(probe,{force:true}).catch(()=>{});}
}
function assess(e){
 e={...e,wpsVersion:e.wpsVersion&&(String(e.wpsVersion).match(/\d+/g)||[]).slice(0,4).join('.')};
 const reasons=[];
 if(!e.windows||!e.x64)reasons.push('此安装包适用于 64 位 Windows 10 / 11。');
 if(!(Number(String(e.node||'').replace(/^v/,'').split('.')[0])>=22))reasons.push('内置 Node.js 不可用，请重新下载安装包。');
 if(!(Number(String(e.powershell||'').split('.')[0])>=7))reasons.push('内置 PowerShell 不可用，请重新下载安装包。');
 if(!e.wpsPath)reasons.push('未找到 WPS 表格，请先安装后重新检测。');
 if(e.running)reasons.push('请先保存文件并关闭 WPS，再点击重新检测。');
 if(e.locationError)reasons.push(e.locationError);
 return {...e,ready:reasons.length===0,reasons,requiresConfirmation:!!e.wpsPath&&e.wpsVersion!==SUPPORTED_WPS,wpsAction:WPS_URL};
}
function validatePaths(c){
 for(const name of ['source','app','data','publish'])if(!c[name]||!path.isAbsolute(c[name]))throw Error(name+' 必须是绝对路径。');
 if(within(c.data,c.app)||within(c.publish,c.app)||within(c.source,c.app)||within(c.app,c.source)||equal(c.app,path.parse(c.app).root)||equal(path.dirname(c.app),path.parse(c.app).root))throw Error('安装目录与来源、用户数据或系统目录重叠，已停止。');
 for(const p of [process.env.USERPROFILE,process.env.LOCALAPPDATA,process.env.APPDATA,process.env.TEMP])if(p&&equal(c.app,p))throw Error('安装目录不能是用户或系统目录。');
}
function sameService(h,p,app,version){
 const script=path.join(app,'dev','server.cjs');
 return !!(h&&p&&h.service==='wps-rfq-addin'&&h.pid===p.pid&&equal(h.scriptPath,script)&&equal(p.scriptPath,script)&&equal(h.appDir,app)&&/^[a-f0-9]{64}$/.test(version||'')&&h.codeVersion===version&&Number.isFinite(Date.parse(h.startedAt))&&Math.abs(Date.parse(h.startedAt)-Date.parse(p.startedAt))<=5000);
}
function ps(exe,script,env={}){
 const result=spawnSync(exe,['-NoLogo','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); "+script],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024,env:{...process.env,...env}});
 if(result.error||result.status!==0)throw Error((result.stderr||result.stdout||String(result.error)).trim());
 return result.stdout.trim().replace(/^\uFEFF/,'');
}
function windowsPlatform(c){return {
 async ensureClosed(){if(readWpsActivity(c).running)throw Error('请先保存文件并关闭 WPS，再重新安装。');},
 async health(){try{const r=await fetch('http://127.0.0.1:'+c.port+'/health',{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch(_){return null;}},
 async occupied(){return new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port:c.port});s.setTimeout(700);s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.once('timeout',()=>{s.destroy();resolve(false);});});},
 async query(pid){
  if(!Number.isInteger(pid)||pid<=0)return null;
  const raw=ps(c.powershell,'$p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$env:RFQ_PID); if($p){[pscustomobject]@{pid=[int]$p.ProcessId;command=$p.CommandLine;startedAt=$p.CreationDate.ToUniversalTime().ToString("o")}|ConvertTo-Json -Compress}',{RFQ_PID:String(pid)});
  if(!raw)return null;const p=JSON.parse(raw),match=String(p.command||'').match(/(?:"([^"]*server\.cjs)"|([^\s"]+server\.cjs))/i);
  return {...p,scriptPath:match&&(match[1]||match[2])};
 },
 async codeVersion(root){const r=spawnSync(c.node,[path.join(root,'dev','server.cjs'),'--code-version',root],{encoding:'utf8',windowsHide:true,timeout:20000});if(r.status!==0||!/^[a-f0-9]{64}$/.test((r.stdout||'').trim()))throw Error('无法核对程序版本。');return r.stdout.trim();},
 async start(){
  const args=[path.join(c.app,'dev','server.cjs'),'--port',String(c.port)];
  for(const name of DATA)args.push('--'+({imports:'import',library:'library',projects:'project',headers:'header',splits:'split'}[name])+'-directory',path.join(c.data,name));
  const child=spawn(c.node,args,{detached:true,windowsHide:true,stdio:'ignore'});
  const pid=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',()=>resolve(child.pid));});child.unref();return pid;
 },
 async stop(pid){ps(c.powershell,'Stop-Process -Id ([int]$env:RFQ_PID) -ErrorAction Stop',{RFQ_PID:String(pid)});for(let i=0;i<50;i++){if(!await this.query(pid))return;await delay(100);}throw Error('服务未能正常停止。');},
 async registration(remove=false){
  ps(c.powershell,'$file=$env:RFQ_PUBLISH; [xml]$xml=if(Test-Path -LiteralPath $file){[IO.File]::ReadAllText($file)}else{\'<jsplugins/>\'}; if($xml.DocumentElement.Name -ne "jsplugins"){throw "WPS 插件注册格式无法识别"}; @($xml.DocumentElement.ChildNodes)|Where-Object {$_ -is [Xml.XmlElement] -and ($_.GetAttribute("name") -eq "WpsRfqAddin" -or $_.GetAttribute("guid") -eq "WpsRfqAddin")}|ForEach-Object{[void]$xml.DocumentElement.RemoveChild($_)}; if($env:RFQ_REMOVE -ne "1"){$n=$xml.CreateElement("jspluginonline"); @{name="WpsRfqAddin";type="et";url=("http://127.0.0.1:"+$env:RFQ_PORT+"/");debug="";enable="enable_dev";install="null";customDomain=""}.GetEnumerator()|ForEach-Object{$n.SetAttribute($_.Key,$_.Value)}; [void]$xml.DocumentElement.AppendChild($n)}; $tmp=$file+".rfq-"+[guid]::NewGuid().ToString("N")+".tmp"; try{$xml.Save($tmp);[IO.File]::Move($tmp,$file,$true)}finally{if(Test-Path -LiteralPath $tmp){[IO.File]::Delete($tmp)}}', {RFQ_PUBLISH:c.publish,RFQ_PORT:String(c.port),RFQ_REMOVE:remove?'1':'0'});
 },
 async linkPaths(){
  const paths=JSON.parse(ps(c.powershell,'@([Environment]::GetFolderPath("Desktop"),[Environment]::GetFolderPath("Programs"),[Environment]::GetFolderPath("Startup")) | ForEach-Object{Join-Path $_ "材料整理助手.lnk"}|ConvertTo-Json -Compress'));
  for(const file of paths){if(fs.existsSync(file)){const target=ps(c.powershell,'$s=New-Object -ComObject WScript.Shell;($s.CreateShortcut($env:RFQ_LINK)).TargetPath',{RFQ_LINK:file});if(!within(target,c.managerRoot||path.join(c.data,'managers'))&&!within(target,path.join(c.data,'managers')))throw Error('发现非本插件的同名快捷方式，未覆盖：'+file);}}
  return paths;
 },
 async shortcuts(){ps(c.powershell,'$s=New-Object -ComObject WScript.Shell; foreach($folder in @([Environment]::GetFolderPath("Desktop"),[Environment]::GetFolderPath("Programs"),[Environment]::GetFolderPath("Startup"))){$link=$s.CreateShortcut((Join-Path $folder "材料整理助手.lnk"));$link.TargetPath=$env:RFQ_LAUNCHER;$link.Arguments=if($folder -eq [Environment]::GetFolderPath("Startup")){"--background"}else{""};$link.WorkingDirectory=[IO.Path]::GetDirectoryName($env:RFQ_LAUNCHER);$link.Save()}',{RFQ_LAUNCHER:path.join(c.manager,'Launcher.exe')});}
};}
async function copyTree(from,to){
 const stat=await fsp.lstat(from);if(stat.isSymbolicLink())throw Error('安装来源包含链接，已停止：'+from);
 if(stat.isDirectory()){await fsp.mkdir(to,{recursive:true});for(const name of await fsp.readdir(from)){if(/probe|diagnostic|acceptance/i.test(name))continue;await copyTree(path.join(from,name),path.join(to,name));}}
 else if(stat.isFile())await fsp.copyFile(from,to);
}
async function checkedHealth(platform,c,pid,version){
 for(let i=0;i<100;i++){const health=await platform.health();if(health&&health.pid===pid&&sameService(health,await platform.query(pid),c.app,version))return health;await delay(200);}
 throw Error('服务健康检查未通过，安装已停止。');
}
async function withLock(c,action,wait=false){
 validatePaths(c);await fsp.mkdir(c.data,{recursive:true});
 const lock=path.join(c.data,'setup.lock'),token=JSON.stringify({pid:process.pid,token:require('node:crypto').randomBytes(12).toString('hex')});
 const deadline=Date.now()+45000;
 for(;;){try{await fsp.writeFile(lock,token,{flag:'wx'});break;}catch(error){
  if(error.code!=='EEXIST')throw error;
  let owner;try{owner=JSON.parse(await fsp.readFile(lock,'utf8'));}catch(_){if(wait&&Date.now()<deadline){await delay(100);continue;}throw Error('另一个安装正在进行或安装记录无法读取，请稍后重试。');}
  let alive=true;try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
  if(alive){if(wait&&Date.now()<deadline){await delay(100);continue;}throw Error('另一个安装正在进行，请等待其完成。');}
  try{const current=JSON.parse(await fsp.readFile(lock,'utf8'));if(current.token===owner.token)await fsp.unlink(lock);}catch(e){if(e.code!=='ENOENT')throw e;}
 }}
 try{return await action();}finally{if(await fsp.readFile(lock,'utf8').catch(()=>null)===token)await fsp.unlink(lock);}
}
async function install(c,platform=windowsPlatform(c),report=()=>{}){return withLock(c,()=>performInstall(c,platform,report));}
async function startService(c,platform=windowsPlatform(c)){
 return withLock(c,async()=>{
  const health=await platform.health(),version=await platform.codeVersion(c.app);
  if(health){if(!sameService(health,await platform.query(health.pid),c.app,version))throw Error('现有服务身份不符，请从安装程序修复。');return health;}
  if(await platform.occupied())throw Error('端口被其他程序占用。');
  const pid=await platform.start(),result=await checkedHealth(platform,c,pid,version);await fsp.writeFile(path.join(c.data,'server.pid'),String(pid));return result;
 },true);
}
async function prepareRuntime(source,parent,id){
 if(!path.isAbsolute(parent)||!/^[\w.-]+$/.test(id))throw Error('运行环境目录无效。');
 const suffix=Date.now()+'-'+require('node:crypto').randomBytes(4).toString('hex'),final=path.join(parent,id+'-'+suffix),stage=final+'.stage';
 await fsp.mkdir(parent,{recursive:true});
 try{await fsp.cp(source,stage,{recursive:true,errorOnExist:true,force:false});await fsp.rename(stage,final);return final;}
 catch(error){if(within(stage,parent)&&!equal(stage,parent))await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});throw error;}
}
async function atomicJson(file,value){const temp=file+'.'+require('node:crypto').randomBytes(6).toString('hex')+'.tmp';try{await fsp.writeFile(temp,JSON.stringify(value,null,2),{flag:'wx'});await fsp.rename(temp,file);}finally{await fsp.rm(temp,{force:true}).catch(()=>{});}}
async function performInstall(c,platform,report){
 validatePaths(c);
 const stamp=Date.now()+'-'+require('node:crypto').randomBytes(4).toString('hex');
 const stage=c.app+'.stage-'+stamp,backup=c.app+'.bak-'+stamp;
 const hadApp=fs.existsSync(c.app),hadPublish=fs.existsSync(c.publish),registration=hadPublish?await fsp.readFile(c.publish):null;
 const metadata=path.join(c.data,'installation.json'),oldMetadata=c.manager&&fs.existsSync(metadata)?await fsp.readFile(metadata):null;
 const links=[];
 if(c.manager&&platform.linkPaths)for(const file of await platform.linkPaths())links.push({file,bytes:fs.existsSync(file)?await fsp.readFile(file):null});
 let old=await platform.health(),oldVersion=null,oldStopped=false,newPid=null,newIdentity=null,moved=false,backed=false,metadataWritten=false;
 if(old){
  oldVersion=hadApp?await platform.codeVersion(c.app):null;
  if(!sameService(old,await platform.query(old.pid),c.app,oldVersion))throw Error('正在运行的服务身份与安装目录不同。请使用原安装位置升级，当前安装未作改动。');
 }else if(await platform.occupied())throw Error('安装所需端口被其他程序占用，未停止其他程序。');
 await fsp.mkdir(path.dirname(c.app),{recursive:true});
 try{
  report('正在准备程序文件…');await fsp.mkdir(stage);
  for(const name of RELEASE)if(fs.existsSync(path.join(c.source,name)))await copyTree(path.join(c.source,name),path.join(stage,name));
  const pkg=JSON.parse(await fsp.readFile(path.join(stage,'package.json'),'utf8'));
  if(pkg.name!=='wps-rfq-addin'||!fs.existsSync(path.join(stage,'main.js')))throw Error('安装包内容不完整。');
  const version=await platform.codeVersion(stage);
  for(const name of DATA)await fsp.mkdir(path.join(c.data,name),{recursive:true});
  await fsp.mkdir(path.dirname(c.publish),{recursive:true});
  if(hadPublish)await fsp.writeFile(c.publish+'.bak-'+stamp,registration,{flag:'wx'});
  if(old){
   const fresh=await platform.health();
   if(!sameService(fresh,await platform.query(old.pid),c.app,oldVersion))throw Error('停止前服务身份发生变化。');
   await platform.stop(old.pid);oldStopped=true;
  }
  report('正在安装并注册 WPS 插件…');
  if(hadApp){await fsp.rename(c.app,backup);backed=true;}
  await fsp.rename(stage,c.app);moved=true;
  await platform.registration();
  newPid=await platform.start();newIdentity=await platform.query(newPid);await checkedHealth(platform,c,newPid,version);
  await fsp.writeFile(path.join(c.data,'server.pid'),String(newPid),'utf8');
  if(c.manager&&platform.shortcuts)await platform.shortcuts();
  if(c.manager){await atomicJson(metadata,{...c,pid:newPid,codeVersion:version,backup:backed?backup:null});metadataWritten=true;}
  report('插件安装和服务核对已完成。');return {pid:newPid,codeVersion:version,backup:backed?backup:null};
 }catch(error){
  const recovery=[];
  // The only new process we may stop is the exact one started by this transaction.
  let safeToRestore=true;
  if(newPid){try{const p=await platform.query(newPid);if(p){if(!newIdentity||p.pid!==newIdentity.pid||p.startedAt!==newIdentity.startedAt||!equal(p.scriptPath,path.join(c.app,'dev','server.cjs')))throw Error('进程创建身份已变化，未停止该进程。');await platform.stop(newPid);}}catch(e){safeToRestore=false;recovery.push('新服务停止失败：'+e.message);}}
  try{
   if(!safeToRestore)throw Error('新服务身份无法确认，原程序备份已保留：'+backup);
   if(moved){if(!within(c.app,path.dirname(stage))||equal(c.app,path.dirname(stage)))throw Error('回退目录越界');await fsp.rm(c.app,{recursive:true,force:true});}
   if(backed)await fsp.rename(backup,c.app);
  }catch(e){recovery.push('代码回退失败：'+e.message);}
  try{if(hadPublish)await fsp.writeFile(c.publish,registration);else if(moved)await fsp.rm(c.publish,{force:true});}catch(e){recovery.push('注册回退失败：'+e.message);}
  if(metadataWritten){try{if(oldMetadata)await fsp.writeFile(metadata,oldMetadata);else await fsp.rm(metadata,{force:true});}catch(e){recovery.push('安装记录回退失败：'+e.message);}}
  for(const item of links){try{if(item.bytes)await fsp.writeFile(item.file,item.bytes);else await fsp.rm(item.file,{force:true});}catch(e){recovery.push('快捷方式回退失败：'+e.message);}}
  if(oldStopped&&safeToRestore&&fs.existsSync(c.app)){try{const pid=await platform.start();await checkedHealth(platform,c,pid,oldVersion);await fsp.writeFile(path.join(c.data,'server.pid'),String(pid));}catch(e){recovery.push('旧服务恢复失败：'+e.message);}}
  throw Error(error.message+(recovery.length?'\n'+recovery.join('\n'):'\n已恢复原程序和注册，项目数据保留。'));
 }finally{if(within(stage,path.dirname(c.app))&&!equal(stage,c.app))await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});}
}
function readWpsActivity(c){
 const processes=JSON.parse(ps(c.powershell,'$rows=@(Get-CimInstance Win32_Process -Filter "Name=\'wps.exe\' OR Name=\'et.exe\' OR Name=\'wpp.exe\'"|ForEach-Object{$hasWindow=$true;try{$hasWindow=([Diagnostics.Process]::GetProcessById($_.ProcessId).MainWindowHandle -ne [IntPtr]::Zero)}catch{};[pscustomobject]@{pid=[int]$_.ProcessId;name=$_.Name;command=$_.CommandLine;hasWindow=$hasWindow}});ConvertTo-Json -InputObject $rows -Depth 3 -Compress'));
 return wpsActivity(processes);
}
async function installBundle(c,packageRoot,report=()=>{},platformFactory=windowsPlatform){
 const meta=JSON.parse(await fsp.readFile(path.join(packageRoot,'bundle.json'),'utf8'));
 return withLock(c,async()=>{
  await checkLocation(c);
  const runtime=await prepareRuntime(path.join(packageRoot,'runtime'),c.runtimeRoot,meta.runtimeId);
  c.node=path.join(runtime,'node','node.exe');c.powershell=path.join(runtime,'powershell','pwsh.exe');
  const manager=path.join(c.managerRoot,path.basename(runtime)+'-'+meta.build);
  await fsp.mkdir(manager,{recursive:true});
  await fsp.copyFile(__filename,path.join(manager,'engine.cjs'));await fsp.copyFile(path.join(packageRoot,'Launcher.exe'),path.join(manager,'Launcher.exe'));
  c.manager=manager;
  await fsp.writeFile(path.join(manager,'config.json'),JSON.stringify(c));
  const platform=platformFactory(c);if(platform.ensureClosed)await platform.ensureClosed();
  const result=await performInstall(c,platform,report);
  return {...result,installRoot:c.installRoot,data:c.data};
 });
}
async function inspect(c){
 const raw=ps(c.powershell,'$paths=[Collections.Generic.List[string]]::new(); foreach($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)){foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)){$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view);try{foreach($key in @("Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\et.exe","Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\wps.exe")){$k=$base.OpenSubKey($key);if($k){$v=[string]$k.GetValue("");if($v){$paths.Add($v.Trim([char]34))};$k.Dispose()}}}finally{$base.Dispose()}}}; foreach($root in @($env:LOCALAPPDATA,$env:ProgramFiles,${env:ProgramFiles(x86)})){if($root){$office=Join-Path $root "Kingsoft"; if(Test-Path -LiteralPath $office){Get-ChildItem -LiteralPath $office -Filter et.exe -File -Recurse -ErrorAction SilentlyContinue|ForEach-Object{$paths.Add($_.FullName)}}}}; $p=$paths|ForEach-Object{if([IO.Path]::GetFileName($_) -eq "wps.exe"){Join-Path ([IO.Path]::GetDirectoryName($_)) "et.exe"}else{$_}}|Where-Object{Test-Path -LiteralPath $_ -PathType Leaf}|Select-Object -Unique; $found=@($p|ForEach-Object{[pscustomobject]@{path=$_;version=([Diagnostics.FileVersionInfo]::GetVersionInfo($_)).FileVersion}}); [pscustomobject]@{wps=$found;running=(@(Get-Process et,wps -ErrorAction SilentlyContinue).Count -gt 0);build=[Environment]::OSVersion.Version.Build}|ConvertTo-Json -Compress -Depth 4');
 const env=JSON.parse(raw),wps=(env.wps||[]).find(x=>x.version===SUPPORTED_WPS)||(env.wps||[])[0];
 const activity=readWpsActivity(c);let locationError=null;try{await checkLocation(c);}catch(error){locationError=error.message;}
 return assess({windows:process.platform==='win32'&&env.build>=17763,x64:process.arch==='x64',node:process.version,powershell:ps(c.powershell,'$PSVersionTable.PSVersion.ToString()'),wpsPath:wps&&wps.path,wpsVersion:wps&&wps.version,...activity,installed:fs.existsSync(c.app),installRoot:c.installRoot||path.dirname(c.app),dataRoot:c.data,locationLocked:!!c.locationLocked,locationError});
}
function config(){
 const data=path.join(process.env.LOCALAPPDATA,'WpsRfqAddin');
 const base={source:path.resolve(__dirname,'../..'),app:path.join(data,'app'),data,publish:path.join(process.env.APPDATA,'kingsoft','wps','jsaddons','publish.xml'),node:process.execPath,powershell:path.resolve(__dirname,'../../../runtime/powershell/pwsh.exe'),port:38891};
 if(process.argv[2]==='start')return base;
 const index=process.argv.indexOf('--install-root-base64');
 if(index>=0&&!process.argv[index+1])throw Error('未收到所选安装位置。');
 const requested=index>=0?Buffer.from(process.argv[index+1],'base64').toString('utf8'):null;
 const saved=path.join(data,'installation.json'),record=fs.existsSync(saved)?JSON.parse(fs.readFileSync(saved,'utf8').replace(/^\uFEFF/,'')):null;
 return selectLocation(base,requested,record);
}
async function main(){
 const c=config(),mode=process.argv[2];
 const emit=(type,data)=>process.stdout.write(JSON.stringify({type,...data})+'\n');
 if(mode==='inspect')return emit('environment',await inspect(c));
 if(mode==='install'){
  const e=await inspect(c);if(!e.ready)throw Error(e.reasons.join('\n'));if(e.requiresConfirmation&&!process.argv.includes('--accept-unverified'))throw Error('当前 WPS 版本尚未验证，请先在安装界面确认。');
  // Persist versioned private runtimes before the application switch. Old
  // runtimes are retained so rollback never depends on PATH or a deleted SDK.
  const packageRoot=path.resolve(__dirname,'../../..');c.wpsPath=e.wpsPath;
  const result=await installBundle(c,packageRoot,message=>emit('progress',{message}));
  emit('complete',{...result,wpsPath:e.wpsPath,data:c.data});
  return;
 }
 if(mode==='start'){
  Object.assign(c,JSON.parse(await fsp.readFile(path.join(__dirname,'config.json'),'utf8')));await startService(c);
  return emit('complete',{message:'服务已就绪。'});
 }
 throw Error('无法识别安装操作。');
}
module.exports={assess,validatePaths,sameService,install,windowsPlatform,inspect,copyTree,prepareRuntime,startService,wpsActivity,selectLocation,checkLocation,installBundle};
if(require.main===module)main().catch(error=>{process.stdout.write(JSON.stringify({type:'error',message:error.message})+'\n');process.exitCode=1;});
