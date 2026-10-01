# R12-H 同格布局等价验收：本次未达成真实出口（环境阻塞）

**状态：未通过。** 本包出口是“双布局业务等价且各有真实输出，且不得把05A复制截图算05B通过”；本次**没有生成任何真实WPS输出**，没有做表内两行填写、主按钮读回、图06总表和图07拆分的真实操作，因此**不勾任何验收项，不写“等价通过”**。以下只记录前置核对、环境阻塞证据与已备好的执行手段。

**基线/现场（本会话实测）：** 分支 `feat/wps-phase1`，开工 `git rev-parse HEAD` = `c3e4b33e490a3429f647bb659e7143c4637522bb`（`fix: R12-G 打印持久化与拆分主链真机验收闭环`），`git log` 前5条为 c3e4b33、a4be3f5、f532a1e、d90e128、a6ff72d。提示词拆分时给出的 `63dde1e9…`、代码基线 `e6f8ff26…` 是历史值，当时说“工作区保留6个未提交修改”也已由 R12-B/D 收敛；本次实际工作区只有 `wps-addin/dev/pane-diagnostics.js` 显示为 ` M`，且 `git diff` 为空（仅stat缓存），内容与 HEAD 一致，本包**未暂存、未清理**，其余文件均干净。

**日期/操作者/WPS：** 2026-10-01，操作者 Codex；本机 WPS Office `12.1.0.29161`（`E:\WPS\WPS Office\12.1.0.29161\office6`，另有旧版 `12.1.0.28043`）。本包**未启动、未关闭、未改动**用户正在运行的 WPS 会话。

**对应图（已实际打开查看）：** `docs/mockups/approved-20260926/05b-summary-combined.png`、`06-inquiry-linkage.png`、`07-split-files.png`。验收点：05B 同格布局中 D/E/F 每格两行“品牌：…／供应商：…”、G列询价生成方式、B列四个名称链接；06 五张询价页与品牌来自汇总表；07 五个独立供应商文件、完成/失败计数。

## 1. 本包前置依赖核对（这部分**已完成**，不是真机验收）

| 项目 | 实测结果 |
| --- | --- |
| R12-G 已完成 | 项目 `p-mujmyjx0-16kom40i` revision **24**、拆分回执 revision 7（与 R12-G 证据一致）；`/api/project/load` 实测返回 24 |
| G 的分列已填文件与 4 分类簿未被本包改动 | 分列汇总表 `r12/output/分类汇总表_20260930-134448.xlsx` SHA256 `c505ca2624d0363118b9c413e23395eaba4a11e4e54fb68e1c636bfae981aeca`＝项目记录值；4 个分类工作簿 SHA 与项目 `categories.files` 逐份一致；审核成果表 SHA 与项目 `review.sheet.sha256` 一致 |
| “同一分类清单”不是自述 | 用插件真实模块（`RfqCollection`＋`RfqProject`）从项目 `sources` 重建集合与合并行，复算内容键：`matchingKey` = `ck2-721d17bd7b34fb51`、分列生成键 = `ck2-14a15fd175309425`，与项目记录**逐位相同** |
| 本机服务与生成管线可用 | 以 R12 隔离目录启动 `wps-addin/dev/server.cjs --port 38891`：`/health` 200；从 `taskpane.html` 取得会话票据；`/api/export/inspect`、`/api/project/load` 均 200 |

## 2. 环境阻塞（本包真实出口无法执行的原因，两项独立）

### 2.1 计算机控制通道不可用

本会话 Computer Use 对所有应用的窗口控制都被直接拒绝（`sky.list_apps()` 能返回应用清单，但任何 `get_window_state` 都返回 `Computer Use was not approved to use wps` / `… explorer` / `… ChatGPT`）；cua 侧 `getState()` 的 `apps` 为空数组，原生控制未启用。→ **不能在真实 WPS 侧栏内点按**（05B 填两行、主按钮读回、06 生成、07 一键拆分）。

### 2.2 隔离 WPS 的 COM 自动化入口在本机已不存在

R12-D/E 用过的 `KET.Application`（`New-Object -ComObject`）现在取不到。只读取证（本机 `outputs/wps-acceptance-20260927/R12-H/evidence/host-blockers.json`，由 `host/probe-blockers.cjs` 生成）：

