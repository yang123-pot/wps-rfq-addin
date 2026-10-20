# F7 安装脚本收敛与隔离生命周期证据（2026-10-17）

工作包：F7（R13-A），分支 `feat/wps-phase1`，入场 HEAD `4936f8c`。F6 已勾 R12 结案，F8 未开始。入场未提交的 `wps-addin/dev/pane-diagnostics.js` 原样保留、未编辑、未暂存。

## 1. 范围与结论

F7 只收敛安装/启动/卸载与真实服务生命周期，不改变七步业务布局或字段。已实现并验证：

- 安装、升级、启动、卸载都以服务健康响应中的**绝对脚本路径、进程创建时间、实际运行代码版本**核对身份；PID 文件只作为候选，不单独授权停止进程。
- 升级先在同级暂存目录完成发布复制，再停止已核实旧服务、切换程序目录并启动新服务；复制失败不触碰旧程序目录，启动失败回退旧代码/注册并恢复旧服务。
- 安装前备份 `publish.xml`，失败时按备份逐字节还原本插件注册，其他插件节点原样保留。
- DataRoot 明确创建并传入 `imports/library/projects/headers/splits` 五个子目录；安装、升级、失败回退、卸载和重装都不删除这些目录。
- 删除/移动前校验绝对目标位于明确的 AppDir、暂存目录或备份范围内；拒绝把磁盘根、用户目录、包含 DataRoot/publish.xml 的目录当作 AppDir。
- 后台服务始终以 `-WindowStyle Hidden` 启动；端口被其他程序占用时拒绝启动，不停止对方。

**出口：** 安装可复现、失败一致回退、不误停未知进程、数据可恢复、升级确实运行新版。真实 WPS 加载项 UI 的重启边界见第 6 节。

## 2. 代码改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/dev/server.cjs` | `/health` 增加 `pid/scriptPath/appDir/startedAt/codeVersion`；新增确定性的运行代码版本计算和 `--code-version <dir>` 命令；导出 `codeVersionForRoot`。 |
| `wps-addin/install/service-identity.ps1` | 新增共享身份核对：健康响应、绝对脚本路径、进程命令行、创建时间（5 秒容差）、运行代码版本、端口监听检测。 |
| `wps-addin/install/install.ps1` | 安装前身份/端口检查；publish.xml 备份与失败还原；同级暂存复制和目录切换；旧服务停止前二次核对；新服务健康/身份核对；失败回退并恢复旧服务；五个 DataRoot 子目录。 |
| `wps-addin/install/start.ps1` | 已运行服务身份核对；其他程序占端口拒绝；隐藏启动；五个 DataRoot 子目录显式传入；启动后身份核对。 |
| `wps-addin/install/uninstall.ps1` | 只停止身份核实的服务；PID 复用、命令行不可读、其他 `server.cjs` 不停止；路径/删除范围校验；默认保留程序和全部数据。 |
| `wps-addin/test/install.test.cjs` | 新增复制失败、启动失败、升级加载新版、DataRoot 五目录、PID 复用/命令行不可读/其他 server、路径守卫、`start.ps1` 隐藏单实例测试。 |
| `wps-addin/test/server.test.cjs` | 健康响应身份字段、代码版本变化、`--code-version` 与运行版本一致。 |

## 3. 回归结果

2026-10-17 实际执行：

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：**515/515 通过，0 失败/0 跳过**（F6 基线 510，新增 5 项）。最终全量日志本机 `outputs/wps-phase1-F7/node-full-final2.txt`。Python 发现/执行 **10/10** 通过（`python -m unittest discover -s wps-addin/test -p "test_*.py"`），用于确认本次服务/安装改动没有破坏既有公开输出审计。

F7 新增的四项生命周期/身份测试均通过：

- `F7 lifecycle: custom DataRoot, restart, upgrade, failure rollback, uninstall and reinstall keep project data`（约 43 秒）；
- `F7 identity: uninstall never stops PID reuse, unreadable command lines or another server.cjs`（约 10 秒）；
- `F7 path guard: install and remove refuse broad AppDir targets`；
- `F7 start command starts a hidden single instance with all five DataRoot directories`。

相关专项还包括 `release-audit.test.cjs` 12/12、`server.test.cjs` 9/9、`install.test.cjs` 7/7。

## 4. 隔离生命周期回执

本机脚本 `outputs/wps-phase1-F7/run-lifecycle.cjs`，回执 `outputs/wps-phase1-F7/lifecycle-receipt.json`。环境：Windows、Node v24.19.0、PowerShell 7；临时根 `%TEMP%\rfq-f7-evidence-hG4fQ0`，端口 `7467`，未使用真实 `%LOCALAPPDATA%\WpsRfqAddin` 或真实 publish.xml。

