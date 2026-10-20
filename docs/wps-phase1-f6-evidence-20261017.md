# F6 R12结案核查（2026-10-17，R12结案）

本会话只执行F6；F7/F8未开始。**可执行回归、浏览器检查、四项目文件核查与真实浮窗打开反馈齐备，R12现已结案。** 独立审查发现的旧记忆显示名问题已先红后绿修复并重算为0个错误候选；用户在真实WPS功能区打开浮窗后确认“已经完整打开”，作为默认可见性与可达性的真人反馈记录。精确最小像素宽度和缩放比例仍以F3的浏览器层证据为准，未写成原生测量。

## 1. 入场与执行清单

- [x] 完整读取907行handoff，核计划“全局约束”“优先检查的五类问题”“F6”；使用executing-plans及verification-before-completion。只推进本包。
- [x] 批准图分两批实际打开：01/02/03/04，再05A/05B/06/07；并读10-11、10-15批准变更。原PNG为设计，不能当运行截图。
- [x] 核分支`feat/wps-phase1`、HEAD `c6edf7fb23e438c13b78a92563ae097d22eb3088`；最后产品提交`1ca0835d5ce586d91a218860811cf9851e0ca1a0`。F6只另修旧记忆显示名：`classify.js`＋对应回归，入场`pane-diagnostics.js`保持原SHA。
- [x] 修复后Node全量510/510、恢复/启动子集58/58、Python实际发现并执行10/10；四项目当前来源/确认/198成果文件与分类布局复核。
- [x] 8图及D01–D12证据分类完成，结论见下；“已核查”不表示所有出口通过。
- [x] 六个主流程与四个受影响浏览器恢复/启动检查均 exit0；默认Node解析失败另留证，改用本机Codex运行时`NODE_PATH`实际执行，不冒充WPS原生窗口。
- [x] F1–F5范围无未修关键项：旧记忆显示名已修复并重算为0个错误候选；D06已有用户真实打开反馈，精确尺寸边界按第3节分层记录。
- [x] R12结案。F7/F8/R13/正式发布均不开始。

Windows；Node v24.19.0；Python 3.13.13。WPS 12.1.0.29161和KET.Application可用沿用本轮用户环境及F5实证，本次未新建COM实例、未操控/关闭任何WPS工作簿、未重启正常服务、未改配置/库/业务项目。页内工具不可点沿用已知限制，真人事件只引用其实际发生日期和主体。

执行计划工具适配：用户指定本仓库/分支，因此在原checkout做文档核验；shell任务提取器只识别“Task N”，本计划为“F6”，用本机Python提取完整F6 brief并按原复选项记录ledger。没有为文档变更编造红绿测试；如修产品仍须先红后绿。ledger在本计划专属`.superpowers/sdd/2026-10-11-wps-phase1-completion/progress.md`（忽略）。

## 2. 本次最终代码回归

以下均为本会话新运行、同一最终产品代码；日志在本机`outputs/wps-phase1-F6/20261017/`。测试通过只说明各自执行层。

| 命令/对象 | 实际结果 | 样本/层级/边界 |
| --- | --- | --- |
| `node --test wps-addin/test/*.test.cjs` | exit0；510执行/510通过；失败、跳过、取消0 | 修复后全量，含文件冻结/票据/宿主/发布/学习/恢复；不是WPS窗口真人点按 |
| project-restore、project-host、ribbon-recovery、ribbon-navigation、webdialog-lifecycle、bootstrap、split-server（均`.test.cjs`） | 修复后`node --test` exit0；58/58；失败/跳过/取消0 | 受影响恢复及启动子集，包含在全量内，不能加为568个不同用例 |
| `python -m unittest discover -s wps-addin/test -p "test_*.py"` | exit0；discover=10；Ran 10 tests；OK | 独立Python审计器用例；不是本次重跑186个供应商F审计 |
| 默认环境`require.resolve('playwright')` | exit1；MODULE_NOT_FOUND | 原样保留该失败；随后显式指向本机Codex运行时已有模块，不安装新依赖 |
| ui-workflow/ui-sheet-review/ui-brand/ui-inquiry/ui-split/ui-project-check.cjs | 显式运行时路径下6/6 exit0，日志末行均PASS | 实际headless Edge＋模拟WPS宿主/本机服务；不是真实WPS浮窗 |
| ui-project-restore-check.cjs、ui-cancel-check.cjs、ui-source-review-restore-check.cjs、ui-startup-navigation-check.cjs | 4/4 exit0；启动导航10/10 | 同一浏览器层级；Node恢复/启动58项仍是独立的Node层证据，不混算 |

