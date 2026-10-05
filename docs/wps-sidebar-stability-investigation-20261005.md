# WPS侧栏停摆调查：历史证据与本轮接续

问题编号：`SIDEBAR-STABILITY-01`。历史证据整理日期：2026-10-05。状态：**未解决，阻断正式交付**。

本记录补充[正式交付阻断项](wps-sidebar-stability-blocker.md)与[验收记录](wps-workflow-v3-acceptance.md)，不替代最新`handoff.md`。重建或完整重启WPS后的临时恢复不算修复；功能验证通过也不解除本项。

## 1. 历史核查范围与证据口径

历史部分由独立子代理只读核查：完整阅读交接、根目录规则、阻断记录与验收最新小节，实际查看获批图03及已封存的停摆截图；读取本机报告、真人反馈、launcher与观察器实现，使用Node直接解析原始JSON时间字符串并计算SHA256。未执行UI/COM、未启动服务、未修改业务JSON或保护pane、未重做业务确认。本轮只新增本调查文档。

获批图03的验收点仍为成果表内编辑、整表一次确认、错误定位和草稿保存；调查不得恢复侧栏逐行审核或增加业务确认。本记录不复制项目内容、原始清单、联系方式或凭据，本机原始报告及截图仍留在忽略的`outputs/`目录。

需要分别判断三种事实：rAF回调是否完成、DOM/JS是否继续运行、原生画面及功能区入口是否响应。`pane-diagnostics.js`每3秒只请求一个rAF，`frameCount`是该探针已完成的回调次数，**不是宿主实际呈现帧数**。rAF停止本身不能证明某个CEF进程崩溃或确定合成器内部原因。`scriptError=null`只表示探针没有捕获错误，不能排除未被覆盖的异常。

时间表均使用UTC；文件名沿用封存时标签，当地日期可能已跨日。末次rAF时间按`receivedAt − sinceLastFrameMs`推算，服务端接收延迟未校正，因此属于近似值，不是浏览器端精确时间戳。

## 2. 两项已证实的观测盲点

### 2.1 100条报告上限会删除心跳

历史服务收集规则见`wps-addin/dev/server.cjs`的`/__probe/report`处理：新增报告后若总数超过100，优先删除数组中第一条`stage= pane-heartbeat`；没有此类记录时才删除第一条。所有会话共用这一个数组。

当数组已有100条非`pane-heartbeat`时，新到达的`pane-heartbeat`会立即被删除；文件仍可能被重写，但报告正文及末条`receivedAt`保持不变。导航观察器的心跳为`stage=navigation-probe/event=heartbeat`，不适用这项优先删除规则，历史导航报告又可能因滚动窗口而丢掉更早的回调事件。

E08、E09、E10、E11、E12均为100条记录且没有保留`pane-heartbeat`。因此这些报告的末条时间不能作为“JS/帧在该时刻停止”的证据。这个规则**不能解释新业务click缺失**：新click不属于被优先删除的心跳。它只说明心跳、rAF计数和停摆发生前后的连续观测被遮蔽，缺少click仍须独立调查。

已核对的成对内容如下：

| 报告 | 字节数 | SHA256 | 能证明的事实 |
| --- | ---: | --- | --- |
| E11定位、E12接续灰白 | 各228696 | `640859758b7203293c7732996cca374cc62ec173c578bdf91ea1efaaa2e65e40` | 两份正文完全相同；末条均为10-04 16:46:38.453Z、frame930、pending0 |
| E08灰白、E09重建无提示 | 各238400 | `18a118bd2d82ca20f457d31906aa8b961a027e911cca5220ebbd192167846129` | 两份正文完全相同；末条均为10-04 12:11:45.754Z、frame786、pending0 |

E11与E12副本文件mtime分别为10-04 16:46:38.586Z、17:23:08.590Z；这些是文件元数据，不能据此确定灰白开始时间。

### 2.2 旧导航探针在发送entry前访问宿主

本机`evidence/nav-probe/navigation-probe.js`包装回调时，先执行`argumentsShape()`读取控件`Id/id/ID/Tag/tag`；随后`report('entry', ...)`构造payload时还调用`snapshot()`读取`Application.PluginStorage`及两个导航键，最后才执行fetch。

