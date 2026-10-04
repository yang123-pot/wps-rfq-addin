# R12 真实 WPS 验收记录（未完成）

最新接续：**2026-10-04 R12-L补验，C08已补齐，R12仍未结案。** root实际恢复草稿到新副本、显式保存绑定到版本5；WPS保存后仅物理SHA变化的误报经4文件最小修复，Node436/436、相关浏览器6/6＋最终两项复验通过。真实重开自动刷新版本6，第3步8/8且尚未人工确认、无差异横幅；独立51/51＋修复后33/33。C09–C13、K余项与四项目新流程未完；review=null、库revision0/来源0、无分类输出，R13不开始。前轮L和G–J证据按原日期保留，详见文末C08节。

最新接续：2026-09-30，**R12-G图05A→06→07真实出口通过**，项目revision24/拆分回执revision7。沿用确认8行和4分类簿2/2/2/1，固定组合未保存读回及四项抬头阻断真实有效；新总簿5询价页＋明确2内部页、全新目录5供应商件，完成5/失败0/待核对0。打印保存边界定位为WPS未初始化纸张；显式A4后横向/宽1页/高不限保存重开，5页实际预览各1页；隔离40行长特征件真实2页且重复表头。第七步主面板和打开目录两缺陷也已先红后绿并真实复验。6实际文件全部公开值/抬头/layout/来源对账及F双审计通过，公式0，供应商无内部/隐藏页列或意外内容；Node362/362、Python8/8及inquiry/workflow/split浏览器检查通过。截图67～75、77/78、80～82与最终文件/项目对应，23张旧误存截图仍撤销。原始证据留本机 `outputs/wps-acceptance-20260927/R12-G/`，详见[R12-G最终证据与6文件SHA清单](wps-workflow-v3-r12g-evidence-20260930.md)。本次到G停止，H及以后未开始，**R12整体仍未完成**；最终提交/远程核对以本机 `evidence/backup-receipt-r12g-final.json` 为准。以下9月27日状态为历史记录。

更新：2026-09-27 21:35（北京时间）。R12-A 接续从 `a63d0a26976cfca0732a14c3f9668314549cd25d`、`feat/wps-phase1` 开始，远程配置为 `yang123-pot/wps-rfq-addin`。最早的 20:41 记录从 `d7e6ad6e9ef9923d47937072d16548b3218f8e79` 开始，历史段落保留其发生时间。

本次操作者为 Codex：完整阅读 handoff/AGENTS、查看获批图03/04，核对现有截图、探针、项目文件和真实 xlsx；**本次没有成功读取或操作实时 WPS 窗口，也没有新增真机通过步骤**。以下历史真机结果来自本机 17:55–18:04 已有证据，文件审计在本次重新执行，不把旧操作写成本次操作。

## R12-A 现场保护与接续检查点（2026-09-27 21:35）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `a63d0a26976cfca0732a14c3f9668314549cd25d`（提示词记录的 `63dde1e9126df2b09fd51bf8c7b1db0ec93d9451` 已在其后追加一次仅文档提交 `a63d0a2`；handoff 记录的代码基线 `e6f8ff2` 未变）。本包只动文档，包提交为紧随 `a63d0a2` 的 `docs: R12-A…` 提交，远程 SHA 以推送结果为准。工作区仍保留 6 个入场修改且**未被本包暂存或清理**。

**对应图：** 图03（表内审核、整表一次确认）、图04（独立分类工作簿），本次实际打开查看。

### 1. 入场 6 个修改的接手包

| 文件 | 接手包 | 修改内容 |
| --- | --- | --- |
| `wps-addin/dev/export-files.cjs` | R12-B | 相邻暂存 `discard`／按 mtime 兜底清理陈旧点号暂存 |
| `wps-addin/dev/server.cjs` | R12-B | `/api/export/discard` 路由 |
| `wps-addin/src/import-ui.js` | R12-B | 生成失败/取消后清理本次暂存 |
| `wps-addin/test/export-files.test.cjs` | R12-B | discard／陈旧清理用例 |
| `wps-addin/src/export-host.js` | R12-D | 原生链接字体落地顺序与蓝系回读容差、预览草稿簿按 PluginStorage 找回 |
| `wps-addin/test/export-host.test.cjs` | R12-D | 链接样式与预览复用用例 |

6 个文件保持原样；R12-B 只处理其中 B 的 4 个，D 的 2 个留到 R12-D 通过后再提交。

### 2. Computer Use 与真实 WPS 窗口

- **结论：本会话仍无法读取真实 WPS 窗口，属环境阻塞。** `cua.getState()` 返回 `{"apps":[],"browsers":[],"errors":["Browsers: Error: unsupported Codex auth method: apikey"]}`，并抛出 `unsupported Codex auth method: apikey`；本会话暴露的 `cua` 只有浏览器方法（`getState`／`browsers`／`getBrowser`／`createBrowserTab`／`getTab`／`listBrowsers`／`listTabs`），没有 `listApps`／`getApp`／`computer`，即**原生窗口控制在本运行时不提供**。
- 未绕过授权边界，未重复索要用户已给出的授权；依赖窗口的动作（读取实际打开工作簿的未保存编辑）在 R12-A 不执行，独立源码包可继续。
- WPS 现场：版本 `12.1.0.29161`（`et.exe`/`wps.exe` FileVersion 一致）在运行，但当前只有 `2026-09-27-r12-r13-14-package-prompts.docx - WPS Office`，WPS 命令行中没有已打开的 xlsx；`r12/output/` 无 `~$` 锁文件。→ 没有待保护的未保存表内编辑，磁盘审核成果表即当前版本。

### 3. 现场保护与 SHA

保护副本写到本机 `outputs/wps-acceptance-20260927/R12-A/protected/`（**不改动、不删除、不重命名原成果**），清单与 SHA 见同目录 `../evidence/protection-manifest.json`，`allCopiesMatch=true`：

| 用途 | 源（原样保留） | SHA256 |
| --- | --- | --- |
| 审核成果表（图03） | `r12/output/示例园区_分类审核成果.xlsx` | `d9355c4be1a0b6dbfb315cc7e40b5cba2b6e8af0c38de02dfe52259f8e9ced5f` |
| 分类工作簿（图04） | `r12/output/分类工作簿/水泵.xlsx` | `8c99f43542fd566f96bc44e4a76e6318fe6a2da5daffe46c75192ff435403c48` |
| 分类工作簿（图04） | `r12/output/分类工作簿/阀门.xlsx` | `cfcc972f21d5c28fb31725845221f9d14587aa29c416f6bb089b5848955a9226` |
| 分类工作簿（图04） | `r12/output/分类工作簿/风机.xlsx` | `ca15ae2812c35bd28746a4efc486d835292e7bca5883c7ec3ad84805fdc82fa5` |
| 分类工作簿（图04） | `r12/output/分类工作簿/汽车充电桩.xlsx` | `50e9f1dd63b5f0708f32dbcf4aa5299073aaa528d4612854360ffee33b5d10a5` |
| 项目记录 | `r12/projects/p-mujmyjx0-16kom40i.json` | `4522a6716d871ae3a5eccd047060d40f2122302703d3cda69c1cc5fb87068231` |

审核成果表磁盘 SHA 仍是收据值，未发生“用户另存导致 SHA 改变”，因此不需要保留两个版本。

### 4. 磁盘核对：H11 与 rowId 绑定（只读）

脚本 `outputs/wps-acceptance-20260927/R12-A/audit-r12a.py`，结果 `../evidence/disk-audit-r12a.json`：

- 项目 `p-mujmyjx0-16kom40i` revision=6、schemaVersion=2；阶段 import/matching/review/categories=ready，brands/inquiry/split=missing；确认快照 `confirmedAt=2026-09-27T10:01:15.871Z`、inputKey `ck2-721d17bd7b34fb51`、8 行。
- **K11 rowId 与快照一致**：`["f:/材料软件开发/outputs/wps-acceptance-20260926/r12/inputs/机电清单.xlsx","机电安装",10]`，对应材料=充电桩配电箱/充电桩配套；8 行 rowId 绑定全部一致。
- **H11 磁盘为空，确认快照为“汽车充电桩”**：延续本条已有的磁盘/快照差异，不能把 SHA 一致解释为审核编辑已落盘。归 R12-C 做内容比较与恢复；R12-A **不重新确认、不重建、不覆盖**。

### 5. 4 个分类工作簿仍与记录快照一致（只读；未重新生成）

水泵2／阀门2／风机2／汽车充电桩1 行；公开 10 列顺序、材料逐值（名称/特征/单位/数量/rowId）、品牌与报价单价/金额为空均通过；公式数 0；4 文件 SHA 与项目记录逐份一致；`r12/output` 下无点号暂存残留。→ R12-A 的分类主路径输入可信，不重做已验收的分类文件生成。

### 6. 隔离服务

开工时 `http://127.0.0.1:38891/health` 连接被拒（未监听）。按 handoff 既有隔离参数以 probe 模式启动（**新文件名**，未覆盖 17:55–18:04 的 `report-20260927c.json` 与两个停摆存档）：`--report …/r12/evidence/report-20260927-r12a.json`、`--probe-output …/r12/probe-output-r12a.xlsx`、`--import-directory …/r12/imports`、`--library-directory …/r12/library`、`--project-directory …/r12/projects`、`--header-directory …/r12/headers`、`--split-directory …/r12/splits`。健康返回 `200 {"service":"wps-rfq-addin","version":"0.1.0","mode":"probe"}`，pid 30828；未导入生产库。

### 7. 回归与出口

- `node --test wps-addin/test/*.test.cjs` → **322/322 通过**（日志 `R12-A/evidence/node-r12a.log`）。仅证明工作区基线，不改源码、不代表真机通过。
- **现场是否可继续：** 可继续。旧证据未被覆盖，保护副本 SHA 全部一致，分类 4 簿输入可信。
- **唯一阻塞：** 真实 WPS 窗口控制在本运行时不可用（仅环境阻塞），因此**尚未新增任何真机通过**；图03 草稿/错误定位、图05–07、异常与四项目仍挂账。
- **下一包：** R12-B（收敛暂存清理与发布票据，改 `export-files.cjs`/`server.cjs`/`import-ui.js` 及对应测试，可先于真机独立完成）；其后 R12-C 处理本节第 4 条的 H11 草稿差异与内容恢复。

## R12-B 收敛暂存清理与发布票据（2026-09-27，源码包，未触碰真机）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `62b215421a6bfd6bae19913e8a00a0ab7ad44a7d`（R12-A 文档提交）。本包只改源码与测试，包提交为紧随 `62b2154` 的源码提交，远程 SHA 以推送结果为准。工作区**仍保留** `wps-addin/src/export-host.js`、`wps-addin/test/export-host.test.cjs` 两个 R12-D 修改，本包未暂存、未清理。

**对应图：** 图04（独立分类工作簿）、图05A（分类汇总表）、图07（一键拆分）。本次实际打开查看：成功成果（分类簿/汇总表/拆分件）不得被暂存清理破坏，已有文件不得覆盖。

### 1. 复现转失败测试（修改前实测 11 pass / 5 fail）

复现输入 `outputs/wps-plan-audit-20260927/reproductions.json`（副本与 SHA 见本机 `R12-B/reproductions.sha256.txt`，SHA256 `4866b86b469a236ff6f09b758294130194106787443bae2527aa98f344410353`）。新增用例先在入口版本上失败，失败原因是行为缺陷而非环境或拼写：

| 新用例 | 修改前失败现象 |
| --- | --- |
| `published discard preserves verification` | `discard` 先删票据再判已发布，`commit→discard→verify` 抛“另存会话已失效” |
| `stale sweep preserves active ticket` | 11 分钟 mtime 的有效暂存被按 mtime 删除（1 小时内票据所有权被 mtime 覆盖） |
| `busy discard keeps the in-flight stage` | 提交中的票据被 `discard` 删掉暂存，返回 `{discarded:true}` |
| `cleanup ... unowned same-name residue` | 无所有权证明的用户同名残留被直接删除 |
| export-server 用例 | HTTP 路由层复现“已发布票据 discard 后 verify 失败（400）” |

