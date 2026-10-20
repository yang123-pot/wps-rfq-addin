# F8 用户实操与交付准备证据（2026-10-17）

工作包：F8（R13-B），分支 `feat/wps-phase1`，入场 HEAD `2507173d1350e0c2c69727da41cc3b3210e4f4a7`。F6/R12 已结案，F7 安装器已完成。入场未提交的 `wps-addin/dev/pane-diagnostics.js` 原样保留、未编辑、未暂存。

## 1. 范围与结论

F8 只做用户实操、说明、候选包和交付范围核定，不改七步业务布局、字段归属或主操作。当前候选版本 `0.1.0`、构建标签 `20261017-F8`，实测 WPS 表格 `12.1.0.29161`。

已完成：

- 8 张批准效果图分两批实际打开（01–04，再 05A/05B/06/07），并查看现有真实窗口截图。
- 生产入口 `dev/server.cjs` 移除探针路由、报告接口和诊断脚本注入；开发探针移到不进入候选包的 `dev/probe-server.cjs`。新增先红后绿的生产包检查。
- 全量 Node **517/517**、Python **10/10**、探针侧栏浏览器检查 **PASS**。
- 候选包白名单、逐文件 SHA 清单、压缩包 SHA、隔离安装/资源读取/卸载重装检查。
- 用户说明、安装说明、发布清单和交接文档更新。
- 历史 32 类迁入与其他 WPS 版本范围核定：本候选包不包含 32 类正式迁入；除 `12.1.0.29161` 外的版本不列入支持范围。
- 一名实际用户按说明独立完成合成项目：导入10→合并8、整表确认、分类簿1本/4页、汇总4类/预计5份、总询价5页、拆分5件/0失败、关闭重开项目后第04–07步恢复；逐件供应商件读盘审计通过。

剩余收尾：按最终说明重建候选包并更新 SHA 清单，完成最终提交/推送与远程 SHA 核对。未覆盖边界见第 6 节。

## 2. 图片与真实窗口

8 张批准图分两批实际打开：

- 第一批：`01-import-merge.png`、`02-classification-result.png`、`03-sheet-review.png`、`04-category-workbooks.png`。
- 第二批：`05a-summary-separated.png`、`05b-summary-combined.png`、`06-inquiry-linkage.png`、`07-split-files.png`。

同时查看了 F1 追加行、F3 汇总填写、F5 项目1分类成功首页及25件重开状态的既有真实截图；这些截图不是本候选包的新点按证据。

F8 新捕获的真实窗口：

- `outputs/wps-phase1-F8/20261017/window-step1.png`：真实“项目询价”窗口第1步，导入 0 行。
- `outputs/wps-phase1-F8/20261017/window-watch2.png`：真实第2步，导入 10 行、合并后 8 行、0 条自动建议。
- `outputs/wps-phase1-F8/20261017/pause-save-location.png`：真实“选择成果表保存位置”弹层，发现说明缺口。
- `outputs/wps-phase1-F8/20261017/workbook-review.png`：真实审核成果表，8 行、最终分类列待填。

用户说明中的截图放在 `docs/images/wps-user-guide-f8/`，只使用合成项目，不含原始清单、报价、联系人、凭据或本机运行数据。

## 3. 生产入口去探针与回归

### 3.1 先红后绿

新增 `wps-addin/test/production-package.test.cjs`，先确认失败：

- `server.cjs` 仍包含 `probeConfig`，测试失败；
- `probe-server.cjs` 不存在，测试失败。

实现后通过：

- `server.cjs` 不再包含 `probeConfig`、`--probe-output`、`--report`、`--source`、`__probe`、`host-probe`、`pane-diagnostics`、`acceptance-probe` 等字符串；
- 生产服务对 `/__probe/report` 返回 404，首页不注入 `host-probe`；
- 开发探针由 `dev/probe-server.cjs` 提供 `createProbeServer`/`prepareProbeSources`，保留原报告接口、100 条报告上限及心跳裁剪和诊断脚本注入行为。

### 3.2 回归结果

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：**517/517 通过，0 失败/0 跳过**。日志本机 `outputs/wps-phase1-F8/20261017/node-full-final.txt`。

```powershell
python -m unittest discover -s wps-addin/test -p "test_*.py"
```

