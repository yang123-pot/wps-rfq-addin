(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WpsHost = api;
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  var MAX_SHEET_CELLS = 1000000;
  var MAX_BOOK_CELLS = 3000000;

  function activeBook(application) {
    if (!application) throw new Error('请在WPS表格中启动“项目询价”插件。');
    var book = application.ActiveWorkbook;
    if (!book) throw new Error('请先打开一个招标清单工作簿。');
    return book;
  }

  function metadata(sheet) {
    var name = String(sheet.Name);
    try {
      var range = sheet.UsedRange;
      var result = { name: name, startRow: Number(range.Row), startColumn: Number(range.Column),
        rowCount: Number(range.Rows.Count), columnCount: Number(range.Columns.Count) };
      ['startRow', 'startColumn', 'rowCount', 'columnCount'].forEach(function (key) {
        if (!Number.isSafeInteger(result[key]) || result[key] < 1) throw new Error('工作表范围无效');
      });
      return result;
    } catch (error) {
      throw new Error('“' + name + '”读取范围失败：' + error.message);
    }
  }

  function inspect(book) {
    var count = Number(book.Worksheets.Count);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('工作簿中没有可读取的工作表。');
    var result = { name: String(book.Name), path: String(book.FullName || ''), sheets: [] };
    for (var i = 1; i <= count; i++) result.sheets.push(metadata(book.Worksheets.Item(i)));
    return result;
  }

  function inspectWorkbook(application) { return inspect(activeBook(application)); }

  function readWorkbook(application) {
    var book = activeBook(application);
    var result = inspect(book);
    var total = 0;
    result.sheets.forEach(function (sheet) {
      var size = sheet.rowCount * sheet.columnCount;
      if (size > MAX_SHEET_CELLS) throw new Error('“' + sheet.name + '”使用范围过大，请先清理多余空白区域的格式。');
      total += size;
    });
    if (total > MAX_BOOK_CELLS) throw new Error('工作簿总读取范围过大，请分开处理或清理多余空白格式。');
    result.sheets.forEach(function (sheet, index) {
      try {
        var values = book.Worksheets.Item(index + 1).UsedRange.Value2;
        if (sheet.rowCount === 1 && sheet.columnCount === 1 && !Array.isArray(values)) values = [[values == null ? null : values]];
        if (!Array.isArray(values) || values.length !== sheet.rowCount || values.some(function (row) {
          return !Array.isArray(row) || row.length !== sheet.columnCount;
        })) throw new Error('接口返回的单元格数据不完整，已停止读取');
        sheet.values = values.map(function (row) { return row.slice(); });
      } catch (error) {
        throw new Error('“' + sheet.name + '”读取失败：' + error.message);
      }
    });
    return result;
  }

  function locateSource(application, source) {
    var book = activeBook(application);
    function identity(path) { return String(path || '').replace(/[\\/]+/g, '/').toLowerCase(); }
    if ((source.path && identity(book.FullName) !== identity(source.path)) ||
        (!source.path && String(book.Name) !== source.file)) throw new Error('当前已切换工作簿，请先回到读取时的原工作簿，再定位或重新读取。');
    if (!Number.isSafeInteger(source.row) || source.row < 1 || !Number.isSafeInteger(source.column) || source.column < 1) throw new Error('来源行列无效，请重新读取清单。');
    var sheet = book.Worksheets.Item(source.sheet);
    if (!sheet) throw new Error('原工作表不存在，请重新读取清单。');
    sheet.Activate();
    sheet.Cells.Item(source.row, source.column).Select();
  }
  return { inspectWorkbook: inspectWorkbook, readWorkbook: readWorkbook, locateSource: locateSource };
}));
