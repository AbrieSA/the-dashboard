import type { WebsiteDataScope, WebsiteHealthSnapshot, WebsitePage, WebsitePerformanceStrategy } from "@prisma/client";
import { startOfTimegrain } from "@/lib/timegrain";

export const websiteHealthThresholds = {
  lcpMs: {
    good: 2500,
    poor: 4000,
  },
  inpMs: {
    good: 200,
    poor: 500,
  },
  cls: {
    good: 0.1,
    poor: 0.25,
  },
} as const;

export const websiteHealthDefaultStrategies = ["mobile", "desktop"] as const;
export const websiteHealthDefaultTimegrains = ["WEEK", "MONTH"] as const;

export type WebsiteHealthStatus = "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | "NO_DATA";
export type WebsiteMetricHealthCategory = Exclude<WebsiteHealthStatus, "NO_DATA">;
export type WebsiteHealthStrategyParam = "mobile" | "desktop";
export type WebsiteHealthReportStrategy = "all" | WebsiteHealthStrategyParam;
export type WebsiteHealthTimegrain = "WEEK" | "MONTH";

export type WebsiteHealthMetricSlot = {
  performanceScore: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  lcpStatus: WebsiteHealthStatus | null;
  inpStatus: WebsiteHealthStatus | null;
  clsStatus: WebsiteHealthStatus | null;
  pageDataScope: WebsiteDataScope;
  fetchedAt: string;
};

export type WebsiteHealthReportRow = {
  page: {
    id: string;
    key: string;
    label: string;
    url: string;
    isActive: boolean;
    sortOrder: number;
  };
  mobile: WebsiteHealthMetricSlot | null;
  desktop: WebsiteHealthMetricSlot | null;
  healthSummary: {
    status: WebsiteHealthStatus;
  };
};

export type WebsiteHealthReportPage = WebsiteHealthReportRow["page"];

export type WebsiteHealthReportResult = {
  timegrain: WebsiteHealthTimegrain;
  periodStart: string;
  strategy: WebsiteHealthReportStrategy;
  pages: WebsiteHealthReportPage[];
  rows: WebsiteHealthReportRow[];
};

type SnapshotRecord = Pick<
  WebsiteHealthSnapshot,
  | "strategy"
  | "pageDataScope"
  | "fetchedAt"
  | "rawJson"
  | "lcpMs"
  | "inpMs"
  | "cls"
  | "lcpCategory"
  | "inpCategory"
  | "clsCategory"
> & {
  websitePage: Pick<WebsitePage, "id" | "key" | "label" | "url" | "isActive" | "sortOrder">;
};

