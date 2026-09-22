const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const script = path.resolve(__dirname, '../dev/register.ps1');
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');

test('registration preserves other add-ins, is repeatable, backs up and removes only itself', {skip:process.platform !== 'win32'}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rfq-register-'));
  t.after(() => fs.rm(root, {recursive:true,force:true}));
  const target = path.join(root, 'publish.xml');
  const original = '<jsplugins><jspluginonline name="other" url="http://localhost:3000/" type="et" /></jsplugins>';
  await fs.writeFile(target, original);
  function run(action, url='http://127.0.0.1:38891/') {
    return spawnSync(powershell, ['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Action',action,'-PublishPath',target,'-Url',url], {encoding:'utf8'});
  }
  for (let i=0;i<2;i++) {
    const result = run('Register');
    assert.equal(result.status, 0, result.stderr);
    const xml = await fs.readFile(target, 'utf8');
    assert.equal((xml.match(/name="WpsRfqAddin"/g)||[]).length, 1);
    assert.match(xml, /name="other"/);
    assert.match(xml, /http:\/\/localhost:3000\//);
  }
  const backups = (await fs.readdir(root)).filter(p=>p.startsWith('publish.xml.backup-'));
  assert.ok(backups.length >= 2);
  assert.ok((await Promise.all(backups.map(p=>fs.readFile(path.join(root,p),'utf8')))).includes(original));
  assert.equal(run('Unregister').status, 0);
  const remaining = await fs.readFile(target,'utf8');
  assert.match(remaining, /name="other"/);
  assert.doesNotMatch(remaining, /WpsRfqAddin/);
  assert.notEqual(run('Register','https://external.example/').status, 0);
  assert.equal(await fs.readFile(target,'utf8'), remaining);
});
