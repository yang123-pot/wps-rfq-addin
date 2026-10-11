# F2 恢复状态一致性证据（2026-10-11）

本包按[完成计划F2](superpowers/plans/2026-10-11-wps-phase1-completion.md)执行，对应图03与整体核对差额**D02、D03**。
范围只有三件事：物理SHA刷新写回失败时不得改变持久绑定语义；打开项目后直接进入第3步时确认与旧草稿的取舍与项目重开一致；
差异未解决前不得残留“可以生成”，从已确认快照恢复只切绑定、不要求重复确认也不重复学习。
本包没有改动分类建议、整表确认口径、分类工作簿/汇总/询价/拆分的业务规则，也没有恢复任何侧栏逐行审核或品牌二次确认流程。

## 1. 结论

1. **物理校验只有写回成功才算刷新。** 以前打开项目时若发现“业务内容与已确认一致、仅另存/格式/排序改变物理SHA”，代码会先把新SHA写进内存绑定再尝试保存；保存失败（409或写错误）被空`catch`吞掉，内存里留下的是没有落盘的新SHA。现在写回失败会把内存SHA与版本一起回滚，项目内容原样保留，并在侧栏给出可见重试提示；成功时版本号与SHA同步递增、只写一次项目记录，确认快照不被改动。
2. **有效确认是第3步差异判定的唯一依据（D03）。** `detectReviewDivergence`原先是“先比确认，比完不管结果都再比草稿”，于是“现表等于有效确认、只有旧草稿不同”时会把草稿差异报给用户，并给出“恢复项目草稿到新副本”，等于用旧草稿覆盖已确认结果的误导。现在有效确认一致即直接判定无差异；只有还没有有效确认（仅草稿）的项目才用草稿判定，草稿项目仍然可以选“选用现表内容”或“恢复项目草稿到新副本”。
3. **差异存在时不残留“可以生成”，并按旧确认阻止生成。** 第3步在差异状态下把进度文案改成“先解决差异才能生成分类工作簿”；分类工作簿生成入口在动手前会按现表读回一次，现表与有效确认不一致时直接拒绝并说明差异处数与示例，不会拿旧确认当依据写出分类工作簿。
4. **从已确认快照恢复只更新绑定（D03后半）。** 恢复副本仍然只写新副本、不覆盖当前成果表；当快照就是有效的整表确认时，侧栏明确说明“内容与项目已确认的一致，仅把成果表绑定切到新副本，无需重复确认、也不会重复学习”，不再泛化要求用户重新整表确认。

## 2. 改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/project-ui.js` | `openProject`物理刷新分支：写回前记录被替换的SHA；保存失败（409/写错误）时把内存SHA回滚并记录`physicalRefreshFailed`，版本号不递增；成功时才同步`revision`。提示文案区分“物理校验已更新”与“物理校验未写回项目记录（原因）…已保存的物理校验与内容原样保留，请重试（重新打开项目或保存项目）”，并按错误样式显示。 |
| `wps-addin/src/import-ui.js` | ①`detectReviewDivergence`：有效确认（`inputKey`匹配）一致时直接`return null`，不再落到草稿比较；草稿判定只服务于“还没有有效确认”的项目（旧草稿不覆盖已确认结果）。②`renderSheetReview`：确认类差异把进度文案改为“先按现表重新整表确认，或恢复项目保存内容到新副本，才能生成分类工作簿”；草稿类差异改为“与项目保存的审核草稿不一致（N 处），尚未整表确认”——两处都不再残留“可以生成”。③`generateCategoryWorkbooks`：进入生成前先按现表读回并与有效确认比较，不一致时拒绝生成并报出差异数+示例，提示先重新整表确认或恢复项目保存内容。④恢复副本：快照确为有效确认时提示“仅切绑定、无需重复确认、不重复学习”。 |
| `wps-addin/test/project-ui-review-content.test.cjs` | 新增3项：物理刷新写回409、写错误时内存SHA与版本回滚/内容保留/可见重试提示；成功时版本与SHA同步递增、只写一次、确认快照随写回保留。 |
| `wps-addin/test/import-ui-review-restore.test.cjs` | 夹具支持按id点击真实按钮、捕获阶段切换回调与导出暂存/发布接口；新增4项：直接进入第3步时“现表=有效确认但旧草稿不同”不报草稿差异且仍可生成；“现表≠确认”明确差异、不残留可以生成并阻止按旧确认生成；仅草稿项目仍报差异并保留恢复入口、不确认不学习；从已确认快照恢复只切绑定、不重复确认不重复学习不覆盖当前成果表。 |
| `wps-addin/test/ui-sheet-review-check.cjs` | 真实浏览器（Chromium/Edge + 真实本机服务 + 模拟WPS宿主）新增F2段落：确认一致时进度含“可以生成”；表内把送风机改成“强电”后回到第3步，横幅为“成果表内容与已保存确认不一致”、进度不再含“可以生成”、两个恢复入口都可见；此时点“生成分类工作簿”得到“分类工作簿未生成…有 N 处不一致…重新整表确认”且不写任何文件；随后复原表内值继续原有用例。 |

