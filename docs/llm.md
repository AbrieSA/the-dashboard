# LLM Entry Point

Start with [llm-context.md](/Users/abriev/Desktop/Codex%20Test/The%20DashBoard/docs/llm-context.md).

This file exists as a stable entrypoint for future LLMs working on this app.

Current high-level status:
- production is live on `https://the-dashboard-theta.vercel.app`
- approved v1 scope is working end-to-end:
  - `Follow Up Health`
  - `Google Ads`
- weekly and monthly ingestion are working
- Google Sheets target sync is working
- deferred sections are still:
  - `Organic Website`
  - `Insta Ads`
  - `Website Health`

Before making changes:
1. Read `docs/llm-context.md`.
2. Read `docs/metric-approval-table.md`.
3. Read `docs/metric-formula-map.md`.

Default assumptions:
- formulas belong in the app, not Zapier
- only the approved v1 scope should be treated as finalized
- production changes should preserve the current live behavior unless the user explicitly requests a change
