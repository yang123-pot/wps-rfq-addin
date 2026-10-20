# R12-H 同格布局等价验收（2026-10-01，真实WPS宿主链路已通过）

**状态：通过（真实宿主链路）。** 从同一分类清单生成新的**同格**分类汇总表，表内按两行填写并与G完全相同的品牌/供应商组合与生成方式，主按钮读回、4个名称链接实际打开、按 `categoryId` 比较两布局业务内容完全等价；随后用真实宿主生成新版本总询价工作簿，并在**新拆分目录**真实输出5个供应商文件；6个实际文件经 R12-F 双审计逐值通过。

**基线/现场（本会话实测）：** 分支 `feat/wps-phase1`；开工 `git rev-parse HEAD` = `c3e4b33e490a3429f647bb659e7143c4637522bb`。入场工作区只有 `wps-addin/dev/pane-diagnostics.js` 显示 ` M`，`git diff` 为空（stat缓存），本包未暂存未清理；其余干净。提示词里给出的 `63dde1e9…`、基线 `e6f8ff26…`、“6个未提交修改”是拆分提示词时的历史值，已按实际结果记录。

**依赖：** R12-G 已完成（项目 revision 24、分列主链与6文件双审计通过）。本包开工时用插件真实模块（`RfqCollection`＋`RfqProject`）从项目 `sources` 复算内容键 `ck2-721d17bd7b34fb51`（matchingKey）与 `ck2-14a15fd175309425`（分列生成键），与项目记录**逐位相同**；分列汇总表 SHA `c505ca2624d0363118b9c413e23395eaba4a11e4e54fb68e1c636bfae981aeca`、4个分类工作簿与审核成果表 SHA 也逐份与记录一致——**未重新导入、未重新确认、未重新生成4个分类簿**。

**对应图（已实际打开）：** 图05B、06、07。

## 1. 通道变化与执行方式（必须如实说明）

本会话开始时**没有任何真实WPS通道**：Computer Use 对所有应用（含wps）返回 `was not approved`、cua 侧 `apps:[]`；隔离宿主入口 `KET.Application` 也未注册（`80040154`，残留 TypeLib 指向已被升级删除的 `12.1.0.26375`，见 `evidence/host-blockers.json`、`evidence/run-report.json` 首轮记录，本机 `R12-H/host/probe-blockers.cjs` 可复现）。随后本机恢复了 WPS 自动化组件注册（`KET.Application`→`wps.exe /prometheus /et /Automation`、`Excel.Application`→`et.exe /Automation`），隔离宿主可用，本包按 **R12-D/E 同一套“隔离隐藏 COM 实例＋插件真实代码＋真实 dev/server.cjs 发布管线”**执行。

- 未改产品源码；本包只新增/修改本机验收脚本（`outputs/.../R12-H/host/*`，受 `.gitignore` 保护）。
- **插件UI内点按仍未执行**（Computer Use 本会话始终未授权），因此本包不声称“插件UI真机通过”；该入口继续挂 R12-J，与 R12-D/E 的口径一致。
- 隔离实例开工 `workbooksAtStart=0`、结束 `workbooksAtEnd=0`，只用原生 `Quit()` 退出；未改动用户已打开的 WPS 会话与任何原件；测试期间新起的24个隔离 `et/wps` 进程已按“只保留会话开始时就存在的5个用户进程”清理完毕。

## 2. 同格（图05B）真实生成与表内填写