### 2. 修正内容

- `discard(ticket)` 改为结构化状态顺序：`unknown-ticket` → `already-published`（**保留票据**，`verify` 仍可用）→ `busy`（保留暂存）→ 仅清理未发布且不活跃的本次暂存；清理删不掉时返回 `{discarded:false,reason:'cleanup-failed'}`，**不虚报“文件已删除”**。
- 陈旧清理改为 `sweepStaleStages(parent,base,active)`：接收活跃路径集合；删除必须同时满足命名匹配、**本进程登记过所有权**、无活跃票据、足够陈旧。服务重启后内存登记丢失，同命名残留一律**保守保留并计数上报**（`prepare` 返回 `staleCleanup`），不再只按 10 分钟 mtime 删除。
- `commit` 已发布并校验后清理暂存失败只忽略，不影响成功回执；残留交陈旧清理兜底。
- 调用处复核：仅 `import-ui.js` 的两处相邻暂存（生成审核成果表、生成分类汇总表）调用 `discard`，均以 `prepared&&!published` 守卫；即使发布响应丢失，服务端票据已是 `already-published`，仍保留已发布成果。成功但回执/项目保存失败时 `published` 已置位，不会清理已发布文件。

### 3. 验证与证据

- `node --test wps-addin/test/export-files.test.cjs wps-addin/test/export-server.test.cjs` → **17 pass / 0 fail**。
- `node --test wps-addin/test/*.test.cjs` → **329 pass / 0 fail**（基线 322＋本包 7 例）。
- 负例保持拒绝覆盖：目标已存在、prepare 后被抢占（竞争创建）、prepare 后目录不可用的写入失败三例均拒绝且不产生半成品，用户同名文件内容不变。
- 原始命令/日志/SHA 在本机 `outputs/wps-acceptance-20260927/R12-B/`（`pre-fix-failing.log`、`export-files-after.log`、`node-full-after.log`、`README.md`），按 `.gitignore` 不入 Git。

### 4. 未完成与下一包

- **未做真机 WPS 操作**，本包不得勾选任何依赖真机的出口：宿主占用导致删不掉暂存、服务重启后残留的保守保留/报告、真实成果目录清理行为均**挂到 R12-J**（文件故障与恢复）。
- 未跑浏览器 UI 检查：本机无 `playwright` 模块（`MODULE_NOT_FOUND`），按计划并入 R12-L 全量回归。
- 入场 6 个修改中，`export-host.js` 与 `export-host.test.cjs`（预览簿恢复、链接字体顺序/回读容差）**保持未提交**，留给 R12-D。
- **下一包：** R12-C（图03 草稿、错误定位与内容恢复，含 H11“磁盘空/快照有汽车充电桩”差异）。

## R12-C 图03草稿、错误定位与内容恢复（2026-09-27，源码包，未触碰真机）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `678dc1bc0ec494ac46ff65095d8a71e89346ebd1`（R12-B 源码提交）。本包只改源码/测试与文档，包提交为紧随其后的 `fix/feat: R12-C…` 提交，远程 SHA 以推送结果为准。工作区**仍保留** `wps-addin/src/export-host.js`、`wps-addin/test/export-host.test.cjs` 两个 R12-D 修改，本包未暂存、未清理。

**对应图：** 图03（在表格中修改，整表一次确认），本次实际打开查看：浅黄“最终分类”下拉、主按钮“审核完成，生成分类工作簿”、辅助“保存审核成果”、空/未知分类定位到具体单元格。

**入口问题（R12-A 已核）：** 磁盘审核成果表 H11 为空、项目确认快照为“汽车充电桩”，两者 SHA 相同。旧审计只看 SHA，会把业务差异判成“内容已一致”，掩盖人工决定没有落盘。

### 1. 失败测试先行（修改前 7 例失败）

新增用例先在入口版本失败，失败原因是行为缺失而非环境或拼写：

| 新用例 | 修改前失败现象 |
| --- | --- |
| `R12-C比较：磁盘空分类与确认快照不一致必须报出` | `host.compareSnapshot is not a function` |
| `R12-C比较：按rowId比较，排序/筛选不影响` | 同上 |
| `R12-C比较：固定字段、备注、缺行与多余行都按rowId给出差异` | 同上 |
| `R12-C：按已保存快照重建成果副本` | `model.fromSnapshot is not a function` |
| `R12-C：SHA相同但业务内容与确认快照不同，不得恢复为已一致` | `audit.ok` 仍为 `true`（未识别业务差异） |
| `R12-C：业务一致但仅另存/格式变化，登记物理刷新` | `audit.ok` 为 `false`（把仅另存误判外部改写） |
| `R12-C：磁盘审核内容与确认快照不一致（workflow-v3 集成）` | `reviewHost.compareSnapshot is not a function` |

### 2. 修正内容

- `classification-review-host.js` 新增 `compareSnapshot(readResult,snapshot) -> {matches,differences,source,counts}`：按 `rowId` 比较固定字段（项目名称/规格/单位/工程量）、最终分类与审核备注；行序（排序/筛选）不影响结论；缺行/多余行单独报出。`readBack` 结果标注 `source`（`open`=同路径已打开簿 / `disk`=磁盘），保证优先读用户未保存修改。
- `classification-review-model.js` 新增 `fromSnapshot(snapshot,binding)`：把项目里保存的审核快照（确认或草稿）重建为可再次写入的成果表模型，用户可编辑两列取快照、编码/来源/自动建议等固定字段取绑定，不丢内部数据。
- `project-restore.js` `audit(project,checks)` 增加业务内容判定：`checks[].content` 为 `compareSnapshot` 结果。**SHA相同但业务不同** → `content-different`（附完整差异，区分“磁盘内容/打开簿内容”），`review` 不恢复 ready、不可靠换目录冒充一致；**业务一致但仅另存/格式导致 SHA 改变** → 不判外部改写，登记 `physicalRefresh` 供更新物理校验并写回；固定字段被改动仍按原规则拒绝。
- `project-ui.js`：重开项目时对审核成果表在 SHA 之外按业务内容核对（`compareReviewContent`，优先同路径已打开簿）；`content-different` 进 `blocks.review` 并在状态区列明双方；`physicalRefresh` 更新 `matching.sha256` 后写回项目记录。`commitReview/commitReviewDraft` 保存失败（含 409）**回滚内存中的确认/草稿**，不再出现“内存已确认、磁盘未保存”。
- `import-ui.js`：表内审核面板检测“现表 vs 项目已保存审核快照”的业务差异，命中时把横幅改为“成果表内容与已保存确认不一致”，并显示两个既有辅助动作：**“选用现表内容（按现表重新确认）”**（复用主流程整表确认）与**“恢复项目草稿到新副本”**（用 `fromSnapshot` 重建后经 prepare/write/commit/verify 写到**新副本**，绝不覆盖当前打开的簿）。不新增主流程确认阶段，仍为整表一次确认。
- `taskpane.html`：在表内审核面板补充上述两个按钮（默认隐藏，仅在发现业务差异时出现）。

### 3. 真实文件证据（本机 `outputs/wps-acceptance-20260927/R12-C/`，只读）

用**真实项目记录**（受保护副本 `R12-A/protected/p-mujmyjx0-16kom40i.json`，revision=6）与**真实磁盘审核成果表**（只读读出8行）跑实际比较与审计逻辑：

| 结论 | 值 |
| --- | --- |
| 磁盘审核成果表 SHA256 | `d9355c4be1a0b6dbfb315cc7e40b5cba2b6e8af0c38de02dfe52259f8e9ced5f` |
| 项目记录 matching.sha256 | `d9355c4be1a0b6dbfb315cc7e40b5cba2b6e8af0c38de02dfe52259f8e9ced5f`（SHA一致） |
| `compareSnapshot`（新） | `matches=false`，1 处差异：`充电桩配电箱` 最终分类 确认快照“汽车充电桩” / 现表“（空）” |
| `audit`（新，含业务内容） | `ok=false`，`blocks.review=审核成果表（磁盘内容）的业务内容与项目确认快照不一致…`，code `content-different`，不可重新定位 |
| `audit`（旧口径，仅 SHA） | `ok=true`（这正是本包修复的“SHA一致掩盖业务差异”） |

原始脚本与报告：`read-review-disk.py`（openpyxl 只读）、`compare-h11.cjs`、`review-disk-rows.json`、`h11-compare-report.json`。**未改动任何 xlsx、项目记录或分类工作簿。**

### 4. 回归与验证

- 新增/扩展用例：`classification-review-host.test.cjs`（3）、`classification-review-model.test.cjs`（1）、`project-restore-audit.test.cjs`（2）、`workflow-v3.test.cjs`（1）、新增 `project-ui-review-content.test.cjs`（4，用最小DOM/网络替身直接驱动 `project-ui.js`，覆盖：内容不同不 ready、仅另存刷新物理校验并写回、409 回滚确认/草稿、草稿保存不改 confirmedAt）。
- review/project 相关：`node --test`（model/host/project-restore/project-restore-audit/project-ui/workflow-v3）→ **41 pass / 0 fail**（日志 `node-review-project.log`）。
- 全量：`node --test wps-addin/test/*.test.cjs` → **340 pass / 0 fail**（R12-B 329 ＋ 本包 11，日志 `node-full.log`）。
- `test/ui-sheet-review-check.cjs`、`test/ui-project-restore-check.cjs` 已补 R12-C 断言（草稿不改确认/不学习、409 保留表内值与已存快照、内容差异提示与动作、restore 审计按业务内容阻断），但**本机无 playwright 模块**（`Cannot find module 'playwright'`，见 `ui-sheet-review-attempt.log`、`ui-project-restore-attempt.log`），两个脚本本次**未执行**；脚本已通过 `node --check`。

### 5. 未完成与下一包

- **未做真机 WPS 操作**，本包不得勾选任何依赖真机的出口：真机改分类/备注后点“保存审核成果”的 `draft` 落盘与 `confirmedAt`/学习/分类簿 SHA 不变、错误副本逐项定位、排序筛选读回8行、保存关闭重开草稿与确认检查点，均**挂 R12-J**（文件故障与恢复）或按 R12-L 全量回归；仅环境阻塞，尚未新增真机通过。
- 浏览器 UI 检查受本机缺 playwright 限制，未执行；源码已同步更新断言，待有浏览器运行时复跑。
- `export-host.js` 与 `export-host.test.cjs`（R12-D）保持未提交，留 R12-D。
- **下一包：** R12-D（汇总字体/下拉/原生链接/预览候选修复与双布局细节）。

## R12-D 汇总宿主与双布局（2026-09-27，真实宿主隔离COM + 源码包）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `cafc2a1d9539ed1be65cecad1b06bcc318e0201a`（R12-C）；工作区入场只剩 `wps-addin/src/export-host.js` 与其测试两项 R12-D 修改。完整证据见[R12-D证据](wps-workflow-v3-r12d-evidence-20260927.md)。

**对应图：** 图05A/05B（预览只看图01），开工前三张图均实际打开核对。

**真机结论（WPS 12.1.0.29161，独立隐藏 COM 实例，未触碰用户会话）：**

