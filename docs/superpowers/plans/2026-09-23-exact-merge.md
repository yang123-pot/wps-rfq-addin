# 可选精确合并核心实施计划

> 使用superpowers:executing-plans直接实现和验证；执行已有一期设计，不再重复征求启动许可。

**Goal:** 为多个解析后的工作簿提供可选精确合并预览，数量不丢精度，全部原行可追溯。

**Architecture:** 新增独立纯JavaScript模块，不调用WPS、不写文件。未来导入/来源核对界面调用同一接口；当前侧栏仍为清单识别，不展示尚未接入的合并操作。

**Tech Stack:** 原生JavaScript、Node测试。

**Spec:** 根目录handoff及`docs/wps-addin-phase1-design-v2.md`的多个工作簿可选合并部分。

## Global Constraints

- 默认不开启合并；严格按名称、特征、单位原字符串判断，编码不作为条件，保留首次出现顺序。
- 合并数量用十进制字符串逐位计算，不用浮点求和；无效/空/负数量各自保留、不当零。
- 保留每条原行ID、路径、表名、行号（含续行）、编码、原数量、工程和专业；显示来源去重，明细不去重。
- 同一路径（Windows大小写和分隔符统一）或相同可用SHA256指纹不能重复导入；同来源行不能重计；不得把合并输出再次当原始输入。
- 所有解析问题继续传递，`canFinalize=false`直到核对解决。不会将推断专业变成已确认，也不会标记业务分类完成。
- 本任务仅核心计算；多文件选择、来源修正、合并预览界面和另存接入为下一任务。

## Review Focus

- 浮点数量、小数位不齐、超出安全整数的字符串工程量仍精确。
- 同编码不同特征不能合并；不同编码相同三字段应合并；前后空格、换行、单位差异不可抹平。
- 异常材料不能并入有效数量组或从预览丢失。
- 复制、重复添加、重复来源、已合并结果重入均不能翻倍数量。
- 空或未知工程/专业、相同来源标签、相同文件名不同路径均保留可追溯明细。

### Task 1: 精确合并预览引擎

文件：`wps-addin/src/merge.js`、`wps-addin/test/merge.test.cjs`、验证记录与handoff。

接口：`RfqMerge.preview(books, {mergeIdentical:false})`输入`RfqParser.parseWorkbook`结果数组，可选`fingerprint`为导入器计算的SHA256；输出`{mode,inputCount,outputCount,groups,issues,canFinalize}`。groups含名称/特征/单位、quantity、完整sources和去重sourceLabels；异常数量的单独组quantity=null。不会修改输入。

- [x] 编写测试：默认不合并，精确三字段、数量0.1+0.2和大整数小数、异常数量、来源去重但明细保留、相同编码不等于同项、原顺序/不可变、路径指纹/来源重复拦截、问题门槛、拒绝合并结果重入。
- [x] 运行`node --test wps-addin/test/merge.test.cjs`，预期模块缺失失败。
- [x] 最小实现，运行上述测试和全套`node --test wps-addin/test/*.test.cjs`，58项通过（含复核后的输入校验回归测试）。
- [x] 四个真实项目分别预览：默认输出条数等于输入；开启后每条来源恰好出现一次，Python Decimal按单位验证数量总和守恒，所有解析问题保留。证据只存outputs。
- [x] 独立复核完成；补充必需追溯字段、空白来源和路径别名拦截，先失败后通过。更新交接/验证记录，按文件清单提交推送并核对远程SHA。