| 验收点 | 实际结果 |
| --- | --- |
| 新同格汇总表（不覆盖分列已填件） | `r12/output/分类汇总表_20261001-090618.xlsx`，生成空表 SHA `0865b39f…`；填写保存后 SHA **`8d91786d54b7030626117e0ff6d1053e147051c8aef43f212ad13aba08f1c86a`**，`layout=combined`、表头行4、数据行5–8、方式列G。分列件 `分类汇总表_20260930-134448.xlsx` 与其SHA `c505ca26…` **未被改动** |
| 两行标签填写 | D/E/F 每格按“品牌：…⏎供应商：…”，D5/E5 青源·华川设备｜恒流·启明机电，D6/E6 通达·正通商贸｜海岳·安合设备，D7 瑞风·瑞风设备，D8 驰电·远程电气；G列与G相同（水泵“按品牌分别生成”、其余“合成一份”） |
| 每格两行完整显示 | 12个填写格全部 `换行=true`、文本恰为2行、内容与标签格式正确；宿主 `AutoFit` 行高24pt（单行默认约14.25pt），真实窗口截图可见两行完整显示 |
| 主按钮读回（未保存先读、再保存读回） | 未保存读回：4类有效、预计**5**份；保存后重读并同步实际SHA，`brands.sourceSha256` 与磁盘一致；错误率0 |
| 名称4链接 | B5–B8 逐个 `Follow()`：分别打开 `分类工作簿\水泵.xlsx`、`阀门.xlsx`、`风机.xlsx`、`汽车充电桩.xlsx`，**4/4 指向正确目标**（地址为相对路径，整目录搬移后仍可用） |

## 3. 两布局等价（按 categoryId 逐值比较）

以 `RfqBrandHost.readSummary` 分别读回同格件与G的分列件，按稳定 `categoryId` 比较规范化 groups／顺序／mode：

| categoryId | 类别 | 材料条数 | 分列 groups | 同格 groups | mode | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| pump | 水泵 | 2 | 青源·华川设备；恒流·启明机电 | 同上 | per-brand | 逐值相同 |
| valve | 阀门 | 2 | 通达·正通商贸；海岳·安合设备 | 同上 | synthesize | 逐值相同 |
| fan | 风机 | 2 | 瑞风·瑞风设备 | 同上 | synthesize | 逐值相同 |
| ev-charger | 汽车充电桩 | 1 | 驰电·远程电气 | 同上 | synthesize | 逐值相同 |

- 顺序：两布局都是 `pump→valve→fan→ev-charger`；预计份数都是 **5**；`businessEquivalent=true`、`differences=[]`（`evidence/two-layout-equivalence.json`）。
- **生成键**：`RfqProject` 的询价内容键只规范化 `categoryId/mode/groups`（不含 layout），因此两布局**共用同一个生成键 `ck2-14a15fd175309425`**（`generationKeyLayoutSensitive=false`）；两份文件二进制 SHA 不同（分列 `c505ca26…`、同格 `8d91786d…`），按批准口径**不要求相同**。

## 4. 图06总询价工作簿与图07新目录拆分（真实输出）

| 文件/profile | 实际页与行列 | SHA256 |
| --- | --- | --- |
| `R12-H/示例园区_询价总表_同格.xlsx`／internal-total | 水泵_青源8×10；水泵_恒流8×10；阀门_合成询价9×10；风机_瑞风8×10；汽车充电桩_驰电7×10；另仅内附表 内部追溯10×9、处理记录10×2 | `a684f35c5199e8bc0b5ed16dc4033399c66217683200798830c2206aed1eb0e5` |
| `R12-H/询价输出-同格/水泵_华川设备.xlsx`／supplier | 水泵_青源8×10 | `7830217da1f363bb37f165b2b2c0da70e9a67ca8efafebb269e512f92373d1b1` |
| `…/水泵_启明机电.xlsx`／supplier | 水泵_恒流8×10 | `de60b3c9d422b14c27e12c464f72d86bc438d752115b7657427077b670c5751c` |
| `…/阀门_多供应商.xlsx`／supplier | 阀门_合成询价9×10 | `2b4974a1f83bcca3cbd76efe765fa86513549a4c1c8614c4b3ce0e28de1cbc20` |
| `…/风机_瑞风设备.xlsx`／supplier | 风机_瑞风8×10 | `2044b2d82275bf8ac1081a1b5cad9d268941e151a33bb16dbdca8a44f28d4609` |
| `…/汽车充电桩_远程电气.xlsx`／supplier | 汽车充电桩_驰电7×10 | `7021faa02002ce288e515aa7ff019e26f566b4bdc45dabaa17dfa3554700d6de` |

- 5个询价对象、材料/数量/品牌/供应商/抬头与G一致：水泵2行2/3分品牌各1件、阀门2行20/12且品牌“通达 / 海岳”合成1件、风机2行2/3、充电桩1行1；供应商信息区逐组对应；报价单价与金额留空、公式0、无内部/隐藏页列。
- 拆分批次 `p-muouadbg-4n49t4d5`、独立回执 revision **6**：完成 **5**／失败0／待核对0／待处理0，`verifiedBy=publish`（逐件SHA与实际文件一致）；项目保存后 revision **25**。

