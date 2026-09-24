# P1–P9 集中修复与验证记录

日期：2026-09-24。基线：`b8219b9`。本文件只记录本轮可复核的证据；运行数据仍留在 `outputs/`，不入仓库。

## 已修复：P8 合并表写入前核对哈希

- `export-files.cjs` 的 `verify(ticket,target,sha256)` 只接受本机服务已成功发布且未过期的票据、相同目标与回执哈希，重新读取目标文件计算 SHA256；不一致时拒绝。
- `/api/export/verify` 继续使用导入会话令牌和本机 Host/Origin 限制。分类侧栏取得核对回执后才调用 WPS 写列；等待期间若核对状态、来源集合或合并选择变化，旧计划不执行。
- 失败测试先复现 `store.verify is not a function`、接口未开放，以及目标文件变化后侧栏超时等待阻断提示；修复后专门测试与整体回归均通过。浏览器用例把刚另存的文件改写，确认 WPS 写入记录仍为零；还覆盖了校验期间切换合并选择。
- 已写入分类列会改变文件 SHA256；再次写入前须重新另存内部清单并取得新回执。后续若要支持同一合并表反复修改分类，应另设计受控回执更新，不能跳过哈希核对。

## P1/P3/P4：真实 WPS 侧栏取证

- 探针模式新增 `dev/pane-diagnostics.js`，每 3 秒及点击、滚轮、按键、焦点、滚动事件上报侧栏 DOM 数量、按钮/fieldset 状态、窗口几何、可见性与动画帧计数；不传文件名、路径或单元格内容。正式模式不提供脚本或上报接口。
- `ui-pane-diagnostics-check.cjs` 在 Edge 中实际加载侧栏并触发点击，报告中的 DOM 几何与事件字段可读取。此项只能证明探针可用，不能证明 WPS 已修好。
- 首次用户报告“点击无反应”时服务已停止，那一次没有诊断价值。随后恢复探针服务，`/health` 返回 `mode:probe`；用户通过“项目询价 → 打开询价助手侧边栏”打开真实 WPS 窗格，报告出现 `pane-ready` 和连续心跳。
- 在旧窗格中选择合成测试文件后，服务端生成 1 份副本，DOM 的 `importCount` 从 0 变为 1，`importComplete=true`，页面高度从约 1879 增至约 4700，按钮与控件均未禁用。用户看到的画面却没有变化。多次滚轮事件到达页面，但 `scrollY` 始终为 0；`requestAnimationFrame` 计数停在 21，而定时心跳继续。用户尝试关闭、重开侧栏仍无反应。证据支持“旧窗格的画面/滚动状态与运行中的 DOM 脱节”，还不足以证明 WPS 宿主的具体根因。
- 用户按正常方式保存、退出并重启 WPS 表格后，新的 `et.exe` 位于 `12.1.0.29161`。新窗格的滚动事件使 `scrollY` 连续变化；再次导入两份合成文件后 `importCount=2`、`importComplete=true`、滚动位置可变，用户确认侧栏可滚动并看到文件。输入文件 SHA256 在本次观察前为 `06FF0DA586DDC030E81008A6AB36EE73DA372DBF1EC624395B8EC94F526E5B1F` 和 `9C0712089D552EECA30400B2977FFDCF004CAD2AB677179D0B9B41458D853A72`。两次试验均仅使用 `outputs/wps-save-native/` 中的合成文件。
- 新窗格随后再次停滞，用户明确说还未点到合并选项。该时段探针仍有 `importCount=2`、`importComplete=true`、`scrollY=3000`、连续心跳，而动画帧计数停在 16；没有新的合并输出文件。故这次不能归因于合并计算或另存。旧探针对每个滚轮/滚动事件都发请求，一秒可达数十次，可能干扰性能；已把高频事件限流并加入窗格会话编号、点击目标、合并勾选/预览计数，待重启后再验证。
- 为旧窗格增加用户主动触发的功能区“侧栏卡住时重载”，使用 WPS 官方 `TaskPane.Navigate` 重载相同 URL；若旧窗格不存在则正常新建。重载前提示未保存页面修改会丢失，取消时不触碰窗格；单测 5/5 通过。用户重启 WPS 加载新版后，再次遇到卡住并点击此按钮，**实机确认画面恢复**。随后重新导入 2 份合成文件；新页面探针会话 `7005fe7afc70f6a1` 的动画帧持续增长。重载会重置未保存的页面内存，须从项目记录或再次导入恢复。
- 重载后的实机合并勾选已到达新页面：探针记录 `mergeChecked=true`，预览计数从 3 变为 2，心跳与动画帧继续；用户截图确认画面也是3→2。随后真实 WPS 合并另存成功，独立读回水管 `0.3`、两条来源、长小数文本与零公式；详情见 `docs/wps-merge-save-verification.md`。
- 当前判断：恢复 WPS 进程可暂时解除停滞，原因仍未锁定；P1 不标“已彻底修复”，P4 的触发条件仍待验证。
- 机器另有 `12.1.0.28043` 安装目录，但未进行版本切换。WPS 社区的[用户报告](https://bbs.wps.cn/topic/95654)描述的是 Writer 的 `CreateTaskPane`/功能区无响应，并非本插件在表格 `12.1.0.29161` 的官方结论；P3 仍为待验证假设。

下次实机复核：用同样合成文件至少三次验证新窗格首次导入；分别在限流探针和正式模式测试，排除诊断流量干扰。若再次停滞，记录主动重载能否恢复以及是否丢失未保存核对。随后继续 P5 的取消、失败、格式失效、分类写列与辅助表视觉矩阵。

## 其他项

- P2 是实机点击坐标取样问题；后续每次点击前截图或走键盘焦点路径，不作为插件代码缺陷关闭。
- P5 真实 WPS 的合并另存、取消/失败、编码格式失效、分类列、恢复与视觉验收仍未完成。之前的分别保留模式实机证据见 `docs/wps-merge-save-verification.md`。
- P6 的 `%SystemDrive%/` 已检查为仓库内的三个 Windows 缓存文件；递归删除命令被自动审批策略拦截，已由根目录`.gitignore`显式排除、未暂存。需在同一工作区人工核对后清理。
- P7 静态白名单与 P9 行标识修复保持原结论，本轮完整测试覆盖其现有回归。

## 整体自动化回归

在项目根目录运行，所有命令退出码均为 0：

```powershell
node --test wps-addin/test/*.test.cjs       # 137/137 通过
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-check.cjs
node wps-addin/test/ui-review-check.cjs
node wps-addin/test/ui-import-check.cjs
node wps-addin/test/ui-export-check.cjs
node wps-addin/test/ui-project-check.cjs
node wps-addin/test/ui-classification-check.cjs
node wps-addin/test/ui-pane-diagnostics-check.cjs
```

七组浏览器检查均通过。浏览器中合成的 WPS 对象不等同真实 WPS 验收，P1/P4/P5 不据此关闭。
`ribbon.xml` 已由 XML 解析器校验，`main.js` 与探针脚本通过 `node --check`；本次复测前后两份合成源文件 SHA256 不变。
