const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 宿主窗口由WPS管理；此夹具保留创建、显隐、销毁和失效ID的边界，执行真实功能区代码。
function host(options = {}) {
  const values = new Map(), windows = new Map(), events = [];
  let next = 1;
  // F3：窗口位置/尺寸能力夹具。createApplies 模拟宿主支持CreateWebDialog的位置参数，
  // moveApplies 模拟宿主支持WebDialog.Move/Resize；boundsReadable 模拟Xpos/Ypos/Width/Height可读。
  const screen = options.screen === undefined
    ? { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }
    : options.screen;
  const storage = {
    getItem(k) { return values.get(k) ?? null; },
    setItem(k, v) {
      if (options.failRegister && k === 'rfq.webdialog.id') throw Error('登记失败');
      values.set(k, String(v));
    },
    removeItem(k) { values.delete(k); }
  };
  const app = {
    PluginStorage: storage,
    CreateWebDialog(url, title, width, height, modal, hasCaption, resizeEdge, errorUrl, loadingTimeout,
      isChildWindow, isUseCookie, xPos, yPos, popupMode) {
      events.push(['create', url, modal]);
      events.push(['create-arity', arguments.length]);
      events.push(['create-args', [url, title, width, height, modal, hasCaption, resizeEdge, errorUrl,
        loadingTimeout, isChildWindow, isUseCookie, xPos, yPos, popupMode]]);
      // 只认旧版最小签名的宿主：多传参数直接失败，产品必须退回不定位的最小调用而不是打不开窗口。
      if (options.strictSignature && [url, title, width, height, modal, hasCaption, resizeEdge, errorUrl, loadingTimeout,
        isChildWindow, isUseCookie, xPos, yPos, popupMode].slice(5).some(value => value !== undefined))
        throw Error('参数数量超出宿主支持范围');
      if (options.failCreate) return undefined;
      const id = next++;
      let visible = false;
      let x = options.createApplies && Number.isFinite(Number(xPos)) && Number(xPos) >= 0 ? Number(xPos) : 60;
      let y = options.createApplies && Number.isFinite(Number(yPos)) && Number(yPos) >= 0 ? Number(yPos) : 40;
      let dialogWidth = options.createApplies && Number(width) > 0 ? Number(width) : 400;
      let dialogHeight = options.createApplies && Number(height) > 0 ? Number(height) : 200;
      const moves = [];
      const dialog = { ID: id, Url: url, IsModal: modal,
        get Visible() { return visible; },
        set Visible(v) {
          if (options.failShow) throw Error('显示失败');
          visible = v; events.push(['visible', id, v]);
        },
        // 只读几何属性：宿主不支持时保持 undefined，产品代码必须如实标记“未定位”。
        get Xpos() { return options.boundsReadable === false ? undefined : (options.bogusBounds ? 7 : x); },
        get Ypos() { return options.boundsReadable === false ? undefined : (options.bogusBounds ? 9 : y); },
        get Width() { return options.boundsReadable === false ? undefined : dialogWidth; },
        get Height() { return options.boundsReadable === false ? undefined : dialogHeight; },
        Move(left, top) {
          moves.push([left, top]);
          events.push(['move', id, left, top]);
          if (options.failMove) throw Error('移动失败');
          if (!options.moveApplies) return;
          x = Number(left); y = Number(top);
        },
        Resize(w, h) {
          moves.push(['resize', w, h]);
          events.push(['resize', id, w, h]);
          if (options.failResize) throw Error('调整大小失败');
          if (!options.moveApplies) return;
          dialogWidth = Number(w); dialogHeight = Number(h);
        },
        Delete() {
          events.push(['delete', id]);
          if (options.failDelete) throw Error('销毁失败');
          windows.delete(id);
        }
      };
      windows.set(id, dialog);
      return dialog;
    },
    GetWebDialog(id) {
      if (options.failGet) throw Error('窗口查询失败');
      return windows.get(Number(id));
    },
    // 旧入口能运行，但它创建的是已证明停绘的TaskPane，不能冒充新窗口通过。
    CreateTaskPane(url) { events.push(['legacy-pane', url]); return { ID: 99, Visible: false }; },
    GetTaskPane() { return null; }
  };
  if (options.unsupported) delete app.CreateWebDialog;
  const context = { window: { Application: app, location: { href: 'http://127.0.0.1:38891/index.html' },
      screen },
    document: { write() {} },
    confirm() { events.push(['confirm']); return options.confirm !== false; },
    alert(msg) { events.push(['alert', msg]); }
  };
  const root = path.resolve(__dirname, '..');
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/ribbon-navigation.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), context);
  return { context, app, storage, windows, events };
}

test('快速打开非模态窗口，重复打开保留同一页面且不再创建', () => {
  const h = host();
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.equal(h.windows.size, 1, '必须创建WebDialog而非TaskPane');
  const first = [...h.windows.values()][0];
  assert.equal(first.IsModal, false);
  assert.equal(first.Url, 'http://127.0.0.1:38891/taskpane.html');
  assert.equal(first.Visible, true);
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.equal(h.windows.size, 1);
  assert.equal(h.events.filter(e => e[0] === 'create').length, 1);
  assert.equal(h.events.some(e => e[0] === 'legacy-pane'), false);
});

