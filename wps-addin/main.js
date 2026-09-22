document.write('<script src="src/host.js"><\/script>');

function OnAddinLoad(ribbonUI) {
  window.Application.PluginStorage.setItem('rfq.ribbon.loaded', true);
  return true;
}

function OnOpenRfqPane() {
  var application = window.Application;
  try {
    var id = application.PluginStorage.getItem('rfq.taskpane.id');
    var pane = null;
    if (id) {
      try { pane = application.GetTaskPane(id); } catch (_) { pane = null; }
    }
    if (!pane) {
      var base = window.location.href.split('?')[0];
      base = base.slice(0, base.lastIndexOf('/') + 1);
      pane = application.CreateTaskPane(base + 'taskpane.html');
      application.PluginStorage.setItem('rfq.taskpane.id', pane.ID);
    }
    pane.Visible = true;
    try { pane.Width = 380; } catch (_) { /* The host may manage pane width. */ }
    return true;
  } catch (error) {
    alert('无法打开项目询价侧栏：' + error.message);
    return false;
  }
}

function GetRfqImage() { return 'assets/inquiry.svg'; }
