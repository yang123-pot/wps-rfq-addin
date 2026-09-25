# WPS询价插件一期剩余开发计划与交接文档

> 执行者：按 `superpowers:executing-plans` 逐个工作包实施；复现缺陷后采用最小修复，每包完成验证、记录与Git备份。以下未勾选项均未完成，不代表已经实现。

**更新日期：2026-09-26。** 本次接续实施9C（B1～B4）：分类习惯接入建议、库与记忆原子持久化、确认来源学习与撤销、维护界面。
**目标：** 先关闭已知稳定性问题与实机验收缺口，再完成分类习惯、品牌供应商、询价生成、拆分和安装交付。
**实现方式：** 延用现有WPS表格加载项、纯JavaScript模型、WPS宿主适配和本机Node服务；修补与接线优先，不整体重写。内部清单另存与对外询价文件保持各自的数据模型，共用已经验证的文本写入、校验和禁止覆盖能力。
**技术栈：** Windows、WPS表格JS加载项；`wps-addin/package.json`要求Node `>=22`；Node原生测试、Playwright/Edge浏览器回归。浏览器模拟宿主不能代替真实WPS验收。
**设计依据：** `docs/wps-addin-phase1-design-v2.md`；用户最新要求和本文件的当前状态优先于历史计划。
**仓库：** `F:\材料软件开发`；分支 `feat/wps-phase1`；私有远程 `yang123-pot/wps-rfq-addin`。本轮开始基线为 `53b9d8e`（本地与远程一致），本轮提交与远程核对结果见§10；功能尚未合入`main`。

## 0. 接手时先看这里

1. **遗留问题没有全部修复。** P1/P4侧栏偶发停滞仍未定位根因，重载仅是已验证的恢复路径；P3兼容性尚无结论；P5还有实机异常流程待测。
2. 2026-09-26本轮结果为 **166项Node测试、9组浏览器检查通过**（见§10备份记录）；浏览器模拟宿主仍不能代替真实WPS验收。
3. **A1～A3需要真实WPS交互会话**（取截图、连点、观察冻结）。当前执行环境没有WPS图形界面控制能力，这三包未做，仍按未完成处理，已列入集中调测项；稳定性验收未过，不把13标记完成。
4. 9C（B1～B4）已实现并自测通过；下一步从 **B5资料迁入** 开始，再进入C1/C2。
5. 只有任务本身依赖缺失业务信息时才集中询问用户。已有开发、本机验证和持续Git备份授权，不重复询问是否开始；已通过的人工测试不再重复要求用户操作。
6. 本文件给出完整剩余路线；具体截图、逐值结果和历史时间线放在独立证据文档，入口见§11。

## 0.1 集中调测项（2026-09-26记录，问题不解决就挂在这里）

以下问题本轮无法在不占用用户WPS会话的情况下解决，已按用户要求先记录、后集中调测；不得因为它们把功能开发长期停住，也不得在未取证时写成已修复。

| 编号 | 未解决内容 | 为什么本轮做不了 | 下一步（需要谁配合） |
| --- | --- | --- | --- |
| T1 | P1/P4侧栏偶发停滞未定位根因，重载仍是唯一已验证恢复路径 | A1要求真实WPS里取即时截图、按坐标连点、观察冻结；本执行环境没有WPS图形界面控制能力 | 用户在场时按A1步骤做无探针/探针对照，产出`docs/wps-pane-root-cause-verification.md` |
| T2 | A2按证据修复与A3的P5异常矩阵（写中失败、发布失败、多副本） | 依赖T1证据或真实WPS宿主写入失败 | T1完成后立即做；A3可先设计合成目录与哨兵文件方案 |
| T3 | P3支持版本结论（29161/28043） | 需要在隔离环境启动另一版本WPS，不能动用户当前安装 | 用户提供隔离环境后对照 |
| T4 | 9C/B1～B4的真实WPS确认（保存后重载、重启服务恢复、380px窄侧栏实机查看） | 同上，需要真实侧栏 | 与T1同一场会话顺手完成 |

## 1. 已完成能力和准确边界

| 范围 | 当前状态 | 不应重复开发的部分 / 尚缺部分 |
| --- | --- | --- |
| WPS接入、清单识别 | 已实现、主要路径实机通过 | 功能区、侧栏、多表读取、分页、来源定位；仍有窗格稳定性问题，无正式安装交付 |
| 来源核对、多文件导入、精确合并 | 已实现、主要路径实机通过 | 复制原件、重复输入阻断、逐行核对、默认分离、三字段精确合并、十进制累加、来源追溯 |
| 内部清单另存（任务7） | 功能实现，异常验收未闭环 | 三表输出、文本精度、重开校验、取消和禁止覆盖已通过；余下见A3 |
| 项目状态与副本管理（任务8） | 已有模型与保存恢复 | 项目编号、来源恢复、分类进度/阶段恢复已通过；未来品牌/生成/拆分持久化及全阶段衔接见C1 |
| 分类库与分类确认（9A/9B） | 已实现、主要写列路径实机通过 | 四条确认口径、建议依据、逐行/批量/撤销、未全确认阻断、分别写副本或合并表、回执防过期 |
| 习惯记忆与分类库维护（9C＝B1～B4） | 已实现，Node与浏览器模拟宿主通过，**真实WPS未验** | 建议接线（规则与记忆候选并存、冲突不自动覆盖）、库与记忆单包原子保存与409冲突、确认来源学习与按来源撤销、别名与排除条件、维护界面（类别/规则/记忆）；**余下**：真实WPS保存后重载与重启服务恢复、B5资料迁入 |
| 分类品牌表、品牌参考、供应商、抬头（10） | **未实现** | C1～C5 |
| 总询价工作簿（11） | **未实现** | D1～D2；现有内部清单输出不是供应商询价表 |
| 拆分（12） | **未实现** | E1～E2 |
| 安装包、四项目完整验收、操作说明（13） | **未实现** | F1～F3 |

### 已有实机证据，后续只做受改动影响的回归

- 分离3→3、合并3→2另存；`0.1+0.2=0.3`、`000123`、长小数及字面文本`=1+1`正确；零公式。
- 首次确认取消、选位置取消、已有目标拒绝；来源明细和处理记录排版可读。
- 分类剩余2/1行时禁写、撤销复位；四条业务口径建议正确；工作副本分类标题按真实表头行写入。
- 合并表分类写列后，旧回执因SHA变化拒绝；来源临时导入/移除后旧回执拒绝；重复写工作副本不覆盖原分类列。
- 项目恢复1份来源、未合并、分类4/4，分类阶段正确；恢复提示项目号正确。
- 仅把数值编码格式从`000000`改为常规，保存旧核对被拒；关闭且不保存测试格式、重开并读取后，原`000123`核对可恢复，问题1→0。
- 切换工作簿时保存/恢复均拒绝，错误显示在按钮旁；返回原样本仍能恢复；源文件SHA未变。

## 2. 全局约束与交付口径

- 一期只整理和生成文件；不发送微信/邮件，不做报价回收、比价、采购审批或云端学习。
- 自动导入先复制，测试用合成件或复制件；原招标清单不作为写入目标。不得批量关闭用户工作簿。
- 预合并仅按“项目名称＋项目特征描述＋单位”完全相同，默认不合并，不按编码强合并、不换算单位。
- 输出归集还须类别和品牌要求相同；未选择跨工作簿合并时，必须保留`scopeId`边界，不在后续偷偷合并不同原件。
- 分类行标识用`group.id`/sourceId，不能用工作簿级`scopeId`代替；原始来源每条计数一次。
- 全部有效行人工确认类别或“无需询价”后才生成分类品牌表；建议和记忆均不能替代人工确认。
- 保留已确认口径：全部钢索→无需询价；充电桩配套配电箱→汽车充电桩；所有水龙头→水阀门；“风口风阀”统一为“风口、风阀”。
- 品牌与供应商独立填写。分类品牌表显示类别、条目数、品牌、供应商、备注，内部另保留材料行映射，不能丢失多品牌适用范围。
- 对外列参照设计：序号、项目编码、项目名称、项目特征描述、单位、工程量、品牌、报价单价、金额、备注；供应商报价单价和金额先留空，原价/历史报价不带入。来源仅展示必要的工程名称＋专业，路径、SHA、核对JSON只留内部。
- 成功必须有文件实际存在、重开校验及SHA回执；已有文件不覆盖。部分成功按文件/行如实报告，不说全部成功。
- 新增页面脚本/规则必须登记`dev/server.cjs`静态白名单与MIME，并在`taskpane.html`按依赖顺序加载。
- 本机项目/记忆/联系方式/运行数据不进Git；只按明确文件清单暂存。每包验证后提交、推送、核远程SHA，不强推。

