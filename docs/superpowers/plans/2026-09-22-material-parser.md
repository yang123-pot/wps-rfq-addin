# 清单识别与来源预览实施计划

> 使用 superpowers:executing-plans 在当前任务直接实现，按 test-driven-development 验证；用户已经授权持续推进。

**Goal:** 在WPS侧栏识别当前工作簿的全部材料候选行，显示数量和工程/专业来源，明确暴露不确定项。

**Architecture:** 纯JavaScript解析WpsHost快照，保留原字段及坐标。界面只展示结果和定位原行；本任务不写原表，不执行合并和分类。

**Tech Stack:** 原生JavaScript、WPS Application API、Node原生测试。

**Spec:** `docs/wps-addin-phase1-design-v2.md`及根目录`handoff.md`。

## Global Constraints

- 原始清单不修改、不丢弃异常数量；保留编码及名称/特征/单位的原文本，供以后精确合并。用户追加确认：缺少专业小标题时按清单“项目名称”识别专业，注明依据；通用名称仍待核对。
- 所有表都检查；没有表头、字段不完整、重复字段和无法判断的非空行明确列为问题。空白页单独说明。
- 单价、合价不进入材料对象。有效清单候选包含施工/措施项目，是否无需询价由分类核对阶段决定。
- 保持现有特性分支；每任务完成验证、交接、明确文件暂存、提交推送并核对远程SHA。真实样本及解析结果只保留本机。

## Review Focus

- 重复分页表头或工程标题变化不能造成重计、漏项或串专业。
- 缺失编码/单位/数量的材料候选不能当作标题或静默过滤。
- 无明确层级的未知区段不得继承上一个专业；“内部/外部”等位置子标题可继承。
- 数字编码可能有格式前导零；现阶段必须提示核对，不能声称已恢复显示编码。
- UI读取失败或用户切换工作簿后，不能显示旧结果为新结果或错误定位。

### Task 1: 材料解析、来源判断与侧栏预览

**Files:** 新增`wps-addin/src/parser.js`、`wps-addin/test/parser.test.cjs`；修改`src/taskpane.js`、`taskpane.html`、`styles.css`和开发资源白名单；验证文档及handoff。

**Interfaces:**
- 输入`WpsHost.readWorkbook(application)`的`{name,path,sheets:[{name,startRow,startColumn,rowCount,columnCount,values}]}`。
- 输出`RfqParser.parseWorkbook(snapshot)`的`{name,path,materials,sheets,issues}`；materials含`id,code,name,feature,unit,quantity,quantityRaw,source,issueCodes`，quantity为规范十进制字符串或null；source含文件、表、绝对行列、工程标题、专业及当前区段。
- sheets含材料数、表头位置与每行audit；issues含sheet,row,column,code,severity,message，未解决问题留给后续核对流程。

- [x] 写测试：偏移/换序表头，文本前导零和空格原样，多表及重复表头，空页与不支持页，缺失字段与歧义表头，缺编码/单位/数量，异常数量和零，工程变化、专业冲突及位置子标题，数字编码提醒，输入不变及不输出价格。
- [x] 运行`node --test wps-addin/test/parser.test.cjs`，预期因解析模块缺失失败。
- [x] 实现`parseWorkbook`：精确表头别名映射；每行审计；工程标题/区段优先，无专业上下文时按项目名称推断并提示核对；不从材料特征推断；严格十进制数量校验。发现项目四长特征续行，增加先失败后通过的回归测试，保留全部段落与来源行，核对归属后才能用于后续整理。
- [x] 将侧栏按钮升级为读取并识别；各页材料数、全部问题与分页材料预览可查看，支持定位当前原行。无宿主、错误、切换工作簿有明确提示。
- [x] 运行全套Node测试，43项通过；四份本地快照材料候选数263/3143/1473/2708，全部原行一一对应、原件哈希不变；专业推断1065条，仍不明确1581条。
- [x] 浏览器验证真实DOM在无宿主、合成宿主、读取失败、分页/筛选/定位保护下的行为；浏览器验证不冒称新的WPS实机验证。
- [x] 独立复核的分页标题串来源、仅名称行静默丢弃两项重要问题已复现修复并全套验证；无其他已报告缺陷。更新交接，按明确清单提交推送并核对远程SHA。

本任务只实现识别预览；可选多工作簿精确合并、来源修正保存和后续分类按交接顺序继续。
