# R7 验证记录：双布局分类汇总表与名称超链接

> 日期：2026-09-27。范围：handoff 第5节 R7（图05A/05B）。**模型＋模拟宿主＋浏览器验证；真实WPS核验仍未执行（R2挂账继续）。**

## 1. 本包对应图号与验收点

按第1节看图约定，本包只实际打开**图05A、图05B**（未在同一会话重复打开全部8图；图04仅按R6既有结论引用，未重复打开）。

| 图05A/05B要素 | 实现情况 |
| --- | --- |
| 一类一行：序号、名称、材料条数、1至3组品牌与供应商、询价生成方式 | 已实现：按R6已核实的分类清单生成，4类2/2/2/1行，序号1–4，条数取自该类快照 |
| 品牌与供应商黄色填写区、初始空白 | 已实现：`#FFF7D6`填充覆盖三组区域；实测4行品牌/供应商单元格全为空字符串，等人工填写 |
| 每类自行选“合成一份/按品牌分别生成” | 已实现：方式列区域下拉，选项表在隐藏列`$M$1:$M$2`（同格为`$J$1:$J$2`），覆盖本类全部数据行 |
| 类别名称为蓝色下划线超链接，点击打开对应独立分类工作簿 | 已实现：原生`Hyperlinks.Add`，显示类别名，地址为**相对路径**`分类工作簿\水泵.xlsx`…；`Range.Font`蓝色下划线（`#0563C1`） |
| 两种布局（分列/同格）功能和生成结果一致 | 已实现：`separated`两行表头＋合并组头；`combined`单行表头＋“品牌与供应商一（用户填写）”；类别、条数、链接目标完全一致 |
| 同格单格两行标签说明 | 已实现：表底说明行写明“单格按两行填写：第一行‘品牌：…’，第二行‘供应商：…’”，侧栏同步说明 |
| 汇总表内填写，侧栏只有说明/状态/统计/操作 | 已实现：第5步侧栏只保留生成/打开/“填写完成，生成询价表”，无侧栏品牌编辑或二次确认 |
| 相邻暂存并核最终位置链接 | 已实现：`prepare(...,{adjacent:true})`在最终目录写唯一相邻暂存，写入→重开核→独占发布→SHA回执；相对链接基准落在最终目录 |
| 布局随项目保存、绑定可恢复 | 已实现：项目记录新增`summary`绑定（布局、数据区域、稳定类别ID、相对链接、内容键、批次、SHA），重开项目后恢复 |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/brand-model.js` | 新增R7分类汇总表模型：`summaryPlan`（一类一行预检：缺类别/缺路径/重复类别/链接重名）、`buildSummary`（双布局、组头合并、黄色填写区、方式下拉选项、名称相对链接与蓝色下划线、隐藏列存类别ID/相对链接、表底说明行、单页等宽矩阵）、`summaryBindingFor`/`validateSummaryBinding`、`relativePath`；旧的分类品牌表模型保留共存 |
| `wps-addin/src/brand-host.js` | 新增`summaryWrite`（复用独占发布路径）与`openSummary`（复用已打开的同路径工作簿，未打开则以可编辑方式打开并恢复宏安全值） |
| `wps-addin/src/workbook-layout.js` | 版式新增`fonts`区域（颜色/加粗/下划线）校验与构建，新增`linkFont`便捷区域与链接色`COLORS.link` |
| `wps-addin/src/export-host.js` | 落地`fonts`到`Range.Font`并在重开读回时校验；超链接读回允许WPS把相对地址解析为绝对地址（尾串一致即通过） |
| `wps-addin/src/import-ui.js` | 新增第5步渲染与主流程：生成/重新生成分类汇总表（同名另存时间戳新文件）、打开汇总表、逐类打开独立分类工作簿、布局下拉与第4步联动；`getBrandVerdict`改为分类汇总表判定，新增`getSummary`/`restoreSummary`；第4步“生成分类汇总表”按钮切到第5步并生成 |
| `wps-addin/src/project.js`、`src/project-ui.js` | 项目记录新增`summary`字段（收集/恢复/版本校验），不改动既有阶段与失效规则 |
| `wps-addin/taskpane.html` | 新增第5步“分类汇总表内填写品牌与供应商”面板（横幅/进度5/7/统计/状态/布局下拉/生成/打开/逐类清单/主按钮） |
| `wps-addin/test/summary-links.test.cjs`（新增） | 8个模型与模拟宿主用例：相对链接、清单预检、双布局版式、绑定、单页写入与重开读回、解析后绝对地址、打开复用 |
| `wps-addin/test/brand-model.test.cjs`、`test/brand-host.test.cjs` | 各加1例，覆盖R7汇总模型与宿主的共存与复用/打开语义 |
| `wps-addin/test/ui-brand-check.cjs` | 拆为“过渡期面板回归”＋“R7汇总流程”：图05A分列生成→4名称链接/隐藏列/下拉/回执核对→图05B同格另存新文件→重开恢复 |
| `wps-addin/test/ui-category-check.cjs` | 图04主按钮由“本包未实现汇总”改为切到第5步并按当前布局生成汇总表（R6回归口径适配R7） |

关键SHA256：`brand-model.js`=`6FF0EFCC84816BFC2AE09DE2F413D5D6D549A52610CEA4A8822F34130C6CCA11`；`brand-host.js`=`8FDAEDA8C5835A2C0ED8253BFA83244B440EFA0859551450C821EEF075BBB584`；`workbook-layout.js`=`578CFFDEBE12D4329D979BAC9AD7F58623174E944D9BE8DEFC97F77CBE7FE96C`；`export-host.js`=`43F45C7C69A3636D805D683BE029076CFFD3F5256A31AA150C8329F2C4F1CB9D`；`import-ui.js`=`7302640C66A5DC5B7A8DC3EBF9299C5423C0E07A28D775433748FF738443F5FD`；`project.js`=`8DE7A9F5138A448C94CF81A4899CF97169C2514F0860FE8D06446593085E091C`；`project-ui.js`=`6FEED21217063465E6F26F01866C3B3602352DBFB89D9C8E802F1AA5FDD54FD3`；`taskpane.html`=`201FE7B6CCA9406C1B27E5E47DBEC64A657A92716A36A1AF7A22F36DBC3CE689`；`summary-links.test.cjs`=`1307C2B8D9CE09AA889286D38FB3EB4E868BED2D3CCF687D821B89953844EAF6`；`ui-brand-check.cjs`=`1638DB29DC95C37DB81D21CAC4811409A455DE878F14145D97ECF92140940A7B`；`ui-category-check.cjs`=`73C6FAF2556F487215AF459D55FE166492586C065B83A85B0338CEFAF6A8307D`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/brand-model.test.cjs wps-addin/test/brand-host.test.cjs wps-addin/test/summary-links.test.cjs
# tests 20 / pass 20 / fail 0
node --test wps-addin/test/*.test.cjs
# tests 297 / pass 297 / fail 0（R6时287＋R7新增10）
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-brand-check.cjs        # PASS（R7新增：图05A/05B）＋ PASS（过渡期面板回归）
node wps-addin/test/ui-category-check.cjs     # PASS（R6回归，主按钮口径适配R7）
# 其余既有侧栏用例逐条PASS：ui-sheet-review-check / ui-workflow-check / ui-project-check / ui-library-check /
# ui-memory-check / ui-import-check / ui-review-check / ui-export-check / ui-classification-check /
# ui-render-stall-check / ui-pane-diagnostics-check / ui-check
```

