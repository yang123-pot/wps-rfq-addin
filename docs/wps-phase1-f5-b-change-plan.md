# 变更实施计划：分类工作簿“一本多页”（图04/05，2026-10-11 用户确认 B）

目标口径：**只出一本** `<项目名称>_分类工作簿.xlsx`；**第 1 页＝分类汇总表**，其后台各类明细一页；**页名＝类别名**；汇总页“名称”列＝**文件内跳转**；**不再逐份打开**；**不保留单类导出入口**。

## 已完成（已提交 `ecffbb5`，全量 476/476）

- `category-workbooks.js`
  - `safeSheetName(value,taken)`／导出 `sheetNameFor`：非法字符→`_`、去首尾单引号、31 字截断、簿内重名加 `(2)`；
  - `plan()` 增 `file`／`path`／`sheets[]`（每页 `categoryId/categoryName/sheetName/rowCount/rowIds`），原 `files[]` 保留；
  - `receipt()`／`emptyReceipt()` 增单文件字段（`file`/`path`/`sha256`/`bytes`）与 `sheets[]`（逐页 `status`）；
  - 新增 `writeAll(app, planValue, stagePath, options)`：`options.summarySheet`（第 1 页，可选）＋逐类页（页名取 `entry.sheetName`），**一次 `exportHost.write`**；
- `test/category-workbook-sheets.test.cjs`：2 条页名用例。

## 已完成（2026-10-12，见 [实施与验收证据](wps-phase1-f5-b-evidence-20261012.md)）

第 1–3 项全部落地：`import-ui.js`（一本多页写入/按页读回/只打开一次/汇总页并入第 1 页/项目名进文件名）、
`brand-model`＋`export-host`＋`workbook-layout`（文件内跳转的写入与读回）、`project.js` 业务键
（1 文件＋逐页行数含汇总页，新增 `summaryKey`）；全量 Node **482/482**、**17 项 `ui-*` 通过**；
项目1 第 4 步及下游按新口径真机重跑并 Python 读盘审计 **26/26**。

### 实施与原计划的差异（已按实际落地）

- 第 4 步写入时一并写好第 1 页汇总页（布局取当时选择，默认分列）；第 5 步“生成分类汇总表”在布局未变时
  **不重写文件、只绑定同一本工作簿的第 1 页**，改布局才按新布局重写整本并另存新文件（不覆盖旧排布）。
- 逐类条目（`receipt.files[]`）的 `file/path` 改为指向那一本工作簿（页名/行数存 `sheets[]`），避免项目重开
  核对把“不存在的独立文件”当缺失。
- 一本多页是整本一次性发布：逐页状态随整本成功/失败一起更新（不再有“部分成功”这一态）。

## 原始待做清单（仅存档，均已实施）

### 1. `import-ui.js`：`generateCategoryWorkbooks()`（约 908–1050 行）

现流程是“逐类 `inspect` → 逐类写入 → 逐类打开 → 逐份回执”。改为：

1. 目标存在性预检：不再遍历 `probe.files[].path`，改为**检查 `plan.path` 一个目标**；存在则 `root=newBatchRoot(base)` 重算 `plan`（另建批次，不覆盖）；
2. `plan` 仍用 `RfqCategoryWorkbooks.plan(...)`（已带 `file/path/sheets`）；
3. `receipt=RfqCategoryWorkbooks.receipt(plan,{layout:selectedLayout()})`；续作时按**同一批次 + 同一 `plan.path`** 且 `sha256` 相符才复用成功状态；被外部改写→`needs-verification`（沿用现有文案与逻辑）；
4. 写入：`RfqCategoryWorkbooks.writeAll(options.application,plan,stagePath,{summarySheet:summarySheetModel()})`，其中 `stagePath` 为暂存路径，发布走既有 `exportRequest('commit'…)` + `verify`（沿用“先校验后记账”）；
5. 读回：按 `plan.sheets[]` 逐页核对行数（替换原先按文件核 `rowCount`）；
6. **只打开一次**：`RfqCategoryWorkbooks.openForEditing(options.application, receipt.path)`（去掉循环内逐个 `openForEditing`，去掉单类导出入口）；
7. `categoryVerdict()`：`files.length` 判定改为 `sheets` 判定（“全部为无需询价”分支保留）。

### 2. 第 5 步：汇总页并入第 1 页

- `generateSummary` 不再单独发布文件，改为**写入/更新同一本工作簿的第 1 页**（通过 `writeAll` 的 `summarySheet`）；
- 汇总页“名称”列地址改**文件内跳转**：`#'页名'!A1`（页名含顿号等字符时加单引号）；
- 产物合并后，项目绑定里“汇总表”与“分类工作簿”指向同一文件；`project.js` 的分类/汇总阶段业务键改为“**1 文件 + 逐页行数（含汇总页）**”。

### 3. 测试与验收（已完成，结果见证据文件）

- 重写 `wps-addin/test/ui-category-check.cjs` 断言：单本、汇总页在第 1 页、页名＝类别名、逐页行数、内部跳转**真跳**、无逐份入口、同名不覆盖、另建批次；
- 补 `summary-links.test.cjs`／`export-host.test.cjs` 用例（内部跳转地址、多页写入、页名清洗与截断）；
- 跑模块测试＋全量回归（基线 476/476）；
- **按新口径重跑项目1 第 4 步及下游**（单本 → 汇总页链接 → 询价总表 → 拆分）并读盘核对；
- 提交并核远程 SHA。

## 环境

隔离数据根 `outputs/wps-phase1-F5/acceptance-data/`（104 类、1678 条记忆）；服务 `127.0.0.1:38891`（库版本 `2026-10-11-f5-acceptance.2`）。项目1 第 1–4 步真实口径已完成并留证，第 5–7 步示例数据验通，**正式通过待真实供应商名录**。