所以旧entry不是“读取宿主之前”的入口证据。没有entry既可能是回调未进入，也可能是已进入后卡在观察器自身的宿主读取，或发送/保存失败；旧报告无法区分。观察器中的try/catch能处理抛出异常，不能保证同步宿主调用及时返回。

`launcher.cjs`向Ribbon与pane注入导航观察器；`launcher-plain-ribbon.cjs`保留原产品Ribbon，仅保留已有pane观察器，并移除自动执行的host-probe。当前C05所用plain模式没有导航回调观察器，不能从pane报告推断Ribbon回调是否执行。下一轮须先发送不访问宿主的入口标记，再逐段记录宿主读取/调用前后，观察器不能先执行被调查的宿主读取。

## 3. 至少五次约60秒后rAF停止的重复证据

下列五个独立会话均保留ready、明确`pane-render-stalled`及停摆后的JS报告，`frameCount`均为21。21来自首次请求加约20次3秒周期，不能把“第21个真实绘制帧”作为触发条件。

| 证据/会话 | ready UTC | stall记录 UTC | 推算末次rAF UTC | ready至末次rAF | 停摆后仍运行的JS证据 |
| --- | --- | --- | --- | ---: | --- |
| E01 / `dde3aca299a3a6ba` | 09-26 04:22:26.954 | 04:23:38.965 | 04:23:26.958 | 60.004秒 | 04:23:39.046 wheel、39.047 keydown，后续心跳 |
| E02 / `146278ed3b2e1f17` | 09-26 04:18:50.261 | 04:20:05.247 | 04:19:50.249 | 59.988秒 | 04:20:05.248起持续pane-heartbeat；此会话没有保留停摆后的DOM输入事件 |
| E03 / `f3dcc2b9c7d256cd` | 10-03 10:43:42.382 | 10:44:54.391 | 10:44:42.389 | 60.007秒 | 10:44:56.443 wheel、10:45:00.263 keydown，心跳至10:46:09.398 |
| E04 / `532d8da39c39e02c` | 10-04 11:09:05.054 | 11:10:20.065 | 11:10:05.065 | 60.011秒 | 11:12:56.600 browse-files click及前后focusin，仍为frame21 |
| E05 / `d6d3a270677f8d2d` | 10-04 15:58:11.119 | 15:59:26.133 | 15:59:11.124 | 60.005秒 | 15:59:29.852 wheel，仍为frame21 |

五次可以共同证明“rAF回调停止后，JS定时器或DOM事件仍运行”；其中四次另有停摆后DOM输入事件。心跳仅证明定时器与报告链路，不代表真人点击。输入事件的执行者应由配对真人反馈或操作记录识别，事件本身不证明点击者身份。

E03未受100条上限影响，共60条，其中49条心跳。停摆后`framePendingMs`持续增加；E04在浏览点击前已经停摆，E05也在后续wheel前明确报告停摆。因此不能把这些后续点击或滚轮当作其首次停摆的原因。五次的约60秒模式是可复验线索，尚未证明具体生命周期、宿主调用或CEF内部机制；E02的初始blur、其他会话的focus/scroll也不能自动解释共同原因。

## 4. 导航已消费但可见画面停留的历史现场

E06及配对真人反馈E13记录10-03现场：

| UTC | 已保留记录 | 解释范围 |
| --- | --- | --- |
| 04:54:17.897 / 17.900 | OnGotoStage entry / return，review请求已写入 | 该次回调及报告涉及的宿主读取确实返回 |
| 04:54:18.859 | pane state为review，请求已消费 | 存储接力及DOM状态变化已观测 |
| 04:54:33.670以后 | wheel、click等事件到达；rAF为21，等待继续增加 | 页面事件运行与rAF完成已分离 |
| 04:56:16.794 | 真人反馈仍显示第二步且已卡死 | DOM状态不能替代原生可见效果 |
| 04:56:54.394 / 55.920 | E07中OnReloadRfqPane entry / return | 此次重建回调完成 |
| 04:56:56.122 | E07出现新pane ready，阶段import | 新页面创建得到证实；仅为该次临时恢复 |

