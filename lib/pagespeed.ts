import { getEnv } from "@/lib/env";
import {
  getMetricStatusFromValue,
  mapCruxCategoryToStatus,
  normalizeClsPercentile,
  type WebsiteMetricHealthCategory,
  type WebsiteHealthStrategyParam,
} from "@/lib/website-health";

export type PageSpeedMetricSnapshot = {
  value: number | null;
  status: WebsiteMetricHealthCategory | null;
  source: "PAGE" | "ORIGIN" | null;
};

export type PageSpeedVitalsSnapshot = {
  requestedUrl: string;
  finalUrl: string;
  strategy: WebsiteHealthStrategyParam;
  fetchedAt: string;
  pageDataScope: "PAGE" | "ORIGIN";
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  lcpCategory: WebsiteMetricHealthCategory | null;
  inpCategory: WebsiteMetricHealthCategory | null;
  clsCategory: WebsiteMetricHealthCategory | null;
  raw: unknown;
};

type CruxMetric = {
  percentile?: number;
  category?: string;
};

type PageSpeedResponse = {
  id?: string;
  analysisUTCTimestamp?: string;
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, CruxMetric | undefined>;
  };
  originLoadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, CruxMetric | undefined>;
  };
  lighthouseResult?: {
    requestedUrl?: string;
    finalUrl?: string;
    fetchTime?: string;
    runtimeError?: {
      code?: string;
      message?: string;
    };
  };
};

function getPercentileMetric(
  pageMetrics: Record<string, CruxMetric | undefined> | undefined,
  originMetrics: Record<string, CruxMetric | undefined> | undefined,
  key: string,
  transform?: (value: number | null) => number | null,
): PageSpeedMetricSnapshot {
  const pageMetric = pageMetrics?.[key];
  const originMetric = originMetrics?.[key];
  const sourceMetric = pageMetric?.percentile !== undefined ? pageMetric : originMetric;
  const source = pageMetric?.percentile !== undefined ? "PAGE" : originMetric?.percentile !== undefined ? "ORIGIN" : null;
  const rawValue =
    typeof sourceMetric?.percentile === "number" && Number.isFinite(sourceMetric.percentile)
      ? sourceMetric.percentile
      : null;
  const value = transform ? transform(rawValue) : rawValue;
  const status =
    mapCruxCategoryToStatus(sourceMetric?.category) ??
    (key === "LARGEST_CONTENTFUL_PAINT_MS"
      ? getMetricStatusFromValue("lcpMs", value)
      : key === "INTERACTION_TO_NEXT_PAINT"
        ? getMetricStatusFromValue("inpMs", value)
        : getMetricStatusFromValue("cls", value));

  return {
    value,
    status,
    source,
  };
}

export async function fetchPageSpeedSnapshot(
  targetUrl: string,
  strategy: WebsiteHealthStrategyParam = "mobile",
): Promise<PageSpeedVitalsSnapshot> {
  const env = getEnv();
  if (!env.PAGESPEED_API_KEY) {
    throw new Error("PAGESPEED_API_KEY is required for website-health sync.");
  }

  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("strategy", strategy);
  url.searchParams.set("category", "performance");
  url.searchParams.set("key", env.PAGESPEED_API_KEY);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "PageSpeed request failed with status 429. PAGESPEED_API_KEY is configured, but the project is being rate limited.",
      );
    }

    throw new Error(`PageSpeed request failed with status ${response.status}`);
  }

  const json = (await response.json()) as PageSpeedResponse;
  const runtimeError = json.lighthouseResult?.runtimeError;
  if (runtimeError?.message) {
    throw new Error(`PageSpeed runtime error: ${runtimeError.message}`);
  }

  const pageMetrics = json.loadingExperience?.metrics;
  const originMetrics = json.originLoadingExperience?.metrics;
  const lcp = getPercentileMetric(pageMetrics, originMetrics, "LARGEST_CONTENTFUL_PAINT_MS");
  const inp = getPercentileMetric(pageMetrics, originMetrics, "INTERACTION_TO_NEXT_PAINT");
  const cls = getPercentileMetric(
    pageMetrics,
    originMetrics,
    "CUMULATIVE_LAYOUT_SHIFT_SCORE",
    normalizeClsPercentile,
  );

  const pageDataScope =
    lcp.source === "PAGE" && inp.source === "PAGE" && cls.source === "PAGE" ? "PAGE" : "ORIGIN";

  return {
    requestedUrl: json.lighthouseResult?.requestedUrl ?? targetUrl,
    finalUrl: json.lighthouseResult?.finalUrl ?? json.id ?? targetUrl,
    strategy,
    fetchedAt:
      json.lighthouseResult?.fetchTime ?? json.analysisUTCTimestamp ?? new Date().toISOString(),
    pageDataScope,
    lcpMs: lcp.value,
    inpMs: inp.value,
    cls: cls.value,
    lcpCategory: lcp.status,
    inpCategory: inp.status,
    clsCategory: cls.status,
    raw: json,
  };
}
