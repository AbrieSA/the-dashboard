# Metric Formula Map

This is a best-effort draft of how the Google Sheets workbook should map into the app's metric model.

It is based on:
- the `Summary`, `Paid Ads`, `Follow UP`, and `Website` tabs from the Google Sheet
- the seeded metric keys in [prisma/seed.ts](/Users/abriev/Desktop/Codex%20Test/The%20DashBoard/prisma/seed.ts)

The workbook currently contains labels and placeholders, not formulas, so the formulas below are inferred from the metric names and common funnel logic.

## Core Rules
- `Year` metrics should aggregate from January 1 to today.
- `Month` metrics should aggregate from the first day of the current month to today.
- Conversion rates should be stored as decimal ratios in the database.
  - Example: `42%` should be stored as `0.42`.
- If a denominator is `0` or missing, store `null` rather than `0`.
- For source-specific metrics, attribution should use the same source mapping across Salesforce and GA4.
- Use `prospects` as the business term everywhere. Do not use `leads` in user-facing labels.

## Active Scope
- Build now:
  - `Follow Up Health`
  - `Google Ads` inside `Prospect Source Health`
- Defer for now:
  - `Organic Website`
  - `Insta Ads`
  - `Website Health`

## Follow Up Metrics

| Metric key | Dashboard label | Best raw inputs | Draft formula | Source |
|---|---|---|---|---|
| `prospects_to_applications` | Prospects > Applications | `prospects`, `applications` | `applications / prospects` | Salesforce |
| `estimated_prospect_calls` | Est. Prospect Calls | `estimated_prospect_calls` | direct value from Zapier | Zapier |
| `processed_to_approved` | Procc > Appr | `processing_stage_applications`, `approved_applications` | `approved_applications / processing_stage_applications` | Salesforce |
| `approved_to_confirmed` | Appr > Conf | `approved_applications`, `confirmed_applications` | `confirmed_applications / approved_applications` | Salesforce |
| `applications_to_arrival` | App > Arrival | `applications`, `arrived_students` | `arrived_students / applications` | Salesforce |

### Follow Up Notes
- `processed_to_approved` has now been clarified:
  - `Processing` is the Salesforce application stage immediately after someone applies.
  - `Approved` is the later Salesforce stage.
  - Formula should be `approved / processing`.
- `approved_applications` likely maps to the sheet's `Applications Confirmed` or a separate approved count from Salesforce.
- `confirmed_applications` may be a separate Salesforce stage after approval and before arrival.
- `estimated_prospect_calls` should be calculated upstream and sent into the app as a direct value from Zapier.

## Prospect Source Metrics

The `Paid Ads` tab appears to be the source tab for:
- `Google Ads`
- `Insta Ads`
- `Organic Website traffic`
- `Tiktok Ads`

The app currently supports:
- `google_ads`
- `insta_ads`
- `organic_website`

`Tiktok Ads` exists in the sheet, but is not yet seeded in the app.

### Shared Source Field Assumptions

For each source, the best candidate raw fields are:
- `clicks`
- `conversions`
- `prospects`
- `prospects_inactive`
- `prospects_preq`
- `prospects_converted`
- `applications`
- `applications_closed_lost`
- `applications_confirmed`
- `applications_closed_won_or_alumni`
- `student_arrive_amounts`
- `ad_spending`

### Per-source formulas

| Metric key | Dashboard label | Best raw inputs | Draft formula | Source |
|---|---|---|---|---|
| `google_ads_clicks` | Clicks | `google_ads.clicks` | direct value | GA4 |
| `google_ads_ctr` | CTR | `google_ads.clicks`, `google_ads.prospects` | `prospects / clicks` | GA4 + Salesforce attribution |
| `google_ads_prospects` | Prospects | `google_ads.prospects` | direct value | Salesforce |
| `google_ads_prospects_to_applications` | Prosp > App | `google_ads.prospects`, `google_ads.applications` | `applications / prospects` | Salesforce |
| `google_ads_prospects_to_arrival` | Prosp > Arrival | `google_ads.prospects`, `google_ads.student_arrive_amounts` | `student_arrive_amounts / prospects` | Salesforce |
| `organic_clicks` | Clicks | deferred | deferred | Deferred |
| `organic_ctr` | CTR | deferred | deferred | Deferred |
| `organic_leads` | Prospects | deferred | deferred | Deferred |
| `organic_prospects_to_applications` | Prosp > App | deferred | deferred | Deferred |
| `organic_prospects_to_arrival` | Prosp > Arrival | deferred | deferred | Deferred |
| `insta_ads_clicks` | Clicks | deferred | deferred | Deferred |
| `insta_ads_ctr` | CTR | deferred | deferred | Deferred |
| `insta_ads_leads` | Prospects | deferred | deferred | Deferred |
| `insta_ads_prospects_to_applications` | Prosp > App | deferred | deferred | Deferred |
| `insta_ads_prospects_to_arrival` | Prosp > Arrival | deferred | deferred | Deferred |

### Prospect Source Notes
- This has now been clarified:
  - `CTR` means the rate of clicks that become prospects.
  - Formula should be `prospects / clicks`.
  - Even though the label says `CTR`, this is not standard ad-platform click-through rate.
- The workbook and dashboard should use `Prospects` consistently in user-facing labels.

## Website Metrics

The `Website` tab appears to combine three types of data:
- website performance tools
- SEO ranking tools
- GA4 page/session activity

| Metric key | Dashboard label | Best raw inputs | Draft formula | Source |
|---|---|---|---|---|
| `website_speed` | Website Speed | deferred | deferred | Deferred |
| `website_downtime` | Website Downtime | deferred | deferred | Deferred |
| `broken_links` | Broken Links | deferred | deferred | Deferred |
| `ywam_rank` | YWAM | deferred | deferred | Deferred |
| `dts_rank` | DTS | deferred | deferred | Deferred |
| `dts_sessions` | DTS Sessions | deferred | deferred | Deferred |
| `website_ctr` | CTR | deferred | deferred | Deferred |

### Website Notes
- These metrics are intentionally deferred until the practical details are finalized.

## Suggested Raw Input Model for Zapier

To support these formulas cleanly, Zapier should send raw counts and not only final rates.

Recommended raw inputs per period:

### Salesforce
- `prospects`
- `applications`
- `processing_stage_applications`
- `approved_applications`
- `confirmed_applications`
- `arrived_students`
- `estimated_prospect_calls`
- per-source versions of the same where possible for Google Ads

### GA4 / Ads
- `clicks`
- `prospects`
- segmented by source where needed

### Website performance / SEO
- deferred

## Recommended Calculation Ownership

Best current design:
- Zapier imports raw values only.
- The app computes the display rates.
- Keep formulas in the app so the business logic can change without rebuilding Zapier flows.

Recommended approach:
- ingest raw source values into raw metric observations
- compute dashboard/display metrics inside the app layer
- keep formulas versioned in code rather than hidden inside automations

## Gaps To Confirm

These are the biggest assumptions I would expect you to correct:
- Whether `Applications Confirmed` equals `Appr > Conf` numerator
- Whether `confirmed` is a distinct stage after `approved`
- Organic Website metrics
- Insta Ads metrics
- Website Health metrics

## Recommended Next Implementation Step

Before wiring more code, convert this document into a final approved metric map:
- one row per metric key
- exact Salesforce field/report source
- exact GA4 metric/dimension
- exact formula
- exact period logic

Once you correct the assumptions above, this file can become the source doc for Zapier mappings and app calculations.
