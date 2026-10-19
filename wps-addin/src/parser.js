(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RfqParser = api;
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  var ALIASES = {
    code: ['项目编码', '清单编码'], name: ['项目名称', '材料名称'],
    feature: ['项目特征描述', '项目特征', '特征描述'], unit: ['计量单位', '单位'],
    quantity: ['工程量', '数量'], sequence: ['序号']
  };
  var REQUIRED = ['code', 'name', 'feature', 'unit', 'quantity'];
  function text(value) { return value == null ? '' : String(value); }
  function present(value) { return text(value).trim() !== ''; }
  function compact(value) { return text(value).replace(/\s/g, ''); }

  function headerInfo(row) {
    var map = {}, duplicate = false;
    row.forEach(function (value, column) {
      var label = compact(value);
      Object.keys(ALIASES).forEach(function (field) {
        if (ALIASES[field].indexOf(label) >= 0) {
          if (map[field] != null) duplicate = true;
          map[field] = column;
        }
      });
    });
    var count = REQUIRED.filter(function (key) { return map[key] != null; }).length;
    return { map: map, candidate: count >= 3, complete: count === REQUIRED.length, duplicate: duplicate };
  }

  // Deliberately uses heading text only, never material names, codes or descriptions.
  function profession(label) {
    var whole = compact(label);
    if (/抗震支架|检测.*调试|通风工程检测/.test(whole)) return '';
    var value = whole.split(/[（(]/)[0];
    var matches = [];
    function match(name, pattern) { if (pattern.test(value)) matches.push(name); }
    match('火灾报警', /火灾(?:自动)?报警|防火门监控|电气火灾监控|消防(?:设备)?电源监控|消防控制室|消控室/);
    match('消防水', /消防水|消防给水|消火栓|喷淋|水喷雾/);
    match('气体灭火', /气体灭火/);
    match('给排水', /给排水|给水|排水|雨水|污水|废水|污废水|热水|冲洗系统|灌溉|冷凝水/);
    match('智能化', /智能化|弱电|综合布线|视频监控|网络与无线|电子围栏|门禁|电子巡更|信息发布|广播系统/);
    match('暖通', /暖通|通风|排风|送风|防排烟|排烟|空调|新风/);
    match('强电', /强电|电气|防雷|变电所|电缆|二次线缆|接地|照明|光伏|电力监控/);
    match('电梯', /电梯/);
    // More specific headings may contain a generic word as part of their own name.
    if (/电气火灾监控/.test(value)) matches = matches.filter(function (x) { return x !== '强电'; });
    if (/消防给水/.test(value)) matches = matches.filter(function (x) { return x !== '给排水'; });
    if (/空调水/.test(value)) matches = matches.filter(function (x) { return x !== '给排水'; });
    return matches.length === 1 ? matches[0] : '';
  }

  function professionFromName(name) {
    var value = compact(name), matches = [];
    var rules = [
      ['强电', /配电箱|配电柜|开关柜|变压器|电力电缆|接地母线|避雷|等电位|普通灯具|装饰灯|荧光灯|照明开关|光伏|电动机/],
      ['暖通', /通风|风口|散流器|消声器|空调|风机|风阀|风管|挡烟|防排烟|新风/],
      ['给排水', /给[、，]?排水|水表|水龙头|水嘴|卫生洁具|大便器|小便器|洗脸盆|污水泵|排污泵|排水管|给水管|雨水管/],
      ['火灾报警', /火灾报警|火警|感烟|感温|点型探测器|声光报警|报警控制|消防广播/],
      ['智能化', /摄像|网络交换|网络控制|信息插座|视频监控|门禁|电子巡更|数据插座/],
      ['消防水', /消火栓|水喷淋|水喷雾|末端试水|消防泵/],
      ['气体灭火', /气体灭火|气体喷头/],
      ['电梯', /电梯|扶梯/]
    ];
    rules.forEach(function (rule) { if (rule[1].test(value)) matches.push(rule[0]); });
    return matches.length === 1 ? matches[0] : '';
  }

  function quantity(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) return null;
    var raw = text(value).trim();
    if (typeof value === 'number' && /e/i.test(raw)) {
      var parts = raw.toLowerCase().split('e');
      var decimals = parts[0].split('.');
      var digits = decimals.join('');
      var position = decimals[0].length + Number(parts[1]);
      raw = position <= 0 ? '0.' + '0'.repeat(-position) + digits :
        position >= digits.length ? digits + '0'.repeat(position - digits.length) :
          digits.slice(0, position) + '.' + digits.slice(position);
    }
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return null;
    var pieces = raw.replace(/,/g, '').split('.');
    var integer = pieces[0].replace(/^0+(?=\d)/, '');
    var fraction = (pieces[1] || '').replace(/0+$/, '');
    return integer + (fraction ? '.' + fraction : '');
  }

  function validate(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.sheets) || !snapshot.sheets.length) throw new Error('工作簿快照不完整。');
    snapshot.sheets.forEach(function (sheet) {
      if (['startRow', 'startColumn', 'rowCount', 'columnCount'].some(function (key) {
        return !Number.isSafeInteger(sheet[key]) || sheet[key] < 1;
      }) || !Array.isArray(sheet.values) || sheet.values.length !== sheet.rowCount || sheet.values.some(function (row) {
        return !Array.isArray(row) || row.length !== sheet.columnCount;
      })) throw new Error('“' + sheet.name + '”快照范围或数据不完整。');
    });
  }

  function parseWorkbook(snapshot) {
    validate(snapshot);
    var result = { name: snapshot.name, path: snapshot.path, materials: [], sheets: [], issues: [] };
    snapshot.sheets.forEach(function (sheet) {
      var summary = { name: sheet.name, status: 'unsupported', materialCount: 0, headers: [], audit: [] };
      result.sheets.push(summary);
      var map = null, engineering = '', baseProfession = profession(sheet.name), currentProfession = baseProfession;
      var baseBasis = baseProfession ? 'sheet' : 'unresolved', currentBasis = baseBasis;
      var section = '', hasContent = false, hasHeaderCandidate = false, lastMaterial = null;
      function issue(code, severity, row, column, message, item) {
        result.issues.push({ sheet: sheet.name, row: row, column: column, code: code, severity: severity, message: message });
        if (item) item.issueCodes.push(code);
      }
      sheet.values.forEach(function (values, index) {
        var absoluteRow = sheet.startRow + index;
        function audit(kind) { summary.audit.push({ row: absoluteRow, kind: kind }); }
        if (!values.some(present)) { audit('blank'); return; }
        hasContent = true;
        var info = headerInfo(values);
        if (info.candidate) {
          hasHeaderCandidate = true;
          if (info.duplicate || !info.complete) {
            map = null;
            issue(info.duplicate ? 'header-ambiguous' : 'header-incomplete', 'error', absoluteRow, sheet.startColumn,
              info.duplicate ? '表头字段重复，请核对列映射。' : '表头缺少编码、名称、特征、单位或工程量列。');
          } else {
            map = info.map;
            summary.headers.push({ row: absoluteRow, columns: Object.fromEntries(Object.keys(map).map(function (key) {
              return [key, sheet.startColumn + map[key]];
            })) });
            summary.status = 'recognized';
          }
          audit('header'); return;
        }
        // A title is outside the material payload, usually the first merged cell.
        var titleIndex = values.findIndex(function (value) { return /^\s*工程名称\s*[:：]/.test(text(value)); });
        var separateEngineering = titleIndex >= 0 && /^\s*工程名称\s*[:：]\s*$/.test(text(values[titleIndex]));
        var isTitle = titleIndex >= 0 && values.every(function (value, column) {
          return !present(value) || column === titleIndex || (separateEngineering && column === titleIndex + 1) ||
            /^(?:标段\s*[:：]|第\s*\d+\s*页)/.test(text(value).trim());
        });
        if (isTitle) {
          var newEngineering = text(values[titleIndex]).replace(/^\s*工程名称\s*[:：]\s*/, '').trim();
          if (!newEngineering) newEngineering = text(values[titleIndex + 1]).trim();
          if (engineering !== newEngineering) {
            engineering = newEngineering;
            baseProfession = profession(engineering) || profession(sheet.name);
            baseBasis = profession(engineering) ? 'engineering' : baseProfession ? 'sheet' : 'unresolved';
            currentProfession = baseProfession; currentBasis = baseBasis; section = '';
          }
          audit('title'); return;
        }
        if (!map) { audit('unmapped'); return; }
        var codeRaw = values[map.code], name = values[map.name], feature = values[map.feature];
        var unit = values[map.unit], qty = values[map.quantity];
        var blankQuantity = qty == null || (typeof qty === 'string' && qty.trim() === '');
        var parsedQuantity = blankQuantity ? '0' : quantity(qty);
        var totalLabel = present(name) ? name : values[map.sequence != null ? map.sequence : 0];
        if (!present(codeRaw) && !present(feature) && !present(unit) && /^(?:(?:本页|分部|分部分项|单价措施|措施项目|总价措施|工程|本表|本专业|累计|本章))?(?:小计|合计|总计)$/.test(compact(totalLabel))) {
          audit('total'); return;
        }
        if (present(feature) && values.every(function (value, column) { return column === map.feature || !present(value); }) &&
            lastMaterial && lastMaterial.source.rows[lastMaterial.source.rows.length - 1] === absoluteRow - 1 &&
            /^(material|continuation)$/.test(summary.audit[summary.audit.length - 1].kind)) {
          lastMaterial.featureParts.push({ row: absoluteRow, text: text(feature) });
          lastMaterial.feature += '\n' + text(feature);
          lastMaterial.source.rows.push(absoluteRow);
          if (lastMaterial.issueCodes.indexOf('feature-continuation') < 0) issue('feature-continuation', 'review', lastMaterial.source.row,
            sheet.startColumn + map.feature, '项目特征含相邻续行，已保留所有段落，请核对归属。', lastMaterial);
          audit('continuation'); return;
        }
        var sequence = map.sequence != null && /^\d+$/.test(text(values[map.sequence]).trim());
        var candidate = present(codeRaw) || (present(name) && (present(unit) || present(qty) || present(feature) || sequence)) ||
          (present(unit) && present(qty));
        if (candidate) {
          var itemProfession = currentProfession || professionFromName(name);
          var itemBasis = currentProfession ? currentBasis : itemProfession ? 'material-name' : 'unresolved';
          var item = { id: JSON.stringify([snapshot.path || snapshot.name, sheet.name, absoluteRow]),
            code: text(codeRaw), name: text(name), feature: text(feature), featureParts: [{ row: absoluteRow, text: text(feature) }], unit: text(unit),
            quantity: parsedQuantity, quantityDefaulted: blankQuantity,
            quantityRaw: qty == null ? '' : qty, issueCodes: [],
            source: { file: snapshot.name, path: snapshot.path, sheet: sheet.name, row: absoluteRow,
              rows: [absoluteRow], column: sheet.startColumn + map.name, engineering: engineering, profession: itemProfession,
              professionBasis: itemBasis, section: section } };
          if (!present(codeRaw)) issue('code-missing', 'review', absoluteRow, sheet.startColumn + map.code, '项目编码为空，请核对。', item);
          if (typeof codeRaw === 'number') issue('code-display-unverified', 'review', absoluteRow, sheet.startColumn + map.code,
            '编码为数值，需核对显示格式及前导零。', item);
          if (!present(name)) issue('name-missing', 'error', absoluteRow, sheet.startColumn + map.name, '项目名称为空，不能合并或输出。', item);
          if (!present(unit)) issue('unit-missing', 'error', absoluteRow, sheet.startColumn + map.unit, '单位为空，不能合并或输出。', item);
          if (item.quantity === null) issue('quantity-invalid', 'error', absoluteRow, sheet.startColumn + map.quantity,
            '工程量不是有效非负十进制数，已保留原值。', item);
          if (itemBasis === 'material-name') issue('source-inferred', 'review', absoluteRow, sheet.startColumn + map.name,
            '缺少明确专业标题，已按项目名称识别专业，请核对。', item);
          if (!engineering || !itemProfession) issue('source-unresolved', 'review', absoluteRow, sheet.startColumn + map.name,
            '工程名称或专业来源不明确，请核对。', item);
          result.materials.push(item); lastMaterial = item; summary.materialCount++; audit('material'); return;
        }
        if (present(name) && !present(feature) && !present(unit) && !present(qty) && !present(codeRaw)) {
          section = text(name).trim();
          var positional = /^(内部|外部|室内|室外|地上|地下)$/.test(section);
          var sectionProfession = profession(section);
          var headingText = compact(section).split(/[（(]/)[0];
          var explicitHeading = /(?:系统|工程|专业|分部)$/.test(headingText) ||
            /^(给排水|强电|火灾报警|智能化|暖通|电气|消防水|消防电)$/.test(headingText);
          if (!explicitHeading && !positional) issue('section-ambiguous', 'review', absoluteRow, sheet.startColumn + map.name,
            '此行仅有项目名称，暂按区段保留；请核对是否为缺少编码、单位或工程量的材料行。');
          if (!positional) {
            currentProfession = sectionProfession || baseProfession;
            currentBasis = sectionProfession ? 'section' : baseBasis;
          }
          audit('section'); return;
        }
        var nonempty = values.filter(present).map(compact);
        if (nonempty.every(function (value) { return /^(综合单价|合价|其中|暂估价|材料暂估价|金额[（(]元[）)]|单价|金额)$/.test(value); })) {
          audit('column-detail'); return;
        }
        audit('unrecognized');
        issue('row-unrecognized', 'review', absoluteRow, sheet.startColumn, '此非空行未识别为材料、区段或汇总，请检查是否存在续行材料信息。');
      });
      if (!hasContent) summary.status = 'empty';
      else if (!hasHeaderCandidate) issue('header-not-found', 'error', sheet.startRow, sheet.startColumn,
        '未找到完整清单表头，此工作表尚未处理。');
    });
    return result;
  }
  return { parseWorkbook: parseWorkbook };
}));