test('真人关闭后ID失效，下一次阶段入口创建新窗口并只写导航请求', () => {
  const h = host();
  h.context.OnOpenRfqPane();
  h.windows.clear();
  assert.equal(h.context.OnGotoStage({ tag: 'review' }), true);
  assert.equal(h.windows.size, 1);
  assert.equal([...h.windows.keys()][0], 2);
  assert.equal(JSON.parse(h.storage.getItem('rfq.window.nav.request')).stage, 'review');
  assert.equal(h.events.some(e => e[0] === 'confirm'), false);
});

test('隐藏但未销毁的窗口重新显示，保留页面且不创建重复窗口', () => {
  const h = host();
  h.context.OnOpenRfqPane();
  assert.equal(h.windows.size, 1);
  const dialog = [...h.windows.values()][0];
  dialog.Visible = false;
  h.context.OnOpenRfqPane();
  assert.equal(dialog.Visible, true);
  assert.equal(h.events.filter(e => e[0] === 'create').length, 1);
});

test('取消手动重建保留原窗口及页面内存', () => {
  const h = host({ confirm: false });
  h.context.OnOpenRfqPane();
  assert.equal(h.windows.size, 1);
  const original = [...h.windows.values()][0];
  assert.equal(h.context.OnReloadRfqPane(), false);
  assert.equal([...h.windows.values()][0], original);
  assert.equal(h.events.some(e => e[0] === 'delete'), false);
});

test('确认手动重建先销毁自有窗口，再创建一份新页面', () => {
  const h = host();
  h.context.OnOpenRfqPane();
  assert.equal(h.context.OnReloadRfqPane(), true);
  assert.equal(h.windows.size, 1);
  assert.equal([...h.windows.keys()][0], 2);
  assert.deepEqual(h.events.filter(e => ['confirm', 'delete', 'create'].includes(e[0])).map(e => e[0]),
    ['create', 'confirm', 'delete', 'create']);
});

test('销毁失败时保留原窗口，不创建第二份也不报重建成功', () => {
  const h = host({ failDelete: true });
  h.context.OnOpenRfqPane();
  assert.equal(h.context.OnReloadRfqPane(), false);
  assert.equal(h.windows.size, 1);
  assert.equal(h.events.filter(e => e[0] === 'create').length, 1);
  assert.ok(h.events.some(e => e[0] === 'alert' && /销毁失败/.test(e[1])));
});

test('宿主缺少窗口API时明确失败，不退回已停绘的侧栏', () => {
  const h = host({ unsupported: true });
  assert.equal(h.context.OnOpenRfqPane(), false);
  assert.equal(h.context.OnGotoStage({ tag: 'import' }), false);
  assert.equal(h.events.some(e => e[0] === 'legacy-pane'), false);
  assert.equal(h.storage.getItem('rfq.window.nav.request'), null);
  assert.ok(h.events.some(e => e[0] === 'alert'));
});

test('宿主查询失败时停止，不能把未知状态当作已关闭创建重复窗口', () => {
  const h = host({ failGet: true });
  h.storage.setItem('rfq.webdialog.id', '7');
  assert.equal(h.context.OnOpenRfqPane(), false);
  assert.equal(h.windows.size, 0);
  assert.equal(h.events.some(e => e[0] === 'create'), false);
});

test('创建或显示失败不报打开成功，显示失败释放刚创建的自有窗口', () => {
  const failed = host({ failCreate: true });
  assert.equal(failed.context.OnOpenRfqPane(), false);
  const hidden = host({ failShow: true });
  assert.equal(hidden.context.OnOpenRfqPane(), false);
  assert.equal(hidden.windows.size, 0);
  assert.equal(hidden.storage.getItem('rfq.webdialog.id'), null);
});

test('登记及销毁均失败时再次打开不得重复创建，登记恢复后复用原实例', () => {
  const options = { failRegister: true, failDelete: true }, h = host(options);
  assert.equal(h.context.OnOpenRfqPane(), false);
  assert.equal(h.context.OnOpenRfqPane(), false);
  assert.equal(h.windows.size, 1);
  assert.equal(h.events.filter(e => e[0] === 'create').length, 1);
  options.failRegister = false;
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.equal(h.windows.size, 1);
  assert.equal(h.storage.getItem('rfq.webdialog.id'), '1');
});

