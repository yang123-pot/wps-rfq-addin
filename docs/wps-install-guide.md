# 材料整理助手安装、升级与卸载说明（2026-10-17）

安装脚本位于 `wps-addin/install/`：`install.ps1`、`start.ps1`、`uninstall.ps1`，共享身份核对 `service-identity.ps1`。全部为用户级操作，不需要管理员权限，也不修改WPS或Windows安全设置。

## 一、安装

```powershell
pwsh -File wps-addin\install\install.ps1
```

脚本会：

1. 核对 `SourceDir` 是有效插件目录，并校验 AppDir、DataRoot、publish.xml 都是绝对路径且没有互相包含的危险关系。
2. 备份WPS的 `publish.xml` 为 `publish.xml.bak-时间戳`。
3. 只按 `name/guid=WpsRfqAddin` 匹配本插件；同端口的其他加载项不会被删除或改写。
4. 把发布文件复制到同级暂存目录，再切换到 AppDir；不会边复制边破坏正在使用的程序目录。
5. 从发布目录剔除探针、诊断和故障注入文件；候选包本身不包含这些文件。
6. 创建并明确传入 `DataRoot` 下的五个目录：`imports`、`library`、`projects`、`headers`、`splits`。
7. 以隐藏窗口启动本机服务，只监听 `127.0.0.1:38891`；服务只提供插件资源和本机项目/库/回执接口。

安装后请重启WPS表格，再从“材料整理”功能区打开材料整理助手。用户看到的名称是“材料整理助手”，内部注册身份仍是 `WpsRfqAddin`，升级不会产生两个插件。

可覆盖参数：`-SourceDir`、`-AppDir`、`-PublishPath`、`-DataRoot`、`-Port`、`-SkipService`、`-SkipHealthCheck`。`SkipService` 仅供隔离复制测试；真实升级/卸载不要依赖它。

## 二、服务身份与健康检查

```powershell
pwsh -File wps-addin\install\start.ps1
Invoke-RestMethod http://127.0.0.1:38891/health
```

健康响应至少包含：

```text
service=wps-rfq-addin
pid=<进程号>
scriptPath=<AppDir\dev\server.cjs 绝对路径>
appDir=<AppDir 绝对路径>
startedAt=<启动时间>
codeVersion=<服务启动时对实际代码计算的 SHA-256 版本>
```

安装、启动和卸载只有在以下条件同时满足时才停止/重启服务：

- 健康响应的 `scriptPath`、`appDir` 与本插件目录一致；
- 进程命令行中的 `server.cjs` 是同一绝对路径；
- 进程创建时间与 `startedAt` 在容差内；
- 健康响应的 `codeVersion` 与 AppDir 当前代码计算值一致。

`server.pid` 只是候选线索，不单独授权停止进程。PID 复用、命令行不可读或命令行指向其他目录的 `server.cjs` 时，脚本拒绝停止并说明原因。

## 三、升级

1. 先确认项目/库/模板数据在 `%LOCALAPPDATA%\WpsRfqAddin`，程序目录覆盖不会删除这些数据。
2. 更新代码后重新运行 `install.ps1`。
3. 脚本先核对旧服务身份，再在同级暂存目录完成新代码复制；暂存成功后停止旧服务、备份旧程序目录并切换到新代码。
4. 新服务启动后核对 `codeVersion`、绝对脚本路径和进程号；通过后才写入 PID 并报告成功。
5. 复制失败：旧程序目录和运行中的旧服务保持不变，仅还原本次写入的注册。
6. 启动失败：停止本次新进程，还原旧代码和注册，并尝试恢复旧服务；控制台会列出回退结果。
7. 重启WPS，打开项目。R11会先核对审核表、分类簿、汇总表、总询价簿和拆分回执的真实路径/SHA；不通过时不会显示为已完成。

升级请沿用旧服务端口。若确实要改端口，先用旧端口运行 `uninstall.ps1`（或手动停止旧服务）再安装，避免两个本机服务并存。

**旧版本服务边界：** F7 之前启动的服务没有健康身份字段（`scriptPath/startedAt/codeVersion`）。安装/启动/卸载会拒绝自动停止这类服务，并提示先手动停止旧服务一次。这是为了避免误停未知进程；手动停止后再次安装即可进入可自动核对的 F7 生命周期。

## 四、启动