- B4 字体阻塞定性为**写入次序**：`Hyperlinks.Add` 会把锚点改写成宿主链接样式（Color 16711680／ColorIndex 5／下划线2）；字体放到链接之后落地后，保存重开读回 `Color=12673797`（获批 `#0563C1`）、`ColorIndex=23`、`Underline=2`，逐位一致，因此**不扩大容差**（删除了入场改动的“蓝色系”放行）。
- 下拉来源可可靠回读（宿主只归一化引号/等号）：真实文件 `J4:J7` 为 `分类汇总表!$M$1:$M$2`、同格 `G5:G8` 为 `$J$1:$J$2`；`Type=3` 不再单独放行，错区域/只剩类型都拒绝。
- 由插件真实模型生成并落到真实宿主的两个文件通过读回：分列 `分类汇总表.xlsx`（`A1:J1`＋四列跨行＋三组两列合并、黄色填写区、隐藏列11–13、打印区域、4行名称蓝色下划线相对链接），同格 `分类汇总表-同格.xlsx`（`A1:G1`＋`A2:G2`、单行表头、首数据行5、`D5:F8` 填写区）。**4个名称链接 `Follow()` 实际打开了对应的4个分类工作簿**；`openpyxl` 独立读回合并/下拉/链接/字体/填充全部一致。
- 证据边界：本会话 Computer Use 仍不可用，两个文件是按 `export-host` 同一操作顺序由隔离 COM 宿主生成，不是在插件界面点“生成”得到；`export-host` 自身由 Node 用例覆盖。截图 `evidence/screens/05a-separated-real.png`、`05b-combined-real.png`。

**回归：** 全量 Node **344/344** 通过（本包新增4项）。UI 检查 13/17：`ui-brand`、`ui-category`、`ui-memory`、`ui-sheet-review` 四项失败，失败信息为 R12-C 的“审核成果表磁盘内容与确认快照不一致”；已用隔离副本把 `export-host.js`/`brand-model.js` 换回 HEAD 复核，**同样失败，属 R12-C 遗留**，与 R12-D 无关，待后续包收口。

**未完成：** 插件UI内的正式填报生成与图05A→06→07链路留 R12-G/H；本包不动 `export-host` 以外的R12-E/F范围。下一包 R12-E。

## R12-E 拆分待核对状态与内容证明（2026-09-27，源码包，未触碰真机）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `822cd1f4d103feb35f3526455f711187d241ca4a`（R12-D），入场工作区干净；完整证据见[R12-E证据](wps-workflow-v3-r12e-evidence-20260927.md)。

**对应图：** 图07（开工前实际打开查看）。**入口缺陷：** `reconcile` 把 `pending` 文件的首次观察SHA写进 `file.sha256`，下一次核对 `actual===expected` 就提升成功——连续刷新/重启两次即可在没有任何内容核对的情况下凭空完成。

**修正：** 观察SHA（`observedSha256`）与经核对SHA（`sha256`）分开；`reconcile` 只标记待核对，成功只能由真实发布写回或显式内容核对（`mark(...,{proof})`）落地；旧回执无 `verifiedBy` 保守降为待核对；`prepare` 收紧 `inputKey`/总簿SHA绑定并新增 `canVerify`。新增 `export-host.verifyExistingOutput(app,file,expectedSheet,inspectTarget)`：只读打开实际文件，逐值核公开值、工作表数量、隐藏列范围、必需合并/抬头，并核核对前后SHA；UI 把待核对单列并提供“核对已有文件”，通过且来源键/SHA未变才用带 `expectedRevision` 的 `save` 记成功，409/失败保持待核对、原文件不覆盖。

**验证：** split plan/store/server **17/17**；全量 Node **356/356**（R12-D 344＋本包12）；`ui-split-check` **PASS**（本机 `NODE_PATH` 指向已有 playwright 模块＋系统 Edge，模拟宿主只替代WPS写入/打开接口）。证据在本机 `outputs/wps-acceptance-20260927/R12-E/`（日志、`split-blocked/verified/result.json`、模拟界面截图）。

**真实宿主补充（追加）：** 用隔离WPS（`workbooksAtStart=0`，未改用户会话）按 `export-host` 写入顺序生成真实供应商拆分文件并读回：8行×10列、6个多格合并逐值一致、无隐藏辅助列，`ok=true`；同名异内容件读回报 `F8 期望3 实际999`、`ok=false`。用真实文件SHA跑状态机：目标存在而回执pending时连续3次prepare与一次store重建都待核对、`done=false`；显式内容核对通过后才记 `content-check` 成功；重建后跳过；真实异内容覆盖后重新待核对。该轮还暴露并修复“单格合并`A5:A5`在真实WPS不生效被误判失败”的缺陷（`export-host` 跳过无意义单格合并，新增用例）。

**未完成：** 仍未做插件UI内点击的完整真机链路；真实“发布后未记账/响应丢失”的界面重试、外部改写后逐值核对的UI动作与真机清理**挂 R12-J**，插件UI内正式生成挂 R12-G/H。`ui-brand`/`ui-category`/`ui-memory`/`ui-sheet-review` 四项浏览器检查仍为 R12-C 遗留失败。R12 仍未完成；下一包 R12-F。

## 已核实的图03与图04证据

WPS 版本：12.1.0.29161。所有样本、截图、项目和审计 JSON 留在 `outputs/wps-acceptance-20260927/r12/`，不纳 Git。

| 验收点 | 结论与证据 |
| --- | --- |
| 10 行精确合并为 8 行 | 项目 `p-mujmyjx0-16kom40i.json`，revision=6、mergeIdentical=true；审核确认快照 8 行 |
| 充电桩配电箱表内改为汽车充电桩；钢索无需询价 | 已有截图 `evidence/shot-step3.jpg` 可见表内 H11 修改、钢索无需询价；确认快照记录对应类别，8 行中 7 一致/1 差异、1 无需询价 |
| 整表一次确认 | `report-20260927c.json` 有 `sheet-review-confirm` 点击及“整表已确认（8 行）”；项目 review.confirmedAt=2026-09-27T10:01:15.871Z（18:01 北京时间），revision=1 |
| “保存审核成果”只存草稿 | **未验收**。当前项目存在 reviewDraft，但它随确认落盘，不能证明曾单独点击草稿按钮且未确认/未学习 |
| 空分类/未知分类/损坏行定位 | **未验收**。现有探针没有足够真实失败及定位证据 |
| 4 个独立分类簿 | 已有 `evidence/10-step4-category-workbooks.jpg`；实际文件位于 `output/分类工作簿/`，均只有“材料明细”页 |
| 材料数、公开列和数量 | 本次只读审计通过：水泵2/阀门2/风机2/汽车充电桩1行；公开10列顺序符合图04；各行名称、特征、单位、数量、rowId 与确认快照逐值一致；钢索不在分类簿 |
| 品牌/报价单价/金额为空 | 本次对4文件的 G/I 范围逐行核查通过（G、H、I均为空）；公式数均0；K列隐藏rowId为内部分类簿约定，不作为对外拆分审计通过 |
| 文件回执 | 4分类簿及审核成果表共5文件的当前SHA都与项目记录一致，见下表 |

| 文件 | SHA256 |
| --- | --- |
| 示例园区_分类审核成果.xlsx | `d9355c4be1a0b6dbfb315cc7e40b5cba2b6e8af0c38de02dfe52259f8e9ced5f` |
| 水泵.xlsx | `8c99f43542fd566f96bc44e4a76e6318fe6a2da5daffe46c75192ff435403c48` |
| 阀门.xlsx | `cfcc972f21d5c28fb31725845221f9d14587aa29c416f6bb089b5848955a9226` |
| 风机.xlsx | `ca15ae2812c35bd28746a4efc486d835292e7bca5883c7ec3ad84805fdc82fa5` |
| 汽车充电桩.xlsx | `50e9f1dd63b5f0708f32dbcf4aa5299073aaa528d4612854360ffee33b5d10a5` |

审计脚本（只读）为本机 `audit-resume.py`，使用工作区依赖的 Python/openpyxl；结果 `evidence/file-audit-resume-20260927d.json` 保留表名、行列数、值、下拉区域、打印设置、隐藏列和SHA。没有修改原 xlsx 或项目记录。

## 当前阻塞与接续注意事项

- Computer Use 能列出真实 WPS 窗口“汽车充电桩.xlsx - WPS Office”，但 `sky.get_window` 返回 `Computer Use was not approved to use wps`。用户回复“已允许 WPS”后重试，刷新 node_repl 会话再试，仍为同一拒绝；本次未绕过该授权边界。
- `http://127.0.0.1:38891/health` 本次连接被拒，隔离服务当前未运行。未把这解释为旧认证/RPC或侧栏停帧原因，也未重复导入、重新确认或关闭WPS。
- **磁盘审核表 H11 为空，项目已确认快照中为“汽车充电桩”**。历史截图的表内编辑当时未保存到 xlsx；磁盘SHA仍匹配的是原生成文件。不得把“SHA一致”解释为审核编辑已经保存到磁盘。取得窗口控制后先核对并保护现有未保存编辑，再验证保存/关闭重开与项目绑定是否一致，不盲目重建或关闭成果簿。
- 图05当前没有成功汇总文件；已有探针最后报“分类汇总表字体颜色读回不一致：B4:B4”。入场时就存在的源码改动尝试调整链接字体落地顺序和蓝色容差，但没有本次真机通过证据。
- 遗留观察：本次 `output/` 递归扫描未发现点号相邻暂存文件，不能据此证明所有失败清理路径已修复；预览工作簿复用仍待真机验证。

## 入场时已有源码改动及本次验证

以下6文件在本次开始时已修改，保持原样且不并入本次文档提交：

- `wps-addin/dev/export-files.cjs`：discard及陈旧暂存清理。
- `wps-addin/dev/server.cjs`：discard API。
- `wps-addin/src/export-host.js`：预览簿恢复、原生链接字体顺序和回读容差。
- `wps-addin/src/import-ui.js`：失败时清理本次暂存。
- `wps-addin/test/export-files.test.cjs`、`wps-addin/test/export-host.test.cjs`：相应测试。

本次运行 `node --test wps-addin/test/export-files.test.cjs wps-addin/test/export-host.test.cjs`：**27/27通过**，完整日志 `evidence/host-tests-resume-20260927d.log`。仅证明当前工作区的相应模拟/文件测试通过，未做新一轮完整回归，不声称6文件修改已完成或已备份。

## 剩余验收清单

| 范围 | 状态 |
| --- | --- |
| 图03独立保存草稿、不学习不确认；空/未知分类和损坏行定位 | C源码/浏览器与J检查点恢复已有；独立真机草稿按钮、逐项定位、排序筛选/确认学习边界仍须补验 |
| 图05A/05B双布局、原生链接、逐值读回等价 | D适配及G分列、H同格隔离真实宿主已通过；L复核文件，H不能写成插件UI点按 |
| 图06抬头、5询价页、阀门20/12与多品牌、打印 | G真实主链、H同格/I不合并均有独立文件；L复核G/H双审计12/12 |
| 图07新目录5拆分文件、逐份状态、打开目录 | G真实通过；J追加用户真实鼠标点按七步与5件审计，点击者为用户 |
| 不合并10行来源边界及数量 | I隔离真实宿主链路通过，4分类簿4/2/2/1、9询价条、5件；不是本轮重跑 |
| 全无需询价 | I隔离真实宿主已通过：可确认保存、不生成空文件，不据此给真实项目缺行标跳过 |
| 取消/关闭、已有同名SHA不变、只读目录、第二份失败、服务重启、回执丢失、成功件丢失或外改 | J隔离真实异常/恢复矩阵21/21；J10浏览器/Node与后补真实停摆证据分开 |
| 公开输出逐值/无公式/无内部隐藏内容/无原价历史价审计 | F策略/负例、G/H实际总簿与供应商件双审计已有；L重新核对12文件全部逐值通过 |
| 长特征、前导零、小数、分页、保存关闭重开、整目录搬移链接 | G/I精度/打印与J关闭重开/中文空格搬移已有；L复核I/J25文件SHA一致 |
| 四项目复制件 | 用户本轮明确授权路径及已有人工记录；安全副本/指纹/只读对账已有，新流程完整执行与供应商审计仍未做 |
| 功能区阶段快捷入口 | 代码/测试已补齐（R12-K：7阶段入口只导航、非法拒绝、未打开/已打开/重建三种状态、无业务副作用），`ui-workflow-check` 与真实侧栏截图通过；**真实WPS功能区点按仍挂账**（本会话Computer Use仍无原生窗口） |

