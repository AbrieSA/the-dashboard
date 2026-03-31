# LLM Entry Point

Start with [llm-context.md](/Users/abriev/Desktop/Codex%20Test/The%20DashBoard/docs/llm-context.md).

This file exists as a stable entrypoint for future LLMs working on this app.

Current high-level status:
- production is live on `https://the-dashboard-theta.vercel.app`
- approved v1 scope is working end-to-end:
  - `Follow Up Health`
  - `Google Ads`
- Website Health backend now exists:
  - direct app-owned PageSpeed sync
  - monitored page registry
  - dedicated report API with `mobile`, `desktop`, and `all`
  - dedicated `/website-health` page with expandable rows and frontend page creation
- weekly and monthly ingestion are working
- Google Sheets target sync is working
- dashboard view switching has been stabilized with:
  - a short server-side snapshot cache
  - cache invalidation on ingest/target sync
  - a Vercel preferred-region pin closer to Supabase
- deferred sections are still:
  - `Organic Website`
  - `Insta Ads`
  - `Website Health`

Before making changes:
1. Read `docs/llm-context.md`.
2. Read `docs/metric-approval-table.md`.
3. Read `docs/metric-formula-map.md`.
4. Read `docs/finalisation-roadmap-infographic.html` for the current plain-English roadmap toward a finished app.

Default assumptions:
- formulas belong in the app, not Zapier
- only the approved v1 scope should be treated as finalized
- production changes should preserve the current live behavior unless the user explicitly requests a change
- if the dashboard shows a connection problem, treat it as a real runtime data issue, not a fake preview-mode fallback
- the roadmap infographic is a living planning artifact and should be updated as major milestones are completed or reprioritized
- Website Health is now backend-first and should be expanded through the page registry/report APIs rather than by forcing it into the old flat dashboard payload
- the main dashboard and Website Health now share a common top header, so navigation changes should usually be made there instead of duplicating page-specific nav
