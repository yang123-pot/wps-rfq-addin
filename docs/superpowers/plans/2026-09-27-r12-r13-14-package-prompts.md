# R12–R13 十四个工作包·可直接复制的对话提示词

> 生成日期：2026-09-27。来源：[WPS一期剩余工作详细实施计划](2026-09-27-wps-phase1-completion.md)。
> 用法：每开一个新的对话窗口，只复制该包代码块全文粘贴发送；一个窗口只推进一个包，完成后停止。
> 顺序固定：R12-A → R12-B → R12-C → R12-D → R12-E → R12-F → R12-G → R12-H → R12-I → R12-J → R12-K → R12-L → R13-A → R13-B。前一包未真正通过（未验证/未提交/未核远程SHA）时，不得把后一包勾成完成。
> 每份提示词都已要求：先完整读 handoff.md 与 AGENTS.md、实际打开本包对应效果图、核对 Git，再执行、验证、留证、更新 handoff、按明确文件清单提交推送并核远程 SHA。

---

## 1/14　R12-A　保护现场并建立接续检查点

~~~text
【本会话只做 R12-A：保护现场并建立接续检查点】
你是 F:\材料软件开发（WPS询价插件一期，纯JavaScript业务模型＋WPS宿主适配＋本机Node服务）的接续执行者。本次只做 R12-A 一个工作包，完成后停止，不要开始 R12-B 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-A」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/03-sheet-review.png、docs/mockups/approved-20260926/04-category-workbooks.png。只读文件名或文字说明不算看图；确需看全8图时分两批，不在同一会话为多个工作包反复打开全部8图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，handoff 记录的代码基线为 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改（wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/export-host.js、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs、wps-addin/test/export-host.test.cjs），一律原样保留，禁止清理工作树或整体提交。

本包范围：
- 依赖/对应图：现有证据；图03、04。
- 文件：修改 docs/wps-workflow-v3-acceptance.md、handoff.md；本机证据不入库。
- 输入/输出：输入既有项目 p-mujmyjx0-16kom40i revision=6、审核簿及4个分类簿；输出一份记录现场工作簿、项目版本/确认快照、磁盘SHA和保护副本位置的检查点，不改变业务确认。

执行步骤：
1. 完整读 handoff/AGENTS，实际看图03/04，核 Git 分支/HEAD/status 和 6 个修改差异，记录哪个后续包接手每个文件。
2. 用已获准的 Computer Use 读取实际 WPS 窗口；若仍被拒绝，记录当前错误并停止依赖窗口的动作，不绕过、不重复索要已经给过的用户授权。独立源码包可以继续。
3. 读取现有已打开审核簿状态，核 H11 与 rowId 绑定是否对应材料；先保存可恢复副本并记录旧/新路径与 SHA，保护未保存编辑。不要直接关闭、重建或覆盖原生成成果；若原路径被用户保存导致 SHA 改变，保留两个版本并进入 R12-C 核对。
4. 核 38891 健康状态；仅在未运行时使用 handoff 既有隔离目录参数启动服务，使用新的 report 文件名，不覆盖 17:55–18:04 报告和两个停摆存档，不导入生产库。
5. 核 4 个分类簿仍与已记录快照一致；沿用已有逐值审计，只对变化/缺失文件补查，分类主路径不重新生成。
6. 写清现场是否可继续、保护位置和下一包，按包提交文档并核远程 SHA。

出口：现场编辑已保护、旧证据未覆盖、下一步输入可信；若窗口不可用，明确写“仅环境阻塞，尚未新增真机通过”。

收尾（严格按顺序）：
1) 按本包范围运行相应验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-A/ 新目录留真实证据，摘要脱敏写入 docs/wps-workflow-v3-acceptance.md 或链接的独立证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步（保持简短，详细证据放独立文件）；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改系统/用户/仓库代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明，不得声称已备份。
完成后停止，不要开始下一包。
~~~

---

## 2/14　R12-B　收敛暂存清理与发布票据

~~~text
【本会话只做 R12-B：收敛暂存清理与发布票据（先修已复现缺陷）】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-B 一个工作包，完成后停止，不要开始 R12-C 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-B」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/04-category-workbooks.png、docs/mockups/approved-20260926/05a-summary-separated.png、docs/mockups/approved-20260926/07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，handoff 记录的代码基线为 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改（wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/export-host.js、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs、wps-addin/test/export-host.test.cjs），一律原样保留，禁止清理工作树或整体提交。其中本包负责 export-files.cjs、server.cjs、import-ui.js、export-files.test.cjs（export-host 及其测试留给 R12-D）。
4. 先确认 R12-A 状态；若 A 未完成，按计划允许的方式继续独立源码包，但不得虚填依赖真机的出口。

本包范围：对应图04/05A/07。修改 wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs，必要时 wps-addin/test/export-server.test.cjs。
接口：保持 createExportStore({directory}) 的 prepare(target,options) / commit(ticket) / verify(ticket,target,sha256)；discard(ticket) 保持结构化结果，先判 published/busy，再处理未发布且不活跃的 stage；陈旧清理接收活跃路径集合，文件 mtime 不能覆盖1小时有效票据的所有权。清理失败不能虚报“文件已删除”。

