# F4 最终窗口业务与恢复补验证据（2026-10-11）

入口 `feat/wps-phase1`@`cd3d88dc719a9fd9cae5b97a46a2940d2ab2b9dc`（开工HEAD，`git status`只有入场未提交`wps-addin/dev/pane-diagnostics.js`，原样保留、不暂存）。真机WPS表格 **12.1.0.29161**（`E:\WPS\WPS Office\12.1.0.29161`）。开工时`127.0.0.1:38891`无人监听、无本插件服务。所有产物与脚本只写本机`outputs/wps-phase1-F4/`（Git忽略），不打开、不关闭用户工作簿。

对应计划[F4](superpowers/plans/2026-10-11-wps-phase1-completion.md)，开工前已完整读`handoff.md`、计划“全局约束/优先检查的五类问题/F4”三节，并分两批实际打开8张批准效果图（03/04/05A/06 与 05B/07，另01/02）。C05沿用既有证据，本轮不重放、不倒填历史click。

## 一、C06 工程量与项目名称各一个新操作

脚本`scripts/prepare-f4.cjs`（产品模型生成成果表）+`scripts/f4-com.ps1`（隔离COM实例写入）+`scripts/drive-f4-c06.ps1`+`scripts/c06-eval.cjs`（产品`classification-review-host`/`model`求值）。真机读写/选区在隔离COM实例；产品逻辑在Node用同一`readSheet/validateRead/draft/locate`口径求值。

隔离实例入口工作簿数=**0**（`workbooksAtStart=0`、`workbooksAtEnd=0`），全程只操作本包自有成果表。报告`out/c06-drive-report.json`：**32/32通过**。

| 操作 | 只改单格 | 拒绝 | 定位 | 恢复 | 项目/学习/文件 |
| --- | --- | --- | --- | --- | --- |
| C06工程量 | E4 `2`→`999`（未保存） | 整表主按钮读回未通过，报`field-changed`并含“工程量：原2现999” | 真实选区`$E$4`，截图名称框`E4`、公式栏`999` | E4写回`2`，读回`field-changed`归零 | 未保存，磁盘SHA前后逐位一致 |
| C06项目名称 | B4 `水泵`→`水泵_C06错误`（未保存） | 整表主按钮读回未通过，报`field-changed`并含“项目名称：原水泵现水泵_C06错误” | 真实选区`$B$4`，截图名称框`B4`、公式栏`水泵_C06错误` | B4写回`水泵`，读回`field-changed`归零 | 未保存，磁盘SHA前后逐位一致 |

- 拒绝证据落到**唯一主按钮口径**：读回结果先`host.readSheet`（含`field-changed`）再`model.validateRead`（整表主按钮）；`field-changed`在模型`BLOCKING_ISSUES`内，因此它同时挡住整表确认与“保存审核成果”草稿（`draft.ok===false`）——即五类问题表“审核结构边界”在本轮的行为。
- 真机截图（真实WPS窗口，隔离实例）：`out/c06-c06-quantity-rejected-located.png`、`out/c06-c06-name-rejected-located.png`。
- 项目/学习/文件未变的证据：本段**未保存**成果表，磁盘SHA `ae3e5e9631a79a63…`开合前后逐位一致（未产生新文件）；未执行整表确认，故不产生学习、不写分类工作簿。夹具自带1行“充电桩配电箱”分类冲突是图02/03固定样例，作为基线常量，不当作本轮引入。
- 点击者：真机读写与选区由root工具在隔离COM实例执行；**页内主按钮/定位点击未由工具完成**（工具不可点浮窗页内控件），与既有C05/C06人工事件并列，不互相倒填。

## 二、已有完整下游的失效传播（对照排序/格式变化）

`wps-addin/test/workflow-v3.test.cjs`与`project.test.cjs`（本轮全量**472/472**通过）覆盖阶段失效与业务键；本轮按要求补对照并逐条核真实文件：