R12保持未完成，R13真实安装生命周期继续等待。下一包为另会话R12-L补验：先解决工具对et的实际拒绝，再补C/K及四项目出口；不复做已经完成的合成主成功路径。J人工点按项目已按用户决定作为历史存档，搬移后的旧路径不能当作当前可直接重开的项目。

## R12-J 异常、检查点恢复、目录搬移与停摆（2026-10-02，真实宿主隔离COM）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `c2bd7be58baf467148a779f5525e3490f71a6723`（R12-I）；本会话实际入场只有 1 个未提交修改 `wps-addin/dev/pane-diagnostics.js`（原样保留、未暂存）。完整证据见[R12-J证据](wps-workflow-v3-r12j-evidence-20261002.md)，本机证据在 `outputs/wps-acceptance-20260927/R12-J/`。

**对应图：** 图03–07（开工前按触发阶段实际打开）。**宿主：** 隔离隐藏 WPS 12.1.0.29161，`Workbooks` 开工 0，未触碰用户会话。

**结果：** 异常/恢复矩阵 **21/21 项全部有结果、0 失败**（`evidence/run-report.json`），覆盖：取消/关闭（6次）、目标已存在/竞争创建/只读目录、分类与拆分各注入第二份写入失败并只重试未完成、发布前中断/发布后响应丢失/回执409与真实写失败/服务停止重启、删除与外改已成功件、总簿或品牌键过期停止拆分、R12-B暂存只清本次可安全清理文件、五个恢复检查点逐个重启核真实内容、项目/库/抬头409与服务重启、原输入SHA不变与用户打开的簿不被关闭/宏安全值恢复、关闭重开逐类链接、中文空格路径整树搬移后重定位、目标已打开/同名诱饵/目标缺失、侧栏出帧与重建/预览检查。4 张真实窗口截图在 `R12-J/screens/`。

**产品源码改动（很小）：** 异常都由隔离目录/隔离服务上的真实运行触发，主流程未发现缺陷。只做两处必要改动：新增浏览器检查 `wps-addin/test/ui-cancel-check.cjs`；**只读目录补强**——`dev/export-files.cjs` 在 `prepare` 阶段先探测目标目录可写（只建/删隐藏探测文件，不写目标），只读目录在“写第一份”之前就被拒绝。补强先写失败用例（`export-files.test.cjs` 改前 `Missing expected rejection`）再最小实现；端到端 J3c 由“逐份失败”变为“预检即拒绝 4 份、写入 0、回执 pending、目录内用户文件SHA不变”。

**回归：** 全量 Node **371/371**、Python **8/8**；浏览器 `ui-*` 检查 **17/17 PASS**（含本轮修好的 `ui-sheet-review`/`ui-memory`/`ui-category`——属夹具过期而非产品缺陷，按 R12-C 新语义修夹具、断言一条未删）。

**插件UI内点按（同日追加，半自动）：** 用户授权 Computer Use 后实测——注入输入可驱动 WPS **原生**界面（功能区选项卡、单元格点选），但**CEF 侧栏不响应注入点击**（6 次点击+滚轮+Tab 均无反应；期间用户也反馈"侧栏卡死"，按第10项流程封存后重建恢复，封存物在 `R12-J/evidence/stall-20261002-1/`）。改走**半自动**：用户用真实鼠标点侧栏、我用 Computer Use 逐步观察并**独立核对磁盘文件**，七步全部走通（导入 10 行 → 合并 8 行 → 审核成果表 9 列 8 行且冲突行留空 → 整表确认＋4 分类簿 2/2/2/1 → 汇总表 4 名称链接/下拉/读回 4 类预计 5 份 → 总询价簿 5 询价页（阀门 20/12 品牌通达/海岳、两水泵页各 2 行、公式 0、报价金额空白）→ 拆分 5 完成/0 失败）。5 个供应商文件逐值审计 **0 问题**（单页可见、无隐藏列/页、公式 0、与总簿逐值一致、无路径/原价/历史价、抬头联系方式仅获批位置）。归档在 `R12-J/evidence/ui-clickthrough/`。口径：**点击者是用户，不是我**。

**真机缺陷与修复（同日追加）：** UI 点按暴露"最终分类"下拉失效——磁盘 XML 为 `<formula1>"内部选项'!$B$2:$B$7"</formula1>`（字面量列表），下拉只有一项乱码文本且**手打被"不符合限制条件"拦住**。根因：跨表来源写成 `='内部选项'!…`（表名带单引号），经 WPS **JSA 通道**保存成字面量；此前验收为绕开 COM 桥限制改用原生 PowerShell 步骤落版式，**从未覆盖这条真实通道**。修复 `src/export-host.js`：简单表名不加引号、含空格/特殊字符才按公式语法加引号（并同步修正 2 处写死的旧断言、新增 1 个用例）。修复后重建侧栏重新生成，磁盘 XML 为 `分类汇总表!$M$1:$M$2`，下拉选项 `合成一份`/`按品牌分别生成` 正常；失效样本留档 `R12-J/evidence/defect-dropdown-20261002/`。全量 Node **372/372**。

**未完成（如实挂账）：** 功能区阶段快捷入口留 R12-K；四项目复制件、另一WPS版本、32类词表政策留 R12-L/待定；C/D/E/H/I 早前的隔离链路结论不变，不用它替代 UI 点按。旧停摆存档、原输入件与已完成输出均未覆盖（用户桌面上的本次真实产物按原样复制归档，未移动未改名）。下一包 R12-K。

## R12-K 功能区阶段快捷入口（2026-10-03，源码/测试包，未触碰真机）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `7d33032f77260cc6ef29533ac28ecaece7d6c65e`（R12-J 文档提交）；本会话入场只有 1 个未提交修改 `wps-addin/dev/pane-diagnostics.js`（原样保留、未暂存）。完整证据见[R12-K证据](wps-workflow-v3-r12k-evidence-20261003.md)，本机证据在 `outputs/wps-acceptance-20260927/R12-K/`。

**对应图：** 图01、图07 及现有七步导航（开工前实际打开）。图01/07 的功能区“项目询价”选项卡均为七个阶段入口，侧栏为同一七步导航。

**改动：** 功能区新增“阶段导航”分组，7 个大按钮（`rfqStageImport…rfqStageSplit`，`tag` 为既有7个阶段ID，`onAction="OnGotoStage"`），原“侧栏”分组的打开询价助手、侧栏停住时重建入口保留（且不依赖新脚本）；新增 `src/ribbon-navigation.js` 导航桥（只传 `{id,stage}`），`main.js` 增 `OnGotoStage`，`workflow-ui.js` 在侧栏创建后消费导航请求，`taskpane.html`/`dev/server.cjs` 注册新脚本与白名单。桥接复用共享 `Application.PluginStorage`：未打开时请求留待侧栏打开消费，已打开时低频“导航请求检查”接力（只读一个存储键、不重载页面、隐藏时暂停），每请求只消费一次，重建不重播；不触发确认/学习/写表/拆分。

**验证：** `test/ribbon-navigation.test.cjs` 新增 11 项、`test/ribbon-recovery.test.cjs` 扩充 7 项（含“未加载导航脚本时打开/重建仍可用”），`node --test test/*.test.cjs` **390/390**；`ui-workflow-check` **PASS**（扩充段验证真实侧栏消费七阶段请求、非法阶段丢弃、副作用计数为0、重建不重播），17 个 `ui-*` 检查 **17/17**；Python 审计 **8/8**。真实插件页面截图（含320px窄宽）在 `R12-K/screens/`。

**未完成（如实挂账）：** **未在真实WPS功能区点按**——本会话 Computer Use 仍无原生窗口（`apps:[]`，`unsupported Codex auth method: apikey`），真机逐个点击与功能区真实截图待有窗口控制时执行；运行中的 `dev/server.cjs` 在本包改动前启动，需重启服务并在 WPS 重载加载项后快捷入口才出现在**已运行**会话。七步入口共用同一图标，与获批图多图标美术有视觉差额。下一包 R12-L。


## R12-L 四项目复制件与R12出口核查（2026-10-03，未结案）

**结论：R12保持未完成，一期未交付。** 本轮完成可执行的资料准备、只读证据核查和规定回归；四项目新流程与C/K独立真机出口没有齐备，不能把部分出口通过写成全部通过。本会话到L停止，R13-A及以后未执行。唯一执行依据为已批准计划的R12-L、全局约束及统一证据格式。

### 现场、授权与保护

操作者Codex；实际入口分支为 `feat/wps-phase1`，HEAD `0953da2c4cf163ac5738f658cca1c8e5c18dbb7b`，最新5提交为0953da2/4b89954/7d33032/998f13a/4f6393b。提示词63dde1e及代码基线e6f8ff26为历史快照。已完整分段阅读最新handoff，再读AGENTS及计划指定三节；8张批准图按01/02/03/04、05A/05B/06/07两批实际打开，文件指纹与批准清单一致。

本轮只有1项入场M `wps-addin/dev/pane-diagnostics.js`，工作树CRLF、索引LF，规范化内容与HEAD相同；原字节SHA与入场记录一致，原样保留、不暂存。历史6个修改已分别在B提交678dc1b（export-files/server/import-ui/export-files测试）、D提交822cd1f（export-host及测试）完成收敛，均是当前HEAD祖先；本轮六文件规范化内容均与HEAD一致。J后续JSA下拉修复也在当前HEAD内，不再把历史6文件列成未验证未提交。

用户本轮明确授权本机四项目目录，并确认“已有人工分类确认记录”；限定使用该处4份输入及4份人工文件，未取新私有资料。8原件已建立逐字节安全副本，读取前/提取后/收尾SHA及副本SHA一致。完整路径、工作表、原始行坐标和全SHA仅本机 `R12-L/evidence/four-projects/file-manifest-private.json`、`R12-L/evidence/four-projects/source-preservation-check.json`；3份OOXML与5份BIFF/OLE的真实格式已核对。

WPS版本12.1.0.29161来自et.exe文件版本。Computer Use本轮可列应用，但启动et返回 `Computer Use was not approved to use et`；用户确认允许WPS表格后重试、重建工具会话再试仍拒绝，共3次。未用其它入口绕过该拒绝，未重启/重建用户WPS，未修改宿主配置，本轮没有新真机截图或四项目业务输出。证据在 `R12-L/evidence/environment.json`。

### A–K依赖和8图逐项核对

| 依赖 | 核查结果与限制 |
| --- | --- |
| A | 6受保护文件SHA仍一致，接续检查点保留；现场保护通过，不表示新增真机 |
| B | 暂存所有权/发布票据修改与329项日志已提交；异常真实出口由J补证 |
| C | 340项及真实H11内容差异证据有效；独立真机草稿按钮、逐项错误定位、排序筛选读全8行、确认幂等/学习边界仍缺，**不能勾全完成** |
| D | 双布局、6真实文件指纹及4名称链接Follow/字体精确值已有；旧浏览器夹具失败在J收敛，本轮六脚本全过 |
| E | 真供应商正确/异内容件与待核对状态机证据有效；不把观察SHA当成功，不把待核对自行提升成功 |
| F | 完整清单supplier/internal-total策略、污染负例和实际文件审计有效；本轮对G/H逐值复验12/12 |
| G | 分列汇总→总簿→5拆分、打印/来源数量证据有效；总簿及5件SHA、F双审计重新通过 |
| H | 同格等价/4链接、14步、总簿及5件有效；隔离宿主版式步骤不冒充插件UI点击 |
| I | 不合并/全跳过/精度长文本打印14步有效，13文件SHA一致；未硬套真实项目类别与跳过规则 |
| J | 21项矩阵及12基准文件SHA一致；追加用户点按5件/真实停摆封存证据有效，点击者为用户；当前已归档项目旧路径不能直接恢复 |
| K | 390项、七阶段请求与页面截图有效；真实新版功能区七按钮点按及窗口截图仍缺，**不能勾全完成** |