执行步骤：
1. 把本次 reproductions.json 的两个复现转成失败测试：`published discard preserves verification` 与 `stale sweep preserves active ticket`；断言 commit→discard→verify 仍通过、11分钟前 mtime 的有效 stage 仍存在。另测 busy 时 discard 不删、用户同名文件不动。
2. 运行 node --test wps-addin/test/export-files.test.cjs wps-addin/test/export-server.test.cjs，确认新测试因上述行为失败，而不是因环境或拼写失败。
3. 修正 discard 状态顺序和陈旧清理边界，只删除可证明属于本插件且无活跃所有者的残留；服务重启后无所有权证明的文件采取保守保留/报告，不单靠10分钟 mtime 删除。
4. 核调用处失败/取消清理只作用于本次未发布票据；成功但回执保存失败属于待核对，不能清理已发布成果。
5. 运行相关测试及全量 Node（node --test wps-addin/test/*.test.cjs），预期0失败；新增“目标已存在/竞争创建/权限失败”负例保持拒绝覆盖。
6. 审查这4个入场修改文件及新增测试是否仅含本包内容；完成者才按文件清单暂存，剩下 export-host 及其测试留到 R12-D。把清理待真机项记到 R12-J，更新交接并提交推送。

出口：活跃 stage 与成功票据不被清理破坏；原有独占发布/幂等 verify 保持；不因删不掉临时文件把已发布成功误报失败。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-B/ 新目录留证据（命令、测试输出、复现文件SHA），摘要脱敏写入 docs/wps-workflow-v3-acceptance.md 或独立证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 3/14　R12-C　补图03草稿、错误定位与内容恢复

~~~text
【本会话只做 R12-C：补图03草稿、错误定位与内容恢复】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-C 一个工作包，完成后停止，不要开始 R12-D 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-C」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/03-sheet-review.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改（wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/export-host.js、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs、wps-addin/test/export-host.test.cjs），一律原样保留，禁止清理工作树或整体提交。
4. 先确认 R12-A 现场保护已完成（H11 磁盘空/确认快照有汽车充电桩的差异是本包输入）；A 未完成则先按计划处理依赖，不得虚填真机出口。

本包范围：依赖 R12-A；对应图03。修改 wps-addin/src/classification-review-model.js、src/classification-review-host.js、src/import-ui.js、src/project-restore.js、src/project-ui.js，必要时 taskpane.html；对应 model/host、project-restore-audit、workflow-v3 测试及 test/ui-sheet-review-check.cjs、test/ui-project-restore-check.cjs。
接口：保持 readBack(app,binding)、validateRead、draft、confirmation 及项目 reviewDraft/review 含义。计划在 review host 新增 compareSnapshot(readResult,snapshot) -> {matches,differences}，按 rowId 比较固定字段和最终分类/备注；结果交给 project-restore.audit(project,checks) 及 UI，区分磁盘 SHA 与业务内容。需要恢复草稿时只写新的成果副本，不覆盖打开簿；在既有恢复辅助操作中提供动作，不增加主流程确认阶段。

执行步骤：
1. 新增失败测试：H11 磁盘空/确认快照有汽车充电桩时，恢复不得标“内容已一致”；draft 保存不能改变 confirmedAt 或学习来源；409 保留表内值和原已存快照。
2. 跑 review/project 相关测试确认新负例暴露问题；以当前 saveReviewDraft 只保存项目为依据，不把原设计改成每次自动保存覆盖 xlsx。
3. 实现比较和差异提示：优先读同路径已打开簿；若仅表格格式/排序变动且业务一致，可更新物理校验；业务不同保留双方并要求“选用现表内容”或“恢复项目草稿到新副本”，不能静默覆盖/学习。固定字段损坏仍拒绝。
4. 真机在隔离副本改最终分类/备注→点“保存审核成果”；核项目 draft 已落盘、confirmedAt/学习记录/分类文件SHA不变，并确认提示区分“项目草稿已保存”和“xlsx 已保存”。
5. 在错误副本分别造空分类、未知类别、重复/缺失 rowId、改数量/名称；逐次验证明确“工作表＋单元格”定位，失败时不确认、不生成、不学习，复原后再下一项。
6. 真机排序（含随行ID）与筛选后读取全部8行，确认不漏隐藏行、不串类；用测试副本验证重复整表确认幂等、学习失败单独重试、改确认只撤销本来源并使下游过期。
7. 真机保存/关闭/重开草稿与确认检查点，验证未保存编辑/已保存 xlsx 两种情况；输出结果分别记“项目快照/磁盘内容/打开簿内容”。不重新确认当前已验收主样例来冒充新证据。
8. 运行 review/model/host/project 测试、node wps-addin/test/ui-sheet-review-check.cjs 及 ui-project-restore-check.cjs；共享逻辑变动后跑全量 Node。留证、更新交接、按实际文件清单提交推送。

出口：图03草稿/错误定位齐备，关闭重开不丢人工内容，SHA 一致不再掩盖业务差异；成果表仍整表一次确认。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-C/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档或独立证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 4/14　R12-D　打通汇总宿主并补齐布局

~~~text
【本会话只做 R12-D：打通汇总宿主并补齐布局】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-D 一个工作包，完成后停止，不要开始 R12-E 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-D」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/05a-summary-separated.png、05b-summary-combined.png；预览部分只看 01-import-merge.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改（wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/export-host.js、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs、wps-addin/test/export-host.test.cjs），一律原样保留，禁止清理工作树或整体提交。其中 export-host.js 与 test/export-host.test.cjs 属于本包，须在本包验证通过后才提交。
4. 确认 R12-A、R12-B 已完成；未完成则按计划处理依赖，不得虚填依赖真机的出口。

本包范围：依赖 A、B；对应图05A/05B（预览仅看图01）。修改 wps-addin/src/export-host.js、src/brand-model.js；wps-addin/test/export-host.test.cjs、test/summary-links.test.cjs、test/brand-model.test.cjs、test/import-preview-model.test.cjs，必要时 test/ui-workflow-check.cjs。
接口：保持 brand-model.summaryPlan(categories,options)、buildSummary(plan,options)、summaryBindingFor(target,workbook) 及 export-host 现有写/重开校验接口；分列 D/E、F/G、H/I、J 与同格 D/E/F、G 不变。宿主相对链接必须从最终汇总目录解析并核完整目标，不能只按尾部文件名匹配。

执行步骤：
1. 真实小样记录 B4 链接创建前/后、设置字体后、保存重开后的 Color/ColorIndex/下划线/Hyperlinks.Address/目标；确定字体故障是属性回读、主题色还是写入次序，不先扩大容差。
2. 新增负例：Type=3 却指错选项区域必须拒绝；正确 Formula1 等价表示继续通过。链接指另一个目录同名文件必须拒绝，正确相对路径和同一目标绝对规范化形式通过。
3. 运行 host/link 测试确认负例失败；按实测结果最小调整链接字体设置与回读。若 WPS 不能可靠提供 Formula1，须从保存文件验证选项源/实际下拉值；不能仅凭类型为3宣布通过。
4. 复核入场预览候选逻辑：侧栏重建复用本插件未另存预览；用户另存、关闭原预览后打开相同名称/结构的用户簿均不写入。新增相应负例，不用“仅名称＋表形状”代替归属证明。
5. 补汇总 layout 测试：分列标题 A1:J1；A2:A3/B2:B3/C2:C3/J2:J3 跨行表头，三组 D2:E2/F2:G2/H2:I2；同格标题按图合并 A1:G1。合并范围不含隐藏辅助列，不吞公开字段。
6. 实现上述 layout，保留分列首数据行4、同格首数据行5及3组黄色填写区；核长类别名/两行品牌供应商显示完整，三组和方式列不重叠。
7. 生成一个新的分列汇总文件，真机打开正确的4个分类簿链接与方式下拉，保存重开后核图05A；同格最小空表核图05B结构。正式填报留到 R12-G/H。
8. 跑相关模型/host/link/UI 及全量 Node；补文件读回、截图和颜色/地址实测值。6文件中剩余 export-host 及其测试必须经本包通过才提交，按文件清单连同 layout 修改提交推送。

出口：B4 阻塞有真机闭环，两个布局与图相符；原等价下拉/隐藏列宽修复保留，错误源和错误目标不再蒙混通过，预览不误写用户簿。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-D/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档或独立证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 5/14　R12-E　修正拆分待核对状态与内容证明

~~~text
【本会话只做 R12-E：修正拆分待核对状态与内容证明】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-E 一个工作包，完成后停止，不要开始 R12-F 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-E」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改（wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/export-host.js、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs、wps-addin/test/export-host.test.cjs），一律原样保留，禁止清理工作树或整体提交。必要时本包会触及 src/export-host.js（R12-D 已负责其提交）。
4. 确认依赖包状态；未完成则按计划处理依赖，不得虚填真机出口。

本包范围：对应图07。修改 wps-addin/src/split-state.js、src/split-ui.js、dev/split-store.cjs，必要时 src/export-host.js；wps-addin/test/split-store.test.cjs、test/split-server.test.cjs、test/ui-split-check.cjs。
接口：保持 reconcile(receipt,checks) 和 prepare/load/save API；观察到的 SHA 与“经核对的 SHA”必须分开。计划新增 verifyExistingOutput(app,file,expectedSheet,inspectTarget) -> Promise<{ok,sha256,mismatches,layoutIssues}>（放 export-host，复用现有保存后读回）；inspectTarget(target) 由调用方提供，调用既有本机文件核验接口取得实际 SHA。只在完整核对通过且当前 inputKey/目标 SHA 仍相同时，通过现有带 expectedRevision 的 save 标成功。旧回执无证明时保守待核对。

执行步骤：
1. 新增失败测试 `unrecorded target stays unverified after repeated checks`：pending 存在文件时，连续三次 reconcile/prepare 和一次 store 重建始终 needs-verification；断言 summarize(...).done===false。
2. 新增“实际内容不符、同名异内容、总簿 inputKey 改变、核对中目标 SHA 改变、save 409”均不能提升成功；已有真实 verified SHA 的成功件仍可跳过。
3. 运行 split 测试确认新负例失败；修改状态转换，消除“把首次观察 SHA 当预期”的来源混用。
4. 接入显式核对动作，比较当前冻结 modelSnapshot 对应询价页的全部公开值、工作表/隐藏列范围、必需版式与抬头；核对前后 SHA 一致、来源键未变才落成功回执。格式/内容异常展示位置并保留原文件，不覆盖重试。
5. 修 UI 统计与重试清单：待核对单列，pending/failed 可续作，succeeded 只校验后跳过；关闭/重开结果窗口不改变状态。
6. 跑 split 模型/store/server/UI 与共享全量 Node；真机“发布后未记账”故障留到 R12-J 检验同一入口，更新交接并提交推送。

出口：仅重复刷新/重启不能凭空完成；5完成/0失败的含义包括真实内容验证，外部文件保持不覆盖。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-E/ 新目录留证据，摘要脱敏写入验收文档或独立证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 6/14　R12-F　建立与批准方案一致的公开输出审计

~~~text
【本会话只做 R12-F：建立与批准方案一致的公开输出审计】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-F 一个工作包，完成后停止，不要开始 R12-G 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-F」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/06-inquiry-linkage.png、docs/mockups/approved-20260926/07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改（wps-addin/dev/export-files.cjs、wps-addin/dev/server.cjs、wps-addin/src/export-host.js、wps-addin/src/import-ui.js、wps-addin/test/export-files.test.cjs、wps-addin/test/export-host.test.cjs），一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖包状态；未完成则按计划处理依赖，不得虚填真机出口。

本包范围：对应图06/07。修改 wps-addin/dev/release-audit.cjs、dev/audit-outputs.py、test/release-audit.test.cjs；新增 wps-addin/test/test_audit_outputs.py（只读扫描的测试，临时夹具不入 Git）。
接口：release-audit.audit(input) 扩展 profile: 'supplier'|'internal-total' 与完整 expectedManifest；Python audit(path, expected_manifest, profile='supplier') 返回逐值/版式/额外内容差异、SHA、页/行/列数、公式数。CLI 增加显式 --manifest / --profile；未提供完整预期时只能报告扫描结果，不报告“逐值通过”。不把 Node 模型自己的输出再当独立审计证明，Python 读取实际 xlsx。

执行步骤：
1. 写失败测试：允许指定抬头位置的 010-12345678 及长编码；在额外隐藏列/无关单元格放同一个电话、绝对路径、SHA 或原价必须拒绝；多一个未预期值、缺一个值、公式、内部/隐藏页均失败。
2. 分 profile 测试：内部总簿仅允许清单声明的内部页；供应商件任何内部页/隐藏追溯列失败；物料10列、允许标题合并和抬头区，不能误把抬头当物料行。
3. 跑 node --test wps-addin/test/release-audit.test.cjs 和 python -m unittest discover -s wps-addin/test -p test_audit_outputs.py，确认错误规则由新用例暴露。Python 用已配置的 workspace 依赖，不向产品写个人机器路径。
4. 实现完整矩阵/区域白名单和剩余区域检查；允许的联系方式必须同时匹配位置与预期值，不全面豁免所有电话/邮箱。
5. 审计实际数据类型与公式元数据，文本 =... 与公式分清；检查隐藏列/页、批注、超链接/外部关系及额外内容，公开导出不得漏掉空值格之外的隐蔽数据。
6. 相关 Node/Python 测试通过；对一个故意污染的隔离 xlsx 证明审计能报出具体表/格，再准备 R12-G/H 输出的预期清单格式。更新交接并按明确文件清单提交推送。

出口：审计不会拒绝允许抬头，也不会放过额外公开内容；“内部总簿”和“供应商件”合格条件不再混用。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-F/ 新目录留证据，摘要脱敏写入验收文档或独立证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 7/14　R12-G　分列汇总→总询价→拆分真实主链

~~~text
【本会话只做 R12-G：分列汇总→总询价→拆分真实主链】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-G 一个工作包，完成后停止，不要开始 R12-H 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-G」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/05a-summary-separated.png、06-inquiry-linkage.png、07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R12-C/D/E/F 已完成；未完成则按计划处理依赖，不得虚填真机出口。

本包范围：依赖 C/D/E/F；对应图05A、06、07。文件为验收文档/handoff；若暴露源码问题，先记录复现，按所属修复包解决再继续，不改变批准效果。
输入/输出：沿用已确认8行及4个分类簿；输出4行分列汇总、5个询价页、5个独立供应商 xlsx 和逐份审计回执。抬头使用隔离虚构内容，不写真实联系人。

执行步骤：
1. 开始前看对应3图，核已生成汇总绑定仍对应4类/2、2、2、1行；4个B列名称逐一点开核完整路径、稳定类别和材料，不能只看窗口标题。
2. 填第6.1节固定组合：水泵 青源/华川设备＋恒流/启明机电→分别；阀门 通达/正通商贸＋海岳/安合设备→合成；风机 瑞风/瑞风设备、汽车充电桩 驰电/远程电气各1组合成。
3. 在表内直接改值，不先保存 xlsx，点“填写完成，生成询价表”；核最新修改被读回、4类有效/预计5份，项目可靠保存，无侧栏二次品牌确认。
4. 四项抬头缺一应定位并停止；补齐后“生成总询价工作簿”，保存新目标，重开核5个询价页及允许的内部页清单。
5. 逐值核：水泵两页各2行且数量2/3；阀门两行20/12、品牌“通达 / 海岳”且材料只出现一次；供应商区逐组对应；风机2行2/3、充电桩1行1；10材料列、单价/金额空、特征完整、抬头正确。
6. 打印预览核长特征换行、宽高、标题/抬头、打印区域、重复表头及分页；保留实际截图与文件读回，不能仅看 layout 对象。
7. 选择全新拆分目录，一键生成5份：水泵_华川设备.xlsx、水泵_启明机电.xlsx、阀门_多供应商.xlsx、风机_瑞风设备.xlsx、汽车充电桩_远程电气.xlsx；结果窗口5完成/0失败/0待核对，打开目录实际核文件。
8. 对每份读取实际 xlsx，运行 R12-F 双审计并核全部公开值/抬头/layout，公式0、无内部页/列/意外内容；记录SHA、页名、行列数及 source rowIds 的本机对账，不把ID写进公开文件。
9. 保存图05A/06/07对应截图、项目 revision/inputKey、操作报告、输出清单，更新验收文档/handoff 并提交推送。

出口：图05A→06→07完整真实通过；仍不等于 R12 全部通过。

收尾（严格按顺序）：
1) 跑完本包相关验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-G/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 8/14　R12-H　同格布局等价验收

~~~text
【本会话只做 R12-H：同格布局等价验收】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-H 一个工作包，完成后停止，不要开始 R12-I 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-H」一节，并连同其中「全局约束」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/05b-summary-combined.png、06-inquiry-linkage.png、07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R12-G 已完成；未完成不得开始本包真实验收。

本包范围：依赖 G；对应图05B、06、07。文件为验收文档/handoff；本机独立批次。

执行步骤：
1. 从相同分类清单生成新的同格汇总，保留已填分列文件及其SHA；不重新导入/确认/生成4个分类簿。
2. D/E/F 按两条标签“品牌：…\n供应商：…”录入与 G 相同组合，G列选同样方式；核每格两行完整显示，名称4链接打开正确目标。
3. 主按钮读回；以 categoryId 对齐比较两布局规范化 groups/顺序/mode，逐值相同；生成键含布局时不要求两份文件二进制SHA相同。
4. 新版本总簿、新拆分目录完成真实输出；核相同5个询价对象及各自材料/数量/品牌/供应商/抬头，使用 R12-F 审计逐值对账。
5. 留图05B及后续输出证据、两布局差异报告、每文件SHA，更新文档并提交推送。

出口：双布局业务等价且各有真实输出；不得把05A复制截图算05B通过。

收尾（严格按顺序）：
1) 跑完本包相关验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-H/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 9/14　R12-I　不合并、全部跳过及边界数据

~~~text
【本会话只做 R12-I：不合并、全部跳过及边界数据】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-I 一个工作包，完成后停止，不要开始 R12-J 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-I」一节，并连同其中「全局约束」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：按子场景看 docs/mockups/approved-20260926/01-import-merge.png、03-sheet-review.png、05a-summary-separated.png（或 05b-summary-combined.png）、06-inquiry-linkage.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R12-G/H 已完成；未完成不得开始本包真实验收。

本包范围：依赖 G/H；按子场景看图01、03、05A/05B、06。文件：wps-addin/test/fixtures/workflow-v3-sample.cjs 及受影响测试仅在缺覆盖时补；真机材料/项目在 outputs，验收文档/handoff 入库。

执行步骤：
1. 新隔离项目选择默认不合并，保留10行来源边界：水泵4行（1、1、1、2），阀门2、风机2、充电桩1、无需询价1；4个分类簿应为4/2/2/1，共9条询价材料。两水泵询价页各4行，不重复累加；按 G 相同品牌模式仍5份。
2. 全“无需询价”项目：草稿/整表确认可保存，显示无待输出；分类/汇总/询价/拆分不生成空文件，也不能无故报错或强制填品牌。
3. 精度与文本隔离样例：0.1＋0.2精确0.3；前导零编码、长小数、长中文特征、中文/空格路径和类别清洗后重名；真实文件逐值验证、打印跨页重复表头；超宿主单格上限明确拒绝，不截断。
4. 汇总边界逐个填表：1/2/3组、空组忽略、半组/重复组合定位；同品牌不同供应商保留两组；多组未选方式不放行；同格中文/英文冒号可用，错/重标签/多余文本报格。
5. 汇总排序/筛选/删行/复制行/改名称条数逐项检验，稳定 categoryId 不串类，失败保留填写；品牌/供应商/方式/抬头变动后旧询价/拆分过期；只改格式不误判业务变化。
6. v1样本继续为新 v2 副本，原 v1 SHA 不变、需重新整表确认；未知版本/损坏 JSON 拒绝；库更新不静默改变已确认类别。仅使用隔离数据。
7. 对缺覆盖的业务边界先加有意义的失败测试再最小修复；相关测试/全量 Node 按改动范围运行；记录真实结果和未通过项，提交推送。

出口：R12第二条及第6.2节业务边界有对应证据，不用原10行导入截图替代不合并完整输出。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-I/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 10/14　R12-J　异常、检查点恢复、目录搬移与停摆

~~~text
【本会话只做 R12-J：异常、检查点恢复、目录搬移与停摆】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-J 一个工作包，完成后停止，不要开始 R12-K 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-J」一节，并连同其中「全局约束」「优先检查的五类失效」「统一证据格式与提交检查」一起遵守。
2. 按触发阶段实际打开本包对应效果图：docs/mockups/approved-20260926/03-sheet-review.png 至 07-split-files.png 中与所测阶段直接相关的图，不反复全开8图。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R12-B 至 R12-I 状态；未完成项如实挂账，不得虚填。

本包范围：依赖 B–I；对应图03–07（按触发阶段）。文件：必要修复限定在触发的 export/category/project/split 模块及对应测试；验收文档/handoff。

执行步骤：
1. 为每个异常建独立输出目录/副本，记录初始项目 revision、输入键、每文件SHA；错误注入仅用开发隔离服务，完成后恢复，不能进入发布包。
2. 对话框取消/右上角关闭：选择文件、另存、选目录分别一次，阶段/确认/回执不变，不创建半成品。
3. 目标已存在、竞争创建、只读目录：检查全部目标再写第一份；失败后原文件SHA不变，无误报全部成功。只对隔离目录设置权限并恢复。
4. 分类生成和拆分各注入第二份写入失败，确认首份已记账；重试仅未完成，已成功SHA/mtime不变，统计不是“全部成功”。
5. 依次测试发布前中断、发布成功后响应丢失、回执保存失败/409、服务停止重启；pending既存目标必须待核对，连续重开不自动成功，经 R12-E 逐值核对才认成功；不符保留并提示。
6. 删除/外改已成功件：丢失可待处理，外改只能待核对；不能覆盖；修改总簿或品牌导致键过期时停止拆分，不沿用旧快照。核 R12-B 暂存仅清理本次可安全清理文件。
7. 五恢复检查点逐个重启/打开项目：审核草稿；确认后分类失败；已填汇总；总簿已生成；拆分部分成功。每次核项目、工作簿内容及界面状态，而非只核路径存在。
8. 项目/库/抬头模板409冲突保留本地改动并明确提示；独立服务重启后恢复；原输入件SHA始终不变。用户打开的簿不被插件关闭，临时禁宏/活动簿切换后恢复。
9. 关闭重开汇总后逐类点链接；把整个成果树复制到新根目录（保留原件），通过重新定位核ID/内容/相对关系再接续；中文空格路径、目标开/关、缺目标、另一目录同名错误目标各验证一次。
10. 侧栏重建验证已保存阶段恢复、预览不增加/不误写；若发生停摆，先封存报告/截图/触发动作/时间/WPS版本，再重建；不为取得证据故意破坏用户当前簿，不定时刷新掩盖原因。
11. 以“操作→观察→文件变化→恢复结果→证据路径”记录每项；失败先复现定位再修复，跑相应测试，最后更新交接和提交推送。

出口：真实异常/恢复矩阵全部有结果，未完成明确保留；旧停摆存档、原文件和已完成输出未被覆盖。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-J/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 11/14　R12-K　补功能区阶段快捷入口

~~~text
【本会话只做 R12-K：补功能区阶段快捷入口】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-K 一个工作包，完成后停止，不要开始 R12-L 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-K」一节，并连同其中「全局约束」「统一证据格式与提交检查」一起遵守。
2. 实际打开并查看本包对应效果图：docs/mockups/approved-20260926/01-import-merge.png、07-split-files.png，并对照现有七步导航。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖包状态；未完成则按计划处理依赖，不得虚填真机出口。

本包范围：对应图01/07及现有七步导航。修改 wps-addin/ribbon.xml、main.js、src/taskpane.js，必要时 src/workflow-ui.js、dev/server.cjs 资源白名单；计划新增 src/ribbon-navigation.js、test/ribbon-navigation.test.cjs，扩展 test/ribbon-recovery.test.cjs、test/ui-workflow-check.cjs。若无需新模块便能清晰完成，保持现有文件边界并更新本包清单。
接口：复用 workflow.goTo(stage) -> boolean / current()，阶段只接受既有7个ID；openStage(stage) 只打开/聚焦侧栏并导航。若跨WPS页面需要传递请求，单次 {id,stage} 导航请求只消费一次，页面重建不能重播业务动作；不传材料内容。具体桥接用现有插件存储/宿主支持能力实测后确定，不新增常驻重载定时器。

执行步骤：
1. 测每个快捷入口只导航：确认/学习/写表/拆分调用计数均0；非法 stage 拒绝；侧栏未打开、已打开、重建三种状态请求不丢且不重复执行。
2. 测前置步骤未完成时可导航查看缺项提示，但不能绕过已有生成按钮的真实条件；恢复按钮原行为继续有效。
3. 增加与批准图含义一致的阶段入口，保持打开/手动重建入口可用；注册新脚本与静态白名单。
4. 运行 Ribbon 恢复/导航与 UI 测试；真机逐个点击核对应阶段，宽度下可用，不重跑导入或确认业务。
5. 留功能区及阶段定位真实截图，更新用户说明相关草稿、交接，提交推送。

出口：原R3入口缺项补齐，快捷导航不产生额外业务确认或副作用。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-K/ 新目录留真实截图/报告，摘要脱敏写入验收文档；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 12/14　R12-L　四项目复制件及R12结案

~~~text
【本会话只做 R12-L：四项目复制件及R12结案】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R12-L 一个工作包，完成后停止，不要开始 R13-A 及以后任何包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R12-L」一节，并连同其中「全局约束」「统一证据格式与提交检查」一起遵守。
2. 分两批实际打开全部8张效果图并逐项核对：docs/mockups/approved-20260926/01-import-merge.png、02-classification-result.png、03-sheet-review.png、04-category-workbooks.png、05a-summary-separated.png、05b-summary-combined.png、06-inquiry-linkage.png、07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R12-A 至 R12-K 通过；未通过项不得勾完成。

本包范围：依赖 A–K；对应全部8图（分两批）。文件：docs/wps-workflow-v3-acceptance.md、docs/wps-phase1-release-checklist.md、handoff.md；真实项目资料仅本机。

执行步骤：
1. 确认可用且已获准的四项目复制件路径和来源指纹；若没有，先完成其余出口，列明缺的项目，不以历史33表/7587条凑数，不擅取新的私有资料。
2. 每项目按新流程导入→选择合并→人工表内审核→整表确认→汇总→询价→拆分；真实材料分类未获人工确认不能由脚本全选通过。合成样例规则不硬套真实项目。
3. 逐项目记录：输入文件/工作表/行数；选择合并及合并后行数；类别/无需询价数；各询价对象材料/数量；询价页/拆分件数；成功/失败/待核对数；目录/关键SHA及截图索引。
4. 各供应商件按 R12-F 审计；公开文档只写脱敏汇总/证据定位，不上传清单、报价、真实联系人或运行数据。
5. 汇总8图核对表、双布局、不合并/全跳过、异常/恢复/链接/精度、四项目结果，全部出口均有对应证据，失败项无“部分通过当全部”表述。
6. 运行 R12 原定全量 Node 及6个主流程浏览器脚本（workflow、sheet-review、brand、inquiry、split、project；另按实际修改加 restore/ribbon）。只在有新修改/失败时重复已过检查。
7. 检查6个入场修改已在 B/D 正确完成并提交或明确仍未完成；有未验证代码/关键证据缺项即保持 R12 未完成，写下一修复包。满足全部条件才标 R12 完成。
8. 更新验收/清单/handoff，明确文件清单提交推送并核远程SHA；停止本包，R13 另包开始。

出口：R12全链路与四项目真实可复核；未具备环境/数据时如实挂账，不能宣布一期交付。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R12-L/ 新目录留真实截图/文件SHA/报告，摘要脱敏写入验收文档；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 13/14　R13-A　真实安装、升级回退与卸载重装

~~~text
【本会话只做 R13-A：真实安装、升级回退与卸载重装】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R13-A 一个工作包，完成后停止，不要开始 R13-B。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R13-A」一节，并连同其中「全局约束」「统一证据格式与提交检查」一起遵守。
2. 按需实际打开七步流程对应效果图，安装说明使用 R12 真实截图；如用于核对界面则打开 docs/mockups/approved-20260926/ 下对应图，只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R12-L 已完成；未完成不得开始本包。

本包范围：依赖 R12-L 完成。文件：wps-addin/install/install.ps1、wps-addin/install/start.ps1、wps-addin/install/uninstall.ps1、wps-addin/dev/register.ps1、wps-addin/test/install.test.cjs、test/register.test.cjs 及 docs/wps-workflow-v3-r13-evidence.md；不创建第二套安装器。

执行步骤：
1. 开包先核实际脚本路径和安装说明、当前注册/程序/数据目录；封存真实 publish.xml、旧程序目录与用户数据恢复点；备份含哈希，本机保存不入 Git。
2. 实际安装：仅按本插件 name/guid 匹配注册；验证同端口其他插件节点完全保留、服务仅 127.0.0.1、后台窗口隐藏；发布资源可加载且无探针/故障入口。
3. 重启 WPS，打开插件和已验收项目，核关键绑定/七阶段及恢复，不要求重新人工审核已确认项目。
4. 升级后核项目/分类库/模板/拆分回执未覆盖；注入可控安装失败后用旧程序与注册备份回退，验证旧版本能读取原数据。不能仅检查备份目录存在。
5. 卸载只移本插件注册/程序，默认保留用户数据；重装后上述数据可恢复，再按说明操作合成项目。
6. 运行 install/register/release 相关测试、真实生命周期记录与发布扫描；记录实际 WPS 版本，未测试版本不标支持。
7. 更新 R13 证据/handoff、按明确文件清单提交推送；安装/注册异常未闭环则不进入发布结案。

出口：安装→重启→开项目→升级→回退→卸载→重装的真实链路完整，恢复点可用。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R13-A/ 新目录留真实截图/哈希/报告，摘要脱敏写入 docs/wps-workflow-v3-r13-evidence.md；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
完成后停止，不要开始下一包。
~~~

---

## 14/14　R13-B　用户交接与发布范围核定

~~~text
【本会话只做 R13-B：用户交接与发布范围核定】
你是 F:\材料软件开发（WPS询价插件一期）的接续执行者。本次只做 R13-B 一个工作包，完成后停止，不再自行开启新包。

开工前必须完成（不得跳过）：
1. 完整读 F:\材料软件开发\handoff.md 全文，再读 F:\材料软件开发\AGENTS.md；本包唯一执行依据是 F:\材料软件开发\docs\superpowers\plans\2026-09-27-wps-phase1-completion.md 的「R13-B」一节，并连同其中「全局约束」「统一证据格式与提交检查」一起遵守。
2. 实际打开全部8张效果图（分两批）用于核对手册表述与真实截图：docs/mockups/approved-20260926/01-import-merge.png 至 07-split-files.png。只读文件名或文字说明不算看图。
3. 核对 Git 现场：git branch --show-current（应为 feat/wps-phase1）、git rev-parse HEAD、git log --oneline -5、git status --short。当前 HEAD 为 1be9271f698f409fbff73c17bff0c8ede06db75e，代码基线 e6f8ff2698a638b5d7492307e88ec851e723c148；工作区保留 6 个未提交修改，一律原样保留，禁止清理工作树或整体提交。
4. 确认依赖 R13-A 已完成；未完成不得开始本包。

本包范围：依赖 R13-A。文件：docs/wps-user-guide.md、docs/wps-install-guide.md、docs/wps-phase1-release-checklist.md、docs/wps-workflow-v3-r13-evidence.md、handoff.md；按扫描结果调整既有发布脚本，不引入本机配置。

执行步骤：
1. 用 R12 真实界面/截图更新7步操作，说明草稿与 xlsx 保存的区别、整表确认、三组双布局、名称链接、两生成方式、品牌改后重生成、待核对/失败续作及侧栏重建。
2. 至少一名用户按说明独立完成隔离合成项目，记录歧义和未通过步骤；只修已观察到的问题，修后复验受影响步骤。
3. 扫发布资源：包含依赖/路由/加载脚本，排除探针、故障注入、样本、outputs、本机配置；核唯一包版本、文件清单和安装包SHA。
4. 发布清单明确已实测 WPS 版本、已通过范围和限制；32类正式词表/迁入政策及另一 WPS 版本独立验证继续挂账，未经确认不自动迁入或声称兼容。
5. 交接文档核对全部链接、最新 Git/备份状态，提交推送并核远程SHA；合并 main 或正式发布按用户明确安排，不由完成计划自动触发。

出口：用户可按说明复现，发布包和证据可追溯，支持范围与未完成事项真实清楚。

收尾（严格按顺序）：
1) 跑完本包验证，失败先定位再最小修复，不为变绿盲删测试；
2) 在本机 outputs/wps-acceptance-20260927/R13-B/ 新目录留真实截图/哈希/报告，摘要脱敏写入 R13 证据文件；
3) 更新 handoff.md 的当前进度、待定事项、下一步；
4) git status --short 后只按明确文件清单 git add -- <本包文件…>，禁止 git add . / git add -A；git diff --cached --check 并审查完整暂存 diff；
5) git commit -m "本包具体改动"；git push origin feat/wps-phase1；用 git rev-parse HEAD 与 git ls-remote origin refs/heads/feat/wps-phase1 比对核远程SHA。TLS握手失败时再按 handoff 第7.2节对推送与 ls-remote 各尝试一次单次参数 git -c 'http.https://github.com/.proxy='（不改代理配置，不强推）。推送失败保留本地提交、记录待同步并如实说明。
本包完成后 R12–R13 计划内工作包即全部走完；如仍有未闭环项，在 handoff 中列明，不要自行扩包。
~~~
