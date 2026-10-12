'use strict';
// R12-F 公开输出审计（Node 侧）。
//
// 用途：对“公开输出工作簿”做完整预期矩阵比对、区域/列白名单和剩余内容检查。
// 真实 .xlsx 的独立读取与核对由 dev/audit-outputs.py 完成；本模块面向 Node 模型/夹具，
// 或由调用方把宿主读回的实际值喂入。不能用模型自己的输出当作“已核对”的证明。
//
// profile:
//   supplier       供应商拆分件：禁止内部页、隐藏页/列、公式、路径/SHA/原价、额外内容；
//                  抬头区允许“位置＋预期值”同时匹配的联系方式。
//   internal-total 总询价簿：只允许清单声明的内部页；其余规则同 supplier（内部页可声明）。
//
// expectedManifest 必须显式 complete:true 才可能给出逐值通过结论：
// {
//   complete: true, profile: 'supplier'|'internal-total',
//   sheets: [{
//     name, kind: 'inquiry'|'internal', visibility,
//     columns: 10,
//     title: {cell|range, value, merge},
//     fields: [{cell, value, contact?}],              // 抬头：label/value 合并文本按实际单元格写全
//     supplierRegion: [{cell, value, merge?}],
//     merges: ['A3:E3'],
//     material: {headerRow, firstDataRow, header:[10], rows:[[10]]},  // 行/列可写成 {value,type}
//     cells: [{cell, value, contact?, type?}]         // 额外显式预期单元格
//   }]
// }
// 未给完整预期时只报告扫描结果（valueChecked=false, verdict='scan-only'）。

const SCHEMA_VERSION = 2;
const PROFILES = ['supplier', 'internal-total'];
const INTERNAL_SHEETS = ['内部追溯', '处理记录', '来源明细', '清单'];
const FORBIDDEN = ['原价', '历史报价', '原清单文件', '原路径', 'SHA256', '核对追溯JSON', '自动结果', '历史分类定位'];
const CONTACT_RE = /(?:^|[^0-9])(?:1[0-9]{10}|0[0-9]{2,3}-?[0-9]{7,8}(?:-[0-9]{1,5})?)(?=$|[^0-9])/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PATH_RE = /(?:^|[^A-Za-z0-9_])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+[\\/]|file:\/\/)/;
const SHA_RE = /(?:^|[^0-9A-Za-z])[0-9a-fA-F]{40,64}(?=$|[^0-9A-Za-z])/;

function text(value) { return value == null ? '' : String(value); }

function parseAddress(address) {
  const match = /^([A-Za-z]+)([0-9]+)$/.exec(text(address).trim());
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let column = 0;
  for (let index = 0; index < letters.length; index += 1) column = column * 26 + (letters.charCodeAt(index) - 64);
  return { row: Number(match[2]), column: column };
}
function address(row, column) {
  let letters = '';
  let rest = Number(column);
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters + String(row);
}
function normalizeRange(range) {
  const raw = typeof range === 'object' && range ? text(range.range || range.cell) : text(range);
  return raw.toUpperCase().replace(/\$/g, '');
}
function rangeTopLeft(range) {
  const raw = normalizeRange(range);
  return raw.split(':')[0];
}
function rangeCorners(range) {
  const parts = normalizeRange(range).split(':');
  const start = parseAddress(parts[0]);
  const end = parseAddress(parts[1] || parts[0]);
  if (!start || !end) return null;
  return { start: start, end: end };
}

