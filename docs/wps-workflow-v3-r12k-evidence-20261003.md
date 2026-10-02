# R12-K 证据：补功能区阶段快捷入口（2026-10-03）

**范围：** 只做 R12-K。不改 R12-L 及以后任何包，也不重跑导入/确认业务。

**基线/包提交：** 分支 `feat/wps-phase1`，本会话开工 HEAD `7d33032f77260cc6ef29533ac28ecaece7d6c65e`
（提示词记录的 `63dde1e9…` 是更早拆分时的快照，代码基线 `e6f8ff26…` 未变）。开工工作区只有 1 个未提交修改
`wps-addin/dev/pane-diagnostics.js`（原样保留、未暂存）。包提交与远程 SHA 以实际 `git` 结果为准。

**对应图：** 图01、图07 及现有七步导航，开工前实际打开查看。图01 功能区“项目询价”选项卡含七个阶段图标
（导入清单/自动分类/表内审核/分类工作簿/品牌汇总/询价表/拆分文件），侧栏显示同一七步导航；图07 第7步高亮，
功能区同为同一排阶段图标。

**宿主/环境：** WPS 表格 `12.1.0.29161`（`E:\WPS\WPS Office\12.1.0.29161\office6\wps.exe` 在运行），
本机 `dev/server.cjs --port 38891` 开发服务在运行。**本会话 Computer Use 仍无原生窗口**
（`cua.getState()` 返回 `apps:[]`、`errors:["Browser 3: … unsupported Codex auth method: apikey"]`），
因此**没有在真实 WPS 功能区点按**；真机点击挂账，见第 5 节。

## 1. 改动与接口

保留全部既有入口（打开询价助手、侧栏停住时重建），只补齐功能区阶段入口；导航只复用既有 `workflow.goTo(stage)`/`current()`。

| 文件 | 改动 |
| --- | --- |
| `wps-addin/ribbon.xml` | 新增分组“阶段导航”，7 个大按钮（`rfqStageImport/Matching/Review/Categories/Brands/Inquiry/Split`，`tag` 分别为7个既有阶段ID，`onAction="OnGotoStage"`）；原“侧栏”分组保留打开/重建两个按钮 |
| `wps-addin/main.js` | 注入 `src/ribbon-navigation.js`；新增 `OnGotoStage(control)`；打开/重建改走同一 `RfqRibbonNavigation.ensurePane`，事件次序与原实现一致 |
| `wps-addin/src/ribbon-navigation.js`（新增） | 导航桥：`isStage`/`stageFromControl`/`request`/`readRequest`/`consume`/`watch`/`ensurePane`/`openStage`；只传 `{id,stage}`，不传材料内容 |
| `wps-addin/src/workflow-ui.js` | 侧栏创建七步 UI 后启动一次“导航请求检查”接力，消费请求只调用 `goTo(stage)` |
| `wps-addin/taskpane.html` | 注册 `src/ribbon-navigation.js`（在 `workflow-ui.js` 之前） |
| `wps-addin/dev/server.cjs` | 静态资源白名单加入 `/src/ribbon-navigation.js` |
| `wps-addin/test/ribbon-navigation.test.cjs`（新增） | 模块级 11 项：阶段合法性、请求只含 id+stage、写入侧拒绝非法 stage、控件解析、只导航不产生业务副作用、一次性消费、重建不重播、坏请求丢弃、低频接力、`openStage` |
| `wps-addin/test/ribbon-recovery.test.cjs` | 扩充 7 项：功能区七步入口与标签、只写一次请求且不重载/不弹确认、非法阶段拒绝、未打开先打开再写、已打开只聚焦、请求可被侧栏一次性消费、未加载导航脚本时打开/重建仍可用 |
| `wps-addin/test/ui-workflow-check.cjs` | 扩充 R12-K 段：真实侧栏消费七个阶段请求、非法阶段被丢弃、副作用计数为0、重建不重播 |

**兼容性：** `OnOpenRfqPane`/`OnReloadRfqPane` 保持原实现不动，因此即使开发服务还没提供新增导航脚本，
“打开询价助手/侧栏停住时重建”也不会回归；`OnGotoStage` 在缺少导航脚本时静默返回 false，不误报成功、不产生宿主操作
（有用例 `未加载导航脚本时打开与重建仍可用，阶段入口静默不产生副作用`）。

**桥接设计（按“不新增常驻重载定时器”）：** 功能区页与侧栏页共用 `Application.PluginStorage`，请求键 `rfq.nav.request`。
侧栏启动时先消费一次（覆盖“侧栏未打开时功能区先写入”），已打开时靠低频“导航请求检查”接力：只读一个存储键、
**不重载页面**、页面隐藏时暂停、恢复可见/窗口聚焦时立即补查。每个请求消费后立刻移除并记录已消费 id，
所以重建不重播、重复读取不重复导航。该检查不触发确认/学习/写表/拆分。

