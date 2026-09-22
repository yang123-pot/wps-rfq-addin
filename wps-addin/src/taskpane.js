(function () {
  'use strict';
  var button = document.getElementById('read-workbook');
  var connection = document.getElementById('connection');
  var message = document.getElementById('message');
  var application = window.Application;
  var parsed = null, page = 0, pageSize = 20;
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
        WpsHost.locateSource(application, source);
        message.className = '';
        message.textContent = '已定位到“' + source.sheet + '”第 ' + source.row + ' 行。';
      } catch (error) { message.className = 'error'; message.textContent = error.message; }
    });
    return node;
  }
  function renderPreview() {
    if (!parsed) return;
    var isIssues = mode.value === 'issues';
    var entries = isIssues ? parsed.issues : parsed.materials.filter(function (item) {
      return mode.value !== 'reviews' || item.issueCodes.length > 0;
    });
    var pages = Math.max(1, Math.ceil(entries.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    var list = document.getElementById('preview-list'); list.textContent = '';
    entries.slice(page * pageSize, (page + 1) * pageSize).forEach(function (entry) {
      var li = element('li');
      if (isIssues) {
        li.appendChild(element('strong', entry.message));
        li.appendChild(element('p', entry.sheet + ' · 第 ' + entry.row + ' 行', 'source'));
        li.appendChild(locateButton({ path: parsed.path, file: parsed.name, sheet: entry.sheet, row: entry.row, column: entry.column }));
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
  if (!application) {
    connection.textContent = '请从WPS表格的“项目询价”功能区打开';
    message.textContent = '此页面需要连接WPS中的工作簿。请在WPS内启动插件后读取清单。';
    return;
  }
  connection.textContent = '已连接WPS表格'; connection.classList.add('ready'); button.disabled = false;
  try { showBook(WpsHost.inspectWorkbook(application)); } catch (error) { message.textContent = error.message; }
  button.addEventListener('click', function () {
    button.disabled = true; parsed = null; page = 0;
    message.className = ''; message.textContent = '正在读取并识别全部工作表…';
    document.getElementById('sheets-section').hidden = true;
    document.getElementById('preview-section').hidden = true;
    setTimeout(function () {
      try {
        var snapshot = WpsHost.readWorkbook(application);
        parsed = RfqParser.parseWorkbook(snapshot); showBook(parsed);
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
        document.getElementById('sheet-count').textContent = parsed.sheets.length + ' 张';
        document.getElementById('sheets-section').hidden = false;
        document.getElementById('preview-section').hidden = false;
        mode.value = 'all'; renderPreview();
        var errors = parsed.issues.filter(function (issue) { return issue.severity === 'error'; }).length;
        message.className = errors ? 'error' : '';
        message.textContent = '已扫描 ' + parsed.sheets.length + ' 张工作表，识别 ' + parsed.materials.length + ' 条候选项。' +
          (parsed.issues.length ? '有 ' + parsed.issues.length + ' 个待核对问题' + (errors ? '，其中 ' + errors + ' 个阻止后续处理' : '') + '。' : '原始清单未修改。');
      } catch (error) {
        parsed = null;
        document.getElementById('sheets-section').hidden = true;
        document.getElementById('preview-section').hidden = true;
        message.className = 'error'; message.textContent = error.message;
      } finally { button.disabled = false; }
    }, 30);
  });
}());
