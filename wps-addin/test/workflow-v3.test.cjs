// R1：项目v2（7阶段、失效传播、业务键、v1继续副本）与合成夹具。
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const sample = require('./fixtures/workflow-v3-sample.cjs');
const collection = require('../src/collection.js');
const project = require('../src/project.js');
const { createProjectStore } = require('../dev/project-store.cjs');
const { createServer } = require('../dev/server.cjs');

const STAGES = ['import', 'matching', 'review', 'categories', 'brands', 'inquiry', 'split'];

function newId(seed) { return 'p-' + seed.repeat(8); }

function mergeInput(mergeIdentical) {
  const col = sample.buildCollection();
  const preview = collection.preview(col, mergeIdentical === true);
  const groups = project.rowsFromPreview(preview);
  return { collection: col, mergeIdentical: mergeIdentical === true, preview: preview, groups: groups,
    mergeConfirmedKey: project.contentKey({ collection: col, mergeIdentical: mergeIdentical === true, groups: groups }) };
}

function readyVerdicts() {
  return { matching: { ready: true, detail: '自动匹配完成' }, review: { ready: true, detail: '整表已确认' },
    categories: { ready: true, detail: '分类工作簿已生成' }, brands: { ready: true, detail: '品牌供应商已填' },
    inquiry: { ready: true, detail: '询价表已生成' }, split: { ready: true, detail: '拆分完成' } };
}

test('合成夹具满足7阶段验收口径：10行输入、合并8行、7询价＋1无需询价、1行冲突', () => {
  assert.deepEqual(sample.validateLibrary(), { ok: true, errors: [] }, '隔离分类库本身必须有效');
  const col = sample.buildCollection();
  assert.equal(col.entries.length, 2);
  assert.deepEqual(col.entries.map(function (entry) { return entry.parsed.materials.length; }), [5, 5],
    '两份清单各5行，合计10行');
  assert.deepEqual(col.entries.map(function (entry) { return entry.parsed.issues.length; }), [0, 0],
    '合成夹具不得依赖人工核对问题，来源必须干净');
  const preview = collection.preview(col, true);
  assert.equal(preview.inputCount, 10);
  assert.equal(preview.groups.length, sample.expectations.merged.rows);
  assert.equal(preview.canFinalize, true);
  const rows = sample.expectedRows(true);
  assert.deepEqual(rows.map(function (row) { return sample.keyOf(row.name, row.feature, row.unit); }), sample.expectations.order,
    '稳定行序必须与图中顺序一致');
  const byKey = {};
  rows.forEach(function (row) { byKey[sample.keyOf(row.name, row.feature, row.unit)] = row; });
  assert.equal(byKey[sample.keyOf('水泵', 'DN50', '台')].quantity, '2');
  assert.equal(byKey[sample.keyOf('水泵', 'DN65', '台')].quantity, '3');
  assert.equal(byKey[sample.keyOf('阀门', 'DN50', '个')].quantity, '20');
  assert.equal(byKey[sample.keyOf('阀门', 'DN65', '个')].quantity, '12');
  assert.equal(byKey[sample.keyOf('钢索', '规格C', 'm')].quantity, '10');
  const classify = require('../src/classify.js');
  let suggested = 0, conflicts = 0;
  preview.groups.forEach(function (group) {
    const result = classify.suggest(group, sample.library, { memory: sample.createMemory(), projectId: newId('c') });
    if (result.conflicts.length) conflicts++; else if (result.candidates.length) suggested++;
  });
  assert.equal(suggested, 7, '7行应有唯一建议');
  assert.equal(conflicts, 1, '充电桩配电箱必须有1行建议冲突');
});

