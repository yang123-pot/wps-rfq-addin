// R12-I：不合并、全部跳过及边界数据（依赖 G/H 已通过的真实主链）。
// 本文件只覆盖第6.2节与R12-I列出的业务边界；真机文件另见 outputs/wps-acceptance-20260927/R12-I/。
const test = require('node:test'), assert = require('node:assert/strict');
const sample = require('./fixtures/workflow-v3-sample.cjs');
const collection = require('../src/collection.js');
const review = require('../src/classification-review-model.js');
const reviewHost = require('../src/classification-review-host.js');
const categoryWorkbooks = require('../src/category-workbooks.js');
const brandModel = require('../src/brand-model.js');
const brandTable = require('../src/brand-table.js');
const inquiry = require('../src/inquiry-model.js');
const splitPlan = require('../src/split-plan.js');
const project = require('../src/project.js');
const decimal = require('../src/decimal.js');

const HEADER = { projectName: '示例园区不合并', company: '示例建设公司', contact: '测试员', phone: '示例联系方式' };
const ROOT = 'C:\\成果 批次\\示例 园区';
const INPUT_KEY = 'ck2-r12i-no-merge';

// 走一遍图03“表内修改、整表一次确认”：冲突行由用户在表内选“汽车充电桩”，其余用自动建议，钢索保持无需询价。
function confirmedFlow(mergeIdentical) {
  const col = sample.buildCollection();
  const preview = collection.preview(col, mergeIdentical === true);
  const groups = preview.groups;
  const built = review.build(groups, { library: sample.library, memory: sample.createMemory(), projectId: 'p-r12i-flow' });
  const categories = sample.library.categories.map(function (category) { return { id: category.id, name: category.name }; });
  const readRows = built.rows.map(function (row) {
    let categoryId = row.finalCategoryId, categoryName = row.finalCategoryName;
    if (row.abnormal) { categoryId = 'ev-charger'; categoryName = '汽车充电桩'; }
    return { rowId: row.rowId, row: row.index + 3, index: row.index, name: row.name, feature: row.feature,
      unit: row.unit, quantity: row.quantity, autoCategoryId: row.autoCategoryId, autoCategoryName: row.autoCategoryName,
      finalCategoryId: categoryId, finalCategoryName: categoryName, reviewNote: '' };
  });
  const valid = review.validateRead({ rows: readRows, issues: [] }, { categories: categories });
  const fields = built.rows.map(function (row) {
    return { rowId: row.rowId, code: row.code, scopeId: row.scopeId, sourceIds: row.sourceIds,
      name: row.name, feature: row.feature, unit: row.unit, quantity: row.quantity,
      autoCategoryId: row.autoCategoryId, autoCategoryName: row.autoCategoryName };
  });
  const binding = { path: ROOT + '\\分类审核成果.xlsx', sheet: review.SHEET, headerRow: review.HEADER_ROW,
    firstRow: review.FIRST_ROW, lastRow: review.FIRST_ROW + built.rows.length - 1, rowIdColumn: review.ROW_ID_COLUMN,
    fields: fields, categories: categories };
  const confirmation = review.confirmation(valid.rows, { binding: binding, projectId: 'p-r12i-flow',
    inputKey: INPUT_KEY, libraryVersion: built.libraryVersion, revision: 1 });
  const decisions = valid.rows.map(function (row) {
    return { rowId: row.rowId, categoryId: row.categoryId, categoryName: row.categoryName, skip: row.skip };
  });
  return { col: col, preview: preview, groups: groups, built: built, valid: valid, binding: binding,
    confirmation: confirmation, categories: categories, decisions: decisions };
}

// 图05（2026-10-11一本多页变更）：汇总表＝分类工作簿第 1 页，名称列文件内跳转到对应分类页。
// 填写模式与6.1节相同：水泵2组按品牌分别生成、阀门2组合成、风机/充电桩各1组。
function fillSummary(summary, plan) {
  const combos = {
    pump: [['青源', '华川设备'], ['恒流', '启明机电']],
    valve: [['通达', '正通商贸'], ['海岳', '安合设备']],
    fan: [['瑞风', '瑞风设备']],
    'ev-charger': [['驰电', '远程电气']]
  };
  const modes = { pump: '按品牌分别生成', valve: '合成一份', fan: '合成一份', 'ev-charger': '合成一份' };
  const spec = brandModel.summaryLayoutFor(summary.layout);
  plan.categories.forEach(function (entry, index) {
    const row = spec.firstRow + index;
    (combos[entry.categoryId] || []).forEach(function (pair, groupIndex) {
      if (spec.name === 'combined') summary.sheets[0].values[row - 1][spec.groups[groupIndex][0] - 1] =
        '品牌：' + pair[0] + '\n供应商：' + pair[1];
      else {
        summary.sheets[0].values[row - 1][spec.groups[groupIndex][0] - 1] = pair[0];
        summary.sheets[0].values[row - 1][spec.groups[groupIndex][1] - 1] = pair[1];
      }
    });
    summary.sheets[0].values[row - 1][spec.modeColumn - 1] = modes[entry.categoryId];
  });
  return summary;
}