// F3：窗口位置/尺寸能力。宿主文档的CreateWebDialog支持位置参数、WebDialog支持Move/Resize和只读几何属性，
// 但不同版本可能忽略其中之一，所以产品只“尝试”定位并读回核对，核对不上就如实标记未定位，窗口照常打开。
test('窗口按右下锚点定位避开顶部功能区，并用只读坐标读回核对', () => {
  const h = host({ createApplies: true });
  assert.equal(h.context.OnOpenRfqPane(), true);
  const args = h.events.filter(e => e[0] === 'create-args').at(-1)[1];
  assert.deepEqual([args[2], args[3]], [440, 720], '窗口尺寸保持440×720');
  assert.deepEqual([args[11], args[12]], [1464, 180], '右边贴齐、顶边避开功能区/编辑栏');
  const placement = h.context.window.RfqRibbonNavigation.placementReport();
  assert.equal(placement.placed, true);
  assert.equal(placement.verified, true);
  assert.equal(placement.via, 'create', '创建时的位置参数生效即算已定位');
  assert.deepEqual([placement.bounds.x, placement.bounds.y], [1464, 180]);
  assert.deepEqual(h.events.filter(e => e[0] === 'move'), [], '已生效时不再多余移动窗口');
});

test('屏幕可用高度不足时收窄窗口高度，仍不遮顶部功能区', () => {
  const h = host({ createApplies: true, screen: { availLeft: 0, availTop: 0, availWidth: 1366, availHeight: 700 } });
  assert.equal(h.context.OnOpenRfqPane(), true);
  const args = h.events.filter(e => e[0] === 'create-args').at(-1)[1];
  assert.deepEqual([args[2], args[3]], [440, 504], '高度收窄到功能区之下的剩余空间');
  assert.deepEqual([args[11], args[12]], [910, 180], '顶边仍在功能区之下');
  assert.equal(180 + 504 <= 700 - 16, true, '窗口整体落在屏幕可用区域内');
});

test('宿主忽略创建位置参数时改用Move/Resize兜底并读回核对', () => {
  const h = host({ moveApplies: true });
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.deepEqual(h.events.filter(e => ['resize', 'move'].includes(e[0])).map(e => e.slice(0, 2)),
    [['resize', 1], ['move', 1]], '先调尺寸再移动，且各只调用一次');
  const placement = h.context.window.RfqRibbonNavigation.placementReport();
  assert.equal(placement.placed, true);
  assert.equal(placement.verified, true);
  assert.equal(placement.via, 'move');
  assert.deepEqual([placement.bounds.x, placement.bounds.y], [1464, 180]);
});

test('宿主不支持定位与尺寸读回时窗口仍打开，并如实标记未定位', () => {
  const h = host({ boundsReadable: false, moveApplies: false });
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.equal(h.windows.size, 1, '定位能力缺失不得阻止窗口打开');
  const placement = h.context.window.RfqRibbonNavigation.placementReport();
  assert.equal(placement.placed, false);
  assert.equal(placement.verified, false);
  assert.equal(placement.reason, 'host-unsupported', '宿主不支持时给出可复现的原因');
  assert.deepEqual(h.events.filter(e => e[0] === 'alert'), [], '不得把定位失败报成打开失败');
});

test('读不到屏幕可用区域时不做定位，仍按宿主默认位置打开', () => {
  const h = host({ screen: null });
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.deepEqual(h.events.filter(e => e[0] === 'create-arity').at(-1), ['create-arity', 5],
   '没有可用区域时用最小签名交回宿主自动定位');
  const placement = h.context.window.RfqRibbonNavigation.placementReport();
  assert.equal(placement.placed, false);
  assert.equal(placement.reason, 'no-screen');
});

test('读回坐标与请求不一致时不得声称已定位', () => {
  const h = host({ boundsReadable: true, bogusBounds: true });
  assert.equal(h.context.OnOpenRfqPane(), true);
  const placement = h.context.window.RfqRibbonNavigation.placementReport();
  assert.equal(placement.placed, false);
  assert.equal(placement.verified, false);
  assert.equal(placement.reason, 'readback-mismatch');
  assert.deepEqual([placement.bounds.x, placement.bounds.y], [7, 9], '保留宿主实际坐标供核对');
});

test('宿主只认最小创建签名时退回不定位调用，窗口仍打开', () => {
  const h = host({ strictSignature: true, moveApplies: true });
  assert.equal(h.context.OnOpenRfqPane(), true);
  assert.equal(h.windows.size, 1, '定位参数不被接受的宿主仍必须能打开窗口');
  const args = h.events.filter(e => e[0] === 'create-args').map(e => e[1]);
  assert.equal(args.length, 2, '先试完整参数，失败后退回最小签名');
  assert.deepEqual(args[0].slice(11, 13), [1464, 180], '第一次带位置参数');
  assert.equal(args[0].length, 14, '第一次按宿主文档的完整签名调用');
  assert.deepEqual(args[1], [args[0][0], '材料整理助手', 440, 720, false, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined], '退回时只用最小签名');
  const placement = h.context.window.RfqRibbonNavigation.placementReport();
  assert.equal(placement.createdWith, 'minimal');
  assert.equal(placement.verified, true, '退回创建后仍用Move/Resize尝试定位并读回核对');
  assert.deepEqual(h.events.filter(e => e[0] === 'alert'), [], '不得把定位能力缺失报成打开失败');
});
