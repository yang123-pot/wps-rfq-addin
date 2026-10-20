# 图04/05 变更 B（分类工作簿“一本多页”）实施与验收证据（2026-10-11 夜–10-12 凌晨）

本文件记录 [变更实施计划](wps-phase1-f5-b-change-plan.md) 第 1–3 项的实施结果、测试证据与项目1 按新口径重跑
（第 4 步及下游）的真实读盘核对。对应的效果图变更说明见 [图04/05变更说明](mockups/approved-20260926/amendments-20261011.md)。
本机证据（不入 Git）在 `outputs/wps-phase1-F5/newmodel/`（模型、报告、审计 JSON）与
`outputs/wps-phase1-F5/project-1/水电暖安装_20261012-003047_f3e201/`（真实产物）。

## 1. 实施改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/category-workbooks.js` | `plan()` 所有类别页共用一本 `<项目名称>_分类工作簿.xlsx`（逐类条目另存 `categoryFile` 供重名检查、`file/path` 指向那一本）；`receipt()/emptyReceipt()` 增第 1 页汇总页与逐页 `sheets[]`；`statusOf/summarize` 改为逐页判定（`pages/categories`）；新增 `setSheetsStatus`、`readSheets`、`verifySheets`（发布后按页核页名/顺序/行数，行数只把“少写”判失败，值的逐格一致由导出宿主与发布SHA证明） |
| `wps-addin/src/brand-model.js` | `summaryPlan()` 增 `internal` 模式（同一本工作簿的页内跳转，地址＝`页名!A1`，简单页名不加引号、含顿号等字符加单引号；页名重复阻断）；`buildSummary()` 名称列输出内部跳转（`Address=''`＋`SubAddress`），底部说明改“跳转到同一本工作簿的对应分类页”；`summaryBindingFor()` 增 `internal/sheetName` |
| `wps-addin/src/export-host.js` | 原生链接写入支持内部跳转（地址留空、SubAddress 落地）；读回时按 `SubAddress` 归一化比对，地址非空且不指向本工作簿即拒绝 |
| `wps-addin/src/workbook-layout.js` | 超链接版式校验允许“内部跳转”（有 `subAddress` 即可，无外部地址）；其他链接仍必须带地址 |
| `wps-addin/src/import-ui.js` | `generateCategoryWorkbooks()`：单目标预检（同名不覆盖→另建批次）→ 构建“汇总页＋逐类页”模型 → `writeAll` 一次写入 → 独占发布 → 按页读回核行数 → 只打开一次；`categoryVerdict()` 改按逐页判定并携带 `file/sheets`（供项目业务键）；`generateSummary()` 不再单独发布文件，布局未变时只绑定第 1 页，改布局时按新布局重写整本并另存新文件；逐页列表不再保留任何单类导出/打开入口；`projectDisplayName()` 进入分类工作簿文件名 |
| `wps-addin/src/project.js` | 业务键新增 `output`（1 文件＋逐页行数含汇总页）；`KEY_CONTENT.categories/summary` 纳入 `output`，新增 `summaryKey`；`normalizeOutput()` 导出 |
| `wps-addin/taskpane.html` | 第 4/5 步面板文案改为“一本多页/第 1 页＝汇总表/文件内跳转/无单类导出入口” |

## 2. 测试证据

- **全量 Node 回归 482/482 通过**（基线 476；本包新增/改写 6 项：`category-workbooks` 逐页回执与读回、
  `summary-links` 内部跳转 3 项、`export-host` 一本多页落地、`project` 业务键口径）。
- **17 项 `ui-*` 浏览器检查实跑通过**（`NODE_PATH` 指向 Codex 运行时 playwright）：`ui-category`（重写为
  单本/页序/页名/逐页行数/内部跳转/无逐份入口/同名不覆盖/另建批次）、`ui-brand`、`ui-inquiry`、`ui-sheet-review`、
  `ui-workflow`、`ui-split`、`ui-project-restore`、`ui-cancel`、`ui-classification`、`ui-export`、`ui-import`、
  `ui-library`、`ui-memory`、`ui-project`、`ui-review`、`ui-startup-navigation`、`ui-pane-diagnostics`；
  `ui-render-stall-check`（长时段稳定性）按既有约束未重开。
- `ui-category-check` 断言要点：整本失败时“0/5 页”且不落任何文件；重试仍只写那一本；写入模型页序
  `分类汇总表＋4 类页`、页名＝类别名、逐页行数 2/2/2/1、公开 10 列＋隐藏 rowId、品牌/报价/金额留空；
  汇总页名称列＝内部跳转（地址空、SubAddress＝`页名!A1`）；发布后按页读回期望含第 1 页汇总页；
  整本只打开一次；列表里没有任何单类导出/打开按钮；不改布局生成汇总表不重写文件、两处绑定指向同一文件；
  改布局另存新文件且旧排布保留；重新生成另建批次目录。

