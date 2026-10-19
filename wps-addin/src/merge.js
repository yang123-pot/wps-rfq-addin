(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./decimal.js') : root.RfqDecimal);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RfqMerge = api;
}(typeof window === 'object' ? window : globalThis, function (decimal) {
  'use strict';
  function pathKey(value) { return String(value || '').replace(/[\\/]+/g, '/').toLowerCase(); }
  // 只“待核对来源/区段”的问题，可经用户确认后放行；其余问题仍阻断确认。
  // feature-continuation（续行未归属）会丢材料文字，属于真问题，保持阻断，不列入可放行集合。
  var REVIEW_CODES = ['source-unresolved', 'source-inferred', 'section-ambiguous'];
  var normalize = decimal.normalize, addDecimal = decimal.add;
  function preview(books, options) {
    if (!Array.isArray(books) || !books.length) throw new Error('请先添加解析后的工作簿。');
    options = options || {};
    if (options.mergeIdentical != null && typeof options.mergeIdentical !== 'boolean') throw new Error('合并选项必须明确开启或关闭。');
    if (options.mergeAllWorkbooks != null && typeof options.mergeAllWorkbooks !== 'boolean') throw new Error('工作簿合并选项必须明确开启或关闭。');
    var merge = options.mergeIdentical === true;
    var mergeAllWorkbooks = options.mergeAllWorkbooks == null ? merge : options.mergeAllWorkbooks === true;
    var result = { mode: merge ? 'merge-identical' : 'separate', inputCount: 0, outputCount: 0, groups: [], issues: [], canFinalize: false };
    var bookKeys = new Set(), fingerprints = new Set(), sourceKeys = new Set(), issues = new Set(), groups = new Map();
    books.forEach(function (book) {
      if (!book || !Array.isArray(book.materials) || !Array.isArray(book.issues)) throw new Error('必须传入原始解析结果，不能再次传入已合并结果。');
      var bookKey = pathKey(book.path || book.name);
      if (!bookKey) throw new Error('工作簿缺少来源标识。');
      if (bookKey.split('/').some(function (part) { return part === '.' || part === '..'; })) throw new Error('来源路径不规范，请由导入器解析为规范路径后重试。');
      if (bookKeys.has(bookKey)) throw new Error('重复添加工作簿：' + book.name);
      bookKeys.add(bookKey);
      if (book.fingerprint != null) {
        if (!/^[a-f\d]{64}$/i.test(book.fingerprint)) throw new Error('工作簿指纹不是有效SHA256。');
        var fingerprint = book.fingerprint.toLowerCase();
        if (fingerprints.has(fingerprint)) throw new Error('重复导入相同文件内容：' + book.name);
        fingerprints.add(fingerprint);
      }
      function issue(code, severity, source, message) {
        var key = JSON.stringify([bookKey, source.sheet, source.row, code]);
        if (issues.has(key)) return;
        issues.add(key);
        result.issues.push({ file: book.name, path: book.path || '', sheet: source.sheet, row: source.row,
          column: source.column, code: code, severity: severity, message: message });
      }
      book.issues.forEach(function (entry) { issue(entry.code, entry.severity, entry, entry.message); });
      book.materials.forEach(function (item) {
        if (!item || ['name', 'feature', 'unit', 'code'].some(function (field) { return typeof item[field] !== 'string'; }) ||
            !Array.isArray(item.issueCodes)) throw new Error('材料字段不完整，请重新解析清单。');
        if (typeof item.id !== 'string' || !item.id.trim() || item.quantityRaw === undefined ||
            (item.quantityRaw !== null && ['string', 'number', 'boolean'].indexOf(typeof item.quantityRaw) < 0)) {
          throw new Error('材料缺少有效的原始ID或原工程量，追溯信息不完整。');
        }
        if (item.quantity !== null && (typeof item.quantity !== 'string' || !/^\d+(?:\.\d+)?$/.test(item.quantity))) {
          throw new Error('材料工程量不是规范十进制数量，请重新解析清单。');
        }
        var source = item.source;
        if (!source || typeof source.engineering !== 'string' || typeof source.profession !== 'string' ||
            !source.sheet || !Number.isSafeInteger(source.row) || source.row < 1 ||
            !Number.isSafeInteger(source.column) || source.column < 1 || !Array.isArray(source.rows) ||
            source.rows[0] !== source.row || source.rows.some(function (row) { return !Number.isSafeInteger(row) || row < 1; })) {
          throw new Error('材料来源行列不完整，请重新解析清单。');
        }
        if (source.path && pathKey(source.path) !== bookKey) throw new Error('材料来源与工作簿不一致，请重新解析清单。');
        source.rows.forEach(function (row) {
          var key = JSON.stringify([bookKey, String(source.sheet).toLowerCase(), row]);
          if (sourceKeys.has(key)) throw new Error('重复材料来源行：' + book.name + ' / ' + source.sheet + ' / ' + row);
          sourceKeys.add(key);
        });
        var sourceId = JSON.stringify([bookKey, source.sheet, source.row]);
        var quantity = item.quantity === null ? null : normalize(item.quantity);
        item.issueCodes.forEach(function (code) { issue(code, 'review', source, '此来源仍有待核对问题。'); });
        if (!item.name.trim()) issue('name-missing', 'error', source, '项目名称为空，不能完成合并。');
        if (!item.unit.trim()) issue('unit-missing', 'error', source, '单位为空，不能完成合并。');
        if (quantity === null) issue('quantity-invalid', 'error', source, '工程量异常，已单独保留原值，不计入其他材料合计。');
        if (!source.engineering.trim() || !source.profession.trim()) issue('source-unresolved', 'review', source, '工程名称或专业来源待核对。');
        var scopeId = mergeAllWorkbooks ? 'combined' : bookKey;
        var eligible = merge && quantity !== null && item.name.trim() && item.unit.trim();
        var groupKey = eligible ? JSON.stringify([item.name, item.feature, item.unit]) : sourceId;
        var group = eligible ? groups.get(groupKey) : null;
        var record = { id: sourceId, itemId: item.id, file: source.file || book.name, path: source.path || book.path || '',
          sheet: source.sheet, row: source.row, rows: source.rows.slice(), column: source.column, code: item.code,
          sequence: source.sequence || '',
          quantity: quantity, quantityRaw: item.quantityRaw, quantityDefaulted:item.quantityDefaulted===true, unit: item.unit,
          engineering: source.engineering || '', profession: source.profession || '', professionBasis: source.professionBasis || 'unresolved',
          section: source.section || '', issueCodes: item.issueCodes.slice(),
          featureParts: (item.featureParts || [{row:source.row,text:item.feature}]).map(function (part) { return {row:part.row,text:part.text}; }) };
        if (item.review) record.review = JSON.parse(JSON.stringify(item.review));
        var label = (record.engineering.trim() ? record.engineering : '工程待核对') + '—' +
          (record.profession.trim() ? record.profession : '专业待核对');
        if (!group) {
          group = { id: sourceId, scopeId: scopeId, name: item.name, feature: item.feature, unit: item.unit,
            quantity: quantity, sources: [], sourceLabels: [] };
          result.groups.push(group);
          if (eligible) groups.set(groupKey, group);
        } else group.quantity = addDecimal(group.quantity, quantity);
        group.sources.push(record);
        if (group.sourceLabels.indexOf(label) < 0) group.sourceLabels.push(label);
        result.inputCount++;
      });
    });
    result.outputCount = result.groups.length;
    // 2026-10-11 用户确认（A2a）：来源/区段“待核对”类问题不再阻断导入，改为确认后放行；
    // 破坏数据本身的问题（缺名称/缺单位/工程量不可解析/来源行重复等）仍然阻断。
    var blocking = result.issues.filter(function (issue) { return REVIEW_CODES.indexOf(issue.code) < 0; });
    result.blockingIssueCount = blocking.length;
    result.reviewIssueCount = result.issues.length - blocking.length;
    result.canFinalize = result.inputCount > 0 && blocking.length === 0;
    result.needsReviewAck = result.canFinalize && result.reviewIssueCount > 0;
    return result;
  }
  return { preview: preview };
}));
