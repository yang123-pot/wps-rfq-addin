const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
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
const otherPlugin='<jsplugin name="OtherPlugin" guid="OtherPlugin" url="http://127.0.0.1:41111/" type="et" enable="true"/>';
const samePortPlugin='<jsplugin name="OtherSamePort" guid="OtherSamePort" url="http://127.0.0.1:38891/" type="et" enable="true"/>';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-install-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
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