实际六主流程文件名为`ui-*-check.cjs`。完整命令、日志SHA及发现数在证据索引；浏览器检查使用显式运行时路径，不代表WPS原生窗口通过。

## 3. 8图逐项对照与承载变更

所有行的当前静态/文件核查代码版均为入场HEAD `c6edf7f`＋F6旧记忆显示名修复（`classify.js`与对应回归）；真人/隔离实证的原代码版本见第5节，不把旧截图当最终版新点按。F6重新实际查看的历史运行截图为F1追加行、F3汇总裁图、F5项目1分类成功首页及25件重开状态，SHA在索引；裁图未含名称列/第三组时不能用它独自证明这些字段。

| 图 | 主操作与编辑位置 | 列/布局、链接与文件组织核对 | 实证与未覆盖 |
| --- | --- | --- | --- |
| 01 | 导入后先分别保留/精确合并，确认选择才分类；默认分别保留 | 导入预览、来源副本与合并明细；名称+完整特征+单位精确合并 | I及F5 263→263、1473→1422、2708→1965、3143→3143；当前6793条确认与来源一致。F6无新导入点击 |
| 02 | 自动建议不等于确认；生成/打开独立审核成果表 | 9公开列（图横向只见8列不丢备注）；黄色最终分类、冲突留核 | F1/F5文件实证；当前四审核表6793行、固定字段/分类备注/rowId全对、公式0；旧建议标签风险见第6节 |
| 03 | H最终分类/I备注表内改；存草稿不学习；整表一次确认并定位错误 | 顺序为序号/名称/规格/单位/工程量/建议/情况/最终分类/备注；选项及绑定页隐藏 | F1/F2/C05–C13/F4隔离或真人证据分列；10-11变更允许新类别，空分类仍阻断。当前表内值通过不证明所有库外名称的真人新增/下次命中 |
| 04 | 确认后生成分类簿，仅一次打开；无逐类独立导出 | 按10-11变更：**1文件、首页汇总、每类1页**；10公开列，分类页品牌/单价/金额空；内部随行ID不计公开列 | 当前四本共178类别页，逐页行数/57880公开格一致；原图多文件仅历史口径，不能照旧验收 |
| 05A | 在首页D:I填3组品牌/供应商，J选方式；主按钮直接读回 | 分列10列、两行组表头、黄色区；B名称蓝色下划线原生**页内跳转**；同布局第5步只绑定不重写 | 当前项目1/4/2共130条内部链接目标、分类行数通过；F5正文有填写主体/解析/主按钮结果。F6未新点Follow |
| 05B | 首页D:F同格两行“品牌/供应商”，G方式；无侧栏品牌二次确认 | 7列、3组；名称仍跳本簿对应类别页；与分列解析业务等价 | 项目3当前48条内部链接及分类格通过；F5真人修正换行后主按钮读回，H隔离等价历史证据保留，非F6新点击 |
| 06 | 四项抬头后生成总询价，返回汇总改品牌或进入拆分 | 10公开列；按组分别/合成；合成材料数量只列一次；总簿允许2隐藏内部页；品牌只从汇总取，报价/金额空 | G/H/I/J＋F5 25/50/60/51询价页及逐值/版式审计；最终冻结链1ca0835已由项目4/2真实生成闭环。F6仅核当前SHA，不称全部重生 |
| 07 | 选目录、一键拆分、完成/失败/待核对、重试及打开实际目录 | 一询价页一xlsx，供应商件无内部隐藏追溯/公式/原价；不覆盖；只读重开校验后独占发布 | 当前186件均succeeded/verifiedBy=publish；SHA、总簿键/回执绑定全对；双F为各项目历史25/50/60/51。J/F4异常/恢复保留，不冒称F6故障注入 |

