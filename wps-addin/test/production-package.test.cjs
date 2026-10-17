const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const addinRoot = path.resolve(__dirname, '..');

test('生产入口不包含可激活的探针模式或诊断脚本入口', () => {
  const source = fs.readFileSync(path.join(addinRoot, 'dev', 'server.cjs'), 'utf8');
  for (const forbidden of [
    'probeConfig', '--probe-output', '--report', '--source',
    '__probe', 'host-probe', 'pane-diagnostics', 'acceptance-probe'
  ]) {
    assert.equal(source.includes(forbidden), false, `server.cjs 不得保留 ${forbidden}`);
  }
});

test('开发探针从独立入口加载，生产服务默认不暴露报告接口', async () => {
  const probe = require('../dev/probe-server.cjs');
  assert.equal(typeof probe.createProbeServer, 'function');
  assert.equal(typeof probe.prepareProbeSources, 'function');

  const production = require('../dev/server.cjs');
  const server = production.createServer({ root: addinRoot });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(origin + '/__probe/report', { method: 'POST', body: '{}' });
    assert.equal(response.status, 404);
    const index = await (await fetch(origin + '/')).text();
    assert.doesNotMatch(index, /host-probe|__RFQ_PROBE__/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
