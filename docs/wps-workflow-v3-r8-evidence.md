# R8 验证记录：汇总读回、多品牌关系与联动

> 日期：2026-09-27。范围：handoff 第5节 R8（图05A/05B→06）。**模型＋模拟宿主＋浏览器验证；真实WPS核验仍未执行（R2挂账继续）。**

## 1. 本包对应图号与验收点

按第1节看图约定，本包实际打开**图05A、图05B、图06**，并因本包直接依赖R6分类工作簿的类别与条数，另打开**图04**一次确认样例口径（未在同一会话重复为多个工作包打开全部8图）。

| 图05A/05B→06要素 | 实现情况 |
| --- | --- |
| 两种布局解析等价：一类一行、1至3组品牌与供应商、方式列 | 已实现：`parseSummary`按稳定类别ID与布局解析，分列取`D/E、F/G、H/I`，同格解析单格两行，两种布局解析成同一套 `{categoryId,mode,groups}` |
| 空组忽略、半组报错、同格标签缺失/重复/额外文本报错 | 已实现：空组忽略；半组定位到具体单元格；同格缺“品牌/供应商”标签、标签重复、额外不明文本都定位单元格，不猜 |
| 按稳定categoryId读回、排序不串类 | 已实现：类别ID存放在隐藏列（分列`K`、同格`H`），排序后仍按ID对应；实测交换两行后类别/名称/条数/品牌不串 |
| 删行/复制行/改名称条数都要定位 | 已实现：删行报“缺少类别行”，复制行报`category-duplicate`并定位单元格，改名称报`B…`、改条数报`C…` |
| 3组brand/supplier规范化、查重复组合与生成方式 | 已实现：同品牌不同供应商保留不同组，完全重复组合报错；1组默认合成，多组未选方式不放行 |
| 询价对象显式带groups，多品牌不被最后一品牌覆盖 | 已实现：`brand-table.brandMap`改为多值、`requireBrands`返回每行`groups`；`deliveryContext.brandGroups`与项目`brands`显式携带品牌组 |
| 主按钮读最新表、校验、可靠保存、显示有效类别及预计份数、无侧栏二次确认 | 已实现：`#brands-confirm`调用`RfqBrandHost.readSummary`→校验→`projects.save()`；显示“4 类有效、预计5份（水泵2、阀门1、风机1、汽车充电桩1）”；无侧栏品牌确认环节 |
| 失败保留表内填写、旧读回作废 | 已实现：校验失败不改汇总表；已读回后再改坏表内内容，旧读回作废并落盘，阶段回到“未完成” |
| 品牌/供应商/方式变化使询价/拆分失效；改布局生成新表不覆盖填写 | 已实现：品牌组进入inquiry/split内容键但不进入brands键；改布局另存新时间戳文件并清空旧读回 |
| 图06样例：5份（水泵2、阀门1、风机1、充电桩1），多品牌正确传递 | 已实现：`expectedSheets=5`；水泵2组按品牌分别生成、阀门2组（通达/海岳）合成一份，多品牌按组保留 |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/brand-model.js` | 新增R8读回：`parseSummary`（表头/稳定类别ID/名称条数/分组/方式逐项核对并定位单元格）、`parseCombinedGroup`（同格两行标签解析）、`summaryReadRecord`（可复现业务记录）、`summarySheetCount`/`summaryCountsText`；`summaryBindingFor`补充`auxCategory`/`auxFile`，`validateSummaryBinding`校验方式列 |
| `wps-addin/src/brand-host.js` | 新增`readSummary`：复用已打开的同路径工作簿（含未保存修改），未打开则只读打开、读完关闭；解析交给模型 |
| `wps-addin/src/brand-table.js` | 修复handoff§3.2记录的“多品牌后项覆盖前项”：`brandMap`改为rowId→多值数组，`requireBrands`返回每行`groups`，新增`assignmentIds` |
| `wps-addin/src/import-ui.js` | 第5步主按钮改为真实读回：`readSummaryBrands`读取→校验→`projects.save()`；`summaryVerdict`在“生成+读回通过且输入键/路径/布局一致”时才ready并带`rows`；新增`getBrands`/`restoreBrands`；重新生成清空读回；校验失败作废旧读回；`deliveryContext`带`brandGroups` |
| `wps-addin/src/project-ui.js` | 项目字段`brands`随项目收集/恢复（版本校验沿用schemaVersion=1） |
| `wps-addin/taskpane.html` | 第5步新增`#brands-issues`问题清单（定位具体单元格），更新说明为R8读回口径 |
| `wps-addin/test/brand-model.test.cjs` | 新增4例R8读回：双布局等价与5份、单组/空组/半组/重复组合/未选方式、稳定ID与删行复制行改名称条数、同格标签错误 |
| `wps-addin/test/brand-host.test.cjs` | 新增1例R8读回：复用已打开簿/只读打开后关闭/解析成品牌口径 |
| `wps-addin/test/brand-table.test.cjs` | 适配多值映射并新增1例：同一材料行多组品牌保留全部、不再被最后一组覆盖 |
| `wps-addin/test/workflow-v3.test.cjs` | 新增1例：品牌组进入inquiry/split键但不进入brands键、改品牌/改方式只让询价及之后失效、读回顺序稳定 |
| `wps-addin/test/ui-brand-check.cjs` | R7汇总流程扩展到R8：半组定位单元格且不误报完成→读回通过显示预计5份→已读回后改坏表内使旧读回作废→同格布局读回等价→重开恢复 |

