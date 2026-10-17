# R13 安装发布与交接验证记录

> **2026-10-17 F7补充：** R13-A 的安装脚本收敛与隔离生命周期已在 [F7证据](wps-phase1-f7-evidence-20261017.md) 重新执行并留证：Node全量515/515、升级加载新版、复制/启动失败回退、PID复用/命令行不可读/其他server不停止、DataRoot五目录和卸载/重装数据保留均通过；WPS构建号12.1.0.29161。下方2026-09-27结论保留为历史时点，真实WPS浮窗UI仍以F6用户确认为准。

> 日期：2026-09-27；工作包：R13。
> 结论：代码/脚本/文档和隔离安装验证已完成；依赖R12真实WPS的“安装→重启→打开项目→升级→回退→卸载→重装恢复”仍未完成。

## 1. 安装脚本修正

- `install.ps1`/`uninstall.ps1`只按 `name/guid=WpsRfqAddin` 匹配本插件。
- 同端口但不同身份的插件节点不会被删除；安装前备份 `publish.xml`。
- 升级覆盖程序目录前备份 `app.bak-时间戳`，复制失败时尝试回退旧程序目录。
- 发布仍剔除 `host-probe.js`、`pane-diagnostics.js`、`acceptance-probe.js`。

## 2. 实际命令与结果

```powershell
node --test wps-addin/test/install.test.cjs wps-addin/test/release-audit.test.cjs wps-addin/test/server.test.cjs
```

结果：15/15通过。覆盖：

- 安装只增改本插件节点，其他插件保留；
- 同端口其他插件也保留；
- 重复安装只有一个本插件节点；
- 升级前生成程序目录备份；
- 卸载只移除本插件并保留用户数据；
- 发布审计能识别内部页、隐藏页、公式、禁字段和清单不一致；
- 本机服务接口仍受会话令牌和Host/Origin限制。

## 3. 文档

- `docs/wps-user-guide.md`：已按七步流程、项目恢复和重新定位重写。
- `docs/wps-install-guide.md`：已更新安装、升级、回退、卸载和阻塞边界。
- `docs/wps-phase1-release-checklist.md`：已更新312项Node测试、浏览器回归、安装身份隔离和R12阻塞项。
- `README.md`：当前阶段改为“R12真实WPS链路未完成，不能宣称一期交付”。

## 4. 未完成与下一修复包

- 真实WPS安装→重启→打开项目→升级→回退→卸载→重装恢复未执行，原因是R12 Computer Use认证/RPC阻塞。
- 支持版本只登记已实际观察到的WPS `12.1.0.29161` 环境；在真实链路通过前不扩大支持承诺。
- 修复Computer Use配置或由用户提供真实WPS执行证据后，先完成R12，再回到R13执行真机安装回退和用户实操验收。
