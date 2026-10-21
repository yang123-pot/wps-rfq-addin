# 参与开发

欢迎通过 GitHub Issues 提交问题，通过 Pull Request 提交改进。贡献按项目 MIT 许可证提供。

报告问题时请说明 Windows 与 WPS 版本、操作步骤、预期和实际结果。使用合成清单复现，截图先遮盖工程名称、联系人、电话、报价及本机路径；不要上传真实招标文件、运行数据、令牌或凭据。

开发前阅读 [AGENTS.md](AGENTS.md) 和 [handoff.md](handoff.md)，核对最新设计及相关效果图。历史交接包含当时状态，当前规则以最新入口为准。

安装 Node.js 22 或更新版本后，在仓库根目录运行：

```powershell
node --test wps-addin/test/*.test.cjs
```

模型与宿主适配、本机服务分别位于 `wps-addin/src/`、`wps-addin/dev/`。浏览器 UI 检查另需 Playwright；真实 WPS 验证使用隔离副本，不覆盖用户原件。模拟宿主通过不等于真实 WPS 验收通过。

安装与 EXE 构建见[安装说明](docs/wps-install-guide.md)和[安装器构建说明](docs/wps-oneclick-installer-20261020.md)。输出留在忽略目录，不提交运行数据。提交前运行与改动对应的检查，只暂存明确文件清单。
