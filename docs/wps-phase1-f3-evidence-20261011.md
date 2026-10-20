# F3 汇总自动打开与窗口可用性证据（2026-10-11）

本包按[完成计划F3](superpowers/plans/2026-10-11-wps-phase1-completion.md)执行，对应图01/03/04/05A/05B（本包开工时实际打开这5张图核对；图02/06/07未在本会话重复打开）。
范围只有四件事：**分列/同格两种汇总生成成功且发布校验与项目绑定保存完成后各自动打开一次最终文件**；
**窗口位置/尺寸能力核对与不遮关键入口的可复现布局**；**精确CSS320窄宽与三态可见提示**；**真机核对最终路径、名称链接、编辑焦点与填写后读回**。
本包没有改动分类建议、整表确认口径、分类工作簿/汇总/询价/拆分的业务规则，没有恢复侧栏逐行审核或品牌二次确认，也没有回到TaskPane或引入65秒等待。

## 1. 结论

1. **汇总表生成成功后自动打开一次最终成果（图05A/05B）。** 自动打开只发生在“发布校验（commit+verify）通过 **且** 项目绑定保存成功”之后：
   - 项目绑定保存未成功（`projects.save()` 返回空，例如写失败/409）时**不打开**，并如实提示“已生成并校验，但项目绑定未保存”（不再把已发布的成果说成“未生成”）；
   - 打开失败时提示“**分类汇总表已生成、未打开**”，保留成果文件与手动“打开汇总表”入口，**不重新发布**、不虚报“未生成”；
   - 分列与同格两种布局各自只自动打开本次新文件一次，不重复打开旧文件；手动入口仍可再次打开同一文件。
2. **窗口位置/尺寸：按宿主文档能力“尝试定位并读回核对”，定位能力缺失不影响窗口打开。** 询价窗口改为先按宿主文档的完整参数创建（含 `xPox/yPox` 位置参数与其他参数的文档默认值），位置取**右边贴齐屏幕可用区域（留16px边距）、顶边让出180px功能区/编辑栏**；可用高度不足时按“功能区之下剩余空间”收窄窗口高度（不低于360px），保证窗口整体落在屏幕内且绝不盖住顶部关键入口。创建参数未生效时退回 `WebDialog.Move/Resize`，再读回 `Xpos/Ypos/Width/Height` 核对。只认旧版最小签名的宿主会自动退回最小调用。读不回来或对不上时**如实标记未定位**（`host-unsupported`/`readback-mismatch`/`no-screen`），窗口照常显示，不报打开失败。
3. **精确CSS320窄宽成立，三态提示可见且导航不绕过前置条件。** 视口宽度正好320 CSS像素时，七阶段主按钮换行为2行、标签不被裁切、无横向滚动、可纵向滚到；未完成（missing）与过期（stale）阶段都有可见提示，且这些阶段里可见的“生成/确认/拆分/重试/重建/写入”按钮一律保持禁用（表内审核的“整表确认”是动作级校验入口，按钮可用但必须按现表逐行通过，属既有口径）。
4. **真机（WPS 12.1.0.29161）核对通过：** 汇总表最终路径、4个名称相对链接（蓝色下划线、真实 Follow 打开对应分类工作簿）、打开供填写时的编辑焦点落在图05A浅黄填写区首个单元格、以及**表内填写后按产品解析器读回**（4类/预计5份、双组品牌不被最后一组覆盖）全部成立；隐藏的类别ID/相对链接/方式选项列、冻结窗格与打印区域与图05A一致。

## 2. 改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/import-ui.js` | 新增`autoOpenSummary`：发布校验与项目绑定保存完成后自动打开一次最终汇总表；打开失败只提示“已生成、未打开”并保留手动入口。`generateSummary`改为：绑定保存未成功（返回空）时不自动打开并如实提示；异常分支区分“已发布但绑定未保存”与“未生成”。 |
| `wps-addin/src/ribbon-navigation.js` | 新增窗口位置/尺寸能力层：`screenArea/placementFor/dialogBounds/attemptPlacement/createDialog`，创建时带文档位置参数、必要时退回最小签名、用`Move/Resize`兜底并读回核对；新增只读`placementReport()`（`createdWith`/`placed`/`verified`/`via`/`reason`/`bounds`）供真机核对，不参与业务判定。 |
| `wps-addin/test/ui-brand-check.cjs` | 新增F3段落：分列/同格生成后自动打开一次（无需点按钮）、手动入口保留可再打开、打开失败提示“已生成、未打开”且不重新发布、生成写入失败不自动打开、项目绑定保存失败不自动打开。 |
| `wps-addin/test/webdialog-lifecycle.test.cjs` | 夹具支持位置参数/`Move`/`Resize`/几何读回/最小签名宿主；新增7项：右边贴齐＋顶边避开功能区定位并读回核对、可用高度不足时收窄窗口高度、宿主忽略创建位置时用`Move/Resize`兜底、宿主不支持定位时窗口仍打开并标记未定位、读不到屏幕时用最小签名、读回不一致不得声称已定位、只认最小签名时退回且窗口仍打开。 |
| `wps-addin/test/ui-workflow-check.cjs` | 新增F3段落：missing三态逐阶段核对（可见“未完成”＋主操作禁用＋可见动作按钮不得可用）、stale三态（改回“分别保留”再次确认后下游必须显示过期/未完成且主操作仍禁用）、精确CSS320窄宽（换行/不裁切/无横向滚动/可滚动，并输出`css320-narrow.json`与截图）；侧栏重建段的请求改为在重建页初始化前播种，消除低频检查抢先消费造成的偶发。 |