| 变更 | 应失效阶段（按`project.sync`/`invalidateStage`） | 旧成果 | 新批次/阻止旧拆分 | 对照 |
| --- | --- | --- | --- | --- |
| 改最终分类（审核确认变化） | `review`起：review missing、categories/brands/inquiry/split stale | 旧成果表/分类簿/汇总/询价/拆分件保留不覆盖 | 新分类批次另目录；旧询价生成键不同，拆分被拒 | — |
| 改品牌（汇总表内） | `brands`起：inquiry/split stale，brands本身仍ready | 旧汇总/询价/拆分件保留 | 旧生成过期，需重新生成 | — |
| 改供应商 | 同品牌（业务键含供应商） | 同上 | 同上 | — |
| 改生成方式（合成/按品牌） | `brands`起 | 同上 | 同上 | — |
| 改抬头 | `header`起：仅inquiry/split stale | 旧件保留 | 需重新生成 | — |
| 仅排序 | `import..split`保持ready | 不变 | 不阻止 | 业务键按稳定ID规范化，排序不改内容键 |
| 仅格式/另存 | 保持ready，物理SHA可刷新 | 不变 | 不阻止 | 见F2：写回成功才算刷新 |

- 真实文件证据：`out/split-receipt/`两个批次（`p-f4-split-0001__b-f4-split-0001.json` revision3、`p-f4-split-0002__b-f4-split-0002.json` revision4）逐件回执落到磁盘；`out/split-receipt/询价输出/`与`询价输出-未记账/`的实际xlsx存在且SHA登记；旧批次文件在后续操作后逐位不变。真实汇总/分类件沿用F3产物（`outputs/wps-phase1-F3/out/示例园区_f3/`）。

## 三、最终窗口新批次逐件回执恢复

脚本`scripts/split-receipt-driver.cjs`：用**真实本机服务**（`dev/server.cjs`，隔离目录、端口38891/38892/38893）以真实文件SHA走prepare/load/save，并真实重启服务实例（`server.close`→重建，非仅内存对象）。报告`out/f4-split-receipt-report.json`：**15/15通过**。

1. **逐件落盘**：prepare返回可发布计划与逐件`pending`；第1份发布成功按产品`split-state.mark`记`succeeded`并带实际SHA、第2份记`failed`，`save`按`expectedRevision`原子写回，revision=3。
2. **服务重开后成功件跳过**：真实重启服务实例后同项目/批次读回同一回执——`succeeded`件按实际SHA跳过且SHA与磁盘逐位一致；未完成件保留为可续作（`failed`不升级为成功，`done=false`）。
3. **第二份失败仅重试未完成**：写第2份并`mark succeeded`+SHA核对后记账成功；用**旧版本号**写回被拒`409`，不覆盖已记账回执。
4. **发布未记账始终待核对**：目标文件已落盘但回执仍`pending`时，连续3次prepare都保持`needs-verification`、`sha256=null`而`observedSha256=实际`、`done=false`；再次重开服务后仍待核对；只有**显式内容证明**（`proof=content-check`，观察SHA与内容核对一致）后才`mark succeeded`。
5. **外部改写再次降级**：已成功件被外部改写后再次prepare，状态回到`needs-verification`且`canPublish=false`，不覆盖。

## 四、保存/目录对话框确定与取消、多项目、读取归属、未保存保护

脚本`scripts/f4-ui-multi-project.cjs`（真实产品页面 `/taskpane.html`＋真实本机服务；宿主为模拟WPS，沿用既有`ui-*`口径）。报告`out/f4-ui-multi-project-report.json`：**17/17通过**。

1. **保存/目录对话框（内置选择器，不创建原生窗口）**：选目录-确定回调返回所选目录且选择器关闭；另存-确定回调返回目录/文件名/目标；选目录-取消、另存-右上角×、选择文件-取消都只回调取消、不返回目标；全程系统原生`GetOpenFilename`/`GetSaveAsFilename`调用**0/0**。产物不新建、不改名、不覆盖。
2. **多项目并行打开与切换核焦点**：保存项目A（1份来源）后重开侧栏保存项目B（另1份来源），项目列表列出两个项目；打开A→B→A时状态只显示当前项目编号、不串另一项目；来源条目始终等于该项目来源数。
3. **项目隔离**：直接读磁盘项目记录——A只含“给排水清单.xlsx”、B只含“机电清单.xlsx”，互不引用；切换A→B→A后A记录版本不变（未被他项目覆盖）。
4. **读取归属**：活动簿换成B清单时读到B、换回A清单时读到A，`#workbook-name`不沿用旧归属。
5. **未保存内容保护**：产生未保存核对（“有修改未保存”）后重新读取，必须先经确认；**拒绝则原样保留**（消息不变），确认后才重新读取并刷新画面。
- 点击者：本轮**页内动作由root工具在真实页面执行**（非浮窗内人工点按）。编辑器/对话框全在页面内DOM，未绕过工具限制；真实浮窗内点击者仍按既有真人事件另记。