该现场可缩小“当次导航未写入或未消费”的解释范围，不能解释后来Ribbon重建入口无提示的灰白现场，也不能证明重建已修复长期停摆。

## 5. 长会话灰白及无新事件的证据边界

C13长会话`7d53a7917f536fb7`从10-04 11:32:29.143Z的ready开始，报告最后保留12:11:45.754Z、frame786，覆盖约39分钟。接续原生截图记录灰白；root重建未出现提示，关闭灰白侧栏可见生效，重新打开未恢复，真人反馈重建仍无反应。E08与E09完全相同且没有保留心跳，因此不能从最后记录确定灰白开始时刻、JS实际停止时刻或某个宿主调用卡点。

后续初始会话`d6d3...`发生第3节的60秒rAF停止；只重建页面后，E10/E11保留旧会话10-04 16:00:08.450Z pagehide与新会话`215398fa5acc1b27`16:00:08.570Z ready。新会话至少持续到16:46:38.453Z的C05定位，约46分30秒，期间有实际业务操作。长会话不是“每次创建后都在60秒失效”的证据，需与初始会话分开检验。

| C05 UTC | 已保留事实 | 不得扩大为 |
| --- | --- | --- |
| 16:45:38.325 | 整表主按钮click，frame910/pending0 | 本次确认成功或侧栏稳定性通过 |
| 16:45:38.392 | 同会话显示校验拒绝 | 整体停摆根因 |
| 16:46:38.431 / 38.453 | 定位按钮click / 定位状态；frame930/pending0 | rAF在frame930停止 |
| 后续接续 | E15原生截图侧栏灰白，E12报告与定位时正文相同 | 灰白的准确发生时间、Ribbon回调未进入或确定根因 |

E14另记录11:12:56.600Z工具browse click和11:14:29.138Z真人反馈对应的DOM click；不能把这一现场写成没有点击事件。HTTP200仅证明本机服务响应，不能证明WPS页面、宿主桥或Ribbon回调仍可用。旧服务退出的准确时间和原因未知，也不能用它解释其他服务存活期间的停摆。

当前证据还不能连接“初始约60秒rAF停止”“长会话灰白”“Ribbon打开/重建入口无反应”为同一内部原因。启动时review异常若被另行证实，须作为独立启动缺陷处理，未有因果证据前不得称为灰白根因。

## 6. 本机证据索引与SHA256

下表文件均仅在本机。目录前缀相对仓库根，完整路径为前缀加文件名：

- P：`outputs/wps-acceptance-20260926/probe/`
- C：`outputs/wps-acceptance-20261003/R12-L-supplement/c-preparation/evidence/`
- N：`outputs/wps-acceptance-20261003/R12-L-supplement/evidence/nav-probe/`

