#!/usr/bin/env python3
"""将直播中心工作簿同步为门户数据，或只读检查是否存在更新。"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET


for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "docs" / "视频地址.xlsx"
DEFAULT_OUTPUT = ROOT / "data" / "content.json"
NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
CATEGORIES = ("人工智能", "高端制造", "集成电路", "生物医药", "新能源", "化工新材料")
CATEGORY_INDEX = {name: index for index, name in enumerate(CATEGORIES)}
TITLE_PATTERN = re.compile(
    r"^直播[/_](\d+)\s+(人工智能|高端制造|集成电路|生物医药|新能源|化工新材料)小组：(.*)$"
)


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.get("t")
    value = cell.find("main:v", NS)
    if cell_type == "s" and value is not None:
        return shared_strings[int(value.text or "0")]
    if cell_type == "inlineStr":
        return "".join(cell.itertext()).strip()
    return (value.text or "").strip() if value is not None else ""


def read_rows(path: Path) -> list[tuple[str, str]]:
    with zipfile.ZipFile(path) as workbook:
        if "xl/worksheets/sheet1.xml" not in workbook.namelist():
            raise ValueError("工作簿缺少第一个工作表")
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            shared = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(item.itertext()) for item in shared.findall("main:si", NS)]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
    rows: list[tuple[str, str]] = []
    for row in sheet.findall(".//main:sheetData/main:row", NS):
        values: dict[str, str] = {}
        for cell in row.findall("main:c", NS):
            column = re.match(r"[A-Z]+", cell.get("r", ""))
            if column:
                values[column.group()] = cell_value(cell, shared_strings)
        if values.get("A") and values.get("B"):
            rows.append((values["A"].strip(), values["B"].strip()))
    if not rows or rows[0] != ("视频题目", "视频地址"):
        raise ValueError("工作簿首行必须为“视频题目”和“视频地址”")
    return rows[1:]


def build_items(rows: list[tuple[str, str]]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for source_title, raw_url in rows:
        match = TITLE_PATTERN.fullmatch(source_title)
        if not match:
            raise ValueError(f"无法识别视频分类或标题：{source_title}")
        period, industry, title = match.groups()
        title = re.sub(r"(?:\.mp4)+$", "", title, flags=re.IGNORECASE).strip()
        parsed = urlparse(raw_url)
        if parsed.scheme != "https" or not parsed.netloc or not parsed.path.lower().endswith(".mp4"):
            raise ValueError(f"视频地址必须为 HTTPS MP4：{source_title}")
        if raw_url in seen_urls:
            raise ValueError(f"视频地址重复：{source_title}")
        seen_urls.add(raw_url)
        items.append({"industry": industry, "period": int(period), "title": title, "url": raw_url})
    found_categories = {item["industry"] for item in items}
    missing_categories = set(CATEGORIES) - found_categories
    if missing_categories:
        raise ValueError(f"缺少行业分类：{'、'.join(sorted(missing_categories))}")
    return sorted(items, key=lambda item: (-item["period"], CATEGORY_INDEX[item["industry"]]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="视频地址工作簿路径")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="content.json 路径")
    parser.add_argument("--date", dest="updated_at", default=date.today().strftime("%Y.%m.%d"), help="更新日期，格式 YYYY.MM.DD")
    parser.add_argument("--check", action="store_true", help="仅检查工作簿内容是否与现有数据一致")
    args = parser.parse_args()
    if not args.input.is_file():
        raise FileNotFoundError(f"未找到视频地址工作簿：{args.input}")
    if not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", args.updated_at):
        raise ValueError("更新日期必须为 YYYY.MM.DD")

    items = build_items(read_rows(args.input))
    content = json.loads(args.output.read_text(encoding="utf-8"))
    existing = content.get("liveCenter", [])
    if args.check:
        if existing == items:
            print(f"直播中心已是最新：{len(items)} 条视频，{len(CATEGORIES)} 个行业")
            return 0
        print(f"直播中心需要更新：当前 {len(existing)} 条，工作簿 {len(items)} 条")
        return 1

    content.setdefault("meta", {})["liveCenterUpdatedAt"] = args.updated_at
    content["liveCenter"] = items
    args.output.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已同步直播中心：{len(items)} 条视频，更新至 {args.updated_at}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        print(f"直播中心同步失败：{error}", file=sys.stderr)
        raise SystemExit(2)
