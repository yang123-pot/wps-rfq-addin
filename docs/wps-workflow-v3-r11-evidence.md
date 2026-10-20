# R11 验证记录：保存重开与外部修改恢复

> 日期：2026-09-27；工作包：R11；对应图：全部关键阶段（已按两批实际查看8张）。
> 范围：`wps-addin/src/project-restore.js`、`project-ui.js`、项目恢复/重定位接线、taskpane/server资源登记与R11用例。

## 1. 实现结果

- 新增恢复审计：项目重开时逐项核对审核成果表、分类工作簿、分类汇总表、总询价工作簿和拆分回执目标，检查真实路径与SHA。
- 缺失文件、SHA不一致、拆分未完成状态都不把对应阶段或下游恢复为`ready`；项目仍可打开查看草稿/已填内容，提示具体未核对项。
- 新增整目录搬移的“重新定位项目文件”：按原成果根目录和同一相对结构重写审核表、分类簿、汇总表、总询价簿和拆分目标路径；重写后再次逐项核内容，通过才保存新绑定。
- 恢复时会自动清除已经由用户重生成/重做而改变绑定的旧审计阻断；没有周期性重载。
- 来源副本仍只走原有`restore-copy`：原件缺失、原件SHA变化时旧进度不沿用，原件本身不被改写。

## 2. 实际命令与结果

### 2.1 R11专项Node测试

```powershell
node --test wps-addin/test/project-restore.test.cjs wps-addin/test/project.test.cjs wps-addin/test/workflow-v3.test.cjs wps-addin/test/project-store.test.cjs wps-addin/test/project-server.test.cjs wps-addin/test/split-server.test.cjs
```

结果：31/31 通过。覆盖恢复审计、缺失/外部改写/拆分未完成、目录重定位和项目revision/服务重启基础。

### 2.2 全量Node回归

```powershell
node --test wps-addin/test/*.test.cjs
```

结果：310/310 通过，0 失败。

### 2.3 R11浏览器端到端检查

```powershell
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:RFQ_UI_PROJECT_RESTORE_SCREENSHOT='F:\材料软件开发\outputs\wps-acceptance-20260926\r11\ui-project-restore.png'
$env:RFQ_UI_PROJECT_RESTORE_EVIDENCE='F:\材料软件开发\outputs\wps-acceptance-20260926\r11'
node wps-addin/test/ui-project-restore-check.cjs
```

结果：PASS。验证汇总表被外部改写时品牌/询价/拆分不恢复ready；旧路径缺失、新目录内容SHA一致时显示“重新定位项目文件”，重定位后保存新绑定并恢复核对通过。

### 2.4 相邻项目UI回归

```powershell
node wps-addin/test/ui-project-check.cjs
```

结果：PASS。来源副本重建、项目列表恢复、合并选择恢复和阶段状态不受R11影响。

## 3. 本机证据

以下文件在 `outputs/wps-acceptance-20260926/r11/`，按项目规则不入Git：

| 文件 | 内容 | SHA256 |
| --- | --- | --- |
| `ui-project-restore.png` | 重定位通过后的项目状态与恢复核对提示 | `62E5BE9FE25DB45BA4A76C90EAF0122144F2F24D8DAA90157D78D5261BB3AB00` |
| `project-restore.json` | 审计详情、重定位后的绑定路径与状态 | `9CAF066DC7CD896533EE4E001B3322910CA427E3B0AA1D8B52A2A7D27F556674` |

## 4. 未完成与边界

- R11仍是模型/本机服务和模拟WPS宿主层证据；真实WPS的打开项目、重新定位和文件占用行为留到R12实机验收。
- 真实WPS保存重开后若文件被 WPS 以不同方式锁定或重写，需要R12记录实际差异；不能以本记录代替。
- R12从真实WPS全链路与输出审计开始，先跑合成样例，再做异常、四项目复制件和审计。