| ID | 前缀 / 文件名 | SHA256 |
| --- | --- | --- |
| E01 | P / `pane-report-20260926-nodialog-stall.json` | `ab79df2bd4074aad3a19af7a421708c33917be579d705cfaa26bca1bc669587f` |
| E02 | P / `pane-report-20260926-stall.json` | `dfa89c2e86915663e2683e2b2b8c44dfea9a67304a6e6a7fa8c6611eaa79429c` |
| E03 | C / `c00-plain-ribbon-pane-frame-pause-20261003-report.json` | `1fc151456a8a5aaa7531a686ea2bdaec55da5b0609fd2feaaeb5ff685948c574` |
| E04 | C / `c13-post-human-restart-first-import-page-report-20261004.json` | `0f92bc713ce1e44e22bf9558c2689682b04b4175f0909d18d67b0621f29775c5` |
| E05 | C / `c13-second-human-restart-scroll-stalled-report-20261004.json` | `a626d0317eed20f5f05286465b761c7d4e7575ce668e035fb79ad35ca5244ce7` |
| E06 | N / `user-review-consumed-screen-stalled-report.json` | `d5c723f0019848bb7f3b829c4169e26e6b3a6d8600fb7705674b145c09f306e6` |
| E07 | N / `user-reload-restored-report.json` | `8f3c1dd650f5aa39c08ca0ccddf4702bd46fab9633500cf41a4fb3fcf0c1b80c` |
| E08 | C / `c13-resume-maximized-gray-pane-report-20261004.json` | `18a118bd2d82ca20f457d31906aa8b961a027e911cca5220ebbd192167846129` |
| E09 | C / `c13-rebuild-no-dialog-maximized-report-20261004.json` | `18a118bd2d82ca20f457d31906aa8b961a027e911cca5220ebbd192167846129` |
| E10 | C / `c05-a23-human-rejected-report-20261005.json` | `6fe34c87e99dc2a8cb9ce594e4c5774e4ec31fa8ac028752d1c4a309bf295d81` |
| E11 | C / `c05-a23-k4-located-report-20261005.json` | `640859758b7203293c7732996cca374cc62ec173c578bdf91ea1efaaa2e65e40` |
| E12 | C / `c05-a23-resume-gray-report-20261005.json` | `640859758b7203293c7732996cca374cc62ec173c578bdf91ea1efaaa2e65e40` |
| E13 | N / `user-review-consumed-screen-stalled-result.json` | `54ef0258cb7e4ba80cc806fc3d4187e1a09cd3b99c9fd0dc647ae6c66ab5a44b` |
| E14 | C / `c13-human-import-no-response-pane-report-20261004.json` | `b244978d1180d7e7cad05e6b80bc85171e632634dcc8a5c8cd7a1e5809c69cd3` |
| E15 | C / `c05-a23-resume-gray-native-20261005.png` | `ff03497b5b0de41f3b38e07dfd01b0a0b8dc49916d9992b14a2904f393b26769` |
| E16 | C / `c13-second-human-restart-scroll-stalled-native-20261004.png` | `62f1fe8f234333fbad7697d19858a552e0659179018a5883ebba2001c5658644` |

另已实际只读核查N目录下`README.md`、`launcher.cjs`、`launcher-plain-ribbon.cjs`、`navigation-probe.js`、`service-current.json`、`second-service-exit.json`、`plain-restart-ownership-receipt-20261003-2002.json`及`plain-restart-script-correction-20261003-2002.json`。较早回执误检查`/ribbon.js`，修正文件证明实际入口`/main.js`存在；原误报保留，不能计为产品脚本缺失。N目录的动态总报告仅用于核对收集模式，不作为固定历史SHA证据替代上表封存副本。

## 7. 本轮独立启动缺陷与最小修复

`import-ui.create()`原先先创建workflow，再赋值项目组件。`workflow-ui.create()`会立即启动导航watch；watch立即消费遗留请求。若遗留阶段为review，阶段回调经`refreshReviewRead → renderSheetReview → reviewConfirmation`访问尚未赋值的`projects`，完整页面报`Cannot read properties of undefined (reading 'reviewConfirmation')`，初始化中断。此缺陷可以解释该特定启动失败；没有证据说明它导致约60秒rAF停止或长会话灰白。

最小改动仅`wps-addin/src/workflow-ui.js`和`wps-addin/src/import-ui.js`：前者提供幂等的`startRibbonNavigation()`，后者在全部依赖赋值、事件接线和初次render后启动watch。七阶段、请求一次消费与业务动作边界保持；未改其他watch异常处理、宿主调用或恢复逻辑。

新增`wps-addin/test/ui-startup-navigation-check.cjs`使用实际完整taskpane及全部产品脚本，由headless Edge加载，只模拟外部宿主与API边界。修复前预置review请求明确失败，修复后七阶段、无请求、非法阶段、已消费请求10/10通过，检验完整连接、请求一次消费、不重播、业务写入0。它不是WPS真机结果。

| 验证 | 本轮结果 | 本机日志（相对`outputs/sidebar-stability-20261005/`） |
| --- | --- | --- |
| 修复前完整页面失败 | exit1，明确reviewConfirmation异常 | `startup-review-red.log` |
| 修复后完整页面10场景 | 10/10；独立审查者再次通过10/10 | `startup-review-green.log` |
| 全量Node | 438/438，fail0，exit0；root实际执行 | `node-regression.log` |
| 直接相关Node | 29/29；审查者另核27/27 | `startup-related-node.log` |
| workflow浏览器 | PASS | `startup-ui-workflow.log` |
| 审核/品牌/询价/拆分/项目浏览器 | 5项全部PASS，root实际执行 | `ui-*-check.log` |
| 独立只读代码审查 | 无本次可行动P1/P2；额外验证重复start仅一监听器/计时器 | 审查结论记录于本节；不冒称真机稳定性通过 |

