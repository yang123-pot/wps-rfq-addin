# R2 验证记录：统一表格版式、读写、下拉与链接

> 日期：2026-09-26。范围：handoff 第5节 R2。**本记录为模型＋模拟宿主验证，真实WPS小样核验尚未完成（见第5节挂账）。**
> 静态效果图、模拟宿主与真实WPS互不代表。

## 1. 本包对应图号与验收点

已按第1节规则实际打开全部8张效果图。本包对应**图02–07的版式底座**：

| 图 | 本包对应验收点 |
| --- | --- |
| 02/03 | 成果表浅色表头、最终分类黄色可编辑列＋区域下拉 |
| 04 | 材料明细10列（序号/编码/名称/特征/单位/工程量/品牌/报价单价/金额/备注）等宽矩阵，长特征换行 |
| 05A/05B | 类别名蓝色下划线原生超链接；填写区浅黄；冻结与打印重复表头 |
| 06/07 | 抬头＋10列清单＋打印布局随拆分保留（layout贯穿） |

## 2. 实际改动

| 文件 | 改动 |
| --- | --- |
| `wps-addin/src/workbook-layout.js` | 新增：等宽矩阵`equalize`、版式`build/validate`、BGR颜色转换、表头/填写区/下拉区域便捷构造 |
| `wps-addin/src/export-host.js` | `write`支持模型的`layout`：列宽/行高/表头加粗/合并/浅色填充/冻结/打印区域与重复表头；**原生`Hyperlinks.Add`**；**区域引用`Validation.Add`**；重开后`verifyLayout`读回列宽/合并/链接地址/下拉公式；宿主缺API时报出具体API名并停止 |
| `wps-addin/dev/export-files.cjs` | `prepare(target,{adjacent:true})`：带相对链接的文件在**最终目录内的唯一相邻暂存**生成，成功后清理临时文件；保留严格路径校验与独占发布（`COPYFILE_EXCL`） |
| `wps-addin/taskpane.html`、`dev/server.cjs` | 登记`src/workbook-layout.js`加载顺序与静态白名单 |

关键SHA256：`workbook-layout.js` = `FBDEC37129CCE685FC46720E554E32859BE240181A710792A86DE4D2430A1149`；`export-host.js` = `6F0DAA3D8BB3A63566A443DB2E9122CC461CC1C7C04B21EA144B80612F60D86E`；`export-files.cjs` = `EE15F9AA5515AA94B05493B4D09BA2080745118532C92773DECA15745FA1FAC4`。

## 3. 实际命令与结果

```powershell
node --test wps-addin/test/export-host.test.cjs wps-addin/test/export-files.test.cjs wps-addin/test/workbook-layout.test.cjs
# export-host 11/11、export-files 5/5、workbook-layout 6/6 通过
node --test wps-addin/test/*.test.cjs
# tests 260 / pass 260 / fail 0
```

侧栏用例（模拟宿主＋浏览器）11/11通过：`ui-check / ui-import-check / ui-review-check / ui-classification-check / ui-brand-check / ui-export-check / ui-library-check / ui-memory-check / ui-project-check / ui-render-stall-check / ui-pane-diagnostics-check`。

## 4. 关键行为证据（模拟宿主）

- **等宽矩阵**：短标题行＋10列表头＋明细行被补齐到10列，标题行不再决定列宽；列数小于实际内容时直接拒绝而不是截断。
- **版式落地**：长特征列宽42、普通列14；表头行加粗且填充`#DCE6F1`（BGR `14738652`）；可填写区`#FFF7D6`；标题行合并成整行；冻结在A4；打印区域`A1:J4`、重复表头`$3:$3`。
- **原生链接**：`Hyperlinks.Add`写入地址`C:\out\分类工作簿\阀门.xlsx`、显示“阀门”，未使用HYPERLINK公式；重开后读回地址不一致即失败。
- **区域下拉**：`Validation.Add(3,1,1,"='内部选项'!$A$1:$A$5","")`，用区域引用避免带标点类别名被拆开；读回公式不一致即失败。
- **缺API不冒充**：去掉`Hyperlinks.Add`时抛出“当前WPS不支持原生超链接API（Hyperlinks.Add）”，且**不保存/不发布**文件。
- **相邻暂存**：`prepare(target,{adjacent:true})`的暂存文件与最终汇总表同目录、文件名形如`.清单.xlsx.tmp-xxxxxxxxxxxx.xlsx`，并发唯一；发布成功后不残留临时文件；失败时保留临时文件供排查；相邻模式不创建中心暂存目录；目标已存在时仍拒绝覆盖。
- **回归**：无`layout`的旧模型按原行为写出；写入值、原精度文本、禁公式、不覆盖、宏安全与活动工作簿恢复全部保留。

## 5. 未完成与挂账（不得当作已通过）

- **R2第6项未做**：本环境无法驱动真实WPS，因此“真实WPS用小型隔离簿验证下拉、中文链接、保存关闭重开、整目录移动”**尚未执行**，属挂账，需在能操作WPS时补做；未补做前不得声称“图中版式/下拉/链接已真实输出”。
- 模拟宿主只能证明调用与读回逻辑正确，不能证明WPS各版本API实际行为；若实机出现API差异，按R2第7项记录具体差异并修适配，不改用链接公式。

## 6. 下一步

R3（七步UI及导入合并选择）：主流程改7步导航、导入先选是否合并、path-picker补save模式、移除旧侧栏逐行审核与品牌确认面板。