| 步骤 | 实际结果 |
| --- | --- |
| 安装 v1 | 退出 0；创建五目录；服务 PID `18416`；代码版本 `d3b29c79fc9aa40246500af028440247c8a00ee962561f38d39ab3aea63984f1`；项目保存到自定义 `data\projects`，revision 1。 |
| 同版重启 | 退出 0；PID `18416→34740`；代码版本不变；重新打开项目 revision 1。 |
| 升级 v2 | 退出 0；PID `34740→6284`；旧 PID 退出；代码版本变为 `5facf2196e0e73157cf2f44b9e8b1f53d5b7d4f0a467e7df6a56b6d5d569c78b`；HTTP `/main.js` 实际返回 `f7-v2` 标记；项目 revision 1。 |
| 复制失败注入 | 真实独占锁住 v3 源文件 `src\classification-ui.js`；安装退出 1，报错 `The process cannot access the file ... classification-ui.js`；`publish.xml` SHA 与失败前一致；服务 PID `6284` 和 v2 代码版本不变；`main.js` 仍为 v2；五目录哨兵不变。 |
| 启动失败注入 | v4 的 `dev\server.cjs` 真实执行 `process.exit(1)`；安装退出 1，报 `新服务未通过身份核对：没有健康响应`；注册还原；旧代码还原；旧服务自动恢复为 PID `32456`、代码版本 `5fac...`；HTTP 仍提供 v2；项目 revision 1；五目录哨兵不变。 |
| 卸载 | 退出 0；停止 PID `32456`；健康端点消失；仅移除本插件节点，`OtherPlugin`/`OtherSamePort` 保留；程序目录按默认保留；五目录哨兵不变。 |
| 重装 v2 | 退出 0；PID `26064`；代码版本 `5fac...`；项目 revision 1；五目录哨兵不变。 |
| 清理 | 再次卸载并停止 PID `26064`，健康端点消失。 |

复制失败与启动失败都是真实文件系统/进程失败注入，不是 `SkipService`/`SkipStopService`。`SkipService` 只在既有复制测试和 `start.ps1` 的前置安装中使用；生命周期主路径全部走真实服务启停。

## 5. 身份安全负例

- PID 文件指向无关 `node -e setInterval` 进程：卸载输出“命令行不是本插件绝对脚本路径，未停止”，进程仍存活。
- PID 文件指向另一个目录的真实 `server.cjs`：卸载拒绝停止，进程仍存活。
- PID 文件写入 `4`（System）：命令行不可读，卸载拒绝停止，System 进程仍在。
- 安装/卸载收到包含 DataRoot/publish.xml 的宽目录作为 AppDir：拒绝操作，哨兵文件保留。

## 6. WPS 环境与未覆盖边界

- 本机 WPS 表格构建号实测 `12,1,0,29161`（`E:\WPS\WPS Office\12.1.0.29161\office6\et.exe` 及另一安装路径）。COM 探测创建了独立隐藏实例（`Workbooks=0`，新增 et 进程随后退出），探测前后用户已有 WPS 进程 `27752/29112` 未变。该 COM 实例不暴露 `CreateWebDialog`，因此不能用 COM 代替真实功能区/浮窗验证，未据此宣称插件 UI 通过。
- F7 的安装生命周期使用临时 publish.xml/AppDir/DataRoot/端口，**没有修改用户真实 publish.xml，也没有重启用户正在使用的 WPS**；因此本证据证明安装器/服务生命周期，不把服务级项目 API 说成“真实 WPS 浮窗内点击”。
- 真实 WPS 加载项 UI 已在 F6 于同一构建号上由用户确认打开；本包不重复该真人操作，避免打断用户未保存内容。
- F7 之前启动的旧服务健康响应没有身份字段。此时 install/start/uninstall 会拒绝自动停止并说明原因，需要先手动停止旧服务一次；这是“未知身份不停止”的安全边界，不是升级成功证据。
- 其他 WPS 版本未在本机隔离环境实测，不列入支持范围。

## 7. Git 与备份

本包只暂存明确列出的源码、测试与文档；`wps-addin/dev/pane-diagnostics.js` 保持入场未提交状态，原始资料/运行数据/日志/生命周期回执均不入 Git。提交、普通推送和远程 SHA 逐位核对结果以本机 `outputs/wps-phase1-F7/backup-receipt.json` 与最终报告为准；推送失败时保留本地提交并如实记录，不强推。
