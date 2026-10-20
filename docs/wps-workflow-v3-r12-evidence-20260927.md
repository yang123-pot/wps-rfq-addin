# R12 真机推进证据（2026-09-27 下午）

基线：`2cc8956`（分支 `feat/wps-phase1`，工作区开始时干净）。本记录只写实际执行的命令、真实截图和文件事实；模拟宿主与浏览器检查不能替代真机结论。

环境：WPS 表格 12.1.0.29161；Computer Use `@oai/sky`；隔离目录 `outputs/wps-acceptance-20260927/r12/`（imports/library/projects/headers/splits/output）；插件服务以探针模式启动：

~~~text
node wps-addin/dev/server.cjs --port 38891
  --report outputs/wps-acceptance-20260927/r12/evidence/report-20260927b.json
  --probe-output outputs/wps-acceptance-20260927/r12/probe-output.xlsx
  --import-directory .../r12/imports --library-directory .../r12/library
  --project-directory .../r12/projects --header-directory .../r12/headers
  --split-directory .../r12/splits
~~~

合成输入：`outputs/wps-acceptance-20260926/r12/inputs/给排水清单.xlsx`、`机电清单.xlsx`（各 5 行）。

## 1. 从“侧栏空白”恢复到可用

- 进入本轮时旧服务已不在监听（`127.0.0.1:38891` 连接被拒），侧栏空白且无心跳报告，与上次停点一致。
- 先按键接回：`侧栏停住时重建`/`打开询价助手` 均未让画面恢复（截图 `04-blank-pane-after-service-restart.jpg`）。
- 确认只有一个空白“工作簿1”（无用户数据）后，关闭并重新启动 WPS 表格；新窗格一次加载成功：探针报告出现 `javascript-loaded`、`ribbon-loaded(version 12.0)`、`taskpane-opened`，侧栏显示“已连接WPS表格”。
- 本轮两次遇到“点击后不再出帧”（`frameCount` 冻结、`framePendingMs` 一路增长，而心跳 POST 仍成功，证明页面 JS 存活、只是合成器停摆）：一次在选择器点击后，一次在生成失败后。两次都用功能区“侧栏停住时重建”→`确定` 恢复，新窗格 `frameCount` 从 1 重新增长。
- 结论：本轮的侧栏停摆是渲染层停帧，不是服务失联；恢复手段=重建侧栏；服务已死时必须先重启服务再重建。

## 2. 真机走通部分（图01–图02）

| 步骤 | 结果 | 证据 |
| --- | --- | --- |
| 内置选择器选两份合成清单（记住上次目录） | 命中 4.0 KB / 4.1 KB 两个文件 | `report-20260927b.json` 探针事件 |
| 导入两份清单 | 侧栏“已导入 2 份清单”；主工作簿新开“示例园区 项目询价 - 导入预览” | `05-import-preview-10-rows.jpg` |
| 主工作簿预览（本轮新增版式） | 文件列表（2 行、合计 10）、合并预览、说明三段实际显示；探针 `importCount=2`、`mergePreviewCount=10` | 同上 |
| 选“合并完全相同项” | 预览更新为“原始 10 项 → 预览 8 项 · 已选择精确合并”，主表说明“输入 10 行 → 合并后 8 行” | `06-merge-preview-8-rows.jpg` |
| 确认后自动分类 | 侧栏第2步“自动匹配完成 10 行：9 行有建议 · 1 行需重点核对 · 尚未人工确认” | `08-review-workbook-generated.jpg` |
| 生成并校验审核成果表 | 真实生成并打开 `output/r12/output/示例园区_分类审核成果.xlsx`（13,934 字节），工作表 `分类审核成果`/`内部选项`/`内部绑定` | 同上 + 文件列表 |

注：未能一次点中“合并完全相同项”复选框（坐标漂移导致误点），随后用键盘 `Tab`+`空格` 落在默认项上确认，因此这一轮真正生成成果表的路径是“分别保留 10 行”。10→8 的合并预览以第 4 行截图为准，两条路径都不改动原件。

