import { describe, expect, it } from "vitest";

import { formatDelta, formatMetricValue } from "@/lib/format";

describe("formatMetricValue", () => {
  it("formats percentages", () => {
    expect(formatMetricValue(0.42, "percentage")).toBe("42.0%");
  });

  it("formats missing data", () => {
    expect(formatMetricValue(null, "count")).toBe("No data");
  });
});

describe("formatDelta", () => {
  it("formats percentage deltas", () => {
    expect(formatDelta(0.05, "percentage")).toBe("+5.0 pts");
  });
});
