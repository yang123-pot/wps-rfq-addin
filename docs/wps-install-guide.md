# WPS询价插件安装、升级与卸载说明（2026-09-27）

安装脚本位于 `wps-addin/install/`：`install.ps1`、`start.ps1`、`uninstall.ps1`。全部为用户级操作，不需要管理员权限，也不修改WPS或Windows安全设置。

## 一、安装

```powershell
pwsh -File wps-addin\install\install.ps1
```

脚本会：

1. 备份WPS的 `publish.xml` 为 `publish.xml.bak-时间戳`。
2. 只按 `name/guid=WpsRfqAddin` 匹配本插件；同端口的其他加载项不会被删除或改写。
3. 重复执行只保留一个本插件节点。
4. 覆盖程序目录前，把旧目录备份为 `app.bak-时间戳`；复制失败时尝试回退旧代码。
5. 复制 `main.js`、`ribbon.xml`、`taskpane.html`、`styles.css`、`package.json`、`rules`、`src`、`dev`、`assets` 到 `%LOCALAPPDATA%\WpsRfqAddin\app`。
6. 从发布目录剔除探针和诊断脚本：`host-probe.js`、`pane-diagnostics.js`、`acceptance-probe.js`。
7. 以隐藏窗口启动本机服务，只监听 `127.0.0.1:38891`；服务只提供插件资源和本机项目/库/回执接口。

安装后请重启WPS表格，再从“项目询价”功能区打开侧栏。

可覆盖参数：`-SourceDir`、`-AppDir`、`-PublishPath`、`-DataRoot`、`-Port`、`-SkipService`、`-SkipHealthCheck`。

## 二、启动与健康检查

```powershell
pwsh -File wps-addin\install\start.ps1
Invoke-RestMethod http://127.0.0.1:38891/health
```

期望返回：`service=wps-rfq-addin`。服务未启动时，WPS侧栏只显示连接失败，不会调用云端接口。

## 三、升级

1. 先确认项目/库/模板数据在 `%LOCALAPPDATA%\WpsRfqAddin`，本项目的数据目录不随程序目录覆盖而删除。
2. 更新代码后重新运行 `install.ps1`。
3. 脚本先备份 `publish.xml` 和旧程序目录，再覆盖发布文件；失败时保留错误并尝试回退旧程序目录。
4. 重启WPS，打开项目。R11会先核对审核表、分类簿、汇总表、总询价簿和拆分回执的真实路径/SHA；不通过时不会显示为已完成。

## 四、卸载

```powershell
pwsh -File wps-addin\install\uninstall.ps1
```

1. 只停止本插件服务进程：先读 `%LOCALAPPDATA%\WpsRfqAddin\server.pid`，再核对命令行包含 `server.cjs`；命令行不符时不终止。
2. 备份并更新 `publish.xml`，只移除本插件身份节点，其他插件原样保留。
3. 默认保留程序目录和全部用户数据，便于重新安装/回退。
4. 只有显式加 `-RemoveAppDir` 才删除预期的 `%LOCALAPPDATA%\WpsRfqAddin\app`。

用户数据位置：

- 项目：`projects`
- 分类库与习惯：`library`
- 抬头模板：`headers`
- 导入副本：`imports`
- 拆分回执：`splits`

## 五、回退

- 注册回退点：`publish.xml.bak-*`。
- 代码回退点：`%LOCALAPPDATA%\WpsRfqAddin\app.bak-*`。
- 数据保留：`%LOCALAPPDATA%\WpsRfqAddin` 下的项目、库、模板、导入副本和拆分回执不被默认卸载删除。
- 回退代码后重新执行安装脚本即可；旧版本遇到未知数据版本会拒绝读写并保留文件。

## 六、当前实测边界

- 安装/卸载身份隔离、同端口其他插件保留、重复安装、程序目录备份和用户数据保留已在本机临时 `publish.xml` 上真实执行验证。
- 真实WPS中的“安装→重启→打开项目→升级→回退→卸载→重装恢复”尚未完成。当前阻塞是Computer Use认证错误：`unsupported Codex auth method: apikey`，导致无法合规操作WPS窗口。
- 支持版本只登记已实际验证的范围：WPS表格 `12.1.0.29161`。其他版本需要隔离验证后再加入支持清单。