（浏览器用例需要Playwright与Edge；本机按R1–R6既有做法把`NODE_PATH`指向Codex运行时依赖，不加入插件运行依赖。`ui-inquiry-check`/`ui-split-check`属R9/R10新增，本包尚不存在。）

## 4. 关键行为证据（模拟宿主＋真实服务端相邻暂存/独占发布/项目/分类库）

留证文件在本机忽略目录`outputs/wps-acceptance-20260926/r7/`：`pane-step5-separated.png`（图05A侧栏与逐类链接）、`pane-step5-combined.png`（图05B侧栏，新时间戳文件）、`summary-binding-separated.json`、`summary-binding-combined.json`（项目记录里的汇总绑定）、`summary-models.json`（两布局模型）、`summary-files.json`（两份汇总表文件并存）、`summary-stage-status.json`。

- **一类一行**：4个询价类别各一行，序号1–4、条数2/2/2/1；无需询价（钢索）不进入汇总表。
- **双布局**：分列＝两行表头＋`D2:E2/F2:G2/H2:I2`合并组头；同格＝单行表头“品牌与供应商一（用户填写）…”。实测两布局类别、条数、链接目标完全一致。
- **名称链接**：4个名称单元格写原生超链接，地址为相对路径`分类工作簿\水泵.xlsx`等，显示类别名；字体为蓝色（`#0563C1`）下划线。读回时WPS若把相对地址解析成绝对地址（`C:\…\分类工作簿\水泵.xlsx`），按尾串一致判定为同一链接。
- **填写区与下拉**：三组区域黄色填充、初始空白；方式列区域下拉引用隐藏列选项表（分列`$M$1:$M$2`、同格`$J$1:$J$2`），覆盖本类全部数据行。
- **隐藏列**：分列`K/L/M`、同格`H/I/J`保存稳定类别ID、相对链接与方式选项，公开区仍是一类一行的干净表格，不新增工作表页签。
- **相邻暂存与最终位置**：`prepare(...,{adjacent:true})`在最终目录写`.分类汇总表.xlsx.tmp-*`唯一暂存，写入→重开核→独占发布到`…\分类汇总表.xlsx`→SHA回执；相对链接基准即最终目录，整目录搬移后仍指向同目录下的分类工作簿。
- **不覆盖**：第二次（同格布局）生成时探测到同名文件已存在，另存`分类汇总表_yyyyMMdd-HHmmss.xlsx`，两份文件并存且旧文件逐字节不变。
- **回执随项目保存与恢复**：项目记录`summary`保存布局、表头/数据起始行、4个类别的稳定ID与相对链接、内容键、分类批次、SHA；重开后第5步恢复“分类汇总表已生成（4 类）”与布局`combined`，逐类清单4行。
- **阶段判定诚实**：生成汇总表只代表产物存在；在R8读回填写内容之前，`#project-status`显示“品牌汇总：未完成（分类汇总表已生成（4 类，品牌、供应商分列），请填写品牌与供应商后生成询价表）”，不误报完成。
- **R6回归适配**：图04主按钮点击后切到第5步并按当前布局生成汇总表；整表确认变化/分类批次变化/布局变化都会让汇总表标记“已过期”，要求重新生成，不沿用旧绑定。

## 5. 未完成与挂账

- **真实WPS核验未做**：4个名称超链接在真实WPS里逐类点击是否打开正确独立工作簿、关闭重开后地址是否保持、整目录搬移后相对链接是否仍可用、同格布局单格两行标签读回，均挂账（与R2/R5/R6小样一起补做）。本包截图与文件证据来自模拟宿主＋真实服务端暂存/发布，**不等于真实WPS证据**。
- **填写读回属R8**：本包不读取汇总表里的品牌/供应商，也不生成询价表；主按钮“填写完成，生成询价表”如实说明属R8/R9。
- **过渡期侧栏品牌面板保留**：它仍收在“辅助功能”内，仅作旧流程回归；R8/R9落地后删除，本包不改写其历史行为。
- **`categories-summary`按钮语义变化**：由“本包未实现汇总”改为切到第5步生成汇总表，`ui-category-check`同步适配。

## 6. 下一步

R8（汇总读回、多品牌关系与联动，对应图05A/05B→06）：两布局解析等价、1/2/3组/空组/半组/同格标签错误、按稳定categoryId读回不串类、规范化3组品牌与供应商并查重复组合与生成方式、询价对象显式带groups。
