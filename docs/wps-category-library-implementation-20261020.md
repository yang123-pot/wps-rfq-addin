# 分类学习库实施记录

## 入场与计划

- 本机/远程均 `0ada8c9`，`feat/wps-ui-v2`，工作区干净。原专题交接的旧基线已由后续文档提交更新。
- 38891 无监听（沙箱网络先失败，经授权只读重核为连接拒绝）；没有沿用 PID16496。publish/auth 文件另作只读核对。
- Computer Use 列出 WPS“工作簿2”，读取画面返回 `Computer Use was not approved to use wps`。用户簿未关闭、保存或覆盖。
- 已看新版图03；新窗口使用专题已确认设计，计划见 `docs/superpowers/plans/2026-10-20-category-learning-library.md`。

## L1 领域模型

新增 `library-operations.js`：新增/重命名保留别名、无关联分类归档、有规则/经验则阻止直接归档、多源合并须明确 confirmed、迁移规则/经验/历史类别并保留原类别，重复规则与材料签名去重且合并来源。固定无需询价受保护，相似候选只返回理由。纯函数不修改输入或旧项目。

- RED：`node --test wps-addin/test/library-operations.test.cjs` 因模块不存在失败。
- GREEN：同名新测试＋category-library/category-memory/classify-memory，23/23通过。
- 全量 Node 结果见本轮后续交接（日志仅本机）。无真实WPS验收声明。

L1 已提交并核远程 `e44e26b`。首次全量发现583项通过、1项为已加入的L2待实现RED（store.page不存在），未当全绿。

## L2 分页服务与压缩索引

新增 summary/page/detail/preview/similar/mutate/classify-index 隔离接口；新旧修改共用写队列和expectedRevision，原子写入；磁盘stat变化使缓存和revision索引失效。分页上限50，不含history和来源数组；完整来源只按单条读取。压缩索引只含有效分类/规则和按签名去重的经验，不含来源/审计，客户端compact查找只建一次签名/名称映射。

- RED：隔离存储用例 `store.page is not a function`；接口鉴权预期403而实际404；完全签名复用仍混入相近类别。
- GREEN：store/window-store 7/7；新旧HTTP 4/4；compact/category-memory/classify-memory 15/15。
- 6760经验、10267历史的合成夹具验证最多50条、响应小于100KB、搜索/越界、并发单赢家及重启revision保持。夹具仅临时目录。
- 新接口尚未接主页面，旧页面切换在L3/L4完成，不能宣称整包加载已全部移除。

后续 L3窗口→L4延迟学习→L5验收继续。
