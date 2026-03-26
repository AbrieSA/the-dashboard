# LLM Context

This document is for future LLMs or agents making changes to this app.

## Purpose

This project is an internal operational dashboard for marketing and sales health.

The intended data sources are:
- Salesforce
- GA4 / ad platforms
- website performance / SEO tools
- Google Sheets for editable targets only

The dashboard is deployed as a Next.js app and uses Postgres as the source of truth.

## Big Picture

The app is split into 4 responsibilities:
- UI rendering
- database-backed metric definitions and observations
- ingestion endpoints for external systems
- target syncing from Google Sheets

The current design choice is:
- Zapier should send raw data into the app
- the app should own the business formulas
- formulas should not live primarily in Zapier

This is important. If metric logic changes later, the codebase should be the main place to edit it.

## Current Product Scope

Approved active scope:
- `Follow Up Health`
- `Google Ads` inside `Prospect Source Health`

Confirmed working in production:
- weekly Follow Up ingestion and calculations
- monthly Follow Up ingestion and calculations
- weekly Google Ads ingestion and calculations
- Google Sheets target sync for active metrics

Deferred for now:
- `Organic Website`
- `Insta Ads`
- `Website Health`

Do not treat the deferred sections as finalized business logic yet.

## Current State

What is already working:
- Next.js app structure
- Supabase/Postgres connection
- Prisma schema and initial migration
- seeded metric definitions
- internal login gate in both local and production
- interactive frontend with filtering, tabbing, and collapsible sections
- app-side calculation layer for approved Follow Up and Google Ads metrics
- weekly, monthly, and yearly dashboard period controls
- Google Sheet workbook reviewed and translated into draft metric docs
- live Vercel production deployment
- live Zapier ingestion into production
- live Google target sync into production
- production dashboard displays active metrics and targets correctly
- dashboard view switching is stabilized with a short server-side snapshot cache
- dashboard cache is invalidated after ingest and target sync so fresh data appears quickly

What is not done yet:
- scheduled/fully real Zapier source mappings beyond the current validated test payloads
- production-grade auth
- finalized business definitions for deferred sections

## Files To Read First

Read these before changing anything important:
- `README.md`
- `docs/metric-approval-table.md`
- `docs/metric-formula-map.md`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `app/api/ingest/route.ts`
- `lib/dashboard.ts`
- `components/DashboardView.tsx`
- `components/InteractiveDashboard.tsx`

## Important Docs

`docs/metric-approval-table.md`
- human approval sheet
- shows which metrics are source data vs calculated in app
- reflects current approved scope

`docs/metric-formula-map.md`
- more narrative/spec-style version of the metric logic
- includes raw input assumptions and calculation ownership

If the user changes business logic, update these docs first or immediately after code changes.

## App Structure

### App routes

`app/page.tsx`
- server page entry
- loads dashboard snapshot
- passes data to the main dashboard view
- treats dashboard fetch failures as real connection/runtime issues instead of silently falling back to fake preview mode

`app/login/page.tsx`
- login screen

`app/login/submit/route.ts`
- login submission handler

`app/api/ingest/route.ts`
- authenticated ingestion endpoint for Zapier or other senders

`app/api/sync-targets/route.ts`
- authenticated endpoint to sync Google Sheet target values

`app/api/dashboard/route.ts`
- JSON dashboard snapshot endpoint

### Components

`components/DashboardView.tsx`
- top-level dashboard shell
- summary cards, layout, top bar

`components/InteractiveDashboard.tsx`
- client-side interactivity
- tabs
- search
- status filters
- selected metric panel
- collapsible sections

`components/MetricCard.tsx`
- reusable KPI card

`components/TrendChart.tsx`
- sparkline/trend display

### Library code

`lib/dashboard.ts`
- reads from Prisma
- builds grouped dashboard snapshot data
- computes approved metrics from raw observations at read time
- caches dashboard snapshots briefly to reduce repeated Supabase reads during week/month/year switches

`lib/metric-calculations.ts`
- central business logic for approved app-side formulas
- defines which active metrics are direct source data vs derived metrics

`lib/timegrain.ts`
- period helpers for week/month/year windows and chart bucketing

`lib/dashboard-types.ts`
- shared dashboard view types

`lib/metric-status.ts`
- frontend status logic for cards

