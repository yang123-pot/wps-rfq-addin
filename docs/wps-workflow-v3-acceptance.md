# R12 真实 WPS 验收记录（未完成）

最新接续：**2026-10-03 R12-L，完成本轮资料/证据核查与回归，R12仍未结案。** 实际开工`feat/wps-phase1`@`0953da2c4cf163ac5738f658cca1c8e5c18dbb7b`；1项入场修改为`pane-diagnostics.js`换行差异，原样保留。Node **390/390**、六个主流程浏览器检查 **6/6**；G/H的12实际文件重新通过F双审计，I/J的25文件SHA匹配。四项目来源及已有人工记录已获用户明确授权并只读核查；**四项目新流程未运行、C/K真机缺项未齐，不能宣布R12或一期交付**。本包证据、截图出处、数据差异和下一补验包见文末R12-L节；以下G及以前段落为历史记录。

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

### 功能区图标最小修复及回归

七阶段原共用询价图标，本轮仅调整 `main.js:GetRfqImage`，按控件ID返回六个新增本地静态SVG及既有询价SVG；服务增加六条明确资源白名单，补资源映射、路由和发布包含测试。`OnGotoStage`、导航桥、ribbon.xml及业务流程保持原内容。相关四文件测试先红34通过/4预期失败，再绿38/38；全量Node **394/394**，失败/取消/跳过/todo均0。指定workflow、sheet-review、brand、inquiry、split、project及追加restore共 **7/7** 浏览器脚本退出0，宿主接口仍为模拟，不能代替真机。

真实WPS 12.1.0.29161已经显示七个不同图标和阶段标签，截图 `screens/k-ribbon-seven-icons.jpg`；当前服务七个图标资源均HTTP200。工具点“自动分类”后，侧栏仍显示第1步，报告帧数21停止增长；已封存 `evidence/stall-20261003-1/` 并请用户做真实鼠标点击核对。**七按钮导航、未打开/已打开/重建三态及窄宽出口尚未通过**，不因图标显示就勾K完成。隔离磁盘基线为0项目、库revision0、0学习来源，见 `c-preparation/evidence/disk-k-entry.json`。

### C独立小样及四项目待决准备

独立8行小样已由实际xlsx只读提取，再经当前parser/collection/review模型核验：8材料、0解析问题、1冲突、1无需询价，数量顺序逐值一致；H4:H11为最终分类、I4:I11为备注、K4:K11为随行ID，充电桩H10留空。证据 `c-preparation/evidence/preflight.json`。这只是准备验证，尚未创建真实项目确认或学习来源，C草稿/定位/排序筛选/幂等学习出口仍挂账。

四项目8原件/安全副本与前轮来源SHA全部相同；重新只读核201表/186476格与既有矩阵一致，1093数量组经Python Decimal独立复算一致。缺四字段精确候选3487行中，三字段同且类别唯一2611行：所在完整组总量相等2080行，不等531行；另有跨类70行、无三字段候选806行。**总量相等仅为算术证据，仍不证明逐行来源或人工确认。** 含重复容量等因素的待核输入行3626，不自动标无需询价。

已准备本机 `four-projects/四项目业务待决填写.xlsx`，6页覆盖项目选择、7587材料决定、1093数量组、5541人工依据、162类别品牌决定及说明。保存后编码/完整特征/工程量均保留，人工决定字段全部空白，六页预览已查看；独立验证退出0，见 `four-projects/verification-report.json`。合并/布局、最终类别/无需询价、人工来源与量差、品牌供应商/方式、四项抬头仍需用户决定，四项目新流程输出/成功失败数仍为未执行（null）。全部私有明细、填写簿及真实路径只留忽略目录。

本轮公开改动清单为图标相关11文件及验收/发布清单/交接3文件；入场 `pane-diagnostics.js` SHA仍为 `e9a76e21546142907d65f1c158f6cc4138a69bcf44f950e84edaa6ac914d8e91`，原样保留、不暂存。先审查并备份已完成图标修复，继续补C/K真机及四项目人工缺口；R13不开始、不合并main、不发布。提交推送及远程SHA以本机补验备份回执为准。
