# Metric Approval Table

This table is the working approval sheet for the dashboard metrics.

Design choice locked in:
- Zapier should send raw source data into the app.
- The app should run the calculations.
- The displayed dashboard metrics should be derived in the app from those raw values.

Current implementation scope:
- Build now: `Follow Up Health` and `Google Ads`
- Defer for now: `Organic Website`, `Insta Ads`, and `Website Health`

## Dashboard Metrics

| Metric key | Display label | Group | Type | Raw inputs needed | Formula / definition | Notes |
|---|---|---|---|---|---|---|
| `prospects_to_applications` | Prospects > Applications | Follow Up Health | Calculated in app | `prospects`, `applications` | `applications / prospects` | Ratio stored as decimal |
| `estimated_prospect_calls` | Est. Prospect Calls | Follow Up Health | Source data from Zapier | `estimated_prospect_calls` | direct value | Zapier will calculate this upstream |
| `processed_to_approved` | Procc > Appr | Follow Up Health | Calculated in app | `processing_stage_applications`, `approved_applications` | `approved_applications / processing_stage_applications` | Uses Salesforce stages `Processing` -> `Approved` |
| `approved_to_confirmed` | Appr > Conf | Follow Up Health | Calculated in app | `approved_applications`, `confirmed_applications` | `confirmed_applications / approved_applications` | Needs confirmation on what exactly counts as `confirmed` |
| `applications_to_arrival` | App > Arrival | Follow Up Health | Calculated in app | `applications`, `arrived_students` | `arrived_students / applications` | `arrived_students` is a count |
| `google_ads_clicks` | Clicks | Prospect Source Health | Source data | `google_ads.clicks` | direct value | Year/month aggregation done in app |
| `google_ads_ctr` | CTR | Prospect Source Health | Calculated in app | `google_ads.clicks`, `google_ads.prospects` | `google_ads.prospects / google_ads.clicks` | This is click-to-prospect rate, not standard ad CTR |
| `google_ads_prospects` | Prospects | Prospect Source Health | Source data | `google_ads.prospects` | direct value | Approved rename from `google_ads_leads` |
| `google_ads_prospects_to_applications` | Prosp > App | Prospect Source Health | Calculated in app | `google_ads.prospects`, `google_ads.applications` | `google_ads.applications / google_ads.prospects` | Source attribution must match Salesforce |
| `google_ads_prospects_to_arrival` | Prosp > Arrival | Prospect Source Health | Calculated in app | `google_ads.prospects`, `google_ads.arrived_students` | `google_ads.arrived_students / google_ads.prospects` | Arrival is a count |
| `organic_clicks` | Clicks | Prospect Source Health | Deferred | `organic_website.clicks` | TBD later | Out of current implementation scope |
| `organic_ctr` | CTR | Prospect Source Health | Deferred | `organic_website.clicks`, `organic_website.prospects` | TBD later | Out of current implementation scope |
| `organic_leads` | Prospects | Prospect Source Health | Deferred | `organic_website.prospects` | TBD later | Out of current implementation scope |
| `organic_prospects_to_applications` | Prosp > App | Prospect Source Health | Deferred | `organic_website.prospects`, `organic_website.applications` | TBD later | Out of current implementation scope |
| `organic_prospects_to_arrival` | Prosp > Arrival | Prospect Source Health | Deferred | `organic_website.prospects`, `organic_website.arrived_students` | TBD later | Out of current implementation scope |
| `insta_ads_clicks` | Clicks | Prospect Source Health | Deferred | `insta_ads.clicks` | TBD later | Out of current implementation scope |
| `insta_ads_ctr` | CTR | Prospect Source Health | Deferred | `insta_ads.clicks`, `insta_ads.prospects` | TBD later | Out of current implementation scope |
| `insta_ads_leads` | Prospects | Prospect Source Health | Deferred | `insta_ads.prospects` | TBD later | Out of current implementation scope |
| `insta_ads_prospects_to_applications` | Prosp > App | Prospect Source Health | Deferred | `insta_ads.prospects`, `insta_ads.applications` | TBD later | Out of current implementation scope |
| `insta_ads_prospects_to_arrival` | Prosp > Arrival | Prospect Source Health | Deferred | `insta_ads.prospects`, `insta_ads.arrived_students` | TBD later | Out of current implementation scope |
| `website_speed` | Website Speed | Website Health | Deferred | `lcp_ms` and/or `pingdom_speed_ms` | TBD later | Out of current implementation scope |
| `website_downtime` | Website Downtime | Website Health | Deferred | `downtime_minutes` or `uptime_percent` | TBD later | Out of current implementation scope |
| `broken_links` | Broken Links | Website Health | Deferred | `broken_links_count` | TBD later | Out of current implementation scope |
| `ywam_rank` | YWAM | Website Health | Deferred | `ywam_rank` | TBD later | Out of current implementation scope |
| `dts_rank` | DTS | Website Health | Deferred | `dts_rank` | TBD later | Out of current implementation scope |
| `dts_sessions` | DTS Sessions | Website Health | Deferred | `dts_page_sessions` | TBD later | Out of current implementation scope |
| `website_ctr` | CTR | Website Health | Deferred | `page_clicks`, `page_sessions` | TBD later | Out of current implementation scope |

