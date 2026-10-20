# R10 验证记录：一键拆分、持久回执与失败续作

> 日期：2026-09-27；工作包：R10；对应效果图：图07（已实际打开），版式继承参照图06。
> 范围：`wps-addin/src/split-plan.js`、`split-state.js`、`split-ui.js`、`src/import-ui.js`、`dev/split-store.cjs`、`dev/server.cjs`、页面/样式与R10用例。

## 1. 实现结果

- 拆分计划只取 `generation.modelSnapshot.sheets` 中 `kind=inquiry` 的页，固定按 `sheetId` 关联；内部追溯/处理记录页不拆分。
- 每份文件保留图06的抬头、供应商信息、10列清单和 `layout`，独立暂存→重开核→独占发布→SHA回执，不覆盖已有文件。
- 新增 `/api/split/prepare`、`/api/split/load`、`/api/split/save`，按 `projectId + batchId` 隔离回执；`save` 使用 `expectedRevision` 原子更新，旧版本返回 409。
- `prepare` 在写入前核对总询价工作簿真实SHA、内容键、输出目录和全部目标；首次遇到同名目标先阻断。
- 回执状态为 `pending / succeeded / failed / needs-verification`。发布成功但回执未记账、服务重启后发现文件已存在、或成功文件被外部改写时，均进入“待核对”，不覆盖旧文件、不沿用旧成功。
- 第7步侧栏改为“选择文件夹 / 一键拆分询价文件 / 打开输出文件夹 / 重试未完成”，使用内置目录选择器；结果窗口逐份列出文件名和状态。
- 图07样例实际输出并命名为：`水泵_华川设备.xlsx`、`水泵_启明机电.xlsx`、`阀门_多供应商.xlsx`、`风机_瑞风设备.xlsx`、`汽车充电桩_远程电气.xlsx`。

## 2. 实际命令与结果

### 2.1 R10专项Node测试

```powershell
node --test wps-addin/test/split-plan.test.cjs wps-addin/test/split-store.test.cjs wps-addin/test/split-server.test.cjs
```

结果：11/11 通过。覆盖计划只取询价页、目标冲突预检、批次隔离、revision 409、重启核 SHA、只续作未完成、外部改写和发布未记账待核对。

### 2.2 全量Node回归

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：310/310 通过，0 失败。

### 2.3 R10浏览器端到端检查

```powershell
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:RFQ_UI_SPLIT_SCREENSHOT='F:\材料软件开发\outputs\wps-acceptance-20260926\r10\ui-split-07.png'
$env:RFQ_UI_SPLIT_EVIDENCE='F:\材料软件开发\outputs\wps-acceptance-20260926\r10'
node wps-addin/test/ui-split-check.cjs
```

结果：PASS。使用真实页面、真实本机服务、真实暂存/发布/SHA；模拟宿主只承担WPS写入接口。验证5份输出名称、失败后续作不重写成功项、结果窗口、打开目录、外部改写转待核对。

### 2.4 相邻UI回归

```powershell
node wps-addin/test/ui-inquiry-check.cjs
node wps-addin/test/ui-workflow-check.cjs
node wps-addin/test/ui-project-check.cjs
node wps-addin/test/ui-category-check.cjs
node wps-addin/test/ui-render-stall-check.cjs
```

结果：全部 PASS。R9询价、七步导航、项目恢复、分类工作簿和侧栏持续出帧未受R10改动影响。

## 3. 本机证据

以下文件在 `outputs/wps-acceptance-20260926/r10/`，按项目规则不入Git：

| 文件 | 内容 | SHA256 |
| --- | --- | --- |
| `ui-split-07.png` | 第7步选中＋“本次拆分：5份已完成”结果窗口 | `99369F83BBE6B1B41A73BC16B03DA9613ED9CC20CA385B7BE4008D6A9E26173C` |
| `split-result.json` | 5份文件回执、文件名、SHA与公开值摘要 | `D676B871CFF3CF56E2627203E9A68DE8E7A88B6D45DB0D906748A986D5F8CA56` |
| `split-blocked.json` | 外部改写后“待核对1份”、按钮禁用状态 | `2C2778B40A5E75940D93725F238181B6D20E32B64DD308275CD2DE100BFD55FE` |

## 4. 未完成与边界

- 本轮是模型、本机服务、模拟WPS宿主和浏览器证据；**未在真实WPS表格中执行R10**。`Application.Shell` 打开输出文件夹和真实WPS写入/打印仍需R12实机核验。
- R2挂账的侧栏偶发停止出帧问题仍未关闭；本轮没有把模拟宿主结果当作真实WPS通过。
- R11从“保存重开与外部修改恢复”开始，重点复用本轮按项目＋批次持久回执。