## 3. 软件验证

- 本包两个Node测试：`node --test wps-addin/test/project-ui-review-content.test.cjs wps-addin/test/import-ui-review-restore.test.cjs` → **43/43通过**（7项＋36项，含本包新增7项，失败/跳过均0）。
- 全量：`node --test wps-addin/test/*.test.cjs` → **465/465通过**（Node v24.19.0；F1为458项，本包新增7项）。
- **浏览器检查本轮实跑通过**：计划要求的`ui-sheet-review-check.cjs`与`ui-project-restore-check.cjs`均**PASS**。F1记录“本机缺playwright”只对默认`require`解析成立——本轮用Codex运行时依赖目录（`NODE_PATH=<codex-primary-runtime>/dependencies/node/node_modules`，内含playwright与Edge通道）即可运行；该路径只用于本机执行，不写入产品。同一方式另跑受影响/主流程14项，**合计17项`ui-*`全通过**：`ui-sheet-review`、`ui-project-restore`、`ui-workflow`、`ui-category`、`ui-brand`、`ui-inquiry`、`ui-split`、`ui-cancel`、`ui-classification`、`ui-export`、`ui-import`、`ui-library`、`ui-memory`、`ui-project`、`ui-review`、`ui-startup-navigation`、`ui-pane-diagnostics`。`ui-render-stall-check.cjs`属稳定性长测，按“不重开长测”约束未运行。
- **先红后绿**：把工作区`src/import-ui.js`临时换成`HEAD`版本后，浏览器新增段落即在`/可以生成/.test(进度文案)`断言处失败（exit=1），改回本包版本后通过；实验后核对工作区文件字节与实验前完全相同（96063字节），未留下半成品。
- 阶段切换/差异判定仍走产品代码：`ui-sheet-review-check`用真实DOM、真实本机服务与模拟WPS宿主；`ui-project-restore-check`覆盖项目重开/搬移；两者都不替代真机点按。

## 4. 真机核对（WPS表格 12.1.0.29161）

真机部分用**独立隐藏COM实例**（`KET.Application`，未接入用户窗口）＋**真实本机服务**（产品`dev/server.cjs`，无诊断/探针，五个隔离目录在`outputs/wps-phase1-F2/ui-data`）执行；模型、比较器、确认快照、恢复副本模型、项目持久化全部走产品代码。

```powershell
node outputs/wps-phase1-F2/scripts/prepare-f2.cjs       # 用产品模型产出：现表、表内改动表、按确认快照重建的恢复副本
node outputs/wps-phase1-F2/service.cjs                  # 38891 本机服务（隔离五目录、无诊断注入）
pwsh outputs/wps-phase1-F2/scripts/f2-real-run.ps1      # 真实WPS写入/读回/仅改格式保存/写恢复副本/截图
node outputs/wps-phase1-F2/scripts/f2-check.cjs         # 真实网格交产品代码判定 + 真实服务409/成功/学习核对
```

**4.1 业务一致、仅物理SHA变化（D02成功路径）**

| 项目 | 实测 |
| --- | --- |
| 现表文件 | `out/示例园区_分类审核成果_F2.xlsx` |
| 物理SHA变化 | `ea990117…` → `7d043699…`（真实WPS“列宽+页脚后保存”） |
| 业务值 | 改动前后读回网格逐格相同，`host.readSheet`读回0问题，`compareSnapshot(现表,确认)`=`matches:true` → 允许刷新物理校验 |
| 恢复副本 | `…_F2恢复副本.xlsx` SHA `f706ea8e…`，`compareSnapshot`=`matches:true`，0差异 |

**4.2 现表不同于有效确认（D03差异与阻止生成）**

把“充电桩配电箱”的最终分类从已确认的“汽车充电桩”改成“强电”（`out/…_F2表内改动.xlsx`，SHA `96391664…`）：

