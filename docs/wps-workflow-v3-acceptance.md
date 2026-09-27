# R12 真实 WPS 验收记录（未完成）

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

**验证：** split plan/store/server **17/17**；全量 Node **355/355**（R12-D 344＋本包11）；`ui-split-check` **PASS**（本机 `NODE_PATH` 指向已有 playwright 模块＋系统 Edge，模拟宿主只替代WPS写入/打开接口）。证据在本机 `outputs/wps-acceptance-20260927/R12-E/`（日志、`split-blocked/verified/result.json`、模拟界面截图）。

**未完成：** 未做真机WPS操作；真实“发布后未记账/响应丢失”、外部改写后逐值核对与真机清理**挂 R12-J**，插件UI内正式生成与真实xlsx读回挂 R12-G/H。`ui-brand`/`ui-category`/`ui-memory`/`ui-sheet-review` 四项浏览器检查仍为 R12-C 遗留失败。R12 仍未完成；下一包 R12-F。

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
| 图03独立保存草稿、不学习不确认；空/未知分类和损坏行定位 | 待真机补验 |
| 图05A/05B双布局、原生链接、逐值读回等价 | 待解决字体回读阻塞并真机执行 |
| 图06抬头、5询价页、阀门20/12与多品牌、打印 | 待执行 |
| 图07新目录5拆分文件、逐份状态、打开目录 | 待执行 |
| 不合并10行来源边界及数量 | 只有旧10行导入/成果证据，完整输出对照待执行 |
| 全无需询价 | 待执行 |
| 取消/关闭、已有同名SHA不变、只读目录、第二份失败、服务重启、回执丢失、成功件丢失或外改 | 均待真实异常链路证据 |
| 公开输出逐值/无公式/无内部隐藏内容/无原价历史价审计 | 待真实总询价及拆分文件生成；不能用本次内部分类簿审计替代 |
| 长特征、前导零、小数、分页、保存关闭重开、整目录搬移链接 | 待真机执行 |
| 四项目复制件 | 未开始；仍须明确获准复制件和人工审核，不自动全选或伪造确认 |
| 功能区阶段快捷入口 | 待补齐及留证 |

R12保持未完成，R13真实安装生命周期继续等待。下一步先恢复Computer Use对实际WPS进程的应用授权，确认当前审核编辑；如服务仍停，按handoff隔离参数启动新批次报告，再从图03缺项及图05阻塞继续。图01/02和图04已核实成果不重做。
