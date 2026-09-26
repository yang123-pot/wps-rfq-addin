// 合成验收样例（handoff 第6.1节）：2份清单10行 → 合并8行 → 7询价＋1无需询价。
// 只用于测试与隔离验收：不修改 wps-addin/rules/defaults.json，也不读写本机生产分类库。
const collection = require('../../src/collection.js');
const categoryLibrary = require('../../src/category-library.js');
const categoryMemory = require('../../src/category-memory.js');

const FINGERPRINTS = { drain: 'a'.repeat(64), mep: 'b'.repeat(64) };
const PATHS = {
  drainOriginal: 'C:\\samples\\示例园区\\给排水清单.xlsx',
  drainCopy: 'C:\\samples\\示例园区\\copies\\给排水清单.xlsx',
  mepOriginal: 'C:\\samples\\示例园区\\机电清单.xlsx',
  mepCopy: 'C:\\samples\\示例园区\\copies\\机电清单.xlsx'
};

const DRAIN_VALUES = [
  ['工程名称：示例园区', '', '', '', ''],
  ['项目编码', '项目名称', '项目特征描述', '单位', '工程量'],
  ['SB-001', '水泵', 'DN50', '台', '1'],
  ['SB-002', '水泵', 'DN65', '台', '1'],
  ['FM-001', '阀门', 'DN50', '个', '20'],
  ['FM-002', '阀门', 'DN65', '个', '12'],
  ['GS-001', '钢索', '规格C', 'm', '10']
];

// 机电清单含三段专业区隔：给排水（水泵）、暖通（送/排风机）、强电（充电桩配电箱）。
// 区隔行只有项目名称，解析器按已确认口径识别专业，不留“专业来源不明确”问题。
const MEP_VALUES = [
  ['工程名称：示例园区', '', '', '', ''],
  ['项目编码', '项目名称', '项目特征描述', '单位', '工程量'],
  ['', '给排水', '', '', ''],
  ['SB-101', '水泵', 'DN50', '台', '1'],
  ['SB-102', '水泵', 'DN65', '台', '2'],
  ['', '暖通', '', '', ''],
  ['FJ-101', '送风机', '规格A', '台', '2'],
  ['FJ-102', '排风机', '规格B', '台', '3'],
  ['', '强电', '', '', ''],
  ['CD-101', '充电桩配电箱', '充电桩配套', '台', '1']
];

function bookInput(originalPath, copyPath, name, sheet, values, fingerprint) {
  return {
    metadata: { originalPath, originalName: name, copyPath, fingerprint },
    snapshot: { name, path: originalPath, fingerprint,
      sheets: [{ name: sheet, startRow: 1, startColumn: 1, rowCount: values.length, columnCount: 5, values }] }
  };
}

const inputs = [
  bookInput(PATHS.drainOriginal, PATHS.drainCopy, '给排水清单.xlsx', '给排水', DRAIN_VALUES, FINGERPRINTS.drain),
  bookInput(PATHS.mepOriginal, PATHS.mepCopy, '机电清单.xlsx', '机电安装', MEP_VALUES, FINGERPRINTS.mep)
];

// 隔离分类库：水泵/阀门/风机/汽车充电桩/无需询价与图03下拉一致。
// “强电”只存在于本隔离夹具，用来让“充电桩配电箱”同时命中“汽车充电桩配套”和“强电配电箱”，
// 制造图02的“待核对／分类冲突”行；不并入生产口径，也不改动历史人工库。
const library = {
  version: 'fixture-workflow-v3-20260926.1',
  note: '合成验收样例专用隔离分类库，只用于测试，不是生产分类库。',
  categories: [
    { id: 'no-inquiry', name: '无需询价', state: 'active' },
    { id: 'pump', name: '水泵', state: 'active' },
    { id: 'valve', name: '阀门', state: 'active' },
    { id: 'fan', name: '风机', state: 'active' },
    { id: 'ev-charger', name: '汽车充电桩', state: 'active' },
    { id: 'strong-electric', name: '强电', state: 'active' }
  ],
  rules: [
    { id: 'fixture-steel-cable-skip', categoryId: 'no-inquiry', state: 'active',
      basis: '示例夹具：钢索→无需询价', match: [{ field: 'text', any: ['钢索'] }] },
    { id: 'fixture-pump', categoryId: 'pump', state: 'active',
      basis: '示例夹具：水泵→水泵', match: [{ field: 'name', any: ['水泵'] }] },
    { id: 'fixture-valve', categoryId: 'valve', state: 'active',
      basis: '示例夹具：阀门→阀门', match: [{ field: 'name', any: ['阀门'] }] },
    { id: 'fixture-fan', categoryId: 'fan', state: 'active',
      basis: '示例夹具：送风机、排风机→风机', match: [{ field: 'name', any: ['风机'] }] },
    { id: 'fixture-ev-charger-box', categoryId: 'ev-charger', state: 'active',
      basis: '示例夹具：充电桩配套配电箱→汽车充电桩',
      match: [{ field: 'text', any: ['配电箱'] }, { field: 'text', any: ['充电桩'] }] },
    { id: 'fixture-cabinet-conflict', categoryId: 'strong-electric', state: 'active',
      basis: '示例夹具：仅用于制造“配电箱”建议冲突，普通配电箱→强电，由用户在表内决定',
      match: [{ field: 'text', any: ['配电箱'] }] }
  ]
};

