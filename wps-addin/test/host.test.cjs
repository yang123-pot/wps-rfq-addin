const test = require('node:test');
const assert = require('node:assert/strict');
const host = require('../src/host.js');

function sheet(name, values, row = 1, column = 1) {
  const matrix = Array.isArray(values) ? values : [[values]];
  return { Name: name, UsedRange: { Row: row, Column: column,
    Rows: { Count: matrix.length }, Columns: { Count: matrix[0].length }, Value2: values } };
}
function app(sheets) {
  return { ActiveWorkbook: { Name: '测试清单.xlsx', FullName: 'C:\\样本\\测试清单.xlsx',
    Worksheets: { Count: sheets.length, Item: (i) => sheets[i - 1] } } };
}

test('outside WPS and no open workbook give actionable errors', () => {
  assert.throws(() => host.readWorkbook(null), /WPS/);
  assert.throws(() => host.readWorkbook({ ActiveWorkbook: null }), /工作簿/);
});
test('all sheets retain raw values and absolute row/column offsets', () => {
  const application = app([sheet('给排水', [['编码', '工程量'], ['000123', 12.5]], 3, 2), sheet('强电', [['A', 0]])]);
  const before = JSON.stringify(application.ActiveWorkbook);
  const result = host.readWorkbook(application);
  assert.equal(result.name, '测试清单.xlsx');
  assert.equal(result.sheets.length, 2);
  assert.deepEqual(result.sheets[0], { name: '给排水', startRow: 3, startColumn: 2, rowCount: 2, columnCount: 2,
    values: [['编码', '工程量'], ['000123', 12.5]] });
  assert.equal(JSON.stringify(application.ActiveWorkbook), before);
});
test('scalar and empty cell become one-cell matrices', () => {
  const result = host.readWorkbook(app([sheet('单值', '0001'), sheet('空页', null)]));
  assert.deepEqual(result.sheets.map(s => s.values), [[['0001']], [[null]]]);
});
test('metadata inspection does not read cell data', () => {
  const s = sheet('大表', [['a']]);
  Object.defineProperty(s.UsedRange, 'Value2', { get() { throw new Error('do not read'); } });
  assert.deepEqual(host.inspectWorkbook(app([s])).sheets[0], {
    name: '大表', startRow: 1, startColumn: 1, rowCount: 1, columnCount: 1
  });
});
test('oversized used ranges are rejected before reading cell contents', () => {
  const s = sheet('格式过多', [['a']]);
  s.UsedRange.Rows.Count = 1048576;
  s.UsedRange.Columns.Count = 10;
  Object.defineProperty(s.UsedRange, 'Value2', { get() { assert.fail('oversized range read'); } });
  assert.throws(() => host.readWorkbook(app([s])), /格式过多.*范围/);
});
test('total cells across sheets are bounded before reading any cell contents', () => {
  const sheets = Array.from({length: 6}, (_, i) => {
    const s = sheet('页' + i, [['a']]);
    s.UsedRange.Rows.Count = 100000; s.UsedRange.Columns.Count = 10;
    Object.defineProperty(s.UsedRange, 'Value2', { get() { assert.fail('total limit read'); } });
    return s;
  });
  assert.throws(() => host.readWorkbook(app(sheets)), /总.*范围/);
});
test('failed sheet read aborts import and names the affected sheet', () => {
  const s = sheet('损坏页', [['a']]);
  Object.defineProperty(s.UsedRange, 'Value2', { get() { throw new Error('接口失败'); } });
  assert.throws(() => host.readWorkbook(app([sheet('正常页', [['a']]), s])), /损坏页.*接口失败/);
});
test('partial or invalid host matrices cannot masquerade as a complete import', () => {
  const s = sheet('截断页', [['a', 'b']]);
  s.UsedRange.Rows.Count = 2;
  assert.throws(() => host.readWorkbook(app([s])), /截断页.*不完整/);
  s.UsedRange.Rows.Count = 1; s.UsedRange.Value2 = [['a']];
  assert.throws(() => host.readWorkbook(app([s])), /截断页.*不完整/);
});
test('snapshot has no mutable reference to the host matrix', () => {
  const s = sheet('原表', [['原始值']]);
  const result = host.readWorkbook(app([s]));
  result.sheets[0].values[0][0] = '修改副本';
  assert.equal(s.UsedRange.Value2[0][0], '原始值');
});
test('invalid sheet metadata is rejected instead of silently dropping rows', () => {
  const s = sheet('无效范围', [['a']]);
  s.UsedRange.Row = 0;
  assert.throws(() => host.readWorkbook(app([s])), /无效范围/);
});
test('source location refuses a different workbook before accessing any sheet', () => {
  const application = app([sheet('给排水', [['名称']])]);
  application.ActiveWorkbook.Worksheets.Item=()=>assert.fail('wrong workbook accessed');
  assert.throws(()=>host.locateSource(application,{path:'C:\\其他.xlsx',file:'其他.xlsx',sheet:'给排水',row:5,column:3}),/原工作簿|切换/);
});
test('source location selects only a valid coordinate in the matching workbook', () => {
  const s=sheet('给排水',[['名称']]);let selected;
  s.Activate=()=>{};s.Cells={Item:(row,column)=>({Select:()=>{selected=[row,column];}})};
  const application=app([s]);application.ActiveWorkbook.Worksheets.Item=()=>s;
  host.locateSource(application,{path:'c:/样本/测试清单.xlsx',file:'测试清单.xlsx',sheet:'给排水',row:5,column:3});
  assert.deepEqual(selected,[5,3]);
  assert.throws(()=>host.locateSource(application,{path:'c:/样本/测试清单.xlsx',file:'测试清单.xlsx',sheet:'给排水',row:0,column:3}),/行列/);
});
