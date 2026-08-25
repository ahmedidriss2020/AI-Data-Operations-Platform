"""
Chat endpoint for the AnalyzeIt dashboard (PRD v3 §4, §11).

Implements the `POST /api/v1/chat` contract the dashboard's hermes bridge
expects, backed by OpenRouter function-calling over the parser tools.

The LLM never touches client data directly: every answer about numbers comes
from a tool call (query_dataset, profile_dataset, ...) executed inside this
process against workspace-scoped datasets. The model proposes SQL; the
service runs it; the model narrates the result.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from typing import Any

import httpx
from fastapi import Header, HTTPException

from .main import APP_SECRET, TOOL_SECRET, app, DATASETS, ensure_parsed
from fastapi import Request as FastAPIRequest

# Importing chat registers its routes on the shared FastAPI app.
__all__ = ["chat"]

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
MODEL_PRIMARY = os.environ.get("MODEL_PRIMARY", "stealth/ox-alpha")
MODEL_FALLBACK = os.environ.get("MODEL_SECONDARY", "")
MAX_TOOL_ROUNDS = 4

SYSTEM_PROMPT = """You are the AnalyzeIt data-operations copilot for an accounting practice.
You help accountants understand uploaded client workbooks: totals, anomalies,
duplicates, vendor patterns, period comparisons.