`lib/auth.ts`
- lightweight temporary auth
- not final production auth

`lib/validation.ts`
- Zod schemas for ingestion and query validation

`lib/targets.ts`
- syncs Google Sheet target rows into Postgres
- uses a bulk insert path that is compatible with the Supabase pooler

## Database Model

Core models:
- `DashboardGroup`
- `MetricDefinition`
- `MetricObservation`
- `MetricTarget`
- `SourceRun`

Current interpretation:
- `MetricDefinition` = what a metric is
- `MetricObservation` = a timestamped numeric value tied to a `timegrain`
- `MetricTarget` = current / standard / desired thresholds
- `SourceRun` = log of each ingest attempt

## Naming / Terminology Rules

Use these terms consistently:
- say `Prospects`, not `Leads`, in user-facing naming
- `CTR` in this business context means `prospects / clicks`, not standard ad-platform CTR
- `Processing -> Approved` is the intended meaning of `Procc > Appr`
- `Student arrive` is a count, not a financial value

Important nuance:
- some old internal metric keys still contain legacy naming patterns
- prefer cleaning terminology carefully rather than doing broad renames without checking seeded data and docs

## Current Technical Constraints

### Auth

The current auth is intentionally lightweight and temporary.
- It is currently used in production
- It should eventually be replaced with proper auth
- If `INTERNAL_DASHBOARD_EMAILS` is blank, any email can log in with the shared password

### Supabase connection

This environment has used the Supabase session pooler successfully.
Direct DB access was problematic from this machine because of network/IPv4 compatibility.

Practical note:
- `DATABASE_URL` and `DIRECT_URL` may both point to the session pooler in local development here
- The production deployment is on Vercel and has been verified live
- The stable production URL in the current setup is `https://the-dashboard-theta.vercel.app`
- The main dashboard routes are pinned to Vercel region `hnd1` to reduce latency to the Supabase project

### Period model

The active implementation now supports:
- `WEEK`
- `MONTH`
- `YEAR`

For the approved scope, Zapier should send raw observations with the intended `timegrain`.
The app then calculates the derived dashboard metrics from those raw observations.

Practical note:
- switching between `WEEK`, `MONTH`, and `YEAR` still triggers fresh dashboard reads, but those reads are now protected by a short cache
- if the UI shows a connection issue, treat it as a real runtime/data-access problem, not a preview-mode fallback

### Targets sheet

The original Google Sheet is a planning/layout document.
It is not the ideal runtime target source.

If using Google Sheets for targets:
- create a clean normalized target tab
- sync that tab into Postgres
- avoid reading presentation/layout tabs directly at runtime

Current live setup:
- the targets tab is in the same workbook as the planning sheet
- production uses `GOOGLE_TARGETS_CSV_URL` to fetch the public CSV export for that targets tab
- `/api/sync-targets` has been tested successfully in production

## Frontend Intent

The dashboard should feel like a polished operational control panel, not a generic admin CRUD app.

Current design direction:
- light, clean SaaS dashboard
- interactive KPI cards
- compact header
- simple but intentional motion and affordances

When editing the frontend:
- preserve the dashboard feel
- keep interactions client-side where possible
- do not regress to a plain utility/admin UI

## Recommended Implementation Order From Here

1. Lock down production auth with `INTERNAL_DASHBOARD_EMAILS` and stronger shared secrets.
2. Replace validated test payloads with real Zapier mappings from Salesforce and Google Ads sources.
3. Decide whether target sync should be manual-triggered or scheduled automatically.
4. Only after the approved scope is stable, expand to deferred sections.

## Safe Defaults For Future LLMs

If unsure, assume:
- calculation logic should live in the app
- business definitions must match `docs/metric-approval-table.md`
- only Follow Up + Google Ads are in active implementation scope
- production behavior should be validated against `https://the-dashboard-theta.vercel.app`
- deferred sections should not be silently finalized without user approval
- docs should be updated when business logic changes

## What To Avoid

- Do not move business formulas into Zapier unless explicitly requested.
- Do not treat all seeded metrics as approved just because they exist in the database.
- Do not rename metric keys casually once live observations start flowing.
- Do not assume standard ad-tech definitions when the user has defined a business-specific one.
- Do not overwrite or ignore the approval docs.