## 五、受影响旧 J 场景复验与稳定性

本轮只复验**本轮变更影响到的**旧 J 场景（F1审核表结构/隐藏页、F2恢复与物理SHA、F3汇总自动打开）：

- `ui-sheet-review-check`、`ui-brand-check`、`ui-inquiry-check`、`ui-split-check`、`ui-project-restore-check`、`ui-cancel-check`：**6/6通过**（日志`logs/f4-ui-*.log`）。其中`ui-split-check`覆盖R12-E“待核对文件重复刷新/重启不自动成功、同名异内容不覆盖、显式逐值核对通过后才按实际SHA记成功”；`ui-project-restore-check`覆盖整目录搬移后逐项核内容并保存新绑定；`ui-cancel-check`覆盖取消/关闭只回调取消、不推进阶段、无半成品。
- 全量Node `node --test wps-addin/test/<每个*.test.cjs>`：**472/472**通过（Node v24.19.0），含`workflow-v3`/`project`/`split-server`/`split-store`/`brand-model`/`inquiry-model`等。
- 稳定性：SIDEBAR-STABILITY-01已按有界口径关闭（两段两小时/约7小时公共指标＋两段终点可见导航），本轮**不无理由重跑已封存长测**，也不重开`ui-render-stall-check`长测。

## 六、真实产物逐值与版式审计（R12-F完整预期清单）

`scripts/build-manifest.cjs`由产品工作簿模型生成`complete:true`预期清单（不手填期望值）；`dev/audit-outputs.py`（Python/openpyxl，只读）逐值与版式核对，日志在`logs/f4-audit-*.json`。

| 产物 | 结论 | 逐值 | 版式 | 备注 |
| --- | --- | --- | --- | --- |
| `out/示例园区_F4分类审核成果.xlsx`（真机COM写入） | `valueChecked=true` | mismatch/type/layout/extra/missing 全 **0** | 0 | `hiddenSheets=2`（内部选项/内部绑定，F1按图03隐藏）、`paths=8`（K列随行rowId/来源，内部绑定，公开列不含）——均为内部表设计 |
| `outputs/wps-phase1-F3/out/示例园区_f3/分类汇总表.xlsx` | `valueChecked=true` | mismatch/type/layout/missing 全 **0** | 0 | `extraCells=16`为隐藏辅助列K/L/M（稳定类别ID/相对链接/方式选项），`hyperlinkCells=4`为4条名称链接；均非公开列 |

供应商件（对外）本轮无新建，沿用10-10真实五件并已由既有F审计证明`formulas=0`、无内部/隐藏追溯、无原价/历史价；F4不重导。字段空值（品牌/报价/金额）与版式已在F3与既有证据内核对，本轮不重复造样本冒充通过。

## 七、边界与未覆盖

- 真机部分为**隔离隐藏COM实例**＋真实本机服务按产品写入/读回顺序复刻，**不是插件浮窗内点按**；浮窗页内控件工具不可点，相关真人工项（默认窗口遮挡结论、真实浮窗可达宽度/缩放）仍需真人点一次核对。
- 多项目/对话框/读取归属/未保存保护的页面级证据为真实产品页面＋模拟WPS宿主；真实WPS宿主下的等价行为以既有C00–C13真人事件及`ui-*`为准，两者不互相替代。
- 供应商件F审计沿用既有25文件证据；本轮未生成新供应商件，不以桩文件当供应商件通过。
- R12仍未结案、四项目新流程0/4、R13未执行，一期未正式交付。

## 八、复现命令

~~~text
node outputs/wps-phase1-F4/scripts/prepare-f4.cjs
pwsh -NoProfile -ExecutionPolicy Bypass -File outputs/wps-phase1-F4/scripts/f4-com.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File outputs/wps-phase1-F4/scripts/drive-f4-c06.ps1
node outputs/wps-phase1-F4/scripts/split-receipt-driver.cjs
$env:NODE_PATH='<codex runtime node_modules>'; node outputs/wps-phase1-F4/scripts/f4-ui-multi-project.cjs
node outputs/wps-phase1-F4/scripts/build-manifest.cjs
python wps-addin/dev/audit-outputs.py --profile internal-total --manifest outputs/wps-phase1-F4/out/f4-review-manifest.json "outputs/wps-phase1-F4/out/示例园区_F4分类审核成果.xlsx"
~~~
