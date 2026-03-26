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
- internal login gate for local/private use
- interactive frontend with filtering, tabbing, and collapsible sections
- app-side calculation layer for approved Follow Up and Google Ads metrics
- weekly, monthly, and yearly dashboard period controls
- Google Sheet workbook reviewed and translated into draft metric docs

What is not done yet:
- real Zapier ingestion for raw Salesforce / GA4 values
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
- It is suitable for local/private internal use only
- It should eventually be replaced with proper auth

### Supabase connection

This environment has used the Supabase session pooler successfully.
Direct DB access was problematic from this machine because of network/IPv4 compatibility.

Practical note:
- `DATABASE_URL` and `DIRECT_URL` may both point to the session pooler in local development here

### Period model

The active implementation now supports:
- `WEEK`
- `MONTH`
- `YEAR`

For the approved scope, Zapier should send raw observations with the intended `timegrain`.
The app then calculates the derived dashboard metrics from those raw observations.

### Targets sheet

The original Google Sheet is a planning/layout document.
It is not the ideal runtime target source.

If using Google Sheets for targets:
- create a clean normalized target tab
- sync that tab into Postgres
- avoid reading presentation/layout tabs directly at runtime

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

1. Finalize the raw Zapier payload contract for Follow Up + Google Ads.
2. Send weekly and monthly raw observations into `/api/ingest`.
3. Verify the dashboard calculations against real source numbers.
4. Add targets for the approved metrics.
5. Only after that, expand to deferred sections.

## Safe Defaults For Future LLMs

If unsure, assume:
- calculation logic should live in the app
- business definitions must match `docs/metric-approval-table.md`
- only Follow Up + Google Ads are in active implementation scope
- deferred sections should not be silently finalized without user approval
- docs should be updated when business logic changes

## What To Avoid

- Do not move business formulas into Zapier unless explicitly requested.
- Do not treat all seeded metrics as approved just because they exist in the database.
- Do not rename metric keys casually once live observations start flowing.
- Do not assume standard ad-tech definitions when the user has defined a business-specific one.
- Do not overwrite or ignore the approval docs.