## Raw Input Metrics To Ingest

These are not necessarily displayed directly as cards, but the app likely needs them in order to calculate the dashboard metrics cleanly.

| Raw input key | Source system | Segment | Use in app |
|---|---|---|---|
| `prospects` | Salesforce | overall | Follow-up conversion rates |
| `applications` | Salesforce | overall | Follow-up conversion rates |
| `processing_stage_applications` | Salesforce | overall | `processed_to_approved` |
| `approved_applications` | Salesforce | overall | `processed_to_approved`, `approved_to_confirmed` |
| `confirmed_applications` | Salesforce | overall | `approved_to_confirmed` |
| `arrived_students` | Salesforce | overall | `applications_to_arrival` |
| `estimated_prospect_calls` | Zapier | overall | direct source metric for follow-up dashboard |
| `google_ads.clicks` | GA4 / ads | google_ads | `google_ads_clicks`, `google_ads_ctr` |
| `google_ads.prospects` | Salesforce | google_ads | `google_ads_ctr`, `google_ads_prospects`, source conversion rates |
| `google_ads.applications` | Salesforce | google_ads | `google_ads_prospects_to_applications` |
| `google_ads.arrived_students` | Salesforce | google_ads | `google_ads_prospects_to_arrival` |
| `organic_website.clicks` | GA4 | organic_website | deferred |
| `organic_website.prospects` | Salesforce | organic_website | deferred |
| `organic_website.applications` | Salesforce | organic_website | deferred |
| `organic_website.arrived_students` | Salesforce | organic_website | deferred |
| `insta_ads.clicks` | GA4 / ads | insta_ads | deferred |
| `insta_ads.prospects` | Salesforce | insta_ads | deferred |
| `insta_ads.applications` | Salesforce | insta_ads | deferred |
| `insta_ads.arrived_students` | Salesforce | insta_ads | deferred |
| `lcp_ms` | Website performance | overall | deferred |
| `pingdom_speed_ms` | Website performance | overall | deferred |
| `downtime_minutes` | Website performance | overall | deferred |
| `broken_links_count` | Website crawler / SEO tool | overall | deferred |
| `ywam_rank` | SEO tool | overall | deferred |
| `dts_rank` | SEO tool | overall | deferred |
| `dts_page_sessions` | GA4 | dts_page | deferred |
| `page_sessions` | GA4 | page-specific | deferred |
| `page_clicks` | GA4 | page-specific | deferred |

## Open Items For Approval

| Item | Current draft |
|---|---|
| `approved_to_confirmed` denominator/numerator | `confirmed_applications / approved_applications` |
| What exactly counts as `confirmed_applications` | distinct stage after `Approved` |
| `estimated_prospect_calls` | send direct value from Zapier |
| Organic Website metrics | deferred until practical details are ready |
| Insta Ads metrics | deferred until practical details are ready |
| Website Health metrics | deferred until practical details are ready |
