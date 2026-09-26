# R6 验证记录：生成独立分类工作簿

> 日期：2026-09-26。范围：handoff 第5节 R6。**模型＋模拟宿主＋浏览器验证；真实WPS核验仍未执行（R2挂账继续）。**

## 1. 本包对应图号与验收点

按第1节看图约定，本包只实际打开**图04**（未在同一会话重复打开全部8图）。

| 图04要素 | 实现情况 |
| --- | --- |
| 每个询价类别一个独立.xlsx（不是一个工作簿多个分类页） | 已实现：按确认快照`categoryId`分组，每类单独建工作簿；4个类别＝4个文件4次建簿，实测`state.created=4`、4个不同暂存路径 |
| 每簿只含本类全部材料 | 已实现：水泵/阀门/风机各2行、汽车充电桩1行，共7行纳入询价 |
| 材料明细10列：序号、项目编码、项目名称、项目特征描述、单位、工程量、品牌、报价单价、金额、备注 | 已实现：表头第1行、数据第2行起，公开列固定10列；品牌、报价单价、金额留空 |
| 无需询价行只保留在审核成果中 | 已实现：`skip`/`no-inquiry`行不进任何分类文件（钢索rowId不在任何工作簿），侧栏显示“7 行纳入询价 · 1 行无需询价” |
| 侧栏“4 个分类工作簿已生成”＋真实目录 | 已实现：横幅文案与图一致，状态行显示实际`…/分类工作簿`目录 |
| 品牌填写布局（默认“品牌、供应商分列”，可同格） | 已实现：下拉默认`separated`，同格为`combined`；解锁条件＝全部文件核实通过，随项目保存供R7使用 |
| 主按钮“生成分类汇总表” | 按图可点（全部核实后解锁）；点击给出明确说明“分类汇总表属于R7”，本包不伪造汇总结果 |
| 文件全部实际生成且校验后才算完成 | 已实现：逐份写入→重开核公开值/版式→独占发布→SHA回执；局部成功显示“已生成 3 / 4”，不显示全部完成 |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/category-workbooks.js`（新增） | 模型：按`categoryId`分组、排除无需询价、保留rowId/scopeId/数量；文件清单预检（非法名称清洗、清洗后重名、缺类别、行标识不属于本次绑定）；每类一个工作簿（单一“材料明细”页＋K列隐藏rowId）；持久回执（路径/SHA/状态/批次）与`statusOf`一致性；宿主写入（复用export-host）与逐份打开 |
| `wps-addin/src/import-ui.js` | 第4步面板渲染与主按钮；整表确认落盘后自动按新快照生成；先`inspect`既有目标→有同名文件即另建批次目录；首次生成用成果表所在目录（图04：项目名/分类工作簿）；已成功文件按记录SHA跳过、被外部改写时拒绝覆盖；每份成功立即落盘回执；重试只处理未完成；全部核实后解锁布局与汇总 |
| `wps-addin/src/classification-review-host.js` | 内部绑定`fields`增补`scopeId`/`sourceIds`（加法；R5公开列与读回口径不变），供R6按rowId取来源边界与编码 |
| `wps-addin/src/project-ui.js` | 项目记录新增`categories`的收集与恢复（`getCategories`/`restoreCategories`） |
| `wps-addin/dev/export-files.cjs` | `prepare`新增`createParent`（仅在显式要求时创建分类工作簿目录，仍禁止覆盖）；新增`inspect(target,sha)`按记录SHA核对已发布文件（不依赖内存票据） |
| `wps-addin/dev/server.cjs` | 登记`/src/category-workbooks.js`静态资源；新增`/api/export/inspect`，`prepare`支持`createParent` |
| `wps-addin/taskpane.html` | 新增第4步“按审核结果生成独立分类工作簿”面板（图形/进度4/7/横幅/逐份状态/布局下拉/生成汇总表） |
| `wps-addin/test/category-workbooks.test.cjs`（新增） | 8个模型与模拟宿主用例 |
| `wps-addin/test/ui-category-check.cjs`（新增） | 端到端侧栏用例（真实服务端暂存/独占发布/项目/分类库） |
| `wps-addin/test/export-files.test.cjs` | 新增`createParent`与`inspect`用例 |

关键SHA256：`category-workbooks.js`=`16743F5C2EFABD065EC25EA7B937EDB1B28BA2C96541EEA816A6308D48D12DF9`；`import-ui.js`=`25E77DA7F1FA3A468E9E62311C45B9E4EFBCE072393CE04F1B0C15358A945BBE`；`classification-review-host.js`=`1B0E885F0C553D8441525F94D878DBC60DE7529B0614DF6C8ED8EB75DCBB5D00`；`export-files.cjs`=`336F58F34F899C0B32297C96D1A9A268B43A298F21E1937C3070713B81334D3A`；`server.cjs`=`099E8657B08A2247942D4D2C3CAEEA61ADFED4548186B639E9FDC2224E05A1A2`；`project-ui.js`=`D508311C839C02A849BF58E120201384435FED9EA024E763DA4E58854718D65A`；`taskpane.html`=`CDB6D4BF5D1E6D0FDEDE0817BFBD6B155CB882105CE3AFF25E1C02EC08D686AC`；`category-workbooks.test.cjs`=`77CACDD3D5A286B537FF0C966947E0C504044BBDAB8E3E7461A7EC07E1A94DA2`；`ui-category-check.cjs`=`B512B58F7B123AC48B1F87A910E2CFB4D3189B0EE37C11968A43BA233FA98EE2`；`export-files.test.cjs`=`A6352944621025E4F12D5EC79DDBB844ED25D3BF837E4E3758D3AAA48E87B52C`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/category-workbooks.test.cjs wps-addin/test/export-host.test.cjs wps-addin/test/export-files.test.cjs
# tests 26 / pass 26 / fail 0
node --test wps-addin/test/*.test.cjs
# tests 287 / pass 287 / fail 0
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-category-check.cjs     # PASS（新增，连续8次通过）
node wps-addin/test/ui-sheet-review-check.cjs # PASS（R5回归，连续3次通过）
# 侧栏用例14组全部PASS：ui-category-check / ui-sheet-review-check / ui-workflow-check / ui-project-check /
# ui-brand-check / ui-library-check / ui-memory-check / ui-import-check / ui-review-check / ui-export-check /
# ui-classification-check / ui-render-stall-check / ui-pane-diagnostics-check / ui-check
```