**10-10承载变更单列：** 单个CreateWebDialog非模态“项目询价”窗口取代停靠TaskPane，七步和表内编辑不变；窗口关闭/复开、重建取消/确定、活动簿归属及七步真人链有10-10实证。F3位置参数/Move/Resize和精确CSS320/三态通过的是测试与浏览器层。2026-10-17用户在真实WPS功能区重新打开浮窗并确认“已经完整打开”，补上默认位置与整体可达性的真人反馈；点击者是用户，工具未看到窗口，也未注入页内输入。精确最小宽度/缩放仍只有浏览器层测量，不扩写为原生像素测量。不恢复旧TaskPane。

## 4. D01–D12结论（状态不是按历史文本照抄）

| 差额 | 当前证据与判断 | F6结案状态 |
| --- | --- | --- |
| D01 | F1绑定外追加/整行复制拒绝定位，Node当前覆盖；隔离COM新增/拒绝/恢复历史证据 | 功能证据保留 |
| D02 | F2 SHA写回409/错误回滚、成功才递增；当前Node覆盖 | 功能证据保留 |
| D03 | F2有效确认优先旧草稿、差异阻止生成、副本只切绑定不重复学习 | 功能证据保留；本次浏览器检查补跑通过 |
| D04 | F3发布并保存绑定后打开；F5一本多页只打开一次/同布局绑定；当前Node及4本文件核对 | 功能证据保留；未新点击 |
| D05 | F1内部页隐藏；354字396pt/短行24pt自动行高实测；未写死84 | 功能证据保留；非逐像素保证 |
| D06 | 非模态窗口、三态CSS320测试已有；F4对话框/多项目为模拟宿主页面；用户真实重开浮窗确认“已经完整打开” | 默认可见性与可达性有真人反馈，精确最小宽度/缩放仍为浏览器层证据 |
| D07 | F4 C06名称/数量各一次临改→真实按钮读回拒绝/定位→恢复，32/32 | 隔离COM驱动，非真人浮窗点击；不倒填历史事件 |
| D08 | F4完整下游改分类/品牌/供应商/方式/抬头分别失效、旧件保留、排序/格式不失效 | 分层证据保留；非本次WPS复跑 |
| D09 | F4真实服务与文件SHA恢复15/15；J异常/五检查点21/21；F5真人重开完成状态 | 当前4项目/198件持久核对通过；未重启本机服务 |
| D10 | F5按10-15批准范围4/4，7587来源→6793确认，186供应商；历史32类只在隔离库，非生产迁入 | 四项目通过；旧记忆显示名问题已在F6修复，隔离库重算错误候选0且原库未改写 |
| D11 | 身份/回退/升级/DataRoot真实生命周期仍F7 | 未完成；本包不实施 |
| D12 | F6矩阵/可执行回归/浏览器与证据审查通过；D06真人打开反馈齐备 | **R12结案**；F7/F8安装包、真实说明、用户独立实操/支持版本仍未完成 |

## 5. F1–F5与G/H/I/J/稳定性证据继承

本节均为历史实证索引，**不是本次重跑或重新点按**；F6新核查见第2/3节。每行原代码锚点为该实证对应提交/入口；本次当前代码清单另存source-baseline.json。