结果：**10/10 通过**。日志本机 `outputs/wps-phase1-F8/20261017/python-unittest.txt`。

探针侧栏检查：

```powershell
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-pane-diagnostics-check.cjs
```

结果：**PASS**，日志本机 `outputs/wps-phase1-F8/20261017/ui-pane-diagnostics-check.log`。默认 Node 仍不能直接解析 `playwright`，以上使用本机 Codex 运行时路径；该检查仍是浏览器/模拟宿主，不替代真实 WPS 窗口。

**受影响验收：** F7 的安装/身份/生命周期测试、`server.test.cjs` 的资产/健康/目录浏览/探针隔离、`ui-pane-diagnostics-check.cjs` 的探针链路。业务 UI 与七步模型未改，F6 的 R12 结论不重开；本轮不把 517 项当作真实 WPS 重跑。

## 4. 候选包与隔离安装

候选包目录（本机，Git忽略）：

```text
outputs/wps-phase1-F8/20261017/candidate-release3/wps-rfq-addin-0.1.0-20261017-F8/
outputs/wps-phase1-F8/20261017/wps-rfq-addin-0.1.0-20261017-F8.zip
outputs/wps-phase1-F8/20261017/candidate-manifest.json
```

候选包只包含：

- 根目录：`main.js`、`ribbon.xml`、`taskpane.html`、`styles.css`、`package.json`；
- `src/`、`rules/defaults.json`、`assets/`；
- 运行所需 `dev/*.cjs`（server、导入/导出、项目/库/抬头/拆分存储、冻结/原子写/视图）；
- `install/` 安装脚本；
- `docs/wps-user-guide.md`、`docs/wps-install-guide.md` 及 `docs/images/wps-user-guide-f8/` 的 9 张真实窗口截图。

不包含：测试、样本、诊断/探针脚本、故障注入入口、原始清单、报价、联系人、凭据、本机项目/库/模板/日志。`dev/probe-server.cjs` 明确不进入候选包。

### 4.1 文件与 SHA

最终数值以压缩包重建后的 `candidate-manifest.json` 和 `docs/wps-phase1-release-manifest-20261017.json` 为准。当前检查结果：

- 包文件数 82（73 个产品/安装/说明文本文件＋9 张用户说明截图）；
- 运行代码版本 `ca92a042a113345a3df74a495b5a4a7d793889cda2e86c46662c522eda0704c2`（会随源码变化重算）；
- 压缩包 SHA-256 `70faab2201c9d66d9aaaab64ba9a72ab27df61b298aa6b095984649d9aae01cb`；字节数 `917383`；
- 资源白名单中 43 个脚本、7 个 SVG 图标均可由隔离服务返回 200；
- `/__probe/report` 返回 404。

### 4.2 隔离安装

在 `outputs/wps-phase1-F8/20261017/isolated-final/` 使用临时 AppDir/DataRoot/publish.xml、端口 7470 执行：

- 安装退出 0，服务健康通过，`scriptPath` 为 AppDir 下绝对 `dev/server.cjs`，`codeVersion` 与清单一致；
- 43 个脚本和 7 个图标全部 HTTP 200；
- 卸载退出 0，只移除本插件节点，服务停止；
- 数据目录 `projects` 中哨兵文件保留；
- 重装退出 0，哨兵仍为 `keep-me`。

另将最终 zip 解压后从解压目录执行安装（端口 7471），退出 0，健康 `codeVersion=ca92...` 与清单一致；该解压安装证明 zip 根目录与安装脚本可直接使用。

本检查不修改用户真实 `publish.xml`、不重启用户 WPS、不使用真实 DataRoot。

## 5. 真人独立试跑记录

测试输入（合成、可公开）：

```text
outputs/wps-phase1-F8/20261017/synthetic-input/给排水清单.xlsx
outputs/wps-phase1-F8/20261017/synthetic-input/机电清单.xlsx
```

SHA-256：

- 给排水清单：`29ff9e9537af023e07e931a190b8e26a089e64184cc03f257466b26842b3ff4b`
- 机电清单：`9f0b1116716c01348c565e8085ebcd1323b4b418316d0ec1be5e229e061a0159`

