# R12-J 异常、检查点恢复、目录搬移与停摆——验收证据

> 日期：2026-10-02（本机真实操作 2026-10-02 凌晨）。分支 `feat/wps-phase1`。
> 本包只做 R12-J；依赖 R12-B–R12-I（已全部提交，见开工 Git 记录）。**未开始 R12-K 及以后**。

**开工基线（本会话实际 Git）：** `feat/wps-phase1`，HEAD `c2bd7be58baf467148a779f5525e3490f71a6723`；工作区**只有 1 个未提交修改** `wps-addin/dev/pane-diagnostics.js`（原样保留、未暂存、未清理）。提示词中“代码基线 `e6f8ff26…`、拆分时 `63dde1e…`、6 个未提交修改”是更早的拆分时快照；开工时实际 HEAD 已推进到 R12-I 提交 `c2bd7be`，入场修改只剩 1 个，以本会话实测为准。

**对应图：** 图03（表内审核）、图04（分类工作簿）、图05A/05B（汇总）、图06（总询价）、图07（拆分）。开工前按触发阶段实际打开 `docs/mockups/approved-20260926/` 的 03–07 六张图核对（本包不涉及图01/02）。

**宿主：** 本机隔离隐藏 WPS 实例（`KET.Application`，`Workbooks` 开工 0）；安装版本 `E:\WPS\WPS Office\12.1.0.29161\office6`（`et.exe` FileVersion 12.1.0.29161）。**说明：** `KET.Application.Name` 在本机回读为 `Microsoft Excel`、`Version` 为 `12.0`（WPS 的兼容标识），实际宿主版本以安装目录/文件版本为准，不以回读的兼容标识当作 Excel。全程未触碰用户会话（用户 WPS 进程开工/结束时都在，PID 未变）。

**驱动与隔离：** `outputs/wps-acceptance-20260927/R12-J/host/run-r12j.cjs`（本机一次性脚本，不入 Git）＋ 真实插件源码（`wps-addin/src/*`）＋ 真实 `wps-addin/dev/server.cjs` 发布管线 ＋ 真实隐藏 COM 桥 `com-host.ps1`；独立逐值核对用 `openpyxl`（`dump-xlsx.py`）。

## 1. 结论

- **异常/恢复矩阵 21 项全部有结果，0 失败**（`evidence/run-report.json`：`summary.scenarios=21, passed=21, failed=[]`）。
- **产品源码未改动**：所有异常都由隔离目录/隔离服务上的真实运行触发，没有需要修的缺陷；本包只新增一个浏览器检查脚本 `wps-addin/test/ui-cancel-check.cjs`。
- **原输入件与已完成输出未被覆盖**：基线 12 个真实文件在异常场景中都保留；旧停摆存档 `pane-report-20260926-stall.json`、`pane-report-20260926-nodialog-stall.json` 只登记 SHA，未改动。
- **未完成项如实保留**（见第 4 节）：插件 UI 内点按整链、功能区阶段快捷入口、四项目复制件、另一 WPS 版本、32 类词表政策。

## 2. 基线真实成果树（图03→04→05A→06→07）

一次真实生成（分列布局，与本包图05A一致），作为后续异常/恢复的现场；每个异常再复制独立副本或独立目录，互不影响。

| 阶段 | 真实文件 | SHA256（本机，摘要见 `evidence/base-tree.json`） |
| --- | --- | --- |
| 图03 审核成果 | `示例园区_分类审核成果.xlsx` | `b21a10a820ec63c8…` |
| 图04 分类工作簿 | 水泵/阀门/风机/汽车充电桩.xlsx（2/2/2/1 行） | `4b0af8d8…` / `a028a000…` / `6f8a14d9…` / `eaa462ac…` |
| 图05A 汇总 | `分类汇总表.xlsx`（分列3组+方式，真实填写并读回） | `c7f96e42489ae3ba…` |
| 图06 总询价 | `示例园区_询价总表.xlsx`（5询价页＋内部页） | `78f1125338393709…` |
| 图07 拆分 | 水泵_华川设备/水泵_启明机电/阀门_多供应商/风机_瑞风设备/汽车充电桩_远程电气.xlsx | `d1ba0cf6…` / `829624d9…` / `8a8e8d1b…` / `1dac6f8a…` / `c3fd4397…` |

拆分回执 revision=6，5 件全部 `state=succeeded`、`verifiedBy=publish`（`evidence/base-tree.json`）。真实窗口截图 4 张在 `screens/`：`04-category-pump.png`、`05a-summary-separated.png`、`06-total-inquiry.png`、`07-split-file.png`。

## 3. 逐项矩阵（操作 → 观察 → 文件变化 → 恢复结果 → 证据）

所有路径相对 `outputs/wps-acceptance-20260927/R12-J/`。每项独立目录见 `scenarios/<id>/`。