test('v2项目使用7阶段，并按真实内容判定每个阶段', () => {
  assert.equal(project.SCHEMA_VERSION, 2);
  assert.deepEqual(project.STAGES, STAGES);
  assert.equal(sample.buildCollection().entries.length, 2);
  const col = sample.buildCollection();
  const created = project.create(col, true, { projectId: newId('a') });
  assert.equal(created.schemaVersion, 2);
  assert.equal(created.revision, 0, '新建项目revision必须从0开始');
  assert.equal(created.fromProjectId, null);
  STAGES.forEach(function (stage) { assert.equal(project.stageState(created, stage), 'missing', stage); });
  assert.equal(project.validate(created).ok, true, '空未来字段必须允许保存');

  const bare = project.assess(mergeInput(true));
  assert.equal(bare.import.ready, true, '来源清零且确认键一致时导入与合并完成');
  assert.equal(bare.matching.ready, false, '未产出自动分类建议前不得算完成');
  const partial = project.sync(created, bare);
  assert.equal(project.stageState(partial, 'import'), 'ready');
  STAGES.slice(1).forEach(function (stage) { assert.equal(project.stageState(partial, stage), 'missing', stage); });

  const withMatching = project.assess(Object.assign(mergeInput(true), { matching: { ready: true, detail: '自动匹配完成' } }));
  assert.equal(withMatching.matching.ready, true);
  assert.equal(withMatching.review.ready, false, '自动建议不等于人工整表确认');
  const withReview = project.assess(Object.assign(mergeInput(true), readyVerdicts()));
  STAGES.forEach(function (stage) { assert.equal(withReview[stage].ready, true, stage); });

  const allReady = project.sync(created, withReview);
  STAGES.forEach(function (stage) { assert.equal(project.stageState(allReady, stage), 'ready', stage); });
  assert.equal(project.validate(allReady).ok, true);
});

test('阶段失效按7层逐级传播：上游重做、下游过期、未完成保持未完成', () => {
  const col = sample.buildCollection();
  const allReady = project.sync(project.create(col, true, { projectId: newId('b') }),
    project.assess(Object.assign(mergeInput(true), readyVerdicts())));
  function states(record) { return STAGES.map(function (stage) { return project.stageState(record, stage); }); }

  const sourceChanged = project.invalidateStage(allReady, 'import', '来源变化');
  assert.deepEqual(states(sourceChanged), ['missing', 'stale', 'stale', 'stale', 'stale', 'stale', 'stale']);

  const merged = project.invalidate(allReady, { kind: 'merge', detail: '改为分别保留' });
  assert.deepEqual(states(merged), ['missing', 'stale', 'stale', 'stale', 'stale', 'stale', 'stale']);

  const rematched = project.invalidateStage(allReady, 'matching', '材料字段变化');
  assert.deepEqual(states(rematched), ['ready', 'missing', 'stale', 'stale', 'stale', 'stale', 'stale']);

  const reclassified = project.invalidateStage(allReady, 'review', '最终分类变动');
  assert.deepEqual(states(reclassified), ['ready', 'ready', 'missing', 'stale', 'stale', 'stale', 'stale'],
    '最终分类变动使分类工作簿及之后失效');

  const rebranded = project.invalidateStage(allReady, 'brands', '品牌供应商变动');
  assert.deepEqual(states(rebranded), ['ready', 'ready', 'ready', 'ready', 'missing', 'stale', 'stale']);

  const reheadered = project.invalidate(allReady, { kind: 'header', detail: '抬头变动' });
  assert.deepEqual(states(reheadered), ['ready', 'ready', 'ready', 'ready', 'ready', 'missing', 'stale'],
    '抬头变动只使询价与拆分失效');

  const fresh = project.invalidateStage(project.create(col, true, { projectId: newId('d') }), 'brands');
  assert.equal(project.stageState(fresh, 'brands'), 'missing');
  assert.equal(project.stageState(fresh, 'inquiry'), 'missing', '从未确认的阶段保持未完成，不伪造过期');
  assert.equal(project.stageState(allReady, 'review'), 'ready', '原对象不得被改动');
  assert.throws(function () { project.invalidateStage(allReady, 'nope'); }, /无法识别/);
});

