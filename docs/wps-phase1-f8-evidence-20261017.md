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

未完成/边界见第 6 节。真人独立试跑是本包唯一不能用助手代做的出口；在其完成前不把 F8 标为全部通过。

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
outputs/wps-phase1-F8/20261017/candidate-release2/wps-rfq-addin-0.1.0-20261017-F8/
outputs/wps-phase1-F8/20261017/wps-rfq-addin-0.1.0-20261017-F8.zip
outputs/wps-phase1-F8/20261017/candidate-manifest.json
```

候选包只包含：

- 根目录：`main.js`、`ribbon.xml`、`taskpane.html`、`styles.css`、`package.json`；
- `src/`、`rules/defaults.json`、`assets/`；
- 运行所需 `dev/*.cjs`（server、导入/导出、项目/库/抬头/拆分存储、冻结/原子写/视图）；
- `install/` 安装脚本；
- `docs/wps-user-guide.md`、`docs/wps-install-guide.md`。

不包含：测试、样本、诊断/探针脚本、故障注入入口、原始清单、报价、联系人、凭据、本机项目/库/模板/日志。`dev/probe-server.cjs` 明确不进入候选包。

### 4.1 文件与 SHA

最终数值以压缩包重建后的 `candidate-manifest.json` 和 `docs/wps-phase1-release-manifest-20261017.json` 为准。当前检查结果：

- 文件数 73；
- 运行代码版本 `ca92a042a113345a3df74a495b5a4a7d793889cda2e86c46662c522eda0704c2`（会随源码变化重算）；
- 压缩包 SHA-256 `3c1dc286d5c74a3a013a466bf9f868ed1e4a2ebeab34f8a095b1149a04bd8a6c`；
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

已实际发生：

1. 用户在第1步导入两份合成清单，选择“合并完全相同项”，确认后页面显示导入 10 行、合并后 8 行。
2. 第2步显示“0 行有建议、8 行需重点核对”。该验收库的 `rules=0`（类别 104、记忆保留），所以没有规则命中的建议；不是导入/合并失败。用户说明已补充这一情形。
3. 点“生成审核成果表”后出现“选择成果表保存位置”弹层；用户停顿，原因是说明没有写明必须先进入成果目录。助手补充路径说明后，用户进入 `outputs/wps-phase1-F8/20261017/user-run/project`，实际生成 `示例园区_分类审核成果.xlsx`（16,210 字节，8 行）。
4. 审核成果表已由 WPS 打开，8 行最终分类列待用户填写。后续整表确认、分类簿、汇总、询价、拆分与重开尚待用户完成。

**结论：真人试跑尚未完成，不能把 F8 标为全部通过。** 已确认的说明缺口是“生成审核成果表”的保存位置选择；已修正 `docs/wps-user-guide.md`。其余停顿/歧义待用户回报后补齐。

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

提交、普通推送、`git ls-remote` 与本地 HEAD 逐位核对结果以本机 `outputs/wps-phase1-F8/20261017/backup-receipt.json` 和最终报告为准。推送失败时保留本地提交并如实记录，不强推。