## 3. 代码入口与已核对的接线缺口

| 现有文件（相对仓库根目录） | 职责 / 后续注意点 |
| --- | --- |
| `wps-addin/main.js`、`ribbon.xml` | 创建/复用窗格及主动`Navigate`重载；普通打开不等于重建 |
| `wps-addin/dev/pane-diagnostics.js` | 单个待执行动画回调、生命周期和停滞/恢复探针；尚未再捕获真实冻结事件 |
| `wps-addin/dev/server.cjs` | 本机接口、静态白名单、探针注入；无探针模式仍叫`development` |
| `wps-addin/src/host.js`、`parser.js`、`review.js`、`taskpane.js` | 读取、解析、核对、保存/恢复及格式签名 |
| `wps-addin/src/collection.js`、`merge.js`、`import-ui.js` | 导入集合与归组；`merge.js`的十进制加法是内部函数，未来复用时需小范围抽取并保持原回归 |
| `wps-addin/src/export-model.js`、`export-host.js`、`export-ui.js` | 当前仅内部三表模型；宿主写入要求所有值为字符串并拒绝公式；布局目前首行作表头 |
| `wps-addin/dev/export-files.cjs` | `prepare/commit/verify`，独占发布；票据在内存且一小时过期，不能直接当重启后拆分续作凭证 |
| `wps-addin/src/category-library.js`、`classify.js` | 库校验与规则匹配；`suggest(item, library)`尚未使用第三个context参数，规则过滤还需覆盖其类别被停用的情况 |
| `wps-addin/src/category-memory.js` | `create/learn/find/revoke`；记忆相近值是`similar`，分类层使用`partial`，接线时需显式转换 |
| `wps-addin/src/classification.js`、`classification-ui.js` | 决策模型与UI；当前加载静态`rules/defaults.json`，没有记忆协调和动态库维护 |
| `wps-addin/src/project.js`、`project-ui.js`、`dev/project-store.cjs` | 阶段模型与原子保存；当前UI主要接入来源/合并/分类，`assignments/header/generation/split`字段仍为空 |
| `wps-addin/dev/register.ps1` | 开发注册/注销；不是正式安装包，需要单独完成服务生命周期及升级/卸载验收 |

**必须补齐的衔接：** 项目`review/merge/brand/generation/split`阶段不能只靠存在字段就判定完成；C1要将实际核对、用户确认与阶段状态绑定。已确认项目不能因分类库更新而静默改分类；改变分类/品牌/抬头后，旧输出必须标为过期。

## 4. 剩余工作量、依赖和里程碑

估算单位为**单名熟悉该项目的工程师有效工时**，含该包实现、专门测试、必要回归、记录与备份；不是AI运行时长或日历交付承诺。1人天按8小时。等待用户业务选择、取得样本、隔离WPS环境、历史资料大批人工确认的时间不计入。

| 阶段 | 工作包 | 工时区间 | 前置条件 | 可验收产物 |
| --- | --- | --- | --- | --- |
| A 修复与异常验收 | A1 8–12；A2 6–14；A3 8–14；A4 2–4 | **24–44小时** | 现有基线 | 根因/修复证据、P5矩阵、环境边界 |
| B 分类习惯与库维护（9C） | B1 6–10；B2 6–8；B3 6–10；B4 10–16；B5 6–12 | **34–56小时** | A验收通过 | 可保存、可解释、可撤销的本机分类库与已确认资料迁入报告 |
| C 品牌、供应商和抬头（10） | C1 6–10；C2 6–10；C3 8–12；C4 6–10；C5 6–10 | **32–52小时** | B；业务决定见§5 | 可手填并恢复的分类品牌表与抬头 |
| D 总询价工作簿（11） | D1 8–14；D2 8–14 | **16–28小时** | C | 数量正确、带抬头、对外字段干净的总工作簿 |
| E 文件拆分（12） | E1 6–10；E2 10–16 | **16–26小时** | D；重名规则明确 | 文件预览、逐份回执与失败后续作 |
| F 安装与验收（13） | F1 12–20；F2 12–16；F3 4–8 | **28–44小时** | E | 安装交付、四项目证据与用户说明 |
| 合计 | 21个工作包 | **150–250小时，约19–32人天** | 见上 | 一期完整流程 |

安排时可另留20%～30%风险余量，约 **180–325小时（23–41人天）**。A1/A2对偶发冻结只是首轮调查和修复预算：若12小时调查仍不能建立复现，输出已排除因素和下一实验后重估；**不能用预算耗尽作为“卡死已修复”的证据，也不能保证上述上限覆盖未知宿主缺陷。** 每完成A、B、C阶段按实际返工更新后续估算，不能累计重复计算已完成工作。

依赖顺序：`A → B → C → D → E → F`。A内部可先完成不依赖根因的P5取证；C4样本收集可与C2/C3准备并行，但品牌参考的正式验收要有真实格式样本。未获用户要求时不主动拆出多个代理任务。

## 5. 待用户决定 / 待资料，提前说清影响

本轮只整理计划，以下问题在对应开发包开始前，以具体界面或样本集中确认，不要求用户现在重复回答已确定的需求。

| 编号 | 缺失信息 | 需呈现的具体选择或资料 | 未明确前的处理 | 影响包 |
| --- | --- | --- | --- | --- |
| Q1 | 同类别多品牌适用哪些材料 | 用两材料、两品牌样例确认：每品牌询同一组完整需求，还是各品牌只覆盖指定材料子集 | 保留材料ID映射，范围标未确认；不擅自分摊或复制数量后宣称守恒 | C2/C3、D1 |
| Q2 | 空品牌是否允许及表达 | 明确填写品牌，或经用户确认的“不限品牌”状态；空白不能自行等同不限品牌 | 阻断品牌阶段完成 | C2/C5 |
| Q3 | 同类别同品牌有多个供应商 | 确认每供应商是否独立询价，以及工作表与供货单位的一一对应 | 显示冲突，禁止任取第一个供应商 | C2、D1/E1 |
| Q4 | 同类别同供应商多品牌文件重名 | 展示实际文件列表，建议追加品牌或序号，由用户确定一个规则 | 保留基础名`分类_供应商名称.xlsx`，碰撞阻断、绝不覆盖 | E1 |
| Q5 | 项目品牌参考表实际格式 | 用户已有品牌表的复制件；标注类别、品牌、备注列及合并单元格 | 先做C3手填；C4只做合成映射测试，不能标真实导入验收完成 | C4 |
| Q6 | 输出模板及抬头细节 | 只读对照本机项目一、项目二材料分类样式，展示脱敏样稿；确认地址/电话等必填项与打印布局 | 使用设计已列字段形成预览，不填真实联系人默认值；必填未确认不完成抬头 | C5/D2 |
| Q7 | 支持的WPS版本与交付环境 | 当前29161为已测试环境；28043能否在隔离环境启动、是否离线安装、权限范围 | 不动现有安装，不把开发注册冒充生产兼容结论 | A2/F1 |

## 6. 统一数据约定与重点检查

以下为**拟新增接口**，不是当前已经存在的函数。实现时如需改名，同包同步更新调用方、测试和本文件。

