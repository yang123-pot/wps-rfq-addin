# 多工作簿归属与重复材料处理证据（2026-10-18）

工作包：材料整理助手导入口径修正。用户实际查看并确认的对应效果图为 `docs/mockups/approved-20260926/01-import-merge.png`；简版当前步骤同时对照 `docs/mockups/approved-20261017-ui-simplify/01-current-step.png`。原 PNG 不重绘，本轮以[图01变更说明](mockups/approved-20260926/amendments-20261018.md)补充口径。

## 1. 用户确认口径

- 一次导入对应一个项目。
- 多个工作簿默认归入该项目的同一份材料清单和审核成果。
- “分别保留（按工作簿分组）”只表示保留全部材料行及来源，不执行重复材料累加。
- “合并完全相同项”是独立开关：仅项目名称、项目特征描述、单位完全一致时精确累加数量；不模糊匹配、不换算单位。
- 选择“分别保留”不会生成多套审核、分类或询价成果。

## 2. 实现

- 第1步标题改为“选择材料处理方式”；多工作簿提示明确“所有工作簿默认归入当前项目，汇总为同一份审核成果”。
- 默认选项改为“分别保留（按工作簿分组）”，说明保留全部材料行、不累加重复项，并记录工作簿、工作表和来源行。
- “合并完全相同项”说明所有工作簿仍属于当前项目，只累加完全相同的材料。
- 统计行显示“N 份清单归入当前项目 · 原始 X 项 → 预览 Y 项”，避免把工作簿归属和重复项处理混为一谈。
- 导入预览主表同步改为“材料处理预览（按来源分别保留，同一项目）”，并说明来源与数量处理规则。
- 主按钮文字保持已批准图01的“确认选择，开始自动分类”。
- 用户说明、图01效果图变更说明及 manifest 已同步。

## 3. 验证

### 3.1 全量 Node

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：**518/518 通过，0 失败、0 跳过**。

### 3.2 定向测试

```powershell
node --test test/import-preview-model.test.cjs test/merge.test.cjs test/collection.test.cjs
```

结果：**20/20 通过**。覆盖两个工作簿默认保留 10 行、来源边界不丢失、只有显式选择才精确合并为 8 行、预览文案与“同一项目”一致。

### 3.3 浏览器界面

```powershell
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node test/ui-import-check.cjs
node test/ui-workflow-check.cjs
node test/ui-simple-check.cjs
```

结果：三项均 **PASS**。覆盖双工作簿导入、默认分别保留、多工作簿提示、同一项目统计、选择合并后 10→8、确认前不匹配、380px 无横向溢出和简版入口。

## 4. 实际页面截图

本机证据（不入 Git）：

- `outputs/wps-phase1-ui-simplify-20261017/multi-workbook-section-confirmed-20261018.png`：380px 侧栏中的材料处理区，显示双工作簿、同一项目、同一份审核成果、默认按来源分别保留。
- `outputs/wps-phase1-ui-simplify-20261017/multi-workbook-default-20261018.png`：完整页面默认状态。
- `outputs/wps-phase1-ui-simplify-20261017/multi-workbook-merged-20261018.png`：选择合并完全相同项后的页面。

截图来自 Playwright/Edge 模拟 WPS 宿主，不替代真实 WPS 浮窗验收。

## 5. 未完成与边界

- 仍需在真实 WPS 浮窗中导入多个工作簿，确认提示、默认选项、确认后进入自动分类与真实浮窗布局。
- 第1步原生文件对话框、审核成果表保存、拆分目录和项目重新定位在真实 WPS 中的停绘情况仍待用户实测；本包未改变这些选择器。
- 本包未生成或改写真实项目成果、分类簿、询价表或拆分件，未写生产分类库。