// 单元格值既可以是原始值，也可以是 {text|value, kind|formula} 元数据对象，
// 以便把“文本 =…”与真正的公式分开。
function normalizeCell(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const hasValue = raw.text !== undefined || raw.value !== undefined;
    if (!hasValue) return null;
    const value = raw.text !== undefined ? raw.text : raw.value;
    if (value === null || value === undefined || value === '') return null;
    const kind = raw.kind !== undefined ? text(raw.kind) : (raw.formula === true ? 'formula' : (typeof value === 'number' ? 'number' : 'text'));
    const isFormula = raw.formula === true || kind === 'formula';
    return { value: value, text: text(value), isFormula: isFormula, dataType: isFormula ? 'formula' : kind };
  }
  if (raw === '') return null;
  const isFormula = typeof raw === 'string' && raw.charAt(0) === '=';
  return {
    value: raw,
    text: text(raw),
    isFormula: isFormula,
    dataType: isFormula ? 'formula' : (typeof raw === 'number' ? 'number' : (typeof raw === 'boolean' ? 'boolean' : 'text')),
  };
}

function cellValues(sheet) {
  const values = (sheet && sheet.values) || [];
  const out = [];
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const info = normalizeCell(row[columnIndex]);
      if (info) out.push({ row: rowIndex + 1, column: columnIndex + 1, text: info.text });
    }
  }
  return out;
}

function collectCells(sheet) {
  const cells = {};
  const values = (sheet && sheet.values) || [];
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const info = normalizeCell(row[columnIndex]);
      if (info) cells[address(rowIndex + 1, columnIndex + 1)] = info;
    }
  }
  (sheet.formulas || []).forEach(function (item) {
    const position = typeof item === 'string' ? parseAddress(item)
      : (item.cell ? parseAddress(item.cell) : (item.row && item.column ? { row: Number(item.row), column: Number(item.column) } : null));
    if (!position) return;
    const key = address(position.row, position.column);
    const existing = cells[key];
    const rawText = item.text !== undefined ? item.text : (existing ? existing.text : '');
    cells[key] = { value: rawText, text: text(rawText), isFormula: true, dataType: 'formula' };
  });
  return cells;
}

function actualMerges(sheet) {
  return ((sheet && sheet.merges) || []).map(normalizeRange).filter(Boolean);
}
function hiddenColumnNumbers(sheet) {
  return ((sheet && sheet.hiddenColumns) || []).map(function (item) {
    if (typeof item === 'number') return item;
    const parsed = parseAddress(item + '1');
    return parsed ? parsed.column : null;
  }).filter(function (item) { return item != null; }).sort(function (a, b) { return a - b; });
}
function isHiddenSheet(sheet) {
  return !!(sheet && (sheet.hidden === true || sheet.visible === false || text(sheet.state) === 'hidden' || text(sheet.sheetState) === 'hidden'));
}
function isInternalSheet(sheet) {
  return !!sheet && (text(sheet.kind) === 'internal' || INTERNAL_SHEETS.indexOf(text(sheet.name)) >= 0);
}

function entryValue(raw) {
  if (raw && typeof raw === 'object' && (raw.value !== undefined || raw.text !== undefined)) {
    return { value: raw.value !== undefined ? raw.value : raw.text, type: raw.type };
  }
  return { value: raw, type: undefined };
}

// 把清单的区域声明展开成“单元格 -> 预期值”的完整矩阵。
function expandExpected(sheetManifest) {
  const cells = {};
  function add(cell, value, options) {
    const position = parseAddress(cell);
    if (!position || value === null || value === undefined || value === '') return;
    cells[address(position.row, position.column)] = Object.assign({
      cell: address(position.row, position.column), row: position.row, column: position.column, value: text(value),
    }, options || {});
  }
  const title = sheetManifest.title;
  if (title && title.value !== undefined) add(title.cell || rangeTopLeft(title.range), title.value, { role: 'title' });
  (sheetManifest.fields || []).forEach(function (field) {
    add(field.cell, field.value, { role: 'field', contact: field.contact === true, type: field.type });
  });
  (sheetManifest.supplierRegion || []).forEach(function (field) {
    add(field.cell, field.value, { role: 'supplier', contact: field.contact === true, type: field.type });
  });
  (sheetManifest.cells || []).forEach(function (field) {
    add(field.cell, field.value, { role: field.role, contact: field.contact === true, type: field.type });
  });
  const material = sheetManifest.material;
  if (material) {
    (material.header || []).forEach(function (raw, index) {
      const item = entryValue(raw);
      add(address(Number(material.headerRow), index + 1), item.value, { role: 'material-header', type: item.type });
    });
    (material.rows || []).forEach(function (row, rowIndex) {
      (row || []).forEach(function (raw, columnIndex) {
        const item = entryValue(raw);
        add(address(Number(material.firstDataRow) + rowIndex, columnIndex + 1), item.value, { role: 'material', type: item.type,
          projectCode: text(entryValue((material.header || [])[columnIndex]).value) === '项目编码' });
      });
    });
  }
  return cells;
}