环境：真实 WPS 表格 `12.1.0.29161`，真实询价窗口，本机 F5 隔离验收服务（库目录为 `outputs/wps-phase1-F5/acceptance-data/library`）。点击者为用户本人；助手只观察窗口、读磁盘和记录，不代替用户点击业务按钮。

实际完成：

1. 用户在第1步导入两份合成清单，选择“合并完全相同项”，确认后页面显示导入 10 行、合并后 8 行。
2. 第2步显示“0 行有建议、8 行需重点核对”。该验收库的 `rules=0`（类别 104、记忆保留），所以没有规则命中的建议；不是导入/合并失败。用户说明已补充这一情形。
3. 点“生成审核成果表”后出现“选择成果表保存位置”弹层；用户停顿，原因是说明没有写明必须先进入成果目录。补充路径说明后，用户进入 `outputs/wps-phase1-F8/20261017/user-run/project`，实际生成 `示例园区_分类审核成果.xlsx`（16,210 字节，8 行）。
4. 用户按说明在成果表内填写最终分类并整表确认；第4步生成 `示例园区_分类工作簿.xlsx`：1 本、汇总页＋4 个分类页（水泵/阀门/风机/汽车充电桩），7 行询价、1 行无需询价，SHA `49242082efcf9ce393193f2219edc2584489f37d58cde3bba46515fe08e0a5d1`。
5. 用户在第5步切到第1个标签“分类汇总表”，按分列布局填写 4 类品牌/供应商和生成方式；保存后读回 4 类、预计 5 份，水泵 2 份、阀门/风机/汽车充电桩各 1 份。
6. 用户在“辅助功能 → 询价抬头”填写项目名称/单位名称/材料经办人/联系方式，生成总询价工作簿。实际文件：

```text
F:\材料软件开发\outputs\wps-acceptance-20261003\R12-L-supplement\c-preparation\ui-data\out\stability-20261010\示例园区_询价总表_20261017.xlsx
```

SHA-256 `9ff7b89f12b95792d8886d3e4f1ba03c0ff3777d86e863ea5e43bdd4cc4c82e6`；5 张询价页＋2 张内部页，阀门 20/12、品牌“通达 / 海岳”，报价单价/金额为空。为便于本机证据归档，已复制同一 SHA 的副本到 `outputs/wps-phase1-F8/20261017/user-run/project/`，项目绑定仍指向原路径。

7. 用户第7步选择 `outputs/wps-phase1-F8/20261017/user-run/supplier-files` 并拆分：计划5/完成5/失败0/待处理0。逐件读盘审计通过：

| 文件 | 材料行 | SHA-256 |
| --- | --- | --- |
| 水泵_华川设备.xlsx | 2 | `dccc59b517cd8037aad21af87b142d9640851b610beb5f7b80faa802145927a1` |
| 水泵_启明机电.xlsx | 2 | `a1bb3c9f2a98d3ec7653d2c6379654b920a9d3cd88bb5a7ba69d43b39d8f75e0` |
| 阀门_多供应商.xlsx | 2 | `8ea57ce566800e83db81a340a70c5013a599bc99304b2741648d4775c84e0d64` |
| 风机_瑞风设备.xlsx | 2 | `78f2210b054c586e541a653f6a42db5a87bf267effabbfe9bb4add6bac085f17` |
| 汽车充电桩_远程电气.xlsx | 1 | `ca32f2f96141f079db71c73ff8a9ccb89576d5fdcd942d4ad75bdd531af429f3` |

每件均为单页、可见、10列，第6/7行表头与材料匹配，品牌/供应商/工程量正确，报价单价和金额留空，无公式、无超链接、无批注、无隐藏行列、无内部路径/原价/历史价痕迹。审计 JSON 本机 `outputs/wps-phase1-F8/20261017/user-run/supplier-audit.json`。

8. 用户保存项目后关闭询价窗口，再从功能区重新打开并打开 `p-mvcggbdg-uod6k3hw` 版本14。项目记录 7 个阶段均 `ready`，生成绑定的 SHA 与拆分回执一致；用户逐项确认第04/05/06/07步恢复为：分类簿 1 本 4 页、品牌已读回 4 类/预计5份、总询价有效/5页、拆分计划5/完成5/失败0/待处理0。

停顿/歧义与修正：

