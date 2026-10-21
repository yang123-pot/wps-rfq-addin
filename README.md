# 材料整理助手

WPS 表格插件：整理招标清单、核对材料分类、填写品牌与供应商，生成独立询价文件。采用 [MIT 开源许可证](LICENSE)，允许商用、修改及再发布，须保留版权和许可声明。

## 下载与安装

打开 **[GitHub 下载页](https://github.com/yang123-pot/wps-rfq-addin/releases/tag/v0.1.0)**，在 Assets 下载 **WpsRfqAddin-Setup-20261021-r2.exe**（约 145 MB）。保存文件并关闭 WPS，双击安装器，按“环境检测 → 一键安装 → 完成”操作。首次安装可选择程序目录；Node.js 和 PowerShell 已内置，无需单独安装。

安装后双击桌面“材料整理助手”，或从 WPS 顶部“材料整理”功能区打开。升级沿用原程序位置，项目数据、分类库和模板独立保留。

- 系统：64 位 Windows 10/11。
- 已验证：WPS 表格 `12.1.0.29161`；其他版本尚未验证。
- 当前发行：`0.1.0`，推荐安装器为 `20261021-r2`。安装器尚未代码签名。
- [安装与升级说明](docs/wps-install-guide.md) · [八页操作图解](docs/manuals/quick-guide/README.md) · [详细用户说明](docs/wps-user-guide.md)

## 使用流程

1. 选择清单，查看原工作表预览，选择是否合并完全相同材料。
2. 自动分类，在审核成果表中修改最终分类和备注，整表一次确认。
3. 生成一本多页的分类工作簿，首页为汇总表，名称可跳转到对应类别页。
4. 在汇总表填写品牌和供应商（允许留空），多组时选择合成一份或分别生成。
5. 填写询价抬头，生成总询价工作簿，再拆分供应商文件；有无需询价材料时单独保留，并导出完整总表。

原清单保留，报价单价与金额留空；文件由用户自行发送。分类学习库可在拆分核验后保存本次确认结果，供后续项目使用。自动分类结果仍须核对。

## 源码与开发

```powershell
git clone https://github.com/yang123-pot/wps-rfq-addin.git
cd wps-rfq-addin
node --test wps-addin/test/*.test.cjs
```

开发需 Node.js 22 或更新版本；WPS 宿主功能需在 Windows 和 WPS 中验证。测试与安装器构建方法见 [参与开发](CONTRIBUTING.md)。`wps-addin/package.json` 的 `private: true` 用于防止误发布到 npm，不影响仓库开源。

当前源码包含 2026-10-21 安装器修复；`v0.1.0` 标签保留首发源码，后续安装器源码及对应提交见发行说明。验证范围见[发布记录](docs/wps-release-published-20261020.md)和[安装器修复记录](docs/wps-oneclick-installer-fix-20261021.md)，不据此承诺其他 WPS 版本兼容或长期无故障。

- [handoff.md](handoff.md)：项目交接入口、最新进度与验收边界。
- [AGENTS.md](AGENTS.md)：续作与提交规则。
- [已批准效果图](docs/mockups/approved-20261018-wps-ui-v2/README.md)：设计资料，区别于真实运行截图。
- [第三方软件说明](THIRD_PARTY_NOTICES.md)：运行环境与许可归属。

原始招标清单、报价、个人联系方式、凭据、本机配置、运行数据和旧网页实现不纳入仓库。请在 [Issues](https://github.com/yang123-pot/wps-rfq-addin/issues) 反馈可复现问题，使用合成数据并遮盖敏感信息。
