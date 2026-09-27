# R9 验证记录：总询价、合成/分表及版式

> 日期：2026-09-27。范围：handoff 第5节 R9（图06）。**模型＋模拟宿主＋浏览器验证；真实WPS核验仍未执行（R2挂账继续）。**

## 1. 本包对应图号与验收点

按第1节看图约定，本包实际打开**图06**，并因品牌/供应商字段直接来自第5步汇总表而打开**图05A、图05B**对照品牌组与供应商写法（未在同一会话为多个工作包重复打开全部8图）。

| 图06要素 | 实现情况 |
| --- | --- |
| 按每类选定方式生成；分别生成每组一张、每张含本类完整材料 | 已实现：`per-brand` 每组一个 inquiry 对象，每张含本类全部材料行（水泵_青源/水泵_恒流各2行） |
| 合成一份：同表列全部品牌，材料行与工程量只出现一次 | 已实现：`synthesize` 每类一个对象、携带全部 `groups`，材料按 rowId 只列一次（阀门2行，不是4行） |
| 品牌列按对象取值；合成全品牌按组顺序显示 | 已实现：分别生成取本组品牌；合成取 `brands.join(' / ')`（阀门两行均为“通达 / 海岳”） |
| 供应商信息区逐组对应 | 已实现：抬头块含“供应商信息”纵向合并标签＋每组一行“品牌 — 供应商”（通达 — 正通商贸 / 海岳 — 安合设备） |
| 抬头：项目名称、单位名称、材料经办人、联系方式必填，原公司地址可选 | 已实现：`inquiry-header` 四项必填、地址可选；图06抬头块（标题行、项目名称/单位名称行、材料经办人行）与图一致 |
| 10列、长特征换行、打印重复表头/分页 | 已实现：公开列固定10列且全部按文本写出；特征列加宽+全表换行；打印区域覆盖整表、`PrintTitleRows` 重复表头行 |
| layout 完整经模型→workbook→host | 已实现：每张询价页带 layout（列宽/合并/填充/冻结/打印），经 `inquiry.workbook` 传到 `export-host.write` 落地并读回校验 |
| 报价单价/金额留空、不带原价 | 已实现：两列恒空，无原价/历史价字段 |
| 保存并核总簿 sheetId/内部 kind、SHA/inputKey 及固定 modelSnapshot | 已实现：生成记录含 `sheetIds`、`inputKey`、`sha256`、`sheetCount` 与 `modelSnapshot`（只含 kind=inquiry）；发布后再 `verify` 核 SHA |
| 不因时间变化生成不同内容 | 已实现：同一内容两次生成询价页完全一致；时间只写入“处理记录”页 |
| UI：当前工作簿、预计输出/每类方式、返回汇总表修改、进入拆分 | 已实现：侧栏显示当前工作簿名、预计5份及每类方式、“返回汇总表修改”“下一步：拆分询价文件”，并提示改汇总表后需重新同步生成 |
| 品牌唯一来源为汇总表，改品牌需回表修改并重新生成 | 已实现：改阀门品牌后旧总表立即“已过期”、不可进入拆分；重新读回后重新生成取新品牌 |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/inquiry-model.js` | 重写：品牌改为从R8汇总读回取（`summaryCategories`），按 `mode` 分别/合成生成 inquiry 对象；图06抬头块与版式（`sheetLayout`：标题/信息/经办人/供应商信息合并、表头填充、冻结、打印区域与重复表头、特征列加宽）；工作表名规则（单组“类别_品牌”、多组“类别_合成询价”）；`summaryLines`/`countsText` 生成侧栏预计输出；`workbook`（询价页＋内部追溯＋处理记录）、`record`（sheetIds/sheetCount/modelSnapshot）、`isCurrent` |
| `wps-addin/src/inquiry-header.js` | 抬头字段改为图06口径：项目名称、单位名称、材料经办人、联系方式必填，原公司地址可选；新增 `block()` 返回抬头块行号（标题/信息/经办人/可选地址/供应商信息区）供模型生成版式，`rows()` 兼容保留 |
| `wps-addin/src/inquiry-ui.js` | 第6步面板重写：读回品牌＋抬头校验→生成总询价工作簿（prepare/write/commit/verify）→记录并落盘；显示当前工作簿、预计输出/每类方式、预览5张询价页；“返回汇总表修改”“下一步：拆分询价文件”；品牌/抬头/分类变化即显示“已过期”并禁用进入拆分 |
| `wps-addin/src/import-ui.js` | `deliveryContext` 改为携带汇总读回品牌组与R5整表确认快照（按稳定rowId归类，避免按旧建议）；第5步读回通过后进入第6步；新增生成后自动落盘与“返回汇总表/进入拆分”导航；抬头面板变化即时刷新询价面板 |
| `wps-addin/src/header-ui.js` | 新增 `options.onChange`：抬头字段/模板/恢复变化时通知询价与拆分面板重算 |
| `wps-addin/taskpane.html` | 新增 `#stage-panel-inquiry`（第6步：banner/进度/状态/当前工作簿/预览/生成/下一步/返回）；抬头卡改为图06四项必填＋可选地址；移除旧辅助区“生成询价表”卡片 |
| `wps-addin/test/inquiry-model.test.cjs` | 重写为R9：图06工作表名/预计输出、分别与合成材料只列一次、阀门20/12与通达/海岳、抬头四项必填地址可选、10列全文本、报价金额留空、版式（合并/填充/冻结/打印）、超长文本拒绝、内容不随时间变化、工作簿内部页与生成记录 |
| `wps-addin/test/export-host.test.cjs` | 新增1例R9：真实询价模型经 `export-host` 写入模拟宿主并读回核标题合并、特征列宽46、表头加粗与填充、打印重复表头、冻结 |
| `wps-addin/test/header.test.cjs` | 适配图06抬头：四项必填/地址可选、`block()` 抬头块与表头行号 |
| `wps-addin/test/ui-inquiry-check.cjs` | 新增：七步链路（导入→合并→整表确认→4分类簿→汇总表→读回品牌→生成总询价），核对图06工作表名/阀门20-12/品牌/抬头/版式、侧栏当前工作簿与预计输出、生成记录与SHA、返回汇总表修改/进入拆分、改品牌后旧总表过期并重新生成 |
| `wps-addin/test/ui-brand-check.cjs` | 适配R9：第5步读回成功后进入第6步（图05→06），回步继续核对；旧过渡期面板的“总询价生成/拆分”两段移出，改由R9/R10用例覆盖 |