## 5. 审计与验证

| 命令 | 结果 |
| --- | --- |
| `python -X utf8 outputs/wps-acceptance-20260927/R12-H/audit-chain.py` | 6件全部 `pythonOk=true`、`layoutOk=true`、`sourceReconciled=true`（openpyxl 独立读取实际xlsx） |
| `node outputs/wps-acceptance-20260927/R12-H/audit-chain.cjs` | 6件全部 `ok=true`、`verdict=value-verified`、公式0（R12-F 审计，消费Python读出的实际矩阵） |
| `node --test wps-addin/test/*.test.cjs` | **362 通过 / 0 失败**（本包未改产品源码） |
| 捆绑运行时 `python -X utf8 -m unittest discover -s wps-addin/test -p test_audit_outputs.py` | **8 通过 / 0 失败** |

审计口径：总簿允许明确的两个内部页；5个供应商件按 `profile=supplier` 完整预期矩阵核公开值/版式/隐藏页列/公式/路径/原价，抬头联系方式只在声明位置按值放行。

## 6. 本机证据（脱敏，不入 Git）

`outputs/wps-acceptance-20260927/R12-H/`

- `evidence/run-report.json`（14步逐步结果、内容键、填写/读回/链接/比较原始数据）、`evidence/two-layout-equivalence.json`（两布局差异报告）、`evidence/output-index.json`＋各文件 `-manifest/-python-audit/-node-audit/-node-input/-layout/-source-reconciliation.json`
- `evidence/python-audit.log`、`evidence/node-audit.log`、`evidence/full-node-r12h.log`、`evidence/python-unit-r12h.log`
- `screens/05b-summary-combined-filled.png`（同格汇总D/E两行+4链接+G列方式）、`screens/06-total-combined-pump.png`（5询价页+内部页）、`screens/07-split-valve-supplier.png`（新目录拆分件）
- 通道取证：`evidence/host-blockers.json`、`evidence/probe-autosecurity.json`、`evidence/probe-workbooks.json`；驱动与桥：`host/run-r12h.cjs`、`host/com-host.ps1`、`host/capture-h.ps1`

## 7. 本包暴露并修复的**验收脚本**问题（不改产品）

1. 隔离桥 `set` 走反射 SetProperty 在本机WPS（12.1.0.29161）对 `AutomationSecurity` 报 `E_INVALIDARG` → 增加“PowerShell原生赋值”回退。
2. 桥的 `kind` 分支把 `else/elseif` 写在 `}` 下一行，PowerShell 把它当独立命令执行 → 改为同行写法；驱动据此改用“先问 kind 再取值/调用”，避免把方法名当属性读（本机WPS对方法名做 GetProperty 会返回“绑定方法对象”而不报错）。
3. 代理返回值类型：属性必须 `typeof==='object'`（产品用该判断确认宿主支持 `Columns/Rows` 等），方法必须是可调用函数 → 按 kind 分流。
4. `.ps1` 以 UTF-8 无 BOM 保存时 PowerShell 5.1 会按ANSI解码导致中文路径乱码 → 统一写成 UTF-8 with BOM。
5. 截图窗口取 `GetAncestor(hwnd, GA_ROOT)`（COM 句柄是子窗口，直接截图只有 730×334）。
6. 两行显示的行高阈值按宿主 `AutoFit` 结果（24pt）核定，不再用写死的28pt。

## 8. 未完成与下一包

- 未完成：**插件UI内点按**的同格链路（R12-H 的界面点按版本）——本会话 Computer Use 未授权，继续挂 R12-J；C历史独立缺项、E异常内容证明/重启同样挂 J。
- 本包完成的是“真实WPS宿主＋插件真实代码＋真实发布管线”的同格等价与输出验收：双布局业务等价（`businessEquivalent=true`）、各有真实输出、6文件 R12-F 双审计逐值通过。
- R12 整体仍未完成；R12-I（不合并/全跳过/边界）未开始，不得抢跑。
