"""只读扫描对外xlsx：工作表、隐藏表、公式、批注/超链接、以及原价/历史报价/内部路径等禁止内容。

用法：python audit-outputs.py <xlsx...> ;输出JSON报告，不修改任何文件。
"""
import json
import re
import sys

import openpyxl

FORBIDDEN = ["原价", "历史报价", "原清单文件", "原路径", "SHA256", "核对追溯JSON", "自动结果", "历史分类定位"]
INTERNAL = ["内部追溯", "处理记录", "来源明细", "清单"]
PERSONAL = re.compile(r"(?:\d[\d\-\s]{6,}\d|[\w.+-]+@[\w-]+\.[\w.]+)")


def audit(path):
    report = {"path": path, "sheets": [], "hiddenSheets": [], "internalSheets": [], "formulas": [],
              "comments": 0, "hyperlinks": 0, "forbidden": [], "personal": []}
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=False)
    for sheet in workbook.worksheets:
        report["sheets"].append(sheet.title)
        if sheet.sheet_state != "visible":
            report["hiddenSheets"].append(sheet.title)
        if sheet.title in INTERNAL:
            report["internalSheets"].append(sheet.title)
        for row in sheet.iter_rows():
            for cell in row:
                value = cell.value
                if value is None:
                    continue
                text = str(value)
                if text.startswith("="):
                    report["formulas"].append({"sheet": sheet.title, "cell": cell.coordinate, "text": text[:40]})
                for word in FORBIDDEN:
                    if word in text:
                        report["forbidden"].append({"sheet": sheet.title, "cell": cell.coordinate, "field": word})
                if PERSONAL.search(text):
                    report["personal"].append({"sheet": sheet.title, "cell": cell.coordinate})
                if cell.comment is not None:
                    report["comments"] += 1
                if cell.hyperlink is not None:
                    report["hyperlinks"] += 1
    report["ok"] = not (report["hiddenSheets"] or report["internalSheets"] or report["formulas"]
                        or report["forbidden"] or report["personal"] or report["comments"] or report["hyperlinks"])
    return report


def main():
    reports = [audit(path) for path in sys.argv[1:]]
    print(json.dumps({"ok": all(item["ok"] for item in reports), "files": reports}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
