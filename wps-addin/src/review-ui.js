(function () {
  'use strict';
  function node(tag, text, className) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (className) e.className = className;
    return e;
  }
  function field(form, label, value, type) {
    var wrap = node('label', label), input = node('input');
    input.type = type || 'text'; input.value = value == null ? '' : String(value);
    wrap.appendChild(input); form.appendChild(wrap); return input;
  }
  function submit(form, label, action) {
    var button = node('button', label); button.type = 'submit'; form.appendChild(button);
    form.addEventListener('submit', function (event) { event.preventDefault(); action(); });
  }
  function lazy(label, build) {
    var details = node('details', null, 'review-editor'), built = false;
    details.appendChild(node('summary', label));
    details.addEventListener('toggle', function () {
      if (details.open && !built) { built = true; build(details); }
    });
    return details;
  }
  function materialForm(entry, onDecision) {
    var form = node('form', null, 'review-form'), inputs = {};
    var numericCode = !!(entry.review && entry.review.original.codeWasNumeric);
    var confirmedCode = !!(entry.review && entry.review.decision && entry.review.decision.codeDisplayConfirmed);
    form.appendChild(node('p', '确认此行的材料字段及来源。编码请按原表显示输入，保留前导零。', 'note'));
    [['code','项目编码',numericCode && !confirmedCode ? '' : entry.code],['name','项目名称',entry.name],['unit','单位',entry.unit],
      ['quantity','工程量',entry.quantity == null ? entry.quantityRaw : entry.quantity],
      ['engineering','工程名称',entry.source.engineering],['profession','专业',entry.source.profession]].forEach(function (f) {
      inputs[f[0]] = field(form, f[1], f[2]);
    });
    var missing = field(form, '已核对原清单，确认无项目编码', '', 'checkbox');
    missing.checked = !!(entry.review && entry.review.decision && entry.review.decision.allowMissingCode);
    missing.disabled = !!(entry.review && String(entry.review.original.code || '').trim());
    var display;
    if (numericCode) {
      inputs.code.placeholder = '请按原表显示输入，包含前导零';
      form.appendChild(node('p', '原始数值编码为 ' + entry.review.original.code + '，可能未包含原表显示的前导零。以后若仅调整显示格式，请撤销本行核对后重做。', 'review-note'));
      display = field(form, '已核对原表编码显示格式及前导零', '', 'checkbox'); display.checked = confirmedCode;
    }
    submit(form, '确认本行核对', function () {
      var d = { kind: 'material', sheet: entry.source.sheet, row: entry.source.row, allowMissingCode: missing.checked };
      if (display) d.codeDisplayConfirmed = display.checked;
      Object.keys(inputs).forEach(function (key) { d[key] = inputs[key].value; });
      onDecision(d);
    });
    return form;
  }
  function material(entry, onDecision) {
    return lazy('核对 / 修正此行', function (details) {
      var basis = { 'user-confirmed': '用户已确认', 'material-name': '按项目名称推断，待确认',
        section: '区段标题', engineering: '工程标题', sheet: '工作表标题', unresolved: '待补充' };
      details.appendChild(node('p', '专业依据：' + (basis[entry.source.professionBasis] || '待核对'), 'note'));
      if (entry.review && entry.review.decision) {
        var old = entry.review.original;
        details.appendChild(node('p', '原编码：' + (old.code || '空') + '；原工程量：' + (String(old.quantityRaw) || '空'), 'note'));
      }
      details.appendChild(materialForm(entry, onDecision));
      (entry.review ? entry.review.continuations : []).forEach(function (part) {
        var form = node('form', null, 'review-form continuation-form');
        var text = entry.featureParts.find(function (p) { return p.row === part.row; });
        form.appendChild(node('strong', '第 ' + part.row + ' 行特征续行' + (part.confirmed ? ' · 已确认' : ' · 待确认')));
        form.appendChild(node('p', text ? text.text : '', 'feature'));
        form.appendChild(node('p', '初始归属第 ' + part.originalOwnerRow + ' 行。可填写同表其他材料行号调整归属。', 'note'));
        var target = field(form, '归属材料行号', part.targetRow, 'number'); target.min = '1'; target.step = '1';
        submit(form, '确认第 ' + part.row + ' 行归属', function () {
          onDecision({kind:'continuation',sheet:entry.source.sheet,row:part.row,targetRow:Number(target.value)});
        });
        details.appendChild(form);
      });
    });
  }
  function issue(entry, snapshot, parsed, onDecision) {
    var item = parsed.materials.find(function (m) { return m.source.sheet === entry.sheet && m.source.row === entry.row; });
    if (item) return material(item, onDecision);
    if (entry.code !== 'section-ambiguous' && entry.code !== 'row-unrecognized') {
      return node('p', '请定位后在WPS原表修复，再重新读取；此问题不能直接标为已解决。', 'note');
    }
    return lazy('核对此行类型', function (details) {
      var sheet = snapshot.sheets.find(function (s) { return s.name === entry.sheet; });
      var values = sheet.values[entry.row - sheet.startRow];
      details.appendChild(node('p', values.filter(function (v) { return v != null && String(v).trim(); }).join(' · '), 'feature'));
      var label = node('label', '此行是什么'), select = node('select');
      [['','请选择'],['material','材料行（补齐必要字段）'],
        [entry.code === 'section-ambiguous' ? 'section' : 'nonmaterial', entry.code === 'section-ambiguous' ? '区段标题' : '非材料说明行']].forEach(function (option) {
        var e = node('option', option[1]); e.value = option[0]; select.appendChild(e);
      });
      label.appendChild(select); details.appendChild(label);
      var body = node('div'); details.appendChild(body);
      select.addEventListener('change', function () {
        body.textContent = '';
        if (select.value === 'material') {
          var summary = parsed.sheets.find(function (s) { return s.name === entry.sheet; });
          var headers = summary.headers.filter(function (h) { return h.row < entry.row; });
          var h = headers[headers.length - 1];
          if (!h) { body.appendChild(node('p', '请先在原表修复表头。')); return; }
          function cell(k) { return values[h.columns[k] - sheet.startColumn]; }
          body.appendChild(materialForm({code:cell('code'),name:cell('name'),unit:cell('unit'),quantityRaw:cell('quantity'),
            source:{sheet:entry.sheet,row:entry.row,engineering:'',profession:''}}, onDecision));
        } else if (select.value) {
          var form = node('form', null, 'review-form');
          var reason = select.value === 'nonmaterial' ? field(form, '核对理由', '') : null;
          submit(form, '确认行类型', function () {
            onDecision({kind:select.value,sheet:entry.sheet,row:entry.row,reason:reason ? reason.value : ''});
          }); body.appendChild(form);
        }
      });
    });
  }
  window.RfqReviewUI = { material: material, issue: issue };
}());
