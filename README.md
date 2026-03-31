# System Health Dashboard

Internal dashboard starter for Salesforce, GA4, and website performance metrics. The app is built for Vercel with Next.js, Postgres, Prisma, a Zapier ingestion endpoint, and a Google Sheets target sync path.

## Stack
- Next.js App Router
- Postgres + Prisma
- Internal password gate with allow-listed emails
- Zapier -> API ingestion
- Google Sheets CSV -> target sync
- Direct app-owned PageSpeed Insights sync for Website Health

## Local setup
1. Copy `.env.example` to `.env`.
2. Create a Postgres database locally or in Supabase/Neon.
3. Update `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `INTERNAL_DASHBOARD_PASSWORD`, `INGESTION_API_KEY`, and `GOOGLE_TARGETS_SYNC_KEY`.
4. Optional but recommended for website health: set `WEBSITE_HEALTH_SYNC_KEY` and `PAGESPEED_API_KEY`.
5. Run `npm run prisma:generate`.
6. Run `npm run prisma:deploy`.
7. Run `npm run prisma:seed`.
8. Run `npm run dev`.

## Deploying to Vercel
- Push this repo to GitHub.
- Create a Vercel project.
- Add all env vars from `.env.example`.
- Add a managed Postgres database URL from Supabase or Neon.
- `APP_BASE_URL` is optional if you want the app to derive its base URL from the incoming Vercel request.
- Point Zapier webhooks at your Vercel URL:
  - `POST /api/ingest`
  - `POST /api/sync-targets`
- For direct website-performance syncing, configure:
  - `POST /api/website-health/sync`
  - `GET /api/website-health/report`
  - `GET /api/website-health/pages`
  - `POST /api/website-health/pages`
  - `PATCH /api/website-health/pages/[id]`
- `x-sync-key: <WEBSITE_HEALTH_SYNC_KEY>` protects the machine-to-machine website sync route
- `PAGESPEED_API_KEY` should be treated as required for production website-health syncing

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

## Website health via PageSpeed Insights

Website Health is now a dedicated backend subsystem fed directly by Google's official PageSpeed Insights API.

Google's docs say:
- the API is `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
- `url` is required
- `strategy` can be `mobile` or `desktop`
- if no `category` is supplied, only `performance` runs by default
- an API key is optional, but recommended for frequent automated queries

Sources:
- [Get Started with the PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started)
- [runPagespeed API reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)

Current implementation notes:
- monitored pages are stored in a page registry
- the initial seeded pages are:
  - `https://www.ywamships.org/`
  - `https://www.ywamships.org/dts`
  - `https://www.ywamships.org/volunteer-on-mv-ywam-png/`
- first-class Website Health metrics are field-data Web Vitals:
  - `LCP`
  - `INP`
  - `CLS`
- snapshots are stored for both `mobile` and `desktop`
- Website Health should be treated as current 28-day PageSpeed data, not weekly/monthly reporting
- report queries support `all`, `mobile`, and `desktop`
- `website_speed` is still mirrored from homepage mobile `LCP` for compatibility with the current dashboard card
- in practice, automated calls without an API key can hit Google rate limits quickly, so `PAGESPEED_API_KEY` should be treated as required for production syncs

Example request:

```bash
curl -X POST https://your-app.vercel.app/api/website-health/sync \
  -H "Content-Type: application/json" \
  -H "x-sync-key: yourWebsiteHealthSyncKey" \
  -d "{}"
```

Optional body fields:

```json
{
  "pageIds": ["page-id-1"],
  "strategies": ["mobile", "desktop"],
  "notes": "Manual website-health sync"
}
```

Report request example:

```bash
curl "https://your-app.vercel.app/api/website-health/report?strategy=all"
```

Page registry example:

```json
{
  "label": "About DTS",
  "url": "https://www.ywamships.org/dts",
  "key": "about_dts"
}
```

## Notes
- Seed data loads dashboard groups and metric definitions, but not observations.
- Duplicate Zap runs are prevented at the source-run level using `source + externalRunId`.
- The dashboard can switch between month and year views using query params.
- For Supabase, use the pooled connection string as `DATABASE_URL` and the direct connection string as `DIRECT_URL`.
- Website Health uses current 28-day PageSpeed data for the user-facing product model.