root初次浏览器回归因未设置本机Node包路径报`MODULE_NOT_FOUND: playwright`；在当前进程设置已捆绑运行时路径后重跑通过，未安装依赖或修改产品配置。原错误日志保留为`ui-sheet-review-missing-runtime.log`。

## 8. 本轮原生观察与未完成复验

root通过Computer Use实际操作WPS 12.1.0.29161；入口代码为`feat/wps-phase1`的`20fda1b9…`加第7节最小修复。开始完整读交接并实际看获批图01/03。本轮没有编辑、保存、确认任何业务成果，没有继续C06或下游链。用户自行保护其他未保存内容后重开WPS；root未全局保存、关闭或终止用户WPS进程。

诊断仅在忽略的`outputs/sidebar-stability-20261005/`：纯JS标记在产品脚本前安装，入口不读取Application/PluginStorage/控件属性，宿主调用分段记录before/after/throw，追加JSONL不受原100条上限影响。保护pane原字节不变；服务替换只终止已核归属的本插件Node监听器，隔离五目录不变，无自动创建工作簿的`host-probe.js`。当前服务PID17936，启动02:21:28.382Z。服务更换令牌后旧Ribbon探针POST的403不是产品缺陷；追加观察仍记录请求体，不能与WPS失效混同。

### 8.1 初始产品侧栏：停绘后JS和宿主调用仍运行

新WPS的初始产品会话`pane-muum60zs-pluj525r`于02:11:38.249Z安装，推算末次成功rAF为02:12:38.259Z，相隔60.010秒。一秒探针完成60次rAF采样后等待增加，定时心跳继续。971对导航键读取全部返回，无throw，至少870对在停绘后，记录耗时1–120ms。02:19:08.746Z root实际点击原生表内审核，入口/Application读取返回，`workflow.goTo(review)`于02:19:09.221–09.249Z返回，DOM高度/滚动状态改变，真实画面仍导入阶段。只证明这次调用链返回，不推广为全部宿主调用正常。

原始日志`trace-2026-10-05T02-05-10-418Z.jsonl`；画面`fresh-product-stalled-2026-10-05T02-18-23-958Z.png`、`fresh-product-review-click-2026-10-05T02-19-09-654Z.png`。

### 8.2 最小页面与创建路径对照

最小页面只含DOM计时/点击和纯JS rAF探针，不加载产品、导航或宿主访问脚本。root使用原生重建入口让既有窗格加载最小页，再同路径恢复产品；另在WPS官方原生JS调试器可见Console调用`Application.CreateTaskPane`新建独立最小页，只创建窗格，不修改工作簿。重建组合含隐藏/显示、两次宽度赋值及Navigate；结果不能归给Navigate单独作用。

独立只读代理解析截止02:42:05.380Z的12007行前缀并实际看配对截图，封存`ab-comparison.json`，SHA256 `e27361b1c24040469471ec6fceb1420fd64eaac0791f38759a977701bb047ec4`。

| 条件 / 会话 | 本轮实际结果 | 画面及边界 |
| --- | --- | --- |
| 既有窗格重建→最小页 / `pane-muumjfnv-ek4hzdcb` | 02:22:03.789Z ready；rAF370、tick371、点击1 | 75秒截图点击1；357秒截图计时/帧357、点击1。末段12.804秒心跳间隔位于两个已返回宿主调用之间的同步confirm，不写成具体调用挂死 |
| 同路径恢复产品 / `pane-muumrn73-cebg42g7` | 截面rAF817、心跳818，1346对导航存储读取全部返回 | 超60秒，但不是初始创建，不能据短时成功关闭 |
| 独立新建同纯页 / `pane-muumzw8f-3efc9se1` | 02:34:51.760Z ready；末次成功rAF约02:35:51.772–.773Z，即60.012–.013秒；随后frame60、tick433/点击1，心跳全部visible/focus=true | 两张停绘截图计时59/帧59/点击0；02:37:59.693Z后台点击执行报告1，画面仍0 |