- `RfqClassify.suggest(item, library, {memory, projectId})`：保留原有两参调用；候选增加`source: 'rule'|'memory'`及ruleId/memoryId，结果仍`requiresConfirmation:true`、`accepted:null`；统一相近值为`partial`。
- 本机库包：`{schemaVersion:1, revision, library, memory}`，存一个`library-state.json`，使库和记忆一次原子保存；读写接口为`/api/library/load`与`/api/library/save`。未落盘初始revision为0，每次成功保存加1；save带`expectedRevision`，版本冲突返回409而非覆盖。
- `RfqProject.contentKey({collection, mergeIdentical, classification, assignments, header})`：固定字段顺序序列化有关内容，保留影响输出的材料/来源顺序；这是业务快照键，不替代文件SHA256。忽略UI筛选、纯时间、派生inputKey及回执字段，包含来源指纹、核对内容、确认结果和品牌抬头。品牌表上游key只传collection/mergeIdentical/classification；生成和拆分key再加入assignments/header，避免把派生键自身循环算入。
- 项目保留现有顶层schemaVersion 1；扩展`assignments/header/generation/split`的内部schema。旧值为null时迁移到缺失状态，未来未知版本拒绝且不写回旧文件。
- 分类品牌数据：`{schemaVersion:1,inputKey,coverageMode,rows,assignments}`。coverageMode初始为pending，Q1确认后保存alternative-quotes（各品牌询同一需求）或material-subsets（按材料子集）；不自行选择。rows保存`rowId/categoryId/scopeId/codes/name/feature/unit/quantity/sourceIds/sourceLabels/sources`，sources为已核对来源的内部快照，供生成编码和追溯使用；assignments保存`assignmentId/categoryId/rowIds/brand/supplier/note/coverageConfirmed/confirmedAt`。按类别展示，内部按行追溯；Q1～Q3未定时`coverageConfirmed:false`。
- `RfqBrandTable.build(groups, classification, inputKey)`返回上列空品牌数据；`RfqBrandTable.validate(data, rows)`返回`{ok, errors}`，不自动补品牌/供应商；同类多品牌用多条assignment，数量来源仍引用rows。
- `RfqBrandHost.read(application, binding)`读取分类品牌表并返回`{assignments}`；binding含`path/sheet/schemaVersion/rowMap`，rowMap绑定稳定assignmentId及允许编辑的列。测试通过真实或模拟单元格内容制造重复ID，不往正式接口塞测试开关。
- `RfqInquiryModel.build({brandTable,header,mergeIdentical,inputKey})`返回`{inputKey,sheets,trace}`；每sheet含`sheetId/name/assignmentId/kind:'inquiry'/values/layout`，trace仅内部。公开values全字符串，报价/金额为空。
- `RfqSplitPlan.build({model,generation,targetDirectory,naming})`返回`{inputKey,files,conflicts}`；每file含`fileId/sheetId/name/target`。实际执行前本机服务再检查路径、文件存在性和总文件SHA。
- 拆分持久回执：`{schemaVersion:1,inputKey,generationSha256,files:[{fileId,target,state,sha256,error}]}`，状态限定pending/succeeded/failed/needs-verification；最后一种表示文件可能已发布但回执未完整落盘。服务重启后按文件实况与SHA核实，不能复用已过期内存票据。

**五项重点检查（各自落入下文测试）：**

1. 分类库/记忆冲突、类别停用：保持人工确认，不暗改历史分类（B1/B3/B4）。
2. 重载、服务中断、磁盘保存失败：未保存核对不假装成功，已写文件可追踪（A/B2/E2）。
3. 未合并来源、多品牌适用范围：分组数量与来源只计一次；不同询价对象的数量不得直接加总当工程总量（C2/D1）。
4. 长名称、前导零、超长特征、文件名大小写碰撞：不截断数据或覆盖文件（D1/D2/E1）。
5. 旧项目/旧回执与新分类、品牌、抬头混用：下游过期，禁止用旧输出继续拆分（C1/D2/E2）。

## 7. 详细执行工作包

每包都按“先写能复现风险的失败用例 → 确认预期失败 → 最小实现 → 专门测试 → 受影响回归/实机 → 证据与交接 → 明确清单提交推送”结束。下列代码是接口与关键断言示例，开发时放入所列测试文件并补齐该包列明的全部场景；不能只测示例一项。

