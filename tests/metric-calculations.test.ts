import { describe, expect, it } from "vitest";

import {
  buildMetricSparkline,
  calculateMetricValue,
  getCalculationDependencyKeys,
} from "@/lib/metric-calculations";

function createMap(entries: Array<[string, Array<{ observedAt: Date; observedValue: number; timegrain: "WEEK" | "MONTH" | "YEAR" }>]>){
  return new Map(entries);
}

describe("getCalculationDependencyKeys", () => {
  it("includes raw dependencies for calculated metrics", () => {
    expect(getCalculationDependencyKeys(["prospects_to_applications"])).toEqual(
      expect.arrayContaining(["prospects_to_applications", "follow_up_prospects", "follow_up_applications"]),
    );
  });
});

describe("calculateMetricValue", () => {
  it("calculates follow-up ratios from raw weekly inputs", () => {
    const observationsByKey = createMap([
      [
        "follow_up_prospects",
        [{ observedAt: new Date("2026-03-24T00:00:00.000Z"), observedValue: 20, timegrain: "WEEK" }],
      ],
      [
        "follow_up_applications",
        [{ observedAt: new Date("2026-03-24T00:00:00.000Z"), observedValue: 5, timegrain: "WEEK" }],
      ],
    ]);

    const result = calculateMetricValue("prospects_to_applications", observationsByKey, "WEEK", {
      start: new Date("2026-03-23T00:00:00.000Z"),
      end: new Date("2026-03-30T00:00:00.000Z"),
    });

    expect(result.value).toBe(0.25);
  });

  it("passes through direct source metrics", () => {
    const observationsByKey = createMap([
      [
        "estimated_prospect_calls",
        [{ observedAt: new Date("2026-03-24T00:00:00.000Z"), observedValue: 17, timegrain: "MONTH" }],
      ],
    ]);

    const result = calculateMetricValue("estimated_prospect_calls", observationsByKey, "MONTH", {
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(result.value).toBe(17);
  });
});

describe("buildMetricSparkline", () => {
  it("builds ratio sparkline points from raw Google Ads observations", () => {
    const observationsByKey = createMap([
      [
        "google_ads_clicks",
        [
          { observedAt: new Date("2026-03-10T00:00:00.000Z"), observedValue: 100, timegrain: "MONTH" },
          { observedAt: new Date("2026-03-11T00:00:00.000Z"), observedValue: 120, timegrain: "MONTH" },
        ],
      ],
      [
        "google_ads_prospects",
        [
          { observedAt: new Date("2026-03-10T00:00:00.000Z"), observedValue: 15, timegrain: "MONTH" },
          { observedAt: new Date("2026-03-11T00:00:00.000Z"), observedValue: 18, timegrain: "MONTH" },
        ],
      ],
    ]);

    const sparkline = buildMetricSparkline("google_ads_ctr", observationsByKey, {
      timegrain: "MONTH",
      currentRange: {
        start: new Date("2026-03-01T00:00:00.000Z"),
        end: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    expect(sparkline).toHaveLength(2);
    expect(sparkline[0]?.value).toBe(0.15);
    expect(sparkline[1]?.value).toBe(0.15);
  });
});
