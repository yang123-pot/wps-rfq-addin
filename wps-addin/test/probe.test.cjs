const test = require('node:test');
const assert = require('node:assert/strict');
const { runProbe, readSources } = require('../dev/host-probe.js');

test('existing probe target is refused without creating or closing any workbook', async () => {
  const reports = [];
  await runProbe({ FileSystem:{Exists:()=>true}, Workbooks:{Add(){assert.fail('must not create');}} },
    'C:\\probe.xlsx', r=>reports.push(r));
  assert.equal(reports.at(-1).passed, false);
  assert.match(reports.at(-1).error, /存在/);
});
test('saving failure closes only the probe workbook and restores previous workbook', async () => {
  const reports = [];
  let probeClosed = false, previousActivated = false;
  const range = {NumberFormat:'', Value2:null};
  const first = {Name:'Sheet1',Range:()=>range};
  const second = {Name:'Sheet2',Range:()=>range};
  const probeBook = {Worksheets:{Item:()=>first,Add:()=>second},
    SaveAs(){throw new Error('disk full');}, Close(save){ assert.equal(save,false); probeClosed=true; }};
  const previous = {Activate(){previousActivated=true;},Close(){assert.fail('must not close source');}};
  await runProbe({ActiveWorkbook:previous,FileSystem:{Exists:()=>false},Workbooks:{Add:()=>probeBook}},
    'C:\\probe.xlsx', r=>reports.push(r));
  assert.equal(probeClosed, true);
  assert.equal(previousActivated, true);
  assert.equal(reports.at(-1).passed, false);
  assert.match(reports.at(-1).error, /disk full/);
});
test('reading a source already opened by the user never closes it', async () => {
  let restored = false, active, newClosed = false;
  const existing = {FullName:'C:\\Source.xls',Activate(){active=this;},Close(){assert.fail('user workbook closed');}};
  const previous = {Activate(){restored=true;active=this;}};
  const fresh = {FullName:'C:\\New.xls',Close(save){assert.equal(save,false);newClosed=true;}};
  const application = {get ActiveWorkbook(){return active;},Workbooks:{Count:1,Item:()=>existing,
    Open(file,links,readOnly){assert.equal(file,'C:\\New.xls');assert.equal(links,0);assert.equal(readOnly,true);active=fresh;return fresh;}}};
  active=previous;
  const reports=[];
  await readSources(application,['c:/source.xls','C:\\New.xls'],()=>({sheets:[{rowCount:2,columnCount:3,startRow:1,startColumn:1}]}),r=>reports.push(r));
  assert.equal(reports.length,2);
  assert.ok(reports.every(r=>r.passed));
  assert.equal(newClosed,true);
  assert.equal(restored,true);
});