function summaryAndInquiry(flow, layout) {
  const categoryPlan = categoryWorkbooks.plan(flow.confirmation, { binding: flow.binding,
    directory: ROOT + '\\分类工作簿', inputKey: INPUT_KEY, root: ROOT, projectName: '示例园区不合并' });
  assert.equal(categoryPlan.ok, true, (categoryPlan.issues[0] || {}).message);
  const categories = categoryPlan.files.map(function (file) {
    return { categoryId: file.categoryId, categoryName: file.categoryName, rowCount: file.rowCount,
      sheetName: file.sheetName, file: categoryPlan.file, path: categoryPlan.path, sha256: null };
  });
  const plan = brandModel.summaryPlan(categories, { directory: categoryPlan.directory, inputKey: INPUT_KEY,
    layout: layout, projectName: '示例园区不合并', internal: true });
  assert.equal(plan.ok, true, (plan.issues[0] || {}).message);
  const summary = fillSummary(brandModel.buildSummary(plan, {}), plan);
  const read = brandModel.parseSummary(summary.sheets[0].values,
    brandModel.summaryBindingFor(categoryPlan.path, summary));
  assert.equal(read.ok, true, (read.issues[0] || {}).message);
  const model = inquiry.build({ brands: brandModel.summaryReadRecord(read), groups: flow.groups,
    classification: { decisions: flow.decisions }, header: HEADER, inputKey: INPUT_KEY });
  return { categoryPlan: categoryPlan, categories: categories, summaryPlan: plan, summary: summary,
    summaryRead: read, inquiry: model };
}

test('R12-I不合并：10行来源边界保留，4类4/2/2/1，9条询价材料，仍5份', () => {
  const flow = confirmedFlow(false);
  assert.equal(flow.preview.mode, 'separate');
  assert.equal(flow.preview.inputCount, sample.expectations.separate.rows);
  assert.equal(flow.preview.outputCount, sample.expectations.separate.outputRows, '不合并必须逐行保留，不得减少行数');
  assert.equal(flow.preview.canFinalize, true);
  assert.equal(flow.groups.length, sample.expectations.separate.rows);
  // 来源边界：给排水2行水泵（1/1）＋机电2行水泵（1/2），合计4行，数量不累加。
  const separate = sample.expectedSeparateRows();
  const pumps = separate.filter(function (row) { return row.name === '水泵'; });
  assert.equal(pumps.length, sample.expectations.separate.categoryRows.pump);
  assert.deepEqual(pumps.map(function (row) { return row.quantity; }), sample.expectations.separate.pumpQuantities);
  assert.equal(new Set(pumps.map(function (row) { return row.scopeId; })).size, 2, '两行水泵必须来自两份清单且不跨清单合并');
  assert.equal(flow.valid.ok, true, (flow.valid.errors[0] || {}).message);
  assert.equal(flow.valid.counts.rows, 10);
  assert.equal(flow.valid.counts.noInquiry, sample.expectations.separate.noInquiryRows);

  const chain = summaryAndInquiry(flow, 'combined');
  assert.deepEqual(chain.categoryPlan.counts, { categories: 4, inquiryRows: 9, noInquiryRows: 1, totalRows: 10 });
  assert.deepEqual(chain.categoryPlan.files.map(function (file) { return [file.categoryName, file.rowCount]; }),
    [['水泵', 4], ['阀门', 2], ['风机', 2], ['汽车充电桩', 1]], '4个分类簿必须为4/2/2/1');
  assert.equal(chain.summaryRead.expectedSheets, sample.expectations.separate.inquirySheets);
  assert.equal(chain.inquiry.rowCount, sample.expectations.separate.inquiryRows, '9条询价材料');
  assert.equal(chain.inquiry.sheetCount, 5);

  const pumpSheets = chain.inquiry.sheets.filter(function (sheet) { return sheet.categoryId === 'pump'; });
  assert.equal(pumpSheets.length, 2);
  pumpSheets.forEach(function (sheet) {
    assert.equal(sheet.rowIds.length, sample.expectations.separate.pumpSheetRows, '两水泵询价页各4行');
    const quantities = sheet.values.slice(sheet.headerRow).map(function (row) { return row[5]; });
    assert.deepEqual(quantities, sample.expectations.separate.pumpQuantities, '两页各自列出来源行，不重复累加数量');
  });
  const valveSheets = chain.inquiry.sheets.filter(function (sheet) { return sheet.categoryId === 'valve'; });
  assert.equal(valveSheets.length, 1, '阀门合成一份');
  assert.deepEqual(valveSheets[0].values.slice(valveSheets[0].headerRow).map(function (row) { return row[5]; }), ['20', '12']);
  assert.equal(valveSheets[0].brandLabel, '通达 / 海岳');
  assert.equal(valveSheets[0].values.slice(valveSheets[0].headerRow).length, 2, '合成一份时材料行只列一次');

  const split = splitPlan.build({ model: chain.inquiry, targetDirectory: ROOT + '\\询价输出不合并',
    generation: { inputKey: INPUT_KEY, sha256: 'a'.repeat(64), target: ROOT + '\\示例园区_询价总表.xlsx' },
    currentKey: INPUT_KEY });
  assert.equal(split.canPublish, true, split.conflicts.map(function (item) { return item.message; }).join('；'));
  assert.deepEqual(split.files.map(function (file) { return file.name; }).sort(),
    ['水泵_华川设备.xlsx', '水泵_启明机电.xlsx', '阀门_多供应商.xlsx', '风机_瑞风设备.xlsx', '汽车充电桩_远程电气.xlsx'].sort());
});