（浏览器用例需要Playwright与Edge；本机按R1–R5既有做法把`NODE_PATH`指向Codex运行时依赖，不加入插件运行依赖。）

## 4. 关键行为证据（模拟宿主＋真实服务端暂存/发布/项目/分类库）

留证文件在本机忽略目录`outputs/wps-acceptance-20260926/r6/`：`pane-step4.png`（图04侧栏，默认分列布局）、`pane-step4-rebatch.png`（重新生成后的新批次）、`category-receipt.json`（项目记录里的分类清单回执）、`category-workbook-rows.json`（4份工作簿的逐行公开值与rowId）、`category-regenerated.json`（两批次目录对照）。

- **先检查全部目标再写第一份**：全部目标先`prepare`（目标是否存在、文件名是否合法、目录是否可用），任一份不可用即报错且**不写任何文件**（实测失败一份时目录里没有该文件，也没有其他新增文件）。
- **4个独立文件2/2/2/1行**：水泵.xlsx（DN50=2、DN65=3）、阀门.xlsx（20/12）、风机.xlsx（规格A=2、规格B=3）、汽车充电桩.xlsx（充电桩配套=1）；4次写入各自新建工作簿（`created=4`、4个不同暂存路径），不是“一个工作簿4张表”。
- **公开值**：材料明细10列，表头第1行；品牌/报价单价/金额/备注全为空；序号按本类重排1、2；项目编码取来源编码（合并行取首个来源，如水泵DN65=`SB-002`）；rowId只放K列并隐藏，不新增第二张工作表。
- **无需询价排除**：钢索（无需询价）不在任何分类工作簿中，只计入“1 行无需询价”。
- **局部成功不显示全部完成**：模拟“风机.xlsx”写入失败→侧栏显示“已生成 3 / 4 份分类工作簿”，汇总与布局仍禁用，项目记录`categories.status=partial`且失败原因逐份可见。
- **重试只处理未完成（含跨重启）**：重新加载侧栏并重新打开项目后，第4步仍显示“已生成 3 / 4”；点“重试未完成文件”，已成功3份按记录SHA核对后跳过（重载后新写入次数＝1，且只写风机.xlsx），全部成功才转为`complete`并显示实际目录。
- **SHA与落盘一致**：4份文件的实际字节SHA与回执`sha256`逐一相符（测试重新计算磁盘内容核对）。
- **重新生成另建批次**：整表确认或用户点“重新生成分类工作簿（新批次）”时，探测到目标已存在即改用`项目名_yyyyMMdd-HHmmss_短ID/分类工作簿`新批次目录；旧批次4个文件内容逐字节未变（不是覆盖同一路径）。
- **确认变化即过期**：项目记录里的分类回执与当前整表确认版本不一致时，第4步显示“分类工作簿已过期”，汇总与布局保持禁用，`#project-status`回到“分类工作簿：未完成”；重新生成进入新批次，旧批次文件保留。
- **回执状态与显示一致**：落盘前先按每份文件真实状态更新回执`status`，任何时刻都不会出现“侧栏显示全部完成、记录里仍是未完成”的窗口（本包验证中发现并修掉该顺序问题）。
- **后置解锁**：全部核实后才解锁“品牌填写布局”（默认`separated`）与“生成分类汇总表”；布局选择随项目保存，供R7使用。
- **阶段判定**：`#project-status`在全部核实后显示“分类工作簿：已确认（分类工作簿已生成并校验（4 份））”；整表确认变化（第2次确认）会使分类工作簿阶段重新变为未完成，必须重新生成，不沿用旧确认的产物。

