# R12-F 公开输出审计（2026-09-27，源码包，未触碰真机）

**基线/包提交：** 分支 `feat/wps-phase1`，开工 HEAD `a6ff72d77d82860b4076e1857479f34529bfd092`（R12-E），工作区干净（R12-B/C/D/E 的入场修改已按包提交，本会话不再有那 6 个未提交修改）。本包源码/测试/文档提交紧随其后，远程 SHA 以实际推送与 `git ls-remote` 为准。

**对应图：** 图06、图07（本包开工前实际打开 `docs/mockups/approved-20260926/06-inquiry-linkage.png`、`07-split-files.png`）。验收点：图06 抬头四项（项目名称/单位名称/材料经办人/联系方式）允许由用户填写并随件保留；材料10列、报价单价/金额空、品牌来自汇总；图07 每张询价表独立 .xlsx、逐份完成状态。审计只针对“文件里实际写了什么”，不再用模型自己的输出当证明。

## 1. 入口缺陷

- `dev/audit-outputs.py` 用电话/邮箱正则扫描任意单元格并直接 `ok=false`：会拒绝图06/07 明确允许的抬头联系方式，也可能误伤长编码。
- `dev/release-audit.cjs` 的 `expectedManifest.cells` 是可选局部清单，核对通过也证明不了“没有额外未预期公开值”；且不区分供应商件与内部总簿（内部总簿允许明确内部页，供应商件不允许）。
- Node 侧只看“以 = 开头”就当公式，文本 `=…` 与真正公式未分开；隐藏列、批注、超链接/外部关系、额外内容没有统一核对。

## 2. 失败测试先行

修改前实跑：

- `node --test wps-addin/test/release-audit.test.cjs`：旧的 5 个用例通过，新写的 10 个用例失败（无 `profile`/完整清单语义、无隐藏列/版式/额外内容、无 `PROFILES`）。
- `python -m unittest discover -s wps-addin/test -p test_audit_outputs.py`：7 个用例全部因 `audit() got an unexpected keyword argument 'profile'` 报错，错误规则由新用例暴露，不是环境或拼写问题。

## 3. 修正内容

### Node：`wps-addin/dev/release-audit.cjs`（schemaVersion=2）

- 新增 `profile: 'supplier' | 'internal-total'` 与 `PROFILES`。
- `expectedManifest` 支持 `complete:true` 的完整矩阵：`title`、`fields`、`supplierRegion`、`material{headerRow,firstDataRow,header,rows}`、`cells`、`merges`，由 `expandExpected` 展开成“单元格→预期值”。
- 同时输出：逐值 `mismatches`、缺失 `missingCells`、额外 `extraCells`、数据类型 `typeIssues`、版式 `layoutIssues`（合并/超出声明列）、`formulaCells`、`forbiddenFields`、`personalLeaks`、`pathLeaks`、`shaLeaks`、隐藏页/列、批注/超链接/外部关系。
- **联系方式按“位置＋预期值”放行**：仅当该格在清单中标记 `contact:true` 且实际值与预期完全一致才不报；同一个电话出现在任何其它格仍报 `personalLeaks`。
- **文本 `=…` 与公式分开**：真实公式由 `formulas` 元数据或 `{kind:'formula'}` 判定；清单 `type:'text'` 的文本 `=…` 不算公式。
- **profile 分流**：`supplier` 下任何内部页/隐藏页/隐藏追溯列都失败；`internal-total` 只允许清单声明的内部页，声明内部页允许出现内部说明词（如“原价/历史报价”）但仍按清单逐值/额外内容核对。
- 未提供 `complete:true` 清单时 `valueChecked=false`、`verdict='scan-only'`，`notes` 明确“仅报告扫描结果，不能判定逐值通过”。

### Python：`wps-addin/dev/audit-outputs.py`

- `audit(path, expected_manifest=None, profile='supplier')` 用 openpyxl **实际读取 xlsx**（`data_only=False`），返回 SHA256、页/行/列数、公式数、逐值/版式/额外内容差异、隐藏页/列、批注、超链接/外部关系。
- CLI 增加显式 `--manifest` / `--profile`；无完整清单只报扫描结果，退出码 1，不报“逐值通过”。
- `cell.data_type=='f'` 判公式；字符串 `=…` 仍按文本核对，与 Node 语义一致。

## 4. 验证与证据

| 命令 | 结果 |
| --- | --- |
| `node --test wps-addin/test/release-audit.test.cjs` | **10 pass / 0 fail** |
| `node --test wps-addin/test/*.test.cjs` | **361 pass / 0 fail**（R12-E 356 ＋ 本包 5；见 `node-test-all.log`） |
| `python -m unittest discover -s wps-addin/test -p test_audit_outputs.py` | **8 tests OK** |
| `python dev/audit-outputs.py --profile supplier --manifest clean-manifest.json clean.xlsx` | `ok=true / valueChecked=true / verdict=value-verified`，退出码 0 |
| `python dev/audit-outputs.py --profile supplier --manifest clean-manifest.json polluted.xlsx` | `ok=false / verdict=failed`，退出码 1，逐格报出 K7/K8/K9/K10/H7/F8/J7 |
| `python dev/audit-outputs.py --profile supplier <R12-E真实供应商件>`（无 manifest） | `valueChecked=false / verdict=scan-only`，`scanClean=true`，退出码 1，明确“未提供完整预期清单，仅报告扫描结果” |

