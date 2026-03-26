import { PrismaClient, SourceSystem } from "@prisma/client";

const prisma = new PrismaClient();

const legacyMetricKeyRenames = [["google_ads_leads", "google_ads_prospects"]] as const;
const activeMetricKeys = new Set([
  "prospects_to_applications",
  "estimated_prospect_calls",
  "processed_to_approved",
  "approved_to_confirmed",
  "applications_to_arrival",
  "google_ads_clicks",
  "google_ads_ctr",
  "google_ads_prospects",
  "google_ads_prospects_to_applications",
  "google_ads_prospects_to_arrival",
]);

const groups = [
  {
    key: "follow_up_health",
    label: "Follow Up Health",
    description: "Lead funnel performance for applications and arrivals.",
    sortOrder: 0,
  },
  {
    key: "prospect_source_health",
    label: "Prospect Source Health",
    description: "Channel-level source quality and conversion metrics.",
    sortOrder: 1,
  },
  {
    key: "website_health",
    label: "Website Health",
    description: "Website speed, uptime, SEO, and activity metrics.",
    sortOrder: 2,
  },
];

const definitions = [
  ["prospects_to_applications", "Prospects > Applications", "follow_up_health", SourceSystem.SALESFORCE, "percentage", "Follow-up", undefined, undefined, 0],
  ["estimated_prospect_calls", "Est. Prospect Calls", "follow_up_health", SourceSystem.SALESFORCE, "count", "Follow-up", undefined, undefined, 1],
  ["processed_to_approved", "Procc > Appr", "follow_up_health", SourceSystem.SALESFORCE, "percentage", "Follow-up", undefined, undefined, 2],
  ["approved_to_confirmed", "Appr > Conf", "follow_up_health", SourceSystem.SALESFORCE, "percentage", "Follow-up", undefined, undefined, 3],
  ["applications_to_arrival", "App > Arrival", "follow_up_health", SourceSystem.SALESFORCE, "percentage", "Follow-up", undefined, undefined, 4],
  ["google_ads_clicks", "Clicks", "prospect_source_health", SourceSystem.GA4, "count", "Google Ads", "Traffic", "google_ads", 10],
  ["google_ads_ctr", "CTR", "prospect_source_health", SourceSystem.GA4, "percentage", "Google Ads", "Traffic", "google_ads", 11],
  ["google_ads_prospects", "Prospects", "prospect_source_health", SourceSystem.SALESFORCE, "count", "Google Ads", "Prospects", "google_ads", 12],
  ["google_ads_prospects_to_applications", "Prosp > App", "prospect_source_health", SourceSystem.SALESFORCE, "percentage", "Google Ads", "Conversions", "google_ads", 13],
  ["google_ads_prospects_to_arrival", "Prosp > Arrival", "prospect_source_health", SourceSystem.SALESFORCE, "percentage", "Google Ads", "Conversions", "google_ads", 14],
  ["organic_clicks", "Clicks", "prospect_source_health", SourceSystem.GA4, "count", "Organic Website", "Traffic", "organic_website", 20],
  ["organic_ctr", "CTR", "prospect_source_health", SourceSystem.GA4, "percentage", "Organic Website", "Traffic", "organic_website", 21],
  ["organic_leads", "Prospects", "prospect_source_health", SourceSystem.SALESFORCE, "count", "Organic Website", "Prospects", "organic_website", 22],
  ["organic_prospects_to_applications", "Prosp > App", "prospect_source_health", SourceSystem.SALESFORCE, "percentage", "Organic Website", "Conversions", "organic_website", 23],
  ["organic_prospects_to_arrival", "Prosp > Arrival", "prospect_source_health", SourceSystem.SALESFORCE, "percentage", "Organic Website", "Conversions", "organic_website", 24],
  ["insta_ads_clicks", "Clicks", "prospect_source_health", SourceSystem.GA4, "count", "Insta Ads", "Traffic", "insta_ads", 30],
  ["insta_ads_ctr", "CTR", "prospect_source_health", SourceSystem.GA4, "percentage", "Insta Ads", "Traffic", "insta_ads", 31],
  ["insta_ads_leads", "Prospects", "prospect_source_health", SourceSystem.SALESFORCE, "count", "Insta Ads", "Prospects", "insta_ads", 32],
  ["insta_ads_prospects_to_applications", "Prosp > App", "prospect_source_health", SourceSystem.SALESFORCE, "percentage", "Insta Ads", "Conversions", "insta_ads", 33],
  ["insta_ads_prospects_to_arrival", "Prosp > Arrival", "prospect_source_health", SourceSystem.SALESFORCE, "percentage", "Insta Ads", "Conversions", "insta_ads", 34],
  ["website_speed", "Website Speed", "website_health", SourceSystem.WEBSITE_PERFORMANCE, "milliseconds", "Performance", undefined, undefined, 40],
  ["website_downtime", "Website Downtime", "website_health", SourceSystem.WEBSITE_PERFORMANCE, "percentage", "Performance", undefined, undefined, 41],
  ["broken_links", "Broken Links", "website_health", SourceSystem.WEBSITE_PERFORMANCE, "count", "Performance", undefined, undefined, 42],
  ["ywam_rank", "YWAM", "website_health", SourceSystem.GA4, "rank", "SEO Ranking", undefined, undefined, 43],
  ["dts_rank", "DTS", "website_health", SourceSystem.GA4, "rank", "SEO Ranking", undefined, undefined, 44],
  ["dts_sessions", "DTS Sessions", "website_health", SourceSystem.GA4, "count", "Activity", undefined, undefined, 45],
  ["website_ctr", "CTR", "website_health", SourceSystem.GA4, "percentage", "Activity", undefined, undefined, 46],
  ["follow_up_prospects", "Prospects (Raw)", "follow_up_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Follow-up", undefined, 100],
  ["follow_up_applications", "Applications (Raw)", "follow_up_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Follow-up", undefined, 101],
  ["follow_up_processing_applications", "Processing Applications (Raw)", "follow_up_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Follow-up", undefined, 102],
  ["follow_up_approved_applications", "Approved Applications (Raw)", "follow_up_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Follow-up", undefined, 103],
  ["follow_up_confirmed_applications", "Confirmed Applications (Raw)", "follow_up_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Follow-up", undefined, 104],
  ["follow_up_arrived_students", "Arrived Students (Raw)", "follow_up_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Follow-up", undefined, 105],
  ["google_ads_applications", "Applications (Raw)", "prospect_source_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Google Ads", "google_ads", 106],
  ["google_ads_arrived_students", "Arrived Students (Raw)", "prospect_source_health", SourceSystem.SALESFORCE, "count", "Raw Inputs", "Google Ads", "google_ads", 107],
] as const;

