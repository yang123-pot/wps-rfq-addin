(function (root) {
  'use strict';
  async function runProbe(application, outputPath, report) {
    var previous = application.ActiveWorkbook;
    var created = null;
    var reopened = null;
    var outcome = { stage: 'workbook-roundtrip', passed: false };
    try {
      if (application.FileSystem.Exists(outputPath)) throw new Error('目标文件已存在，未执行写入。');
      created = application.Workbooks.Add();
      var first = created.Worksheets.Item(1);
      first.Name = '询价测试';
      first.Range('A1:A2').NumberFormat = '@';
      first.Range('A1:B2').Value2 = [['项目编码', '工程量'], ['000123', 12.5]];
      var second = created.Worksheets.Add(null, first);
      second.Name = '来源测试';
      second.Range('A1:B2').Value2 = [['工程名称', '专业'], ['测试工程', '给排水']];
      created.SaveAs(outputPath, 51);
      created.Close(false);
      created = null;
      reopened = application.Workbooks.Open(outputPath, 0, true);
      var values = reopened.Worksheets.Item('询价测试').Range('A1:B2').Value2;
      var sources = reopened.Worksheets.Item('来源测试').Range('A1:B2').Value2;
      if (values[1][0] !== '000123' || values[1][1] !== 12.5 || sources[1][1] !== '给排水') {
        throw new Error('保存后重新打开的编码、工程量或中文来源与写入值不一致。');
      }
      outcome.passed = true;
      outcome.sheetCount = Number(reopened.Worksheets.Count);
      outcome.leadingZeroCode = values[1][0];
      outcome.quantity = values[1][1];
      outcome.source = sources[1][1];
    } catch (error) { outcome.error = error.message; }
    finally {
      try { if (reopened) reopened.Close(false); if (created) created.Close(false); }
      catch (error) { outcome.passed = false; outcome.cleanupError = error.message; }
      try { if (previous) previous.Activate(); } catch (_) { /* Source may have been closed by user. */ }
    }
    await report(outcome);
    return outcome;
  }

  async function readSources(application, paths, readWorkbook, report) {
    var previous = application.ActiveWorkbook;
    function key(path) { return String(path).replace(/\//g, '\\').toLowerCase(); }
    try {
      for (var i = 0; i < paths.length; i++) {
        var source = null, ownsSource = false, start = Date.now();
        try {
          for (var n = 1; n <= application.Workbooks.Count; n++) {
            var opened = application.Workbooks.Item(n);
            if (key(opened.FullName) === key(paths[i])) { source = opened; break; }
          }
          if (source) source.Activate();
          else { source = application.Workbooks.Open(paths[i], 0, true); ownsSource = true; }
          var snapshot = readWorkbook(application);
          await report({stage:'source-read',passed:true,sourceIndex:i + 1,elapsedMs:Date.now()-start,
            sheets:snapshot.sheets.map(function (s) {return {rows:s.rowCount,columns:s.columnCount,startRow:s.startRow,startColumn:s.startColumn};})});
        } catch (error) { await report({stage:'source-read',passed:false,sourceIndex:i + 1,error:error.message}); }
        finally { if (source && ownsSource) source.Close(false); }
      }
    } finally { if (previous) previous.Activate(); }
  }

  if (typeof module === 'object' && module.exports) { module.exports = {runProbe:runProbe,readSources:readSources}; return; }
  var config = root.__RFQ_PROBE__;
  if (!config) return;
  function report(result) {
    return fetch('/__probe/report', {method:'POST',headers:{'content-type':'application/json',
      'x-rfq-probe-token':config.token},body:JSON.stringify(result)});
  }
  root.addEventListener('error', function (event) { report({stage:'script-error',passed:false,error:event.message}); });
  report({stage:'javascript-loaded',passed:!!root.Application});
  var attempts = 0;
  async function waitForRibbon() {
    try {
      if (!root.Application || !root.Application.PluginStorage.getItem('rfq.ribbon.loaded')) {
        if (++attempts < 40) { setTimeout(waitForRibbon, 250); return; }
        throw new Error('未收到功能区加载完成信号');
      }
      await report({stage:'ribbon-loaded',passed:true,version:String(root.Application.Version)});
      var paneOpened = root.OnOpenRfqPane();
      await report({stage:'taskpane-opened',passed:paneOpened});
      await runProbe(root.Application, config.outputPath, report);
      await readSources(root.Application, config.sourcePaths || [], root.WpsHost.readWorkbook, report);
      await report({stage:'probe-finished',completed:true});
    } catch (error) { await report({stage:'probe-failed',passed:false,error:error.message}); }
  }
  setTimeout(waitForRibbon, 100);
}(typeof window === 'object' ? window : globalThis));
