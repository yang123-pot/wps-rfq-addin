# F1 审核表结构与显示边界证据（2026-10-11）

本包按[完成计划F1](superpowers/plans/2026-10-11-wps-phase1-completion.md)执行，对应图02/图03与差额D01、D05。
范围只有三件事：绑定末行之外的材料行不得被静默忽略；内部技术页不干扰审核；数据行高有实际结论。
没有改动导入、分类建议、整表确认口径，也没有动后续分类工作簿、汇总、询价与拆分。

## 1. 结论

1. **末行外材料行不再漏检。** 审核成果表绑定记的是`firstRow..lastRow`，过去只读这一段：用户在表尾追加材料、或整行复制（连K列行标识一起复制）都会被静默忽略，等于“材料多于已确认内容却能照常确认”。现在读回时会在末行之后做**有界**扫描，把这类行报成`row-extra`，带工作表单元格位置，并进入既有的阻断集合——整表确认与保存草稿都必须先修好。
2. **内部技术页真的隐藏了。** 审核成果表里的“内部选项”（最终分类下拉来源）和“内部绑定”（rowId/项目编码/来源边界快照）以前和公开页一起暴露在标签栏里，用户可误改；现在二者随版式隐藏，公开“分类审核成果”页仍可见，跨表下拉仍指向隐藏的选项页（图03标签栏只应有一张公开表）。
3. **行高不需要写死。** 真实宿主对**未显式设高**的数据行按内容自动撑高：354字长特征所在行实测396pt（与对该行执行AutoFit后的结果完全一致），短内容行24pt；标题行1保持版式指定的24pt。因此**不把历史观察到的84写成固定值，也不额外加AutoFit代码**——长特征全文可读，打印区域仍是`A1:I11`、重复表头`$3:$3`。

## 2. 改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/classification-review-host.js` | `readSheet`增加末行外有界扫描`scanExtraRows`：只探第2/3/4/5列与行标识列；最多200行、连续20行空白即停、最多逐行列出20处（其余合并为一条汇总问题）；绑定末行贴表尾时不向表外读。命中即产出`row-extra`，定位到用户可见的“项目名称”单元格，消息区分“整行复制（指出同标识的绑定行）”与“无标识新增行”。 |
| `wps-addin/src/classification-review-model.js` | `BLOCKING_ISSUES`与`issueTitle`加入`row-extra`（确认与草稿都先修好）；`optionsSheet`/`bindingSheet`随版式声明`hidden:true`。 |
| `wps-addin/src/workbook-layout.js` | 版式支持工作表级`hidden`（缺省可见），非法取值在写盘前拒绝。 |
| `wps-addin/src/export-host.js` | 写盘时落地工作表隐藏（先激活公开页再隐藏内部页；宿主缺少`Worksheet.Visible`或写入未落地一律报错，不产出“看起来已隐藏”的文件）；读回时校验隐藏状态（只区分“隐藏/可见”，不绑定-1或1的可见编码）；导入预览路径同样落地隐藏。 |
| `wps-addin/test/classification-review-host.test.cjs` | 新增3项：追加无标识材料行必须拒绝并定位且阻断确认/草稿；整行复制必须指出被复制的绑定行；格式化空白尾行不误报、扫描窗口有界、排序后追加行仍被报出。 |
| `wps-addin/test/classification-review-model.test.cjs` | 新增2项：内部页隐藏与下拉来源不变；`row-extra`属于阻断问题并带可定位行列。 |
| `wps-addin/test/workbook-layout.test.cjs` | 新增1项：工作表隐藏标记缺省可见、非法取值拒绝。 |
| `wps-addin/test/export-host.test.cjs` | 新增2项：生成时隐藏内部页、重开读回仍隐藏且下拉仍指向选项页；宿主忽略隐藏时明确失败且不保存。夹具补齐`Worksheet.Visible`。 |

## 3. 软件验证

- 本包相关四文件：`node --test wps-addin/test/classification-review-host.test.cjs wps-addin/test/classification-review-model.test.cjs wps-addin/test/export-host.test.cjs wps-addin/test/workbook-layout.test.cjs` → **74/74通过**，失败/跳过均0。
- 全量：`node --test wps-addin/test/*.test.cjs` → **458/458通过**（Node v24.19.0，比上一轮450项多出本包8项）。
- 本机未运行`ui-*`浏览器检查：本机没有`node_modules`/playwright，`require('playwright')`失败。F1计划不要求这些检查；F6结案时按当时环境补跑。

