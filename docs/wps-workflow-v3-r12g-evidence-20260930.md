# R12-G 分列真实主链证据（已通过）

## 2026-09-30 最终出口

图05A→06→07已在真实WPS插件界面通过：4行分列汇总、5询价页、5独立供应商文件；拆分完成5／失败0／待核对0。沿用确认8行、4分类簿2/2/2/1，未重新导入、确认、学习或分类。操作者Codex，WPS 12.1.0.29161，实际接续HEAD `a4be3f5a919a0def97b398b96a808d55869907c2`、分支 `feat/wps-phase1`。历史6个入场修改已由B/D收敛；本次只提交三份验收/交接文档及下述最小修正和测试，临时诊断已撤出，原始证据不入库。

本次只完成G，R12整体仍未完成，H及以后未开始。最终提交/远程SHA以本机 `evidence/backup-receipt-r12g-final.json` 的实际收尾核对为准。本机证据根目录仍为 `outputs/wps-acceptance-20260927/R12-G/`；`final-operation-report.json`、`final-output-list.json`、`final-screen-index.json` 为最终操作、输出和截图SHA清单，旧失败文件/23张无效截图全部保留且不作通过依据。

### 真实操作与截图

| 图/验收点 | 操作与实际结果 | 本机证据（相对R12-G） |
| --- | --- | --- |
| 05A四类与名称链接 | 逐一点B4～B7，完整路径、稳定类别及材料2/2/2/1一致 | `screens/43、44、45、46、47、49、50、51-*.jpg`；`evidence/input-audit.json` |
| 05A固定填写、未保存读回 | 表内填固定6组，水泵分别、其余合成；未先保存xlsx即点主按钮，读回4有效类/预计5份、项目14→15，磁盘仍空且SHA未变；无侧栏二次品牌确认 | 截图52/53；`summary-unsaved-before-read-134448.log`、`summary-unsaved-after-read-134448.log`、`project-rev15-new-summary-unsaved-read.json` |
| 保存汇总与抬头阻断 | 保存后revision16，汇总/品牌来源SHA一致；四项抬头逐一缺失均定位并停止，补为示例园区／虚构建设单位／测试经办人／000-00000000 | 截图54～63；`project-rev16-before-print-fix.json` |
| 06真实新总簿与打印 | 修正后生成新目标并重开，5公开询价页＋明确2内部页；每页A4横向、宽1页/高不限，样例每页实际1页，标题/抬头/10列完整 | 截图67～72；`示例园区_询价总表_复验.xlsx`；逐文件layout审计 |
| 长特征、重复表头及分页 | 隔离40行虚构材料、两条长特征，真实保存重开与2页预览；长文本末尾完整，第二页重复10列表头，未改变正式7行材料 | 截图73～75；`long-print-1790773876360.xlsx`；`long-print-native-receipt.json`、`long-print-file-audit.json` |
| 07主面板与真实一键拆分 | 进入第七步直接显示目录和主操作；选择全新空目录，一键生成指定5件，结果窗口完成5/失败0；持久回执全部succeeded、待核对0 | 截图77/78；`final-project-rev24.json`、`final-split-rev7.json` |
| 07打开目录、供应商重开 | 点击“打开输出文件夹”，确认WPS对现有explorer.exe的提示后打开正确目录；五件实际可见。由目录打开阀门文件，仅1公开页、两供应商/两材料，打印仍横向单页 | 截图80～82；五文件实际SHA与回执一致 |

项目最终revision **24**，确认键 `ck2-721d17bd7b34fb51`、生成键 `ck2-14a15fd175309425`；确认快照/confirmedAt/review revision及固定品牌映射与revision16逐对象一致。split batch `p-muo52jb9-n2ivbhi4`，独立回执revision **7** 与项目split对象完全一致，5件均 `verifiedBy=publish`；成功时间2026-09-30T13:27:14.649Z～13:27:19.225Z。本机分类4簿SHA和汇总SHA再核未变；回执SHA均等于实际文件，未以observedSha256冒充成功。

### 本次失败定位与最小修正