`start.ps1` 会先核对端口上是否已有身份一致的本插件服务；已有则复用，不重复启动。端口被其他程序占用时直接报错，不停止对方。新服务始终以隐藏窗口启动，并把五个 DataRoot 子目录显式传给服务。

## 五、卸载

```powershell
pwsh -File wps-addin\install\uninstall.ps1
```

1. 优先通过 `/health` 核对并停止本插件服务；身份不符时拒绝停止，且不移除注册、不删除程序或数据。
2. 没有健康响应时，`server.pid` 只用于提示；命令行不可读、不是本插件绝对脚本或无法核对运行代码版本时，不停止进程。
3. 备份并更新 `publish.xml`，只移除本插件身份节点，其他插件原样保留。
4. 默认保留程序目录和全部用户数据，便于重新安装/回退。
5. 只有显式加 `-RemoveAppDir` 才删除程序目录；删除前要求目录含本插件 `main.js`、`package.json` 名称为 `wps-rfq-addin`，且不包含 DataRoot。

用户数据位置：

- 项目：`projects`
- 分类库与习惯：`library`
- 抬头模板：`headers`
- 导入副本：`imports`
- 拆分回执：`splits`

## 六、回退

- 注册回退点：`publish.xml.bak-*`。
- 代码回退点：`app.bak-*`。
- 安装失败会自动使用这些回退点；成功升级后它们仍保留，便于人工回退。
- 数据保留：`%LOCALAPPDATA%\WpsRfqAddin` 下的五个目录不被默认卸载删除。
- 回退代码后重新执行安装脚本即可；旧版本遇到未知数据版本会拒绝读写并保留文件。

## 七、实测范围与边界

- 2026-10-17 在隔离 AppDir/DataRoot/publish.xml/端口上执行安装→同版重启→开项目→升级→复制失败→启动失败回退→卸载→重装，F7生命周期通过；F8把开发探针移出生产入口后全量Node **517/517**、Python **10/10**通过。详见[F7证据](wps-phase1-f7-evidence-20261017.md)和[F8证据](wps-phase1-f8-evidence-20261017.md)。
- 真实 WPS 表格构建号实测 `12.1.0.29161`；F7 安装生命周期未修改用户真实 publish.xml，也未重启用户正在使用的 WPS。真实 WPS 浮窗打开证据沿用 F6。
- 其他 WPS 版本未在本机隔离环境实测，不列入支持范围。

## 八、正式候选包（2026-10-20）

候选包文件名：

```text
wps-rfq-addin-0.1.0-20261020-R1.zip
```

候选包版本 `0.1.0`，构建标签 `20261020-R1`，共100个文件。压缩包 SHA-256、运行代码版本和逐文件 SHA 以 `docs/wps-phase1-release-manifest-20261020.json` 为准；安装前请先核对该清单与下载资产的哈希。

从压缩包安装：

1. 将压缩包解压到任意用户目录，解压后应看到 `main.js`、`ribbon.xml`、`src/`、`dev/`、`install/` 和 `docs/`。
2. 在该解压目录打开 PowerShell，执行：

```powershell
pwsh -File .\install\install.ps1
```

3. 安装脚本只复制发布白名单文件：`main.js`、`ribbon.xml`、`taskpane.html`、`styles.css`、`package.json`、`rules/`、`src/`、运行所需的 `dev/*.cjs`、`assets/`。测试、样本、诊断脚本、开发探针入口和本机证据不进入 AppDir。
4. 安装后访问 `http://127.0.0.1:38891/health`，应看到 `service=wps-rfq-addin`、`version=0.1.0`、绝对 `scriptPath`、`startedAt` 和 64 位 `codeVersion`。该 `codeVersion` 应与同目录 `candidate-manifest.json` 中记录的运行代码版本一致。
5. 重启 WPS 表格，从“材料整理”功能区打开材料整理助手，按[用户说明](wps-user-guide.md)执行三步简版或详细步骤。

候选包边界：

- 开发探针模式已从生产入口 `dev/server.cjs` 移除，放在不进入候选包的 `dev/probe-server.cjs`；候选服务没有 `/__probe/report` 入口，也不加载任何诊断脚本。
- 候选包只包含合成/虚拟测试所需的产品资源，不包含原始招标清单、报价、联系人、凭据、本机项目/库/模板或运行日志。
- 历史 32 类迁入和其他 WPS 版本不在本候选包的支持声明内；详见发布清单和 `20261020` 发布证据。