test('R12-I不合并：分列布局与同格布局解析成同一套品牌口径', () => {
  const flow = confirmedFlow(false);
  const combined = summaryAndInquiry(flow, 'combined');
  const separated = summaryAndInquiry(flow, 'separated');
  const business = function (read) {
    return read.categories.map(function (entry) {
      return { categoryId: entry.categoryId, mode: entry.mode, groups: entry.groups };
    });
  };
  assert.deepEqual(business(combined.summaryRead), business(separated.summaryRead));
  assert.equal(combined.summaryRead.expectedSheets, separated.summaryRead.expectedSheets);
  assert.deepEqual(combined.inquiry.sheets.map(function (sheet) { return [sheet.name, sheet.categoryId]; }),
    separated.inquiry.sheets.map(function (sheet) { return [sheet.name, sheet.categoryId]; }));
});

test('R12-I全部无需询价：可确认可保存、无待输出、不生成空文件也不强制填品牌', () => {
  const flow = confirmedFlow(false);
  const skipRows = flow.built.rows.map(function (row) {
    return { rowId: row.rowId, row: row.index + 3, index: row.index, name: row.name, feature: row.feature,
      unit: row.unit, quantity: row.quantity, autoCategoryId: row.autoCategoryId, autoCategoryName: row.autoCategoryName,
      finalCategoryId: 'no-inquiry', finalCategoryName: '无需询价', reviewNote: '' };
  });
  const valid = review.validateRead({ rows: skipRows, issues: [] }, { categories: flow.categories });
  assert.equal(valid.ok, true, '全部标为无需询价是完整确认，不得强制填品牌');
  assert.equal(valid.counts.noInquiry, flow.built.rows.length);
  assert.equal(valid.counts.empty, 0);
  const confirmation = review.confirmation(valid.rows, { binding: flow.binding, projectId: 'p-r12i-skip',
    inputKey: 'ck2-r12i-skip', libraryVersion: flow.built.libraryVersion, revision: 1 });
  const draft = review.draft({ rows: skipRows, issues: [] }, { binding: flow.binding, inputKey: 'ck2-r12i-skip' });
  assert.equal(draft.ok, true, '全部无需询价时也能保存审核草稿');

  const plan = categoryWorkbooks.plan(confirmation, { binding: flow.binding, directory: ROOT + '\\无询价\\分类工作簿',
    inputKey: 'ck2-r12i-skip', root: ROOT + '\\无询价' });
  assert.equal(plan.ok, true, (plan.issues[0] || {}).message);
  assert.deepEqual(plan.counts, { categories: 0, inquiryRows: 0, noInquiryRows: 10, totalRows: 10 });
  assert.equal(plan.files.length, 0, '分类阶段不得生成空文件');
  const receipt = categoryWorkbooks.receipt(plan, {});
  assert.equal(receipt.status, 'empty');
  assert.equal(receipt.files.length, 0);
  const summary = categoryWorkbooks.summarize(receipt);
  assert.equal(summary.status, 'empty');
  assert.equal(summary.detail, '0 行纳入询价 · 10 行无需询价');

  // 汇总/询价不在没有类别时生成空文件，也不报“未处理异常”。
  assert.throws(function () { brandModel.summaryPlan([], { directory: ROOT + '\\无询价', inputKey: 'ck2-r12i-skip' }); },
    /没有需要询价的类别/);
  assert.throws(function () {
    inquiry.build({ brands: brandModel.summaryReadRecord({ layout: 'combined', categories: [] }), groups: flow.groups,
      classification: { decisions: confirmation.rows }, header: HEADER, inputKey: 'ck2-r12i-skip' });
  }, /还没有从分类汇总表读回|没有需要询价/);

  // 品牌表在没有可询价行时为空结构，validateBrands 不因“没填品牌”而失败（品牌阶段不强制空清单）。
  const brands = brandTable.build(flow.groups, { decisions: confirmation.rows }, 'ck2-r12i-skip');
  assert.equal(brandTable.isEmpty(brands), true);
  assert.equal(brandTable.validateBrands(brands).ok, true);
});

