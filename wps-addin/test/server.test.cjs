const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer, prepareProbeSources } = require('../dev/server.cjs');

async function setup(t, probe = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rfq-http-'));
  await fs.writeFile(path.join(root, 'main.js'), 'window.example = true;');
  await fs.writeFile(path.join(root, 'secret.txt'), 'private-data');
  const reportPath = path.join(root, 'report.json');
  const server = createServer({ root, reportPath,
    probeConfig: probe ? { token: 'unit-test-token', outputPath: 'C:\\test\\probe.xlsx' } : null });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, {recursive:true,force:true}); });
  const port = server.address().port;
  function request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({hostname:'127.0.0.1',port,path:url,method:options.method || 'GET',headers:options.headers}, res => {
        let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({status:res.statusCode,body,headers:res.headers}));
      });
      req.on('error', reject); req.end(options.body);
    });
  }
  return {request,reportPath};
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
  assert.deepEqual(JSON.parse((await request('/health')).body), {service:'wps-rfq-addin',version:'0.1.0',mode:'development'});
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