## 3. 本轮发现并修复的两个真实宿主缺陷

### 3.1 数据有效性回读被误判为“未生效”

- 真机现象：生成审核成果表失败，侧栏报 `审核成果表未生成。“分类审核成果”下拉未生效：H4:H11`（截图 `07-review-generate-failed-validation.jpg`，放大件 `07f-address-zoom.png`）。
- 原因：宿主写入 `Validation.Add(3,1,1,"='内部选项'!$B$2:$B$7",'')` 后，`Validation.Formula1` 的回读写法与写入串不完全一致（等号/引号/空白差异），旧代码用严格字符串相等判定，直接把已经落地的下拉判为失败并中止生成。
- 修复（`src/export-host.js`）：新增 `normalizeFormula/formulaMatches` 只归一化等号、单引号与空白，仍要求区域与来源一致；首次不匹配时改用不带等号的同一区域再确认一次；仍不成立时接受 `Validation.Type===3`，并把“期望/实际”写进报错。读回校验走同一判定。
- 反向保护：宿主完全不落下拉（`Type` 与 `Formula1` 都为空）仍报错并且不保存文件。

### 3.2 隐藏辅助列的列宽读回为 0

- 真机现象：修好上一条后，下一个失败变成 `“分类审核成果”列宽读回不一致：第11列期望26，实际0`。
- 原因：随行 rowId 辅助列（K 列）是隐藏列；WPS 表格（同 Excel）对隐藏列回读 `ColumnWidth` 恒为 0，旧代码仍拿宽度比对。
- 修复（`src/export-host.js`）：隐藏列只核对 `Hidden===true`，不再比对宽度；可见列仍按版式逐列核对宽度。

两处修复都按“先失败用例、再最小实现”补了用例：`test/export-host.test.cjs` 新增“等价回读通过”“完全不落下拉时报出期望与实际”“隐藏列按 Hidden 判定”三组，并让模拟宿主按真实行为把隐藏列宽回读为 0。

## 4. 回归

- `node --test wps-addin/test/*.test.cjs` → **318/318 通过**（基线 315，新增 3 项宿主用例），日志 `outputs/wps-acceptance-20260927/audit/node-r12b.log`。
- 16 个 `ui-*-check.cjs` 全部通过（需 `NODE_PATH` 指向工作区依赖的 node_modules），日志 `outputs/wps-acceptance-20260927/audit/ui-r12b.log`。
- 以上仍是浏览器/模拟宿主结果，真机结论只取第 2 节截图与文件。

## 5. 未完成与遗留观察

- R12 未完成：图03 表内修改与整表确认、图04 分类工作簿、图05A/05B 双布局、图06 总询价、图07 一键拆分、异常清单、公开输出审计、四项目复制件，均未在真机执行；R12 不勾选。
- 遗留观察 1：发布后结果文件旁边残留点号开头的暂存文件 `.示例园区_分类审核成果.xlsx.tmp-*.xlsx`（WPS 正打开结果文件时清理失败）。属隔离目录现象，需在真机确认是“占用导致清理失败”还是逻辑遗漏。
- 遗留观察 2：每次导入/预览都会新开一个预览工作簿（本轮标签页累加到 8 个），与“只更新插件自建且未另存的预览”不符，需单独核实。
- 遗留观察 3：侧栏两次停帧的触发点仍不确定（一次在选择器点击后、一次在长任务提示后），只能确认“重建侧栏”可恢复。

## 6. 本机证据清单（不入 Git）

`outputs/wps-acceptance-20260927/r12/evidence/`：`04-blank-pane-after-service-restart.jpg`、`05-import-preview-10-rows.jpg`、`06-merge-preview-8-rows.jpg`、`07-review-generate-failed-validation.jpg`、`07b`–`07h`（错误文字放大）、`08-review-workbook-generated.jpg`、`report-20260927b.json`（探针报告）。