本节文件路径约定：`src/`、`dev/`、`test/`、`taskpane.html`、`styles.css`、`main.js`、`ribbon.xml`均相对`F:\材料软件开发\wps-addin\`；`docs/`、`outputs/`、`.gitignore`和`handoff.md`相对仓库根目录。已写完整`wps-addin/`前缀的路径不再重复拼接。

### A1｜侧栏停滞对照取证（8–12小时）

**文件：** 检查`main.js`、`dev/pane-diagnostics.js`、`dev/server.cjs`、`src/import-ui.js`、`src/taskpane.js`（均位于`wps-addin/`）；必要时仅增诊断。测试：`test/pane-diagnostics.test.cjs`、`test/server.test.cjs`、`test/ui-pane-diagnostics-check.cjs`。

- [ ] 核对38891进程、`/health`、WPS实际版本、加载项地址和Git状态；为本轮报告使用新文件名，所有输入记录SHA。
- [ ] 无探针和新版探针各做3轮新窗格：只导入测试一→确认列表/滚动→导入测试二→勾选合并3→2；新窗格另测编码样本读取并恢复已有核对。一次只变一个条件。
- [ ] 记录是否复用窗格、会话号、点击时间、DOM高度、导入数量、控件禁用、可见性、焦点、输入事件、frameCount/framePendingMs；每次点击坐标从即时截图获取。
- [ ] 出现停滞立即停止连点并封存报告/截图。当前报告仅100条，不能继续操作到旧证据被淘汰。旧会话48a51ada1001e247的早期数据已不在最终JSON，详见9月25日证据。
- [ ] 分层判定：输入未到→焦点/窗格；输入到但状态未更新→导入服务与状态更新；DOM已变但帧停→窗格生命周期/渲染；复现后用手动重载验证恢复。
- [ ] 输出独立`docs/wps-pane-root-cause-verification.md`：复现步骤、排除因素、待证假设、下一实验。未复现只写“本组未复现”，不关闭P1/P4。

```powershell
node --test wps-addin/test/pane-diagnostics.test.cjs wps-addin/test/server.test.cjs
node wps-addin/test/ui-pane-diagnostics-check.cjs
```

**出口：** 有可重复触发序列及故障层次，或有明确剩余假设与下一轮实验；后者仍未通过稳定性门槛。

### A2｜按证据修复P1/P4，必要时对照P3（6–14小时，根因未明时重估）

**文件：** 只改A1定位到的模块；保留`test/ribbon-recovery.test.cjs`和原导入/核对回归。

- [ ] 将A1触发序列转成最小回归，观察旧代码失败；若无法自动复现宿主渲染，保留可重复的实机步骤及诊断断言。
- [ ] 仅修复确定的窗格生命周期、同步宿主调用或状态问题；不靠周期性强制重载掩盖故障，不整页重写。
- [ ] 自动恢复若确有必要，先证明保存过的核对可恢复、未保存内容不会静默丢失；当前手动重载恢复能力继续保留。
- [ ] 只有证据指向版本差异时，在隔离环境对照29161/28043；不卸载/替换用户当前WPS，社区Writer报告不当作表格结论。
- [ ] 修复前后用同一触发序列对照；再覆盖新窗格、复用窗格、导入、确认核对、另存/取消、WPS重开。输出会话证据，跑全套现有测试。
- [ ] 若仍会卡住，将触发条件、恢复办法和未排除因素写入交接；**不得把A2勾为完成或开始宣称一期可交付**。

```powershell
node --test wps-addin/test/ribbon-recovery.test.cjs wps-addin/test/pane-diagnostics.test.cjs
node wps-addin/test/ui-import-check.cjs
node wps-addin/test/ui-review-check.cjs
```

**出口：** 原触发序列修复前失败、修复后通过；新增恢复动作无核对丢失；支持版本结论仅限实测环境。

### A3｜补齐P5真实WPS异常矩阵（8–14小时）

**文件：** `src/export-host.js`、`src/export-ui.js`、`src/project-host.js`、`src/classification-ui.js`、`dev/export-files.cjs`；测试`test/export-host.test.cjs`、`test/project-host.test.cjs`、`test/export-files.test.cjs`、`test/ui-export-check.cjs`、`test/ui-classification-check.cjs`。

- [ ] 建立独立合成目录，保存输入SHA、目标清单、当前活动测试簿及宏安全值；不降低安全设置。
- [ ] 多副本：两份新副本全部分类确认，仅第二份计划目标格预置标记；第一份成功后第二份拒绝。核对实际完成数量、两份副本及原件SHA；重复点击不得覆盖第一份或第二份标记。
- [ ] 写入失败分两种：已有目标的写前拒绝，以及工作簿已创建并写入后的真实保存失败。后一种使用合成目录下一个从未创建的子目录作为暂存目标父目录，路径语法合法且目标不存在，让实际WPS `SaveAs`失败；验证无成功回执、自建工作簿被清理、其他工作簿不关闭。若宿主不报错或弹窗行为不同，记录实际结果，不拿写前拒绝代替写中失败。
- [ ] 发布失败：prepare后、commit前仅在测试目标创建哨兵文件；真实WPS暂存写入后commit应拒绝，哨兵内容/SHA不变，侧栏不显示成功。
- [ ] 若侧栏缺少可控暂停点，新增`dev/acceptance-probe.js`及`test/acceptance-probe.test.cjs`，仅开发诊断模式开启；可在真实WPS第一块写入后注入异常验证清理，证据注明“注入异常”而不是原生WPS写入故障。不得把故障入口加入普通产品页面，F1发布构建排除。
- [ ] 每个异常后核对活动簿、宏安全值、临时文件和部分输出；解除故障后换新文件名成功另存并独立读回。发现差异先加失败回归再修复。

```javascript
// 在已有宿主/文件测试的真实返回值上断言，不仅检查提示文本。
assert.equal(after.activeWorkbook, before.activeWorkbook);
assert.equal(after.automationSecurity, before.automationSecurity);
assert.equal(after.sentinelSha256, before.sentinelSha256);
assert.equal(receipt, null); // 失败不能产生成功回执
```

**出口：** 每条实机记录具备触发方式、提示、已写/未写文件、SHA、恢复状态；缺一项即该场景未完成。

### A4｜基线、残留和修复阶段交接（2–4小时）

**文件：** `.gitignore`、`handoff.md`、相关证据；不扩展功能。

- [ ] P6的`F:\材料软件开发\%SystemDrive%`曾有3个工具缓存文件，历史递归删除被审批拒绝。保持忽略，不绕过历史拒绝；记录人工按字面路径核对后的处理结果，不因它延误功能验收。
- [ ] 复核P7静态白名单、P8来源/目标防过期和P9行标识回归仍在；不要重新开发已通过的功能。
- [ ] 汇总A1～A3状态，区分已修复、实机未验证和未定位。跑§9完整基线；更新支持环境和下一工作包。
- [ ] 明确文件清单审查、提交、推送、核SHA；生产安装仍列F1，不能写成已交付。

### B1｜记忆加入分类建议（6–10小时）

**本轮状态（2026-09-26）：** 已实现。`suggest(item,library,{memory,projectId})`保留两参兼容，候选带`source/ruleId/memoryId`，相近记忆统一为`partial`，不同类别形成冲突而不覆盖；停用类别的规则与记忆都不再成为新候选。验证：`test/classify-memory.test.cjs`。真实WPS实机复核未做。

**修改：** `src/classify.js`、`src/category-library.js`；**新增测试：** `test/classify-memory.test.cjs`；沿用`category-memory.test.cjs`。

- [ ] 写规则与记忆同类/异类、无记忆、撤销、不同项目、类别停用的失败用例；两参旧调用必须兼容。
- [ ] 注入`RfqCategoryMemory.find`，将`similar`转`partial`；候选保留各自依据，按不同categoryId形成冲突，不用最近记录强覆盖。
- [ ] 类别被停用时，其规则和记忆都不成为新候选；历史人工决策按保存的类别名可读。
- [ ] 返回值始终保留人工确认要求；在UI接线前先独立通过模型回归。

```javascript
const assert = require('node:assert/strict');
const Classify = require('../src/classify.js');
const Memory = require('../src/category-memory.js');
const library = {version:'test',categories:[{id:'a',name:'甲'},{id:'b',name:'乙'}],
  rules:[{id:'r',categoryId:'a',match:[{field:'name',any:['水管']}]}]};
const item = {name:'水管',feature:'DN50',unit:'m'};
const memory = Memory.learn(Memory.create(),{categoryId:'b',confirmedAt:'2026-09-25T00:00:00Z'}, {item});
const result = Classify.suggest(item,library,{memory,projectId:'p-test001'});
assert.equal(result.conflicts.length,2);
assert.equal(result.requiresConfirmation,true);
assert.equal(result.accepted,null);
```

### B2｜分类库与记忆原子持久化（6–8小时）

**本轮状态（2026-09-26）：** 已实现。`dev/library-store.cjs`单包`library-state.json`、临时文件写入后读回校验再原子替换、`expectedRevision`冲突拒绝(409)、损坏/未来schema保持原文件；服务新增`/api/library/load|save`。验证：`test/library-store.test.cjs`、`test/library-server.test.cjs`。服务重启恢复的实机查看未做。

**新增：** `dev/library-store.cjs`、`test/library-store.test.cjs`、`test/library-server.test.cjs`；**修改：** `dev/server.cjs`。

- [ ] 为§6库包实现`createLibraryStore({directory}).load()`和`.save({expectedRevision,library,memory})`；初始目录不存在时使用默认规则及空记忆，不写入项目仓库。
- [ ] 唯一临时文件→写入→读回及模型校验→原子替换；库和记忆只存一个包，避免两份文件一新一旧。串行化同包写入，校验revision，冲突拒绝。
- [ ] 覆盖磁盘失败、无效类别引用、损坏JSON、未来schema、并发旧revision；失败保留上一份磁盘数据及前端草稿，读失败不能自动以空库覆盖。
- [ ] API沿用会话令牌、Host/Origin限制和请求大小上限；正常模式也只能本机访问。

```javascript
// store为本包createLibraryStore在独立临时目录创建的实例。
const saved = await store.save({expectedRevision:0,library,memory});
await assert.rejects(store.save({expectedRevision:0,library,memory}), /版本|冲突/);
assert.equal((await store.load()).revision,saved.revision);
```

**出口：** 重启服务后库/记忆一致，过期写入与故障不会覆盖上一版。

### B3｜人工确认、撤销与学习协调（6–10小时）

**本轮状态（2026-09-26）：** 已实现。确认成功才学习，选下拉/渲染建议/恢复旧项目都不学习；未保存项目复用稳定`projectId`（保存时沿用同一编号）；记忆按确认来源列表记录，撤销或改选只失效本次来源，最后一个来源释放才失效，旧历史记忆不被猜删；保存失败留在本页并显示"习惯未保存，可重试"（重试按钮名`保存习惯重试`），不回滚分类确认。验证：`test/ui-memory-check.cjs`、`test/category-memory.test.cjs`。

**修改：** `src/category-memory.js`、`src/classification.js`、`src/classification-ui.js`、`src/project-ui.js`；**新增：** `test/ui-memory-check.cjs`，补模型测试。

- [ ] 在单行/批量最终确认成功后学习；选下拉但未确认、渲染建议、打开旧项目均不触发学习。
- [ ] 为未保存项目先分配稳定projectId，复用当前项目身份直到新建/打开其他项目；不在每次点击时重新生成。项目例外没有projectId时阻断该记忆操作。
- [ ] 记录`sourceProjectId/sourceRowId/decisionRevision`作为确认来源；全局和仅本项目分开。重复点击或保存重试不得新增重复依据。
- [ ] 扩展记忆的确认来源列表：撤销/修改本次确认时只失效该来源；同一材料类别若另有有效确认来源仍保留。无来源的新自动记忆撤销；旧历史记忆保留并允许维护界面人工撤销，不能猜来源删除。
- [ ] 记忆保存失败时分类确认留在本页并显示“习惯未保存，可重试”；重试幂等，不能误报分类也未确认。已确认项目不因库更新被自动改类。

```javascript
// ui-memory-check在真实页面事件上检查：只选类别不学习，确认后学习一次。
assert.equal((await store.load()).memory.memories.length,0);
await page.getByRole('button',{name:'确认本行分类'}).first().click();
await page.getByRole('button',{name:'保存习惯重试'}).click(); // 该场景先注入一次保存失败
assert.equal((await store.load()).memory.memories.length,1);
```

### B4｜分类库与记忆维护界面（10–16小时）

**本轮状态（2026-09-26）：** 已实现。`src/library-ui.js`提供类别新增/改名/停用（`no-inquiry`不可停用）、规则类别与匹配条件、别名、排除条件、依据编辑，记忆列表含材料/类别/范围/确认来源/时间并可撤销；草稿校验后原子保存，409冲突与保存失败都保留草稿并给可操作提示，加载失败只显示重试；保存后未确认行建议即时刷新、已确认行保留原决策与库版本。验证：`test/ui-library-check.cjs`。真实WPS保存后重载与重启服务的实机确认未做。

**新增：** `src/library-ui.js`、`test/ui-library-check.cjs`；**修改：** `taskpane.html`、`styles.css`、`src/category-library.js`、`src/classify.js`、`src/classification-ui.js`、`dev/server.cjs`。

- [ ] 列表/编辑提供类别新增、改名、停用；规则关键词、别名、条件、依据新增修改；稳定ID不随名称改变。
- [ ] `no-inquiry`保持“无需询价”的特殊决策含义和可选入口，不能因停用普通类别而消失；界面说明其用途，测试停用其他类别后仍可人工选择无需询价。
- [ ] 别名作为明确的名称匹配关键词保存；排除条件用与match相同的`{field,any}`结构，命中任一排除项则该规则不推荐。缺exclude的旧规则按空数组处理，拒绝空关键词/悬空类别/重复ID。
- [ ] 记忆列表显示材料、类别、范围、确认来源和时间，可筛选并撤销误记；保留历史，不硬删已有项目引用。
- [ ] 草稿校验→保存→重载本机库→更新未确认行建议；已确认行保留原决策及库版本。库加载失败时显示可操作的重试，不出现“可选类别”实际为空却宣称可手选的提示。
- [ ] 浏览器检查新增规则、排除命中、停用、撤销、409冲突、保存失败、380px窄侧栏；真实WPS保存后重载和重启服务确认恢复。

```javascript
// 新排除规则的关键结果：命中“临时”时不能推荐此条规则。
const excluded = {...library,rules:[{id:'pipe',categoryId:'a',
  match:[{field:'name',any:['水管']}],exclude:[{field:'feature',any:['临时']}]}]};