关键SHA256：`inquiry-header.js`=`934CB142667B41295AE2AD5E131614862F7228DAB543FF1DD284C17F54F72E54`；`inquiry-model.js`=`3CBC9A410B36A9325A688987372C54CE917E3C4D39930D99DEA70AB72CDD9DAF`；`inquiry-ui.js`=`F25E75797CC9CFD0FA46A4A2771CBE8FBFA1C426302156CD874FD306F953D641`；`header-ui.js`=`6E8F60623F86E62F5243916FC9F9C3720FE3F509F4887CC904D14664164A8D7B`；`import-ui.js`=`A0EDD5280B2DDE11A59E06D565BDB01482A56E2DBE80B3692CAED45B2E5E74CE`；`taskpane.html`=`EF97EB1B177F345619E9E4AC3204EC011474E6FBC90BE85844C316C985CA6215`；`inquiry-model.test.cjs`=`4A0ADE77FD502685DDF443F9C6FF8214B4B48C74569EB041D0991383125759EF`；`header.test.cjs`=`F2F277A76F7C5C7664450B9DCAB1DC0B3B2BD60529BECA9B3ECA3BBDE9F5E157`；`export-host.test.cjs`=`F43A18FA8C484D9792FB0929E3721DBAE0B479D1EF2314991486AF5028458461`；`ui-inquiry-check.cjs`=`CD229B9568372E63140058B5C20E324EB4C27D28AE678E6529F135B6EB307286`；`ui-brand-check.cjs`=`6D5FF54EF8F48A5914101DF3968B942EE2A0A164313BE4E82D1537D2C2C83B10`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/inquiry-model.test.cjs wps-addin/test/decimal.test.cjs wps-addin/test/export-host.test.cjs wps-addin/test/workflow-v3.test.cjs
# tests 60 / pass 60 / fail 0（inquiry-model 7例、export-host 12例含R9版式例）
node --test wps-addin/test/header.test.cjs
# tests 3 / pass 3 / fail 0
node --test wps-addin/test/*.test.cjs
# tests 307 / pass 307 / fail 0（R8时305，R9新增 inquiry-model 例与 export-host 版式例）
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:RFQ_UI_INQUIRY_SCREENSHOT='F:\材料软件开发\outputs\wps-acceptance-20260926\r9\pane-step6-inquiry.png'
$env:RFQ_UI_INQUIRY_EVIDENCE='F:\材料软件开发\outputs\wps-acceptance-20260926\r9'
node wps-addin/test/ui-inquiry-check.cjs
# PASS(R9): 图06总询价工作簿——5张询价页（水泵2/阀门1/风机1/充电桩1）、阀门20/12与品牌通达/海岳、抬头与打印版式成立；品牌取自汇总表读回，改品牌后旧生成过期并可重新生成。
node wps-addin/test/ui-brand-check.cjs
# PASS(过渡期面板) ＋ PASS(R7-1) ＋ PASS(R7+R8)
```

回归（逐条 PASS，均沿用R1–R8做法把 `NODE_PATH` 指向Codex运行时依赖，不加入插件运行依赖）：`ui-workflow-check`、`ui-sheet-review-check`、`ui-project-check`、`ui-render-stall-check`、`ui-check`、`ui-import-check`、`ui-classification-check`、`ui-category-check`、`ui-review-check`、`ui-export-check`、`ui-library-check`、`ui-memory-check`、`ui-pane-diagnostics-check`。浏览器用例需要Playwright与Edge；本机 `npm/npx` 不可用，直接用运行时内置的 `playwright` 模块。

## 4. 关键行为证据（模拟宿主＋真实服务端相邻暂存/独占发布/项目与分类库）

留证文件在本机忽略目录`outputs/wps-acceptance-20260926/r9/`：`pane-step6-inquiry.png`（第6步侧栏生成后状态）、`inquiry-model.json`（工作表名、阀门抬头块行、10列表头与两行材料、合并/填充/打印/冻结/列宽、水泵两张各2行）、`inquiry-status.json`（侧栏文案）、`inquiry-binding.json`（项目生成记录）、`inquiry-files.json`（实际发布文件）。

- **工作表组织（图06）**：5张询价页 `水泵_青源｜水泵_恒流｜阀门_合成询价｜风机_瑞风｜汽车充电桩_驰电`，其后为“内部追溯”“处理记录”两页；内部页不带公开询价版式，拆分只取 `kind=inquiry`。
- **合成材料只列一次**：阀门合成一份，两行 `FM-001 DN50 个 20`、`FM-002 DN65 个 12`，品牌列均为“通达 / 海岳”，供应商信息区“通达 — 正通商贸”“海岳 — 安合设备”；对比R8的4组品牌，未把材料行翻倍。
- **分别生成含本类完整材料**：水泵_青源、水泵_恒流各含本类完整2行（工程量2、3），品牌列各为本组品牌。
- **抬头与版式**：标题行1、项目名称/单位名称行3、材料经办人/联系方式行4、供应商信息行5-6、表头行7、数据行8-9；`PrintTitleRows='$7:$7'`、打印区域 `A1:J9`、特征列宽46、表头浅色填充、冻结表头以上。
- **报价与金额留空、全文本**：两列恒空，公开值全部字符串，无原价/历史价。
- **生成记录**：`inputKey=ck2-…`、`sha256` 64位、`sheetIds` 与 `modelSnapshot.sheets` 一一对应且只含 `kind=inquiry`；发布后再 `verify` 核 SHA 一致。同一内容重复生成询价页完全一致，时间只进“处理记录”页。
- **失效与重生成**：把阀门第1组品牌改为“通达B”重新读回后，`#inquiry-banner` 显示“总询价工作簿已过期”、`#inquiry-next` 禁用；重新生成后阀门品牌列变为“通达B / 海岳”。
- **阶段判定**：生成记录落盘后 `#project-status` 显示“询价表：已确认”；抬头未填齐时显示“询价抬头未填齐”并禁用生成。

## 5. 未完成与挂账

- **真实WPS核验未做**：真实WPS里打开总询价工作簿、查看5张询价页与内部页、打印重复表头/分页、长特征换行、抬头行数与合并、发布后读写一致，均挂账（与R2/R5/R6/R7/R8小样一起补做）。本包证据来自模拟宿主＋真实服务端，**不等于真实WPS证据**。
- **图06页签与内部页**：图06只画5个询价页签；本实现按 §4.4 保留“内部追溯/处理记录”两页（kind 区分，拆分不复制）。如需与图完全一致地隐藏内部页，留待真实WPS核验时按宿主支持情况决定。
- **拆分仍属R10**：本包只到“生成总询价工作簿＋进入第7步”；一键拆分、持久回执与失败续作在R10实现。`split-ui` 目前仍按单页 `{name,values}` 写出，未传 layout，属R10范围。
- **过渡期侧栏面板保留**：`brand-ui`/`classification-ui` 等旧面板仍收在“辅助功能”内，仅作旧流程回归；按 §7.1 在后续清理。
- **生成目录**：总询价工作簿默认按项目名建议文件名（`项目名_询价总表.xlsx`），保存位置由用户在另存对话框决定；未强制写入成果批次目录（图06示例位于“示例园区”目录）。

## 6. 下一步

R10（一键拆分、持久回执与失败续作，对应图07）：接 `/api/split/prepare|load|save` 按项目/批次隔离并用 `expectedRevision` 原子保护；拆前重核最新审核/汇总绑定、总簿 SHA、inputKey、目录与全部目标；独立 xlsx 保留 layout/抬头，只取 `kind=inquiry`；逐份独立暂存→重开核→独占发布→立即存回执；模拟失败/发布响应丢失/回执写失败/服务重启并可从回执续作，示例5文件名称与图一致。
