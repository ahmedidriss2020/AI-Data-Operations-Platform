# Workbook parser (Week 2)

Placeholder. PRD section 6 makes messy workbook parsing a P0 deliverable rather than an
assumption — "this is where pilots die" — so it gets its own service rather than living inside
the web app.

Planned: Python / FastAPI, with Polars and DuckDB doing the arithmetic. It reads a raw upload from
the `raw` bucket, produces a structured *interpretation* (table boundaries, header location, type
inference) with a confidence score, writes Parquet to the `parquet` bucket, and records a new
`dataset_versions` row whose parent is the v0 the upload path already created.

Build against `fixtures/messy/acme-sales-2026-08.xlsx`, which carries the section 6 pathologies
deliberately. The eval harness (section 8) belongs here too, and the PRD is explicit that it is
built in week 2 rather than week 8 — without it, "interchangeable OpenAI/Kimi" is a claim that
cannot safely be acted on.