test('业务键覆盖影响输出的字段，并忽略表内排序与界面字段', () => {
  const col = sample.buildCollection();
  const preview = collection.preview(col, true), groups = project.rowsFromPreview(preview);
  const key = project.contentKey({ collection: col, mergeIdentical: true, groups: groups });
  assert.match(key, /^ck2-[0-9a-f]{16}$/);
  assert.equal(project.contentKey({ collection: col, mergeIdentical: true, groups: groups.slice().reverse() }), key,
    '成果表内排序不得改变业务键');
  assert.equal(project.contentKey({ collection: col, mergeIdentical: true, groups: groups,
    filter: 'pending', updatedAt: '2026-09-26T00:00:00.000Z' }), key, '界面筛选与时间不得改变业务键');
  assert.notEqual(project.contentKey({ collection: col, mergeIdentical: false, groups: groups }), key, '合并方式影响输出');
  const edited = groups.map(function (row, index) { return index ? row : Object.assign({}, row, { quantity: '999' }); });
  assert.notEqual(project.contentKey({ collection: col, mergeIdentical: true, groups: edited }), key,
    '材料工程量属于影响输出的业务字段');
  const renamed = groups.map(function (row, index) { return index ? row : Object.assign({}, row, { feature: 'DN999' }); });
  assert.notEqual(project.contentKey({ collection: col, mergeIdentical: true, groups: renamed }), key, '项目特征影响输出');

  const review = { rows: groups.map(function (row) {
    return { rowId: row.rowId, categoryId: 'pump', categoryName: '水泵', skip: false, note: '' }; }) };
  const brands = [{ categoryId: 'pump', mode: 'separate-brands',
    groups: [{ brand: '青源', supplier: '华川设备' }] }];
  const header = { projectName: '示例园区', company: '示例建设公司' };
  const inquiryKey = project.contentKey({ stage: 'inquiry', collection: col, mergeIdentical: true, groups: groups,
    review: review, brands: brands, header: header });
  assert.equal(inquiryKey, project.contentKey({ stage: 'inquiry', collection: col, mergeIdentical: true,
    groups: groups.slice().reverse(), review: { rows: review.rows.slice().reverse() }, brands: brands, header: header }),
    '读回顺序不得改变询价键');
  assert.notEqual(project.contentKey({ stage: 'inquiry', collection: col, mergeIdentical: true, groups: groups,
    review: review, brands: [{ categoryId: 'pump', mode: 'combined',
      groups: [{ brand: '青源', supplier: '华川设备' }, { brand: '恒流', supplier: '启明机电' }] }], header: header }),
    inquiryKey, '品牌组合与生成方式影响询价输出');
  assert.notEqual(project.contentKey({ stage: 'inquiry', collection: col, mergeIdentical: true, groups: groups,
    review: review, brands: brands, header: Object.assign({}, header, { contact: '测试员' }) }), inquiryKey,
    '抬头影响询价输出');
  assert.equal(project.contentKey({ stage: 'brands', collection: col, mergeIdentical: true, groups: groups,
    review: review, brands: brands }), project.contentKey({ stage: 'brands', collection: col, mergeIdentical: true,
    groups: groups, review: review }), '品牌阶段的上游键不含品牌本身');
});