| 包/代码锚点 | 样本与点击者/驱动 | 文件核对及边界 |
| --- | --- | --- |
| [F1](wps-phase1-f1-evidence-20261011.md) / e85d967（补证4b2e8dd） | 8行合成、长特征；助手脚本驱动隔离COM | 隐藏/下拉/冻结/打印/追加拒绝恢复；非插件浮窗点按 |
| [F2](wps-phase1-f2-evidence-20261011.md) / 602b071 | 8行确认/旧草稿、409与成功；脚本+真实服务 | 确认恢复新副本、零新学习；非浮窗真人 |
| [F3](wps-phase1-f3-evidence-20261011.md) / cd3d88d | 4类/5份、COM脚本8步/29项；浏览器模拟宿主 | 相对链接Follow4/4、D4焦点/读回；多文件旧组织由B/F5新证据替代；真实定位仍欠 |
| [F4](wps-phase1-f4-evidence-20261011.md) / 24d54b0（入口cd3d88d） | C06 32/32隔离COM，回执15/15真实服务，页面多项目17/17模拟WPS | 层级分开；对话框页面覆盖不等于WPS原生对话框真机 |
| [F5项目1](wps-phase1-f5-jsa-project1-evidence-20261012.md) / 7f5d9e5 | 263行；用户本人审核确认、汇总填写/主按钮/重开 | 224询价/39无需、23类47组、25件双F；测试名录/抬头 |
| [F5项目3](wps-phase1-f5-project3-review-evidence-20261012.md) / 6402d7f | 1473→1422；用户本人审核确认、同格填写/主按钮/重开 | 1239/183、48类90组、50件双F；保留原粘贴失败及恢复证据 |
| [F5项目4/2最终收口](wps-phase1-f5-resume-evidence-20261017.md) / c6edf7f（产品1ca0835） | 2708→1965及3143→3143；助手自动评审，用户触发插件确认/生成；品牌助手原生WPS填；重开项目4用户06/助手功能区04/05/07，项目2用户04–07 | 58类96组60件、49类83组51件，双F；项目4/2不冒记真人逐行审核；最终文件冻结新链有业务实证 |
| [G](wps-workflow-v3-r12g-evidence-20260930.md) / c3e4b33（接续a4be3f5） | 4类/5份；Codex真实插件界面操作 | 6实际文件双F、打印保存核对；当时多文件分类是历史设计 |
| [H](wps-workflow-v3-r12h-evidence-20261001.md) / d87ad80（入口c3e4b33） | 同格4类/5份；脚本隔离WPS | 6实际文件双F/双布局等价；非插件UI点按 |
| [I](wps-workflow-v3-r12i-evidence-20261001.md) / c2bd7be（入口d87ad80） | 不合并10行/全无需/前导零长小数等，脚本14步 | 13实际文件读盘；嵌套COM版式按模型原生PowerShell步骤，不冒称JSA全覆盖 |
| [J](wps-workflow-v3-r12j-evidence-20261002.md) / 7d33032（入口c2bd7be） | 异常恢复脚本21/21；另有用户侧栏真人七步（工具仅原生导航/观察） | 5供应商逐值/公式/追溯，原失败下拉及修复保留；隔离与真人两套证据不混 |
| [稳定性](wps-sidebar-stability-run-20261010.md) / ffeaf2a（最终生命周期版） | 用户四项真人及七步；工具稀疏原生导航/公共指标采样 | 7210.9秒/361与25219.96秒/1260样本、终点真实可见导航；按有界口径关闭，不保证长期稳定/历史OOM消除；本次未重跑 |

四项目本次实际文件复核：项目/回执revision分别1=33/27、3=60/52、4=71/62、2=59/53；4审核+4分类汇总+4总簿+186供应商=198不同文件。四份可编辑审核表按保存确认/固定字段比较，不强求与初次导出SHA相同；四本分类汇总共178条有效页内链接、57880个材料公开格；文件SHA前后不变。F5双F报告分别25/50/60/51沿用封存报告，本次只核报告存在/摘要及当前成果SHA，不称重新跑了186次双F。测试品牌/虚拟供应商/测试抬头不代表正式业务名录。

## 6. 独立审查、修复与未闭环项

1. **浏览器依赖已补跑**：默认`require.resolve`仍失败，但本机Codex运行时含Playwright；显式`NODE_PATH`后十个脚本均执行成功。证据分成默认解析失败与显式运行时10/10两层，不用一个结果抹掉另一个。
2. **旧记忆显示名已修复**：独立只读审查发现`category-memory.find`携带历史`categoryName`，`classify.suggest`优先使用该旧名，成果表可能预填旧名，读回时因当前类别名称反查不到ID而按库外新类别处理。先在`classification-review-model.test.cjs`新增失败用例，实际得到`旧水泵 !== 水泵`；再在`classify.js`统一取当前分类库名称并同步历史依据文本。针对性24/24、全量510/510通过。隔离库6仍保留1458条旧显示名的存储记录，未改写业务库；按各记录逐条重算，修复前1118个唯一类别建议携带旧名，修复后错误候选0。**1118是诊断重算次数，不是新项目材料或生产库数量。**
3. **真实窗口D06已补真人边界**：2026-10-17 21:01再次接续时，正常服务已按原五目录恢复，但Computer Use窗口清单仍为`apps:[]`；KET.Application COM只暴露兼容接口、无`WebDialog`方法。随后用户在真实WPS功能区打开浮窗并明确回复“已经完整打开”。该证据证明默认可见、可打开与整体可达，不能证明精确最小像素宽度或缩放数值；后者沿用F3浏览器层CSS320/三态结果，边界不混淆。

