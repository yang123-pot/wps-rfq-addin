# R12 真实WPS验收记录（阻塞）

> 日期：2026-09-27；工作包：R12；对应图：全部8张（已分两批实际查看）。
> 结论：**R12未完成，不得宣称一期真实WPS通过。**

## 1. 已准备

- 当前代码服务已在本机 `127.0.0.1:38891` 启动并通过 `/health`：`service=wps-rfq-addin`。
- WPS表格进程存在：`E:\WPS\WPS Office\12.1.0.29161\office6\wps.exe`。
- `publish.xml`已有本插件节点：`WpsRfqAddin` → `http://127.0.0.1:38891/`。
- 用 `spreadsheets` 技能和本机运行依赖生成了合成输入：
  - `outputs/wps-acceptance-20260926/r12/inputs/给排水清单.xlsx`
  - `outputs/wps-acceptance-20260926/r12/inputs/机电清单.xlsx`
- 两份输入已用 `artifact-tool` 重新导入并逐值读回：给排水5行、机电5行。

## 2. 自动化回归结果

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：312/312通过。

浏览器检查通过：`ui-workflow-check`、`ui-sheet-review-check`、`ui-brand-check`、`ui-inquiry-check`、`ui-split-check`、`ui-project-check`、`ui-project-restore-check`。

这些结果只证明模型、本机服务、浏览器/模拟宿主链路的回归；**不能代替真实WPS**。

## 3. 阻塞证据

Computer Use 初始化：

```text
unsupported Codex auth method: apikey
```

改用技能指定的 `@oai/sky`：

```text
Trusted RPC service is not configured: sky
```

因此本轮无法合规执行真实WPS窗口操作，无法完成：

- 安装/注册后在真实WPS中打开功能区与侧栏。
- 对8张效果图逐阶段真实截图对照。
- 取消、已有文件、只读目录、第二份失败、服务中断、丢文件/外部改写等真实交互。
- 同格布局完整链路、全部无需询价、长特征/前导零/分页/链接搬移。
- 四项目复制件验收。
- 停摆报告封存与侧栏重建恢复。

## 4. 需要的外部条件

用户或环境需要先修复Computer Use认证/可信RPC配置，使真实WPS窗口可被合规自动化；或由用户在真实WPS内按 `docs/wps-user-guide.md` 执行并留下截图/输出。条件满足后再继续R12，未完成项不能勾选。
