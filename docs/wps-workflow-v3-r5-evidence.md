# R5 验证记录：表内审核、整表确认与学习

> 日期：2026-09-26。范围：handoff 第5节 R5。**模型＋模拟宿主＋浏览器验证；真实WPS核验仍未执行（R2挂账继续）。**

## 1. 本包对应图号与验收点

按本轮看图约定，先只看R5直接相关的**图03**（并复核图02确认“匹配情况”列口径），未在同一会话重复打开全部8图。

| 图03要素 | 实现情况 |
| --- | --- |
| 主表列顺序：序号、项目名称、规格、单位、工程量、自动建议、匹配情况、最终分类、审核备注 | R4已落地，本包沿用；表头第3行、数据第4行起 |
| 最终分类浅黄可编辑，下拉包含有效类别与“无需询价” | R4已落地（区域引用下拉），R5整表读回把名称解析回稳定类别编号 |
| “匹配情况”列在表内重算为一致/存在差异 | 整表读回时按“最终分类 vs 自动建议”重算；确认/存草稿时原位刷新已打开簿的该列显示（不保存文件） |
| 直接修改“最终分类”“审核备注”，确认前可继续修改 | 只接收这两列作为人工审核结果；其余列按生成时的固定字段快照核对，被改即报单元格 |
| “保存审核成果”仅存草稿 | 只把草稿写进项目记录：不确认、不学习、不生成分类工作簿，不推进阶段 |
| 主按钮“审核完成，生成分类工作簿”，整表一次确认 | 主按钮按稳定rowId读回全部行（含筛选隐藏行、含打开簿未保存修改），整表校验通过才确认 |
| 空分类/未知分类/异常行定位到具体单元格 | 每处问题带工作表＋行＋列，侧栏逐条“定位”按钮选中该单元格；整表不完整不放行 |
| 不增加逐行已审核勾选，不要求回侧栏重新确认分类 | 主流程无逐行勾选；侧栏“表内审核”只读确认快照与统计 |
| 充电桩配电箱改汽车充电桩、钢索无需询价 | 合成样例确认结果：8行、7行一致＋1行存在差异、1行无需询价、1条审核备注 |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/classification-review-model.js` | 新增整表读回校验（空分类/未知分类/固定字段问题→行列）、一致/存在差异重算、整表确认快照、草稿快照、改确认差异行、绑定有效性（缺表/旧inputKey） |
| `wps-addin/src/classification-review-host.js` | 绑定记录生成时的“自动建议”并当作固定字段核对；新增问题单元格定位（选中具体单元格）与“匹配情况”列原位刷新（只改显示、不保存文件、不关用户簿） |
| `wps-addin/src/project.js` | 项目v2新增`reviewDraft`字段（草稿），`review`继续作为整表确认快照；下游失效仍按`review`层传播 |
| `wps-addin/src/project-ui.js` | 抽出可等待的项目保存；新增`commitReview`/`commitReviewDraft`（乐观锁、先落盘）；“表内审核”阶段只按整表确认快照判定；项目恢复草稿与确认 |
| `wps-addin/src/classification-ui.js` | 习惯保存改为可等待（保存失败仍保留重试入口）；新增按项目/rowId/decisionRevision的`learnConfirmations`（改确认只撤销被改行） |
| `wps-addin/src/import-ui.js` | R5主流程：进入第3步自动读回、保存草稿、整表确认（先落盘快照→再学习→再进入下一步）、错误列表与定位、确认过期提示；过渡面板沿用原逐行口径（不影响正式阶段判定） |
| `wps-addin/src/workflow-ui.js` | 新增`onStageChange`钩子，进入“表内审核”时自动读回成果表 |
| `wps-addin/taskpane.html`、`styles.css` | 新增第3步“在表格中修改，整表一次确认”面板：进度3/7、状态、主按钮“审核完成，生成分类工作簿”、次按钮“保存审核成果”、问题列表与习惯重试 |

关键SHA256：`classification-review-model.js`=`F8CEE61EE95BF7D123672DE9BE06E4D162C5F43F4D8BD49D24D956D68C2A5C48`；`classification-review-host.js`=`0733D9A9A1FFD0979D2CC687312D2DFF311635D935A6DBE5BFB6E16A8FB63AA2`；`import-ui.js`=`38F8D12D9611CA11927AEFDA55252CFCCFB24DEA4B8BBA676BFC74C511C63849`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/classification-review-model.test.cjs wps-addin/test/classification-review-host.test.cjs wps-addin/test/classification.test.cjs wps-addin/test/category-memory.test.cjs
# tests 32 / pass 32 / fail 0
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-sheet-review-check.cjs        # PASS（新增）
node wps-addin/test/ui-memory-check.cjs             # PASS
node --test wps-addin/test/*.test.cjs                # tests 277 / pass 277 / fail 0
# 侧栏用例13组全部PASS：ui-check / ui-review-check / ui-import-check / ui-export-check / ui-project-check /
# ui-classification-check / ui-workflow-check / ui-sheet-review-check / ui-memory-check / ui-library-check /
# ui-brand-check / ui-render-stall-check / ui-pane-diagnostics-check
```