- `compareSnapshot`恰好报1处`category-changed`：“充电桩配电箱”的“最终分类”不一致：确认快照“汽车充电桩”，现表“强电”；
- 第3步横幅/进度/恢复入口与非浏览器一致性已经在真实浏览器检查中用同一判定链验证；
- 按旧确认生成分类工作簿被拒绝（同一浏览器检查），本机真实文件侧没有产生任何新的分类工作簿。

**4.3 真实服务：写回失败不改变持久绑定、成功时版本与SHA同步递增**

| 步骤 | 结果 |
| --- | --- |
| 首次保存（`expectedRevision:0`） | 200，记录`revision=1`，`matching.sha256=ea990117…` |
| 用过期版本号保存“刷新后的SHA”（`expectedRevision:0`） | **409**（`项目版本冲突：已被其他窗口保存…`），项目文件字节不变，记录仍为`revision=1`、`sha256=ea990117…`，`review.confirmedAt`未变 |
| 用正确版本号保存刷新后的SHA（`expectedRevision:1`） | 200，`revision=2`，`matching.sha256=7d043699…`，确认快照`confirmedAt=2026-10-11T06:00:00.000Z`、8行未变 |
| 学习来源 | 服务请求日志 **0 次**`/api/library/save`；隔离库目录没有生成`library-state.json`，物理刷新与恢复副本都没有学习 |
| 旧文件保护 | 恢复副本写完后，现表与表内改动表的SHA都与写入时一致（未覆盖）；两内部页`Visible=0`、公开页`Visible=-1` |

**4.4 真机截图**：`out/f2-real-edited.png`（表内H11=强电、匹配情况“存在差异”）、`out/f2-real-restored.png`（恢复副本H11=汽车充电桩，来自已确认快照）。
本轮只用自建隐藏COM实例，脚本结束`Quit()`清理：开工时`wps/et`进程集合为 et 6756、wps 10324/16672/19092/20808/26864、wpscloudsvr 3556，核对结束时逐一致，未停任何用户进程、未新增遗留WPS进程。

**4.5 服务端口**：F2临时服务于本机14:43:05在127.0.0.1:38891启动、核对完成后按PID与命令行身份停止（`outputs/wps-phase1-F2/service.cjs`），端口回到开工时“无人监听”状态；不按历史PID操作。

## 5. 边界与未覆盖

- 真机的写入/读回/恢复副本落地是按产品`export-host.write`同一模型、同一顺序在真实WPS里复刻执行，**不是在插件浮窗内点按**（本机工具仍无法驱动浮窗页内控件，触点由真人完成，与R12-L以来口径一致，未绕过限制）。第3步的提示文案、按钮可见性、阻止生成与恢复副本提示由真实浏览器检查（真实DOM+真实服务+模拟宿主）与Node替身用例覆盖。
- “阻止生成”是**动作级拒绝**：分类工作簿入口按钮仍按“整表确认是否有效”启用，点击后按现表读回比对再拒绝；差异状态下侧栏不会再声称“可以生成”。差异提示依赖进入第3步（阶段切换/保存草稿/确认后）的读回，未做常驻轮询——这是刻意避免按渲染帧反复读表。
- 生成入口新增一次读回（每次点击一次），未做缓存；宿主读不到成果表时按既有读回失败处理，不放行也不误报差异。
- 未覆盖：保存/目录对话框、多项目并发、汇总表自动打开、窗口遮挡与窄宽属F3/F4；四项目属F5；R12结案属F6；`ui-render-stall-check`长测按约束未重开。
- 隔离服务的项目记录只用于本包409/成功两步骤核对，不是用户真实项目；未写入用户真实项目目录、分类库、模板或原始资料。

## 6. 证据文件（本机`outputs/wps-phase1-F2/`，不入Git）

`scripts/prepare-f2.cjs`、`scripts/f2-real-run.ps1`、`scripts/f2-check.cjs`、`service.cjs`；
`out/f2-models.json`、`out/f2-real-readback.json`、`out/f2-check.json`；
`out/示例园区_分类审核成果_F2.xlsx`、`out/示例园区_分类审核成果_F2表内改动.xlsx`、`out/示例园区_分类审核成果_F2恢复副本.xlsx`；
`out/f2-real-edited.png`、`out/f2-real-restored.png`、`ui-sheet-review/`、`ui-project-restore/`；
`ui-data/{projects,library,imports,headers,splits}/`、`service-current.json`、`http-journal-*.jsonl`。