test('R12-I精度与文本：0.1＋0.2精确0.3，前导零/长小数/长中文特征保留，超单格上限拒绝不截断', () => {
  assert.equal(decimal.add('0.1', '0.2'), '0.3', '十进制文本相加不得出现浮点误差');
  const longDecimal = '0.1'.padEnd(2, '0') + '0000000001'; // 0.10000000001
  const longFeature = '超长中文特征'.repeat(30);
  const pumpBrands = { categories: [{ categoryId: 'pump', categoryName: '水泵', rowCount: 2, mode: 'synthesize',
    groups: [{ brand: '青源', supplier: '华川设备' }] }] };
  const model = inquiry.build({
    brands: pumpBrands,
    groups: [
      { id: 'g1', name: '水泵', feature: longFeature, unit: '台', quantity: '0.3',
        sources: [{ id: 's1', code: '000123', engineering: '一号楼', profession: '给排水' }] },
      { id: 'g2', name: '水泵', feature: 'DN65', unit: '台', quantity: longDecimal,
        sources: [{ id: 's2', code: '000124', engineering: '一号楼', profession: '给排水' }] }
    ],
    classification: { decisions: [{ rowId: 'g1', categoryId: 'pump', categoryName: '水泵' },
      { rowId: 'g2', categoryId: 'pump', categoryName: '水泵' }] },
    header: HEADER, inputKey: 'ck2-r12i-text' });
  const rows = model.sheets[0].values.slice(model.sheets[0].headerRow);
  assert.equal(rows[0][1], '000123', '前导零编码必须按文本保留');
  assert.equal(rows[1][1], '000124');
  assert.equal(rows[0][3], longFeature, '长中文特征必须完整保留');
  assert.equal(rows[1][5], longDecimal, '长小数必须逐位保留');
  assert.equal(rows[0][5], '0.3');

  // 超过宿主单格上限（32767）必须明确拒绝，不得截断后照常写出。
  assert.throws(function () {
    inquiry.build({ brands: { categories: [{ categoryId: 'pump', categoryName: '水泵', rowCount: 1,
      mode: 'synthesize', groups: [{ brand: '青源', supplier: '华川设备' }] }] },
      groups: [{ id: 'g9', name: '水泵', feature: '长'.repeat(32768), unit: '台', quantity: '1',
        sources: [{ id: 's9', code: 'C9' }] }],
      classification: { decisions: [{ rowId: 'g9', categoryId: 'pump', categoryName: '水泵' }] },
      header: HEADER, inputKey: 'ck2-r12i-text' });
  }, /含超长文本|未截断/);
  // 分类工作簿（图04）与审核成果表（图02）同样不得把超长材料文本带去宿主等待截断。
  const overLimit = { rowId: 'g9', index: '1', code: 'C9', name: '水泵', feature: '长'.repeat(32768), unit: '台',
    quantity: '1', scopeId: 's', sourceIds: ['s9'], categoryId: 'pump', categoryName: '水泵', skip: false, note: '' };
  assert.throws(function () {
    categoryWorkbooks.mainSheet({ categoryId: 'pump', categoryName: '水泵', rows: [overLimit] }, {});
  }, /含超长文本|未截断/);
  assert.throws(function () {
    review.mainSheet({ libraryVersion: 'fixture', categories: [], rows: [{ rowId: 'g9', index: 1, name: '水泵',
      feature: '长'.repeat(32768), unit: '台', quantity: '1', code: 'C9', engineering: '', profession: '',
      sourceIds: ['s9'], scopeId: 's', autoCategoryId: null, autoCategoryName: '', matchState: '无可靠匹配',
      matchBasis: '', finalCategoryId: '', finalCategoryName: '', reviewNote: '', abnormal: false }] }, {});
  }, /含超长文本|未截断/);
});