test('R8：品牌组进入询价/拆分业务键但不进入品牌阶段键，改品牌只让询价及之后失效', () => {
  const col = sample.buildCollection(), input = mergeInput(true);
  const rows = project.rowsFromPreview(input.preview).map(function (row) {
    return { rowId: row.rowId, categoryId: 'pump', categoryName: '水泵', skip: false, note: '' }; });
  const header = { projectName: '示例园区', company: '示例建设公司', contact: '测试员', phone: '010-12345678' };
  const brands = [{ categoryId: 'pump', mode: 'per-brand',
    groups: [{ brand: '青源', supplier: '华川设备' }, { brand: '恒流', supplier: '启明机电' }] },
   { categoryId: 'valve', mode: 'synthesize',
    groups: [{ brand: '通达', supplier: '正通商贸' }, { brand: '海岳', supplier: '安合设备' }] }];
  const first = project.assess(Object.assign({}, input, { review: { ready: true, rows: rows },
    brands: { ready: true, rows: brands }, header: header }));
  const changed = brands.map(function (entry, index) {
    return index ? entry : Object.assign({}, entry, { groups: [entry.groups[0], { brand: '启明机电', supplier: '启明机电' }] }); });
  const second = project.assess(Object.assign({}, input, { review: { ready: true, rows: rows },
    brands: { ready: true, rows: changed }, header: header }));
  assert.equal(first.brandsKey, second.brandsKey, '品牌阶段键只含上游审核，不含品牌本身');
  assert.notEqual(first.inquiryKey, second.inquiryKey, '改品牌必须改变询价键');
  assert.notEqual(first.splitKey, second.splitKey, '改品牌必须使拆分失效');
  const modeChanged = brands.map(function (entry, index) {
    return index ? entry : Object.assign({}, entry, { mode: 'synthesize' }); });
  const third = project.assess(Object.assign({}, input, { review: { ready: true, rows: rows },
    brands: { ready: true, rows: modeChanged }, header: header }));
  assert.notEqual(first.inquiryKey, third.inquiryKey, '改询价生成方式同样改变询价输出');
  // 读回顺序稳定后不改变内容键：与材料行、审核行一样按稳定字段规范化。
  const reordered = project.assess(Object.assign({}, input, { review: { ready: true, rows: rows.slice().reverse() },
    brands: { ready: true, rows: brands.slice().reverse() }, header: header }));
  assert.equal(first.inquiryKey, reordered.inquiryKey, '读回顺序不得改变询价键');
  // 品牌变化只让询价及之后失效，品牌阶段本身仍完成。
  const ready = project.sync(project.create(col, true, { projectId: newId('i') }),
    project.assess(Object.assign({}, input, readyVerdicts())));
  const invalidated = project.invalidateStage(ready, 'brands');
  assert.deepEqual(STAGES.map(function (stage) { return project.stageState(invalidated, stage); }),
    ['ready', 'ready', 'ready', 'ready', 'missing', 'stale', 'stale']);
});
test('v1项目保留原文件；继续时新建v2副本并记录fromProjectId', () => {
  const legacy = legacyV1Record();
  const legacyText = JSON.stringify(legacy);
  const upgraded = project.upgradeV1(legacy, { projectId: newId('e') });
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.projectId, newId('e'));
  assert.equal(upgraded.fromProjectId, legacy.projectId);
  assert.equal(upgraded.name, legacy.name);
  assert.equal(upgraded.revision, 0);
  assert.equal(upgraded.sources.length, legacy.sources.length, '来源数量可验证复用');
  upgraded.sources.forEach(function (source, index) {
    const before = legacy.sources[index];
    ['id', 'originalPath', 'originalName', 'copyPath', 'fingerprint'].forEach(function (field) {
      assert.equal(source[field], before[field], '来源字段必须按原值复用：' + field);
    });
    assert.equal(source.scopeId, 'combined', 'v2来源必须带来源边界scopeId');
  });
  assert.equal(upgraded.mergeIdentical, legacy.mergeIdentical);
  assert.equal(project.validate(upgraded).ok, true);
  STAGES.forEach(function (stage) { assert.equal(project.stageState(upgraded, stage), 'missing', stage); });
  assert.equal(upgraded.brands, null, '旧品牌及下游不算新流程完成');
  assert.equal(upgraded.inquiry, null);
  assert.equal(upgraded.split, null);
  assert.ok(upgraded.carried && upgraded.carried.classification, '分类草稿只作为可复用参考保留');
  assert.equal(JSON.stringify(legacy), legacyText, '升级不得改动v1原记录');
  assert.equal(project.isLegacy(legacy), true);
  assert.equal(project.isLegacy(upgraded), false);
});

test('版本校验接受v1与v2并明确拒绝未知版本或残缺v2记录', () => {
  const col = sample.buildCollection();
  const good = project.create(col, false, { projectId: newId('f') });
  assert.equal(project.validate(good).ok, true);
  assert.equal(project.validate(legacyV1Record()).ok, true, 'v1记录仍可读取，不能直接判损坏');
  assert.match(project.validate(Object.assign({}, good, { schemaVersion: 99 })).errors.join('；'), /版本/);
  assert.match(project.validate(Object.assign({}, good, { schemaVersion: null })).errors.join('；'), /版本/);
  const missingStage = JSON.parse(JSON.stringify(good));
  delete missingStage.stages.split;
  assert.match(project.validate(missingStage).errors.join('；'), /阶段/);
  const legacyStages = JSON.parse(JSON.stringify(good));
  legacyStages.stages = { import: { state: 'ready' }, matching: { state: 'ready' }, review: { state: 'missing' },
    categories: { state: 'missing' }, brands: { state: 'missing' }, inquiry: { state: 'missing' } };
  assert.match(project.validate(legacyStages).errors.join('；'), /阶段/, '缺少split阶段必须判为残缺');
  assert.throws(function () { project.assertValid({}); }, /项目记录/);
});