- `[Type]::GetTypeFromProgID`：`KET.Application`、`Ket.Application`、`KWPS.Application`、`Excel.Application`、`Word.Application`、`PowerPoint.Application` **全部 missing**。
- `HKLM/HKCU\SOFTWARE\Classes\KET.Application`（含 `WOW6432Node`）、`KWPS.Application` **全部 missing**。
- 在 `HKLM\SOFTWARE\Classes` 全树按数据搜 `office6`：命中 25 个键，**没有任何 `LocalServer32`**（只有 4 个 shell 扩展 `InprocServer32`）。
- 仍残留的 TypeLib 指向**已被升级删除的旧版本**：`{00020813…}`→`12.1.0.26375\office6\etapi.dll`、`{00020905…}`→`…\wpsapi.dll`、`{91493440…}`→`…\wppapi.dll`；本机现存的只有 `12.1.0.28043`、`12.1.0.29161`，`et.exe` 存在但未重新注册自动化入口。
- 因此驱动里的 COM 预检直接失败：`New-Object -ComObject KET.Application` → `80040154 Class not registered`（`evidence/run-report.json`）。

结论：**本机当前没有可用的真实 WPS 宿主通道**（插件 UI 需要计算机控制；隔离 COM 实例需要被注册的自动化入口）。按本计划“模拟宿主/浏览器检查不能替代真实WPS”，本包不以此代替真机，也不把 R12-D 的 `05b-combined-real.png` 当作本包 05B 证据。

## 3. 本次实际执行（无真机，无输出文件）

| 命令 | 结果 |
| --- | --- |
| `node outputs/wps-acceptance-20260927/R12-H/host/precheck.cjs` | 服务/票据/`export inspect`/`project load` 全部正常（证明生成与发布管线本身可用） |
| `node outputs/wps-acceptance-20260927/R12-H/host/run-r12h.cjs` | 现场核对与内容键核对通过后，在“预检WPS自动化入口”处**快速失败并停止**；未写任何 xlsx、未改项目、未改原文件 |
| `node outputs/wps-acceptance-20260927/R12-H/host/probe-blockers.cjs` | 生成 `evidence/host-blockers.json`（通道结论 `isolated-com-host-unavailable`） |
| `node --test wps-addin/test/*.test.cjs` | **362 通过 / 0 失败**（`evidence/full-node-r12h.log`）；本包未改源码，用于确认提交基线仍为绿 |
| `<捆绑运行时>\python.exe -X utf8 -m unittest discover -s wps-addin/test -p test_audit_outputs.py` | **8 通过 / 0 失败**（`evidence/python-unit-r12h.log`）。本机 `python` 不在 PATH、`.venv` 因中文路径启动失败，故用 Codex 捆绑运行时（Python 3.12.14＋openpyxl 3.1.5）执行 |

**本机副作用：** 无。未生成/未覆盖任何输出文件，未改动项目记录、分列汇总表、分类工作簿或用户 WPS 会话；仅在 `outputs/wps-acceptance-20260927/R12-H/` 下新增预检日志与证据（该目录受 `.gitignore` 保护）。

## 4. 通道恢复后可直接执行的准备（已写好，未运行）

- `outputs/wps-acceptance-20260927/R12-H/host/run-r12h.cjs`：真实宿主驱动，顺序为——同格汇总表生成（新文件，不覆盖分列）→ 表内 D/E/F 两行标签与 G 列方式 → **未保存读回**（对应 G 的 52/53 口径）→ 保存后读回并同步实际 SHA → 四个名称链接逐个 `Follow()` 打开对应分类工作簿 → 按 `categoryId` 比较两布局规范化 groups/顺序/mode → 生成总询价工作簿（图06）→ 新目录生成 5 份供应商文件（图07）→ 项目落盘。全部写盘都走真实 `dev/server.cjs` 路由（`/api/export/prepare|commit|verify|inspect`、`/api/split/prepare|save`、`/api/project/save`）。
- `host/com-host.ps1`：与 R12-D/E 同一隔离 COM 桥（SHA256 `855BD1D464ABE51D79142C2C9689C2E3BD226F728492450DE9FBDE8EA93C9762`，与 R12-D 原件一致）。
- `audit-chain.py`：R12-F 双审计的 H 版（独立抄录公开预期矩阵、openpyxl 读实际 xlsx、逐值/版式/来源对账，供应商目录固定为 `询价输出-同格`）。
- 恢复通道的方式（**需用户/环境决定，本包未自行改动系统**）：① 在 Codex 中允许 Computer Use 控制 WPS，然后按 R12-G 的真实侧栏主链执行；或 ② 恢复 WPS 的自动化入口注册（WPS 自带“配置工具/注册组件”，或 `et.exe /regserver`），再用隔离实例执行第4节驱动。两者都需要本机设置变更，本包未擅自执行。

## 5. 未完成项与下一包

- 未完成：本包全部真机出口（同格汇总生成、两行填写与显示、4 链接、主按钮读回、两布局等价结论、图06/07真实输出、R12-F 逐值对账、05B 及后续截图）。
- 明确挂账：R12-H 整体；插件UI内点按（原已挂 R12-J）；R12-I 及以后未开始。
- R12 整体仍未完成；**不得**据本文件声称双布局等价或一期可用。
