document.write('<script src="src/host.js"><\/script>');
document.write('<script src="src/ribbon-navigation.js"><\/script>');

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

// R12-K：功能区“阶段快捷入口”。只打开/聚焦侧栏并把一个 {id,stage} 导航请求交给侧栏，
// 不执行确认、学习、写表或拆分，也不传递材料内容；阶段自身的前置条件仍由各阶段原按钮判定。
function OnGotoStage(control) {
  try {
    // 旧开发服务可能还没提供新增导航脚本；此时不打开侧栏、也不误报，避免影响原有打开/重建入口。
    if (!window.RfqRibbonNavigation) return false;
    var stage = window.RfqRibbonNavigation.stageFromControl(control);
    if (!stage) return false;
    return window.RfqRibbonNavigation.openStage(window.Application, stage);
  } catch (error) {
    alert('无法打开项目询价侧栏：' + error.message);
    return false;
  }
}

function OnReloadRfqPane() {
  var application = window.Application;
  try {
    var id = application.PluginStorage.getItem('rfq.taskpane.id');
    var pane = null;
    if (id) {
      try { pane = application.GetTaskPane(id); } catch (_) { pane = null; }
    }
    if (!pane) return OnOpenRfqPane();
    if (!confirm('重建侧栏会清除尚未保存的页面修改。请先保存核对记录；确定继续吗？')) return false;
    var base = window.location.href.split('?')[0];
    base = base.slice(0, base.lastIndexOf('/') + 1);
    // 实机证据（2026-09-26）：侧栏画面停住后，内嵌网页已不再出帧，单靠 Navigate 和按 F5 都不能恢复。
    // 这里按“重建”处理：先隐藏再显示窗格、轻微改动一次宽度，让宿主重新显示内嵌网页并重新布局，
    // 最后再导航到当前版本的页面。每一步都单独兜底，任何一步不被宿主支持也不会中断恢复。
    try { pane.Visible = false; } catch (_) { /* 宿主不支持隐藏时照常继续 */ }
    try { pane.Visible = true; } catch (_) { /* 同上 */ }
    try { pane.Width = 381; pane.Width = 380; } catch (_) { /* 宿主可能自行管理宽度 */ }
    pane.Navigate(base + 'taskpane.html');
    return true;
  } catch (error) {
    alert('无法重载项目询价侧栏：' + error.message);
    return false;
  }
}

// 本地静态图标按控件ID区分七阶段；取图不依赖导航脚本，也不访问宿主或项目数据。
function GetRfqImage(control) {
  var id = control && (control.Id || control.id || control.ID);
  switch (id) {
    case 'rfqStageImport': return 'assets/import.svg';
    case 'rfqStageMatching': return 'assets/matching.svg';
    case 'rfqStageReview': return 'assets/review.svg';
    case 'rfqStageCategories': return 'assets/categories.svg';
    case 'rfqStageBrands': return 'assets/brands.svg';
    case 'rfqStageSplit': return 'assets/split.svg';
    default: return 'assets/inquiry.svg';
  }
}
