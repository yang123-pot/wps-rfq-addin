# 材料整理助手界面简化证据（2026-10-17）

工作包：F9（UI 简化），入口 HEAD `da04293a69c504a8b9cb8f87ac24b0242448ddab`。用户已确认三步简版效果图，并明确目标用户是普通材料询价员、只需要基本电脑操作。

## 1. 结论

已完成默认七步简洁版、设置菜单、完成页、详细模式切换和用户可见名称调整。右侧始终显示七步列表，当前步骤只保留一个主操作；次要动作收进“更多操作”。内部注册身份 `WpsRfqAddin` 保持不变，避免升级产生两个插件。

尚未完成：重启 WPS 后的新功能区/新窗口真实截图、最终候选包、提交推送。以下浏览器检查均使用 Edge/Playwright 模拟宿主，不替代真实 WPS。

## 2. 已批准效果图

归档：`docs/mockups/approved-20261017-ui-simplify/`

- `01-current-step.png`：默认当前一步，一个主按钮；
- `02-done.png`：完成页，只保留“打开文件夹/再做一单”；
- `03-settings.png`：设置菜单，项目/单位信息/材料分类/遇到问题/详细步骤。

SHA 见同目录 `manifest.json`。

## 3. 代码改动

- `taskpane.html`：标题改为“材料整理助手”；新增七步纵向列表、当前任务卡、设置菜单、详细模式按钮和齿轮；页脚改为“材料整理助手 · 七步简洁版”。
- `styles.css`：新增七步列表、单主按钮卡、设置菜单、窄侧栏头部布局；默认隐藏七步详细区和辅助区，`body.detail-mode` 下恢复。
- `src/workflow-ui.js`：新增七步状态机（选清单/核对分类/审核确认/分类工作簿/填品牌/生成询价表/拆分文件）、单主按钮路由、设置菜单、详细模式切换、项目状态和拆分状态监听；保留原有七步导航和所有阶段面板。
- `src/project-ui.js`：项目状态更新时广播 `rfq:project-status`，让简版步骤及时前进。
- `ribbon.xml`：功能区从七个阶段按钮收为三个大入口，保留“打开材料整理助手/重建窗口”。
- `main.js`、`src/ribbon-navigation.js`、`src/taskpane.js`：窗口标题、提示和按钮显示名改为“材料整理助手/材料整理”；内部 GUID 不变。
- `package.json`：增加 `displayName: 材料整理助手`，`name` 仍为 `wps-rfq-addin`。
- `install.ps1`/`uninstall.ps1`：安装/卸载提示改为材料整理助手。

## 4. 验证

### 4.1 全量 Node

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：**518/518 通过，0 失败/0 跳过**（F8 为 517，新增简版按钮映射用例）。

### 4.2 简版浏览器检查

```powershell
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-simple-check.cjs
```

结果：**PASS**。覆盖默认七步列表可见、七步详细区默认隐藏、设置菜单打开/关闭、详细模式七步恢复、主按钮进入对应任务面板、项目状态推进到填品牌/生成询价/完成页、380px 无横向溢出。

### 4.3 原有 UI 检查

原有 UI 检查统一加 `?mode=detail`，在详细模式运行；已实跑：

- `ui-workflow-check`、`ui-brand-check`、`ui-inquiry-check`、`ui-split-check`、`ui-project-check`、`ui-sheet-review-check`：PASS；
- `ui-cancel-check`、`ui-category-check`、`ui-classification-check`、`ui-project-restore-check`、`ui-source-review-restore-check`、`ui-startup-navigation-check`、`ui-import-check`、`ui-library-check`、`ui-export-check`、`ui-review-check`、`ui-check`：PASS。

日志本机 `outputs/wps-phase1-ui-simplify-20261017/`。

### 4.4 380px 真实页面截图

从本机 `http://127.0.0.1:38891/taskpane.html` 以 380×900 浏览器视口截取 `live-pane-simple.png`、`live-pane-detail.png`。简版头部、七步列表和当前任务卡无横向溢出；该截图是浏览器页面，不是 WPS 浮窗。

### 4.5 UI1 预览候选

- 包名：`wps-material-organizer-0.1.0-20261017-UI1.zip`；版本 `0.1.0`，构建标签 `20261017-UI1`；
- 82 个文件；运行代码版本 `6ae5fbe818adca9c720aea5001c75a48b006535ae0ebe9f890295e9dad502b3c`；
- zip SHA-256 `7f1d3633d3ebdf1847e21e480a2fe4db2175c6e3880f6981a3063f0df66d68b8`，923,644 字节；
- 解压后隔离安装/健康/43 个脚本与 7 个图标读取/生产入口探针 404/卸载均通过；
- 候选清单 `candidate-ui1-manifest.json` 与 `docs/wps-ui1-preview-manifest-20261017.json`。

## 5. 真实 WPS 边界

- 用户已重启 WPS，新功能区“材料整理”和窗口标题“材料整理助手”已加载；真实功能区截图见 `real-wps-ribbon.png`。
- 面板 HTML/JS/CSS 已由本机服务提供；当前仍打开的旧窗口仍是三步稿，关闭/重开窗口后才能加载七步列表。尚未截到新的七步真实浮窗。
- 需用户关闭当前“材料整理助手”窗口，再从功能区“材料整理 → 打开材料整理助手”重开，停在第一步；随后截取七步真实窗口并核对单主按钮/更多操作。

## 6. 未完成

- 真实 WPS 七步新窗口截图（功能区已加载，仍需关闭重开当前旧窗口）；
- UI1 源码/清单已提交并普通推送：源码 `9fb09ca74ac409f26273238747e1bed9838276a2`，清单 `4c311907aa91d9982b364a433e23ea8a19167801`；最终文档提交与远程 SHA 以本机 `outputs/wps-phase1-ui-simplify-20261017/backup-receipt-ui1.json` 及最终报告为准。