## 4. 真机核对（WPS表格 12.1.0.29161）

用独立隐藏COM实例（`KET.Application`，未接入用户正在使用的WPS窗口），在自有输出目录内按新版模型生成成果表、读回并追加/恢复行：

```powershell
node outputs/wps-phase1-F1/scripts/dump-review-model.cjs        # 用产品源码产出模型（含354字长特征）
& outputs/wps-phase1-F1/scripts/f1-real-run.ps1                 # 真实WPS生成→读回→追加→恢复→截图
node outputs/wps-phase1-F1/scripts/check-extra-rows.cjs         # 真实读回网格交给产品代码判定
```

**写盘读回（`out/f1-real-readback.json`）**

| 项目 | 实测 |
| --- | --- |
| 工作表可见性 | 分类审核成果`-1`（可见）、内部选项`0`（隐藏）、内部绑定`0`（隐藏），保存重开后一致 |
| 最终分类下拉 | `=内部选项!$B$2:$B$7`，类型3——来源是**被隐藏**的选项页 |
| 冻结/打印 | `FreezePanes=True`（A4锚点）、打印区域`$A$1:$I$11`、重复表头`$3:$3` |
| 隐藏辅助列 | 第11列（行标识）`Hidden=True`，列宽读回0 |
| 隐藏页仍可读 | 隐藏的“内部选项”仍读到7×2选项值（首个类别名“无需询价”）；隐藏的“内部绑定”仍读到rowId与字号10/列宽18 |
| 行高 | 行1=24（版式指定）；行4（354字特征）=396；行5–11=24 |
| 行高对照 | 同一副本对行4执行AutoFit：396 → 396（与自动行高一致） |

**末行外材料行真机核对（`out/extra-rows-check.json`）**：在真实WPS里把第4行（含K列行标识）整行复制到第12行，再在第13行写入一条无行标识的新材料行，然后把真实读回的单元格网格交给产品代码`host.readSheet`：

- 生成件本身读回**0问题**（没有误报）；
- 追加后**恰好2条**`row-extra`：第12行（列B）报“与第4行使用了同一行标识，疑似整行复制”，第13行（列B）报“没有随行行标识，疑似新增行”；
- 两条都带单元格位置，整表确认与存草稿**均被阻断**（`confirmBlocked`/`draftBlocked`均为true），绑定行仍是8行；
- 删除这两行后，读回网格与生成件**逐格一致**（`restoredGridMatches=true`）；
- 截图：`out/f1-real-append.png`（第12行被选中、第13行在下一行）、`out/f1-real-hidden-sheets.png`（公开页与354字长特征换行后的完整显示）。

## 5. 边界与未覆盖

- 真机部分用PowerShell＋COM按新版模型复刻`export-host.write`的写入步骤并读回，**不是在插件窗口里点“生成审核成果表”**：本机工具无法驱动浮窗页内控件，触点仍由真人完成（与R12-L以来口径一致，未绕过）。
- 长特征换行由宿主自动行高实现；截图能看到全文，但“完全不截断”的判定依赖宿主行高行为与这次AutoFit对照，不是逐像素测量。
- 扫描窗口是刻意有界的：末行之后最多200行、连续20行空白即停、最多逐行列出20处；因此更远处的行、或超过20处的其余行只给汇总提示。这是为了避免按格式化UsedRange做无界逐格扫描。
- 隐藏状态以读回JSON为准；截图未包含底部标签栏，不用它证明“只剩一张表”。
- `row-extra`只覆盖“末行之后”；表头以上插入行、结构性错行仍按既有`field-changed`/`row-missing`报出，未在本包扩大范围。
- 浏览器`ui-*`、保存对话框、多项目并发、完整下游失效、四项目属F2–F6，未在本包结论内。

## 6. 证据文件（本机`outputs/wps-phase1-F1/`，不入Git）

`scripts/dump-review-model.cjs`、`scripts/f1-real-run.ps1`、`scripts/check-extra-rows.cjs`、`scripts/debug-validation.ps1`（跨表下拉区域引用的最小复现）；
`out/review-model.json`、`out/before-append-grid.json`、`out/after-append-grid.json`、`out/restore-verify.json`、`out/f1-real-readback.json`、`out/rowheight-measure.json`、`out/extra-rows-check.json`；
`out/示例园区_分类审核成果_F1真机.xlsx`、`out/示例园区_分类审核成果_F1行高测量副本.xlsx`、`out/f1-real-append.png`、`out/f1-real-hidden-sheets.png`。