| # | 项 | 操作 | 观察 | 文件变化 | 恢复结果 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 独立目录/基线记录 | 每个异常独立目录/副本，登记项目revision、输入键、每文件SHA | 12 个真实文件SHA登记 | 只读 | 基线可复算 | `scenarios/J1-baseline/baseline-manifest.json` |
| 2 | 对话框取消/右上角关闭 | 选择文件/另存/选目录各取消，含右上角×、Esc（共6次） | 每次只回调取消、不返回目标 | 临时目录清单不变，无半成品 | 阶段/确认/回执不变 | `scenarios/J2-dialog-cancel/`、`wps-addin/test/ui-cancel-check.cjs` |
| 3a | 目标已存在 | 其中1份分类簿已存在再生成 | 预检全部目标后阻断，未写第一份 | 已存在件SHA不变，其余3份未创建 | 未虚报全部成功 | `scenarios/J3a-target-exists/` |
| 3b | 竞争创建 | prepare后抢占同名目标再commit | commit拒绝并报“目标文件已存在” | 抢占内容SHA不变 | 原文件未被覆盖 | `scenarios/J3b-race-create/race.json` |
| 3c | 只读目录 | 隔离目录拒绝写入后生成分类簿 | 逐份发布失败，回执非complete（pending） | 4份原文件SHA全部不变 | 未虚报全部成功（详见 3.1 注） | `scenarios/J3c-readonly-directory/readonly.json` |
| 4a | 分类第二份写入失败 | 隔离注入第二份暂存非xlsx | 第一遍 3成功/1失败 | 已成功件SHA+mtime不变 | 重试只补未完成→complete | `scenarios/J4a-second-write-fail-category/category-retry.json` |
| 4b | 拆分第二份写入失败 | 隔离注入第二份失败 | 第一遍 4成功/1失败，统计非全部成功 | 已成功件SHA+mtime不变 | 重试跳过4份→5件成功 | `scenarios/J4b-second-write-fail-split/split-retry.json` |
| 5a | 发布前中断 | 真实发布后立即中断，重启服务连续三次 prepare | 三次都 `needs-verification`，不自动成功 | 文件SHA稳定、未覆盖 | 经 R12-E 逐值核对后才记 `content-check` 成功 | `scenarios/J5a-publish-before-interrupt/…json` |
| 5b | 发布后响应丢失 | 发布后不记账，随后外改并核对 | 保持待核对；内容核对不通过 | 异内容原文件保留 | 不覆盖、不误报成功 | `scenarios/J5b-response-lost/response-lost.json` |
| 5c | 回执保存失败/409 | 旧版本号写入 + splits目录拒写 | 一次409、一次真实写失败 | 磁盘回执 revision 保留上一版 | 本地改动与上一版都不丢 | `scenarios/J5c-receipt-save-failure/…json` |
| 5d | 服务停止重启 | 停服→请求失败→重启→读回执 | 停服期请求失败 | 磁盘回执 revision 未变 | 可续作 | `scenarios/J5d-service-stop-restart/…json` |
| 6a | 删除已成功件 | 删除一份成功后重新 prepare | 该件转 `pending`“文件不存在” | 其它件保持成功 | 可重新生成该件 | `scenarios/J6a-delete-succeeded/…json` |
| 6b | 外改已成功件 | 改写一份成功后 prepare 并重试 | 转 `needs-verification`“已被外部改写” | 外改内容保留 | 重试被阻断、不覆盖、不沿用旧成功 | `scenarios/J6b-external-modify/…json` |
| 6c | 键过期 | 总簿被外部追加字节；当前内容键改掉 | 两次都 `canPublish=false` 并给具体冲突 | 输出目录文件清单不变 | 停止拆分、不沿用旧快照 | `scenarios/J6c-key-expired/key-expired.json` |
| 6d | R12-B 暂存清理 | 本次失败暂存 discard；重启后同名残留 | 本次被清理；重启后无所有权残留被保留 | 残留文件保留并报告 | 只清本次可安全清理的文件 | `scenarios/J6d-stage-cleanup/stage-cleanup.json` |
| 7 | 五恢复检查点 | 逐个保存项目→重启服务→读回并核真实内容 | 见第 3.2 节 | 无 | 完成态恢复、未完成态阻断 | `scenarios/J7-five-checkpoints/checkpoints.json` |
| 8 | 409/重启/原输入/用户簿/禁宏 | 项目/库/抬头旧版本写入；重启；打开用户簿后读回 | 三处均 409 并保留本地改动；重启后记录恢复 | 原输入件SHA不变 | 用户簿仍打开；宏安全值 1→1 恢复 | `scenarios/J8-conflict-and-safety/…json` |
| 9a | 关闭重开点链接 | 打开汇总点4个名称链接，关闭重开后逐个再点 | 两次都打开对应4个分类工作簿 | 无 | 关闭重开后链接可用 | `scenarios/J9a-reopen-follow-links/links.json` |
| 9b | 目录搬移 | 整树复制到中文+空格新根目录并重新定位 | 按ID/内容/相对关系核对通过 | 原目录文件保留 | 搬移后可接续，链接指向新目录 | `scenarios/J9b-move-directory/move.json` |
| 9c | 链接边界 | 目标已打开/另一目录同名诱饵/目标缺失 | 已打开激活正确簿；诱饵未被误开；缺目标报 missing | 删除件外其余未改 | 不静默替换同名错误目标 | `scenarios/J9c-link-edge-cases/link-edge.json` |
| 10 | 侧栏重建/停摆 | 出帧、七步导航与预览、功能区重建、导出预览检查 | 四项全部通过；本次未复现停摆 | 历史停摆存档未改动 | 若停摆先封存再重建（本次未发生） | `scenarios/J10-sidebar-rebuild-stall/sidebar.json` |

