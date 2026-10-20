# 合并清单另存 Implementation Plan

> 使用 superpowers:executing-plans 在当前会话实施，最后由独立审查代理复核。沿用用户已授权一期设计与本次“任务继续”，不重复请求启动批准。

**Goal:** 核对通过后，显式确认当前分离/合并预览，另存带完整来源的xlsx；现有文件和原清单不被覆盖。

**Architecture:** export-model将collection转换为三个纯文本工作表；export-host通过WPS写入唯一暂存文件并重开逐值验证；本机export-files凭会话票据以独占方式复制到用户选择的位置。export-ui串联确认、文件名选择、准备、写入、提交及失败反馈。

**Tech Stack:** 现有原生JS UMD、WPS JavaScript API、Node22+本机服务、Node test及Playwright/Edge。

**Spec:** `docs/wps-addin-phase1-design-v2.md`第二节；`handoff.md`下一步第1项。此次不开发分类或询价文件。

## Global Constraints

- 只输出到新xlsx，保留所有原文件；副本和运行数据仅留本机，不上传Git。
- 复用collection/merge/review，默认不合并，输出记录合并选择及归集范围；待核对问题不允许另存。
- 编码、工程量等以文本写入，保留前导零和任意十进制精度，重开后逐值校验，不执行来源文本中的公式。
- 清单表包含序号、项目编码、项目名称、特征、单位、工程量、清单来源；来源明细保留每条原文件/路径/指纹/表/行/原值/核对值/范围，处理记录注明模式与内部文件用途。
- 不截断长文本：单元格32767字符上限、单表100万单元格、总计300万单元格，超限明确阻断。
- 不关闭用户工作簿。写入/重开失败只关闭本次自有工作簿并恢复原活动工作簿及宏设置；暂存文件可留本机供排查，不能报告已另存成功。

## Review Focus

- 目标已存在或在预检后被占用：最终独占复制仍拒绝覆盖。
- 前导零、超15位数量、等号开头和换行：重开后值精确保留且无公式。
- 未解决问题、取消确认/选择位置：不写工作簿、不发布目标文件。
- SaveAs/重开/提交失败与HTTP响应丢失：已有核对保留；同一票据重试不重复发布。
- 合并选择改变/核对改变后旧确认失效：另存始终捕获当前collection，确认后禁用操作直到结束。

## Task 1: 输出模型与WPS宿主

文件：新增`src/export-model.js`、`src/export-host.js`及对应`test/*.test.cjs`。

接口：`RfqExportModel.build(collection, mergeIdentical)`返回`{mode,inputCount,outputCount,sheets:[{name,values}]}`；`RfqExportHost.selectTarget(app, suggestedName)`返回路径或null；`write(app,model,stagePath)`写入并验证暂存xlsx。

- [ ] 失败测试：异常阻断、分离/合并、全部来源、原编码及精确数量、注入文本、长文本限制；宿主取消/只新建/文本写入/SaveAs51/重开核对/失败清理。

```js
const model=build(collection,true);
assert.equal(model.sheets[0].values[1][5],'0.3');
assert.equal(model.sheets[1].values.length,3);
assert.throws(()=>build(unresolved,true),/核对/);
```

- [ ] `node --test wps-addin/test/export-model.test.cjs wps-addin/test/export-host.test.cjs`先失败再实现通过。
- [ ] 全部写入范围NumberFormat='@'；分块写入和读取校验，验证HasFormula===false；保存、关闭、宏禁用重开后再次校验。

## Task 2: 独占另存及侧栏

文件：新增`dev/export-files.cjs`、`src/export-ui.js`及测试，修改server、import-ui、HTML/CSS。

接口：`createExportStore({directory})`的`prepare(target)`返回`{ticket,target,stagePath}`，`commit(ticket)`返回`{target,sha256,bytes}`，只能提交服务生成的暂存路径；重复commit验证目标指纹后返回同一结果。所有HTTP调用复用随机会话令牌、Host/Origin和请求大小限制。

```js
const prepared=await store.prepare(target);
await fs.writeFile(prepared.stagePath,zipFixture);
await fs.writeFile(target,'existing');
await assert.rejects(store.commit(prepared.ticket),/存在/);
assert.equal(await fs.readFile(target,'utf8'),'existing');
```

- [x] 失败测试覆盖目标扩展名/父目录、预检与最终冲突、无效票据/暂存、幂等重试、未经授权请求。
- [x] 实现 prepare/commit：规范父目录，拒绝已存在目标，唯一暂存目录；最终COPYFILE_EXCL，计算与核验SHA256。
- [x] 侧栏按钮“确认预览并另存清单”；显示当前模式、数量、内部来源说明后确认，选择位置；失败保留集合与核对，成功显示实际路径。
- [x] 浏览器覆盖阻断、两次取消、失败恢复、成功及模式切换，输出模型符合当前预览（`test/ui-export-check.cjs`，2026-09-24）。

## Task 3: 实机与交付

- [x] 真实WPS JS侧栏：用合成工作簿实测原生多选、导入、分别保留另存（3→3）与只读重开校验；导入链路已用诊断副本逐层取证。**勾选合并后另存仍未取得实机证据。**
- [x] WPS生成文件重开，检查三表值/格式/来源及数量，原件哈希不变（分别保留模式，见`docs/wps-merge-save-verification.md`）。
- [ ] 独立审查复核本次新增回归；合并模式实机另存完成后更新文档、提交并核对远程SHA。

## 执行记录

- 基线`5b5ae50`，工作区干净；上一任务85项Node及3组浏览器验证通过。
- 2026-09-24：补齐并固化导出回归（`test/ui-export-check.cjs`、`test/export-host.test.cjs`），Node 99项与4组浏览器检查通过；正式服务下实机导入成功，侧栏导入后滚动等合成输入无响应导致合并另存无法完成，证据与限制见`docs/wps-merge-save-verification.md`。
