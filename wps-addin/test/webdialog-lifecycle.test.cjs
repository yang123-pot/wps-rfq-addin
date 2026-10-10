const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 宿主窗口由WPS管理；此夹具保留创建、显隐、销毁和失效ID的边界，执行真实功能区代码。
function host(options = {}) {
  const values = new Map(), windows = new Map(), events = [];
  let next = 1;
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
    CreateWebDialog(url, title, width, height, modal) {
      events.push(['create', url, modal]);
      if (options.failCreate) return undefined;
      const id = next++;
      let visible = false;
      const dialog = { ID: id, Url: url, IsModal: modal,
        get Visible() { return visible; },
        set Visible(v) {
          if (options.failShow) throw Error('显示失败');
          visible = v; events.push(['visible', id, v]);
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
  const context = { window: { Application: app, location: { href: 'http://127.0.0.1:38891/index.html' } },
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
