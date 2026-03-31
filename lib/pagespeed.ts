import { getEnv } from "@/lib/env";

export type PageSpeedStrategy = "mobile" | "desktop";

export type PageSpeedSnapshot = {
  requestedUrl: string;
  finalUrl: string;
  strategy: PageSpeedStrategy;
  fetchedAt: string;
  performanceScore: number | null;
  largestContentfulPaintMs: number | null;
  firstContentfulPaintMs: number | null;
  speedIndexMs: number | null;
  totalBlockingTimeMs: number | null;
  cumulativeLayoutShift: number | null;
  loadingExperienceCategory: string | null;
  originLoadingExperienceCategory: string | null;
  raw: unknown;
};

type LighthouseAudit = {
  numericValue?: number;
  displayValue?: string;
};

type PageSpeedResponse = {
  id?: string;
  analysisUTCTimestamp?: string;
  loadingExperience?: {
    overall_category?: string;
  };
  originLoadingExperience?: {
    overall_category?: string;
  };
  lighthouseResult?: {
    requestedUrl?: string;
    finalUrl?: string;
    fetchTime?: string;
    audits?: Record<string, LighthouseAudit | undefined>;
    categories?: {
      performance?: {
        score?: number;
      };
    };
    runtimeError?: {
      code?: string;
      message?: string;
    };
  };
};

function getAuditNumericValue(
  audits: Record<string, LighthouseAudit | undefined> | undefined,
  key: string,
) {
  const value = audits?.[key]?.numericValue;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function fetchPageSpeedSnapshot(
  targetUrl: string,
  strategy: PageSpeedStrategy = "mobile",
): Promise<PageSpeedSnapshot> {
  const env = getEnv();
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("strategy", strategy);
  url.searchParams.set("category", "performance");

  if (env.PAGESPEED_API_KEY) {
    url.searchParams.set("key", env.PAGESPEED_API_KEY);
  }

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
        "PageSpeed request failed with status 429. Configure PAGESPEED_API_KEY for automated website-health syncs.",
      );
    }

    throw new Error(`PageSpeed request failed with status ${response.status}`);
  }

  const json = (await response.json()) as PageSpeedResponse;
  const runtimeError = json.lighthouseResult?.runtimeError;
  if (runtimeError?.message) {
    throw new Error(`PageSpeed runtime error: ${runtimeError.message}`);
  }

  const audits = json.lighthouseResult?.audits;
  const performanceScore = json.lighthouseResult?.categories?.performance?.score;

  return {
    requestedUrl: json.lighthouseResult?.requestedUrl ?? targetUrl,
    finalUrl: json.lighthouseResult?.finalUrl ?? json.id ?? targetUrl,
    strategy,
    fetchedAt:
      json.lighthouseResult?.fetchTime ?? json.analysisUTCTimestamp ?? new Date().toISOString(),
    performanceScore:
      typeof performanceScore === "number" && Number.isFinite(performanceScore)
        ? performanceScore * 100
        : null,
    largestContentfulPaintMs: getAuditNumericValue(audits, "largest-contentful-paint"),
    firstContentfulPaintMs: getAuditNumericValue(audits, "first-contentful-paint"),
    speedIndexMs: getAuditNumericValue(audits, "speed-index"),
    totalBlockingTimeMs: getAuditNumericValue(audits, "total-blocking-time"),
    cumulativeLayoutShift: getAuditNumericValue(audits, "cumulative-layout-shift"),
    loadingExperienceCategory: json.loadingExperience?.overall_category ?? null,
    originLoadingExperienceCategory: json.originLoadingExperience?.overall_category ?? null,
    raw: json,
  };
}
