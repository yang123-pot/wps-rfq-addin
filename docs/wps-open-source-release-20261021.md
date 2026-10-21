# GitHub 开源发布核验（2026-10-21）

用户明确要求在 GitHub 发布并开源，并选择 MIT 许可证。发布目标为现有仓库 `yang123-pot/wps-rfq-addin`，沿用既有 `v0.1.0` Release 及 20261021-r2 安装器，不移动旧标签、不覆盖原资产。

## 发布准备

- 入场仓库为 PRIVATE，默认 main；最新安装器源码在 `feat/wps-ui-v2` 的 `c0922f2`（修复源码 `7c7b986`）。main 是该分支祖先，可正常快进，无需强推。
- 新增 GitHub 官方模板 MIT LICENSE（2026 / yang123-pot）、第三方许可说明及贡献说明；更新首页下载、使用流程、源码入口与安装说明中的私有访问提示。
- 本包对应安装与发布说明，实际查看 `docs/manuals/quick-guide/installer-interface.png`；不修改业务流程和界面，不重新执行历史功能包。
- 扫描 Git 全分支可达的 2127 个文件对象（114323982 字节）；没有跟踪原始 xls/xlsx/csv/密钥文件。常见 GitHub/OpenAI/AWS 凭据及私钥格式在按词边界复核后为 0；初次宽泛 sk- 命中全部为 disk- 文件名误报。文本联系方式命中均为合成 example@example.com 测试/示意。
- 自动扫描有模式覆盖边界，不将其表述为所有隐私内容的绝对保证。已有文档中的本机路径及开发记录随历史保留，未新增上传原始输入、报价或运行数据。
- 本机审计与日志位于忽略的 `outputs/open-source-20261021/`；根目录入场 pane-diagnostics 修改、新版未跟踪长篇手册草稿保持，不纳暂存。

## 本轮验证

- `node --test wps-addin/test/*.test.cjs`：640/640，失败/取消/跳过均 0，退出 0，约79.6秒。未重新声称 WPS 原生安装验收。
- README / LICENSE / CONTRIBUTING / THIRD_PARTY_NOTICES / 安装说明的本地链接检查通过。
- 最终 Git 推送、公开状态和匿名访问核验在下方发布回执补记，以实际结果为准。

## 发布回执

- GitHub 已核为 PUBLIC、private=false、默认分支 main；许可证接口识别 SPDX `MIT`。
- 准备提交 `88dc40d8bfced5afa47556084896b529d2ec84a3` 已普通推送至 feat/wps-ui-v2 和 main，两条远程引用逐位一致；main 正常快进，未强推。
- 现有 v0.1.0 Release 保持非草稿、非预发布；新增 MIT `LICENSE.txt` 附件（1089字节，SHA-256 `b840ce4121d0d03ed6e9acbe48346e0ebb97bdeecdcfd20e7de1349dc0ec69b7`），发行说明加入开源与源码入口。原9份资产保留，r2 EXE服务器digest仍为 `dbbebd3dcd054e12b2e287a0dbf45a5452c95218e74d4a85e0684bde1118ae02`。
- 不带认证头访问 GitHub 项目首页、Release 页面、main README、main LICENSE 和 LICENSE.txt 下载均 HTTP 200；许可文件按Git换行归一化后内容一致，附件逐字节一致。
- 首次匿名 REST 请求遇到共享出口 API 限流403，改用匿名网页/raw/下载验证成功；中间一次远程引用核对遭TLS握手失败，未修改代理/系统配置。最后同步与远程引用以本机 `outputs/open-source-20261021/` 回执为准。
- 发行 ZIP 实际100项，无原始表格或运行目录；三个JSON清单可解析。未重打包安装器，许可作为独立附件提供；后续重打包须一同保留项目及第三方许可。

后续按用户实际安装反馈维护。公开地址：https://github.com/yang123-pot/wps-rfq-addin
