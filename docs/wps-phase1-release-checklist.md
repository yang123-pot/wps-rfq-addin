# 一期发布前核对清单（2026-09-27）

## 一、代码与自动化证据

- [x] `node --test wps-addin/test/*.test.cjs`：312/312通过。
- [x] R11新增恢复审计/重定位测试：4/4通过（含原有来源副本重建测试）。
- [x] 浏览器回归：`ui-workflow-check`、`ui-sheet-review-check`、`ui-brand-check`、`ui-inquiry-check`、`ui-split-check`、`ui-project-check`、`ui-project-restore-check`通过。
- [x] 合成输入用本机隔离目录生成：`outputs/wps-acceptance-20260926/r12/inputs/`，不入Git。
- [x] 发布资源白名单包含 `src/project-restore.js` 和R11新增用例；探针/诊断脚本仍从发布目录剔除。
- [x] `install.ps1`/`uninstall.ps1`只按`name/guid=WpsRfqAddin`匹配；同端口其他插件保留。
- [x] 升级前备份程序目录，复制失败回退旧程序目录。

## 二、真实WPS验收（当前阻塞）

- [ ] 安装→重启WPS→打开项目→升级→回退→卸载→重装后恢复。
- [ ] 真实WPS七步链路：导入合并→自动分类→表内审核→分类工作簿→品牌汇总→询价表→拆分文件。
- [ ] 真实WPS对8张效果图逐项截图对照。
- [ ] 真实WPS取消、已有文件、只读目录、第二份失败、服务中断、丢文件/外部改写。
- [ ] 供应商xlsx逐公开值、公式0、无内部隐藏页/路径/原价/历史价。
- [ ] 长特征、前导零、小数、分页、链接关闭重开、整目录搬移。
- [ ] 四项目复制件验收；未人工确认不得自动全选伪造通过。
- [ ] 停摆报告封存与侧栏重建恢复。

**阻塞证据：** 2026-09-27本机 Computer Use 初始化返回
`unsupported Codex auth method: apikey`；改用 `@oai/sky` 返回
`Trusted RPC service is not configured: sky`。因此无法合规点击真实WPS窗口。
自动化和模拟宿主通过不等于真实WPS通过，本期不得据此宣称一期完成。

## 三、数据与边界

- [x] 原始招标清单、报价、个人联系方式、凭据、本机配置和运行数据未进入Git。
- [x] 项目、分类库、抬头模板、导入副本和拆分回执位于`%LOCALAPPDATA%\WpsRfqAddin`，默认卸载不删除。
- [x] 导出审计覆盖内部页、隐藏页、公式、原价/历史报价/内部路径和个人联系方式。
- [x] 发布目录只包含运行所需资源，不包含探针/诊断/样本。

## 四、交付物

- [x] 七步用户说明、安装/升级/卸载说明、发布清单和handoff已更新。
- [x] R11证据：`docs/wps-workflow-v3-r11-evidence.md`。
- [ ] R12真实WPS验收记录：`docs/wps-workflow-v3-r12-blocked.md`记录阻塞，完成前不得勾选。
- [ ] 安装包/发布包哈希记录和真实安装回退记录。
- [ ] 至少一名按新版文档完成合成项目的真实WPS验收者。
- [ ] main合并或打发布版本另按明确安排执行。