assert.equal(Classify.suggest({name:'水管',feature:'临时安装',unit:'m'},excluded).candidates.length,0);
```

### B5｜已确认分类资料整理与迁入（6–12小时，不含重新人工分类）

**本轮状态（2026-09-26）：** 只读核对已完成，**实现未开始**。两个入口文件存在（xlsx 1203622字节、json 3462字节）。xlsx共4张表：`核对说明`、`核对填写`（表头在第4行、25列；7587条有内容行，与历史基线263/3143/1473/2708＝7587一致）、`附加资料`（232条有内容、**0条填了核对意见**）、`类别参照`。人工填写区是**F:J列**（询价决定/最终类别/核对人/核对日期/核对依据），其中**6111条**五列齐全（项目一179、项目二2733、项目三1220、项目四1979）；同时填齐询价决定与最终类别的只有**5049条**，余下1062条不能直接当有效答案。`answer-overrides.json`是22条**关键词级**更正（如 风口风阀→风口、风阀，配电箱→汽车充电桩），属名称/规则归一，不是行级人工确认。

**结论用于B5实现：** `confirmed`只认F:J是否人工填写，不认文件名里的"确认"；5049与6111的差额、232条附加资料和22条覆盖先进入预览与待核对报告，不能自动并入生产库。人工列含核对人姓名等个人数据，迁入只保留类别与确认依据文本，不复制个人联系方式，样本文件不入Git。

**拟新增：** `wps-addin/dev/migrate-confirmed-library.cjs`、`wps-addin/test/migrate-confirmed-library.test.cjs`；迁入报告与数据只留`outputs/`和本机库目录。

- [ ] 只读核对本机`outputs/rule-return-20260920/分类人工核对_第十三批确认.xlsx`和`outputs/rule-fix-20260921/answer-overrides.json`是否存在、实际字段及明确确认标记；文件名含“确认”本身不足以证明每行均已确认。
- [ ] 将可证明的人工答案映射为类别及确认案例，保留原资料定位/确认依据，排除预测、空答案、被后来更正的旧答案及个人联系信息。缺乏最终答案链的记录进入待核对报告。
- [ ] 实现`buildMigration({rows,overrides},currentLibrary)`，返回`{categories,memories,rejected,conflicts}`；默认只生成预览，不直接改静态defaults或生产库。row统一输入字段为`recordId/item/categoryId/categoryName/confirmed/confirmationSource`，由只读适配层映射实际原表。
- [ ] 同义类别先建立显式映射；已确认四条口径优先作为一致性检查，不用模糊相似自动合并类别。重复案例保留多条确认来源而不是重复学习；冲突进入人工核对列表，不自动选最新预测。
- [ ] 逐项核对总数=可迁入+拒绝/待核对，抽查迁入案例与原人工答案；通过B2原子接口应用已核实部分，记录导入批次与版本，可撤销该批贡献。原资料哈希和已有项目决策不变。

```javascript
const {buildMigration} = require('../dev/migrate-confirmed-library.cjs');
const result = buildMigration({rows:[{recordId:'case-1',item:{name:'水管',feature:'DN50',unit:'m'},
  categoryId:'water-valve',categoryName:'水阀门',confirmed:false,confirmationSource:null}],overrides:[]},library);