`wps-addin/src/brand-host.js`、`wps-addin/src/styles.css` 本包**未改动**（复用既有`RfqBrandHost.openSummary`与既有窄宽样式）。

## 3. 软件验证

- 全量：`node --test wps-addin/test/*.test.cjs` → **472/472通过**（Node v24.19.0；F2为465项，本包新增7项，失败/跳过均0）。
- 窗口相关：`node --test wps-addin/test/webdialog-lifecycle.test.cjs wps-addin/test/ribbon-navigation.test.cjs wps-addin/test/ribbon-recovery.test.cjs` → **46/46通过**。
- 浏览器检查（真实Chromium/Edge＋真实本机服务＋模拟WPS宿主）：
  - `ui-brand-check.cjs` → **PASS**（连跑4次稳定），含本包新增自动打开/失败分支段落；
  - `ui-workflow-check.cjs` → **PASS**（连跑4次稳定），含三态与CSS320段落，产出`css320-narrow.json`（`cssWidth=320`、`devicePixelRatio=1`、`rows=2`、`scrollWidth=320=clientWidth`、`scrollHeight=1477>900`、7个标签`clipped=false`）；
  - 受影响/主流程另15项：`ui-sheet-review`、`ui-project-restore`、`ui-category`、`ui-inquiry`、`ui-split`、`ui-cancel`、`ui-classification`、`ui-export`、`ui-import`、`ui-library`、`ui-memory`、`ui-project`、`ui-review`、`ui-startup-navigation`、`ui-pane-diagnostics` → **全部exit=0**（合计17项`ui-*`通过；`ui-render-stall-check`属稳定性长测，按“不重开长测”约束未运行）。
- **先红后绿**（每条新行为都先看到失败，且失败原因就是缺该行为）：
  1. 自动打开：旧代码下`ui-brand-check`在“分列布局生成成功后必须自动打开一次”处失败（`actual []`）；
  2. 绑定保存失败不自动打开：临时去掉`projects.save()`空值判断后，该段得到“已生成并校验…已自动打开”并超时失败；
  3. 打开失败提示：临时去掉打开处的`try/catch`后，“已生成、未打开”等待超时失败；
  4. 窗口定位：`webdialog-lifecycle`新增7项在实现前因`placementReport`/`createdWith`缺失而失败；
  5. CSS320：把断言临时改成“必须≥3行”即失败，证明该断言测的是真实排版而不是空断言。
- 浏览器检查用Codex运行时依赖目录（`NODE_PATH=<codex-primary-runtime>/dependencies/node/node_modules`）解析playwright；该路径只用于本机执行，不写入产品。

## 4. 真机核对（WPS表格 12.1.0.29161）

真机部分用**独立隐藏COM实例**（`KET.Application`，未接入用户窗口）＋**产品模型与产品解析器**，按产品`export-host.write`/`RfqBrandHost.openSummary`的同一顺序与口径执行；只操作本包自己的输出目录，不打开、不改动用户工作簿。

```powershell
node outputs/wps-phase1-F3/scripts/prepare-f3.cjs          # 产品模型产出：4个分类工作簿 + 分列汇总表 + 绑定
pwsh outputs/wps-phase1-F3/scripts/f3-real-run.ps1         # 真实WPS写入/打开/焦点/填写保存/读回/Follow/截图
node outputs/wps-phase1-F3/scripts/f3-check.cjs            # 产品代码判定真机读回（29项）
```

