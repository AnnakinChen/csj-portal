#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen


API_INFO_URL = "https://gw.datayes.com/aladdin_llm_mgmt/web/whitelist/api"
DEFAULT_TIMEOUT = 30
# data_search 的 `macros` 必填，是检索的「数据取值范围」根类目。四根全开与 r.datayes.com
# API 中台默认范围一致（中国宏观 / 特色数据 / 国际宏观 / 行业经济），覆盖最全；结果顺序
# 完全沿用接口本身的相关性排序，不在客户端重排（见 search_indicators）。
SEARCH_MACROS = ["M000000001", "Q000000001", "Y000000001", "S000000001"]
ALLOWED_HTTP_HOSTS = {
    "api.datayes.com",
    "api.wmcloud.com",
    "gw.datayes.com",
    "r.datayes.com",
}


class DatayesError(RuntimeError):
    pass


def get_token() -> str:
    token = os.environ.get("DATAYES_TOKEN", "").strip()
    if not token:
        raise DatayesError("Missing DATAYES_TOKEN environment variable.")
    return token


def clean_api_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def validate_http_url(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme != "https":
        raise DatayesError(f"Resolved httpUrl must use https: {url}")
    if not parts.netloc:
        raise DatayesError(f"Resolved httpUrl is missing a host: {url}")
    host = (parts.hostname or "").lower()
    if host not in ALLOWED_HTTP_HOSTS:
        allowed_hosts = ", ".join(sorted(ALLOWED_HTTP_HOSTS))
        raise DatayesError(
            f"Resolved httpUrl host {host or '<unknown>'} is not trusted. Allowed hosts: {allowed_hosts}"
        )
    return url


def request_json(
    url: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> Any:
    if params:
        query = urlencode({key: value for key, value in params.items() if value is not None})
        url = f"{url}?{query}"

    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Accept": "application/json",
        "User-Agent": "datayes-macro-skill/1.0",
    }
    data: bytes | None = None
    method = "GET"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"

    req = Request(url, data=data, headers=headers, method=method)

    try:
        with urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
            return json.load(resp)
    except HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise DatayesError(f"HTTP {exc.code} for {url}: {err_body}") from exc
    except URLError as exc:
        raise DatayesError(f"Request failed for {url}: {exc}") from exc


@lru_cache(maxsize=None)
def get_api_spec(name_en: str) -> dict[str, Any]:
    payload = request_json(API_INFO_URL, {"nameEn": name_en})
    data = payload.get("data")
    if not data:
        raise DatayesError(f"Unable to load API spec for {name_en}: {json.dumps(payload, ensure_ascii=False)}")
    return data


def get_api_url(name_en: str) -> str:
    return clean_api_url(validate_http_url(get_api_spec(name_en)["httpUrl"]))


FREQ_CODES = {"D", "W", "M", "Q", "A"}


def detect_frequency_hint(query: str, explicit: str | None) -> str | None:
    if explicit:
        up = explicit.upper()
        # 只认合法频率码；非法值（如 "monthly"/"月"）落回关键词推断，避免变成永不命中的 hint。
        if up in FREQ_CODES:
            return up

    patterns = {
        "D": ("日频", "日度", "每日", "按日", "日"),
        "W": ("周频", "周度", "每周", "按周", "周"),
        "M": ("月频", "月度", "每月", "按月", "月"),
        "Q": ("季频", "季度", "按季", "季"),
        "A": ("年频", "年度", "每年", "按年", "年"),
    }
    for code, keys in patterns.items():
        if any(key in query for key in keys):
            return code
    return None


def build_fallback_queries(keyword: str) -> list[str]:
    variants = [keyword.strip()]
    compact = re.sub(r"\s+", "", keyword)
    if compact and compact not in variants:
        variants.append(compact)

    simplified = compact
    for marker in ("中国", "全国", "同比", "环比", "累计", "累计同比", "当月", "当季", "当年"):
        simplified = simplified.replace(marker, "")
    if len(simplified) >= 2 and simplified not in variants:
        variants.append(simplified)

    return variants[:3]


def parse_hits(payload: dict[str, Any], keyword: str) -> list[dict[str, Any]]:
    """Map the data_search response (data.hits[]) into ranked candidate dicts."""
    data = payload.get("data") or {}
    hits = data.get("hits") or []
    candidates: list[dict[str, Any]] = []
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        indicator_id = str(hit.get("indicId") or hit.get("indicID") or hit.get("id") or "").strip()
        if not indicator_id:
            continue
        candidates.append(
            {
                "id": indicator_id,
                "name": hit.get("displayNameCn") or hit.get("nameCn") or "",
                "frequency": hit.get("frequencyCn") or "",
                "frequency_code": (hit.get("frequencyCd") or "").upper(),
                "unit": hit.get("unitCn") or "",
                "source": hit.get("infoSourceCn") or "",
                "statistic": hit.get("statTypeCn") or "",
                "matched_by": ["data_search"],
                "keyword": keyword,
            }
        )
    return candidates



def search_once(keyword: str, size: int, offset: int) -> list[dict[str, Any]]:
    base_url = get_api_url("data_search")
    page = (offset // size + 1) if size else 1
    body = {
        "query": keyword,
        # `macros` is mandatory; this root scope code makes the industry search return hits.
        "macros": SEARCH_MACROS,
        "page": max(1, page),
        "size": size,
    }
    payload = request_json(base_url, body=body)
    return parse_hits(payload, keyword)


def search_indicators(keyword: str, size: int, offset: int, frequency_hint: str | None) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}

    for variant in build_fallback_queries(keyword):
        for candidate in search_once(variant, size, offset):
            existing = merged.get(candidate["id"])
            if not existing:
                merged[candidate["id"]] = candidate
                continue

            existing["matched_by"] = sorted(set(existing["matched_by"] + candidate["matched_by"]))
            if len(candidate["keyword"]) < len(existing["keyword"]):
                existing["keyword"] = candidate["keyword"]

    ordered = list(merged.values())  # 接口原生顺序（插入序）
    if frequency_hint:
        matched = [c for c in ordered if c.get("frequency_code", "").upper() == frequency_hint]
        if matched:  # 只筛选、保序；筛空则落回全量原生结果
            return matched
    return ordered


def fetch_details(
    ids: list[str],
    begin_date: str | None,
    end_date: str | None,
    period: str | None = "10",
) -> list[dict[str, Any]]:
    if not ids:
        return []

    params = {"ids": ",".join(ids)}
    if begin_date:
        params["beginDate"] = begin_date
    if end_date:
        params["endDate"] = end_date
    if period:
        params["period"] = period

    payload = request_json(get_api_url("Indicsdetail"), params)
    data = payload.get("data")
    if data is None:
        raise DatayesError(f"Unexpected detail response: {json.dumps(payload, ensure_ascii=False)}")
    return data


def validate_yyyymmdd(value: str | None) -> str | None:
    if value is None:
        return None
    if not re.fullmatch(r"\d{8}", value):
        raise DatayesError(f"Invalid date {value!r}; expected yyyymmdd.")
    return value


def to_search_output(candidates: list[dict[str, Any]], top: int) -> dict[str, Any]:
    return {"count": len(candidates), "candidates": candidates[:top]}


def to_query_output(
    keyword: str,
    candidates: list[dict[str, Any]],
    details: list[dict[str, Any]],
    top: int,
) -> dict[str, Any]:
    selected_ids = {item.get("indicId") or item.get("indic", {}).get("indicID") for item in details}
    return {
        "query": keyword,
        "candidates": candidates[:top],
        "selected": [item for item in candidates[:top] if item["id"] in selected_ids],
        "series": details,
    }


def format_search_text(candidates: list[dict[str, Any]], top: int) -> str:
    lines = []
    for index, item in enumerate(candidates[:top], start=1):
        lines.append(
            f"{index}. [{item['id']}] {item['name']} | "
            f"freq={item.get('frequency') or '-'} | unit={item.get('unit') or '-'} | "
            f"source={item.get('source') or '-'} | via={','.join(item.get('matched_by', []))}"
        )
    return "\n".join(lines) if lines else "No candidates found."


def format_detail_text(items: list[dict[str, Any]], limit: int) -> str:
    if not items:
        return "No series returned."

    blocks = []
    for item in items:
        meta = item.get("indic", {})
        header = (
            f"[{meta.get('indicName', '-')}] id={meta.get('indicID', '-')} "
            f"freq={meta.get('frequency', '-')} unit={meta.get('unit', '-')} "
            f"source={meta.get('infoSource', '-')}"
        )
        latest = f"latest: {meta.get('dataValue', '-')} ({meta.get('periodDate', '-')})"
        rows = sorted(item.get("data", []), key=lambda row: row.get("periodDate", ""), reverse=True)[:limit]
        row_lines = [f"{row.get('periodDate', '-'):<12} {row.get('dataValue', '-')}" for row in rows]
        blocks.append("\n".join([header, latest, "series:", *row_lines]))
    return "\n\n".join(blocks)


def print_output(payload: Any, as_json: bool) -> None:
    if as_json:
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return

    if isinstance(payload, str):
        sys.stdout.write(payload)
        sys.stdout.write("\n")
        return

    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Query Datayes macro indicators with Python stdlib only.")
    parser.add_argument("--json", action="store_true", help="Print JSON output.")

    subparsers = parser.add_subparsers(dest="command", required=True)

    spec_parser = subparsers.add_parser("spec", help="Show API spec.")
    spec_parser.add_argument("name_en", choices=["data_search", "Indicsdetail"])

    search_parser = subparsers.add_parser("search", help="Search indicator candidates.")
    search_parser.add_argument("keyword")
    search_parser.add_argument("--size", type=int, default=20)
    search_parser.add_argument("--offset", type=int, default=0)
    search_parser.add_argument("--top", type=int, default=15)
    search_parser.add_argument("--frequency")

    detail_parser = subparsers.add_parser("detail", help="Fetch indicator series by id.")
    detail_parser.add_argument("ids", nargs="+")
    detail_parser.add_argument("--begin-date")
    detail_parser.add_argument("--end-date")
    detail_parser.add_argument("--limit", type=int, default=12)

    query_parser = subparsers.add_parser("query", help="Search, rank, and fetch series in one step.")
    query_parser.add_argument("keyword")
    query_parser.add_argument("--size", type=int, default=20)
    query_parser.add_argument("--offset", type=int, default=0)
    query_parser.add_argument("--top", type=int, default=15)
    query_parser.add_argument("--pick", type=int, default=1)
    query_parser.add_argument("--begin-date")
    query_parser.add_argument("--end-date")
    query_parser.add_argument("--limit", type=int, default=12)
    query_parser.add_argument("--frequency")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "spec":
            print_output(get_api_spec(args.name_en), args.json)
            return 0

        if args.command == "search":
            frequency_hint = detect_frequency_hint(args.keyword, args.frequency)
            candidates = search_indicators(args.keyword, args.size, args.offset, frequency_hint)
            payload = to_search_output(candidates, args.top)
            print_output(payload if args.json else format_search_text(candidates, args.top), args.json)
            return 0

        if args.command == "detail":
            begin_date = validate_yyyymmdd(args.begin_date)
            end_date = validate_yyyymmdd(args.end_date)
            details = fetch_details([str(item) for item in args.ids], begin_date, end_date)
            print_output(details if args.json else format_detail_text(details, args.limit), args.json)
            return 0

        if args.command == "query":
            begin_date = validate_yyyymmdd(args.begin_date)
            end_date = validate_yyyymmdd(args.end_date)
            frequency_hint = detect_frequency_hint(args.keyword, args.frequency)
            candidates = search_indicators(args.keyword, args.size, args.offset, frequency_hint)
            chosen = [item["id"] for item in candidates[: max(1, args.pick)]]
            details = fetch_details(chosen, begin_date, end_date) if chosen else []
            payload = to_query_output(args.keyword, candidates, details, args.top)
            print_output(payload if args.json else format_detail_text(details, args.limit), args.json)
            return 0
    except DatayesError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
