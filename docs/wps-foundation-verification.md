# WPS接入验证记录

日期：2026-09-22。范围：加载项接入与工作簿读取，不代表分类、学习和询价拆分已实现。

## 已完成验证

- WPS真实JavaScript加载项回报：脚本加载、功能区回调、创建侧栏、侧栏页面执行均成功。
- 新建测试工作簿，写入两张表，保存到中文路径，再以只读方式打开：`000123`前导零、工程量`12.5`、中文专业“给排水”均一致。
- 通过真实WPS JavaScript接口读取四个清单，分别为2、22、1、8张工作表，共33张。记录的是使用范围，尚未判断材料行数量。
- 19项Node测试通过，覆盖全部工作表读取、偏移坐标、空单元格、矩阵截断、范围限额、读取错误、工作簿归属保护、注册保留其他加载项、HTTP白名单与诊断令牌，以及副本保护原件。
- 独立只读代码复核未发现阻止接入阶段提交的具体缺陷。复核不等于其他WPS版本兼容性验证。

## 实机发现与处理

首次测试发现：即使以只读参数打开XLS，本机WPS仍可能改写文件内部WRITEACCESS记录及相关元数据。项目三和项目四发生了字节变化；逐单元格值、类型、格式及合并单元格对比一致，没有清单数据变化。

处理：保留变化后的文件作为本地证据；使用与测试前SHA256完全一致的历史副本恢复原件，四份原件哈希均恢复一致。开发探针现改为**先复制到唯一临时目录，再把副本交给WPS**。回归测试证明宿主修改副本不会触及原件。随后用隔离的WPS自动化实例重读这四份副本，33张表均可读，四份原件哈希不变。第二轮副本读取是COM验证，与第一轮JS加载项验证分别记录，不混称同一种接口。

真实用户主动在WPS中打开XLS时，WPS本身可能更新内部元数据；插件的只读扫描不写单元格。今后的自动导入、合并及实机测试都应使用工作副本，不仅依靠Open的ReadOnly参数。

## 本地证据（不上传GitHub）

- `outputs/wps-foundation-probe/run-20260922/host-report.json`：真实JS加载、侧栏、另存与四清单读取回报。
- 同目录`source-hashes-before.json`、`xls-change-analysis.json`、`source-hashes-restored.json`：前后核对与恢复证据。
- `outputs/wps-foundation-probe/run-20260922-isolated/copy-read-evidence.json`：隔离副本读取及原件哈希核对。
- 同目录`probe-inputs-*/manifest.json`：自动复制路径与原件哈希。

## 运行与限制

开发版无需安装项目依赖，Node.js 22以上即可。在项目根目录分别执行：

```powershell
node wps-addin/dev/server.cjs
```

```powershell
powershell -NoProfile -File .\wps-addin\dev\register.ps1 -Action Register
```

保持第一条命令运行，在WPS表格内通过“项目询价 → 打开询价助手 → 读取全部工作表”使用。普通浏览器打开页面会提示进入WPS；不会模拟读取成功。若WPS已缓存旧加载项，先自行保存正在编辑的文件，再重新打开WPS。

若系统未单独安装Node，本机Codex提供的可执行文件位于`%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。卸载开发注册使用同一脚本的`-Action Unregister`，只移除本插件，保留其他加载项与配置备份。

此版是本机开发接入，不是可交付的离线安装包。自动启动辅助脚本未纳入本次交付，启动方式以以上命令为准。读取结果尚未进行材料分类、品牌填写或询价文件生成。

技术依据：[WPS加载项开发说明](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/wps-addin-development-instructions)、[任务窗格说明](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/TaskPane/task-pane-overview)。使用publish开发注册，不修改WPS安装目录的oem.ini。