## 3. 项目1 按新口径重跑（真实 WPS 隔离实例，读盘核对）

环境：隔离数据根 `outputs/wps-phase1-F5/acceptance-data/`（104 类、1678 条记忆，库版本
`2026-10-11-f5-acceptance.2`）；真实输入快照 `project-1/input-snapshot.json`（263 行，指纹
`2fc122dd…`）；产品代码生成模型 → 自建隔离 `KET.Application` 实例（Microsoft Excel 12.0）写入 →
Python/openpyxl 独立读盘审计。**未改用户文件、未动生产库**；本次自建实例在脚本内关闭并回收。

| 步骤 | 结果 |
| --- | --- |
| 4 分类工作簿（新口径） | 一本 24 页：第 1 页「分类汇总表」＋其后 23 类页（页名＝类别名，含 `风口、风阀`）；224 行＝263−39；SHA `ff1dd52f…`、57575 字节 |
| 4 逐页/跳转读回 | 24 页页名与顺序、逐页行数与模型逐页一致；23 条原生链接 **地址为空、SubAddress＝`页名!A1`**（`'风口、风阀'!A1` 自动加引号）；方式下拉 `Type=3`、`=分类汇总表!$M$1:$M$2`；隐藏列 K/L/M |
| 5 第 1 页填写＋读回 | 在**同一本工作簿的第 1 页**按项目记录里的示例品牌/供应商/方式填写并保存（SHA `6eaf3709…`）；读回网格交产品代码解析 → 23 类、预计 24 份询价表，**与旧口径记录的示例品牌逐组一致（mode/groups 全等）** |
| 6 询价总表 | 产品 `inquiry-model` 生成并真机写入 26 页（24 询价页＋内部追溯/处理记录），SHA `a1b393f6…`；线缆按品牌 2 页、阀门合成 1 页 |
| 7 一键拆分 | 产品 `split-plan` 从新总表拆分 → **24 份全部成功、0 失败**，命名与旧口径一致（`线缆_示例供应商.xlsx`/`线缆_示例供应商B.xlsx`/`阀门_多供应商.xlsx`） |
| 独立读盘审计 | `p1-new-audit.py`（python3.13＋openpyxl 3.1.5）**26/26 通过、0 问题**：A 组 15 项（页序/页名/逐页行数/内部跳转无外部目标/两行表头/隐藏列/224 行/留空列/K 列 rowId/无 无需询价 页/**整本无公式**/示例品牌已填）、B 组 7 项（26 页、内部页在最后、询价页 10 列、品牌列）、C 组 4 项（24 份单页 10 列、**无公式**、报价单价与金额留空、联系方式不进材料行） |

产物位置（本机，不入 Git）：新批次 `outputs/wps-phase1-F5/project-1/水电暖安装_20261012-003047_f3e201/`
（`分类工作簿/水电暖安装_分类工作簿.xlsx`、`水电暖安装_询价总表.xlsx`、`供应商件_示例数据/` 24 份）；
旧口径批次 `水电暖安装_20261011-225919_fe8282/` 与 `分类工作簿/` 下的旧 23 份**未改动、保留对照**。

## 4. 实现期发现并修正的问题

- `generateCategoryWorkbooks()` 生成 `plan` 时漏传 `projectName`，一本多页文件名会退化成
  `分类工作簿_分类工作簿.xlsx`；已补 `projectName:projectDisplayName()`（第 4 步与重建 `plan` 两处）。
- 逐类条目原保留各自“独立文件”路径，会让项目重开核对（R11）误报缺失；已改为逐类条目共用同一本工作簿的
  `file/path`，页名/行数另存于 `sheets[]`。
- 一本多页写入是整本一次性发布：回执改由 `sheets[]` 逐页判定，整本成功/失败一致（不再有“部分成功”）。

## 5. 边界与待办

- 品牌、供应商、抬头**全部是示例值**：项目1 尚未正式通过；真实供应商名录到手后须在第 1 页重填、重新读回并
  重生成第 6/7 步。
- 真机部分为**按产品模型在隔离实例里复刻写入/读回**（浮窗内控件不可点按）；“只打开一次”“无单类导出入口”
  等界面行为由 `ui-category-check`（模拟宿主）覆盖。
- 未覆盖：真实浮窗内整条点击链（真人）、其余三个项目、`ui-render-stall-check` 长时段稳定性复测。
- 项目1 旧口径的 23 份独立分类工作簿按计划**不计入新口径验收**，仅作对照。