function expectedMerges(sheetManifest) {
  const ranges = [];
  function push(raw) { const value = normalizeRange(raw); if (value) ranges.push(value); }
  if (sheetManifest.title && sheetManifest.title.merge) push(sheetManifest.title.merge);
  (sheetManifest.fields || []).forEach(function (field) { if (field.merge) push(field.merge); });
  (sheetManifest.supplierRegion || []).forEach(function (field) { if (field.merge) push(field.merge); });
  (sheetManifest.merges || []).forEach(push);
  return ranges;
}

function sheetExtent(sheet, cells, merges) {
  let rows = Number(sheet.rowCount || 0), columns = Number(sheet.columnCount || 0);
  const values = (sheet.values || []);
  rows = Math.max(rows, values.length);
  values.forEach(function (row) { columns = Math.max(columns, (row || []).length); });
  Object.keys(cells).forEach(function (key) {
    const position = parseAddress(key);
    if (!position) return;
    rows = Math.max(rows, position.row);
    columns = Math.max(columns, position.column);
  });
  merges.forEach(function (range) {
    const corners = rangeCorners(range);
    if (!corners) return;
    rows = Math.max(rows, corners.end.row);
    columns = Math.max(columns, corners.end.column);
  });
  return { rows: rows, columns: columns };
}

