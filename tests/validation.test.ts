import { describe, expect, it } from "vitest";

import {
  dashboardQuerySchema,
  ingestionPayloadSchema,
  targetRowSchema,
  websiteHealthReportQuerySchema,
  websiteHealthSyncRequestSchema,
  websitePageCreateSchema,
} from "@/lib/validation";

describe("ingestionPayloadSchema", () => {
  it("accepts a valid ingestion payload", () => {
    const payload = ingestionPayloadSchema.parse({
      source: "SALESFORCE",
      externalRunId: "zap-1",
      observations: [
        {
          metricKey: "prospects_to_applications",
          value: 0.42,
          timestamp: "2026-03-26T01:00:00.000Z",
          timegrain: "WEEK",
        },
      ],
    });

    expect(payload.observations).toHaveLength(1);
    expect(payload.observations[0]?.timegrain).toBe("WEEK");
  });

  it("rejects invalid timestamps", () => {
    expect(() =>
      ingestionPayloadSchema.parse({
        source: "GA4",
        externalRunId: "zap-2",
        observations: [
          {
            metricKey: "google_ads_ctr",
            value: 0.18,
            timestamp: "not-a-date",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("dashboardQuerySchema", () => {
  it("accepts weekly dashboard queries", () => {
    const query = dashboardQuerySchema.parse({
      timegrain: "WEEK",
      asOf: "2026-03-26T01:00:00.000Z",
    });

    expect(query.timegrain).toBe("WEEK");
  });
});

describe("targetRowSchema", () => {
  it("coerces numbers and allows open-ended effectiveTo", () => {
    const row = targetRowSchema.parse({
      metricKey: "website_ctr",
      targetType: "DESIRED",
      targetValue: "0.32",
      effectiveFrom: "2026-01-01",
      effectiveTo: "",
    });

    expect(row.targetValue).toBe(0.32);
    expect(row.effectiveTo).toBe("");
  });
});

describe("websiteHealthSyncRequestSchema", () => {
  it("accepts bulk sync payloads", () => {
    const payload = websiteHealthSyncRequestSchema.parse({
      pageIds: ["page-1", "page-2"],
      strategies: ["mobile", "desktop"],
      timegrains: ["WEEK", "MONTH"],
      observedAt: "2026-03-31T00:00:00.000Z",
    });

    expect(payload.pageIds).toEqual(["page-1", "page-2"]);
    expect(payload.strategies).toEqual(["mobile", "desktop"]);
    expect(payload.timegrains).toEqual(["WEEK", "MONTH"]);
  });
});

describe("websitePageCreateSchema", () => {
  it("accepts slug-style explicit keys", () => {
    const page = websitePageCreateSchema.parse({
      label: "Volunteer Page",
      url: "https://www.ywamships.org/volunteer-on-mv-ywam-png/",
      key: "volunteer_page",
    });

    expect(page.key).toBe("volunteer_page");
  });
});

describe("websiteHealthReportQuerySchema", () => {
  it("defaults to all strategies for weekly reports", () => {
    const query = websiteHealthReportQuerySchema.parse({});

    expect(query.timegrain).toBe("WEEK");
    expect(query.strategy).toBe("all");
  });
});
