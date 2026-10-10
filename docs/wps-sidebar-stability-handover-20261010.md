# SIDEBAR-STABILITY-01 未完成工作交接（2026-10-10暂停）

**当前状态：用户明确要求暂停，测试与修复均停止。** 采样于UTC 2026-10-10 11:55:57.865（北京时间19:55:57.865）停止，heartbeat `wps` 已通过应用工具改为PAUSED。WPS及打开的文件未关闭、未保存，原无诊断服务保留。接手者先完整阅读根目录 `handoff.md`，再读本文件和调查第28–29节；未经用户后续恢复指令，不继续实机测试或修复，不自行恢复自动唤醒。

**修复代码已提交，真机验收未完成。SIDEBAR-STABILITY-01未关闭，正式交付仍阻断。** 本文件交接稳定性包，不授权推进C06、业务余项、四项目、R12结案或R13。

## 1. 已完成及代码基线

- 工作区：`F:\材料软件开发`；分支：`feat/wps-phase1`。
- 修复提交：`ffeaf2a06b58e3f0e993ea59e89f9aa89d89fb26`，提交说明 `fix: manage a single nonmodal WPS inquiry window`。已普通推送，并于暂停封存时再次核远程该分支SHA一致。
- 修改集中于 `wps-addin/main.js`、`wps-addin/src/ribbon-navigation.js`、功能区/页面入口文案及相关回归。以CreateWebDialog/GetWebDialog管理单个非模态“项目询价”窗口；存活复用、确认ID不存在才复开、重建先警告未保存内容。登记和销毁同时失败时保留所有权，避免重复创建。新导航存储通道 `rfq.window.nav.*` 与旧侧栏隔离。
- 保留现有七步页、成果表内审核与整表一次确认、独立分类工作簿、汇总表内品牌/供应商及名称链接等流程。未重做业务页面，不恢复旧侧栏逐行审核或品牌二次确认。
- 已执行的软件验证：Node450/450；六项主流程浏览器＋启动导航共7/7；相关生命周期/导航39/39；代码复审未留下具体P1/P2。记录见调查28节及本机日志，软件验证不替代真机验收。
- 最后服务资源核验：50资源、44脚本与最终源码一致，无页面诊断。记录 `source-check-18492-1791632426099.json`。

## 2. 未完成验收与下一步顺序

下列操作全部等待用户恢复指令。接手时先核实际进程、窗口和文件，不沿用旧PID或旧截图。

| 顺序 | 未完成项 | 完成判据与限制 |
| --- | --- | --- |
| 1 | 最终版有数据读取 | 在合成副本中实际点击“读取并识别清单”，核工作簿/工作表及候选内容对应8条合成材料；不能只看启动时簿名或空白簿“0候选”历史反馈。只读输入，不确认或生成业务成果。 |
| 2 | 换簿后的读取归属 | 在样本簿与工作簿1之间双向切换并实际读取，核结果归属当时活动簿；当前静态簿名卡片不是读回证据。 |
| 3 | 最终版关闭与再打开 | 保存必要测试状态后，仅正常关闭自有“项目询价”浮窗，再从同一功能区入口单次打开，核真实新窗及单实例；此前11:28生命周期版通过不能替代最终版。保存提示取消，保留用户文件。 |
| 4 | 重建确认/取消 | 实际核未保存提示、取消保留原实例、确认后销毁并新建、随后仍可导航；先保存核对记录和项目，不能牺牲未保存内容。 |
| 5 | 最终版连续两小时响应 | 新建独立采样文件及回执，公开指标首尾至少7200秒，并在终点进行真实原生导航、保存可见变化。停机/暂停间隔不能计入连续时长；不得续写本次封存指标冒充两小时。 |
| 6 | 验收收口与备份 | 核资源50/脚本44、保护44/44、安装JSON/四键/pane；更新交接、调查、阻断、发布清单、验收。依据实际通过项判断阻断状态，不承诺长期稳定或历史OOM已消除。按明确文件清单审查暂存、提交普通推送并核远程SHA。 |

