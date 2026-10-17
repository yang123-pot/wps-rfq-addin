# 材料整理助手（WPS招标清单整理与询价插件）

将整个项目的招标清单分类、核对，生成面向供应商的独立询价文件。

**当前阶段：七步流程、项目恢复、总询价和一键拆分已在本机服务与模拟WPS宿主通过；真实WPS全链路R12因本机Computer Use认证错误暂未完成，不能宣称一期交付。**

流程：导入与合并 → 自动分类 → 表内审核并整表确认 → 生成独立分类工作簿 → 在分类汇总表填写品牌/供应商 → 带入询价抬头生成总询价工作簿 → 一键拆分为“类别_供应商名称.xlsx”。

第一期只整理和生成文件，由用户自行发送；微信和邮件发送留待下期。

## 项目入口

- [handoff.md](handoff.md)：核心设计、实际进度、下一步，每次接续任务先读。
- [AGENTS.md](AGENTS.md)：项目续作与GitHub备份规则。
- [详细设计初稿](docs/wps-addin-phase1-design-v2.md)：完整业务流程和待定交互。
- [接入实施计划](docs/wps-foundation-plan.md)：首个开发阶段的任务与验证进度。
- [运行说明与验证记录](docs/wps-foundation-verification.md)：开发版启动、已验证范围、原件保护及当前限制。
- [清单识别验证](docs/wps-parser-verification.md)：7587条候选、专业依据、特征续行及侧栏检查。
- [精确合并核心验证](docs/wps-exact-merge-verification.md)：可选合并计算及来源、数量保护；合并界面与另存尚未接入。
- [分类核对示意图](docs/mockups/classification-review.png)、[一键拆分示意图](docs/mockups/split-inquiry-files.png)：设计效果，非运行截图。

## 备份约定

本仓库保存当前WPS方案的文档、效果图及后续实现。每完成一个开发任务，完成相应验证、更新交接文档后，提交并推送GitHub备份一次。

旧网页源码与历史记录保留在原电脑；原始清单、报价数据、凭据和本机运行文件不上传。交接中标为本地资料的文件不包含在GitHub克隆中。
