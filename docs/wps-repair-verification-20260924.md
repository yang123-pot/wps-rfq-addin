# P1–P9 集中修复与验证记录

日期：2026-09-24。基线：`b8219b9`。本文件只记录本轮可复核的证据；运行数据仍留在 `outputs/`，不入仓库。

## 已修复：P8 合并表写入前核对哈希

- `export-files.cjs` 的 `verify(ticket,target,sha256)` 只接受本机服务已成功发布且未过期的票据、相同目标与回执哈希，重新读取目标文件计算 SHA256；不一致时拒绝。
- `/api/export/verify` 继续使用导入会话令牌和本机 Host/Origin 限制。分类侧栏取得核对回执后才调用 WPS 写列；等待期间若核对状态、来源集合或合并选择变化，旧计划不执行。
- 失败测试先复现 `store.verify is not a function`、接口未开放，以及目标文件变化后侧栏超时等待阻断提示；修复后专门测试与整体回归均通过。浏览器用例把刚另存的文件改写，确认 WPS 写入记录仍为零；还覆盖了校验期间切换合并选择。
- 已写入分类列会改变文件 SHA256；再次写入前须重新另存内部清单并取得新回执。后续若要支持同一合并表反复修改分类，应另设计受控回执更新，不能跳过哈希核对。

## P1/P3/P4：已补取证能力，根因仍待真实侧栏复现

- 探针模式新增 `dev/pane-diagnostics.js`，每 3 秒及点击、滚轮、按键、焦点、滚动事件上报侧栏 DOM 数量、按钮/fieldset 状态、窗口几何、可见性与动画帧计数；不传文件名、路径或单元格内容。正式模式不提供脚本或上报接口。
- `ui-pane-diagnostics-check.cjs` 在 Edge 中实际加载侧栏并触发点击，报告中的 DOM 几何与事件字段可读取。此项只能证明探针可用，不能证明 WPS 已修好。
- 本轮在当前安装的 WPS 表格 `12.1.0.29161` 进程仍运行时启动 38891 探针服务；未主动重开WPS侧栏，报告文件未生成。没有对用户已打开的工作簿做关闭或强制重启，因此未取得新的 WPS 重绘证据，也不能判断是否发生了网络请求。
- 机器另有 `12.1.0.28043` 安装目录，但未进行版本切换。WPS 社区的[用户报告](https://bbs.wps.cn/topic/95654)描述的是 Writer 的 `CreateTaskPane`/功能区无响应，并非本插件在表格 `12.1.0.29161` 的官方结论；P3 仍为待验证假设。

下次实机复核：先在测试工作簿中重新打开插件侧栏，再用仅本机的探针服务记录 `pane-ready`、导入前后 `importCount/importComplete`、`pane-heartbeat` 与输入事件。若 DOM 已更新但屏幕不变，归到宿主重绘；若事件不到达，检查宿主焦点/版本；若 DOM 未更新，按服务→WPS读取→集合→渲染逐层追踪。仅在得到根因证据后修改产品逻辑。

## 其他项

- P2 是实机点击坐标取样问题；后续每次点击前截图或走键盘焦点路径，不作为插件代码缺陷关闭。
- P5 真实 WPS 的合并另存、取消/失败、编码格式失效、分类列、恢复与视觉验收仍未完成。之前的分别保留模式实机证据见 `docs/wps-merge-save-verification.md`。
- P6 的 `%SystemDrive%/` 已检查为仓库内的三个 Windows 缓存文件；递归删除命令被自动审批策略拦截，已由根目录`.gitignore`显式排除、未暂存。需在同一工作区人工核对后清理。
- P7 静态白名单与 P9 行标识修复保持原结论，本轮完整测试覆盖其现有回归。

## 整体自动化回归

在项目根目录运行，所有命令退出码均为 0：

```powershell
node --test wps-addin/test/*.test.cjs       # 132/132 通过
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