截图索引以 `R12-L/evidence/screen-index.json` 为准：9份既有真实截图逐字节副本，其中8份选用于8图。全部是历史运行截图，本轮只读查看，非本轮四项目截图。图02最初取的内部绑定页截图已撤销作为对应证据，保留局限并改选实际查看的8行公开成果截图；视窗裁切列结合真实文件审计，不声称单截图完整证明所有行为。

| 图 | 批准验收点 | 本轮对应的既有截图与文件证据 | 当前判断 |
| --- | --- | --- | --- |
| 01 | 输入/映射/明确合并选择、10→8预览与来源 | screens/inherited-01.jpg；早前导入与J用户点按链 | 合成主例已有；四项目明确选择与新导入待验 |
| 02 | 公开审核成果9列、8行，冲突最终分类留空 | screens/inherited-02-public.jpg；成果文件/绑定审计 | 既有公开成果有效；历史内部页截图不证明版式 |
| 03 | 成果表内审核、整表一次确认、草稿/定位 | screens/inherited-03.jpg；C内容比较、J用户整表确认 | 主成功已有；C独立负例/幂等学习边界未齐 |
| 04 | 独立分类簿、一类一簿、品牌报价金额空白 | screens/inherited-04.jpg；既有4分类簿2/2/2/1及指纹 | 合成确认快照有效；四项目最终类别及无需询价待核 |
| 05A | 分列三组品牌供应商、名称链接/方式读回 | screens/inherited-05A.jpg；G汇总、4链接、下游F清单 | G真实通过；四项目汇总来源尚缺 |
| 05B | 同格两行、与分列逐值等价、链接与读回 | screens/inherited-05B.png；H等价报告/4链接 | H隔离宿主通过；不是本轮或UI点按 |
| 06 | 四项抬头、公开10列、组合数量、空价金额、打印 | screens/inherited-06.jpg；G/H总簿逐值双审计、G/I分页 | 合成材料/数量/版式有效；四项目对象数量/抬头待核 |
| 07 | 新目录、逐份状态/重试/打开目录、纯值拆分 | screens/inherited-07.png；G/H各5件双审计及J异常/用户链 | 合成与异常已有；四项目供应商件未生成未审计 |

功能区七阶段按钮的真实点按缺项同时影响图01/07的完整出口；本轮workflow浏览器请求检查不能代替K真机。

既有文字差异在本节更正：H的12个填写格是6个已填两行加6个空格、行高24pt，并非12格都填两行；I不合并风机页有2材料行（含6行表头总8行），旧“一行”文字有误；J旧证据表12个SHA前缀已过期，实际12文件与本机base-tree登记均一致，应以本轮重算全SHA为准；J10属于浏览器/Node侧栏检查，原生CEF停摆另见 `R12-J/evidence/stall-20261002-1/`。J已归档项目有路径差异，不能用历史成功件证明当前项目可以直接续跑。

### 四项目真实复制件对账（只读准备，未运行新流程）

| 脱敏项目 | 输入表/材料行 | 人工表/有效候选行 | 有材料类别页 | 四字段存在相同候选 | 无精确候选 | 一对一唯一对应 | 跨类别候选输入行 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 / 263 | 21 / 200 | 20 | 192 | 71 | 192 | 0 |
| 2 | 22 / 3143 | 47 / 1741 | 46 | 1258 | 1885 | 1248 | 6 |
| 3 | 1 / 1473 | 44 / 1735 | 43 | 1132 | 341 | 1127 | 1 |
| 4 | 8 / 2708 | 56 / 1865 | 53 | 1518 | 1190 | 1394 | 11 |

上述表/行由本轮8份复制件重新提取并经当前parser计算；合计恰为33表/7587行，**不是沿用历史数字，更不是四项目全链通过**。四字段为名称、完整特征、单位、规范工程量，4100行只说明存在同内容人工候选，不证明稳定来源绑定。项目4重复输入能提供独立人工行的容量为1480，不能把1518当逐行来源证明；项目1人工编码为数值，编码/前导零仍待核。

缺精确候选3487行保留本机逐行坐标；其中名称/完整特征/单位同且类别唯一的19/1523/261/808行仍未核数量与来源，不算通过。人工文件异常候选0/4/19/31行、重复与跨类别候选也保留原内容，未按脚本全选确认或写分类库。已存在的人工确认记录不被否定，但不能据此补造新流程整表确认。BIFF读取只提供缓存值，公式数记不可用；openpyxl对WMF的只读提示未引发另存，原件及副本字节均未变。

每项目所需下游字段仍逐项挂账：明确合并选择与实际合并后行数、最终类别数/无需询价数、各询价对象材料及数量、四项抬头、品牌供应商分组/生成方式、询价页/拆分件数、成功/失败/待核对数。均记**未执行或待核对（null）**，不能写“0失败”当通过。20/46/43/53类别页仅是人工文件现状，缺行不能自动算无需询价；材料特征里的品牌文字不当汇总来源。当前打包词表未收录类别页20/46/43/51仅表示兼容政策待定，不代表人工记录无效，不硬套合成4类规则。

逐项目目录、源/副本全SHA、输入各表行数及缺行/冲突/数量候选坐标留本机 `R12-L/evidence/four-projects/`；`summary-sanitized.json`供摘要，`project-N-reconciliation-private.json`供人工复核。新流程截图索引为空，供应商输出F审计未执行，`R12-L/evidence/package-report.json`为各阶段缺项登记。公开仓库不上传清单、报价、联系人、真实类别/材料详情或运行数据。

### 本轮验证与提交检查

