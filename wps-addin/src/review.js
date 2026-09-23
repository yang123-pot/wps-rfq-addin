(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./parser.js'));
  else root.RfqReview = factory(root.RfqParser);
}(typeof window === 'object' ? window : globalThis, function (parser) {
  'use strict';
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function key(sheet, row) { return JSON.stringify([sheet, row]); }
  function signature(snapshot) { return JSON.stringify(snapshot); }
  function create(snapshot) {
    parser.parseWorkbook(snapshot);
    return { version: 1, snapshot: signature(snapshot), decisions: [] };
  }
  function assertRecord(snapshot, record) {
    if (!record || record.version !== 1 || !Array.isArray(record.decisions)) throw new Error('核对记录版本不支持或已损坏。');
    if (record.snapshot !== signature(snapshot)) throw new Error('工作簿路径或内容已变化，与核对记录不一致；请重新核对。');
  }
  function apply(snapshot, record) {
    assertRecord(snapshot, record);
    var original = parser.parseWorkbook(snapshot), working = clone(snapshot);
    var decisions = new Map(), materialDecisions = new Map();
    record.decisions.forEach(function (d) {
      if (!d || typeof d.sheet !== 'string' || !Number.isSafeInteger(d.row) || d.row < 1) throw new Error('核对行位置无效。');
      var id = key(d.sheet, d.row);
      if (decisions.has(id)) throw new Error('同一来源行存在重复核对记录。');
      decisions.set(id, d);
      var sheet = working.sheets.find(function (s) { return s.name === d.sheet; });
      var summary = original.sheets.find(function (s) { return s.name === d.sheet; });
      if (!sheet || d.row < sheet.startRow || d.row >= sheet.startRow + sheet.rowCount) throw new Error('核对工作表或行不存在。');
      var issues = original.issues.filter(function (i) { return i.sheet === d.sheet && i.row === d.row; });
      var ambiguous = issues.some(function (i) { return i.code === 'section-ambiguous'; });
      var unrecognized = issues.some(function (i) { return i.code === 'row-unrecognized'; });
      if (d.kind === 'section') {
        if (!ambiguous) throw new Error('此行不支持区段核对。');
      } else if (d.kind === 'nonmaterial') {
        if (!unrecognized) throw new Error('此行不支持非材料核对，请回原表修复。');
        if (typeof d.reason !== 'string' || !d.reason.trim()) throw new Error('请填写非材料行的核对理由。');
        // Explicit exclusions must not become feature continuations after a nearby promotion.
        sheet.values[d.row - sheet.startRow] = sheet.values[d.row - sheet.startRow].map(function () { return ''; });
      } else if (d.kind === 'material') {
        var oldMaterial = original.materials.find(function (m) { return m.source.sheet === d.sheet && m.source.row === d.row; });
        if (!oldMaterial && !ambiguous && !unrecognized) throw new Error('此行不支持材料核对。');
        ['code', 'name', 'unit', 'quantity', 'engineering', 'profession'].forEach(function (field) {
          if (typeof d[field] !== 'string') throw new Error('核对字段必须为文本。');
        });
        if (!d.name.trim()) throw new Error('项目名称不能为空。');
        if (!d.unit.trim()) throw new Error('单位不能为空。');
        if (!d.engineering.trim() || !d.profession.trim()) throw new Error('工程与专业来源不能为空。');
        if (!d.code.trim() && oldMaterial && oldMaterial.code.trim()) throw new Error('原清单已有编码，请核对并填写，不能确认为无编码。');
        if (!d.code.trim() && d.allowMissingCode !== true) throw new Error('请补充编码，或明确确认原清单无编码。');
        if (issues.some(function (i) { return i.code === 'code-display-unverified'; }) && d.codeDisplayConfirmed !== true) {
          throw new Error('数值编码须按原表显示手动输入，并确认显示格式及前导零。');
        }
        var headers = summary.headers.filter(function (h) { return h.row < d.row; });
        var header = headers[headers.length - 1];
        if (!header) throw new Error('此行缺少有效表头，请回原表修复后重新核对。');
        var cells = sheet.values[d.row - sheet.startRow];
        ['code', 'name', 'unit', 'quantity'].forEach(function (field) { cells[header.columns[field] - sheet.startColumn] = d[field]; });
        materialDecisions.set(id, d);
      } else if (d.kind !== 'continuation') throw new Error('未知核对类型。');
    });
    var result = parser.parseWorkbook(working), materials = new Map(), continuations = new Map();
    result.materials.forEach(function (m) {
      var id = key(m.source.sheet, m.source.row), d = materialDecisions.get(id);
      materials.set(id, m);
      var old = original.materials.find(function (item) { return item.id === m.id; });
      var sheet = snapshot.sheets.find(function (s) { return s.name === m.source.sheet; });
      var headers = original.sheets.find(function (s) { return s.name === m.source.sheet; }).headers.filter(function (h) { return h.row < m.source.row; });
      var header = headers[headers.length - 1];
      var cells = sheet.values[m.source.row - sheet.startRow];
      var rawQuantity = cells[header.columns.quantity - sheet.startColumn];
      m.quantityRaw = rawQuantity == null ? '' : rawQuantity;
      if (d) {
        if (m.quantity === null) throw new Error('工程量必须是有效的非负十进制数。');
        m.source.engineering = d.engineering; m.source.profession = d.profession;
        m.source.professionBasis = 'user-confirmed';
      }
      m.review = { original: old ? { code: old.code, name: old.name, unit: old.unit, quantityRaw: old.quantityRaw,
        engineering: old.source.engineering, profession: old.source.profession, professionBasis: old.source.professionBasis,
        codeWasNumeric: old.issueCodes.indexOf('code-display-unverified') >= 0 } :
        { code: String(cells[header.columns.code - sheet.startColumn] || ''), name: String(cells[header.columns.name - sheet.startColumn] || ''),
          unit: String(cells[header.columns.unit - sheet.startColumn] || ''), quantityRaw: m.quantityRaw },
        decision: d ? clone(d) : null, continuations: [] };
      m.featureParts.slice(1).forEach(function (part) {
        continuations.set(key(m.source.sheet, part.row), { owner: m, part: part });
      });
      m.featureParts = m.featureParts.slice(0, 1);
      m.issueCodes = m.issueCodes.filter(function (code) { return code !== 'feature-continuation'; });
    });
    materialDecisions.forEach(function (_, id) { if (!materials.has(id)) throw new Error('修正行未能识别为材料，请核对表头和材料字段。'); });
    decisions.forEach(function (d, id) {
      if (d.kind === 'continuation' && (!continuations.has(id) || !Number.isSafeInteger(d.targetRow) ||
          !materials.has(key(d.sheet, d.targetRow)))) throw new Error('续行归属必须是同一工作表中的有效材料行。');
    });
    result.issues = result.issues.filter(function (i) {
      var d = decisions.get(key(i.sheet, i.row));
      if (i.code === 'feature-continuation') return false;
      if (!d) return true;
      if (d.kind === 'section') return i.code !== 'section-ambiguous';
      if (d.kind === 'nonmaterial') return i.code !== 'row-unrecognized';
      if (d.kind === 'material') return ['source-inferred', 'source-unresolved'].indexOf(i.code) < 0 &&
        !(i.code === 'code-missing' && d.allowMissingCode === true);
      return true;
    });
    continuations.forEach(function (c, id) {
      var d = decisions.get(id);
      if (d && d.kind !== 'continuation') throw new Error('此行的核对类型与续行识别冲突，请撤销后重新核对。');
      var owner = d ? materials.get(key(d.sheet, d.targetRow)) : c.owner;
      owner.featureParts.push(clone(c.part));
      owner.review.continuations.push({ row: c.part.row, originalOwnerRow: c.owner.source.row, targetRow: owner.source.row, confirmed: !!d });
      if (!d && owner.issueCodes.indexOf('feature-continuation') < 0) {
        owner.issueCodes.push('feature-continuation');
        result.issues.push({ sheet: owner.source.sheet, row: owner.source.row, column: owner.source.column,
          code: 'feature-continuation', severity: 'review', message: '项目特征含续行，请逐行确认归属。' });
      }
    });
    result.materials.forEach(function (m) {
      m.featureParts = m.featureParts.slice(0, 1).concat(m.featureParts.slice(1).sort(function (a, b) { return a.row - b.row; }));
      m.feature = m.featureParts.map(function (p) { return p.text; }).join('\n');
      m.source.rows = m.featureParts.map(function (p) { return p.row; });
      m.issueCodes = result.issues.filter(function (i) { return i.sheet === m.source.sheet && i.row === m.source.row; }).map(function (i) { return i.code; });
    });
    result.reviewDecisions = clone(record.decisions);
    return result;
  }
  function setDecision(snapshot, record, decision) {
    assertRecord(snapshot, record);
    var next = clone(record);
    next.decisions = next.decisions.filter(function (d) { return key(d.sheet, d.row) !== key(decision.sheet, decision.row); });
    next.decisions.push(clone(decision));
    apply(snapshot, next);
    return next;
  }
  function removeDecision(snapshot, record, sheet, row) {
    assertRecord(snapshot, record);
    var next = clone(record);
    next.decisions = next.decisions.filter(function (d) {
      return !(d.sheet === sheet && (d.row === row || (d.kind === 'continuation' && d.targetRow === row)));
    });
    // A promoted material may have created new continuations, even ones later moved elsewhere.
    var base = {version:next.version,snapshot:next.snapshot,decisions:next.decisions.filter(function (d) { return d.kind !== 'continuation'; })};
    var reparsed = apply(snapshot, base), available = new Set(), targets = new Set();
    reparsed.materials.forEach(function (m) {
      targets.add(key(m.source.sheet, m.source.row));
      m.featureParts.slice(1).forEach(function (p) { available.add(key(m.source.sheet, p.row)); });
    });
    next.decisions = next.decisions.filter(function (d) {
      return d.kind !== 'continuation' || (available.has(key(d.sheet, d.row)) && targets.has(key(d.sheet, d.targetRow)));
    });
    apply(snapshot, next);
    return next;
  }
  function storageKey(snapshot) {
    if (!/^(?:[a-z]:[\\/]|\\\\)/i.test(snapshot.path || '')) throw new Error('请先在WPS中保存工作簿，再保存核对记录。');
    var prefix = snapshot.fingerprint == null ? 'rfq-source-review-v1:' : 'rfq-import-review-v1:';
    return prefix + snapshot.path.replace(/[\\/]+/g, '/').toLowerCase();
  }
  function save(storage, snapshot, record) {
    apply(snapshot, record);
    var id = storageKey(snapshot);
    try { storage.setItem(id, JSON.stringify(record)); }
    catch (_) { throw new Error('本机核对记录保存失败（存储不可用或容量不足），本次修改仍在页面中，请勿关闭。'); }
  }
  function load(storage, snapshot) {
    var raw;
    try { raw = storage.getItem(storageKey(snapshot)); }
    catch (e) { throw new Error('无法读取本机核对记录：' + e.message); }
    if (raw === null) return null;
    var record;
    try { record = JSON.parse(raw); } catch (_) { throw new Error('本机核对记录已损坏，未恢复任何修改。'); }
    apply(snapshot, record);
    return record;
  }
  return { create: create, apply: apply, setDecision: setDecision, removeDecision: removeDecision, save: save, load: load };
}));