验证中发现并修掉的两个实现缺陷（均已在最终代码中回归）：

1. 持久回执只存rowId/路径/SHA/状态，不含材料行；最初直接把它当工作簿内容写，会写出空表或以“forEach of undefined”失败。现改为写入时取本次分组清单，模型对缺材料行的输入明确拒绝（`缺少材料行`）。
2. 换批次时按文件名沿用旧批次“已成功”状态，导致新批次第一次核对就报“文件已不存在”。现只用同一批次、同一路径的成功记录做SHA跳过。

## 5. 未完成与挂账

- **真实WPS核验未做**：4份工作簿的真实写入/重开、隐藏列、冻结打印、中文文件名与打开后置前仍挂账（与R2/R5小样一起补做）。本包侧栏截图与文件证据来自模拟宿主＋真实服务端暂存/发布，**不等于真实WPS证据**。
- **批次命名**：首版按图04在成果表所在目录下建`分类工作簿`子目录；重新生成才使用第4.3节的时间戳批次名。时间戳批次是否也用于首次生成的命名统一，留R13说明定稿。
- **“生成分类汇总表”按钮按图04可点**，但汇总表本身属R7；本包只解锁并记录布局选择，未生成汇总表（不伪造下游结果）。
- 分类汇总表、名称超链接、多品牌读回、总询价与拆分仍属R7–R10。

## 6. 下一步

R7（双布局汇总与名称超链接，对应图05A/05B）：按R6验证过的分类清单生成一类一行，名称加蓝色下划线原生链接指向对应分类工作簿，按本包记录的布局生成分列/同格3组黄色填写区，相邻暂存生成并核最终位置链接。