1. **R9/R2打印保存边界。** 原始39/40预览显示纵向、十列横分3页。加入横向/适合宽1页后，真实SaveAs仍丢失pageSetup，不能降低重开要求。隔离直接SaveAs、PrintCommunication提交、追加Save、先Save再设版式四种保存次序全部复现丢失；显式先设A4 `PaperSize=9` 后，实际xlsx持久化横向与高不限。模型传递纸张/方向/页宽高，host先初始化纸张再设置并在重开时严格核纸张、区域、重复表头、方向及缩放。新增模拟保存丢设置负例和模型纸张断言，`print-paper-red.log` 31通过/2失败→`print-paper-green.log` 33/33；真实总簿67～72闭环。打印模态框工具激活失败是单独的控制限制，后续使用独立预览按钮；未用UI自动化以外的原生控制绕过。
2. **R10/R3第七步仍为占位。** 截图76复现“将在R10开发包实现”；既有split-section放在辅助区，主阶段没有操作。新增主面板断言先红（0≠1），将现有区块移入stage-panel-split，保留控件ID和逻辑；`split-main-panel-red.log`→`split-main-panel-green.log`，真实77/78主链通过。未增加阶段或二次确认。
3. **R10打开目录调用对象错误。** 截图79真实提示“不支持直接打开文件夹”；原代码只查Application.Shell/ShellExecute，未调用[WPS官方OAAssist.ShellExecute](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/OAAssist/member/ShellExecute)。新增“仅OAAssist可用”负例实际null→期望Explorer及准确引号目录，`split-open-directory-red.log`→`split-open-directory-green.log`；最小增加OAAssist分支，保留既有兼容分支。恢复保存的revision24后真实按钮打开正确目录，截图80闭环；无需重拆分或改任何输出文件。

长特征件保存XML的自动行高缓存为120/409.5，未显式customHeight；实际WPS重开重新计算两行均120，两页真实预览证明完整显示。未把openpyxl根据ht派生的customHeight值误当XML属性，也未把缓存值当真机行高。正式文件XML省略fitToWidth时按OOXML默认1解释，原始缺省仍记录为null；真实预览明确宽1页，不伪称XML显式写了1。

### 六份实际文件与双审计

公开预期矩阵独立按固定输入/品牌/供应商/抬头抄录，Python/openpyxl独立解析实际xlsx并运行R12-F审计；Node运行R12-F的另一套审计逻辑，消费Python读出的实际矩阵，**不是第二个独立xlsx解析器**。每件均 `value-verified`，另核文本类型、空单价金额、完整特征、合并/浅色表头/列宽/换行/冻结/打印区域/重复表头/A4横向/宽1页高不限。source rowIds逐件与确认快照、冻结模型的类别/数量/来源对账，仅存本机 `*-source-reconciliation.json`，不进入供应商文件。

总簿位于R12-G根目录，5供应商件位于新建 `R12-G/询价输出/`；以下全部页可见、公式0。供应商件无内部页、隐藏页/列、追溯ID、批注/超链接、外链、意外联系方式/路径/SHA/原价/历史价。

| 文件/profile | 页名及实际行×列 | SHA256 | Python/Node/layout/来源 |
| --- | --- | --- | --- |
| 示例园区_询价总表_复验.xlsx／internal-total | 水泵_青源8×10；水泵_恒流8×10；阀门_合成询价9×10；风机_瑞风8×10；汽车充电桩_驰电7×10；仅允许内部追溯10×9、处理记录10×2 | `6ba74272e0cb7ac938178451d88598d6696c3a2216081b1f57ab0822e8b62e3f` | 全通过 |
| 水泵_华川设备.xlsx／supplier | 水泵_青源8×10 | `cb483518a5c170e8b9ba790ab3524c0eafa4c2d8f9cce8c54b3e64d1b4a9d904` | 全通过 |
| 水泵_启明机电.xlsx／supplier | 水泵_恒流8×10 | `d9bfeab5209abc1497cb18a378169ae20706c07a47404afa9128c6d289266af9` | 全通过 |
| 阀门_多供应商.xlsx／supplier | 阀门_合成询价9×10 | `2152c158d8f19b2e670df409260f2ebc4a3e72447b0493a1fe1dee85c751bb19` | 全通过 |
| 风机_瑞风设备.xlsx／supplier | 风机_瑞风8×10 | `70d53d87900e8ecb702f6f1061f38bba9e7d69dfcafc337d9572d50557e3f6a9` | 全通过 |
| 汽车充电桩_远程电气.xlsx／supplier | 汽车充电桩_驰电7×10 | `d9c17677d73adff4aea4e4d2356a6e7002484867251761d928808970b3c73154` | 全通过 |

