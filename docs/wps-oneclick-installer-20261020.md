# 中文一键安装程序

本包依据 2026-10-20 用户在本会话批准的安装方案：一个可双击的 EXE；内置插件专用 Node.js 与 PowerShell；检测 WPS；缺少时提供官网安装及重新检测；升级保留用户资料，失败回退。既有七步业务与工作簿版式不变。本包没有历史安装界面效果图，以这份已批准的文字流程为依据；产品名称和绿色主按钮参考已实际查看的新版图01。

## 用户流程

1. 下载“材料整理助手安装程序”EXE，双击打开，无需解压、输入命令或单独安装 Node.js / PowerShell。
2. 安装程序检查内置组件、Windows、WPS 表格及正在运行的 WPS。
3. 找不到 WPS 时提供“安装 WPS”（官方网站）和“重新检测”。本包不分发、不替换 WPS 安装程序。
4. 已验证 WPS 为 12.1.0.29161。其他版本显示“尚未验证”，须明确勾选理解该限制才可继续，不能视为兼容验证通过。
5. WPS 正在运行时提醒保存并关闭，不强制结束 WPS。
6. 点击“一键安装”或“升级 / 修复”，完成后可打开 WPS，在“材料整理”功能区打开助手。
7. 桌面、开始菜单和当前用户启动目录提供入口，登录后准备本机服务。入口使用保存下来的专用运行环境，不依赖 PATH。

## 实现与数据边界

- 原生 .NET Framework WinForms 外壳，用户级权限；单 EXE 内嵌经过 SHA-256 核对的载荷。
- 载荷包含当前发布白名单产品文件、Node.js 22.23.3（官方 ZIP 中的 node.exe 和 LICENSE）、PowerShell 7.6.7 官方 ZIP 全部文件及许可；下载位置与官方校验值锁定在 `wps-addin/install/desktop/runtime-lock.json`。
- 安装逻辑使用 Node 文件 API；内置 PowerShell 仅执行固定的系统查询、WPS 注册 XML 和快捷方式操作，不调用 `.ps1`，不改执行策略，不安装全局 Node 或 PowerShell。
- 保留 AppDir、DataRoot、publish.xml 的原有职责。DataRoot 的 imports/library/projects/headers/splits 不随升级删除。
- 只匹配 name/guid 为 WpsRfqAddin 的注册节点；同端口其他插件保留。进程停止前核对 PID、绝对脚本路径、创建时间与实际代码版本。
- 程序先复制到同级暂存目录，核版本后再切换；注册和代码备份保留；新服务身份/健康检查失败恢复旧程序、原始注册及旧服务。
- 未识别的既有服务、其他程序占端口时明确失败，不停止未知进程。
- 运行时、安装 EXE 和实际验收记录仅放本机 outputs 或发行资产；Git 只提交源码、测试、锁文件和说明。

## 构建

开发机使用 PowerShell 运行 `wps-addin/install/desktop/build.ps1`，传入绝对 `-CacheDir`、`-OutputDir` 和唯一 `-Build`。脚本校验锁文件中的两个官方 ZIP 的 SHA-256，再打包、编译并写出发行回执。终端用户无需运行该脚本。

既有 `docs/wps-phase1-release-manifest-20261020.json` 只作为产品路径白名单。新安装器和当前产品文件的实际 SHA 应以新生成的安装器回执及其载荷为准；旧版 ZIP 的哈希不能用于校验新的 EXE。

## 验证记录

- 入场原有全量 Node 618/618。
- 桌面安装专项：17/17；全量 Node 635/635。包含真实 Windows 隔离目录的安装、升级、新服务启动失败回退、恢复后重启；其他插件注册和项目哨兵均保留。新增覆盖中断运行时复制、只读安装记录失败、部分快捷方式失败、PID复用与并发启动。
- 实机只读检测识别到 WPS 原生 FileVersion 为 `12,1,0,29161`，现已规范化，避免误判为未验证版本；当前 WPS 正在运行时正确阻止安装。
- 首个完整 EXE（144809472字节）内置的 Node 与 PowerShell 官方 ZIP SHA 均核对通过。在子进程 PATH 仅含 Windows/System32 的条件下执行 EXE 的 `--verify-package`：退出0，完整载荷解压成功，实际运行 Node v22.23.3 / PowerShell 7.6.7 并识别真实 WPS 12.1.0.29161；WPS 正在运行时 ready=false 且按钮禁用。没有改系统 PATH。
- 从包内复制出的专用运行环境实际安装到隔离目录，服务 SHA 与产品发布版一致；两个无全局 PATH 的 CLI 并发启动均退出0，项目哨兵和其他插件注册保持；服务按身份核对停止并清理临时目录。
- 原生 WinForms 渲染核对了缺少 WPS、未验证版本确认和 WPS 正在运行三个状态；其中前两个为受控输入，当前主机 WPS 正在运行状态来自真实包内检测。不把受控截图写成另一台新电脑的实机结果。
- 独立审查发现并修复4项事务/界面问题及1项并发启动问题；复审无未修复 Critical / Important。最终按提交重建后另核发行 EXE / SHA。
- 安装程序暂未做 Authenticode 代码签名，Windows 可能显示未知发布者；不承诺免除 SmartScreen 或安全软件提示。用户真实点击“一键安装”替换当前在用插件尚未执行，本包不为验收而关闭用户 WPS 或替换真实注册。

本机证据目录：`outputs/wps-oneclick-20261020/`。本包不重装用户在用插件、不改现有真实 publish.xml、不停止在用 WPS 或端口38891服务。

## 正式下载资产

[GitHub v0.1.0 下载页](https://github.com/yang123-pot/wps-rfq-addin/releases/tag/v0.1.0)已新增 `WpsRfqAddin-Setup-0.1.0.exe`，构建 `20261020-setup2`，144818176字节（约145MB）；SHA-256 为 `0ccaa76aa754a66c4fa1ea62e8f541d295a3450d84391791ed8e10ccd996ad1f`。GitHub 会规范化上传文件名，因此发布资产使用 ASCII 名称，内容与本机中文文件名版本逐字节一致。

最终包来自已推送源码提交 `5472ef6c764b35dd07fdf09f81d353808ea27bb0`，产品白名单102项实际SHA写入载荷清单。最终EXE再次完成完整载荷解压/无全局PATH检测，以及复制出的官方运行环境隔离安装/两个并发CLI启动，退出均为0。服务代码版本与原0.1.0业务版一致；这次补充安装器，不重建原ZIP或移动发布标签。

EXE、`installer-20261020-setup2.json`、`INSTALLER-SHA256SUMS.txt` 三份资产均以本地实际 SHA 与 GitHub 服务器 digest/字节数核对相同；未声称从远端重新下载145MB并复验。上传后更正文件名的小清单第一次替换遇到HTTP502，重试成功，最终三份一致。公开回执见[发行回执](wps-oneclick-installer-release-20261020.json)。截图、运行日志及包含本机路径的隔离报告仍仅保留 outputs，不上传。
