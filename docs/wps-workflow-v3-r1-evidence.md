# R1 验证记录：项目v2、7阶段、失效传播与合成夹具

> 日期：2026-09-26。范围：handoff 第5节 R1。**本记录只覆盖模型、项目库、项目API与合成夹具；不包含WPS实机验证。**
> 静态效果图、模拟宿主与真实WPS互不代表；R1未在真实WPS里跑业务，实机验收留在R12。

## 1. 本包对应图号与验收点

已按第1节规则实际打开全部8张效果图（01–07含05A/05B），本包对应的是**全部图共用的7阶段骨架**，不新增/改动业务界面：

| 图 | 本包相关验收点 |
| --- | --- |
| 01 | 阶段1＝“导入与合并”：来源＋合并选择共同决定该阶段是否完成 |
| 02 | 阶段2/3＝自动分类/表内审核，自动建议不得等同人工整表确认 |
| 04–07 | 阶段4–7＝分类工作簿/品牌汇总/询价表/拆分文件，链路未实现时必须保持未完成 |

## 2. 实际改动（仅列本包文件）

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/project.js` | 重写为schemaVersion=2：7阶段、OWNER/KIND_OF_STAGE失效映射、v1/v2双版本校验、expectedRevision语义、ck2业务键、v1继续副本 |
| `wps-addin/dev/project-store.cjs` | `save(project,{expectedRevision})`乐观锁：初始0、成功递增、冲突抛`REVISION_CONFLICT`、损坏/未知版本保留原文件 |
| `wps-addin/dev/server.cjs` | `/api/project/save`透传expectedRevision；版本冲突返回409 |
| `wps-addin/src/project-ui.js` | 保存带expectedRevision；409提示且保留侧栏草稿；打开v1时另存v2副本；7阶段状态展示 |
| `wps-addin/src/import-ui.js` | 合并确认键带材料行；过渡期把侧栏分类/品牌/生成结论映射到v2阶段（分类工作簿等未实现阶段保持未完成） |
| `wps-addin/src/brand-ui.js` | 品牌表上游改为v2的“表内审核”阶段 |
| `wps-addin/test/fixtures/workflow-v3-sample.cjs` | 新增：第6.1节10行合成夹具＋隔离分类库 |
| `wps-addin/test/workflow-v3.test.cjs` | 新增：R1的8组用例（夹具、7阶段、失效、业务键、v1副本、版本校验、乐观锁、API 409） |

未改动：`wps-addin/rules/defaults.json`（生产口径未变）、历史人工库、任何本机运行数据。

## 3. 合成夹具（第6.1节）

- 输入：给排水清单5行＋机电清单5行＝10行；两份来源指纹固定，路径固定，rowId由“来源路径＋表名＋行号”确定，跨次运行稳定。
- 合并：按项目名称＋项目特征描述＋单位完全一致合并 → 8行；数量水泵DN50=2、DN65=3、阀门DN50=20、DN65=12、送风机=2、排风机=3、充电桩配电箱=1、钢索=10。
- 隔离分类库：水泵/阀门/风机/汽车充电桩/无需询价 与图03下拉一致；另含**只存在于夹具**的“强电”类别与一条“配电箱→强电”规则，用来制造“充电桩配电箱”同时命中“汽车充电桩配套”的建议冲突（图02的待核对行）。该类别不并入生产库。
- 建议结果：7行唯一建议＋1行冲突（充电桩配电箱），与图02“7行有建议·1行需重点核对”一致。
- 稳定行序按图02/03：水泵DN50、水泵DN65、阀门DN50、阀门DN65、送风机、排风机、充电桩配电箱、钢索（钢索来自第一份清单，但按图列在最后一行；夹具显式给出该顺序，归属不变）。

文件SHA256：`workflow-v3-sample.cjs` = `7BF9413245D011A42774EAE717C2D012854D7132B00F3AF372F012B4D43A7EA9`。

## 4. 实际命令与结果

```powershell
node --test wps-addin/test/*.test.cjs
# tests 249 / pass 249 / fail 0
```

```powershell
# 侧栏用例（模拟宿主＋浏览器；NODE_PATH指向本机Codex运行时的playwright）
node wps-addin/test/ui-check.cjs
node wps-addin/test/ui-import-check.cjs
node wps-addin/test/ui-review-check.cjs
node wps-addin/test/ui-classification-check.cjs
node wps-addin/test/ui-brand-check.cjs
node wps-addin/test/ui-export-check.cjs
node wps-addin/test/ui-library-check.cjs
node wps-addin/test/ui-memory-check.cjs
node wps-addin/test/ui-project-check.cjs
node wps-addin/test/ui-render-stall-check.cjs
node wps-addin/test/ui-pane-diagnostics-check.cjs
# 11/11 PASS
```

## 5. 关键行为证据

- **7阶段真实判定**：新建项目全部`missing`；只有来源清零＋本次合并选择确认后`import`才`ready`；自动建议≠人工确认；未实现的分类工作簿及之后不会被旧数据点亮。
- **失效传播**：来源/合并变动→导入重做、其后`stale`；材料字段变动→匹配重做；最终分类变动→表内审核重做、分类工作簿及之后`stale`；品牌变动→品牌汇总重做、询价/拆分`stale`；抬头变动→只使询价/拆分失效。
- **业务键（ck2）**：包含来源（顺序＋指纹）、合并方式、材料行（稳定rowId、名称、特征、单位、工程量、来源）、分类确认、品牌供应商/生成方式、抬头；表内排序、筛选、时间与回执字段不改变业务键。
- **乐观锁**：新建`revision=0`，保存成功递增；旧`expectedRevision`写入返回409且磁盘内容不变；带最新版本号可续作；损坏JSON与未知版本记录保留在磁盘待人工处理。
- **v1兼容**：v1记录仍可读取，`refresh`拒绝对v1直接改写；继续时新建v2副本并记录`fromProjectId`，来源与分类草稿只作参考，品牌及下游一律`missing`（不误报完成）。

## 6. 已知限制与下一步

- 本包只在模型/项目库/API与模拟宿主层面验证，**没有真实WPS截图或输出文件**；`分类工作簿/品牌汇总/询价表/拆分文件`四个阶段在本包中必然是“未完成”，因为对应功能尚未开发。
- `matching/review`目前由旧侧栏逐行分类面板过渡映射；R3–R5会用真正的主流程（导入合并选择→自动分类→表内审核整表确认）替换，并移除过渡映射与暂存字段。
- 下一步：R2（统一表格版式、读写、下拉与链接），`src/workbook-layout.js`与`export-host/export-files`的layout支持。
