import { describe, expect, it } from "vitest";

import {
  buildWebsiteHealthReportRows,
  getMetricStatusFromValue,
  mapCruxCategoryToStatus,
  normalizeClsPercentile,
  slugifyWebsitePageKey,
} from "@/lib/website-health";

describe("slugifyWebsitePageKey", () => {
  it("creates a slug-style key from labels and urls", () => {
    expect(slugifyWebsitePageKey("Volunteer on MV YWAM PNG")).toBe(
      "volunteer_on_mv_ywam_png",
    );
  });
});

describe("normalizeClsPercentile", () => {
  it("converts CrUX CLS percentiles to decimal values", () => {
    expect(normalizeClsPercentile(18)).toBe(0.18);
  });
});

describe("mapCruxCategoryToStatus", () => {
  it("maps Google CrUX labels to health statuses", () => {
    expect(mapCruxCategoryToStatus("FAST")).toBe("GOOD");
    expect(mapCruxCategoryToStatus("AVERAGE")).toBe("NEEDS_IMPROVEMENT");
    expect(mapCruxCategoryToStatus("SLOW")).toBe("POOR");
  });
});

describe("getMetricStatusFromValue", () => {
  it("applies the agreed Web Vitals thresholds", () => {
    expect(getMetricStatusFromValue("lcpMs", 2400)).toBe("GOOD");
    expect(getMetricStatusFromValue("inpMs", 300)).toBe("NEEDS_IMPROVEMENT");
    expect(getMetricStatusFromValue("cls", 0.3)).toBe("POOR");
  });
});

describe("buildWebsiteHealthReportRows", () => {
  it("returns both mobile and desktop slots for the all strategy", () => {
    const rows = buildWebsiteHealthReportRows(
      [
        {
          id: "page-1",
          key: "home",
          label: "Home",
          url: "https://www.ywamships.org/",
          isActive: true,
          sortOrder: 0,
        },
      ],
      [
        {
          websitePage: {
            id: "page-1",
            key: "home",
            label: "Home",
            url: "https://www.ywamships.org/",
            isActive: true,
            sortOrder: 0,
          },
          strategy: "MOBILE",
          pageDataScope: "PAGE",
          fetchedAt: new Date("2026-03-31T00:00:00.000Z"),
          lcpMs: 2400 as never,
          inpMs: 190 as never,
          cls: 0.08 as never,
          lcpCategory: "GOOD",
          inpCategory: "GOOD",
          clsCategory: "GOOD",
        },
        {
          websitePage: {
            id: "page-1",
            key: "home",
            label: "Home",
            url: "https://www.ywamships.org/",
            isActive: true,
            sortOrder: 0,
          },
          strategy: "DESKTOP",
          pageDataScope: "ORIGIN",
          fetchedAt: new Date("2026-03-31T00:00:00.000Z"),
          lcpMs: 4100 as never,
          inpMs: 280 as never,
          cls: 0.12 as never,
          lcpCategory: "POOR",
          inpCategory: "NEEDS_IMPROVEMENT",
          clsCategory: "NEEDS_IMPROVEMENT",
        },
      ],
      "all",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mobile?.lcpStatus).toBe("GOOD");
    expect(rows[0]?.desktop?.lcpStatus).toBe("POOR");
    expect(rows[0]?.healthSummary.status).toBe("POOR");
  });
});
