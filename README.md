# System Health Dashboard

Internal dashboard starter for Salesforce, GA4, and website performance metrics. The app is built for Vercel with Next.js, Postgres, Prisma, a Zapier ingestion endpoint, and a Google Sheets target sync path.

## Stack
- Next.js App Router
- Postgres + Prisma
- Internal password gate with allow-listed emails
- Zapier -> API ingestion
- Google Sheets CSV -> target sync

## Local setup
1. Copy `.env.example` to `.env`.
2. Create a Postgres database locally or in Supabase/Neon.
3. Update `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `INTERNAL_DASHBOARD_PASSWORD`, `INGESTION_API_KEY`, and `GOOGLE_TARGETS_SYNC_KEY`.
4. Run `npm run prisma:generate`.
5. Run `npm run prisma:deploy`.
6. Run `npm run prisma:seed`.
7. Run `npm run dev`.

## Deploying to Vercel
- Push this repo to GitHub.
- Create a Vercel project.
- Add all env vars from `.env.example`.
- Add a managed Postgres database URL from Supabase or Neon.
- `APP_BASE_URL` is optional if you want the app to derive its base URL from the incoming Vercel request.
- Point Zapier webhooks at your Vercel URL:
  - `POST /api/ingest`
  - `POST /api/sync-targets`

## Ingestion contract
Send a `POST` to `/api/ingest` with header `x-api-key: <INGESTION_API_KEY>`.

```json
{
  "source": "SALESFORCE",
  "externalRunId": "zap-run-2026-03-26T10",
  "observations": [
    {
      "metricKey": "prospects_to_applications",
      "value": 0.42,
      "timestamp": "2026-03-26T10:00:00.000Z"
    }
  ]
}
```

## Google Sheets target sync
The current visual planning sheet is a layout reference, not a good sync source. Create a dedicated targets sheet with this CSV header:

```csv
metricKey,targetType,targetValue,effectiveFrom,effectiveTo,notes
prospects_to_applications,CURRENT,0.4,2026-01-01,,Current benchmark
prospects_to_applications,STANDARD,0.45,2026-01-01,,Operational standard
prospects_to_applications,DESIRED,0.5,2026-01-01,,Stretch target
```

Then set `GOOGLE_TARGETS_CSV_URL` to that tab's CSV export URL and call `POST /api/sync-targets` with header `x-sync-key: <GOOGLE_TARGETS_SYNC_KEY>`.

## Notes
- Seed data loads dashboard groups and metric definitions, but not observations.
- Duplicate Zap runs are prevented at the source-run level using `source + externalRunId`.
- The dashboard can switch between month and year views using query params.
- For Supabase, use the pooled connection string as `DATABASE_URL` and the direct connection string as `DIRECT_URL`.