test('R12-I中文/空格路径与类别清洗后重名：链接地址可用、重名必须阻断', () => {
  const spaced = brandModel.summaryPlan([
    { categoryId: 'pump', categoryName: '水泵', rowCount: 2, path: ROOT + '\\分类工作簿\\水泵.xlsx' }
  ], { directory: ROOT, inputKey: 'ck2-r12i-path', layout: 'combined', projectName: '示例 园区' });
  assert.equal(spaced.ok, true, (spaced.issues[0] || {}).message);
  assert.equal(spaced.categories[0].relative, '分类工作簿\\水泵.xlsx');
  assert.equal(brandModel.relativePath(ROOT, ROOT + '\\分类工作簿\\水泵.xlsx'), '分类工作簿\\水泵.xlsx');

  // 类别名只差非法文件名字符，按文件名清洗后重名，必须报出而不是覆盖同一文件。
  const collision = categoryWorkbooks.plan({
    rows: [{ rowId: 'r1', categoryId: 'a', categoryName: '水泵/组' },
      { rowId: 'r2', categoryId: 'b', categoryName: '水泵\\组' }]
  }, { binding: { fields: [{ rowId: 'r1' }, { rowId: 'r2' }] }, directory: ROOT + '\\分类工作簿' });
  assert.equal(collision.ok, false);
  assert.equal(collision.issues[0].code, 'name-collision');
});

