# F1–F8 逐包新会话提示词（2026-10-11）

用法：**一次只开一个会话，整段复制对应代码块粘贴进去**。每包完成后停下报告并备份，再由用户开下一个会话；提示词自带开工前阅读清单、包内范围与收尾要求，不需要额外交代。

每块提示词都是自包含的：仓库/分支、本包 Files/Interfaces/步骤、硬约束、真机与环境口径、收尾（证据、交接、明确清单暂存、提交推送核远程SHA）都在里面。开工时以 `git log -1`、`handoff.md` 实际内容为准，不盲用提示词里写的 HEAD 或旧PID。

状态：F1 已完成（2026-10-11，`e85d967`＋`4b2e8dd`）；F2–F8 待做。包序与出口以[完成计划](2026-10-11-wps-phase1-completion.md)为准，禁止跳包。

## F1（已完成，保留供复核或重跑）

对应图02/03；对应差额 D01、D05。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F1 审核表结构与显示边界，不跳包。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F1”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③实际打开 docs/mockups/approved-20260926/02-classification-result.png 与 03-sheet-review.png（不要只看文件名或历史摘要）；④核 git status/HEAD、WPS 进程与端口 38891 实际状态，不盲用历史 PID。
范围：末行之后追加/整行复制的材料行必须拒绝并定位；内部选项/内部绑定页隐藏；数据行高实测（不写死历史观察值84）。Files：wps-addin/src/classification-review-host.js、classification-review-model.js，按需 export-host.js/workbook-layout.js；测试 classification-review-host.test.cjs、classification-review-model.test.cjs、export-host.test.cjs、workbook-layout.test.cjs。
硬约束：保留 readBack/rows/issues/source 语义；额外材料行走既有问题定位，不得在失败前确认/学习/写分类文件；只在成果表内整表一次确认，品牌供应商只从汇总表读回；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存；原始资料/配置/运行数据/私有证据不入 Git。
真机与环境：WPS 12.1.0.29161；KET.Application COM 可用（独立隐藏实例可复刻写入并读回）；浮窗页内控件工具不可点，需要点击的项由真人完成并记录点击者；若本机 require('playwright') 失败，ui-* 浏览器检查如实记录未运行、不得写成通过。
收尾：跑上述四文件 Node 与全量 node --test wps-addin/test/*.test.cjs，留实际输出→写 docs/wps-phase1-f1-evidence-<开工日>.md→更新 docs/wps-workflow-v3-acceptance.md、docs/wps-phase1-release-checklist.md、handoff.md→按明确清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推。
完成后停下：报告出口、证据、提交SHA与未覆盖边界，等用户开下一个会话，不自动进入 F2。
```

## F2 恢复状态一致性

对应图03；对应差额 D02、D03；依赖 F1。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F2 恢复状态一致性，不跳包、不提前做 F3–F8。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F2”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③实际打开 docs/mockups/approved-20260926/03-sheet-review.png；④核 git status/HEAD、WPS 进程与端口 38891 实际状态，不盲用历史 PID；⑤读已完成包证据 docs/wps-phase1-f1-evidence-20261011.md，不要重做 F1（末行外材料行拒绝与内部页隐藏已完成）。
范围：物理刷新 save 返回 409 或写失败时内存 SHA/版本必须回滚、内容保留且有可见重试提示，成功时版本与 SHA 同步更新；直接进入第3步时，现表等于有效确认但不等于旧草稿不得报草稿差异，现表不同于确认必须明确差异并阻止生成，仅草稿项目仍可恢复；差异存在时不残留“可以生成”，从已确认快照恢复只更新绑定时不要求重复确认/学习，保留真实需要重新确认的分支。
Files：wps-addin/src/project-ui.js、import-ui.js；测试 wps-addin/test/project-ui-review-content.test.cjs、import-ui-review-restore.test.cjs、ui-sheet-review-check.cjs、ui-project-restore-check.cjs。
Interfaces：保留项目 save 的 expectedRevision、审核确认/草稿快照结构与 compareSnapshot；仅物理刷新未成功不得改变持久绑定语义；有效确认是当前已确认状态的依据，旧草稿不覆盖它。
硬约束：保存草稿不确认、不学习；已确认内容变化先可靠保存再更新学习；按项目/行/决定版本隔离来源；保留原件与用户未保存内容；不恢复侧栏逐行审核或品牌二次确认；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存；原始资料/配置/运行数据/私有证据不入 Git。
真机与环境：WPS 12.1.0.29161；KET.Application COM 可用（独立隐藏实例可复刻写入并读回）；浮窗页内控件工具不可点，必要点击由真人完成并记录点击者；若本机 require('playwright') 失败，两个 ui-* 浏览器检查如实记录未运行、不得写成通过（宿主是模拟宿主这一口径要写清）。
收尾：跑上述两个 Node 测试与两个浏览器检查（或记录未运行原因）→再真实保存失败/重开/恢复到新副本，核对确认版本、学习来源与旧文件未变→写 docs/wps-phase1-f2-evidence-<开工日>.md→更新验收文档、发布清单、handoff.md（当前进度/待定/下一步、7.2备份记录、7.3证据索引）→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推→本机证据放 outputs/ 新目录，不入 Git。
完成后停下：报告出口（磁盘/内存/页面状态一致、失败不假成功、确认与草稿取舍在打开项目与独立第3步一致）、证据、提交SHA与未覆盖边界，等用户开 F3 会话。
```

## F3 汇总自动打开与窗口可用性

对应图01/03/04/05A/05B；对应差额 D04、D06；依赖 F2。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F3 汇总打开与窗口可用性，不跳包、不提前做 F4–F8。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F3”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③实际打开 docs/mockups/approved-20260926/ 下的 01-import-merge.png、03-sheet-review.png、04-category-workbooks.png、05a-summary-separated.png、05b-summary-combined.png（如与图02/06/07一并核对需全8图时，分两批打开，不要在同一会话里反复打开全部8图）；④核 git status/HEAD、WPS 进程与端口 38891 实际状态，不盲用历史 PID。
范围：分列/同格两种汇总生成成功且发布校验与项目绑定保存完成后，各自动打开一次最终文件；生成或保存失败不自动打开；仅打开失败时提示“已生成、未打开”并保留成果与手动打开入口，不重新发布、不虚报“未生成”。窗口可用性：核本版宿主支持的窗口位置/尺寸能力，确定不遮关键入口的可复现布局（不擅自回到 TaskPane、不采用被用户拒绝的65秒等待）；浏览器精确 CSS320 核七阶段主按钮换行与滚动，真实窗口测可达宽度与缩放，不把外框320当CSS320；逐项核 ready/missing/stale 可见提示且业务前置条件不被导航绕过。
Files：wps-addin/src/import-ui.js，按需 brand-host.js、ribbon-navigation.js、styles.css；测试 wps-addin/test/ui-brand-check.cjs、brand-host.test.cjs、webdialog-lifecycle.test.cjs、ui-workflow-check.cjs。
Interfaces：复用 RfqBrandHost.openSummary(application,path)；只有发布校验与项目绑定保存完成后打开实际成果；窗口沿用 CreateWebDialog/GetWebDialog 单实例契约；打开失败保留成功文件与手动入口。
硬约束：不覆盖用户已有文件，新成果另批次；保留已验单实例及关闭/重建行为；表内整表确认与汇总表内填品牌供应商的口径不变；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存；原始资料/配置/运行数据/私有证据不入 Git。
真机与环境：WPS 12.1.0.29161；KET.Application COM 可用；浮窗页内控件工具不可点，需真人点击的项由真人完成并记录点击者；若本机 require('playwright') 失败，ui-* 浏览器检查如实记录未运行、不得写成通过。
收尾：跑 ui-brand-check.cjs、brand-host.test.cjs 及窗口生命周期/导航测试，实机分别核最终路径、名称链接、编辑焦点与填写后读回→按实际截图对图01/03/04/05A/05B→写 docs/wps-phase1-f3-evidence-<开工日>.md→更新验收文档、发布清单、handoff.md→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推→本机证据放 outputs/ 新目录，不入 Git。
完成后停下：报告出口（生成后能直接表内填写、重要入口可达、窄宽与三态证据明确、已验单实例与关闭/重建行为保留）、证据、提交SHA与未覆盖边界（例如默认窗口遮挡的实际结论），等用户开 F4 会话。
```

## F4 最终窗口业务与恢复补验

对应图03–07；对应差额 D07、D08、D09、D06 剩余项；依赖 F1–F3。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F4 最终窗口业务与恢复补验，不跳包、不提前做 F5–F8。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F4”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③实际打开 docs/mockups/approved-20260926/ 的 03-sheet-review.png、04-category-workbooks.png、05a-summary-separated.png、05b-summary-combined.png、06-inquiry-linkage.png、07-split-files.png（确需全8图时分两批）；④核 git status/HEAD、WPS 进程与端口 38891 实际状态；⑤沿用已授权隔离副本与自有测试数据，不打开或关闭用户未保存的工作簿。
范围与出口：①C06 工程量与名称各建一个新操作——只临时改自有单格→真实主按钮→拒绝→定位→恢复原值，核项目/学习/文件未变（C05 已有证据沿用，不倒填历史 click）。②对已有完整下游的项目分别改分类、品牌、供应商、方式与抬头，核应失效阶段、旧成果保留、新批次与阻止旧拆分；排序/格式变化作对照，不应业务失效。③对最终窗口新批次记录逐件回执落盘，服务/项目重开后成功件跳过；第二份失败仅重试未完成；发布未记账始终待核对，显式内容证明后才成功；外部改写再次降级。④保存/目录对话框确定与取消、多项目并行打开与切换核焦点、读取归属、项目隔离与未保存内容保护；工具权限内的页内动作由真人完成并记录点击者，不绕过限制。⑤只复验本轮变更影响的旧 J 场景；稳定性使用最终版真实操作与必要时的有界时长，不无理由重跑已封存长测；失败项建清晰缺陷与复验出口。
Files：主要更新 docs/wps-workflow-v3-acceptance.md、docs/wps-phase1-release-checklist.md，独立证据留本机新目录；发现缺陷再改对应 host/project/split 模块及其既有测试，禁止用报告代替修复。
Interfaces：使用 F1–F3 版本与现有项目/确认/summary/inquiry/split 回执结构；拆分已有 prepare/load/save、needs-verification 与 verifiedBy，不另造持久层。
硬约束：保留原件与用户未保存内容；新成果另批次不覆盖；只关闭插件自开簿；供应商件无内部/隐藏追溯、路径、原价、历史价与公式；临时改动只限自有副本且必须恢复原值；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存；原始资料/配置/运行数据/私有证据不入 Git。
真机与环境：WPS 12.1.0.29161；KET.Application COM 可用（独立隐藏实例可复刻写入并读回）；页内控件工具不可点，必须由真人完成并记录点击者；若本机 require('playwright') 失败，相关 ui-* 检查如实记录未运行、不得写成通过。
收尾：相应 Node/浏览器检查通过、真实产物逐值与版式用 R12-F 完整预期清单（Node 与 Python）审计通过→写 docs/wps-phase1-f4-evidence-<开工日>.md→更新验收文档、发布清单、handoff.md→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推→本机证据放 outputs/ 新目录，不入 Git。
完成后停下：报告“C06、完整下游 stale、最终窗口回执恢复、保存对话框与多项目场景均有对应真实证据”（不能用 missing 或仅文件 SHA 代替），证据、提交SHA与未覆盖边界，等用户开 F5 会话。
```

## F5 四项目逐个验收

对应全部8图；依赖 F4 与业务决定齐备。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F5 四项目逐个验收，不跳包、不提前做 F6–F8。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F5”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③按工作包“对应图”实际打开 8 张批准图，分两批打开、不要反复打开；④核 git status/HEAD、WPS 进程与端口 38891 实际状态；⑤只处理已授权资料的副本，原件、人工行级差异、联系人与运行数据留本机。
顺序：先项目1（263行），再项目3（1473行）、项目4（2708行）、项目2（3143行）；每项目导入→合并选择→人工表内审核→整表确认→分类工作簿→汇总→总询价→拆分逐步留证，每项目完成即单独封存验收结果与备份，四项目皆通过才算完成。
前置复核：8原件/副本 SHA 与现存填写簿；明确 3626 待核行的来源、数量、重复容量与跨类别决定；核项目1编码前导零；业务未决定项标待处理，不填造默认值。
需要在隔离验收库明确并由业务确认：必要类别与映射、合并选择、最终分类/无需询价、品牌供应商与生成方式、四项抬头；历史32类批量迁入政策单独登记，不自动写生产库；不得把旧人工页或四字段候选直接当新流程确认，旧33表/7587行统计不能代替本步骤。
逐项目核：来源行数/数量、各询价对象材料、类别/无需询价/文件数与两种汇总布局（至少各在一个项目采用）；供应商件用 Node 与 Python 独立 F 审计——公式0、原价与内部追溯0、允许抬头联系人只在明确位置。
Files：更新验收文档、发布清单；已授权原件/安全副本/填写簿/逐行差异/成果在本机 outputs/，不入 Git；必要源码修复归入所属模块测试后再续本项目。
硬约束：只在成果表内整表一次确认，品牌供应商只从汇总表读回；保留原件与用户未保存内容；新成果另批次不覆盖；只关闭插件自开簿；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存。
真机与环境：WPS 12.1.0.29161；KET.Application COM 可用；页内控件工具不可点，必须由真人完成并记录点击者；若本机 require('playwright') 失败，相关 ui-* 检查如实记录未运行、不得写成通过。
收尾：每项目完成即写/追加 docs/wps-phase1-f5-evidence-<开工日>.md 与独立证据目录→更新验收文档、发布清单、handoff.md→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推。
完成后停下：报告 4/4 完成、业务决定可追溯、公开输出逐值通过；未确定供应商或类别不得冒称项目通过；报告证据、提交SHA与未覆盖边界，等用户开 F6 会话。
```

## F6 R12 结案

对应全部8图；依赖 F1–F5。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F6 R12 结案，不跳包、不提前做 F7–F8。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F6”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③按工作包“对应图”实际打开 8 张批准图（分两批）；④核 git status/HEAD 与当前代码版本，结案必须用最终代码。
范围：按8图逐项核主操作、编辑位置、列/布局、链接与文件组织；承载窗口按10-10批准变更单列，区分效果图、模拟、隔离宿主与真人操作。在最终代码运行 node --test wps-addin/test/*.test.cjs、六个主流程 ui-workflow/ui-sheet-review/ui-brand/ui-inquiry/ui-split/ui-project-check.cjs 及受影响恢复/启动检查；Python 审计运行 python -m unittest discover -s wps-addin/test -p "test_*.py"，以实际发现/执行数留证（不得用历史结果冒充本次重跑）。对照 D01–D12 确认 F1–F5 范围无未修关键项、四项目 4/4；独立审查差额与证据一致性，修正文档冲突。
Files：更新 docs/wps-workflow-v3-acceptance.md、docs/wps-phase1-release-checklist.md、handoff.md；补充脱敏证据索引。
Interfaces：汇总 F1–F5 与既有 G/H/I/J/稳定性实证；每个结论带代码版本、样本、点击者、文件核对与未覆盖边界。
硬约束：没有证据不勾通过；模拟宿主、原生COM读回与文件只读审计不得写成插件窗口内真机；只关闭插件自开簿；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存；原始资料/配置/运行数据/私有证据不入 Git。
真机与环境：WPS 12.1.0.29161；KET.Application COM 可用；页内控件工具不可点，需真人点击的项如实记录；若本机 require('playwright') 失败，浏览器类检查如实记录未运行并说明原因，不得写成通过。
收尾：写 docs/wps-phase1-f6-evidence-<开工日>.md（或合入验收文档的 F6 小节）→更新三个状态文档与证据索引→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推。
完成后停下：只勾 R12 结案并说明依据与未覆盖项；F7/F8 保持未完成，等用户开 F7 会话。
```

## F7 安装脚本收敛与真实生命周期

对应 R13-A；沿用最终真实截图；依赖 F6。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F7 安装脚本收敛与真实生命周期，不跳包、不提前做 F8。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“优先检查的五类问题”“F7”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③核 git status/HEAD 与当前安装/服务脚本实际内容；④先确认 F6 已勾 R12 结案，未结案不得抢跑 R13。
范围：补隔离失败测试——PID 复用/命令行不可读/其他 server.cjs 不停止；复制失败与启动失败还原本插件注册/代码且保留其他插件；自定义 DataRoot 五目录一致；升级存在旧健康服务时实际加载新代码。红后最小实现：删除/移动前校验绝对目标仍在明确 AppDir/备份范围内；启动后台始终隐藏；数据不删除；未知身份拒绝停止并说明原因。DataRoot 明确传为 imports/library/projects/headers/splits 五子目录；服务身份至少核绝对脚本路径、创建时间与实际运行代码版本，PID 文件不单独构成停止依据。
Files：改 wps-addin/install/install.ps1、start.ps1、uninstall.ps1，按需 dev/server.cjs；测试 wps-addin/test/install.test.cjs、release-audit.test.cjs 及必要服务测试；更新 docs/wps-install-guide.md。
硬约束：不动用户数据与未保存内容；不得仅用 SkipService/SkipStopService 测试冒充生命周期覆盖，明确记录真实失败注入与回退结果；不停止未知或身份不符的进程；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存；原始资料/配置/运行数据/私有证据不入 Git。
真机与环境：WPS 12.1.0.29161；隔离环境执行安装→重启→开项目→升级→失败回退→卸载→重装恢复；核项目/库/模板与其他插件保留、新旧代码生效、数据目录正确；支持版本只列实测（另一WPS版本无环境则明确排除）。
收尾：写 docs/wps-phase1-f7-evidence-<开工日>.md→更新安装说明、验收文档、发布清单、handoff.md→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推→本机安装证据与日志不入 Git。
完成后停下：报告出口（安装可复现、失败一致回退、不误停进程、数据可恢复、升级确实运行新版）、证据、提交SHA与未覆盖边界，等用户开 F8 会话。
```

## F8 用户实操与交付准备

对应 R13-B；全部8图及真实截图；依赖 F7。

```
仓库 F:\材料软件开发，分支 feat/wps-phase1。本会话只做 F8 用户实操与交付准备，不跳包。
开工前必须：①完整读 handoff.md；②读 docs/superpowers/plans/2026-10-11-wps-phase1-completion.md 的“全局约束”“F8”三节，并按 REQUIRED SUB-SKILL 用 superpowers:executing-plans 逐项勾选；③按工作包“对应图”实际打开 8 张批准图与最终真实截图（分两批）；④核 git status/HEAD、F6 结案与 F7 安装器状态。
范围：①用真实最终窗口截图更新七步说明，解释整表确认、双布局三组、名称链接、两种生成方式、改品牌重生、失败续作、关闭/重建与恢复。②至少一名实际用户按说明独立完成合成项目，记录停顿/歧义并修正文档或产品；产品修复返回相应测试与受影响验收。③扫候选包：资源齐全且不含探针/故障入口/样本/凭据/私有数据；记录版本、文件清单、SHA、实测WPS版本与明确限制。④核定历史32类迁入与其他WPS版本本次范围，未验证部分明确排除，不扩大支持声明。
Files：更新 docs/wps-user-guide.md、wps-install-guide.md、wps-phase1-release-checklist.md、handoff.md 及发布资源清单；候选包与 SHA 依现有发布约定保存。
Interfaces：使用 F6 验收通过代码＋F7 安装器；候选版本、资源白名单、安装步骤与真实截图保持一致。
硬约束：不把探针/故障入口/样本/凭据/私有数据打进候选包；不在候选包内保留诊断脚本；main 合并或正式发布按用户明确安排执行，本包不自动触发；入场未提交改动 wps-addin/dev/pane-diagnostics.js 原样保留、不暂存。
真机与环境：WPS 12.1.0.29161；真人按说明操作，记录点击者与停顿；若本机 require('playwright') 失败，相关检查如实记录未运行。
收尾：写 docs/wps-phase1-f8-evidence-<开工日>.md 与交付候选清单（版本/文件/SHA/实测版本/限制）→更新用户说明、安装说明、发布清单、handoff.md→按明确文件清单逐一暂存并审查 git diff --cached（禁止 git add . / -A）→提交→git push origin feat/wps-phase1→git ls-remote 与本地 HEAD 逐位核对；失败保留本地提交、如实说明、不强推→私有证据与原始资料不入 Git。
完成后停下：报告出口（用户能依说明完成、安装包/文档/验收一致、备份可追溯、发布状态真实）与最终未覆盖边界；一期交付候选交由用户决定发布流程。
```
