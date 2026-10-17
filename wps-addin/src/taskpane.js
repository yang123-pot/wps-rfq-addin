(function () {
  'use strict';
  var button = document.getElementById('read-workbook');
  var connection = document.getElementById('connection');
  var message = document.getElementById('message');
  var application = window.Application;
  var parsed = null, snapshot = null, record = null, dirty = false, page = 0, pageSize = 20;
  var imported = null, imports = null;
  var mode = document.getElementById('preview-mode');
  var labels = { 'code-missing': '缺少编码', 'code-display-unverified': '核对编码格式', 'name-missing': '缺少名称',
    'unit-missing': '缺少单位', 'quantity-invalid': '工程量异常', 'source-unresolved': '来源待核对',
    'source-inferred': '专业按项目名称识别', 'feature-continuation': '特征含续行' };
  function element(tag, value, className) {
    var node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function showBook(book) {
    document.getElementById('workbook-name').textContent = book.name;
    document.getElementById('workbook-detail').textContent = '共 ' + book.sheets.length + ' 张工作表';
  }
  function locateButton(source) {
    var node = element('button', '定位第 ' + source.row + ' 行', 'locate');
    node.type = 'button';
    node.addEventListener('click', function () {
      try {
        if (imported) RfqImportHost.locateCopy(application, imported.metadata, source);
        else WpsHost.locateSource(application, source);
        message.className = '';
        message.textContent = '已定位到“' + source.sheet + '”第 ' + source.row + ' 行。';
      } catch (error) { message.className = 'error'; message.textContent = error.message; }
    });
    return node;
  }
  function report(error) { message.className = 'error'; message.textContent = error.message; }
  function reportReview(error, action) {
    report(error);
    var status = document.getElementById('review-status');
    status.textContent = (record ? record.decisions.length : 0) + ' 项核对记录 · ' +
      (dirty ? '有修改未保存' : '本次记录未修改') + '。' + action + '未完成：' + error.message;
  }
  function assertCurrent(contents) {
    if (imported) return; // Imported snapshots belong to the selected file, independently of the active WPS book.
    var current = contents ? WpsHost.readWorkbook(application) : WpsHost.inspectWorkbook(application);
    if (current.path !== snapshot.path || current.name !== snapshot.name) throw new Error('当前已切换工作簿，请返回原工作簿或重新读取。');
    if (contents && JSON.stringify(current) !== JSON.stringify(snapshot)) throw new Error('工作簿内容已变化，请重新读取后核对；旧记录未覆盖。');
  }
  function refresh() {
    var list = document.getElementById('sheets'); list.textContent = '';
    parsed.sheets.forEach(function (sheet) {
      var li = element('li');
      li.appendChild(element('span', sheet.name));
      li.appendChild(element('span', sheet.status === 'empty' ? '空白表' :
        sheet.status === 'unsupported' ? '未识别' : sheet.materialCount + ' 项'));
      list.appendChild(li);
    });
    document.getElementById('material-count').textContent = parsed.materials.length;
    document.getElementById('issue-count').textContent = parsed.issues.length;
    document.getElementById('review-status').textContent = record.decisions.length + ' 项核对记录 · ' + (dirty ? '有修改未保存' : '本次记录未修改');
    var check = RfqMerge.preview([parsed]);
    document.getElementById('processing-status').textContent = check.canFinalize ?
      '来源及异常已处理，可用于后续合并预览；材料分类尚未开始。' : '还有 ' + check.issues.length + ' 个问题，后续处理仍被阻断。';
    renderPreview();
  }
  function changeRecord(next) {
    var nextParsed = RfqReview.apply(snapshot, next);
    if (imported) { nextParsed.fingerprint = snapshot.fingerprint; imports.update(imported.id, next, true); }
    record = next; parsed = nextParsed; dirty = true; refresh();
    message.className = ''; message.textContent = '核对已应用，请保存到本机。原始工作簿未修改。';
  }
  function decide(decision) {
    try { assertCurrent(false); changeRecord(RfqReview.setDecision(snapshot, record, decision)); }
    catch (error) { report(error); }
  }
  function undo(entry) {
    try { assertCurrent(false); changeRecord(RfqReview.removeDecision(snapshot, record, entry.sheet, entry.row)); }
    catch (error) { report(error); }
  }
  document.getElementById('save-review').addEventListener('click', function () {
    try {
      assertCurrent(true); RfqReview.save(window.localStorage, snapshot, record); dirty = false;
      if (imported) imports.update(imported.id, record, false);
      refresh(); document.getElementById('review-status').textContent = record.decisions.length + ' 项核对记录 · 已保存到本机';
      message.className = ''; message.textContent = '核对记录已保存到本机，重新打开后读取同一清单，再点击恢复。';
    } catch (error) { reportReview(error, '保存'); }
  });
  document.getElementById('restore-review').addEventListener('click', function () {
    try {
      assertCurrent(true);
      var saved = RfqReview.load(window.localStorage, snapshot);
      if (!saved) throw new Error('此工作簿没有已保存的核对记录。');
      if (dirty && !window.confirm('恢复已保存记录将替换本页尚未保存的核对修改，是否继续？')) return;
      var restored = RfqReview.apply(snapshot, saved);
      if (imported) { restored.fingerprint = snapshot.fingerprint; imports.update(imported.id, saved, false); }
      record = saved; parsed = restored; dirty = false; refresh();
      document.getElementById('review-status').textContent = record.decisions.length + ' 项核对记录 · 已恢复本机保存';
      message.className = ''; message.textContent = '已恢复核对记录。原始工作簿未修改。';
    } catch (error) { reportReview(error, '恢复'); }
  });
  window.addEventListener('beforeunload', function (event) {
    if (dirty || (imports && imports.hasUnsaved())) { event.preventDefault(); event.returnValue = ''; }
  });
  function renderPreview() {
    if (!parsed) return;
    var isIssues = mode.value === 'issues', isDecisions = mode.value === 'decisions';
    var entries = isDecisions ? record.decisions : isIssues ? parsed.issues : parsed.materials.filter(function (item) {
      return mode.value !== 'reviews' || item.issueCodes.length > 0;
    });
    var pages = Math.max(1, Math.ceil(entries.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    var list = document.getElementById('preview-list'); list.textContent = '';
    entries.slice(page * pageSize, (page + 1) * pageSize).forEach(function (entry) {
      var li = element('li');
      if (isDecisions) {
        var kinds = {material:'材料及来源',section:'区段标题',continuation:'特征续行归属',nonmaterial:'非材料说明行'};
        li.appendChild(element('strong', kinds[entry.kind]));
        li.appendChild(element('p', entry.sheet + ' · 第 ' + entry.row + ' 行', 'source'));
        li.appendChild(element('p', entry.kind === 'material' ? entry.name + ' · ' + entry.engineering + '—' + entry.profession :
          entry.kind === 'continuation' ? '归属材料第 ' + entry.targetRow + ' 行' : entry.reason || '已确认区段标题', 'note'));
        var revoke = element('button', '撤销此项核对', 'locate'); revoke.type = 'button';
        revoke.addEventListener('click', function () { undo(entry); }); li.appendChild(revoke);
      } else if (isIssues) {
        li.appendChild(element('strong', entry.message));
        li.appendChild(element('p', entry.sheet + ' · 第 ' + entry.row + ' 行', 'source'));
        li.appendChild(locateButton({ path: parsed.path, file: parsed.name, sheet: entry.sheet, row: entry.row, column: entry.column }));
        li.appendChild(RfqReviewUI.issue(entry, snapshot, parsed, decide));
      } else {
        li.appendChild(element('strong', entry.name || '（名称待补）'));
        li.appendChild(element('p', '编码 ' + (entry.code || '待补') + ' · 工程量 ' +
          (entry.quantity == null ? String(entry.quantityRaw) || '待补' : entry.quantity) + ' ' + entry.unit, 'quantity'));
        li.appendChild(element('p', (entry.source.engineering || '工程待核对') + ' — ' +
          (entry.source.profession || '专业待核对'), 'source'));
        if (entry.issueCodes.length) li.appendChild(element('p', entry.issueCodes.map(function (code) { return labels[code] || code; }).join(' · '), 'review-note'));
        var detail = element('details'); detail.appendChild(element('summary', '查看项目特征与原位置'));
        detail.appendChild(element('p', entry.feature || '（项目特征为空）', 'feature'));
        detail.appendChild(element('p', entry.source.sheet + ' · 行 ' + entry.source.rows.join('、') +
          (entry.source.section ? ' · 区段：' + entry.source.section : ''), 'source'));
        li.appendChild(detail); li.appendChild(locateButton(entry.source));
        if (entry.review && entry.review.decision) li.appendChild(element('p', '本行材料与来源已核对', 'confirmed-note'));
        li.appendChild(RfqReviewUI.material(entry, decide));
      }
      list.appendChild(li);
    });
    if (!entries.length) list.appendChild(element('li', '此范围没有条目。', 'empty'));
    document.getElementById('page-summary').textContent = (page + 1) + ' / ' + pages + ' 页 · ' + entries.length + ' 项';
    document.getElementById('previous-page').disabled = page === 0;
    document.getElementById('next-page').disabled = page + 1 >= pages;
  }
  mode.addEventListener('change', function () { page = 0; renderPreview(); });
  document.getElementById('previous-page').addEventListener('click', function () { page--; renderPreview(); });
  document.getElementById('next-page').addEventListener('click', function () { page++; renderPreview(); });
  imports = RfqImportUI.create({
    application: application,
    onBusy: function (busy) { document.getElementById('task-controls').disabled = busy; },
    onSelect: function (entry) {
      if (!imported && dirty && !window.confirm('切换到导入文件会清除当前单独读取的未保存核对，是否继续？')) return false;
      imported = entry; snapshot = entry.snapshot; record = entry.record; parsed = entry.parsed; dirty = entry.dirty;
      page = 0; mode.value = 'all'; showBook(parsed);
      document.getElementById('workbook-context').textContent = '正在核对导入文件（复制时的清单）';
      document.getElementById('sheet-count').textContent = parsed.sheets.length + ' 张';
      document.getElementById('sheets-section').hidden = false;
      document.getElementById('review-section').hidden = false;
      document.getElementById('preview-section').hidden = false;
      refresh(); message.className = ''; message.textContent = '正在核对“' + parsed.name + '”。修正将同步到下方合并预览。';
      return true;
    },
    onRemove: function (id) {
      if (!imported || imported.id !== id) return;
      imported = null; parsed = null; snapshot = null; record = null; dirty = false;
      document.getElementById('workbook-context').textContent = '当前工作簿（单独读取）';
      document.getElementById('workbook-name').textContent = '尚未读取';
      document.getElementById('workbook-detail').textContent = '请选择导入文件，或单独读取当前工作簿。';
      ['sheets-section', 'review-section', 'preview-section'].forEach(function (id) { document.getElementById(id).hidden = true; });
      message.className = ''; message.textContent = '';
    }
  });
  if (!application) {
    connection.textContent = '请从WPS表格的“材料整理”功能区打开';
    message.textContent = '此页面需要连接WPS中的工作簿。请在WPS内启动插件后读取清单。';
    return;
  }
  connection.textContent = '已连接WPS表格'; connection.classList.add('ready'); button.disabled = false;
  try { showBook(WpsHost.inspectWorkbook(application)); } catch (error) { message.textContent = error.message; }
  button.addEventListener('click', function () {
    if (!imported && dirty && !window.confirm('重新读取会清除本页未保存的核对修改，是否继续？')) return;
    imported = null; imports.clearSelection();
    document.getElementById('workbook-context').textContent = '当前工作簿（单独读取）';
    document.getElementById('task-controls').disabled = true;
    button.disabled = true; parsed = null; page = 0;
    snapshot = null; record = null; dirty = false;
    message.className = ''; message.textContent = '正在读取并识别全部工作表…';
    document.getElementById('sheets-section').hidden = true;
    document.getElementById('preview-section').hidden = true;
    document.getElementById('review-section').hidden = true;
    setTimeout(function () {
      try {
        snapshot = WpsHost.readWorkbook(application);
        record = RfqReview.create(snapshot); parsed = RfqReview.apply(snapshot, record); showBook(parsed);
        document.getElementById('material-count').textContent = parsed.materials.length;
        document.getElementById('issue-count').textContent = parsed.issues.length;
        document.getElementById('sheet-count').textContent = parsed.sheets.length + ' 张';
        document.getElementById('sheets-section').hidden = false;
        document.getElementById('preview-section').hidden = false;
        document.getElementById('review-section').hidden = false;
        mode.value = 'all'; refresh();
        var errors = parsed.issues.filter(function (issue) { return issue.severity === 'error'; }).length;
        message.className = errors ? 'error' : '';
        message.textContent = '已扫描 ' + parsed.sheets.length + ' 张工作表，识别 ' + parsed.materials.length + ' 条候选项。' +
          (parsed.issues.length ? '有 ' + parsed.issues.length + ' 个待核对问题' + (errors ? '，其中 ' + errors + ' 个阻止后续处理' : '') + '。' : '原始清单未修改。');
      } catch (error) {
        parsed = null; snapshot = null; record = null;
        document.getElementById('sheets-section').hidden = true;
        document.getElementById('preview-section').hidden = true;
        document.getElementById('review-section').hidden = true;
        message.className = 'error'; message.textContent = error.message;
      } finally { button.disabled = false; document.getElementById('task-controls').disabled = false; }
    }, 30);
  });
}());