两水泵页各2行、数量2/3；阀门两行20/12且各为“通达 / 海岳”，材料仅一次；风机两行2/3、充电桩1行1；供应商信息逐组对应。总簿生成时间与独立操作时间窗 `final-generation-run-window.json`、持久生成回执对账，不以读回自身填预期来冒充验证。长特征隔离件46×10、公式0，SHA `d82fc582fdfdf43bee69f6e6d81bd9d3dffad1326297a2fc379d0a23b77ba402`，不计入正式5件。

### 相关验证与收尾审查

实际调用本机现有Node/Python运行时（非npm安装），执行参数如下：

~~~text
node --test wps-addin/test/*.test.cjs                       362通过/0失败
python -X utf8 -m unittest discover -s wps-addin/test -p test_audit_outputs.py   8通过/0失败
node wps-addin/test/ui-inquiry-check.cjs                   PASS
node wps-addin/test/ui-workflow-check.cjs                  PASS
node wps-addin/test/ui-split-check.cjs                     PASS（含两项本包负例修正）
python -X utf8 outputs/wps-acceptance-20260927/R12-G/audit-chain.py  6件全部通过
node outputs/wps-acceptance-20260927/R12-G/audit-chain.cjs  6件全部通过
python -X utf8 outputs/wps-acceptance-20260927/R12-G/audit-long-print.py  PASS
python -X utf8 outputs/wps-acceptance-20260927/R12-G/finalize-evidence.py PASS
~~~

日志 `final-full-node.log`、`final-python-unit.log`、`final-ui-inquiry.log`、`final-ui-workflow.log`、`split-open-directory-green.log`、`final-python-audit.log`、`final-node-audit.log`；浏览器用模拟宿主，真实通过依据是上述WPS操作/文件/截图，不混写。按批准计划在当前会话自查完整diff和逐项出口，不另开代理。

待定：H同格、I边界、J异常/恢复/搬移（含C历史真机缺项、E异常）、K功能区入口、L四项目及R12结案；32类正式词表/迁入政策与另一WPS版本仍未核定。G结束停止，不能称R12全部通过或一期发布。

## 打印修正前的历史接续记录（以下“当前”仅指当时）

日期：2026-09-28～30；操作者：Codex；WPS：12.1.0.29161。对应获批图05A、06、07，开工与接续时均已实际查看本包图片。分支 `feat/wps-phase1`，本包基线 `d90e1282cfb60f8a1af8587956fa2834eb68900a`，本次失败排查接续HEAD为 `a4be3f5a919a0def97b398b96a808d55869907c2`。历史提示词的6个入场修改已由B/D提交；不清理工作树。此前已提交汇总说明/SHA修正；当前打印修正4个源码/测试文件及1个临时诊断文件尚未提交，自动测试通过仍未完成真实宿主闭环。

本机原始证据仅在 `outputs/wps-acceptance-20260927/R12-G/`，受忽略规则保护。公开摘要使用虚构抬头，不上传原始文件、运行项目、内部rowId或本机配置。

## 已完成的真实操作

| 验收点 | 实际结果与本机证据 |
| --- | --- |
| 依赖与输入 | C/D/E/F代码包已完成，沿用确认8行及分类4簿2/2/2/1；`audit-inputs.py`、`evidence/input-audit.json`逐值/SHA通过。未把D/E隔离COM或此前模拟UI当作本包点按证据 |
| 审核内容差异恢复 | 原审核表H11磁盘空与确认快照不同，真实界面恢复到新副本，原件保留；`示例园区_分类审核成果_恢复副本.xlsx`8行与确认内容一致，不重新确认、不学习、不重分类 |
| 图05A分列汇总与4链接 | 为纠正旧截图取值问题，真实生成新汇总 `r12/output/分类汇总表_20260930-134448.xlsx`；B4～B7逐一点开4簿，材料截图43/45/47/50，路径窗口44/46/49/51与只读完整路径、稳定类别ID/材料绑定核对，2/2/2/1一致；截图41为空表 |
| 固定组合与未保存读回 | 水泵青源/华川设备＋恒流/启明机电分别，阀门通达/正通商贸＋海岳/安合设备合成，风机与充电桩各单组合成。在WPS表内编辑后先点主按钮，revision14→15，四类有效/预计5份；前后磁盘D4:J7仍空且SHA未变。截图52/53、`summary-unsaved-before-read-134448.log`、`summary-unsaved-after-read-134448.log`与`project-rev15-new-summary-unsaved-read.json`，无侧栏二次品牌确认 |
| 抬头缺项 | 四项分别留空均定位缺项，主页面生成按钮禁用；截图55～62逐项留证。补齐为示例园区／虚构建设单位／测试经办人／000-00000000；截图63。未在缺项时生成文件 |
| 保存汇总后重新读回 | 真实保存后重新读回，revision16；summary.sha256、brands.sourceSha256与磁盘均为`c505ca2624d0363118b9c413e23395eaba4a11e4e54fb68e1c636bfae981aeca`。截图54与`project-rev16-before-print-fix.json` |
| 图06总询价实际文件 | 已生成 `R12-G/示例园区_询价总表.xlsx`，实际文件含5询价页及内部追溯、处理记录两内部页；充电桩页重开截图35/38有效，原29～33不作为证据，5页重新逐页截图待补。总簿SHA `5c668049cf7e2b066b4771a140e88c1a8c66ff0bf1b21e0e32105cb7a4ca30fb`；沿用revision13生成记录，当前项目revision16 |
| 总簿双审计 | `audit-chain.py`从实际xlsx读回；公开预期矩阵独立按固定输入/组合填写，内部追溯与项目快照及已确认rowId对账。Python与Node R12-F均`value-verified`，公式0；5公开页十列、空单价金额、完整特征/数量/品牌/供应商/抬头均一致；内部页仅明确两页 |
| 实际文件版式 | 总簿文件读回打印区域A1:J8（阀门J9、充电桩J7）、重复表头6行（阀门7行）、冻结A7（阀门A8）、特征列加宽/换行、浅色表头全部通过；详见`示例园区_询价总表-layout.json`。此条仅证明文件设置，尚不替代打印预览 |

确认输入键 `ck2-721d17bd7b34fb51`；已生成总簿键 `ck2-14a15fd175309425`。确认时间与review revision保持原值；保护项目副本保留原历史版本及本次revision15/16。

**截图更正：** 发现旧REPL截图保存函数引用了旧变量，23张截图10～18、20、22～34被错误保存为较早画面。原件保留，`evidence/invalid-screens.json`逐份标为无效，撤销上述截图对应的通过依据；42也不作为水泵打开证明。后续保存改为显式读取当前`globalThis.gstate`。本次43～64重新留证，不能把有文件名但画面不对应的旧图当成验收成功。

## 本包暴露的源码问题与闭环

1. **所属R12-D：汇总说明挤入窄序号列。** 真实截图08复现；说明仅合并公开区域整行，不延伸到隐藏绑定列。新增双布局失败用例先红，修正后相关39项通过；全量旧合并清单3项失败按新增说明合并更新，保留“不吞材料/隐藏绑定”的断言，362/362通过。真实生成新汇总A9:J9并截图09。
2. **所属R8/R11：已填汇总保存后继续沿用空表SHA。** revision10保存的summary/brands SHA仍是生成空表时的旧值，磁盘已有固定品牌组合；重开会误判过期。保护旧项目后新增浏览器断言先红（期望当前实际SHA、实际旧SHA），读回业务校验通过后再inspect物理文件并同步receipt，继续可靠保存。`ui-inquiry-sha-red.log`／`ui-inquiry-sha-green.log`与真实revision12等值证明修正；没有自动替用户保存xlsx，未保存读回语义保留。

3. **所属R9/R2：询价打印横向分页。** 实际预览39/40显示A4纵向100%，十列横向拆成3页。候选修正加入横向、宽1页/高不限与保存重开严格读回；相关33/33、全量362/362通过（`print-fit-red.log`／`print-fit-green.log`／`node-print-fit-all.log`）。但真实再次生成新目标时“水泵_青源”打印方向读回失败，截图64；暂存xlsx实际5询价页的orientation/fitToWidth/fitToHeight仍为空。新目标未发布，项目仍revision16。9月30日晚间新诊断已证实5页即时读回Orientation=2、Zoom=false、Wide=1、Tall=false（高不限），PrintCommunication=true；SaveAs保存重开仍Orientation=1，3次失败暂存xlsx的5询价页均无pageSetup部分、无printerParts。故定位到保存边界，尚未区分打印缓存提交和保存次序；不得因即时读回/自动测试通过而勾打印或降低重开要求。诊断原件见`print-before-after-write-failed.json`、`print-save-boundary-before-isolation.json`。

相关验证：此前全量Node362/362及`ui-inquiry-check.cjs`、`ui-split-check.cjs` PASS；晚间当前候选打印代码/诊断复跑相关33/33，`print-diagnostic-tests-20260930-evening.log`留存。`npm`在本机不可用，实际执行package定义对应的Node命令。模拟宿主浏览器检查与真实WPS证据分开，自动通过不替代打印真机闭环。

## 历史未完成与接续位置（已由上述最终出口接续）

- 已进入实际打印预览并复现横向分页问题；横向/宽1页修正、长特征换行及垂直分页/重复表头仍待闭环。打印模态框工具激活失败的有效截图为36/37，34已撤销。
- 晚间38891已恢复；现有加载项切换启用和独立窗口未能恢复功能区。已用WPS原生另存把用户其它未保存编辑存到`session-protection-20260930-1953/用户未保存工作簿_保护副本.xlsx`，实际读回1页49行27列，原文件SHA不变；私有内容和SHA只留本机`protection-receipt.json`。随后正常关闭并启动WPS，功能区/侧栏恢复，resumed6报告javascript/ribbon/taskpane/roundtrip均通过，截图66有效。未安装、升级或修改安全配置。
- 四种隔离打印保存诊断（直接SaveAs、PrintCommunication提交、追加Save、先SaveAs再设版式）已准备，只创建新的虚构诊断簿。原生“重建侧栏”确认被自动审批拒绝：提示会清除未保存的页面修改，缺少明确授权；已请求用户允许重建并从已保存revision16恢复，当前模态框保持未确认。临时诊断及候选代码/测试不提交为已修复。
- 最终本机审计已加完整性门槛：总簿＋指定5供应商件必须全部存在，供应商目录恰好5件，新增orientation/fit宽高/fitToPage检查；生成时间改为与独立操作时间窗及持久生成回执对账。脚本语法检查通过、相关Node35/35通过（`print-save-diagnostics-related-tests.log`）；当前缺真实拆分，因此不运行成通过。
- 图07新目录一键拆分、5完成/0失败/0待核对、打开实际目录、5独立供应商件双审计尚未执行。
- 本包尚未达到完整真实出口。失败排查备份只包含三份证据/交接文档更新；五个未闭环的源码/测试/临时诊断修改原样保留，未整体暂存。提交/推送结果以本机`evidence/backup-receipt-20260930-evening.json`与远程SHA核对为准，旧`backup-receipt.json`仅为上次备份。只接续R12-G，完成后停止，R12-H及以后未开始。侧栏停帧先封存报告再手动功能区重建，未用周期重载；触发未知仍留R12-J。
