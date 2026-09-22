(function () {
  'use strict';
  var button = document.getElementById('read-workbook');
  var connection = document.getElementById('connection');
  var message = document.getElementById('message');
  var application = window.Application;
  function showBook(book) {
    document.getElementById('workbook-name').textContent = book.name;
    document.getElementById('workbook-detail').textContent = '共 ' + book.sheets.length + ' 张工作表';
  }
  if (!application) {
    connection.textContent = '请从WPS表格的“项目询价”功能区打开';
    message.textContent = '此页面需要连接WPS中的工作簿。请在WPS内启动插件后读取清单。';
    return;
  }
  connection.textContent = '已连接WPS表格';
  connection.classList.add('ready');
  button.disabled = false;
  try { showBook(WpsHost.inspectWorkbook(application)); } catch (error) { message.textContent = error.message; }
  button.addEventListener('click', function () {
    button.disabled = true;
    message.className = '';
    message.textContent = '正在读取全部工作表…';
    document.getElementById('sheets-section').hidden = true;
    // Let the host render the busy state before the synchronous WPS API call.
    setTimeout(function () {
      try {
        var snapshot = WpsHost.readWorkbook(application);
        showBook(snapshot);
        var list = document.getElementById('sheets');
        list.textContent = '';
        snapshot.sheets.forEach(function (sheet) {
          var row = document.createElement('li');
          var name = document.createElement('span'); name.textContent = sheet.name;
          var size = document.createElement('span'); size.textContent = sheet.rowCount + ' 行 × ' + sheet.columnCount + ' 列';
          row.appendChild(name); row.appendChild(size); list.appendChild(row);
        });
        document.getElementById('sheet-count').textContent = snapshot.sheets.length + ' 张';
        document.getElementById('sheets-section').hidden = false;
        message.textContent = '全部工作表读取完成，原始清单未修改。';
      } catch (error) {
        message.className = 'error'; message.textContent = error.message;
      } finally { button.disabled = false; }
    }, 30);
  });
}());