test('项目库用expectedRevision做乐观锁：初始0、成功递增、冲突保留草稿', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rfq-workflow-v3-'));
  t.after(function () { return fs.rm(root, { recursive: true, force: true }); });
  const store = createProjectStore({ directory: path.join(root, 'projects') });
  const created = project.create(sample.buildCollection(), true, { projectId: newId('g') });
  const file = path.join(store.directory, created.projectId + '.json');

  const first = await store.save(created, { expectedRevision: 0 });
  assert.equal(first.revision, 1);
  const loaded = await store.load(created.projectId);
  assert.equal(loaded.revision, 1);
  assert.equal(loaded.schemaVersion, 2);
  const before = await fs.readFile(file, 'utf8');

  await assert.rejects(store.save(created, { expectedRevision: 0 }),
    function (error) { return error.code === 'REVISION_CONFLICT'; }, '旧版本号写入必须409且保留草稿');
  assert.equal(await fs.readFile(file, 'utf8'), before, '冲突时磁盘内容不得被覆盖');

  const second = await store.save(Object.assign({}, loaded, { updatedAt: '2026-09-26T01:00:00.000Z' }),
    { expectedRevision: 1 });
  assert.equal(second.revision, 2, '按当前版本号重试必须成功，可续作');
  await assert.rejects(store.save(created, {}), /版本号/, '缺少expectedRevision必须拒绝');
  await assert.rejects(store.save(Object.assign({}, created, { schemaVersion: 99 }), { expectedRevision: 2 }), /版本/);
  assert.equal((await store.load(created.projectId)).revision, 2, '非法保存不得破坏已存记录');

  const listed = await store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].schemaVersion, 2);
  assert.equal(listed[0].revision, 2);
  await fs.writeFile(file, '{"broken"');
  await assert.rejects(store.load(created.projectId), /损坏/);
  assert.ok(await fs.stat(file), '损坏记录必须留在磁盘上待人工处理');
  assert.deepEqual((await fs.readdir(store.directory)).filter(function (name) { return name.includes('tmp'); }), []);
});

test('项目保存接口在版本冲突时返回409，而不是静默覆盖', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'rfq-workflow-v3-api-'));
  const server = createServer({ root: path.resolve(__dirname, '..'),
    importDirectory: path.join(folder, 'private'), projectDirectory: path.join(folder, 'projects') });
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  t.after(async function () {
    await new Promise(function (resolve) { server.close(resolve); });
    await fs.rm(folder, { recursive: true, force: true });
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const html = await (await fetch(origin + '/taskpane.html')).text();
  const token = JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
  const headers = { 'content-type': 'application/json', 'x-rfq-import-token': token };
  const created = project.create(sample.buildCollection(), true, { projectId: newId('h') });
  const save = function (expectedRevision) {
    return fetch(origin + '/api/project/save', { method: 'POST', headers: headers,
      body: JSON.stringify({ project: created, expectedRevision: expectedRevision }) });
  };
  assert.equal((await save(0)).status, 200);
  const conflict = await save(0);
  assert.equal(conflict.status, 409);
  assert.match((await conflict.json()).error, /版本|冲突/);
  const stored = await (await fetch(origin + '/api/project/load', { method: 'POST', headers: headers,
    body: JSON.stringify({ projectId: created.projectId }) })).json();
  assert.equal(stored.project.revision, 1, '冲突后仍读到成功写入的那一版');
  assert.equal((await save(1)).status, 200, '带上最新版本号即可继续保存');
});

function legacyV1Record() {
  const col = sample.buildCollection();
  const sources = col.entries.map(function (entry) {
    return { id: entry.id, originalPath: entry.metadata.originalPath, originalName: entry.metadata.originalName,
      copyPath: entry.metadata.copyPath, fingerprint: entry.metadata.fingerprint,
      sheetCount: entry.snapshot.sheets.length, materialCount: entry.parsed.materials.length, issueCount: 0,
      snapshot: entry.snapshot };
  });
  const stages = {};
  ['import', 'review', 'merge', 'classification', 'brand', 'generation', 'split'].forEach(function (stage, index) {
    stages[stage] = { state: index === 0 ? 'ready' : 'missing', revision: index === 0 ? 1 : null,
      updatedAt: index === 0 ? '2026-09-25T00:00:00.000Z' : null, detail: null };
  });
  return { schemaVersion: 1, projectId: newId('v'), name: '示例园区', createdAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z', revision: 1, mergeIdentical: true, stages: stages, sources: sources,
    mergeKey: 'ck1-0123456789abcdef', review: null,
    classification: { schemaVersion: 1, revision: 1, decisions: [{ rowId: 'r1', categoryId: 'pump', categoryName: '水泵' }] },
    assignments: { schemaVersion: 1, coverageMode: 'alternative-quotes', assignments: [] },
    header: null, generation: null, split: null, history: [] };
}