独立审查结论：旧记忆显示名问题属于本次发现的关键功能风险，已修复并用同一隔离库重算；浏览器缺口已通过在已有运行时中实际执行补齐；D06以用户真实打开反馈补齐默认可见性边界。**F6出口齐备、R12结案**；F7/F8保持未完成，须另开工作包。

## 7. 脱敏证据索引

只入Git此文及状态/计划文档。下表仅公开技术报告名、计数和SHA；报告正文、脚本、截图、工作簿、类别/品牌/联系方式和本机配置在Git忽略的outputs内。SHA可核完整性，不单独证明业务正确。前缀`F6/`=本机`outputs/wps-phase1-F6/20261017/`；`F5/`=本机`outputs/wps-phase1-F5/`。

| 证据 | SHA256 | 本次/继承 |
| --- | --- | --- |
| `F6/node-full-after-memory-fix.log` | `b62265ca986094b7846a1b36aac50631760323e2e7e7147a6fcb41897bba6aad` | 本次，510/510 |
| `F6/recovery-startup-after-memory-fix.log` | `30fd8fa20a84628edfea4a080be7544693d7bc94f8106a51843580690cb72bd0` | 本次，58/58 |
| `F6/python-unittest-after-memory-fix.log` | `2b12617a16393f94a794c931805c52713442a3bf86e96d9d04e5a54be7a15eb7` | 本次，10/10 |
| `F6/python-discovery.json` | `9a5563acd35bd8066ead76cc4cd658df052614bd075fbda21793c15dd65dcdce` | 本次 |
| `F6/playwright-resolution.log` | `1ac44a8f1464662c902f69ba20ff153d76df03b1e0af08f20d429544457eaaff` | 本次 |
| `F6/ui-workflow-check.cjs.log` | `6ef6f48c0912e59020defb2f4e0476da6266937b839d5a8d6892cdef1b234b26` | 本次，PASS |
| `F6/ui-sheet-review-check.cjs.log` | `28c0cc30fdf86d44f503d11bd228dded48acee27c5ee57043f2a65103286aa56` | 本次，PASS |
| `F6/ui-brand-check.cjs.log` | `beb762fa2e2792f913c7ec1282166e75b9b12840048ff8f9a3f9a3dee99c0172` | 本次，PASS |
| `F6/ui-inquiry-check.cjs.log` | `dcbd818dc5a5d07f66f9bf1ac166e1cc7bb3169f068acce2cd89982fae9b8ca4` | 本次，PASS |
| `F6/ui-split-check.cjs.log` | `5e3de352e5db3045caa59287c7815184606cf8bd4d794e9a4c37ae52db762bc6` | 本次，PASS |
| `F6/ui-project-check.cjs.log` | `a23aca0268355a1c49c20c5aa87cda8d8544120a3ee140812db4ff13435cba3a` | 本次，PASS |
| `F6/ui-project-restore-check.cjs.log` | `d76cc0d9b84624b485b72be312509284b0abc6a4256603b483c21d525367244b` | 本次，PASS |
| `F6/ui-cancel-check.cjs.log` | `8e89fe35c896916ece8a713bd6bfd895514c3752da96e4cb526a9ce87c642c42` | 本次，PASS |
| `F6/ui-source-review-restore-check.cjs.log` | `e07c4417adb3b42ad60343205da266d5e3d0dcab148c506241e44ba5543904f4` | 本次，PASS |
| `F6/ui-startup-navigation-check.cjs.log` | `e5e91ae7089cec951fa6871cbe487ccec15c4a4842db47f915be778b44f38f58` | 本次，启动导航10/10 |
| `F6/f5-four-review-files-audit.json` | `74b873f3c62dab6a69b463022f61d951a13d4090fec10d3399a30b14dc0430f0` | 本次 |
| `F6/f5-four-projects-final-check.json` | `7ad3251d9f1afc2d00fe13fbaa5ccf1fe89e39df84bd48df7c6010bab1508e62` | 本次 |
| `F6/current-category-layout.json` | `4cafb935a8b22f5362b2e0a98bd46cdd068e8464e81570120e731947aec50d9b` | 本次 |
| `F6/memory-display-after-fix.log` | `ef9e2d4be5f9e88ef8fcb93902d860670b89c942913cc462482df549a9cc125a` | 本次，错误候选0 |
| `F6/four-projects-after-memory-fix.log` | `0d8227dc17fe89efd7f15b6004d92952d9b1d2cc8e79f73865d94189ec3aeee3` | 本次，exit0 |
| `F6/four-review-files-after-memory-fix.log` | `1a5cd49675174c9905ab227c0235df168313ae2e21f1a06edd033bd4bc751f38` | 本次，exit0 |
| `F6/current-layout-after-memory-fix.log` | `10b74a08158c7c4faf0f8c2565cbb2631b2024470a75306aba22e6188713120b` | 本次，exit0 |
| `F6/memory-display-readonly.json` | `31e25f811d41320957380700c8ea814f717b44ff1c7413991d95479ff6480f4a` | 本次，只读重算 |
| `F6/source-baseline.json` | `ba1f60c5bd8f337aed85a110eac3d0adaa1a5639c0d8cd8f3850f40e51c1732c` | 本次 |
| `F5/resume-20261012/jsa-split-f-python-report.json` | `e8fbd5beba4c0ee1858bc6c58bf767a900afb1ca7d75548819dabd38d2ffb3f4` | 继承，未重跑 |
| `F5/resume-20261012/jsa-split-f-node-report.json` | `e32e45fd83f1e0b133094fa3a7b4c01cb2ff7aaf228d3bdcc60ba6ecd91f74b0` | 继承，未重跑 |
| `F5/resume-20261012/project3-split-f-python-report.json` | `338e03e5e6836d50b02f401bac00484c46e7d2b283af401288bdbfce68fdd202` | 继承，未重跑 |
| `F5/resume-20261012/project3-split-f-node-report.json` | `8d5e50306e5a370fa9ba9b0029617d603ceea78bcba6fdf6fdbc7b2f5fa1d782` | 继承，未重跑 |
| `F5/resume-20261017/project4-split-f-python-report.json` | `1feafb368649aa4b00ee02363f279c075671d5a4bb484d1a062b3579f61d439d` | 继承，未重跑 |
| `F5/resume-20261017/project4-split-f-node-report.json` | `759282e38595d2b1b0776a8a11c6fba66daf56fb9811c6940dacfd7b4da1e479` | 继承，未重跑 |
| `F5/resume-20261017/project2-split-f-python-report.json` | `bfb66da9277087a3f03de5c5b998a86b875d1c7fd7a324a2a5c9e0c1b7fe4ef9` | 继承，未重跑 |
| `F5/resume-20261017/project2-split-f-node-report.json` | `5c426602df01b621e6112c721358ffd49aea4deb8697fcea8764787de420c61e` | 继承，未重跑 |

本次实际再看的4张历史运行截图（只读本地，不入Git）：

- `outputs/wps-phase1-F1/out/f1-real-append.png`：`a0c30345734f7ccef13a5e781822074da46052fe0f03a634a4430122f8f81933`。
- `outputs/wps-phase1-F3/out/f3-real-summary.png`：`ca435b931a51a3332b3f60fbea8be9f3e67e59ce657d203e9ca165442372d62d`。
- `outputs/wps-phase1-F5/resume-20261012/jsa-category-success-summary-before-fill.png`：`ffa497053741ea569ab6745a8bc6ecc725bb020d20e4d52971bb982fc1fd6d28`。
- `outputs/wps-phase1-F5/resume-20261012/jsa-split-restored-25-complete.png`：`0de348178ede8f87cb1d07ab7966d361a1609f1978064c721724eb5b6458de92`。
