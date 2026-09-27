# R12-E 拆分待核对状态与内容证明（2026-09-27，源码包，未触碰真机）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `822cd1f4d103feb35f3526455f711187d241ca4a`（R12-D）。入场工作区干净（R12-B/C/D 的 6 个修改已按包提交）。本包源码/测试/文档提交紧随其后，远程 SHA 以实际推送与 `git ls-remote` 为准。

**对应图：** 图07（本包开工前实际打开 `docs/mockups/approved-20260926/07-split-files.png` 查看）。验收点：逐份状态与完成/失败数、已有文件不覆盖、失败可重试、文件实际存在并重开校验后才报成功、打开输出文件夹指向实际目录。

## 1. 入口缺陷（R12 确定须修之一）

`src/split-state.js` 的 `reconcile(receipt,checks)` 在文件是 `pending` 但目标已存在时，把**首次观察到的 SHA** 写进 `file.sha256`；下一次 `reconcile` 看到 `actual===file.sha256` 就把该文件提升为 `succeeded`。因此只要连续刷新/重启两次，“发布响应丢失、尚未记账”的文件就会在没有做过任何内容核对的情况下凭空变成功，`summarize(...).done` 也会变成 `true`。

## 2. 失败测试先行（修改前实际失败）

| 用例 | 修改前实际结果 |
| --- | --- |
| `unrecorded target stays unverified after repeated checks` | 第2次 prepare 即 `succeeded`（期望始终 `needs-verification`、`done===false`） |
| `legacy succeeded receipt without verification proof is conservatively demoted` | `load` 后仍为 `succeeded` |
| `explicit verification proof is the only thing reconcile treats as verified success` | 文件改回旧 SHA 后 `reconcile` 自动恢复 `succeeded` |
| export-host 5 项 `verifyExistingOutput…` | `host.verifyExistingOutput is not a function` |
| split-server 3 项（重复 prepare/重启、save 409、总簿或 inputKey 改变） | 依赖旧“观察即成功”行为，新增后暴露缺陷 |

## 3. 修正内容

- **观察SHA与经核对SHA分开（`src/split-state.js`）**：`sha256` 只表示经核对成功的SHA；新增 `observedSha256` 只记录文件存在时看到的SHA。`needs-verification`/`pending`/`failed` 一律 `sha256:null`、`verifiedBy:null`。`reconcile` 只做“缺失退回待处理 / 外部改写或未记账标待核对”，**绝不写成功**。
- **成功必须带证明**：`mark(...,'succeeded',sha,{proof})` 写 `verifiedBy`（真实发布写回=`publish`，显式内容核对=`content-check`）与 `verifiedAt`；`demoteUnproven` 把旧回执里没有证明的 `succeeded` 保守降为待核对（`load` 与 UI `restore` 均调用）。
- **批次绑定收紧（`dev/split-store.cjs`）**：`load` 迁移旧回执；`alignReceipt` 增加 `inputKey` 与总询价工作簿 `generationSha256` 绑定，来源键或总簿变化必须另起批次，不沿用旧成功；`prepare` 新增 `canVerify`，待核对存在时 `canPublish=false` 但允许发起显式核对。
- **显式内容核对（`src/export-host.js` 新增 `verifyExistingOutput(app,file,expectedSheet,inspectTarget)`）**：只读打开实际供应商文件，逐值比较冻结 `modelSnapshot` 对应询价页的全部公开值；核工作表数量为1、无公开列范围外的隐藏辅助列、必需合并（抬头/标题）成立；核对前后各取一次本机实际SHA，SHA在核对中变化即拒绝；只关闭插件自己打开的文件并恢复宏安全/活动簿。返回 `{ok,sha256,mismatches,layoutIssues}`。
- **UI（`src/split-ui.js`）**：待核对文件单独列出（文件名、原因、原文件路径），状态栏单列“待核对 N”；`pending/failed` 可续作；显式“核对已有文件”动作先逐值核对，通过且当前 `inputKey`/总簿SHA未变、目标SHA稳定时才用现有带 `expectedRevision` 的 `save` 记 `succeeded`（`verifiedBy=content-check`）；核对不通过或 `save` 409/失败时读回服务端真实回执并保持待核对，原文件不覆盖；关闭/重开结果窗口只动界面，不改状态。

## 4. 验证与证据

| 命令 | 结果 |
| --- | --- |
| `node --test wps-addin/test/split-plan.test.cjs wps-addin/test/split-store.test.cjs wps-addin/test/split-server.test.cjs` | **17 pass / 0 fail**（本包新增 8 项） |
| `node --test wps-addin/test/*.test.cjs` | **355 pass / 0 fail**（R12-D 344 ＋ 本包 11） |
| `node wps-addin/test/ui-split-check.cjs`（`NODE_PATH` 指向本机已有 `playwright` 模块，系统 Edge headless） | **PASS(R12-E)**：5份独立文件、失败只续作；待核对重复刷新/重开结果窗口不自动成功；同名异内容保持待核对且不覆盖；显式逐值核对通过后才按实际SHA记成功 |

**本机证据（脱敏，不入 Git）：** `outputs/wps-acceptance-20260927/R12-E/`

- `split-tests.log`、`node-full.log`、`ui-split.log`、`ui-split-evidence.log`、`screens/ui-split-mock.png`
- `evidence/split-blocked.json`：外部改写后 `计划 5 个文件 · 完成 4 · 失败 0 · 待处理 0 · 待核对 1`，一键拆分禁用、显式核对入口可用
- `evidence/split-verified.json`：5完成/0失败，目标 `verifiedBy=content-check`、`sha256` 等于核对时实际文件SHA
- `evidence/split-result.json`：5份文件名、10列公开值、保留图06 layout、未复制内部追溯页

**修改文件 SHA256（本机）：** `src/split-state.js 16D014F5…`、`src/split-ui.js E02DBBEB…`、`src/export-host.js 424267C4…`、`dev/split-store.cjs E9AA56A5…`、`test/split-store.test.cjs 1A222142…`、`test/split-server.test.cjs 3B3F7BC7…`、`test/export-host.test.cjs CB7BDFE8…`、`test/ui-split-check.cjs 3C7331A9…`。

## 5. 环境说明与边界

- 本机此前记录“无 playwright 模块”只对仓库根 `require` 成立；本轮用 `NODE_PATH=F:\学习四（AI）\AI工作台\node_modules`（本机已有模块）＋系统 Edge 跑通 UI 检查。依赖路径只作为本机运行参数，不写入产品；浏览器检查用模拟宿主，只替代 WPS 的写入/打开接口，**不能替代真实 WPS**。
- `ui-brand`/`ui-category`/`ui-memory`/`ui-sheet-review` 四项仍为 R12-C 遗留失败（与本包无关），未在本包收口。

## 6. 未完成与下一包

- **未做真机 WPS 操作**：真实“发布后未记账/响应丢失”、外部改写后逐值核对、真机侧缓存清理，均**挂 R12-J**（文件故障与恢复）在同一入口检验；插件UI内正式点按生成与真实 xlsx 逐值读回挂 R12-G/H。不得把本包模拟宿主结果写成真机通过。
- R12 仍未完成；下一包 **R12-F**（公开输出审计：允许指定抬头联系方式、区分内部总簿与供应商件）。