assert.equal(result.memories.length,0);
assert.equal(result.rejected.length,1);
```

**B阶段出口：** 五包模型、接口、浏览器和WPS恢复通过；分类库变化不暗改已确认项目，学习资料仅来自人工确认。迁入资料缺失或有争议时明确记载待核对范围，不把四条默认规则宣称为完整类别库。

### C1｜项目阶段与未来字段衔接（6–10小时）

**修改：** `src/project.js`、`src/project-ui.js`、`src/import-ui.js`、`src/classification-ui.js`；测试`project.test.cjs`、`project-store.test.cjs`、`ui-project-check.cjs`。

- [ ] 实现§6 contentKey；扩展项目UI获取/恢复assignments、header、generation、split的回调；保留旧项目兼容，不更换已有projectId。
- [ ] import根据有效导入集合，review根据来源问题清零，merge根据本次模式及预览的明确确认，classification根据当前有效行全部人工确认来置ready；不仅检查对象非空。
- [ ] 用户不合并也要能明确确认“分别保留”的预览，不强迫另存合并表才能走后续。
- [ ] 分类变更使brand/generation/split过期；品牌或抬头变更使generation/split过期；来源和合并模式变化不得继续使用旧分组映射。
- [ ] 旧项目缺未来字段显示未完成；损坏或未知内部版本拒绝恢复且保留旧文件；列表与侧栏进度一致。

```javascript
const next = RfqProject.invalidate(readyProject,{kind:'header',detail:'联系方式变化'});
assert.equal(next.stages.generation.state,'stale');
assert.equal(next.stages.split.state,'stale');
assert.equal(next.projectId,readyProject.projectId);
```

### C2｜分类品牌表模型及范围规则（6–10小时）

**新增：** `src/brand-table.js`、`test/brand-table.test.cjs`；修改必要的`src/classification.js`校验。

- [ ] 先用两材料两品牌样例落实Q1～Q3；保留未定状态不自动放行。
- [ ] 从有效groups和最终分类生成rows，排除无需询价；按类别汇总条目数，内部保留rowId/scopeId/sourceIds及文本数量。
- [ ] assignment为类别＋品牌＋供应商＋明确rowIds映射，品牌/供应商不串列；检查未知rowId、同assignment重复rowId和漏配材料。
- [ ] 全部无需询价时输出“无需生成询价表”的空结果，不生成空供应商文件；允许保存该项目状态。
- [ ] 分类未全确认、范围未确认、空品牌或空供应商均阻断；只有经Q2确认的“不限品牌”才是明确状态。

```javascript
const pending = RfqClassification.create();
assert.throws(()=>RfqBrandTable.build([{id:'row-1',name:'水管'}],pending,'input-1'), /确认/);
// 完整样本生成后：品牌为空不应被当作已完成。
assert.equal(RfqBrandTable.validate(blankBrandTable,blankBrandTable.rows).ok,false);
```

### C3｜WPS分类品牌表生成、手填、读回与恢复（8–12小时）

**新增：** `src/brand-host.js`、`src/brand-ui.js`、`test/brand-host.test.cjs`、`test/ui-brand-check.cjs`；修改页面、白名单、项目接线。

- [ ] 生成独立分类品牌表工作簿或明确的插件自有工作表，禁止改原清单；保存时继续使用不覆盖的新文件路径。
- [ ] 显示类别、材料条目数、品牌、供应商、备注；多品牌按assignment多行展示，并可查看所含材料。稳定assignmentId和rowIds在内部映射中保留。
- [ ] 用户在WPS手填后点“读取并核对品牌表”；按稳定ID读回，不能只靠当前行号匹配；用户排序后仍正确，删行/重复ID/改固定分类列则明确报具体行。
- [ ] 只接受品牌、供应商、备注和已获确认的范围编辑；读回成功先预览，明确确认后才更新项目并使旧生成文件过期。
- [ ] 保存项目、关闭重开WPS、恢复项目后表路径/映射/填写结果一致；副本缺失或被外部改写时提示核对，不能把旧内存当最新表。

```javascript
assert.deepEqual(readAfterSort.assignments.map(row=>[row.assignmentId,row.brand,row.supplier]).sort(), expected.sort());
// duplicateIdApplication的模拟品牌表含两条相同assignmentId；binding不变。
assert.throws(()=>RfqBrandHost.read(duplicateIdApplication,binding), /标识/);
```

### C4｜项目品牌参考表导入与查看（6–10小时）

**新增：** `src/brand-reference.js`、`test/brand-reference.test.cjs`、`test/ui-brand-reference-check.cjs`；接入C3界面。

- [ ] 取得Q5复制件，只读确认表头、合并单元格、类别、品牌和备注列；记录本机样本路径和哈希，不上传样本。
- [ ] 实现`RfqBrandReference.parse(snapshot,mapping)`，mapping明确sheet/headerRow/categoryColumn/brandColumn/noteColumn；缺表头不猜、歧义要求选择映射。
- [ ] 列出参考类别/品牌/备注及来源表行；搜索只供查看，不自动改变分类或覆盖已填品牌。
- [ ] 覆盖空表、跨行标题、多品牌文本、错误映射、重复行和取消；真实WPS按原样查看并证明原件SHA不变。

```javascript
// 浏览器测试宿主在文件选择时返回合成参考表；品牌栏事先填入“已选品牌”。
const before = await page.getByLabel('品牌',{exact:true}).first().inputValue();
await page.getByRole('button',{name:'导入品牌参考表'}).click();
assert.equal(await page.getByLabel('品牌',{exact:true}).first().inputValue(),before);
```

**出口：** 手填路径仍可独立使用；无真实样本时仅C4实机验收保持未完成，不伪造格式兼容结论。

### C5｜询价抬头、本机复用及完整性确认（6–10小时）

**新增：** `src/inquiry-header.js`、`src/header-ui.js`、`dev/header-store.cjs`及同名测试、`test/ui-header-check.cjs`；修改服务/项目接线。

- [ ] `RfqInquiryHeader.validate(value)`校验公司名称、地址、工程名称、材料员、联系方式等Q6确认字段；不填默认真实信息，不用手机号正则排除合法座机/分机。
- [ ] 提供“保存本机模板”和明确选择后“应用模板”；模板与项目副本分离，修改模板不能改变已保存项目。
- [ ] 本机API`/api/header/load|save`按B2原子存储/版本冲突方式处理，但文件为独立`header-templates.json`，不与分类库混存。
- [ ] 确认页同时显示各assignment品牌/供应商和抬头；任何必填或范围未确认都不能使brand阶段ready。
- [ ] 保存失败保留页面草稿；重启恢复正确；改抬头使生成与拆分过期。真实联系人数据只在本机，测试使用合成字段。

```javascript
assert.equal(RfqInquiryHeader.validate({company:'',projectName:'测试楼',contact:'测试员',phone:'010-12345678'}).ok,false);
assert.equal(projectAfterTemplateEdit.header.company,projectBeforeTemplateEdit.header.company);
```

### D1｜询价分组、数量与字段白名单（8–14小时）

**新增：** `src/inquiry-model.js`、`src/decimal.js`、`test/inquiry-model.test.cjs`、`test/decimal.test.cjs`；**最小修改：** `src/merge.js`改为调用共用十进制函数，原API不变。

- [ ] 先把现有十进制相加行为写成共享回归：长整数、小数、零、前导零及非法数量；抽取`RfqDecimal.add(a,b)`，不改成浮点累加。
- [ ] 按已确认的类别＋品牌形成询价组，绑定供应商；Q3多供应商未定或同组矛盾就阻断，不任取一个。
- [ ] 组内仅类别、名称、特征、单位、品牌要求相同才合计；未预合并时额外保留scopeId。使用原来源集合去重计数，不能再把已经合并过的数量重复加一次。
- [ ] 多品牌若属于替代询价，同一工程需求出现在不同询价对象中应各自守恒，并保留assignment映射；不把各报价对象数量总和当采购总量。该语义以Q1确认结果实现。
- [ ] 输出values只含§2白名单；不展开内部对象、不复制源sheet。报价/金额空白，字面公式样文本按文本保留；超长单元格明确拒绝，不截断。
- [ ] worksheet名称限制、字符替换和替换后的碰撞都在预览暴露；ID与显示名分离，稳定顺序可重复生成。

```javascript
const Decimal = require('../src/decimal.js');
assert.equal(Decimal.add('0.1','0.2'),'0.3');
assert.equal(separateModel.trace.some(row=>row.scopeIds.length>1),false);
assert.equal(model.sheets.every(sheet=>sheet.kind==='inquiry'),true);
assert.equal(model.sheets.every(sheet=>sheet.values.every(row=>row.every(value=>typeof value==='string'))),true);
```

### D2｜真实WPS总询价工作簿与版式（8–14小时）

**新增：** `src/inquiry-ui.js`、`test/ui-inquiry-check.cjs`；**修改：** `src/export-host.js`、`src/project-ui.js`、页面/白名单及`test/export-host.test.cjs`。

- [ ] 从Q6脱敏样稿落实抬头区域、清单起始行、列宽、特征换行、打印重复表头和分页；用`sheet.layout`传递布局，旧内部清单无layout时保留当前行为。
- [ ] 生成前重算contentKey和阶段有效性；用户确认预览、选新路径，沿用prepare→WPS写入→禁宏重开逐值校验→独占commit。
- [ ] 将D1的询价model.sheets与由trace生成的`kind:'internal'`追溯页组成独立workbookModel，再交给宿主写入；保留D1对外模型的纯询价页边界。E阶段只取kind=inquiry页，绝不按页名猜测。
- [ ] generation保存target/sha256/inputKey、询价sheetId清单及当次modelSnapshot（固定生成时间、公开值和布局）；E2重启续作复用该快照，不用新时间重新生成另一份内容。控制保存体积并沿用服务大小限制，超过限制明确拒绝；内容变化后旧回执过期，只有全部写入并校验成功才置generation ready。
- [ ] 测取消、写入/提交失败、长特征、多页、前导零、长小数、两品牌分表；真实WPS查看和独立读回，旧内部三表回归仍通过。

```javascript
assert.equal(generation.inputKey,currentInputKey);
assert.deepEqual(generation.sheetIds,model.sheets.filter(sheet=>sheet.kind==='inquiry').map(sheet=>sheet.sheetId));
assert.equal(readback.prices.every(value=>value===''),true);
```

### E1｜拆分计划、文件名与预检（6–10小时）

**新增：** `src/split-plan.js`、`test/split-plan.test.cjs`、`src/split-ui.js`、`test/ui-split-check.cjs`；修改页面与白名单。

- [ ] 落实Q4命名规则；基础名保持`分类_供应商名称.xlsx`。非法字符、保留设备名、末尾点/空格、大小写和清洗后同名、过长路径均在预览中给具体冲突。
- [ ] 文件计划逐项显示类别、品牌、供应商、工作表、材料数和绝对输出路径；一个询价sheetId对应一个fileId，不依赖页名排序。
- [ ] 拆分前检查全部信息确认、contentKey、总工作簿实际SHA、目标目录和全部已有目标；任何已知冲突在发布第一份之前阻断。
- [ ] 预检后仍可能发生目标竞争，执行时继续独占发布；不能因为预检通过就使用覆盖式保存。

```javascript
assert.equal(plan.files.length,inquirySheetIds.length);
assert.equal(new Set(plan.files.map(file=>file.target.toLowerCase())).size,plan.files.length);
assert.ok(conflictingPlan.conflicts.length>0);
```

### E2｜逐份拆分、持久回执和失败续作（10–16小时）

**新增：** `dev/split-store.cjs`、`test/split-store.test.cjs`、`test/split-server.test.cjs`；修改`src/split-ui.js`、`dev/server.cjs`、项目接线及`ui-split-check.cjs`。

- [ ] 为每个fileId创建独立暂存和发布票据，用generation.modelSnapshot中已验证的对应询价页生成单表xlsx；不整簿复制，不带隐藏内部表、路径、注释或价格。
- [ ] 按文件执行写入/重开校验/独占发布；成功立即原子保存SHA回执，失败记录具体文件与原因；UI显示完成x份/失败y份。
- [ ] 中途退出或服务重启后，从本机split回执加载，重算已有文件SHA；成功且SHA一致的跳过，只重试未完成项。
- [ ] 如果文件已发布但回执写入前中断，标记“结果待核对”，重开比对当前模型和内容后才能确认或建议换新名；不盲目覆盖、不悄悄当作成功。
- [ ] 总文件变化、输入key过期或成功文件被外部改写时拒绝沿用旧拆分状态。全部文件核实成功后才使split ready。
- [ ] 两品牌/同供应商/重名、第二文件失败、重启重试、响应丢失、外部文件变更实机验证；原总工作簿和原清单SHA不变。

```javascript
assert.equal(firstRun.succeeded.length,1);
assert.equal(firstRun.failed.length,1);
assert.equal(retry.writtenFileIds.includes(firstRun.succeeded[0].fileId),false);
assert.equal(afterRetry.firstFileSha256,beforeRetry.firstFileSha256);
```

### F1｜安装、服务启动、升级与卸载（12–20小时）

**拟新增：** `wps-addin/install/install.ps1`、`start.ps1`、`uninstall.ps1`、`test/install.test.cjs`；修改`dev/server.cjs`启动配置/资源清单；增加发布清单与运行说明。

- [ ] 执行时核对WPS官方部署文档和Q7环境，确定支持版本及用户级安装方式；当前`enable_dev`注册不能直接作为生产支持结论。
- [ ] 选择可验证的本机发行包：固定代码/运行时版本和许可证清单；服务仅监听127.0.0.1，健康检查区分身份，端口冲突不杀陌生进程。
- [ ] 启动器避免多实例、提供可见的启动失败原因，后台进程默认隐藏窗口；不依赖Codex当前会话维持服务，不擅自降低WPS/Windows安全设置。
- [ ] 注册前备份publish.xml，只增改本插件节点；卸载只移除本插件、停止其所属进程，默认保留项目/分类库/抬头数据并解释位置。
- [ ] 升级先备份用户数据并校验兼容，失败回退代码/注册；未来schema不能被旧程序覆盖。正式包不带探针、故障注入入口和测试数据。
- [ ] 干净测试环境走安装→重启WPS/系统→打开项目→升级→回退→卸载→重装恢复；本机开发环境保持可恢复。

```javascript
assert.equal(otherPluginXmlAfter,otherPluginXmlBefore);
assert.equal(userDataShaAfterUninstall,userDataShaBeforeUninstall);
assert.equal(releaseFiles.some(name=>/host-probe|pane-diagnostics|acceptance-probe|fault/.test(name)),false);
```

### F2｜四项目完整验收与输出扫描（12–16小时，不含大批人工分类时间）

**新增：** `wps-addin/test/release-audit.cjs`、`docs/wps-phase1-acceptance.md`；合成样本生成/本机结果留`outputs/`。

- [ ] 先跑小型合成全链路，包含重复项、不同来源、无需询价、分类冲突、两品牌和失败续作；再对四项目的复制件验收。
- [ ] 历史读取基线为33张表、候选263/3143/1473/2708共7587条，曾预合并5399条；只作为相同输入指纹下的对照，不强迫新修正结果凑旧数字。
- [ ] 四项目逐步走导入→来源核对→可选合并→人工分类→品牌/供应商/抬头→总表→拆分→重启恢复；未有人工确认的条目不得自动全选伪造验收。
- [ ] 每组对账来源集合、分组数及精确数量；Q1多品牌按询价对象分别对账，工程需求总量单独保留。
- [ ] 自动解包检查所有对外xlsx：sheet数量、隐藏表、单元格、公式、批注/链接等；只允许白名单输出，不含原价、历史报价、内部路径/核对记录。
- [ ] 审计工具输入为`files`及本机`expectedManifest`；清单按fileId/sheet/行号映射预期公开值与内部sourceIds。先逐值核对输出，再按该映射对账来源，sourceIds不得为了验收而写进供应商文件。
- [ ] WPS视觉复核打印/分页/长特征/列宽/抬头；记录所有输入输出SHA和实际耗时，明确卡顿/漏行及恢复结果，不虚构性能门槛。

```javascript
assert.equal(audit.internalSheets.length,0);
assert.equal(audit.forbiddenFields.length,0);
assert.equal(audit.formulaCells.length,0);
assert.deepEqual(audit.sourceIds.sort(),expectedSourceIds.sort());
```

### F3｜用户说明、发布核对及最终交接（4–8小时）

**新增：** `docs/wps-user-guide.md`、`docs/wps-install-guide.md`、`docs/wps-phase1-release-checklist.md`；更新本文件。

- [ ] 按真实界面写安装/启动、导入、核对、合并、分类维护、品牌抬头、生成、拆分、恢复操作，不使用效果图充当运行截图。
- [ ] 说明重载会影响未保存内容、记忆撤销、库保存冲突、部分文件成功、原件保护和数据备份位置；每个错误说明下一步操作。
- [ ] 一名按文档操作的验收者完整走一遍合成项目，记录文案歧义并修订；用户只核对业务结果，不替代可自动执行的技术测试。
- [ ] 汇总全部工作包证据、支持环境、已知限制与版本；P1/P4未解决或关键P5未验收时不能标记一期交付。
- [ ] 明确文件清单提交、推送并核SHA；记录安装包校验值。合入main或创建发布版本作为单独明确操作安排，不擅自强推历史。

## 8. 阶段验收与不重复测试原则

| 门槛 | 必须满足 | 失败时回到 |
| --- | --- | --- |
| A稳定性 | P1/P4根因与修复可核对；P5矩阵有真实WPS证据；P3支持边界明确 | A1/A2/A3；P6非功能残留单列 |
| B分类习惯 | 人工确认才学、冲突可见、撤销有效、持久化失败不丢当前核对、重启可恢复、确认资料迁入可对账 | B1～B5 |
| C填写 | 全分类确认才建表；品牌与供应商独立；范围/抬头明确；项目阶段和外部编辑可核对 | C1～C5 |
| D生成 | 来源/数量正确、版式可读、旧输出过期、无原价泄露 | D1/D2 |
| E拆分 | 每页对应正确文件、不覆盖、部分失败可追踪与恢复、输出无内部资料 | E1/E2 |
| F交付 | 独立启动、安装升级卸载可恢复、四项目通过、说明可复现 | F1～F3及发现缺陷所属包 |

日常小改只跑相关专门测试；每个阶段完成及涉及宿主/共同模型的改动跑全套。实机已通过的样本不要求用户无理由重做；新增测试必须说明要验证哪个尚未关闭风险。所有结果分别标注“单测”“浏览器模拟宿主”“真实WPS”，不得混写。

## 9. 接续第一轮的具体动作及命令

**接续第一轮只执行A1，遇到证据足以定位时进入A2；不先补新功能。**

- [ ] 完整读本文件、用户最新消息、根AGENTS.md和两日验证记录。
- [ ] 运行下面只读状态检查；监听存在时先确认进程属于本插件，再决定复用，不因端口占用盲目终止。
- [ ] 为A1新建一个独立报告文件；选择合成`测试一.xlsx/测试二.xlsx`及编码样本，记录SHA；核对已保存核对可直接恢复。
- [ ] 先完成一轮无探针对照，封存结果；再在核对已保存的前提下切换诊断服务和新窗格。每次只变一个条件，停滞立即保存现场。
- [ ] 本轮结束更新A1进度、下一实验和证据路径，按§10备份；若不能复现，写清未复现的组合，不反复让用户猜状态。

```powershell
git status --short
git log -1 --oneline
Get-NetTCPConnection -LocalPort 38891 -State Listen -ErrorAction SilentlyContinue
Invoke-RestMethod 'http://127.0.0.1:38891/health'
```

服务命令（仅在确认需要启动且无本插件实例占用时执行；切换前保留现场）：

```powershell
node wps-addin/dev/server.cjs --import-directory F:\材料软件开发\outputs\wps-save-native\imports
# 诊断模式：报告文件名每个会话使用新名称；此处为示例。
node wps-addin/dev/server.cjs --report F:\材料软件开发\outputs\wps-pane-next-session.json --probe-output F:\材料软件开发\outputs\wps-pane-next-output.xlsx --import-directory F:\材料软件开发\outputs\wps-save-native\imports
```

当前完整回归命令（新增测试脚本须加入该清单）：

```powershell
node --test wps-addin/test/*.test.cjs
$env:NODE_PATH='C:\Users\刘杨\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node wps-addin/test/ui-check.cjs
node wps-addin/test/ui-review-check.cjs
node wps-addin/test/ui-import-check.cjs
node wps-addin/test/ui-export-check.cjs
node wps-addin/test/ui-project-check.cjs
node wps-addin/test/ui-classification-check.cjs
node wps-addin/test/ui-pane-diagnostics-check.cjs
node wps-addin/test/ui-memory-check.cjs
node wps-addin/test/ui-library-check.cjs
```

`NODE_PATH`仅为本机已验证位置；换机器先查询环境。2026-09-26实际输出为**166项Node测试、9组浏览器检查通过**；144/7是2026-09-25历史基线。新增测试后按实际输出更新计数；代码未变的纯文档整理只做文档/路径/差异检查，不无故重复运行整套WPS测试。

## 10. 每包提交和交接要求

1. 核对工作包修改文件和验证结果；文件清单中不得出现原始清单、报价、联系方式、凭据、本机配置、输出和历史网页资料。
2. 独立证据记实际输入指纹、场景、输出/提示、通过与未通过项。本文件只更新状态、估算变动、下一项；未完成项保持未勾选。
3. 只暂存本包明确路径，审查完整暂存差异，`git diff --cached --check`通过后提交；推送已配置分支并比对本地与远程SHA。
4. 推送失败保留本地提交，记录待同步与原因；不强推，不声称已备份。不要为记录当前提交自己的SHA反复创建只有SHA变化的循环提交。

```powershell
# git add -- 后逐一列出本包实际文件；禁止 git add . / git add -A。
git diff --cached --check
git diff --cached
git commit -m "本包具体改动"
git push origin feat/wps-phase1
git rev-parse HEAD
git ls-remote origin refs/heads/feat/wps-phase1
```

**2026-09-26备份记录：** 本轮从`53b9d8e`继续，依次提交B1`6149b99`、B2`d6ec9b3`、B3`7438c20`、B4模型`7f92b3b`、B4界面`7664f9a`，每包只暂存明确路径并通过`git diff --cached --check`；前四个已推送并用`git ls-remote`核对一致，最后一个随本次文档提交一起推送，最终核对结果在任务回复中记录。

## 11. 现场、样本和证据索引

### 最近现场（历史观察，接续时重新检查）

- 2026-09-25最后实机使用WPS表格`12.1.0.29161`；38891无探针服务健康接口为`development`。此处不保证当前进程仍运行。
- 编码合成样本已关闭且磁盘未变；核对记录保存在WPS侧栏localStorage。来源核对保存记录和项目分类记录是不同入口，不要混用。
- 合成项目`p-muflwtzr-whahd6u2`曾恢复1份来源、未合并、分类4/4及正确阶段；仅作测试项目，不覆盖真实项目记录。

### 本机合成样本（不入Git）

| 路径 | 用途 / 已知结果 |
| --- | --- |
| `outputs/wps-save-native/测试一.xlsx`、`测试二.xlsx` | 导入和3→2合并；水管数量0.1/0.2与异常字面文本边界 |
| `outputs/wps-classification-case-20260924/分类口径复测.xlsx` | 四条已确认业务口径、3张表、真实表头第2行 |
| `outputs/wps-numeric-format-20260924/编码格式复测.xlsx` | 给排水A3数字123、格式000000；SHA `B24A413F7AF8EE14378581607863E0985E5740D822AE9A6E58D5D604CFFFD810` |
| `outputs/wps-numeric-format-20260924/编码格式输出.xlsx` | 清单B2文本000123；SHA `DE1C75530DA1173DE27426779012088366AF32CC09122D3C1E5511CDCDDB9638` |
| `outputs/wps-pane-diagnostic-20260925.json` | 滚动报告最终只剩新会话100条，不能当作旧冻结完整证据 |

### 数据与文件边界

导入副本默认`%LOCALAPPDATA%\WpsRfqAddin\imports`，项目默认`%LOCALAPPDATA%\WpsRfqAddin\projects`；本机测试服务也可能指定`outputs/`目录。核对localStorage键前缀：导入用`rfq-import-review-v1:`，当前工作簿用`rfq-source-review-v1:`。现有默认分类仅四类四规则，不代表历史全类别已迁入；按B5检查明确人工答案后扩展，不能批量接受旧网页预测。

### 独立证据（接手按当前任务查阅）

- 近期缺陷、分类写列、数值输出：`docs/wps-repair-verification-20260924.md`。
- 最近侧栏取证、格式失效、关闭重开恢复和144项回归：`docs/wps-pane-review-verification-20260925.md`。
- 9C/B1～B4分类习惯与库维护：本轮证据即测试本身，`wps-addin/test/classify-memory.test.cjs`（建议接线）、`wps-addin/test/library-store.test.cjs`与`wps-addin/test/library-server.test.cjs`（原子持久化与409）、`wps-addin/test/ui-memory-check.cjs`（学习/撤销/重试）、`wps-addin/test/ui-library-check.cjs`（维护界面）；结果166项Node测试、9组浏览器检查通过，真实WPS复核见0.1的T4。本轮未新建独立markdown证据文件。
- 内部另存：`docs/wps-merge-save-verification.md`。
- 接入、识别、核对、导入、合并：`docs/wps-foundation-verification.md`、`docs/wps-parser-verification.md`、`docs/wps-source-review-verification.md`、`docs/wps-multi-import-verification.md`、`docs/wps-exact-merge-verification.md`。
- 设计：`docs/wps-addin-phase1-design-v2.md`；历史分片计划在`docs/superpowers/plans/`，当前待办以本文件为准。
- 原始业务资料只留本机`分类/`；输出样式参考项目一/项目二材料分类文件。`docs/mockups/`是效果图，不是开发或验收进度。
