# R4 验证记录：自动分类与审核成果表

> 日期：2026-09-26。范围：handoff 第5节 R4。**模型＋模拟宿主＋浏览器验证；真实WPS核验仍未执行（R2挂账继续）。**

## 1. 本包对应图号与验收点

已按第1节规则实际打开全部8张效果图。本包对应**图02**（并采用图03的9列列序）：

| 图02/03要素 | 实现情况 |
| --- | --- |
| 9列：序号、项目名称、规格、单位、工程量、自动建议、匹配情况、最终分类、审核备注 | 已实现，表头在第3行、数据从第4行起 |
| 规格列保存完整项目特征描述 | 已实现（直接取合并后的完整feature） |
| 唯一可靠建议预填“最终分类”，冲突/无建议留空 | 已实现：6行唯一建议＋1行无需询价预填，冲突行留空 |
| 冲突/异常行突出显示 | 已实现：冲突整行橙色填充 |
| 最终分类浅黄色可编辑并带下拉 | 已实现：浅黄填充＋区域引用下拉（内部“类别编号/名称”表） |
| 侧栏显示“自动匹配完成”“尚未人工确认”，主按钮“打开成果表审核” | 已实现：生成前为“生成审核成果表”，生成并校验后变为可“打开成果表审核” |
| 编码/来源保留在内部绑定，不出现在主表 | 已实现：编码/来源边界/来源标识/库版本只进“内部绑定”表；随行rowId放隐藏K列 |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/classification-review-model.js` | 新增：调用既有规则/记忆给出建议（不确认、不学习）；9列模型＋主表/内部选项/内部绑定三张表；等宽矩阵、浅色表头、浅黄填写区、冲突橙色、隐藏rowId列、冻结与打印、区域下拉 |
| `wps-addin/src/classification-review-host.js` | 新增：成果表写入（复用export-host的版式与校验）、绑定生成（路径/SHA/表位/rowId/固定字段/库版本/类别/inputKey）、按稳定rowId整表读回（排序不误判、固定字段改动/缺行/重复/未知行定位报错）、打开成果表供用户编辑 |
| `wps-addin/src/workbook-layout.js`、`export-host.js` | 列定义支持`hidden`并写入/读回校验（随行隐藏辅助列） |
| `wps-addin/src/classification-ui.js` | 暴露`library()`/`ensureLibrary()`供自动分类复用同一分类库与习惯 |
| `wps-addin/src/workflow-ui.js` | 复用页面已声明的阶段面板（R4的自动分类面板写死在HTML里，便于扩展） |
| `wps-addin/src/import-ui.js` | 确认合并选择后自动跑分类、渲染图02侧栏、生成/重新生成成果表（真实prepare→写入→commit→verify，相邻暂存）、打开成果表；项目名优先取清单“工程名称” |
| `wps-addin/src/project-ui.js` | 成果表绑定保存到项目`matching`字段并随项目恢复 |
| `wps-addin/taskpane.html`、`dev/server.cjs` | 新增自动分类阶段面板与脚本登记；`/api/export/prepare`支持`adjacent` |

关键SHA256：`classification-review-model.js` = `39A890699DBD0A96F737CA52F262F8CCC46FB0E5B550ABD66FB048F92922C11A`；`classification-review-host.js` = `B2A3BD1307DEE00D4F6D67E44C127FB4631727A81E522DE894773E140676F1D9`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/classification-review-model.test.cjs wps-addin/test/classification-review-host.test.cjs wps-addin/test/classify-memory.test.cjs
# tests 17 / pass 17 / fail 0
node wps-addin/test/ui-workflow-check.cjs
# PASS（含R4自动分类与成果表生成断言）
node --test wps-addin/test/*.test.cjs
# tests 270 / pass 270 / fail 0
# 侧栏用例12组全部PASS
```

## 4. 关键行为证据（模拟宿主）

- **只给建议**：合成样例8行 → 6行唯一建议、1行无需询价、1行冲突；`counts.pending=8`，审核备注全空；传入习惯记忆后其内容不变（不学习、不确认）。
- **预填规则**：水泵/阀门/风机预填“水泵/阀门/风机”，钢索预填“无需询价”，充电桩配电箱因冲突留空且`abnormal=true`、依据写明“命中多个类别”。
- **主表纯净**：公开列固定9列，项目编码不出现在主表；K列存放稳定rowId并隐藏；内部绑定表保存rowId/编码/来源/库版本。
- **读回健壮**：整表反序后仍按rowId一一对上；表内改“最终分类/审核备注”可直接读回并解析回类别编号；改工程量报`field-changed`（第4行第5列）；删行报`row-id-missing`＋`row-missing`；复制行报`row-id-duplicate`；外来标识报`row-id-unknown`。
- **打开方式**：读回优先复用同路径已打开簿且不关闭用户簿；自开簿只读打开并在结束后恢复宏安全值与活动工作簿；生成后打开成果表则是“故意保持打开并置前”供用户编辑。
- **侧栏流程**：确认合并选择后立刻显示“自动匹配完成 / 8 行结果已写入成果表 / 7 行有建议 · 1 行需重点核对 / 尚未人工确认”；生成经真实相邻暂存与独占发布（目标文件不允许覆盖），随后可在项目记录里看到`matching`绑定（路径、8个rowId、8条固定字段快照、ck2 inputKey）。

## 5. 未完成与挂账

- **真实WPS核验未做**：成果表在下拉、中文与冻结打印上的真实表现仍属挂账（与R2小样一起补做）。
- 表内审核（整表确认、学习）属R5；本包**没有**确认任何分类，也没有生成分类工作簿。
- “匹配情况”列在生成时采用图02口径（匹配成功/无需询价/分类冲突/无可靠匹配）；图03的“一致/存在差异”比较将在R5整表读回时重算。

## 6. 下一步

R5（表内审核、整表确认与学习）：先测排序/筛选/未保存编辑/空或未知分类/重复缺失ID/固定字段变化/旧inputKey；“保存审核成果”只存草稿；主按钮读回全部行并按rowId校验，错误定位到单元格；通过后先落确认快照再进R6，确认落盘才学习。