function audit(input) {
  const source = input || {};
  const workbook = source.workbook || {};
  const sheets = (workbook.sheets || []).filter(Boolean);
  const manifest = source.expectedManifest || null;
  const profile = text(source.profile || (manifest && manifest.profile) || 'supplier') === 'internal-total' ? 'internal-total' : 'supplier';
  const manifestComplete = !!(manifest && manifest.complete === true && Array.isArray(manifest.sheets));
  const expectedSheets = {};
  if (manifestComplete) manifest.sheets.forEach(function (item) { expectedSheets[text(item.name)] = item; });

  const report = {
    schemaVersion: SCHEMA_VERSION,
    profile: profile,
    ok: false,
    valueChecked: false,
    manifestComplete: manifestComplete,
    verdict: 'failed',
    scanClean: false,
    notes: [],
    sheets: [],
    sheetsDetail: [],
    scan: { sheets: 0, formulaCount: 0, commentCount: 0, hyperlinkCount: 0 },
    hiddenSheets: [],
    internalSheets: [],
    internalSheetViolations: [],
    unexpectedSheets: [],
    missingSheets: [],
    hiddenColumns: [],
    formulaCells: [],
    forbiddenFields: [],
    personalLeaks: [],
    pathLeaks: [],
    shaLeaks: [],
    commentCells: [],
    hyperlinkCells: [],
    externalLinks: [],
    extraCells: [],
    missingCells: [],
    mismatches: [],
    typeIssues: [],
    layoutIssues: [],
  };

  const actualNames = sheets.map(function (sheet) { return text(sheet.name); });
  report.sheets = actualNames.slice();

  sheets.forEach(function (sheet) {
    const name = text(sheet.name);
    const cells = collectCells(sheet);
    const merges = actualMerges(sheet);
    const extent = sheetExtent(sheet, cells, merges);
    const expectedSheet = expectedSheets[name] || null;
    const expectedCells = expectedSheet ? expandExpected(expectedSheet) : null;

    if (isHiddenSheet(sheet)) report.hiddenSheets.push(name);
    if (isInternalSheet(sheet)) report.internalSheets.push(name);
    if (manifestComplete && !expectedSheet) {
      report.unexpectedSheets.push({ sheet: name, code: 'unexpected-sheet', message: '清单之外的工作表：' + name });
    }
    if (isInternalSheet(sheet)) {
      const declaredInternal = expectedSheet && text(expectedSheet.kind) === 'internal';
      if (!(profile === 'internal-total' && declaredInternal)) report.internalSheetViolations.push(name);
    }

    const declaredHidden = hiddenColumnNumbers(expectedSheet || {});
    hiddenColumnNumbers(sheet).forEach(function (column) {
      const allowed = profile === 'internal-total' && declaredHidden.indexOf(column) >= 0;
      if (!allowed) report.hiddenColumns.push({ sheet: name, column: column });
    });

    const declaredColumns = expectedSheet && expectedSheet.columns ? Number(expectedSheet.columns) : 0;
    // 内部总簿的声明内部页属于内部内容，允许出现“原价/历史报价”等内部说明与追溯标识；
    // 仍按下发清单逐值/额外内容核对，但不做公开泄漏模式扫描。
    const declaredInternal = profile === 'internal-total' && !!expectedSheet && text(expectedSheet.kind) === 'internal';
    Object.keys(cells).forEach(function (key) {
      const info = cells[key];
      const position = parseAddress(key);
      const expected = expectedCells ? expectedCells[key] : null;

      if (!declaredInternal) {
        if (info.isFormula) report.formulaCells.push({ sheet: name, cell: key, row: position.row, column: position.column, text: info.text });
        FORBIDDEN.forEach(function (word) {
          if (info.text.indexOf(word) >= 0) report.forbiddenFields.push({ sheet: name, cell: key, row: position.row, column: position.column, field: word });
        });
        const hasPath = PATH_RE.test(info.text);
        const hasSha = SHA_RE.test(info.text);
        const hasContact = CONTACT_RE.test(info.text) || EMAIL_RE.test(info.text);
        if (hasPath) report.pathLeaks.push({ sheet: name, cell: key, row: position.row, column: position.column, text: info.text });
        if (hasSha) report.shaLeaks.push({ sheet: name, cell: key, row: position.row, column: position.column, text: info.text });
        if (hasContact) {
          // F5实际12位清单编码会撞座机正则；仅放行完整清单声明的项目编码列、逐值一致的12位编码。
          // 合并后的编码以全角分号连接。其它列、不同源值及真正电话仍报告，不全局弱化正则。
          const allowedCode = !!(expected && expected.projectCode === true && text(expected.value) === info.text &&
            /^[0-9]{12}(?:；[0-9]{12})*$/.test(info.text));
          const allowed = allowedCode || !!(expected && expected.contact === true && text(expected.value) === info.text);
          if (!allowed) report.personalLeaks.push({ sheet: name, cell: key, row: position.row, column: position.column, text: info.text });
        }
      }

      if (expectedCells) {
        if (!expected) {
          report.extraCells.push({ sheet: name, cell: key, row: position.row, column: position.column, actual: info.text });
        } else {
          if (text(expected.value) !== info.text) {
            report.mismatches.push({ sheet: name, cell: key, row: position.row, column: position.column, expected: text(expected.value), actual: info.text });
          }
          if (expected.type === 'text' && info.dataType !== 'text' && info.dataType !== 'string') {
            report.typeIssues.push({ sheet: name, cell: key, row: position.row, column: position.column, expected: text(expected.value), actualType: info.dataType });
          }
        }
        if (declaredColumns && position.column > declaredColumns) {
          report.layoutIssues.push({ sheet: name, code: 'column-beyond-declared', detail: { cell: key, column: position.column, declared: declaredColumns } });
        }
      }
    });

    if (expectedCells) {
      Object.keys(expectedCells).forEach(function (key) {
        if (!cells[key]) {
          const expected = expectedCells[key];
          report.missingCells.push({ sheet: name, cell: key, row: expected.row, column: expected.column, expected: text(expected.value) });
        }
      });
    }

    if (expectedSheet && manifestComplete) {
      const expectedRanges = expectedMerges(expectedSheet).map(normalizeRange);
      const actualRanges = merges.slice();
      expectedRanges.forEach(function (range) {
        if (actualRanges.indexOf(range) < 0) report.layoutIssues.push({ sheet: name, code: 'missing-merge', detail: range });
      });
      actualRanges.forEach(function (range) {
        if (expectedRanges.indexOf(range) < 0) report.layoutIssues.push({ sheet: name, code: 'unexpected-merge', detail: range });
      });
    }

    const commentList = ((sheet.comments || []).map(function (item) {
      return { sheet: name, cell: typeof item === 'string' ? item : text(item.cell) };
    }));
    const hyperlinkList = ((sheet.hyperlinks || []).map(function (item) {
      return { sheet: name, cell: text(item.cell), target: text(item.target) };
    }));
    commentList.forEach(function (item) { report.commentCells.push(item); });
    hyperlinkList.forEach(function (item) {
      report.hyperlinkCells.push(item);
      if (PATH_RE.test(item.target) || /^https?:\/\//i.test(item.target)) report.externalLinks.push(item);
    });

    report.sheetsDetail.push({
      name: name, rows: extent.rows, columns: extent.columns,
      formulaCount: Object.keys(cells).filter(function (key) { return cells[key].isFormula; }).length,
      state: isHiddenSheet(sheet) ? 'hidden' : 'visible',
    });
  });

  if (manifestComplete) {
    manifest.sheets.forEach(function (item) {
      const name = text(item.name);
      if (actualNames.indexOf(name) < 0) report.missingSheets.push({ sheet: name, code: 'missing-sheet', message: '文件里没有清单声明的表：' + name });
    });
  }

  report.scan.sheets = sheets.length;
  report.scan.formulaCount = report.formulaCells.length;
  report.scan.commentCount = report.commentCells.length;
  report.scan.hyperlinkCount = report.hyperlinkCells.length;

  const violations = report.hiddenSheets.length + report.internalSheetViolations.length + report.unexpectedSheets.length
    + report.missingSheets.length + report.hiddenColumns.length + report.formulaCells.length + report.forbiddenFields.length
    + report.personalLeaks.length + report.pathLeaks.length + report.shaLeaks.length + report.commentCells.length
    + report.hyperlinkCells.length + report.externalLinks.length + report.extraCells.length + report.missingCells.length
    + report.mismatches.length + report.typeIssues.length + report.layoutIssues.length;
  report.scanClean = violations === 0;
  report.valueChecked = manifestComplete && report.missingSheets.length === 0 && report.unexpectedSheets.length === 0;
  report.ok = report.valueChecked && report.scanClean;
  if (report.ok) report.verdict = 'value-verified';
  else if (report.scanClean && !report.valueChecked) report.verdict = 'scan-only';
  else report.verdict = 'failed';

  if (!manifestComplete) {
    report.notes.push('未提供完整预期清单（expectedManifest.complete!==true），仅报告扫描结果，不能判定逐值通过。');
  } else if (!report.valueChecked) {
    report.notes.push('预期清单未覆盖实际工作表或声明的表缺失，不能判定逐值通过。');
  }
  return report;
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  PROFILES: PROFILES,
  INTERNAL_SHEETS: INTERNAL_SHEETS,
  FORBIDDEN: FORBIDDEN,
  audit: audit,
  cellValues: cellValues,
  expandExpected: expandExpected,
  parseAddress: parseAddress,
  address: address,
  normalizeCell: normalizeCell,
};
