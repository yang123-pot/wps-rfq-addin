# 2026-10-19 第7步原生输出目录选择

用户指定：输出文件夹选择改为与第1步相同风格的原生界面，更贴合WPS操作环境。已更新并实际查看补充图10，README说明以真实WPS/Windows对话框外观为准；仅改变目录选择，不重画后续拆分流程。

## 实现

- 简版主操作与详细版目录按钮统一走原生`selectFolder`。第7步不再静默回退网页目录树。
- 修复原 helper 将`Application.FileDialog`取出后独立调用导致接收者丢失的问题，改为保留宿主绑定的`app.FileDialog(4)`。
- 保留`SelectedItems.Item(1)`兼容形式，并支持JSA可调用集合`SelectedItems(1)`。标题与初始目录正常设置。
- 确认但未返回有效路径时明确报错，与取消区分；宿主不支持或调用失败时保留具体原因，不改变已有目录或进行拆分。
- 取消/关闭不读取选择结果，不再次弹其他对话框，原目录和回执保持；确认后才进入原目标预检，点击开始拆分才发布文件。
- 内嵌路径组件仍供其他兼容用途，第7步不调用它。

WPS官方[FileDialog说明](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/kso/FileDialog/obj)列明原生对话框及目录选择语义；[类型枚举](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/kso/enum/MsoFileDialogType)指定4为文件夹选择。文档与模拟测试不证明当前真实WPS接口一定可用；本轮没有读取真实宿主FileDialog能力或调用错误，实际弹窗仍待验证。

## 验证

- 新增5项native-folder-picker测试，修改前3项因宿主接收者、可调用集合和“确认却无路径”处理失败，修改后5/5通过。
- ui-split明确验证详细入口调用原生类型4、简版原生取消保留目录、接口缺失时不回退网页且保留目录，随后原有失败续作与7件拆分校验仍通过。
- 全量Node558/558，相关浏览器`ui-split`、`ui-continuous`、`ui-cancel`、`ui-project-restore`、`ui-assistant`、`ui-inquiry`共6/6通过。
- 38891所供path-picker.js和split-ui.js与磁盘SHA一致。当前已加载旧JS的浮窗需重建；运行服务、注册和业务文件未修改。

## 实际项目及接续

只读核对实际项目`p-mveqkhq6-nhs6crm1`为revision20，总询价工作簿存在、SHA与generation记录一致，绑定42份询价页；split仍为空。本轮未重生成或拆分，不将SHA核对当作全部逐值/打印验收通过。

用户先取消截图中的旧网页选择器并保存项目，随后功能区重建窗口、打开版本20，直接到第7步点选择输出文件夹，核真实原生窗口可打开、取消和确认后回填，最后继续拆分。若宿主仍失败，应据明确错误定位，不再把网页选择器当原生验收结果。