### 3.1 只读目录的边界（如实记录，不是缺陷）

分类目录被拒绝写入时，插件是在**逐份发布（commit）阶段**失败的，而不是在预检阶段提前发现：预检只核目标是否存在、文件名是否合法、目录是否存在，不预先探测目录可写性。结果是 **0 份成功、回执非 complete、4 份原文件 SHA 全部不变**，没有把任何一份写成“成功”。即“失败后原文件SHA不变、无误报全部成功”成立；“检查全部目标再写第一份”在**目标已存在**场景（3a）成立，在**只读目录**场景表现为逐份失败。是否给预检加“目录可写”探测，建议留 R12-L/R13 统一评估，本包不擅自加探索性代码。

### 3.2 五恢复检查点（重启服务后读回，核内容而非路径）

| 检查点 | audit.ok | 阻断阶段 | 核对真实文件数 | 界面状态（ready/blocked/missing） |
| --- | --- | --- | --- | --- |
| A 审核草稿 | true | — | 1 | review=ready，其余 missing |
| B 确认后分类失败 | false | categories | 5 | review=ready，categories=blocked |
| C 已填汇总 | true | — | 6 | review/categories/brands=ready |
| D 总簿已生成 | true | — | 7 | 至 inquiry=ready |
| E 拆分部分成功 | false | split | 12 | split=blocked |

每次都是“保存项目 → 停服务 → 起服务 → 读回项目 → 用 openpyxl 读真实文件内容核对”。审核阶段额外用 `compareSnapshot` 按 rowId 比对业务内容（不是只看 SHA）。未完成的 B/E 明确阻断、不恢复 ready。

## 4. 未完成与挂账（不冒充通过）

- **插件 UI 内点按的整条真机链路仍未执行**（本机无 Computer Use 原生窗口授权，与 R12-C/D/E/H/I 同一环境限制）。本包所有真实写入/读回/链接点击都走“隔离隐藏 COM 实例＋插件真实代码＋真实发布管线”，**不是**在插件界面点击完成，不得表述为 UI 真机通过。
- 功能区（Ribbon）阶段快捷入口属 R12-K，本包未做。
- 四项目复制件、另一 WPS 版本隔离验证、32 类正式词表/迁入政策仍挂账（R12-L / 待定）。
- **观察（非侧栏停摆）：** 本机隔离自动化实例在约 15 分钟高频使用后，收尾阶段对 `Workbooks` 的 COM 请求出现一次超时无响应（`evidence/run-report.json` 的 `host.cleanupError`）。这只影响收尾“关闭工作簿”一步，矩阵各项在超时前已全部完成；随后按“开工后新建、且不在开工前PID快照里”的规则在进程层清理了本次隔离实例，未触碰用户会话。这不是侧栏 CEF 停止出帧的问题，不当作停摆复现。
- 入口修改 `wps-addin/dev/pane-diagnostics.js` 与 HEAD 无实质差异，保持原样、未纳入本包提交。

## 5. 命令与回归

~~~powershell
$env:PYTHONIOENCODING='utf-8'
node outputs/wps-acceptance-20260927/R12-J/host/run-r12j.cjs    # 21/21 项，见 evidence/run-report.json
node --test wps-addin/test/*.test.cjs                          # 370/370 通过
python -m unittest discover -s wps-addin/test -p "test_*.py"    # 8/8 通过
$env:NODE_PATH='F:\学习四（AI）AI工作台\node_modules'            # 本机已有 playwright + 系统 Edge
node wps-addin/test/ui-cancel-check.cjs                        # PASS（选择文件/另存/选目录取消）
~~~

## 6. 出口核对

- ✔ 真实异常/恢复矩阵全部有结果；每项按“操作→观察→文件变化→恢复结果→证据路径”记录。
- ✔ 未完成项明确保留（第 4 节），未把“文件存在/SHA一致”当作内容正确，未把边界观察粉饰为缺陷已修。
- ✔ 旧停摆存档、原输入件和已完成输出未被覆盖；原始运行数据只留本机 `outputs/`，不入 Git。
- **下一包：R12-K**（功能区阶段快捷入口）。**本会话到此停止**，不开始 R12-K。