test('R12-I汇总边界：1/2/3组、空组/半组/重复组合/同品牌不同供应商/多组未选方式', () => {
  const categories = [
    { categoryId: 'pump', categoryName: '水泵', rowCount: 2, path: ROOT + '\\分类工作簿\\水泵.xlsx' },
    { categoryId: 'valve', categoryName: '阀门', rowCount: 2, path: ROOT + '\\分类工作簿\\阀门.xlsx' },
    { categoryId: 'fan', categoryName: '风机', rowCount: 2, path: ROOT + '\\分类工作簿\\风机.xlsx' },
    { categoryId: 'ev-charger', categoryName: '汽车充电桩', rowCount: 1, path: ROOT + '\\分类工作簿\\汽车充电桩.xlsx' }
  ];
  const spec = brandModel.summaryLayoutFor('combined');
  // cells：按第1/2/3组的填写；null 表示该组整格留空（用于验证空组忽略）。
  function combinedWith(first, cells) {
    first = first || {};
    const plan = brandModel.summaryPlan(categories, { directory: ROOT, inputKey: 'ck2-r12i-summary', layout: 'combined' });
    const workbook = brandModel.buildSummary(plan, {});
    const values = workbook.sheets[0].values.map(function (row) { return row.slice(); });
    const row = spec.firstRow;
    (cells || (first.groups || []).map(function (group) {
      return group.brand || group.supplier ? group : null;
    })).forEach(function (group, index) {
      if (!group) return;
      values[row - 1][spec.groups[index][0] - 1] = '品牌：' + group.brand + '\n供应商：' + group.supplier;
    });
    // 其余类别仍填一组，便于只观察被改动的第一行。
    [['通达', '正通商贸'], ['瑞风', '瑞风设备'], ['驰电', '远程电气']].forEach(function (pair, index) {
      const at = spec.firstRow + index + 1;
      values[at - 1][3] = '品牌：' + pair[0] + '\n供应商：' + pair[1];
      values[at - 1][6] = '合成一份';
    });
    values[row - 1][6] = first.modeLabel || '';
    return { values: values, binding: brandModel.summaryBindingFor(ROOT + '\\分类汇总表.xlsx', workbook) };
  }
  // 3组且按品牌分别生成：3份。
  const three = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }, { brand: '乙', supplier: 'S2' }, { brand: '丙', supplier: 'S3' }],
    modeLabel: '按品牌分别生成' });
  const threeRead = brandModel.parseSummary(three.values, three.binding);
  assert.equal(threeRead.ok, true, (threeRead.issues[0] || {}).message);
  assert.equal(threeRead.categories.filter(function (entry) { return entry.categoryId === 'pump'; })[0].groups.length, 3);
  assert.equal(brandModel.summarySheetCount(threeRead.categories), 3 + 1 + 1 + 1);
  // 空组忽略：只填第1、3组时按实际填写的两组解析，不留占位也不报半组。
  const gap = combinedWith({ modeLabel: '合成一份' },
    [{ brand: '甲', supplier: 'S1' }, null, { brand: '丙', supplier: 'S3' }]);
  const gapRead = brandModel.parseSummary(gap.values, gap.binding);
  assert.equal(gapRead.ok, true, (gapRead.issues[0] || {}).message);
  assert.deepEqual(gapRead.categories.filter(function (entry) { return entry.categoryId === 'pump'; })[0].groups,
    [{ brand: '甲', supplier: 'S1' }, { brand: '丙', supplier: 'S3' }]);
  // 半组：只填品牌，定位到该组单元格。
  const half = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }, { brand: '乙', supplier: '' }] });
  const halfRead = brandModel.parseSummary(half.values, half.binding);
  assert.equal(halfRead.ok, false);
  assert.equal(halfRead.issues[0].code, 'group-half');
  assert.equal(halfRead.issues[0].cell, 'E5');
  // 重复组合：同一品牌+供应商两次，报单元格。
  const duplicate = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }, { brand: '甲', supplier: 'S1' }] });
  const duplicateRead = brandModel.parseSummary(duplicate.values, duplicate.binding);
  assert.equal(duplicateRead.ok, false);
  assert.equal(duplicateRead.issues[0].code, 'group-duplicate');
  assert.equal(duplicateRead.issues[0].cell, 'E5');
  // 同品牌不同供应商：两组都要保留，不得当成重复。
  const sameBrand = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }, { brand: '甲', supplier: 'S2' }],
    modeLabel: '按品牌分别生成' });
  const sameBrandRead = brandModel.parseSummary(sameBrand.values, sameBrand.binding);
  assert.equal(sameBrandRead.ok, true, (sameBrandRead.issues[0] || {}).message);
  assert.deepEqual(sameBrandRead.categories.filter(function (entry) { return entry.categoryId === 'pump'; })[0].groups,
    [{ brand: '甲', supplier: 'S1' }, { brand: '甲', supplier: 'S2' }]);
  // 多组未选方式：不放行并定位到方式列。
  const noMode = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }, { brand: '乙', supplier: 'S2' }] });
  const noModeRead = brandModel.parseSummary(noMode.values, noMode.binding);
  assert.equal(noModeRead.ok, false);
  assert.equal(noModeRead.issues[0].code, 'mode-missing');
  assert.equal(noModeRead.issues[0].cell, 'G5');
  // 同格中文/英文冒号都可用；错误标签、重复标签、额外文本都定位到单元格。
  const english = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }] });
  english.values[spec.firstRow - 1][3] = 'brand: 甲\r\nsupplier: S1';
  assert.equal(brandModel.parseSummary(english.values, english.binding).ok, true);
  const wrongLabel = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }] });
  wrongLabel.values[spec.firstRow - 1][3] = '品牌甲\n供应商：S1';
  const wrongRead = brandModel.parseSummary(wrongLabel.values, wrongLabel.binding);
  assert.equal(wrongRead.ok, false);
  assert.equal(wrongRead.issues[0].cell, 'D5');
  const duplicatedLabel = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }] });
  duplicatedLabel.values[spec.firstRow - 1][3] = '品牌：甲\n品牌：乙\n供应商：S1';
  assert.equal(brandModel.parseSummary(duplicatedLabel.values, duplicatedLabel.binding).issues[0].code, 'combined-duplicate');
  const extraText = combinedWith({ groups: [{ brand: '甲', supplier: 'S1' }] });
  extraText.values[spec.firstRow - 1][3] = '品牌：甲\n供应商：S1\n备注：多余';
  assert.equal(brandModel.parseSummary(extraText.values, extraText.binding).issues[0].code, 'combined-unknown');
});