- 生成审核成果表：必须先进入成果目录再“生成到此位置”；已补用户说明。
- 空规则库出现“0 行有建议”：说明为分类库无命中，不是导入失败；已补说明。
- 第5步需要先切回第1个标签“分类汇总表”：已补说明。
- “询价抬头”在辅助区域上方，用户先滚到了“项目状态”；已补“展开辅助功能/在项目状态上方”的说明。
- 原生保存对话框停在“上次目录” `stability-20261010`，且该目录有旧同名总表；先报“目标文件已存在”。改用带日期的新文件名并切换目录后成功；已补“先切换目录、手动输入新文件名、不要点已有工作簿”的说明。
- 重开项目列表名称取自首份清单 `给排水清单`，不是抬头 `示例园区`；已补“按项目号/版本识别”的说明。
- 重开后出现一次顶部高亮与面板内容短暂不一致，点对应步骤编号后恢复；已补刷新说明，作为已知 CEF 重绘现象，不改业务模型。

**结论：真人独立试跑完成。** 用户实际点击导入、合并、填分类、整表确认、填汇总、填抬头、生成总表、拆分和关闭/重开；助手只观察窗口、读磁盘和记录，未代替用户点击业务按钮。F8 用户实操出口通过；候选包仍需按最终文档重建后再提交。

## 6. 交付范围核定

### 6.1 历史 32 类迁入

- 历史 32 类/1458 条记忆只在 F5 隔离验收库中登记和演练（`library.json` 类别 104＝四项目 92＋历史新增 12；重名 20），**没有写入生产分类库**。
- 本候选包的生产词表仍是 `rules/defaults.json` 的 `2026-09-24.1` 4 类；不包含 32 类的批量迁入脚本、映射表或迁移后的生产库。
- 结论：32 类正式迁入排除在本期候选包之外；需要单独业务确认、备份/回滚和迁移验收后再执行。用户在后续使用时通过成果表确认的新类别仍按既有“新类别入库”路径写入本机库，不属于历史 32 类批量迁入。

### 6.2 其他 WPS 版本

- 本机只实测 WPS 表格 `12.1.0.29161`；COM 隐藏实例、安装生命周期和真实浮窗均基于该构建号。
- 除 `12.1.0.29161` 外的 WPS 版本未完成隔离实测，不列入支持范围；不在文档中写“兼容所有 WPS 版本”。

### 6.3 发布状态

- 本包只准备交付候选，不合并 `main`、不创建正式发布版本、不自动上传/发布。
- 候选包与清单保存在本机 Git 忽略目录；仓库只提交可审查的文档、源码、测试和候选清单。
- 发布流程由用户明确安排后再执行。

## 7. Git 与备份

本包只按明确文件清单暂存并审查 `git diff --cached`；不使用 `git add .`/`git add -A`。入场 `wps-addin/dev/pane-diagnostics.js` 原样保留、不暂存；原始资料、私有证据、运行数据、候选 zip、隔离安装目录均不入 Git。

实际结果：

- 候选源码提交 `a08db614b017245113157fe76288722579153d31`（`feat(wps): prepare F8 delivery candidate and user guide`）；
- 清单提交 `33475292f5fde225ccd55478b5e4b843be9464c8`（`docs(wps): record F8 candidate source commit`）；
- 真人试跑与最终说明提交 `fdcff3b9dc6c804dc1a5689cac31a89dbccfd14f`（`docs(wps): complete F8 user walkthrough and candidate manifest`）；
- 清单指向最终源码提交 `66c00c176edfed3d598e86d025fd1f5b4ec55dc5`（`docs(wps): point F8 manifest at final source commit`）；
- 普通 `git push origin feat/wps-phase1` 退出 0；推送后 `git rev-parse HEAD` 与 `git ls-remote origin refs/heads/feat/wps-phase1` 逐位相同，均为 `66c00c176edfed3d598e86d025fd1f5b4ec55dc5`。

随后仅追加本证据/交接的状态文字，最终文档提交与远程HEAD以本机 `outputs/wps-phase1-F8/20261017/backup-receipt.json` 和最终报告为准；候选 zip 与源码内容不因该文字提交变化。未强推，未上传原始资料、私有证据、候选 zip 或隔离安装目录。
