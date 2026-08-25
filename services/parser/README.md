# Workbook parser service (Week 2)

Python/FastAPI compute layer for AnalyzeIt. Parses messy workbooks into
structured datasets and serves the tool contract (PRD v3 §7).

## Run

```bash
cd services/parser
uv venv venv
uv pip install --python venv/bin/python -r requirements.txt
HERMES_WEBHOOK_SECRET=<secret> TOOL_LAYER_SECRET=<secret> \
  venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8100
```

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | /health | none | liveness |
| POST | /datasets/{id} | X-Hermes-Secret | push raw workbook bytes |
| POST | /webhooks/{name} | X-Hermes-Secret | workbook.uploaded events |
| POST | /api/v1/tools/{tool} | Bearer TOOL_LAYER_SECRET | parse_workbook, profile_dataset, query_dataset, apply_recipe |

## Production notes

- Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to let the webhook fetch
  uploads directly from the `raw` bucket (then pushWorkbook is unnecessary).
- The in-memory DATASETS store is per-process; for multi-worker deployments,
  persist parsed Parquet to object storage keyed by dataset_id.
- Dashboard wiring: `apps/web/src/lib/parser-client.ts`, configured via
  `PARSER_SERVICE_URL` + `PARSER_SERVICE_SECRET`.
