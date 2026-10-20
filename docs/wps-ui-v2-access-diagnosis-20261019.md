# 新版入口与命令拒绝原因排查（2026-10-19）

## 结论与证据边界

| 问题 | 已确认原因/范围 | 未确认 |
|---|---|---|
| 功能区回到旧版 | 本轮恢复服务选了根目录旧代码；WPS publish.xml仍指38891，38891/ribbon.xml逐字节匹配根目录三入口。38918/ribbon.xml匹配新版五入口。新版862469b改动仍在，非源码回退 | 无需以缓存猜测解释当前旧界面 |
| 临时切换服务被拒 | 2026-10-19 01:13:00.988Z工具在CreateProcess前返回`Rejected / blocked by policy`；被拒命令没有执行。不是该命令执行后的PowerShell/WPS异常 | 实际触发的内置检查/具体子动作未暴露，不能断言是Stop-Process、启动、路径或注册 |
| 调试器不可点 | 用户手动与工具均无法切Console；新开立即点击及Esc也无变化。JS调试器是WPS开发模式提供，本插件main.js/ribbon.xml没有该调试器按钮或控制台代码 | 底层WPS/CEF失效原因尚未确定；不能把旧TaskPane的60秒故障结论移植为此次根因 |

## 本轮只读排查

- 当前会话rollout实际记录：`approval_policy=never`、`approvals_reviewer=user`、`sandbox_policy=danger-full-access`。因此前文笼统称“自动审批拒绝”不准确，应修正为“命令执行策略提前拒绝”。没有找到本次自动审核代理的拒绝理由。
- 用户级`default.rules`有47条显式allow，0条prompt、0条forbidden。检查的两处常见requirements.toml及项目.codex/config.toml不存在；这不等于排除全部托管策略来源。
- 使用当前安装CLI `0.163.0-alpha.10.2` 的官方只读命令`codex execpolicy check`，将**实际被拒完整PowerShell调用作为数据**评估用户规则。退出0，返回`matchedRules: []`。没有执行被拒命令，也没有改变规则、审批模式或沙箱。这个结果只排除检查到的用户规则命中，不代表整条命令已获全部执行层批准。
- 桌面应用版本`26.1013.4894.0`。现有应用日志和本机logs SQLite没有找到本次拒绝的更细理由。日志中的更新策略记录不是命令执行策略，不混用。
- 38891与38918健康身份仍匹配原记录；实际HTTP功能区与对应磁盘SHA一致。两端main.js均HTTP200；未改任何服务代码/注册/运行数据。
- 本机Application日志最近两小时未找到关联wps.exe、et.exe、renderapp或JsApiDevTool的1000/1001/1002事件；阴性结果不证明WPS没有故障。WPS现存日志为非直接可读结构，本轮未取得可解释此次无响应的错误。

详细私有证据只在`outputs/wps-ui-v2-20261018/native-test/resume-20261019/`：`command-policy-diagnostic.json`、`rejected-command.txt`、`ribbon-route-diagnostic.json`与一次性只读诊断脚本。不上传配置、原始会话、日志或被拒命令全文。

## 后续处理

1. 先解决具体服务切换动作的可交互审批条件，优先让用户审阅准确目标/副作用；不要无限扩大权限、添加宽泛允许规则或拆命令绕过拒绝。当前会话不请求审批，无法在原权限上下文发起升级执行。
2. 获准后再核身份临时切至已批准新版，直接从WPS功能区打开，减少对失效调试器的依赖；新版原生接入成功后才开始30分钟及尺寸验收。当前没有执行这一步。
3. 调试器故障另留WPS宿主问题，不凭插件Node/浏览器回归声称修复。

官方说明：[审批与安全](https://learn.chatgpt.com/docs/agent-approvals-security)、[规则静态检查](https://learn.chatgpt.com/docs/agent-configuration/rules)、[权限模式](https://learn.chatgpt.com/docs/permission-modes)、[自动审核适用条件](https://learn.chatgpt.com/docs/sandboxing/auto-review)。官方说明不提供本机这次拒绝的具体触发原因。