## 2. 验证结果（本机）

命令与日志在 `outputs/wps-acceptance-20260927/R12-K/logs/`，全部为真实执行输出。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| Ribbon 恢复/导航 | `node --test test/ribbon-navigation.test.cjs test/ribbon-recovery.test.cjs` | **24/24 通过**（`node-ribbon.log`） |
| 全量 Node | `node --test test/*.test.cjs` | **390/390 通过**（R12-J 372 ＋ 本包 18，`node-full.log`） |
| 浏览器 UI | `node test/ui-workflow-check.cjs`（`NODE_PATH` 指向已有 playwright＋系统 Edge） | **PASS**（`ui-workflow.log`） |
| 全量 UI | 17 个 `test/ui-*-check.cjs` | **17/17 PASS**（`ui-suite.log`） |
| Python 审计 | `python -m unittest discover -s wps-addin/test -p test_audit_outputs.py` | **8/8 OK** |

关键断言（`ribbon-navigation.test.cjs` / `ui-workflow-check.cjs`）：每个快捷入口只调用一次 `goTo`，
`confirm`/`learn`/`write`/`split` 计数为 0；非法阶段被写入侧和消费侧双双拒绝且丢弃请求；
“未打开→打开时消费”“已打开→低频接力消费”“重建→不重播”三种状态各有用例。

## 3. 本机界面证据（`R12-K/screens/`，不入 Git）

用真实插件页面代码 + 真实 `dev/server.cjs`，走与 `main.js` `OnGotoStage` **同一条**真实模块入口
`RfqRibbonNavigation.openStage` 写入 `{id,stage}`，由真实侧栏代码消费后截图（`evidence.json` 记录每一步的目标阶段、
当前阶段、当前标签与“请求已消费”）。**口径：这是真实插件界面的阶段定位，不是真实 WPS 功能区点按。**

| 文件 | 内容 |
| --- | --- |
| `screens/stage-1-import.png` … `stage-7-split.png` | 七个快捷入口各一张；整页截图同时含七步导航高亮与对应阶段面板（例如第4步“分类工作簿”高亮 + “04 …”面板 + 上游未完成提示） |
| `screens/narrow-320-split.png` | 320px 侧栏下七步仍可点、无横向滚动 |
| `evidence.json` | 七步 `produced=true`、`currentStage` 与目标一致、`requestConsumed=null`；非法阶段后仍停在第7步且请求为空；`narrow={scrollWidth:320,clientWidth:320,steps:7}`；`pageErrors=[]`；`ribbon` 为从真实 `ribbon.xml` 解析出的分组/按钮清单 |

## 4. 前置条件仍由原按钮判定（未绕过）

导航只切换阶段并渲染该阶段原有面板；生成/确认按钮的真实条件不变（`stage-4-categories.png` 显示
“尚未完成整表审核确认 / 当前进度 4 / 7”、生成按钮保持禁用）。恢复按钮 `OnReloadRfqPane` 原行为保留
（`ribbon-recovery.test.cjs` 原有 6 项全部继续通过：确认后重建、取消不重建、不支持隐藏仍导航、无旧侧栏时新建、旧句柄失效时新建）。

## 5. 未完成与真实例外（如实挂账）

- **未在真实 WPS 功能区点按。** 本会话 Computer Use 没有原生窗口（`apps:[]`，`unsupported Codex auth method: apikey`），
  无法点击真实功能区或截取真实 WPS 窗口；本包**不声称真机通过**。按计划第4/5步，“真机逐个点击核对应阶段、留功能区真实截图”**挂账**，
  与 R12-A/C/D/E/F/I 的窗口限制同一原因。
- 运行中的 `dev/server.cjs`（pid 27260，R12-J 的 `ui-data` 参数）在本包改动前启动，其内存白名单**没有**
  `/src/ribbon-navigation.js`；要让快捷入口在**已在运行的 WPS 会话**出现，需要重启该开发服务并在 WPS 重新加载加载项。
  本包不擅自重启用户会话中的 WPS；该操作与真机点击一并留待有窗口控制时执行。
- 七步入口共用同一 `assets/inquiry.svg` 图标，与获批图的多图标美术有视觉差异（功能不受影响，属已知外观差额）。

## 6. 下一包

R12-L（四项目复制件与完整 R12 出口）。本会话到此停止，不开始 R12-L 及以后任何包。
