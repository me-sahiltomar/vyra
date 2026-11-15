"""
logger.py
----------
Centralised request/response logger for H²OS API.

Output format:
  [API] POST /api/nutrition/add-meal
    Request:  { "name": "Chicken Breast", "cal": 165, ... }
    Response: { "success": true, "healthScore": 42, "meals": 2 }

Usage:
  from logger import api_log
  api_log("POST", "/api/nutrition/add-meal", request_data, response_data)
"""

import json
import logging
import textwrap

# Root logger — uvicorn routes all output through this
_log = logging.getLogger("h2os.api")


def _compact(data: object, max_list_items: int = 3) -> object:
    """
    Recursively compress a dict/list for readable one-line previews.
    - Lists longer than max_list_items → truncated with a count suffix
    - Nested dicts → kept as-is (they're already compact at one level)
    """
    if isinstance(data, list):
        if len(data) > max_list_items:
            preview = data[:max_list_items]
            return [_compact(x) for x in preview] + [f"… +{len(data) - max_list_items} more"]
        return [_compact(x) for x in data]
    if isinstance(data, dict):
        return {k: _compact(v) for k, v in data.items()}
    return data


def _fmt(data: object) -> str:
    """Serialise data to a compact single-line JSON string."""
    try:
        return json.dumps(_compact(data), ensure_ascii=False, default=str)
    except Exception:
        return repr(data)


def api_log(
    method:        str,
    path:          str,
    request_data:  object = None,
    response_data: object = None,
) -> None:
    """
    Emit a structured [API] log entry.

    Args:
        method:        HTTP verb, e.g. "POST"
        path:          Route path, e.g. "/api/nutrition/add-meal"
        request_data:  Incoming payload (dict, Pydantic model, or None for GET)
        response_data: Outgoing response dict
    """
    req_line  = f"  Request:  {_fmt(request_data)}" if request_data is not None else "  Request:  (none)"
    resp_line = f"  Response: {_fmt(response_data)}" if response_data is not None else "  Response: (none)"

    _log.info(
        f"\n[API] {method} {path}\n"
        f"{req_line}\n"
        f"{resp_line}"
    )

    # Also print to stdout so it's visible directly in the uvicorn terminal
    # alongside the INFO: 200 OK lines.
    print(
        f"\n[API] {method} {path}\n"
        f"{req_line}\n"
        f"{resp_line}",
        flush=True,
    )