| 实际命令/检查 | 结果 | 本机证据 |
| --- | --- | --- |
| node --test wps-addin/test/*.test.cjs | 390通过，0失败/取消/跳过/todo，退出0 | logs/node-all.log |
| node wps-addin/test/ui-workflow-check.cjs | 通过，退出0 | logs/ui-workflow.log |
| node wps-addin/test/ui-sheet-review-check.cjs | 通过，退出0 | logs/ui-sheet-review.log |
| node wps-addin/test/ui-brand-check.cjs | 通过，退出0 | logs/ui-brand.log |
| node wps-addin/test/ui-inquiry-check.cjs | 通过，退出0 | logs/ui-inquiry.log |
| node wps-addin/test/ui-split-check.cjs | 通过，退出0 | logs/ui-split.log |
| node wps-addin/test/ui-project-check.cjs | 通过，退出0 | logs/ui-project.log |
| bundled Python audit-existing-evidence.py（调用当前Python/Node F审计器） | G/H 12实际文件均value-verified，SHA与登记一致且审计前后未变；I/J25文件SHA一致 | logs/existing-evidence-recheck.log、evidence/recheck/、evidence/existing-evidence-recheck.json |

浏览器运行用本机已有Playwright与Edge，真实插件页面/服务，WPS写入/打开接口为模拟；不称新真机。验证开始/结束、实际命令、退出值在evidence/browser-results.json、evidence/verification-results.json；本包未改产品源码，ribbon/恢复模型包含全量Node与workflow，不另复跑restore/ribbon浏览器。已过检查未无故重复。

G/H复审总簿采用internal-total、10个供应商件采用supplier，完整预期清单和实际文件逐格核对；公式0、供应商无内部/隐藏页列/追溯/原价历史价或意外内容。允许抬头联系方式仍须位置和值完全相符。G项目revision24、H25，询价内容键均ck2-14a15fd175309425；不把内部总簿要求套在供应商件或只扫关键词。I/J指纹核查不是新运行异常矩阵。

下一修复/补验包为**另会话R12-L补验**：先解决et实际工具拒绝，补C独立草稿/错误定位/排序筛选/确认学习边界与K七按钮真机，再由人工确认四项目来源/分类/数量差异及合并选择、品牌供应商/方式/抬头，按新流程逐项目记录全部出口并逐供应商件F审计。缺未验证代码或关键证据时继续保持R12未完成；R13另包且须等待R12满足全部条件。

本包仅3个公开文件：本验收文档、wps-phase1-release-checklist.md、handoff.md。按明确清单暂存，检查cached diff并审查完整内容后提交推送；最终提交/远程SHA及入场文件保护结果留本机 `R12-L/backup-receipt.json`，只有实际推送成功和远程SHA相等才报告同步，不强推、不修改代理配置。所有R12-L私有证据留忽略目录。

## R12-L补验（2026-10-03，进行中）

**R12仍未完成。** 本轮入口为 `feat/wps-phase1`@`80392a12b8c05b2a98a9d79b85d8d0d8e817335f`，证据另存本机 `outputs/wps-acceptance-20261003/R12-L-supplement/`，保留前轮L及G–J有效证据。用户已同意真实鼠标配合，并保存空白入口簿保护副本后重开WPS。当前可读取和点击实际 `wps.exe` 表格窗口；前轮et授权拒绝属于历史，不能继续当作当前错误。

当前补验进度（10-04）：C01–C07已有分项实机证据，C05/C06新业务click缺口仍挂账；C08恢复新副本、显式项目保存及WPS保存后关闭重开已补。仅草稿SHA误报最小修复后真实自动刷新版本6，第3步8/8、尚未人工确认、无差异横幅；独立51/51＋33/33，review=null/学习0/无分类输出。C09–C13未执行，下一项真人整表确认与习惯保存失败重试；C/K及四项目全链仍未完成。详细范围和既存边界见本节末尾。

### 功能区图标最小修复及回归

七阶段原共用询价图标，本轮仅调整 `main.js:GetRfqImage`，按控件ID返回六个新增本地静态SVG及既有询价SVG；服务增加六条明确资源白名单，补资源映射、路由和发布包含测试。`OnGotoStage`、导航桥、ribbon.xml及业务流程保持原内容。相关四文件测试先红34通过/4预期失败，再绿38/38；全量Node **394/394**，失败/取消/跳过/todo均0。指定workflow、sheet-review、brand、inquiry、split、project及追加restore共 **7/7** 浏览器脚本退出0，宿主接口仍为模拟，不能代替真机。

真实WPS 12.1.0.29161已经显示七个不同图标和阶段标签，截图 `screens/k-ribbon-seven-icons.jpg`；当前服务七个图标资源均HTTP200。工具点“自动分类”后，侧栏仍显示第1步，报告帧数21停止增长；已封存 `evidence/stall-20261003-1/` 并请用户做真实鼠标点击核对。**七按钮导航、未打开/已打开/重建三态及窄宽出口尚未通过**，不因图标显示就勾K完成。隔离磁盘基线为0项目、库revision0、0学习来源，见 `c-preparation/evidence/disk-k-entry.json`。

### C独立小样及四项目待决准备

独立8行小样已由实际xlsx只读提取，再经当前parser/collection/review模型核验：8材料、0解析问题、1冲突、1无需询价，数量顺序逐值一致；H4:H11为最终分类、I4:I11为备注、K4:K11为随行ID，充电桩H10留空。证据 `c-preparation/evidence/preflight.json`。这只是准备验证，尚未创建真实项目确认或学习来源，C草稿/定位/排序筛选/幂等学习出口仍挂账。

四项目8原件/安全副本与前轮来源SHA全部相同；重新只读核201表/186476格与既有矩阵一致，1093数量组经Python Decimal独立复算一致。缺四字段精确候选3487行中，三字段同且类别唯一2611行：所在完整组总量相等2080行，不等531行；另有跨类70行、无三字段候选806行。**总量相等仅为算术证据，仍不证明逐行来源或人工确认。** 含重复容量等因素的待核输入行3626，不自动标无需询价。

已准备本机 `four-projects/四项目业务待决填写.xlsx`，6页覆盖项目选择、7587材料决定、1093数量组、5541人工依据、162类别品牌决定及说明。保存后编码/完整特征/工程量均保留，人工决定字段全部空白，六页预览已查看；独立验证退出0，见 `four-projects/verification-report.json`。合并/布局、最终类别/无需询价、人工来源与量差、品牌供应商/方式、四项抬头仍需用户决定，四项目新流程输出/成功失败数仍为未执行（null）。全部私有明细、填写簿及真实路径只留忽略目录。

本轮公开改动清单为图标相关11文件及验收/发布清单/交接3文件；入场 `pane-diagnostics.js` SHA仍为 `e9a76e21546142907d65f1c158f6cc4138a69bcf44f950e84edaa6ac914d8e91`，原样保留、不暂存。先审查并备份已完成图标修复，继续补C/K真机及四项目人工缺口；R13不开始、不合并main、不发布。提交推送及远程SHA以本机补验备份回执为准。

图标修复与准备记录14文件已普通推送，提交 `6a8e159bcbd052263303c953243b9cb4d63e1924` 与远程逐位相同；cached check退出0、完整diff已审查，工作区仅保留入场pane修改。回执 `evidence/backup-receipt-icons.json`，固定证据SHA索引 `evidence/artifact-index-icons-and-preparation.json`。

### 用户真实点击无响应与服务恢复（2026-10-03追加）

用户已明确反馈真实鼠标点顶部“自动分类”未切换第2步，随后点“侧栏停住时重建”也无反应。Codex新观察实际WPS窗口右侧为空白，点内置JS调试入口后也未观察到调试窗口。仅据这些现象不判定导航控件解析或跨页存储缺陷。

11:48（北京时间）核实38891无监听、原隔离服务进程已不存在；此前报告最后心跳为09:53:27，早于此次用户反馈，不能用于证明这次点击是否进入回调。11:50恢复同一隔离数据目录的服务，`/health`返回probe；新报告另存 `evidence/pane-report-recovery-20261003-115047.json`，保留旧报告。现有probe输出文件保留，自动探针的“目标已存在”检查会阻止重写，不把它计为导航无写入证据。服务停止原因仍未知。

只读磁盘审计 `c-preparation/evidence/disk-recovery-entry-20261003-115x.json` 对照 `disk-k-entry.json`：仍0项目、库revision0、0学习来源；这是磁盘状态，不能证明打开簿的未保存单元格或实际点击者。恢复回执及用户反馈分别为 `evidence/service-recovery-current.json`、`evidence/recovery-user-results.json`，截图 `evidence/wps-recovery-before-reopen.jpg`。下一步由用户重开已保存入口簿，取得新paneSession/当前receivedAt后，再核回调、两导航键、侧栏当前阶段和出帧；C/K与R12仍未通过，产品导航代码未改。

本机 `evidence/nav-probe/` 已准备独立只读诊断入口，**未启动、未用于WPS实机**。它复用真实 `createServer`，仅向三个HTML入口注入诊断：功能区记录原回调的进入/返回/异常、已知控件标量与导航模块就绪，两页只读 `rfq.nav.request/consumed`，侧栏读取当前DOM阶段；移除启动页的自动工作簿探针。产品源码及受保护pane文件未改。根独立运行 `verification.cjs` 退出0、16项检查通过，真实临时HTTP服务核57静态资源与磁盘逐字节相同，并验证原回调this/参数/结果/异常保持、观察器存储写入和宿主动作0、临时五目录内容不变；日志 `evidence/nav-probe/_verification-2026-10-03T04-05-25-075Z-1f2b9f/verification.log`。这些诊断验证仍为临时HTTP/模拟接口，不能证明实际WPS回调已执行。当前先等待原恢复服务下的用户重开结果，再决定是否启用该诊断入口。

### 恢复侧栏后再次核验（2026-10-03追加）

用户提供的真实WPS截图显示“入口保护.xlsx”侧栏恢复第1步、已连接WPS、0导入行。新报告12:30:52～53（北京时间）记录javascript/ribbon/taskpane启动成功，paneSession `68a943de2c22ef69`；现有工作簿探针因目标已存在拒绝写入。工具12:34点顶部“自动分类”后真实截图仍第1步；用户随后明确反馈真实鼠标再点仍第1步，并补充侧栏目前卡死。两种点击者分别记录，不混用。

固定100项快照 `evidence/stall-20261003-2/pane-report-before-next-user-click.json` 保留：网页12:30:59失焦后，rAF探针仍从frame3推进到12:31:56的frame21；12:31:59首次pending3005ms，12:32:05报告stalled，之后JS心跳持续，快照末12:35:20仍frame21/pending204000ms。无重新focus、visibilitychange或resume，scriptError为空。**hasFocus是网页焦点，frameCount是探针回调计数；不能据此认定原生窗口失焦、正常节流、全部绘制停止或整个JS冻结。** 挂起早于工具点击，不能写成点击触发。现有探针尚无导航入口/存储/DOM阶段字段，断点未确定。

用户原截图、工具点击后截图和检查点分别保存在同目录 `user-restored-pane.png`、`wps-tool-matching-no-change.jpg`、`checkpoint.json`。只读审计 `c-preparation/evidence/disk-k-restored-native-click-20261003.json` 退出0：仍0项目/库revision0/0学习来源，输入及库SHA不变；无旧分类件或确认可比较，不把空映射当幂等证据。只读诊断准备最终由根再验18项/57资产通过，回执 `evidence/backup-receipt-nav-preparation.json`。

真实点击失败后再次固定报告 `pane-report-user-real-click-stalled.json`、用户反馈 `user-real-click-result.json` 及无遮挡原生截图 `wps-user-real-click-stage1-foreground.jpg`。该报告网页12:45:50、12:46:38重新focus，随后wheel/click/keydown可进入并上报，但frameCount仍21、未resumed、无scriptError；末条12:46:56 JS heartbeat，rAF pending900006ms。这不能支持“重新focus即可恢复”，也仍不能定位顶部回调。

12:47:37核PID34676命令行、端口38891及同一隔离五目录归属后，仅停止该自有服务，启动 `nav-probe/launcher.cjs`（PID38976）。健康响应成功，启动页/侧栏HTML均有观察器，启动页无自动工作簿探针；受保护pane SHA仍为入场值，未改产品源码。回执 `nav-probe/service-current.json`、`current-stdout.log`，新报告目标 `navigation-report-2026-10-03T04-47-38-062Z.json`。已请求用户保留其它未保存内容，关闭已保存空白入口簿、重开WPS加载新观察器并点“自动分类”。

用户随后答“已重开，切到第2步”。固定 `nav-probe/user-matching-success-report.json`：12:50:41 ribbon ready，navReady=true、getItem/setItem均function；12:50:44.482 OnGotoStage进入，1个object参数，Id=`rfqStageMatching`、Tag=`matching`（其余大小写字段undefined）；.502返回true，请求ID `nav-murwyxli-r1a48bg9`；.840 pane ready已消费同ID、请求为空、currentStage=matching，后续两页状态一致。原生截图 `user-matching-success-wps.jpg` 显示第2步，真人反馈单列 `user-matching-success-result.json`。这证明本次重开后导航桥实际接力成功，不证明旧卡死根因已修复或其余六入口稳定。

12:52:40工具点顶部“表内审核”未记录到新回调，随后状态截图混入其它窗口；暂停注入输入，不能据此认定产品按钮失败。独立只读审计 `c-preparation/evidence/disk-nav-diagnostic-start-20261003.json` 仍0项目/库revision0/0学习来源，输入及库SHA相同，保护pane SHA相同；该审计不覆盖未保存簿或页面状态。

用户真实点“表内审核”后明确答“仍显示第二步且侧栏已卡死”。固定 `user-review-consumed-screen-stalled-report.json` 中review的object控件Id/Tag正确，OnGotoStage返回true，两页consumed相同请求ID、pane currentStage=review，而原生画面及用户反馈仍matching；反馈单列 `user-review-consumed-screen-stalled-result.json`。本次断点为DOM状态与可见画面不同步；rAF挂起而JS仍运行，不能据此进一步断定GPU、宿主节流或具体机制。

用户真实点“侧栏停住时重建”、确认后答恢复可操作。固定 `user-reload-restored-report.json`：12:56:54.390 OnReloadRfqPane进入，55.770返回true，56.112新pane navSession ready、currentStage=import、request为空、consumed保留旧ID，56.127新paneSession `ed48acbd33751820`；未重放旧review请求。真人反馈单列 `user-reload-restored-result.json`。这是当前已实现恢复路径的真实成功，不是新增源码修复，也不证明后续不再停帧；已请求真人依次点七顶部入口，对照逐项DOM/画面。K/C、四项目及R12仍未通过。

用户随后反馈七个顶部入口均对应切换。固定 `user-seven-visible-success-report.json` 中12:59:44.778～58.195七次OnGotoStage分别为import/matching/review/categories/brands/inquiry/split，控件Id/Tag逐项正确、均返回true；七个不同请求ID随后被消费，pane DOM阶段逐项对应，未触发业务主按钮。真人可见反馈单列 `user-seven-visible-success-result.json`，完整滚动报告采样在 `seven-entry-snapshots-2026-10-03T04-59-03-619Z.jsonl`（两分钟59次，只读源报告、仅写新本机证据文件）。这补足该重建会话七按钮的真人导航，不能代替三态、窄宽及未保存业务内容保护验收。新页后续rAF心跳未在当前固定报告保留，不能由导航心跳推断绘制稳定性；已请求真人距最后导航超过两分钟后import→关闭侧栏→brands复开，结果待答。

独立复核七请求消费状态各顺序出现一次、未见旧ID回跳（没有直接计数consume调用）。新pane保留事件已frame57→61，12:59:58.421 scroll事件为frame61/pending0/sinceLast2281ms，证明重建后当时rAF已越过旧21计数；不是所有新页都按此前模式挂起。服务报告优先淘汰心跳，缺pane-heartbeat不能推断未运行。导航后只读审计 `disk-k-seven-hidden-reopen-20261003.json` 仍0项目、库revision0、0学习来源，输入及库SHA不变，不能证明未保存内容或长期绘制。

用户反馈停留后的第1步切换正常，关闭侧栏后重新打开到第5步；反馈 `user-idle-hidden-reopen-success-result.json`，当前原生侧栏显示05品牌汇总，报告两页consumed一致、DOM=brands。固定报告 `user-idle-hidden-reopen-success-report.json` 留存的是后续100条（13:05:41～09:46），该次入口及关闭回调已滚动淘汰，故不能称全链trace；不以当前DOM替代关闭动作证据。已请求真人调窄侧栏、回第1步并保留画面，用原生截图检验步骤换行及主按钮。原先绘制不同步仍留档，单次恢复/数分钟后导航成功不等于长期稳定性已修；C与四项目尚未新执行。

窄栏补验用户反馈步骤及主按钮完整，但原生 `user-narrow-wps-observed.jpg` 仍第7步，顶部七步导航未进入该画面；当次复制的旧报告仍brands、末receivedAt13:09:46，不是当前现场。因此窄栏所需第1步图及精确CSS宽度均不计通过。13:19独立核实PID38976不存在、38891无监听、health连接拒绝、stderr为空，最后报告写入13:09:47；退出原因未知，回执 `nav-probe/second-service-exit.json`。确认端口空后13:19:58同一测试入口及五隔离目录启动PID37452，health成功，日志由更新的 `nav-probe/service-current.json` 指向。未改产品源码，新诊断令牌不同于旧页，需重新加载当前观察器再继续；旧静态报告不证明此次回调。七入口既有真人成功证据保留，K/C与R12仍未收口。

### 当前窄栏与C入口缺陷（2026-10-03追加）

root通过Computer Use打开已保存入口簿并重建侧栏，13:35:38新paneSession为`eadac314d28bf8a8`、navSession为`nav-pane-murykom2-nwigckzm11`。本次实际滚动至第1步顶部及导入按钮区，七步骤5+2换行，两个导入主按钮完整可见，工具点击浏览按钮实际打开选择器。证据为`nav-probe/root-current-import-narrow-{navigation,buttons}.jpg`及配对报告。固定报告只有pane角色，不据此补推Ribbon回调；实际CSS320未测，也不证明长期绘制稳定。与此前真人七入口/窄栏反馈分别记点击者。

root只导入本次独立8行源，默认分别保留、自动分类、通过插件生成`out/A/C审核A.xlsx`；生成与打开审核仍显示“内部绑定”，手动切到公开审核页后，H10下拉实看仅一条`内部选项!$B$2:$B$7`文本。旧簿SHA为`2b4a5d28993984b0d7f35d4ff382dba1a0591d5a9dced4331e776a513a73a3c9`，磁盘验证来源为双引号字面量，保留故障簿及两处真实截图。项目通过实际“保存项目”写成`p-murytt8g-b1dgbi43` revision1。独立只读审计28/28：原件/导入复制件指纹一致，9个公开表头、8行固定字段/文本工程量、K隐藏唯一ID及来源绑定正确；H10空、H11无需询价，review/reviewDraft/分类输出均null，库revision0/0学习来源。审计在`evidence/c00-current-native-baseline-audit.{json,md}`，各时点截图/磁盘报告在`c-preparation/evidence/`。生成后未手动保存审核簿、未改分类或执行整表确认/学习。

最小修复两个产品文件：`classification-review-host.js`在首次打开/复用时激活公开审核页、缺页明确失败；`export-host.js`先创建并写齐所有页，再逐页激活并应用版式，确保设置审核下拉时选项页已存在、冻结锚点落在正确活动页。历史J的去单引号修复只实证汇总同页区域下拉，不能作为当前审核跨表下拉已恢复的证明。两内部页仍可见；巨大行高与隐藏K长ID换行的关系仅为待隔离核实风险，本次未扩大源码修复。

TDD保留选页9通过/6预期失败、跨表依赖29通过/1预期失败及活动页负例；绿色后根独立全量**404/404**，失败/取消/跳过/todo均0；相关sheet-review/restore/category/brand/inquiry/split浏览器**6/6**。全量一度403/404，唯一失败为过期category宿主夹具缺Worksheet.Activate，补齐状态和冻结页断言后通过；同样补齐summary夹具，未放宽业务断言。六源码/测试文件独立代码审查通过（相关65/65）。日志、RED/GREEN回执及根验证记录均留本机`c-preparation/evidence/`，浏览器为真实页面/服务＋模拟宿主，不能替代修复后WPS核验。

服务当前提供两个修复脚本HTTP200、no-store且与磁盘SHA一致；工具重载未观察到提示或新pane ready，原生侧栏为空白、报告仍旧session，因此**修复后真机未计通过**，已请求真人重建。下一步重载后打开上述项目并生成新审核副本，核公开页/实际六项下拉/冻结，再继续C草稿与错误定位。当前只读对比确认输入、故障审核簿、库及保护pane SHA不变；未做真人确认/学习。公开暂存仅六源码/测试文件及三状态文档，私有证据不上传；C/K、四项目及R12继续未完成。

### 原始Ribbon回调恢复与C00–C04真机补验（2026-10-03追加）

两个入口修复已提交`d90613d76aada210880f95119e1d09adcf38f64b`并普通推送，远程SHA一致，回执`nav-probe/backup-receipt-c-entry-fix-20261003.json`。本段没有再次修改产品源码或重跑已过404项回归，主要操作与证据如下。

root先用WPS原生“另存为”保护两个未保存簿，保存成独立会话保护副本；原审核故障件及项目版本1保留。原生关闭/重开后只读核对三簿可读且SHA、输入、项目及库均未改变，`c-preparation/evidence/session-protection-audit-20261003.json` **10/10**。重开后的Ribbon诊断心跳正常，但root点击打开及真人反馈“仍无侧栏”没有取得可操作侧栏；滚动报告无入口记录不能证明回调没有执行。

18:42核自有服务身份后受控停止PID37452，启动本机`nav-probe/launcher-plain-ribbon.cjs` PID38992，继续同五隔离目录。它服务原始Ribbon回调，不加导航回调包装，仍保留既有侧栏观察器并过滤自动工作簿探针；HTTP200且原始主脚本存在、包装/自动探针缺席。第二次原生重开后root“打开询价助手”已能显示侧栏，“侧栏停住时重建”实际弹出确认并取得新页面，证据`c00-plain-ribbon-{open-restored,rebuild-confirm}-20261003.jpg`。该对照支持诊断包装可能影响WPS回调，**不确定停摆根因**；首个新页仍出现一段rAF暂停，root重建后继续操作。当前paneSession `ec59d58e375281cb`；旧`pane-report-live.json`不用于本段现场。

root通过实际侧栏打开版本1项目`p-murytt8g-b1dgbi43`，生成**新件**`out/A/C审核A_修复.xlsx`，旧`C审核A.xlsx`不覆盖。首次生成自动打开到公开“分类审核成果”，root刻意切内部页后点“打开成果表审核”也回公开页；H10实际下拉显示无需询价/水泵/阀门/风机/汽车充电桩/强电六项，前三行冻结。真实截图为`c00-fixed-review-{public-active,reopen-public-active,six-dropdown-options}-20261003.jpg`。新件SHA `33c7755b2ceed0b8280ccc42d89704b279c2cd3507cefca4443cb43e8d8e57bf`，磁盘validations为真实区域`内部选项!$B$2:$B$7`、H4:H11；root另点“保存项目”才保存新绑定为revision2。

**C01由root工具执行**：H10录入合法分类汽车充电桩、I10为`C-草稿未保存`，不点WPS保存，点侧栏“保存审核成果”。下拉popup的工具鼠标点击被窗口归属检查拒绝后取消，合法分类改用原生键盘录入；不把它记为成功点下拉选项。当前服务报告记录`sheet-review-save` click及“8 / 8 行已填，尚未确认、未学习、未生成分类工作簿”，项目revision3、draft8行/filled8，按rowId固定字段/分类/备注正确；磁盘H10/I10仍空、审核SHA不变，review=null、分类输出0，库revision0/0学习来源。配对截图`c01-{unsaved-classification-note,save-draft-click-result,all-eight-rows-draft-status}-20261003.jpg`及当前报告，磁盘`disk-c01-unsaved-draft-root-click-20261003.json`。

只读范围审计`fixed-review-c01-scope-audit-20261003.json` **24/24**。边界：新件磁盘activeSheet仍“内部绑定”，插件打开激活公开页且不保存；首次审计误把持久活动页变化作为要求，23/24报告原样保留并说明，不能声称直接从资源管理器打开也默认公开页。磁盘行高仍84/240pt，与隐藏长ID换行的关系未隔离，本段未修。Native截图与磁盘审计分别证明其范围，不混称完整版式验收。

**C02由真人确认**：root临时清空H4后，用户明确反馈整表主按钮提示第4行H列分类为空；报告记录实际失败文字，root点问题“定位到H单元格”并取得公开页H4选中及“已定位”提示，再恢复水泵。截图`c02-human-empty-category-h4-located-20261003.jpg`，当前报告`c02-human-empty-category-pane-report-20261003.json`，磁盘`disk-c02-human-empty-rejected-20261003.json`：仍revision3、旧draft8/8不改、review=null、学习0/无分类簿、输入与库SHA不变；拒绝审计13/13。首张C02截图有Codex遮挡，只用后续无遮挡定位图作为格位置证据。

**C03由真人确认**：WPS接受H4临时值`C未知类别`，用户反馈“提示最终分类无效”；当前报告记录11:09:56.811Z确认click及“不在当前分类库里，请用下拉重新选择”。root点击问题定位，公开页H4选中及定位提示与真实未知值同框；随后恢复水泵。证据`c03-human-unknown-category-{rejected,h4-located}-20261003.jpg`、`c03-human-unknown-category-pane-report-20261003.json`、`disk-c03-human-unknown-rejected-20261003.json`。项目字节/版本3/原草稿、审核磁盘、库及输入均不变，review仍null/分类输出0。只读范围审计13/13；首次审计误把提示中的“库里”预期为“库中”，11/13旧报告保留，修正文本范围后通过，不计为产品错误。仅原生单元格编辑与真人失败确认，未执行成功确认或学习。

**C04由真人确认**：root只将K4标识复制到K5，用户反馈“提示第5行 K 列行标识重复”，并提供实际WPS截图。报告记录11:20:45.756Z确认click及“2处待修改”：K5与K4同一标识、原水泵DN65材料行缺失。root点“定位到K单元格”选中公开页K5，随后Ctrl+Z恢复原标识尾号5，公式栏截图核对。证据`c04-human-{duplicate-id-pane-report,feedback}-20261003.json`、用户原图`c04-human-attached-duplicate-id-20261003.png`、`c04-human-duplicate-id-k5-located-20261003.jpg`、`c04-k5-original-id-restored-20261003.jpg`；磁盘`disk-c04-human-duplicate-rejected-20261003.json`及拒绝审计13/13。项目/草稿/库/输入/审核磁盘保持C01基线，无成功确认、学习或分类输出。准备时一次名称框复制误粘字面量K5已撤销，重新复制正确K4后才进行本次确认，不冒充第一次粘贴成功。

上述段落截至C04完成时：当时C05仅准备清空K4、待真人点击，K5及H4已恢复；后续进度见下段。C00–C04状态文档提交`bf725fc0502a83261206afdbb5cfed25dfd04449`已普通推送并核远程SHA。

### C05缺失标识、C06固定字段负例与报告缺口（2026-10-03追加）

**C05由真人确认**：root临时清空K4后，用户反馈第4行K列缺少行标识，并提供实际WPS原图`c05-human-attached-missing-id-20261003.png`；画面还显示水泵/DN50材料行缺失。root点问题定位到公开页K4，再Ctrl+Z恢复原标识尾号4。拒绝、定位及恢复截图为`c05-human-missing-id-{rejected,k4-located}-20261003.jpg`、`c05-k4-original-id-restored-20261003.jpg`，真人反馈单独封存。`disk-c05-human-missing-rejected-20261003.json`及`c05-native-rejection-disk-audit-20261003.json` **10/10仅磁盘通过**：项目字节/revision3/原draft、库revision0/来源0、输入及审核磁盘SHA不变，review=null、无分类输出。

**C06工程量由真人确认**：E4临时从2改为999，用户反馈第4行E列工程量原2、现999；root点击问题定位E4，再Ctrl+Z恢复2。三张实际截图`c06-quantity-{human-rejected,e4-located,e4-restored}-20261003.jpg`记录拒绝、选格及恢复值；`disk-c06-quantity-human-rejected-20261003.json`和`c06-quantity-native-rejection-disk-audit-20261003.json` **10/10仅磁盘通过**，上述项目/草稿/确认/库/输入/审核磁盘边界均保持C01基线。未保存测试值，也未执行成功确认或学习。

**C06名称由真人确认**：B4临时从水泵改为`水泵_C错误`，用户反馈第4行B列固定字段改动及原/现名称；root点击问题定位B4，再恢复水泵，真实名称框/公式栏核对。三张截图`c06-name-{human-rejected,b4-located,b4-restored}-20261003.jpg`与`c06-name-human-feedback-20261003.json`分别记录真人确认和root准备/定位/恢复；`disk-c06-name-human-rejected-20261003.json`及`c06-name-native-rejection-disk-audit-20261003.json` **10/10仅磁盘通过**，保持C01基线，未WPS保存、成功确认或学习。工程量反馈也独立封存为`c06-quantity-human-feedback-20261003.json`，两个反馈的clickTimestamp均为null。

**报告范围限制**：C05封存的`c05-human-missing-id-pane-report-20261003.json`仍只有旧C04信息，不证明C05的新click或结果；C06工程量/名称也没有封存到相应新业务click。不猜点击时间，不把三份10项磁盘审计写成此前13项“磁盘＋当前pane事件”审计。真人点击者由用户反馈证明，拒绝/定位/恢复由真实画面证明；磁盘审计只证明其保存时点的文件状态。

19:56–19:58（11:56–11:58Z）只读检查发现服务PID38992不存在、127.0.0.1:38891无监听。退出时间/原因未知，不能据此倒推C05点击时服务已退出。报告保留100条且心跳可被丢弃/重写的规则可以解释心跳缺席，**不能解释新业务click缺失**。root于20:05:02.92（12:05:02.92Z）受控启动原`nav-probe/launcher-plain-ribbon.cjs` PID13640，沿用同五隔离目录；监听进程归属13640及HTTP200已核，新报告`plain-ribbon-report-2026-10-03T12-05-02-896Z.json`。首次ownership回执误查不存在的`/ribbon.js`得到false，实际入口为`/main.js`；原回执保留，另存`nav-probe/plain-restart-script-correction-20261003-2002.json`修正检查，不计为产品脚本缺失。该检查时旧侧栏尚未重建，后续接入见下段；长期稳定性未结案。

C05及两项C06临时改动均已恢复，保留C01未保存的H10分类/I10草稿备注。C/K、四项目及R12继续未完成，R13不开始。

**新会话接入及C07准备**：root工具点原“侧栏停住时重建”并确认，实际新侧栏显示，截图`c07-service-rebuild-confirm-20261003.jpg`、`c07-new-pane-visible-20261003.jpg`。随后在辅助区打开唯一项目`p-murytt8g-b1dgbi43`版本3，实际恢复8/8草稿，回第3步及仍有未保存编辑的审核簿；截图`c07-reopened-project-native-unsaved-20261003.jpg`。封存报告`c07-new-session-reopen-pane-report-20261003.json`记录新paneSession `6f5b822ca7198922`、真实心跳至20:18:27（12:18:27Z），PID13640仍监听；**本次新会话接入已核，不代表长期稳定性通过**。

C07排序前的准备时点：root拖选A3:L11，包含隐藏K行标识和额外空L列；自定义排序子窗口工具激活失败，当时请求真人选择“序号”降序、含标题并确定。该时点尚未计排序/筛选全表读回通过，后续结果如下。

### C07排序筛选全表草稿读回（2026-10-03追加）

**排序/筛选由真人完成，保存草稿由root执行。** 用户实际按序号降序8→1，再只筛项目名称水泵2条，反馈`c07-human-{sort,filter}-feedback-20261003.json`分别留存；root实际截图复核，`c07-human-descending-visible-20261003.jpg`显示降序，`c07-human-filter-two-pumps-visible-20261003.jpg`显示两条水泵。随后root实际点侧栏“保存审核成果”，截图`c07-filtered-root-draft-eight-20261003.jpg`显示8/8草稿提示。未点WPS保存，也未成功整表确认。

独立只读`audit-c07-sorted-filtered-draft.py`对比C01基线及`disk-c07-filtered-draft-root-save-20261003.json`，`c07-sorted-filtered-draft-audit-20261003.json` **25/25通过**：draft全部8行、rowId集合及唯一性保持，按rowId的序号/名称/特征/单位/工程量、最终分类和备注均不变，保存后的列表顺序8→1；不是只保存筛选可见的2行。唯一项目`p-murytt8g-b1dgbi43` revision3→4，savedAt为20:34:24.954（12:34:24.954Z），draft8/filled8，binding/inputKey保持；review=null、无分类输出，库revision0/学习来源0，原件/导入副本/当前审核簿SHA及下游记录不变。审计前后输入证据字节不变。

同次新封存报告`c07-filtered-root-save-pane-report-20261003.json`由独立只读审计核得 **8/8通过**，结果`c07-independent-pane-save-audit-20261003.json`：新paneSession `6f5b822ca7198922`于20:34:24.927（12:34:24.927Z）记录`sheet-review-save` click，20:34:27.055记录“审核草稿已保存（8 / 8 行已填），尚未确认、未学习、未生成分类工作簿。”，项目由版本3到4，未见scriptError。没有借用旧C04 click。**磁盘只证明草稿保存及其内容/顺序；真人排序筛选和root点击由各自反馈、实际画面及新报告分别证明。** 磁盘审核xlsx未另存，不能把草稿顺序视为该xlsx的持久排序。

**取消筛选/升序恢复已完成**：root CtrlShiftL取消筛选，实际图`c07-filter-cancelled-visible-20261003.jpg`留存。随后A3选区CtrlShiftEnd两次无响应、没有变值；转请真人通过名称框选择A3:K11、按序号升序并含标题恢复原顺序。用户已反馈“已恢复升序，第一行水泵 DN50”，独立封存`c07-human-ascending-feedback-20261003.json`；root实际核顶部序号1–6升序、首行水泵DN50/工程量2，PageDown核物理10/11行为序号7充电桩配电箱/汽车充电桩、8钢索/无需询价，图为`c07-human-ascending-restored-{top,bottom}-20261003.jpg`。C07该协议已补，升序是当前未保存画面；草稿未再次保存，revision4持久快照仍8→1，不称已保存升序。root另封存`disk-c07-after-ascending-restored-20261003.json`，比较项目仍版本4、库/输入/确认不变；五个trackedFiles现取SHA与上述审计一致，该复核不扩大25/25的范围。

**C07收尾时的下一项（历史）**：当时C08尚未执行，版本4持久草稿仍8→1；后续C08实际结果以下节为准，不再把“尚未执行”作为当前状态。

C07收尾备份（历史）：较早状态`7b74b478f2a9691a35f86486cc99a627f7f9dfcc`保留历史；C07最新状态`31c25d954c57efa34900b8e5e84e361be84f050d`已普通推送且远程SHA一致，回执`nav-probe/backup-receipt-c07-native-20261003.json`。当时只审查三文档，产品源码及受保护pane未改、未重跑404项回归。当前C08改动、回归与备份以下节为准；私有证据仅本机。

### C08草稿恢复新副本、显式绑定保存与仅物理变化重开（2026-10-03～04，已补齐）

**root工具执行，未进行成功整表确认或学习。** root关闭本C审核簿且在WPS保存询问选“不保存”，重开确切项目`p-murytt8g-b1dgbi43`版本4，在第3步实际看到项目草稿与打开成果有业务差异，恢复到新副本`out/A/C草稿恢复.xlsx`，旧件保留。图为`c08-close-owned-review-save-prompt-20261003.jpg`、`c08-owned-review-closed-without-save-20261003.jpg`、`c08-reopened-draft-divergence-native-20261003.jpg`、`c08-restored-new-copy-native-20261003.jpg`。差异横幅不在pane字段中，由同次真实画面证明；v4重开报告仅保留本次generic BUTTON选择事件，不借用旧open-project click。

新paneSession `6f5b822ca7198922`于21:01:10.929（13:01:10.929Z）记录`sheet-review-restore-copy` click，21:07:06.509记录未覆盖原成果的新副本提示。`disk-c08-restored-before-project-save-20261003.json`于21:07:26仍版本4/旧绑定；root再于21:08:12.374实际点`save-project`，21:08:15.055报告版本5，随后21:08:16磁盘新绑定已保存。已有独立磁盘审计before **30/30**、after **36/36**：新簿全部8行按rowId固定字段/分类/备注一致，持久顺序8→1；旧件H10/I10仍空、SHA不变。项目草稿仍保持旧来源路径，不用它代替已保存的新matching路径。

root随后WPS保存新簿，SHA从`dddaec11f1d74845641693e59cc5582f386ddd7cdfab48cc92ac6c9ba00662e3`变为`2c96581e142b6089781108699945e07a9181e2db6763ef8874c474c2db4dd0b1`，8行业务与草稿逐值一致，公开审核页成为磁盘活动页，行高4–11均84。10-04实际重开版本5仍误报“外部修改”；同时原生画面停在“正在打开项目”，DOM已到版本5，另封存出帧不同步证据后重建。**仅草稿SHA误报与CEF出帧停摆分别记录，不把本修复宣称为停摆根因修复。** 独立`c08-independent-pane-disk-audit-20261004T051132100612Z.json` **51/51**核时序、冻结快照与当前实际xlsx/保护SHA；既有30/36计数经完整核对，未声称今天重跑当时磁盘审计。

最小修复4文件：`import-ui.js`恢复callback接入草稿业务比较，存在确认时优先确认、无确认时比较已保存草稿，并增加读回行标识/固定字段的结构guard；复用既有项目物理刷新机制。`project-ui.js`和`project-restore.js`各仅改1处提示，使文字涵盖已保存审核内容，未新增物理刷新逻辑；新增`import-ui-review-restore.test.cjs`直接驱动实际恢复callback，覆盖draft-only、内容差异、空/无效分类、缺失/重复ID、固定字段变化与确认优先。先保留预期失败再修复，最终新增测试 **32/32**，root独立全量 **436/436**（失败/取消/跳过/todo均0）；project/restore/sheet-review/memory/category/workflow浏览器 **6/6**，最终restore/sheet-review两项复验通过，宿主仍为模拟；代码审查无本次待修P1/P2。日志均在本机`c-preparation/evidence/c08-*20261004.log`，不代替下述WPS实机。

**修复后真实出口通过。** root重建加载最终代码，新paneSession `3ead0c32523e6e86`实际打开列表版本5；插件按8行草稿业务一致自动保存物理刷新到**版本6**，真实提示“审核成果表仅另存/格式变化，业务内容与已保存审核内容一致，物理校验已更新”。随后root从第2步点“打开成果表审核”，第3步真实显示8行/已填8/与建议不同1/无需询价1/可以整表确认，尚未人工确认且无差异横幅；公开恢复簿仍8→1，充电桩物理第5行H5=汽车充电桩、I5为草稿备注。真实图及配对报告为`c08-fixed-project-reopen-v6-native-20261004.png`、`c08-fixed-project-reopen-v6-pane-report-20261004.json`、`c08-fixed-review-stage3-native-20261004.png`、`c08-fixed-review-stage3-pane-report-20261004.json`。

独立只读`c08-independent-fixed-reopen-audit-20261004T051606381927Z.json` **33/33**对比`disk-c08-resume-before-reopen-20261004.json`与`disk-c08-fixed-reopen-v6-20261004.json`：仅项目revision/SHA和matching.sha256变化，matching其余字段、draft全对象、review=null、阶段和下游记录均不变；版本6项目与实际磁盘一致，新绑定SHA为`2c96581e…`。库仍revision0/来源0、分类输出0，旧审核/原件/导入副本及入场pane SHA不变。C08只完成上述恢复/物理变化重开，**C09–C13未执行**，下一项45秒只读库锁下的真人整表确认与锁释放后的真人习惯保存重试；R12整体仍未完成，R13不开始。

**既存边界另挂账。** 行高84及可见内部页未在本次修复；host只读binding范围，lastRow后额外材料尚未覆盖；ProjectUI物理刷新保存失败时内存SHA未回滚且异常被吞，本次成功写版本6未触发该分支；独立第3步`detectReviewDivergence`仍可能优先较新draft，本次确认优先测试只覆盖恢复callback。不能据C08宣称全部恢复矩阵或全部结构校验通过。

本次明确公开清单为4源码/测试文件＋本验收/发布清单/交接3文档，共7文件；Git结果以本机`evidence/nav-probe/backup-receipt-c08-fixed-native-20261004.json`及远程SHA核对为准。全部C08私有文件和新独占审计JSON留本机忽略目录，保护pane不暂存。
