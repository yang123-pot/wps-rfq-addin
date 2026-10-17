const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createServer, prepareProbeSources } = require('../dev/server.cjs');

function client(server) {
  const port = server.address().port;
  return (url, options = {}) => new Promise((resolve, reject) => {
    const req = http.request({hostname:'127.0.0.1',port,path:url,method:options.method || 'GET',headers:options.headers}, res => {
      let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({status:res.statusCode,body,headers:res.headers}));
    });
    req.on('error', reject); req.end(options.body);
  });
}
async function setup(t, probe = false, extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rfq-http-'));
  await fs.writeFile(path.join(root, 'main.js'), 'window.example = true;');
  await fs.writeFile(path.join(root, 'secret.txt'), 'private-data');
  const reportPath = path.join(root, 'report.json');
  const server = createServer({ root, reportPath,
    probeConfig: probe ? { token: 'unit-test-token', outputPath: 'C:\\test\\probe.xlsx' } : null, ...extra });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, {recursive:true,force:true}); });
  return {request:client(server),reportPath,root};
}
test('serves plugin assets but not arbitrary workspace files', async t => {
  const {request} = await setup(t);
  assert.equal((await request('/main.js')).body, 'window.example = true;');
  assert.equal((await request('/secret.txt')).status, 404);
  assert.equal((await request('/dev/pane-diagnostics.js')).status, 404);
  assert.equal((await request('/%2e%2e/handoff.md')).status, 404);
  assert.equal((await request('/.git/config')).status, 404);
  const index = await request('/index.html');
  assert.equal(index.status, 200);
  assert.match(index.body, /main.js/);
  assert.doesNotMatch(index.body, /host-probe/);
  const health=JSON.parse((await request('/health')).body);
  assert.equal(health.service,'wps-rfq-addin');
  assert.equal(health.version,'0.1.0');
  assert.equal(health.mode,'development');
  assert.equal(health.pid,process.pid);
  assert.equal(health.scriptPath,path.resolve(__dirname,'..','dev','server.cjs'),'必须报告实际加载的脚本绝对路径');
  assert.match(health.codeVersion,/^[a-f0-9]{64}$/);
  assert.equal(Number.isNaN(Date.parse(health.startedAt)),false,'健康响应必须带可比较的启动时间');
});
test('health identity reports the running code version and the CLI prints the same version', async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-identity-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'main.js'),'window.version="one";');
  const first=createServer({root});
  await new Promise(resolve=>first.listen(0,'127.0.0.1',resolve));
  const firstHealth=JSON.parse((await (await fetch('http://127.0.0.1:'+first.address().port+'/health')).text()));
  await new Promise(resolve=>first.close(resolve));
  await fs.writeFile(path.join(root,'main.js'),'window.version="two";');
  const second=createServer({root});
  await new Promise(resolve=>second.listen(0,'127.0.0.1',resolve));
  const secondHealth=JSON.parse((await (await fetch('http://127.0.0.1:'+second.address().port+'/health')).text()));
  await new Promise(resolve=>second.close(resolve));
  assert.notEqual(firstHealth.codeVersion,secondHealth.codeVersion,'代码变化必须改变运行版本');
  const cli=spawnSync(process.execPath,[path.resolve(__dirname,'..','dev','server.cjs'),'--code-version',root],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.equal(cli.stdout.trim(),secondHealth.codeVersion,'安装侧必须能用同一算法计算期望版本');
});
test('serves all seven local Ribbon SVG icons through the strict asset whitelist', async t => {
  const root=path.resolve(__dirname,'..');
  const server=createServer({root});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const request=client(server);
  for(const asset of ['import','matching','review','categories','brands','inquiry','split']){
    const response=await request('/assets/'+asset+'.svg');
    assert.equal(response.status,200,asset+'图标必须可由真实静态路由获取');
    assert.equal(response.headers['content-type'],'image/svg+xml');
    assert.equal(response.body,await fs.readFile(path.join(root,'assets',asset+'.svg'),'utf8'));
  }
  assert.equal((await request('/assets/not-a-release-icon.svg')).status,404,'不得扩大为任意assets路径');
});
test('WPS probes receive disposable copies, so host metadata writes cannot touch originals', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'rfq-probe-inputs-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const original = path.join(root,'source.xls');
  await fs.writeFile(original,'unchanged original bytes');
  const copies = await prepareProbeSources([original],root);
  assert.equal(copies.length,1);
  assert.notEqual(copies[0],original);
  assert.equal(await fs.readFile(copies[0],'utf8'),'unchanged original bytes');
  await fs.writeFile(copies[0],'WPS modified metadata');
  assert.equal(await fs.readFile(original,'utf8'),'unchanged original bytes');
  const second = await prepareProbeSources([original],root);
  assert.notEqual(second[0],copies[0]);
  assert.equal(await fs.readFile(second[0],'utf8'),'unchanged original bytes');
});
test('rejects hostile Host, Origin and state changing static requests', async t => {
  const {request} = await setup(t);
  assert.equal((await request('/main.js', {headers:{host:'attacker.example'}})).status, 403);
  assert.equal((await request('/main.js', {headers:{origin:'https://attacker.example'}})).status, 403);
  assert.equal((await request('/main.js', {method:'POST'})).status, 405);
});
test('diagnostic report endpoint is disabled during normal use', async t => {
  const {request} = await setup(t);
  assert.equal((await request('/__probe/report', {method:'POST',body:'{}'})).status, 404);
});
test('侧栏目录浏览只服务会话令牌，可过滤扩展名且不开放写入', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'rfq-fs-http-'));
  t.after(() => fs.rm(folder, {recursive:true,force:true}));
  await fs.mkdir(path.join(folder, '清单文件夹'));
  await fs.writeFile(path.join(folder, '清单文件夹', '清单.xlsx'), 'x');
  await fs.writeFile(path.join(folder, '清单文件夹', '说明.txt'), 'y');
  const server = createServer({root:path.resolve(__dirname, '..'), importDirectory:path.join(folder, 'copies')});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = client(server);
  const page = await request('/taskpane.html');
  const injected = JSON.parse(/window\.__RFQ_IMPORT__=(\{[^;]*\});/.exec(page.body)[1]);
  assert.equal(injected.browse, true, '侧栏必须知道本机服务支持内置文件浏览');
  assert.equal((await request('/api/fs/list')).status, 405);
  assert.equal((await request('/api/fs/list', {method:'POST', body:JSON.stringify({path:folder})})).status, 403);
  const bad = await request('/api/fs/list', {method:'POST', headers:{'content-type':'application/json','x-rfq-import-token':injected.token},
    body:JSON.stringify({path:path.join(folder, '不存在')})});
  assert.equal(bad.status, 400);
  const listed = await request('/api/fs/list', {method:'POST', headers:{'content-type':'application/json','x-rfq-import-token':injected.token},
    body:JSON.stringify({path:path.join(folder, '清单文件夹'), extensions:['.xlsx']})});
  assert.equal(listed.status, 200);
  assert.equal(listed.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(listed.body).entries.map(item => item.name + ':' + item.type), ['清单.xlsx:file']);
});
test('probe accepts only authenticated bounded JSON reports and persists evidence', async t => {
  const {request,reportPath} = await setup(t, true);
  const headers = {'content-type':'application/json','x-rfq-probe-token':'unit-test-token'};
  assert.equal((await request('/__probe/report', {method:'POST',body:'{}'})).status, 403);
  assert.equal((await request('/__probe/report', {method:'POST',headers,body:'{'})).status, 400);
  assert.equal((await request('/__probe/report', {method:'POST',headers,body:JSON.stringify({stage:'read',passed:true,sheetCount:2})})).status, 200);
  const evidence = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  assert.equal(evidence.reports[0].stage, 'read');
  assert.equal(evidence.reports[0].sheetCount, 2);
  assert.equal((await request('/__probe/report', {method:'POST',headers,body:'x'.repeat(65537)})).status, 413);
});
test('probe keeps pane events when heartbeat reports exceed the evidence limit', async t => {
  const {request,reportPath} = await setup(t, true);
  const headers = {'content-type':'application/json','x-rfq-probe-token':'unit-test-token'};
  async function send(stage,event) {
    const body = JSON.stringify({stage,event,paneSession:'first-pane'});
    assert.equal((await request('/__probe/report', {method:'POST',headers,body})).status, 200);
  }
  await send('pane-ready','');
  await send('pane-event','click');
  for (let index=0; index<105; index++) await send('pane-heartbeat','');
  const reports = JSON.parse(await fs.readFile(reportPath,'utf8')).reports;
  assert.equal(reports.length,100);
  assert.equal(reports.filter(item=>item.stage==='pane-heartbeat').length,98);
  assert.equal(reports.some(item=>item.stage==='pane-ready'),true);
  assert.equal(reports.some(item=>item.stage==='pane-event'&&item.event==='click'),true);
});