（浏览器用例需要Playwright与Edge；本机按R1–R4既有做法把`NODE_PATH`指向Codex运行时依赖，不加入插件运行依赖。）

## 4. 关键行为证据（模拟宿主＋真实服务端暂存/发布/项目/分类库）

留证文件在本机忽略目录`outputs/wps-acceptance-20260926/r5/`：`pane-step3-draft.png`（图03草稿态侧栏）、`pane-step3.png`（确认后侧栏）、`sheet-review-state.json`（表内实际值＋用户改动）、`confirmation.json`（整表确认快照）、`review-draft.json`（草稿）。

- **只给建议、不确认**：生成成果表仍不确认、不学习；未生成成果表时第3步面板未就绪（按钮禁用）。整表未完成时点主按钮只报问题：项目目录仍为空、习惯记忆仍为0条。
- **草稿**：填完8行后点“保存审核成果”→项目`reviewDraft.state=draft`、`counts.rows=8/filled=8`，`review=null`，习惯记忆0条；侧栏提示“尚未确认、未学习、未生成分类工作簿”。
- **整表校验与定位**：把水泵DN50的最终分类清空→报`category-empty`（第4行 H列），侧栏列出问题并选中H4；改成“临时类别”→报`category-unknown`并提示用下拉重选。两处都不写项目、不学习、不放行。
- **整表一次确认**：8行通过后点主按钮→项目`review`快照（8行、rowId、类别编号、备注、`inputKey=ck2-…`、`revision=1`、成果表路径/SHA），7行一致＋1行存在差异＋1行无需询价；随后进入第4步，项目状态显示“表内审核：已确认（整表已确认并保存快照（8 行））· 分类工作簿：未完成”。
- **先落盘再学习**：确认快照写入项目记录成功后才写习惯；8条记忆各1个来源，来源带`sourceProjectId`（稳定项目身份）与`sourceRowId`；“无需询价”也按人工决定记录。
- **幂等**：再次点主按钮→提示“整表内容与上次确认一致，未重复确认”，项目版本与习惯记忆字节不变。
- **改确认只撤销该行**：把送风机改选“阀门”后确认→旧“送风机→风机”记忆来源被撤销（记录保留为`revoked`），其余7条不动，新增“送风机→阀门”，确认快照进入`revision=2`。
- **旧inputKey**：把绑定`inputKey`改成旧值并重开项目→侧栏明确提示“成果表绑定的是旧内容：需重新生成审核成果表后才能再次整表确认”；点主按钮被拒绝（`整表确认未完成…旧内容…重新生成审核成果表`），已保存的确认快照（8行、revision=2）原样保留。
- **匹配情况列**：确认/存草稿时把已打开成果簿第7列原位刷新为“一致/存在差异”（样例写8处），不保存文件，因此磁盘SHA与绑定仍可核。

## 5. 未完成与挂账

- **真实WPS核验未做**：成果表下拉、冻结打印、中文路径与“匹配情况”原位刷新在真实WPS的表现仍挂账（与R2小样一起补做）。
- 分类工作簿（R6）尚未实现：确认后按钮文案按图03保留“审核完成，生成分类工作簿”，实际生成在R6开发包完成。
- 示例行序按来源顺序（钢索来自第一份清单末尾，图02/03的样例把它画在最后一行），属样例示意，不按图改写业务顺序。
- 侧栏“匹配情况”刷新只改内存显示不落盘：不覆盖用户修改、不改文件SHA；用户自行决定是否保存工作簿。
- 辅助功能里的过渡面板（分类核对/过渡品牌表）仍为逐行口径，且只影响其自身可操作性，不代表正式阶段完成（R7/R8落地后删除）。

## 6. 下一步

R6（生成独立分类工作簿，对应图04）：按确认快照categoryId分组、排除无需询价，一次预检全部目标与非法名称，逐类独立xlsx“材料明细”10列，逐份重开核＋独占发布＋SHA回执，全部核实后再解锁布局选择与汇总生成。