页内与浮窗关闭控件存在实际工具限制：工具报告点位位于 `wps.exe Chrome Legacy Window`，与返回的主窗 `wps.exe 工作簿1 - WPS Office` 目标不匹配；fresh activate/get一次重试仍失败，list_apps/list_windows没有返回独立浮窗。该限制不是插件卡死，也不是验收通过。**不得反复点击、伪造Window、用进程内存/诊断脚本或其他通道绕过；需用户真人操作或工具正式支持后补证。** 目前不向离开的用户继续请求操作。

## 3. 真实验证边界

| 时间（UTC，2026-10-10） | 已观察事实 | 不包含的结论 |
| --- | --- | --- |
| 11:12:21.058 | 真人旧对照窗读取：1张表、0候选，原始清单未改，截图核一致 | 仅空白簿，不是最终版8条数据读取 |
| 11:39:55.435 | 真人关闭后，11:28生命周期版经原生入口实际复开 | 最终版导航通道随后变更，仍欠最终版关闭复开 |
| 11:42:28.180 | 最终版快速打开“项目询价”七步页 | 未完成业务读取/生命周期矩阵 |
| 11:42:40.651 | 合成样本簿中“自动分类”使第1页变第2页 | 仅导航，未生成或确认 |
| 11:43:41.399 | 从样本簿切到工作簿1，浮窗保留第2页 | 未证明实际读取活动簿 |
| 11:43:55.944 | 换簿后“导入清单”使第2页变第1页，已超过打开60秒 | 未证明两小时或长期稳定 |

旧临时独立窗口路线在UTC06:22:39.408–08:22:50.563采满7211.155秒，08:26:12.368原生终点导航有变化，属于此前有界对照。其永久opened标记关闭后不复位的缺陷已定位。**旧临时路线通过不能替代本最终实现验收**；原TaskPane约60秒停绘与此前32位renderer分配失败也未被证明根因完全消除。

## 4. 本轮中断采样的封存

- 已核PID3052的创建时间与完整命令行，只有本轮公开指标采样器被停止；创建UTC11:46:13.897919，命令为bundled `pwsh.exe -NoProfile -File …/webdialog-fix-public-metrics-20261010.ps1`。
- 30条样本：首条UTC11:46:14.3609711，末条11:55:55.2855455，首尾580.925秒（约9分41秒），最大间隔20.063秒；7个固定创建时间身份逐样本一致，没有记录退出/身份异常。这些公开聚合指标不能唯一归属当前页或证明无泄漏。
- 两小时终点未执行，未生成完成回执。原UTC13:46:14.361目标已取消，不能继续当作预约完成时间。
- 指标SHA256：`964a5ba2daf7c239c527c4448b2d72879828a69ec04e88f4330b5f18b5b884ad`。
- 本机 `webdialog-fix-pause-20261010.json` 明示 `completed:false`；`webdialog-fix-monitor-20261010.json` 已改 `paused-user-request`、`targetEarliestUtc:null`、`resumeRequiresUserInstruction:true`。自动化PAUSED保留原提示，未来恢复前须改为真实现场及新试验身份。

## 5. 留存现场与身份核对

以下为暂停时进程核对或最后已观察UI，接手时可能变化。暂停后没有继续激活、点击、关闭或保存WPS。