test('R12-I汇总改动：排序/筛选不串类，删行/复制行/改名称条数定位；只改格式不误判业务变化', () => {
  const flow = confirmedFlow(false);
  const chain = summaryAndInquiry(flow, 'combined');
  const base = chain.summary.sheets[0].values.map(function (row) { return row.slice(); });
  const binding = brandModel.summaryBindingFor(ROOT + '\\分类汇总表.xlsx', chain.summary);
  // 排序：交换前两行数据仍按隐藏类别ID读回，品牌不串类。
  const swapped = base.map(function (row) { return row.slice(); });
  const first = swapped[binding.firstRow - 1], second = swapped[binding.firstRow];
  swapped[binding.firstRow - 1] = second; swapped[binding.firstRow] = first;
  const swappedRead = brandModel.parseSummary(swapped, binding);
  assert.equal(swappedRead.ok, true, (swappedRead.issues[0] || {}).message);
  assert.deepEqual(swappedRead.categories.map(function (entry) { return entry.categoryId; }).slice(0, 2), ['valve', 'pump']);
  assert.deepEqual(swappedRead.categories.filter(function (entry) { return entry.categoryId === 'pump'; })[0].groups,
    [{ brand: '青源', supplier: '华川设备' }, { brand: '恒流', supplier: '启明机电' }]);
  // 复制行/删行。
  const valveRow = binding.firstRow + 1, valveIndex = valveRow - 1;
  const copied = base.map(function (row) { return row.slice(); });
  copied.splice(valveIndex, 0, copied[binding.firstRow - 1].slice());
  assert.equal(brandModel.parseSummary(copied, binding).issues[0].code, 'category-duplicate');
  const deleted = base.map(function (row) { return row.slice(); });
  deleted.splice(valveIndex, 1);
  assert.match(brandModel.parseSummary(deleted, binding).issues.map(function (item) { return item.message; }).join('；'), /缺少类别“阀门”/);
  // 改名称/条数定位到具体单元格。
  const renamed = base.map(function (row) { return row.slice(); });
  renamed[valveIndex][1] = '阀门（改）';
  const renamedRead = brandModel.parseSummary(renamed, binding);
  assert.equal(renamedRead.issues[0].code, 'name-changed');
  assert.equal(renamedRead.issues[0].cell, 'B' + valveRow);
  const recounted = base.map(function (row) { return row.slice(); });
  recounted[valveIndex][2] = '9';
  const recountedRead = brandModel.parseSummary(recounted, binding);
  assert.equal(recountedRead.issues[0].code, 'count-changed');
  assert.equal(recountedRead.issues[0].cell, 'C' + valveRow);

  // 只改格式（字体/列宽等）不改业务值：按rowId比较仍判为一致，不误判业务变化。
  const snapshot = { rows: chain.summaryRead.categories.map(function (entry) {
    return { rowId: entry.categoryId, name: entry.categoryName, feature: '', unit: '', quantity: String(entry.rowCount),
      categoryId: entry.categoryId, categoryName: entry.categoryName, note: '' };
  }) };
  const formatted = { rows: snapshot.rows.map(function (row) {
    return Object.assign({}, row, { font: { bold: true }, columnWidth: 42, fill: 'FFF2CC' });
  }), issues: [] };
  assert.equal(reviewHost.compareSnapshot(formatted, snapshot).matches, true, '只改格式不得判为业务不一致');
  // 品牌/供应商/方式/抬头变动：询价与拆分业务键必须改变；审核/分类键不受影响。
  const keyOf = function (stage, brands, header) {
    return project.contentKey({ stage: stage, collection: flow.col, mergeIdentical: false, groups: flow.groups,
      review: flow.decisions, brands: brands, header: header });
  };
  const brandsA = chain.summaryRead.categories;
  const brandsB = brandsA.map(function (entry, index) {
    return index ? entry : Object.assign({}, entry, { mode: '合成一份' });
  });
  assert.notEqual(keyOf('inquiry', brandsA, HEADER), keyOf('inquiry', brandsB, HEADER), '方式变动必须让旧询价过期');
  assert.notEqual(keyOf('split', brandsA, HEADER), keyOf('split', brandsB, HEADER), '方式变动必须让旧拆分过期');
  assert.equal(keyOf('review', brandsA, HEADER), keyOf('review', brandsB, HEADER), '品牌变动不得改变已完成的人工分类');
  const headerB = Object.assign({}, HEADER, { phone: '另一个联系方式' });
  assert.notEqual(keyOf('inquiry', brandsA, HEADER), keyOf('inquiry', brandsA, headerB), '抬头变动必须让旧询价过期');
  assert.equal(keyOf('inquiry', brandsA, HEADER), keyOf('inquiry', JSON.parse(JSON.stringify(brandsA)), HEADER),
    '相同业务内容（含仅格式变化）不得改变业务键');
  // 生成键过期时拆分必须阻断，不得把旧总簿当当前内容。
  const stale = splitPlan.build({ model: chain.inquiry, targetDirectory: ROOT + '\\询价输出',
    generation: { inputKey: 'ck2-old', sha256: 'a'.repeat(64), target: ROOT + '\\旧.xlsx' }, currentKey: INPUT_KEY });
  assert.equal(stale.canPublish, false);
  assert.match(stale.conflicts.map(function (item) { return item.code; }).join('；'), /generation-stale|current-key-stale/);
});