async function main() {
  for (const [fromKey, toKey] of legacyMetricKeyRenames) {
    const existingLegacy = await prisma.metricDefinition.findUnique({
      where: { key: fromKey },
    });
    const existingNew = await prisma.metricDefinition.findUnique({
      where: { key: toKey },
    });

    if (existingLegacy && !existingNew) {
      await prisma.metricDefinition.update({
        where: { id: existingLegacy.id },
        data: { key: toKey },
      });
    }
  }

  for (const group of groups) {
    await prisma.dashboardGroup.upsert({
      where: { key: group.key },
      update: group,
      create: group,
    });
  }

  for (const [key, label, groupKey, sourceSystem, unit, category, subcategory, segment, sortOrder] of definitions) {
    const dashboardGroup = await prisma.dashboardGroup.findUniqueOrThrow({
      where: { key: groupKey },
    });

    await prisma.metricDefinition.upsert({
      where: { key },
      update: {
        label,
        sourceSystem,
        unit,
        category,
        subcategory,
        segment,
        sortOrder,
        isActive: activeMetricKeys.has(key),
        dashboardGroupId: dashboardGroup.id,
      },
      create: {
        key,
        label,
        sourceSystem,
        unit,
        category,
        subcategory,
        segment,
        sortOrder,
        isActive: activeMetricKeys.has(key),
        dashboardGroupId: dashboardGroup.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