停绘最小页自身未加载业务/导航/宿主访问脚本，定时器/事件与可见更新已分离；同一共享运行端仍有产品窗格运行，其他页面的影响尚未排除。未取得compositor/BeginFrame/native hidden状态，DOM visible/focus不能替代引擎状态，也不证明具体CEF错误或许可机制。官方检索未找到60秒试用停绘条款，只记检索边界。

### 8.3 长会话再次灰白

旧重建产品会话继续到03:59:50.814Z，rAF5483，跨度约91分24秒；旧三秒pane探针frame1828，两种计数不可混用。旧Ribbon最后心跳03:59:48.188Z，旧最小创建页最后tick03:59:50.776Z，旧产品pane报告最后03:59:50.923Z。root接续实际看到灰白，07:48:07.669Z点击表内审核无可见变化/新入口记录；服务07:47:32.945Z健康HTTP200且可追加GET。用户明确反馈当地12:00至15:45电脑及WPS一直运行，无休眠、锁屏或关闭。

`long-session-observation-2026-10-05T07-55-43-777Z.json`记录前缀字节/行数/SHA、分会话尾记录及两张`resume-*-gray*.jpg`截图SHA。封存时已出现07:55:40Z新Ribbon会话，**不能把旧组03:59:50.923Z写成当前总日志或新会话的末次时间**。准确灰白时间/共同中断原因仍未知；无新entry仍依赖网络发送，不单凭它判断回调未进入。

### 8.4 运行端配置对照准备

只读核查发现本版本CEF内存节省模块包含动态渲染/页面丢弃设置，动态渲染计时60秒，只作为具体线索。静态字符串/已加载模块不证明运行时读取或因果；原配置、进程归属、静态核查和回滚记录仅本机，不上传本机配置。

root07:54:20Z保存原值、仅关闭动态渲染，其他三项保留，回执`cef-dynamic-render-before-2026-10-05T07-54-20-104Z.json`。用户答已重启，实际WPS/et主进程与窗口已更换，但10-04启动的共享CEF browser43016仍在。新初始产品`pane-muuygm6b-pgowk6ld`仍frame60后等待增加。**全新共享运行端条件未满足，不能判该配置无效，不计修复通过。** 下一步核旧共享运行端正常退出，完成单变量及恢复原值对照；只读静态证据`cef-runtime-static-audit.json`。

用户随后明确已处理未保存内容，同意只重启识别的10个云/浏览器后台。08:16:17Z仅对已核身份的云18396与浏览器43016执行退出，其余8子进程随之结束；新浏览器31364、云44796、GPU22372与网络34652创建，文档宿主27424/28500、未知33056及服务17936保留。回执`cef-backend-first-restart.json`的空投影原为`[null]`，独立08:30:42Z复核10旧PID全缺失后纠正为`[]`并保留原值/原SHA说明。正常停用并确认、重新启用并确认本插件，另新建空白诊断簿，仍未收到新脚本请求；这只能证明当前重接未成功，不是动态渲染配置的有效测试。需要正常重开两个空白测试簿的宿主，补充授权问题已提出；尚未完成false→true→false。

### 8.5 保护与剩余验收

原49项总基线不改，其中44项持久业务件及保护pane、5项WPS `~$*.xlsx`占用临时件。root最新`protected-files-2026-10-05T07-52-09-803Z.json`与独立代理07:57:15Z复算均持久44/44 SHA相符、5占用件缺失，保护pane仍`e9a76e21546142907d65f1c158f6cc4138a69bcf44f950e84edaa6ac914d8e91`。不能写49件全不变，首次49/44误报及原基线保留。

本轮完成启动缺陷软件回归、初始60秒、纯页/产品/创建/重建、长会话灰白及用户重开观察，**未完成修复后的真实稳定性矩阵**。长运行、文件选择/保存、项目/工作簿切换、关闭重开/恢复须在对应修复后补验并核草稿/确认/学习/既有成果保护。当前仅备份第7节启动修复与调查阶段进展，SIDEBAR-STABILITY-01未解决，正式交付仍阻断；不推进C06、四项目、R12结案或R13。
