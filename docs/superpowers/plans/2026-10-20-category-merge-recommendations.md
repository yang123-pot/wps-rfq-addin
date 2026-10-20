# 推荐合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统先整理合并候选，用户选择保留名称或保持独立并人工确认。
**Architecture:** 服务端聚合各分类的名称、别名、规则和材料签名，产生去重的无向候选对并按证据排序；按库revision缓存。复用window/page分页、mutate乐观锁和既有preview/merge；前端只处理每页10卡。
**Tech Stack:** 现有Node/CommonJS、纯JavaScript、WPS WebDialog、Edge浏览器回归，无新依赖。
**Spec:** `docs/wps-category-merge-recommendations-20261020.md`

## Global Constraints

- 不增加第三主页签；每页10组，服务端上限50组。
- 无需询价、停用/已归档分类不参与；不自动合并，不改已确认项目。
- 13.2MB完整库不传到页面；代表材料最多各2条且截断长特征，不返回history/sources。
- 所有修改用expectedRevision；真实库只读，变异仅临时合成库。

## Review Focus

- 名称是上下位关系仍可保持独立；弱名称证据不伪装为确定同类。
- 保持独立后仅本候选实质证据改变才重现，不被其他分类或确认来源变化打扰。
- 双方选择反转/分页/刷新期间旧预览不能覆盖当前选择或直接合并。
- 库缓存对同revision外部改盘失效；页面不能收到历史/来源/全候选集。
- 旧项目分类与原生验收数据保持；新入口只复用明确合并和未确认项目同步边界。

### Task 1: 候选与保持独立模型

**Files:** 新增`wps-addin/dev/library-recommendations.cjs`、`wps-addin/test/library-recommendations.test.cjs`。
**Interfaces:** 消费完整服务端state；产出`scan(state) -> Array<{id,evidenceKey,categories,reasons,strength}>`、`page(state,query,candidates)`、`dismiss(state,operation,candidates)`。双方categories含id/name/rules/memories/examples，例子不含sources。
- [ ] RED：新增名称两例、相同签名证据、固定/停用排除、单对去重、无修改输入、保持独立持久/证据变化、最多50分页与短代表样例测试；运行`node --test wps-addin/test/library-recommendations.test.cjs`，应因模块不存在失败。
- [ ] GREEN：聚合一次后配对；名称LCS至少共享2字且覆盖短名80%/长名50%或高相似，名称仅候选。证据键不含来源数/更新时间/其他类别；保持独立核该证据键并审计。
- [ ] 验证同命令全过，再提交明确模型/测试/图和计划文件。

### Task 2: 缓存与分页服务

**Files:** `wps-addin/dev/library-store.cjs`、新增`wps-addin/test/recommendations-store.test.cjs`、扩充`library-window-server.test.cjs`。
**Interfaces:** `store.page({kind:'recommendations',page,pageSize})`返回revision/page/pageSize/total/items；`store.mutate({expectedRevision,operation:{type:'keep-separate',categoryIds,evidenceKey}})`返回库revision。
- [ ] RED：store分页类型、重启忽略保持、过期revision拒绝、外部同revision变化使缓存失效、HTTP鉴权/有界响应。
- [ ] GREEN：按revision缓存scan结果；磁盘身份/写盘失效，与旧save/learn/merge共用写队列，保持独立字段随library保存。
- [ ] 运行相关模型/store/HTTP用例应全过；明确清单提交推送。

### Task 3: 推荐卡片与最终验证

**Files:** `wps-addin/library.html`、`library.css`、`src/library-window-ui.js`、新增`test/ui-merge-recommendations-check.cjs`及交接证据。
**Interfaces:** 消费Task2分页及既有window/preview、merge操作；每卡独立预览身份，复用项目同步检查。
- [ ] RED：真实临时服务浏览器先测自动候选、选择无写入、方向预览、乱序旧响应丢弃、保持独立重开隐藏、确认才迁移并去重；缺推荐区应失败。
- [ ] GREEN：分类管理顶部10卡及分页，保留名称按钮、保持独立、卡内预览/确认及项目同步；错误保留可重试，行操作保持原版本锁。
- [ ] 全量Node、全部常规UI、13MB真实库只读分页/缓存性能、图及截图视觉核对；一名独立审查者检查本次ceef04d至HEAD范围，仅对重要问题作一次TDD修复。
- [ ] 用户关闭插件窗后，同native-01目录核身份加载新版，原F5 465文件与注册SHA保持。更新handoff/验收记录，明确暂存、提交推送并核远程；保留原生待验项。