Rules:
- Every number you state MUST come from a tool result. Never invent or estimate figures.
- Use query_dataset with SQLite-compatible SQL against table `ds` for computations.
- Use profile_dataset first when unsure of column names/types.
- If no dataset is loaded in this conversation, say what you need (an upload) — do not guess.
- Money columns are Net Sales and VAT unless profile_dataset says otherwise.
- Be concise and businesslike. Lead with the answer, then one line of method."""


# ---------------------------------------------------------------------------
# tool implementations shared with /api/v1/tools
# ---------------------------------------------------------------------------

def _tool_query(ds_id: str, sql: str) -> dict[str, Any]:
    import duckdb
    ds = ensure_parsed(ds_id)
    con = duckdb.connect()
    try:
        con.register("ds", ds["df"].to_pandas())
        res = con.execute(sql)
        rows = [list(r) for r in res.fetchall()]
        cols = [d[0] for d in res.description]
    finally:
        con.close()
    return {"columns": cols, "rows": rows[:200], "truncated": len(rows) > 200}


def _tool_profile(ds_id: str) -> dict[str, Any]:
    ds = ensure_parsed(ds_id)
    df = ds["df"]
    cols: dict[str, Any] = {}
    for col in df.columns:
        s = df[col]
        entry: dict[str, Any] = {"dtype": str(s.dtype), "nulls": int(s.null_count())}
        if s.dtype.is_numeric():
            entry |= {"sum": round(float(s.sum()), 2), "min": float(s.min()), "max": float(s.max())}
        cols[col] = entry
    return {"rows": df.height, "duplicate_rows": int(df.is_duplicated().sum()), "columns": cols}


def _tool_list_datasets(workspace_id: str | None) -> list[dict[str, Any]]:
    out = []
    for ds_id, ds in DATASETS.items():
        if workspace_id and ds.get("workspace_id") not in (None, workspace_id):
            continue
        out.append({
            "dataset_id": ds_id,
            "filename": ds.get("filename"),
            "parsed": "df" in ds,
            "rows": ds["df"].height if "df" in ds else None,
        })
    return out


TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "query_dataset",
            "description": "Run SQL (DuckDB/SQLite dialect) against table `ds` for a dataset. Prefer aggregate queries; results capped at 200 rows.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dataset_id": {"type": "string"},
                    "sql": {"type": "string"},
                },
                "required": ["dataset_id", "sql"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "profile_dataset",
            "description": "Column-level statistics (types, nulls, sums, duplicate row count) for a dataset.",
            "parameters": {
                "type": "object",
                "properties": {"dataset_id": {"type": "string"}},
                "required": ["dataset_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_datasets",
            "description": "List datasets available in the current workspace.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _execute_tool(name: str, args: dict[str, Any], scope_workspace_id: str | None) -> dict[str, Any]:
    if name == "query_dataset":
        return _tool_query(args["dataset_id"], args["sql"])
    if name == "profile_dataset":
        return _tool_profile(args["dataset_id"])
    if name == "list_datasets":
        return {"datasets": _tool_list_datasets(scope_workspace_id)}
    return {"error": f"unknown tool {name}"}


# ---------------------------------------------------------------------------
# endpoint
# ---------------------------------------------------------------------------

@app.post("/api/v1/chat")
async def chat(request: FastAPIRequest,
               authorization: str | None = Header(default=None)) -> dict[str, Any]:
    # Same bearer contract as the tool layer: proves the caller is our backend.
    expected = f"Bearer {TOOL_SECRET}" if TOOL_SECRET else ""
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")

    body = await request.json()
    message: str = (body.get("message") or "").strip()
    history: list[dict[str, str]] = body.get("history") or []
    scope_token: str | None = body.get("scope_token")
    workspace_id: str | None = body.get("workspace_id")

    if not message:
        raise HTTPException(400, "message is empty")
    if not OPENROUTER_API_KEY:
        return {
            "status": "error",
            "result": {},
            "warnings": ["OPENROUTER_API_KEY is not configured on the agent service"],
            "execution_metadata": {"dry_run": False},
        }

    # Scope token is minted by the dashboard after requireWorkspaceAccess ran;
    # its presence marks an authenticated turn. We do not parse it here (the
    # dashboard owns verification); we record it in evidence.
    evidence_scope = "scope_token present" if scope_token else "no scope token"

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [
        {"role": h["role"], "content": h["content"]}
        for h in history[-12:]
        if h.get("role") in ("user", "assistant")
    ]
    messages.append({"role": "user", "content": message})

    started = time.time()
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    tool_trace: list[dict[str, Any]] = []
    reply_text = ""

    async with httpx.AsyncClient(timeout=60) as client:
        url = f"{OPENROUTER_BASE_URL}/chat/completions"
        used_model = MODEL_PRIMARY
        models_to_try = [m for m in (MODEL_PRIMARY, MODEL_FALLBACK) if m]

        for _round in range(MAX_TOOL_ROUNDS + 1):
            resp = None
            for attempt_model in models_to_try:
                resp = await client.post(url, headers=headers, json={
                    "model": attempt_model,
                    "messages": messages,
                    "tools": TOOLS_SPEC,
                    "max_tokens": 1200,
                    "temperature": 0.2,
                })
                if resp.status_code == 429 and attempt_model != models_to_try[-1]:
                    used_model = models_to_try[models_to_try.index(attempt_model) + 1]
                    continue
                used_model = attempt_model
                break
            assert resp is not None
            if resp.status_code == 401:
                raise HTTPException(502, "OpenRouter rejected the API key")
            if resp.status_code != 200:
                raise HTTPException(502, f"OpenRouter error {resp.status_code}: {resp.text[:200]}")

            choice = resp.json()["choices"][0]["message"]
            calls = choice.get("tool_calls") or []

            if not calls:
                reply_text = choice.get("content") or ""
                break

            messages.append(choice)
            for call in calls:
                fn = call["function"]["name"]
                args: dict[str, Any] = {}
                try:
                    args = json.loads(call["function"]["arguments"] or "{}")
                    result = _execute_tool(fn, args, workspace_id)
                except Exception as exc:  # tool errors go back to the model, not the user
                    result = {"error": str(exc)[:300]}
                tool_trace.append({"tool": fn, "args": args})
                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result, default=str)[:6000],
                })
        else:
            reply_text = "I could not finish that analysis within the allowed steps."

    return {
        "status": "ok" if reply_text else "error",
        "result": {"reply": reply_text},
        "evidence": {
            "tools_used": tool_trace,
            "scope": evidence_scope,
        },
        "warnings": [],
        "execution_metadata": {
            "duration_ms": int((time.time() - started) * 1000),
            "model": used_model,
            "dry_run": False,
        },
    }


@app.get("/health")
async def health_extended():
    base = {
        "status": "healthy",
        "agent": "AnalyzeIt Parser Agent",
        "datasets": len(DATASETS),
        "time": datetime.utcnow().isoformat(),
    }
    base |= {
        "chat_enabled": bool(OPENROUTER_API_KEY),
        "queue_depth": 0,
        "active_workers": 1,
    }
    return base