export function slugifyWebsitePageKey(input: string) {
  return input
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function getNextWebsitePageSortOrder(currentMax: number | null) {
  if (currentMax === null) {
    return 0;
  }

  return currentMax + 10;
}

export function normalizeClsPercentile(value: number | null) {
  if (value === null) {
    return null;
  }

  return value / 100;
}

export function mapCruxCategoryToStatus(
  category: string | null | undefined,
): WebsiteMetricHealthCategory | null {
  if (!category) {
    return null;
  }

  if (category === "FAST") {
    return "GOOD";
  }

  if (category === "AVERAGE") {
    return "NEEDS_IMPROVEMENT";
  }

  if (category === "SLOW") {
    return "POOR";
  }

  return null;
}

export function getMetricStatusFromValue(
  metric: "lcpMs" | "inpMs" | "cls",
  value: number | null,
): WebsiteMetricHealthCategory | null {
  if (value === null) {
    return null;
  }

  const thresholds = websiteHealthThresholds[metric];
  if (value < thresholds.good) {
    return "GOOD";
  }

  if (value <= thresholds.poor) {
    return "NEEDS_IMPROVEMENT";
  }

  return "POOR";
}

export function getPerformanceScoreFromRawJson(rawJson: unknown) {
  if (!rawJson || typeof rawJson !== "object") {
    return null;
  }

  const lighthouseResult =
    "lighthouseResult" in rawJson && rawJson.lighthouseResult && typeof rawJson.lighthouseResult === "object"
      ? rawJson.lighthouseResult
      : null;
  const categories =
    lighthouseResult &&
    "categories" in lighthouseResult &&
    lighthouseResult.categories &&
    typeof lighthouseResult.categories === "object"
      ? lighthouseResult.categories
      : null;
  const performanceCategory =
    categories &&
    "performance" in categories &&
    categories.performance &&
    typeof categories.performance === "object"
      ? categories.performance
      : null;
  const score =
    performanceCategory &&
    "score" in performanceCategory &&
    typeof performanceCategory.score === "number" &&
    Number.isFinite(performanceCategory.score)
      ? performanceCategory.score
      : null;

  if (score === null) {
    return null;
  }

  const normalizedScore = score <= 1 ? score * 100 : score;
  return Math.round(normalizedScore);
}

export function getWebsiteHealthPeriodStart(date: Date, timegrain: WebsiteHealthTimegrain) {
  return startOfTimegrain(date, timegrain);
}

export function toWebsitePerformanceStrategy(strategy: WebsiteHealthStrategyParam): WebsitePerformanceStrategy {
  return strategy === "desktop" ? "DESKTOP" : "MOBILE";
}

export function fromWebsitePerformanceStrategy(
  strategy: WebsitePerformanceStrategy,
): WebsiteHealthStrategyParam {
  return strategy === "DESKTOP" ? "desktop" : "mobile";
}

export function buildWebsiteHealthExternalRunId(
  pageKey: string,
  strategy: WebsiteHealthStrategyParam,
  timegrain: WebsiteHealthTimegrain,
  periodStart: Date,
) {
  return `pagespeed:${pageKey}:${strategy}:${timegrain}:${periodStart.toISOString()}`;
}

function statusSeverity(status: WebsiteHealthStatus) {
  if (status === "POOR") {
    return 3;
  }

  if (status === "NEEDS_IMPROVEMENT") {
    return 2;
  }

  if (status === "GOOD") {
    return 1;
  }

  return 0;
}

export function buildWebsiteHealthSlot(snapshot: SnapshotRecord): WebsiteHealthMetricSlot {
  const lcpMs = snapshot.lcpMs === null ? null : Number(snapshot.lcpMs);
  const inpMs = snapshot.inpMs === null ? null : Number(snapshot.inpMs);
  const cls = snapshot.cls === null ? null : Number(snapshot.cls);

  return {
    performanceScore: getPerformanceScoreFromRawJson(snapshot.rawJson),
    lcpMs,
    inpMs,
    cls,
    lcpStatus:
      snapshot.lcpCategory ??
      getMetricStatusFromValue("lcpMs", lcpMs),
    inpStatus:
      snapshot.inpCategory ??
      getMetricStatusFromValue("inpMs", inpMs),
    clsStatus:
      snapshot.clsCategory ??
      getMetricStatusFromValue("cls", cls),
    pageDataScope: snapshot.pageDataScope,
    fetchedAt: snapshot.fetchedAt.toISOString(),
  };
}

export function summarizeWebsiteHealthRow(
  slots: Array<WebsiteHealthMetricSlot | null>,
): WebsiteHealthStatus {
  const statuses = slots
    .flatMap((slot) =>
      slot
        ? [slot.lcpStatus, slot.inpStatus, slot.clsStatus].filter(Boolean) as WebsiteHealthStatus[]
        : [],
    );

  if (statuses.length === 0) {
    return "NO_DATA";
  }

  const worst = statuses.reduce<WebsiteHealthStatus>(
    (current, item) => (statusSeverity(item) > statusSeverity(current) ? item : current),
    "GOOD",
  );

  return worst;
}

export function buildWebsiteHealthReportRows(
  pages: Array<Pick<WebsitePage, "id" | "key" | "label" | "url" | "isActive" | "sortOrder">>,
  snapshots: SnapshotRecord[],
  strategy: WebsiteHealthReportStrategy,
) {
  const snapshotByPageAndStrategy = new Map<string, SnapshotRecord>();

  for (const snapshot of snapshots) {
    snapshotByPageAndStrategy.set(
      `${snapshot.websitePage.id}:${snapshot.strategy}`,
      snapshot,
    );
  }

  return pages.map<WebsiteHealthReportRow>((page) => {
    const mobileSnapshot = snapshotByPageAndStrategy.get(`${page.id}:MOBILE`) ?? null;
    const desktopSnapshot = snapshotByPageAndStrategy.get(`${page.id}:DESKTOP`) ?? null;
    const mobileSlot =
      strategy === "desktop" || !mobileSnapshot ? null : buildWebsiteHealthSlot(mobileSnapshot);
    const desktopSlot =
      strategy === "mobile" || !desktopSnapshot ? null : buildWebsiteHealthSlot(desktopSnapshot);

    return {
      page,
      mobile: mobileSlot,
      desktop: desktopSlot,
      healthSummary: {
        status: summarizeWebsiteHealthRow([mobileSlot, desktopSlot]),
      },
    };
  });
}