**本机证据（脱敏，不入 Git）：** `outputs/wps-acceptance-20260927/R12-F/`

- `make-fixtures.py`、`make-fixtures.out.txt`：隔离夹具与污染件生成脚本/输出。
- `clean.xlsx` + `clean-manifest.json` + `clean-report.json`：含允许抬头 `联系方式：010-12345678` 与长编码 `00012345678901234567`，`value-verified`，SHA `fadc6adc…`。
- `polluted.xlsx` + `polluted-report.json`：额外隐藏列 K7 同一个电话、K8 绝对路径、K9 SHA、K10 原价，外加 H7 公式、F8 缺值、J7 多值、内部页与隐藏页；审计逐表逐格报出。
- `real-r12e-supplier-report.json`：用清单纯值核对 R12-E 真实 WPS 供应商件 `水泵_华川设备.xlsx`，`ok=true / value-verified`、8行×10列、公式0、无内部/隐藏页，SHA `7795da93…`（与 R12-E 记录一致）。
- `node-test-all.log`、`node-release-audit.log`、`python-audit-outputs.log`、`cli-clean.json`、`cli-polluted.json`、`cli-scan-only*.json`。

**修改文件 SHA256（本机）：** `dev/release-audit.cjs C8FA3915…`、`dev/audit-outputs.py 3873DAF5…`、`test/release-audit.test.cjs 6A419BC9…`、`test/test_audit_outputs.py 86BF68EF…`。

## 5. R12-G/H 预期清单格式（已准备）

同一格式供 Node `release-audit.audit({...expectedManifest})` 与 Python `audit(path, manifest, profile)` 使用；`complete:true` 表示清单覆盖该文件全部非空公开格，审计才能判断“没有额外内容”。

```json
{
  "complete": true,
  "profile": "supplier",
  "sheets": [{
    "name": "阀门_多供应商",
    "kind": "inquiry",
    "visibility": "visible",
    "columns": 10,
    "title": {"cell": "A1", "value": "示例园区 阀门询价表", "merge": "A1:J1"},
    "fields": [
      {"cell": "A3", "label": "项目名称", "value": "项目名称：示例园区"},
      {"cell": "F3", "label": "单位名称", "value": "单位名称：示例建设公司"},
      {"cell": "A4", "label": "材料经办人", "value": "材料经办人：测试员"},
      {"cell": "F4", "label": "联系方式", "value": "联系方式：010-12345678", "contact": true}
    ],
    "supplierRegion": [
      {"cell": "A5", "value": "供应商信息"},
      {"cell": "B5", "value": "通达 — 正通商贸"},
      {"cell": "B6", "value": "海岳 — 安合设备"}
    ],
    "merges": ["A3:E3", "F3:J3", "A4:E4", "F4:J4", "A5:A6", "B5:J5", "B6:J6"],
    "material": {
      "headerRow": 7,
      "firstDataRow": 8,
      "header": ["序号", "项目编码", "项目名称", "项目特征描述", "单位", "工程量", "品牌", "报价单价", "金额", "备注"],
      "rows": [
        ["1", "FM-001", "阀门", "DN50", "个", "20", "通达 / 海岳", "", "", ""],
        ["2", "FM-002", "阀门", "DN65", "个", "12", "通达 / 海岳", "", "", ""]
      ]
    },
    "cells": [{"cell": "J9", "value": "备注示例"}]
  }]
}
```

- 供应商件（图07）用 `profile:"supplier"`、`sheets` 只列该件实际工作表，`material.headerRow/firstDataRow` 以该件实际版式为准（图06 总簿与图07 拆分件行号不同），抬头字段按实际合并后的整格文本写全；联系方式格加 `contact:true`。
- 内部总簿（图06）用 `profile:"internal-total"`，除各询价页外把 `内部追溯`、`处理记录` 作为 `kind:"internal"` 列入同一清单；内部页允许内部说明文字，但仍逐值/额外内容核对。
- 文本 `=…` 用 `{"value":"=1+1","type":"text"}` 声明，避免与公式混淆；报价单价/金额/金额以空字符串声明即可。

## 6. 边界与下一包

- 本包是**源码/测试/文档包，未操作真实 WPS**，未新增真机通过结论；以上“真实供应商件”仅指读取 R12-E 已由真实 WPS 写出的隔离文件，属于只读文件审计，不等于插件 UI 内跑完 G/H。
- 审计证明不等于功能完成：R12-G/H 仍要真实生成图05A→06→07（及05B）并按本文件第5节清单逐值审计。
- 下一包 **R12-G**（分列汇总→总询价→拆分真实主链）。R12-F 完成即停，不开始 R12-G。
