"""Minimal Datayes research API adapter used by the local hyrd workflow.

The adapter resolves the current API schema before each operation, keeps the
token in the environment, and processes responses in memory. It intentionally
does not expose the report-download API or write raw API payloads to disk.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


CATALOG_API_URL = "https://gw.datayes.com/aladdin_llm_mgmt/web/whitelist/api"
ALLOWED_HOST = "gw.datayes.com"
DATE_RE = re.compile(r"^\d{8}$")


class DatayesResearchError(RuntimeError):
    """Raised when the Datayes research API cannot be used safely."""


def _token() -> str:
    token = os.environ.get("DATAYES_TOKEN", "").strip()
    if not token:
        raise DatayesResearchError("Missing DATAYES_TOKEN environment variable.")
    return token


def _json_request(
    url: str,
    *,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    timeout: int = 60,
) -> dict[str, Any]:
    encoded_body = None
    headers = {"Authorization": f"Bearer {_token()}", "Accept": "application/json"}
    if body is not None:
        encoded_body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=encoded_body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise DatayesResearchError(f"Datayes HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise DatayesResearchError(f"Datayes request failed: {exc}") from exc
    if not isinstance(payload, dict):
        raise DatayesResearchError("Datayes returned a non-object response.")
    code = payload.get("code")
    if code not in (None, 1):
        raise DatayesResearchError(
            f"Datayes business error code={code}: {payload.get('message', '')}"
        )
    return payload


def _api_info(name_en: str) -> dict[str, Any]:
    url = f"{CATALOG_API_URL}?{urllib.parse.urlencode({'nameEn': name_en})}"
    payload = _json_request(url)
    info = payload.get("data")
    if not isinstance(info, dict) or info.get("nameEn") != name_en:
        raise DatayesResearchError(f"Datayes API schema not found: {name_en}")
    if info.get("locked") is True or info.get("canInvoke") is False:
        raise DatayesResearchError(f"Datayes API is not callable for this account: {name_en}")
    if info.get("httpMethod", "").upper() != "POST":
        raise DatayesResearchError(f"Unexpected HTTP method for {name_en}")
    parsed = urllib.parse.urlparse(str(info.get("httpUrl", "")))
    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        raise DatayesResearchError(f"Unexpected Datayes host for {name_en}")
    return info


def _required_inputs(info: dict[str, Any], names: set[str]) -> None:
    inputs = {item.get("nameEn"): item for item in info.get("parametersInput", [])}
    missing = sorted(names - inputs.keys())
    if missing:
        raise DatayesResearchError(
            f"Current Datayes schema is missing required parameters: {', '.join(missing)}"
        )


def search_reports(**filters: Any) -> dict[str, Any]:
    """Search report metadata using the current Datayes research schema."""

    info = _api_info("research_search")
    _required_inputs(info, {"type"})
    payload = {key: value for key, value in filters.items() if value not in (None, "")}
    if payload.get("type", "EXTERNAL_REPORT") != "EXTERNAL_REPORT":
        raise DatayesResearchError("research_search requires type=EXTERNAL_REPORT")
    payload["type"] = "EXTERNAL_REPORT"
    payload.setdefault("orgType", "1")
    payload.setdefault("pageNow", 1)
    payload.setdefault("pageSize", 100)
    payload.setdefault("sortOrder", "desc")
    if not 1 <= int(payload["pageSize"]) <= 100:
        raise DatayesResearchError("research_search pageSize must be between 1 and 100")
    for key in ("pubTimeStartStr", "pubTimeEndStr"):
        if key in payload and not DATE_RE.fullmatch(str(payload[key])):
            raise DatayesResearchError(f"{key} must use yyyyMMdd")
    return _json_request(info["httpUrl"], method="POST", body=payload)


def get_domestic_report_content(report_ids: list[int]) -> list[dict[str, Any]]:
    """Fetch domestic report text in batches of at most ten IDs."""

    if not report_ids:
        return []
    if any(not isinstance(report_id, int) for report_id in report_ids):
        raise DatayesResearchError("report_ids must contain integers")
    info = _api_info("batchGetReportContentDomestic")
    _required_inputs(info, {"reportIds"})
    responses: list[dict[str, Any]] = []
    for batch_index in range(0, len(report_ids), 10):
        if batch_index:
            time.sleep(6.1)
        responses.append(
            _json_request(
                info["httpUrl"],
                method="POST",
                body={"reportIds": report_ids[batch_index : batch_index + 10]},
            )
        )
    return responses


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Call Datayes research APIs safely.")
    commands = parser.add_subparsers(dest="command", required=True)

    search = commands.add_parser("search", help="search report metadata")
    search.add_argument("--query")
    search.add_argument("--start", dest="pubTimeStartStr")
    search.add_argument("--end", dest="pubTimeEndStr")
    search.add_argument("--org-type", default="1", dest="orgType")
    search.add_argument("--org-name", dest="orgName")
    search.add_argument("--report-type", dest="reportType")
    search.add_argument("--report-sub-type", dest="reportSubType")
    search.add_argument("--industry")
    search.add_argument("--ticker")
    search.add_argument("--page", type=int, default=1, dest="pageNow")
    search.add_argument("--page-size", type=int, default=100, dest="pageSize")

    content = commands.add_parser("content", help="fetch domestic report text")
    content.add_argument("ids", nargs="+", type=int, help="report IDs from search")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = vars(_parser().parse_args(argv))
    command = args.pop("command")
    try:
        result: Any
        if command == "search":
            result = search_reports(**args)
        else:
            result = {"responses": get_domestic_report_content(args["ids"])}
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 0
    except DatayesResearchError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