test('R12-I版本边界：v1继续为新v2副本且原文件不变、需重新确认；未知/损坏拒绝；库更新不改已确认类别', () => {
  const legacy = { schemaVersion: 1, projectId: 'p-r12i-legacy01', name: '旧项目', revision: 3, mergeIdentical: false,
    stages: { import: { state: 'ready' }, review: { state: 'ready' }, merge: { state: 'ready' },
      classification: { state: 'ready' }, brand: { state: 'ready' }, generation: { state: 'ready' }, split: { state: 'ready' } },
    sources: [{ id: 'C:\\s\\a.xlsx', originalPath: 'C:\\s\\a.xlsx', originalName: 'a.xlsx',
      copyPath: 'C:\\s\\c\\a.xlsx', fingerprint: 'a'.repeat(64) }],
    mergeKey: 'm1', classification: { schemaVersion: 1, decisions: [] } };
  const before = JSON.stringify(legacy);
  const upgraded = project.upgradeV1(legacy, { projectId: 'p-r12i-upgraded01' });
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.fromProjectId, legacy.projectId, '新副本必须记录上游v1项目编号');
  assert.equal(JSON.stringify(legacy), before, 'v1原记录（及其文件）不得被改写');
  assert.equal(project.validate(upgraded).ok, true);
  ['review', 'categories', 'brands', 'inquiry', 'split'].forEach(function (stage) {
    assert.equal(project.stageState(upgraded, stage), 'missing', stage + '必须重新确认/重做');
  });
  assert.equal(project.isLegacy(legacy), true);
  assert.match(project.validate({ schemaVersion: 9 }).errors.join('；'), /版本/);
  assert.equal(project.validate({ schemaVersion: 2 }).ok, false, '残缺v2必须拒绝');
  assert.equal(project.validate('{"broken"').ok, false, '损坏JSON必须拒绝');

  // 库更新只改变“建议”，不得静默改动已确认的人工分类：confirmed rows 复算审核键不变。
  const flow = confirmedFlow(false);
  const updatedLibrary = JSON.parse(JSON.stringify(sample.library));
  updatedLibrary.version = 'fixture-workflow-v3-updated';
  updatedLibrary.rules = updatedLibrary.rules.filter(function (rule) { return rule.id !== 'fixture-steel-cable-skip'; });
  const beforeKey = project.contentKey({ stage: 'review', collection: flow.col, mergeIdentical: false,
    groups: flow.groups, review: flow.decisions });
  const afterKey = project.contentKey({ stage: 'review', collection: flow.col, mergeIdentical: false,
    groups: flow.groups, review: flow.decisions });
  assert.equal(beforeKey, afterKey, '库更新不得改变已确认分类的审核业务键');
  const rebuiltSuggestions = review.build(flow.groups, { library: updatedLibrary, projectId: 'p-r12i-flow' });
  assert.notEqual(rebuiltSuggestions.libraryVersion, flow.built.libraryVersion, '库版本变化应反映在新建议里');
  const restored = review.fromSnapshot(flow.confirmation, flow.binding, { categories: flow.categories });
  assert.deepEqual(restored.rows.map(function (row) { return [row.rowId, row.finalCategoryId]; }),
    flow.confirmation.rows.map(function (row) { return [row.rowId, row.categoryId]; }),
    '按确认快照重建时必须保留人工已确认的类别');
  assert.equal(rebuiltSuggestions.rows.length, flow.built.rows.length);
});