| 项目 | 实测 |
| --- | --- |
| 宿主 | `path=E:\WPS\WPS Office\12.1.0.29161\office6`、`Version=12.0`（COM口径）、开工工作簿0 |
| 步骤 | **8/8 全部 ok、errors 为空**（连接→写4个分类工作簿→写汇总表→打开→焦点→填写保存→读回→截图） |
| 最终路径 | `out\示例园区_f3\分类汇总表.xlsx`（11840字节，SHA `4615a61c…`）；填写保存后 `dc63c908…`（11997字节），读回未再改动 |
| 分类工作簿 | 水泵/阀门/风机/汽车充电桩 4份真实存在，SHA与写入回执逐个一致 |
| 打开口径 | 打开的就是最终汇总表、`ReadOnly=false`、宏安全值打开前后一致（1→1） |
| 编辑焦点 | `ActiveCell=$D$4`（行4列4），底色`14088191=#FFF7D6`＝图05A浅黄填写区；写入“焦点探针”后读回一致 |
| 名称链接 | B4:B7 各1个原生超链接，显示类别名，地址`分类工作簿\<类别>.xlsx`（相对），字体为链接蓝`#0563C1`且有下划线 |
| Follow | 4条链接**真实Follow后活动工作簿就是对应分类工作簿**（4/4 matches=true） |
| 填写后读回 | 真机网格交产品`RfqBrandModel.parseSummary`：`ok=true`、0问题、4类、预计5份、双组品牌按组保留、方式读回一致 |
| 隐藏/版式 | 类别ID/相对链接/方式选项三列隐藏且内容正确（`pump`/`分类工作簿\水泵.xlsx`等，选项列`合成一份`/`按品牌分别生成`）、冻结窗格生效、打印区域`$A$1:$J$9` |
| 判定 | `f3-check.cjs` → **29/29通过、0失败** |

真机截图：`out/f3-real-summary.png`（684×399，汇总表填写后的真实WPS画面，含两行表头、浅黄填写区与名称列）。

**窗口位置/尺寸能力的文档口径**：本产品代际的官方加载项API文档记载`CreateWebDialog(url, appName, width, height, modal, hasCaption, resizeEdge, errorUrl, loadingTimeout, isChildWindow, isUseCookie, xPox, yPox, popupMode)`，`WebDialog`另有`Move/Resize`与只读`Width/Height/Xpos/Ypos/ID`（本机留存于`outputs/sidebar-stability-20261005/wps-official-CreateWebDialog-20261010.json`等）。本包据此实现“尝试定位＋读回核对＋最小签名回退”，并用单元/浏览器替身覆盖全部能力分支。

## 5. 边界与未覆盖

- **真机部分是按产品同一写入/打开顺序在真实WPS里复刻执行，不是在插件浮窗内点按**（本机工具仍无法驱动浮窗页内控件，与R12-L以来口径一致，未绕过限制）。
- **本版宿主在真实浮窗里对“创建时位置参数”是否生效、以及默认位置遮挡的实际结论，本次未取得浮窗内探针读数**：核对它需要真人在WPS功能区点一次“打开询价助手”（本会话native计算机控制不可用，无法自行触发）。因此：
  - 已确认的默认遮挡事实沿用10-10真机画面与用户反馈：`outputs/sidebar-stability-20261005/webdialog-initial-connected-20261010.png`显示浮窗默认出现在WPS主窗口偏上位置，**遮住功能区右侧与标题栏区域**（“打开询价助手/重建询价窗口”所在位置因此够不着）；
  - 本包的定位改动（右下锚点＋回退＋读回核对）只保证“能定位就定位、不能定位就如实标记且不影响打开”，**“本版浮窗内是否真的落到右下”属未覆盖边界**，需一次真人点击补齐；未确认前不得宣称默认遮挡已解决。
- 真实窗口的“可达宽度与缩放”同样依赖上述真人点击（本包只给出浏览器精确CSS320与真实文件侧口径，不把外框320当CSS320）。
- 未覆盖：保存/目录对话框、多项目并发属F4/F5；四项目属F5；R12结案属F6；`ui-render-stall-check`长测按约束未重开。
- 本会话没有需要真人完成的点击项被执行，因此没有“点击者”记录；上一条列出的真人项仍待用户执行。

## 6. 证据文件（本机`outputs/wps-phase1-F3/`，不入Git）

`scripts/prepare-f3.cjs`、`scripts/f3-real-run.ps1`、`scripts/f3-check.cjs`；
`out/f3-models.json`、`out/f3-real-readback.json`、`out/f3-real-check.json`、`out/f3-real-summary.png`；
`out/示例园区_f3/分类汇总表.xlsx`、`out/示例园区_f3/分类工作簿/{水泵,阀门,风机,汽车充电桩}.xlsx`；
`css320-narrow.json`、`css320-seven-stages.png`；
`logs/`（`ui-brand-check-{baseline,red1,green1..4}`、`ui-workflow-check-*`、`f3-real-run*.log`、`f3-check*.log`、`node-full.log`及17个`ui-*.log`）。