关键SHA256：`brand-model.js`=`C5DEDCCD5CA89515547C1A869CDAEAD9DDACD5BA1B68BC2CA16FA84FE5F40388`；`brand-host.js`=`C312265668A32672122AAB8484495B4BF994345436DD50CEE454F6953D2C66B7`；`brand-table.js`=`1FC10CD6A4377FEF90A8E78F0640C045FA0DD69AFF66C3AF909C2F0F336AFA4D`；`import-ui.js`=`EF0D06DE2678788813F602825FD5C13310234F15C1D47A2C90B61092CA046BDA`；`project-ui.js`=`1000E72749D7F9D26F93979F66D03EDD39E6A945B565BB6BD19276AA5F5C63CA`；`taskpane.html`=`5DDE97C175006C02B69B2523061643D9CFB7375CF36DDB1BDD760ADA74BDCF77`；`brand-model.test.cjs`=`80055D2693CC324F4DC9B6D260B17E55705B992E06C39A0D1F1B699D7D512D22`；`brand-host.test.cjs`=`611568B577064548A731B3A59C9D7140CA2F0A14C618810E5DDFD1B94BADBA80`；`brand-table.test.cjs`=`7A6B4BF662A8C9BE6B415C73C572E9D916224154A4F638613B74436F5AC74A43`；`ui-brand-check.cjs`=`F2B30D8F0F4AEE936AFE10F0B1307893A3BEDE30767EBE4A5BB189D21DE14F47`；`workflow-v3.test.cjs`=`125E6813DA8BC860121F8EF366D7EF4AD3261B618A212C68A23E9C09A4DC54EC`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/brand-table.test.cjs wps-addin/test/brand-model.test.cjs wps-addin/test/brand-host.test.cjs wps-addin/test/summary-links.test.cjs wps-addin/test/inquiry-model.test.cjs
# tests 43 / pass 43 / fail 0
node --test wps-addin/test/workflow-v3.test.cjs
# pass（含R8品牌组业务键新例）
node --test wps-addin/test/*.test.cjs
# tests 305 / pass 305 / fail 0（R7时297＋R8新增8）
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:RFQ_UI_SUMMARY_SCREENSHOT='F:\材料软件开发\outputs\wps-acceptance-20260926\r8\pane-step5.png'
$env:RFQ_UI_SUMMARY_EVIDENCE='F:\材料软件开发\outputs\wps-acceptance-20260926\r8'
node wps-addin/test/ui-brand-check.cjs   # PASS(过渡期面板)＋PASS(R7-1)＋PASS(R7+R8)
node wps-addin/test/ui-category-check.cjs / ui-project-check / ui-sheet-review-check / ui-workflow-check / ui-check  # 逐条PASS
```

（浏览器用例需要Playwright与Edge；沿用R1–R7做法把`NODE_PATH`指向Codex运行时依赖，不加入插件运行依赖。）

## 4. 关键行为证据（模拟宿主＋真实服务端相邻暂存/独占发布/项目/分类库）

留证文件在本机忽略目录`outputs/wps-acceptance-20260926/r8/`：`pane-step5-separated.png`、`pane-step5-combined.png`（第5步侧栏读回状态）、`summary-binding-separated.json`/`summary-binding-combined.json`（含`auxCategory`/`auxFile`的绑定）、`summary-models.json`（两布局模型）、`summary-files.json`、`summary-stage-status.json`。

- **两布局解析等价**：分列与同格对第6.1节样例解析出相同 `{categoryId,mode,groups}`：水泵`per-brand`[青源/华川设备、恒流/启明机电]、阀门`synthesize`[通达/正通商贸、海岳/安合设备]、风机`synthesize`[瑞风/瑞风设备]、汽车充电桩`synthesize`[驰电/远程电气]。
- **预计份数**：`expectedSheets=5`（水泵2、阀门1、风机1、汽车充电桩1），侧栏显示“预计 5 份询价表（水泵 2 份、阀门 1 份、风机 1 份、汽车充电桩 1 份）”。
- **读回定位**：半组（只填品牌）定位到`分类汇总表!G4`（分列）或`D5`（同格缺供应商标签）；复制行报`K5`；改名称报`B5`、改条数报`C5`；同格额外文本报`D5`。
- **多品牌不被覆盖**：`brandMap`多值、`requireBrands`每行返回`groups`；阀门两行均保留“通达 / 海岳”两组，分别/合成取值不再被最后一品牌覆盖。
- **失败保填写、旧读回作废**：校验失败不改汇总表；已读回后再改坏表内内容，项目`brands`被清空落盘，`#project-status`回到“品牌汇总：未完成”。
- **阶段判定诚实**：只有读回通过且输入键/路径/布局仍一致，品牌汇总才显示“已确认”；生成汇总表但未读回前显示“未完成”。
- **失效正确**：品牌组进入inquiry/split内容键、不进入brands键；改品牌或改方式只让询价及之后失效；读回顺序（类别序、材料序）不影响内容键。
- **随项目保存与恢复**：项目保存`brands`（schemaVersion=1，含布局、预计份数、逐类mode/groups、读回时间与来源SHA）；重开后第5步恢复“品牌与供应商已读回（4 类）”、布局`combined`、品牌汇总已确认。

## 5. 未完成与挂账

- **询价表实际生成仍属R9**：本包完成“读回＋校验＋保存品牌组＋预计份数”，主按钮“填写完成，生成询价表”当前读回后如实显示预计份数，**不生成总询价工作簿**；总询价、合成/分表及版式在R9实现。图06的品牌联动数据已就绪（`deliveryContext.brandGroups`），待R9渲染。
- **真实WPS核验未做**：在真实WPS里填写汇总表后点读回、同格两行标签、名称链接打开、整目录搬移后链接失效/可用、保存重开均挂账（与R2/R5/R6/R7小样一起补做）。本包证据来自模拟宿主＋真实服务端，**不等于真实WPS证据**。
- **过渡期侧栏品牌面板保留**：仍收在“辅助功能”内仅作旧流程回归；R9落地后删除。
- **删行定位**：删除类别行时只能报“缺少类别“X”的行”，无法给出具体单元格（行已被删除）；复制行/改名称/改条数均定位到单元格。

## 6. 下一步

R9（总询价、合成/分表及版式，对应图06）：按每组一个inquiry对象、合成每类一个对象并全部groups、材料只列一次；品牌列按对象取值、供应商区逐组对应；落实图06抬头（4字段必填、地址可选）、10列、长特征换行、打印重复表头；layout经模型→workbook→host；保存并核总簿sheetId/内部kind、SHA/inputKey及固定modelSnapshot；UI显示当前簿、5份输出/每类方式、“返回汇总表修改”和进入拆分。
