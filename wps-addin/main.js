document.write('<script src="src/host.js"><\/script>');
document.write('<script src="src/ribbon-navigation.js"><\/script>');

function OnAddinLoad(ribbonUI) {
  window.Application.PluginStorage.setItem('rfq.ribbon.loaded', true);
  return true;
}

function OnOpenRfqPane() {
  try {
    if (!window.RfqRibbonNavigation) throw Error('窗口管理脚本未加载，请检查插件服务后重新加载本插件。');
    return !!window.RfqRibbonNavigation.ensureWindow(window.Application);
  } catch (error) {
    alert('无法打开项目询价窗口：' + error.message);
    return false;
  }
}

// R12-K：功能区“阶段快捷入口”。只显示询价窗口并把一个 {id,stage} 导航请求交给页面，
// 不执行确认、学习、写表或拆分，也不传递材料内容；阶段自身的前置条件仍由各阶段原按钮判定。
function OnGotoStage(control) {
  try {
    // 旧开发服务可能还没提供新增导航脚本；此时不创建窗口、也不误报导航成功。
    if (!window.RfqRibbonNavigation) return false;
    var stage = window.RfqRibbonNavigation.stageFromControl(control);
    if (!stage) return false;
    return window.RfqRibbonNavigation.openStage(window.Application, stage);
  } catch (error) {
    alert('无法打开项目询价窗口：' + error.message);
    return false;
  }
}

function OnReloadRfqPane() {
  try {
    if (!window.RfqRibbonNavigation) throw Error('窗口管理脚本未加载，请检查插件服务后重新加载本插件。');
    return window.RfqRibbonNavigation.rebuildWindow(window.Application, {
      confirm: function () {
        return confirm('重建询价窗口会清除尚未保存的页面修改。请先保存核对记录和项目；确定继续吗？');
      }
    });
  } catch (error) {
    alert('无法重建项目询价窗口：' + error.message);
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