- 原无诊断服务PID18492，暂停封存CIM仍匹配；创建UTC11:26:48.5430400，端口38891，模式 `product-no-diagnostics`。可执行文件为bundled `node.exe`，命令 `outputs/sidebar-stability-20261005/launcher-no-diagnostics-20261009.cjs`。原服务本身已是无诊断模式，无需盲目替换。
- 服务状态 `service-current.json`；HTTP日志 `no-diagnostics-http-2026-10-10T11-26-48-650Z.jsonl`；服务日志 `webdialog-fix-service-20261010.stdout.log` / `.stderr.log`。
- 五隔离目录保持 `outputs/wps-acceptance-20261003/R12-L-supplement/c-preparation/ui-data/{imports,library,projects,headers,splits}`。
- 最后已观察主窗459446，标题“工作簿1 - WPS Office”；自有浮窗“项目询价”，第1步导入。工作簿1与合成副本均保留。最后一次UI激活被检测到用户输入而停止，未据此宣称新画面已核；所有窗口号只作为历史线索。
- 合成副本 `outputs/sidebar-stability-20261005/webdialog-fix-20261010/稳定性读取样本.xlsx`，源为既有 `c-preparation/ui-data/sources/C补验_独立8行.xlsx`，两者SHA `7069d5ff91e00db3beaf0c6652b66f713a1d88dcb3645ba783e46210dc68468d`，未编辑或保存。
- 不杀共享CEF或非本轮进程；任何停止服务/采样前重核PID、创建时间、可执行文件与命令行。不要自动关闭用户文件。下一位接手者若不在同机，outputs不在Git，需要用户提供本机证据后再核，不能当作已收到。

## 6. 保护与证据索引

暂停封存UTC11:56:50保护44/44文件SHA一致，5个原占用锁文件缺失；记录 `protected-files-2026-10-10T11-56-50-041Z.json`。原安装JSON、四注册表键及保护pane已只读核原值，未写入：

- 安装JSON：`E:/WPS/WPS Office/12.1.0.29161/office6/addons/kcefmemorysaver/kcefmemorysaver.json`，SHA `c6649babebbbb8e3140ab30bec10e9819ce4138167ba4e4660daff9f2482447c`。
- `HKCU:/Software/Kingsoft/Office/6.0/Common/Cef`：CefDynamicRender=true(String)、CefDynamicRenderTime=60(DWord)、CefDiscardPage=true(String)、CefDiscardTime=120(DWord)。
- `wps-addin/dev/pane-diagnostics.js`：SHA `e9a76e21546142907d65f1c158f6cc4138a69bcf44f950e84edaa6ac914d8e91`；入场未提交修改原样保留，不编辑不暂存。

全部以下证据位于本机 `outputs/sidebar-stability-20261005/`，不上传Git：

| 文件 | 用途 |
| --- | --- |
| `webdialog-fix-pause-20261010.json` / `webdialog-fix-monitor-20261010.json` | 暂停回执、历史现场及中断指标摘要 |
| `webdialog-fix-metrics-20261010.jsonl` | 本轮30条公开指标原件，禁止追加 |
| `webdialog-fix-native-20261010.jsonl` / `webdialog-resume-native-20261010.jsonl` | 最终实现/临时对照的实际操作与限制记录 |
| `webdialog-fix-reopen-20261010.jpg` | 生命周期版真人关闭后复开 |
| `webdialog-fix-final-matching-20261010.jpg` | 最终版样本簿第2页导航 |
| `webdialog-fix-switch-blank-20261010.jpg` / `webdialog-fix-switch-import-20261010.jpg` | 换工作簿及回导入页 |
| `webdialog-fix-node-final-20261010.log` / `webdialog-fix-final-ui-*.log` | 已执行的软件验证日志 |
| `source-check-18492-1791632426099.json` | 最终源码50资源/44脚本核验 |
| `webdialog-native-twohour-frozen-20261010.jsonl` | 此前临时路线封存原生记录，不能混成本轮 |
| `webdialog-fix-backup-receipt-20261010.json` / `webdialog-fix-pause-backup-receipt-20261010.json` | 修复代码及本次交接文档各自普通推送/远程SHA核对回执 |

本次只提交交接相关6份文档：本文件、根handoff、调查、阻断、发布清单、验收。原始清单、报价、联系方式、凭据、本机配置、outputs与保护pane均不暂存、不上传。软件源码无新改动，不为暂停文档重跑产品测试。后续有实际代码改动再运行相应验证与备份。