function buildCollection(mergeIdentical) {
  return collection.add(collection.create(), inputs);
}

function keyOf(name, feature, unit) { return [name, feature, unit].join('|'); }

// 图中稳定顺序（handoff 6.1 表）：钢索虽来自第一份清单，但按图列在最后一行。
const ORDER = [
  { name: '水泵', feature: 'DN50', unit: '台' },
  { name: '水泵', feature: 'DN65', unit: '台' },
  { name: '阀门', feature: 'DN50', unit: '个' },
  { name: '阀门', feature: 'DN65', unit: '个' },
  { name: '送风机', feature: '规格A', unit: '台' },
  { name: '排风机', feature: '规格B', unit: '台' },
  { name: '充电桩配电箱', feature: '充电桩配套', unit: '台' },
  { name: '钢索', feature: '规格C', unit: 'm' }
];

const CATEGORY_PLAN = [
  { categoryId: 'pump', categoryName: '水泵', rows: 2, mode: 'separate-brands', sheets: 2,
    groups: [{ brand: '青源', supplier: '华川设备' }, { brand: '恒流', supplier: '启明机电' }],
    files: ['水泵_华川设备.xlsx', '水泵_启明机电.xlsx'] },
  { categoryId: 'valve', categoryName: '阀门', rows: 2, mode: 'combined', sheets: 1,
    groups: [{ brand: '通达', supplier: '正通商贸' }, { brand: '海岳', supplier: '安合设备' }],
    files: ['阀门_多供应商.xlsx'] },
  { categoryId: 'fan', categoryName: '风机', rows: 2, mode: 'combined', sheets: 1,
    groups: [{ brand: '瑞风', supplier: '瑞风设备' }],
    files: ['风机_瑞风设备.xlsx'] },
  { categoryId: 'ev-charger', categoryName: '汽车充电桩', rows: 1, mode: 'combined', sheets: 1,
    groups: [{ brand: '驰电', supplier: '远程电气' }],
    files: ['汽车充电桩_远程电气.xlsx'] }
];

function rowIdOf(preview, name, feature, unit) {
  const group = (preview.groups || []).filter(function (item) {
    return item.name === name && item.feature === feature && item.unit === unit;
  })[0];
  if (!group) throw Error('合成样例缺少材料：' + keyOf(name, feature, unit));
  return group.id;
}

// 合并后的稳定行序与rowId：按图中顺序，不随来源顺序变化。
function expectedRows(mergeIdentical) {
  const preview = collection.preview(buildCollection(), mergeIdentical === true);
  const plan = {};
  CATEGORY_PLAN.forEach(function (category) {
    plan[category.categoryName] = category;
  });
  const merged = {};
  preview.groups.forEach(function (group) { merged[keyOf(group.name, group.feature, group.unit)] = group; });
  return ORDER.map(function (entry) {
    const group = merged[keyOf(entry.name, entry.feature, entry.unit)];
    return {
      rowId: group.id, name: group.name, feature: group.feature, unit: group.unit,
      quantity: group.quantity, scopeId: group.scopeId, sources: group.sources.length
    };
  });
}

const expectations = {
  input: { files: 2, rows: 10 },
  merged: { rows: 8 },
  inquiry: { rows: 7, sheets: 5, files: 5 },
  noInquiry: { rows: 1 },
  categoryFiles: 4,
  summaryRows: 4,
  order: ORDER.map(function (entry) { return keyOf(entry.name, entry.feature, entry.unit); }),
  categories: CATEGORY_PLAN,
  conflict: { name: '充电桩配电箱', feature: '充电桩配套', unit: '台', resolvedCategoryId: 'ev-charger' },
  splitFiles: CATEGORY_PLAN.reduce(function (out, category) { return out.concat(category.files); }, []),
  paths: PATHS,
  fingerprints: FINGERPRINTS
};

module.exports = {
  inputs: inputs,
  library: library,
  createMemory: function () { return categoryMemory.create(); },
  buildCollection: buildCollection,
  expectedRows: expectedRows,
  rowIdOf: rowIdOf,
  keyOf: keyOf,
  validateLibrary: function () { return categoryLibrary.validate(library); },
  expectations: expectations
};
