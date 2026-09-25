# WPS询价插件安装与卸载说明（2026-09-26）

脚本位于仓库`wps-addin/install/`：`install.ps1`、`start.ps1`、`uninstall.ps1`。全部是用户级操作，不需要管理员权限，也不修改WPS或Windows的安全设置。

## 一、安装

```powershell
pwsh -File wps-addin\install\install.ps1
```

默认行为：

1. 备份WPS的`publish.xml`为`publish.xml.bak-时间戳`；
2. **只增改本插件节点**（name/guid=`WpsRfqAddin`），其他插件节点原样保留；重复执行只会得到一个本插件节点；
3. 把发布文件复制到`%LOCALAPPDATA%\WpsRfqAddin\app`，并**剔除探针与诊断脚本**（`host-probe.js`、`pane-diagnostics.js`、`acceptance-probe.js`）；
4. 以隐藏窗口启动本机服务，只监听`127.0.0.1:38891`；端口已被本插件占用时不重复启动，被其他程序占用时报告原因而不结束陌生进程；
5. 做健康检查（`/health`返回`wps-rfq-addin`）。

可覆盖参数：`-SourceDir`、`-AppDir`、`-PublishPath`、`-DataRoot`、`-Port`、`-SkipService`、`-SkipHealthCheck`。

安装后请**重启WPS表格**，再从“项目询价”功能区打开侧栏。

## 二、日常启动

```powershell
pwsh -File wps-addin\install\start.ps1
```

单实例：已在运行时只报告状态；端口被其他程序占用时说明原因，不抢端口。

## 三、卸载

```powershell
pwsh -File wps-addin\install\uninstall.ps1
```

1. 只停止本插件服务进程（先读pid文件，再核对命令行含`server.cjs`；命令行不符则不终止）；
2. 从`publish.xml`里只移除本插件节点，其他插件节点不动（同样先备份）；
3. **默认保留**`%LOCALAPPDATA%\WpsRfqAddin`下的项目、分类库、抬头模板与导入副本，并打印位置；
4. 需要连程序目录一起删除时加`-RemoveAppDir`（只允许删除预期路径`...\WpsRfqAddin\app`）。

## 四、升级与回退

1. 升级：先备份`WpsRfqAddin`目录，再覆盖代码并重新执行`install.ps1`；
2. 回退：`publish.xml.bak-*`是注册回退点，`WpsRfqAddin`目录是数据备份；回退代码后重新安装即可；
3. 旧程序遇到未来的数据版本会拒绝读写并保留原文件，不会覆盖。

## 五、已知限制（安装相关）

- 支持版本尚未定论：本机只在WPS表格`12.1.0.29161`上实测过，28043等版本需要隔离环境验证；
- 安装脚本已用合成`publish.xml`在临时目录真实执行验证（其他插件节点保留、卸载保留数据）；**本机真实WPS上的安装、重启、升级、回退、卸载流程还没有执行**，属于待验收项。
