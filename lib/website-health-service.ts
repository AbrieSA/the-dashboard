import { Prisma, SourceRunStatus, SourceSystem, Timegrain } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  DASHBOARD_CACHE_TAG,
  WEBSITE_HEALTH_REPORT_CACHE_REVALIDATE_SECONDS,
  WEBSITE_HEALTH_REPORT_CACHE_TAG,
} from "@/lib/deployment";
import { fetchPageSpeedSnapshot } from "@/lib/pagespeed";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteHealthExternalRunId,
  buildWebsiteHealthReportRows,
  getNextWebsitePageSortOrder,
  websiteHealthCompatPeriodStart,
  websiteHealthCompatTimegrain,
  slugifyWebsitePageKey,
  toWebsitePerformanceStrategy,
  type WebsiteHealthReportStrategy,
  type WebsiteHealthStrategyParam,
} from "@/lib/website-health";
import type {
  WebsiteHealthReportQuery,
  WebsiteHealthSyncRequest,
  WebsitePageCreateInput,
  WebsitePageUpdateInput,
} from "@/lib/validation";

const PAGESPEED_FETCH_CONCURRENCY = 3;
const PAGESPEED_RETRY_ATTEMPTS = 3;
const PAGESPEED_RETRY_BASE_DELAY_MS = 700;

function serializeSyncPayload(input: Record<string, unknown>) {
  return input as Prisma.InputJsonValue;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attemptIndex: number) {
  const jitter = Math.floor(Math.random() * 200);
  return PAGESPEED_RETRY_BASE_DELAY_MS * 2 ** attemptIndex + jitter;
}

function isRetryablePageSpeedError(errorMessage: string) {
  const lowerMessage = errorMessage.toLowerCase();
  return (
    lowerMessage.includes("status 429") ||
    lowerMessage.includes("status 500") ||
    lowerMessage.includes("status 502") ||
    lowerMessage.includes("status 503") ||
    lowerMessage.includes("status 504") ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("timeout")
  );
}

async function mapWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TResult>,
) {
  const maxWorkers = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: maxWorkers }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}

let hasPrunedLegacyWebsiteHealthSnapshots = false;

async function pruneLegacyWebsiteHealthSnapshots() {
  if (hasPrunedLegacyWebsiteHealthSnapshots) {
    return 0;
  }

  const deleted = await prisma.websiteHealthSnapshot.deleteMany({
    where: {
      OR: [
        { timegrain: { not: websiteHealthCompatTimegrain } },
        { periodStart: { not: websiteHealthCompatPeriodStart } },
      ],
    },
  });

  hasPrunedLegacyWebsiteHealthSnapshots = true;
  return deleted.count;
}

type PageStrategyRequest = {
  page: {
    id: string;
    key: string;
    label: string;
    url: string;
  };
  strategy: WebsiteHealthStrategyParam;
};

async function fetchPageSpeedWithRetry({ page, strategy }: PageStrategyRequest) {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= PAGESPEED_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const snapshot = await fetchPageSpeedSnapshot(page.url, strategy);
      return {
        page,
        strategy,
        snapshot,
        error: null,
        attempts: attempt,
      } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown PageSpeed error.";
      lastError = message;
      const shouldRetry = attempt < PAGESPEED_RETRY_ATTEMPTS && isRetryablePageSpeedError(message);
      if (!shouldRetry) {
        break;
      }
      await sleep(getRetryDelayMs(attempt - 1));
    }
  }

  return {
    page,
    strategy,
    snapshot: null,
    error: lastError ?? "Unknown PageSpeed error.",
    attempts: PAGESPEED_RETRY_ATTEMPTS,
  } as const;
}

async function upsertLegacyWebsiteSpeedObservation(args: {
  observedAt: Date;
  lcpMs: number | null;
  sourceRunId: string;
  rawJson: Prisma.InputJsonValue;
}) {
  if (args.lcpMs === null) {
    return;
  }

  const metricDefinition = await prisma.metricDefinition.findUnique({
    where: { key: "website_speed" },
  });

  if (!metricDefinition) {
    return;
  }

  if (!metricDefinition.isActive) {
    await prisma.metricDefinition.update({
      where: { id: metricDefinition.id },
      data: { isActive: true },
    });
  }

  const existing = await prisma.metricObservation.findFirst({
    where: {
      metricDefinitionId: metricDefinition.id,
      sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
      segmentKey: "website_page",
      segmentValue: "home_mobile",
    },
    orderBy: {
      observedAt: "desc",
    },
  });

  const data = {
    observedValue: args.lcpMs,
    observedAt: args.observedAt,
    timegrain: Timegrain.MONTH,
    sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
    segmentKey: "website_page",
    segmentValue: "home_mobile",
    metadataJson: args.rawJson,
    sourceRunId: args.sourceRunId,
  };

  if (existing) {
    await prisma.metricObservation.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.metricObservation.create({
    data: {
      metricDefinitionId: metricDefinition.id,
      ...data,
    },
  });
}

export async function listWebsitePages() {
  return prisma.websitePage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createWebsitePage(input: WebsitePageCreateInput) {
  const sortOrder =
    input.sortOrder ??
    getNextWebsitePageSortOrder(
      (
        await prisma.websitePage.aggregate({
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? null,
    );
  const key = input.key ?? slugifyWebsitePageKey(input.label);

  const existing = await prisma.websitePage.findFirst({
    where: {
      OR: [{ key }, { url: input.url }],
    },
  });

  if (existing) {
    const conflictField = existing.key === key ? "key" : "url";
    const error = new Error(`Website page with duplicate ${conflictField}.`);
    (error as Error & { status?: number; conflictField?: string }).status = 409;
    (error as Error & { status?: number; conflictField?: string }).conflictField = conflictField;
    throw error;
  }

  const createdPage = await prisma.websitePage.create({
    data: {
      key,
      label: input.label,
      url: input.url,
      sortOrder,
    },
  });

  revalidateTag(WEBSITE_HEALTH_REPORT_CACHE_TAG, "max");
  return createdPage;
}

export async function updateWebsitePage(id: string, input: WebsitePageUpdateInput) {
  const existing = await prisma.websitePage.findUnique({
    where: { id },
  });

  if (!existing) {
    const error = new Error("Website page not found.");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  if (input.url && input.url !== existing.url) {
    const duplicateUrl = await prisma.websitePage.findFirst({
      where: {
        url: input.url,
        id: { not: id },
      },
    });

    if (duplicateUrl) {
      const error = new Error("Website page with duplicate url.");
      (error as Error & { status?: number; conflictField?: string }).status = 409;
      (error as Error & { status?: number; conflictField?: string }).conflictField = "url";
      throw error;
    }
  }

  const updatedPage = await prisma.websitePage.update({
    where: { id },
    data: input,
  });

  revalidateTag(WEBSITE_HEALTH_REPORT_CACHE_TAG, "max");
  return updatedPage;
}

async function getRequestedWebsitePages(pageIds?: string[]) {
  const pages = await prisma.websitePage.findMany({
    where: pageIds?.length
      ? {
          id: { in: pageIds },
        }
      : {
          isActive: true,
        },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (pageIds?.length) {
    const foundIds = new Set(pages.map((page) => page.id));
    const missingPageIds = pageIds.filter((pageId) => !foundIds.has(pageId));
    if (missingPageIds.length > 0) {
      const error = new Error(`Unknown website page ids: ${missingPageIds.join(", ")}`);
      (error as Error & { status?: number; missingPageIds?: string[] }).status = 400;
      (error as Error & { status?: number; missingPageIds?: string[] }).missingPageIds = missingPageIds;
      throw error;
    }
  }

  return pages;
}

function normalizeSyncInput(input: WebsiteHealthSyncRequest) {
  const strategies = input.strategies ?? (input.strategy ? [input.strategy] : ["mobile", "desktop"]);

  return {
    pageIds: input.pageIds,
    strategies,
    notes: input.notes,
  } satisfies {
    pageIds?: string[];
    strategies: WebsiteHealthStrategyParam[];
    notes?: string;
  };
}

export async function syncWebsiteHealth(input: WebsiteHealthSyncRequest) {
  const normalized = normalizeSyncInput(input);
  const cleanupDeletedCount = await pruneLegacyWebsiteHealthSnapshots();
  const pages = await getRequestedWebsitePages(normalized.pageIds);
  const pageStrategyRequests = pages.flatMap((page) =>
    normalized.strategies.map((strategy) => ({
      page,
      strategy,
    })),
  );
  const fetchedSnapshots = await mapWithConcurrency(
    pageStrategyRequests,
    PAGESPEED_FETCH_CONCURRENCY,
    fetchPageSpeedWithRetry,
  );
  const currentBucket = {
    timegrain: websiteHealthCompatTimegrain,
    periodStart: websiteHealthCompatPeriodStart,
  };

  const results: Array<{
    page: { id: string; key: string; label: string; url: string };
    strategy: WebsiteHealthStrategyParam;
    fetchedAt?: string;
    status: "created" | "updated" | "failed";
    reason?: string;
    pageDataScope?: "PAGE" | "ORIGIN";
  }> = [];

  let syncedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let successCount = 0;

  for (const { page, strategy, snapshot, error, attempts } of fetchedSnapshots) {
    if (!snapshot) {
      results.push({
        page: {
          id: page.id,
          key: page.key,
          label: page.label,
          url: page.url,
        },
        strategy,
        status: "failed",
        reason: `${error ?? "Unknown PageSpeed error."} (attempts: ${attempts})`,
      });
      failedCount += 1;
      continue;
    }

    const fetchedAt = new Date(snapshot.fetchedAt);
    const externalRunId = buildWebsiteHealthExternalRunId(page.key, strategy, fetchedAt);
    const strategyEnum = toWebsitePerformanceStrategy(strategy);
    const payloadJson = serializeSyncPayload({
      pageId: page.id,
      pageKey: page.key,
      pageUrl: page.url,
      strategy,
      fetchedAt: fetchedAt.toISOString(),
      notes: normalized.notes,
    });
    let sourceRunId: string | null = null;

    try {
      const existingSnapshot = await prisma.websiteHealthSnapshot.findUnique({
        where: {
          websitePageId_strategy_timegrain_periodStart: {
            websitePageId: page.id,
            strategy: strategyEnum,
            timegrain: currentBucket.timegrain,
            periodStart: currentBucket.periodStart,
          },
        },
      });

      const sourceRun = await prisma.sourceRun.upsert({
        where: {
          sourceSystem_externalRunId: {
            sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
            externalRunId,
          },
        },
        update: {
          status: SourceRunStatus.PENDING,
          payloadJson,
          errorMessage: null,
          completedAt: null,
        },
        create: {
          sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
          externalRunId,
          status: SourceRunStatus.PENDING,
          payloadJson,
        },
      });
      sourceRunId = sourceRun.id;

      await prisma.websiteHealthSnapshot.upsert({
        where: {
          websitePageId_strategy_timegrain_periodStart: {
            websitePageId: page.id,
            strategy: strategyEnum,
            timegrain: currentBucket.timegrain,
            periodStart: currentBucket.periodStart,
          },
        },
        update: {
          fetchedAt,
          pageDataScope: snapshot.pageDataScope,
          lcpMs: snapshot.lcpMs,
          inpMs: snapshot.inpMs,
          cls: snapshot.cls,
          lcpCategory: snapshot.lcpCategory,
          inpCategory: snapshot.inpCategory,
          clsCategory: snapshot.clsCategory,
          requestedUrl: snapshot.requestedUrl,
          finalUrl: snapshot.finalUrl,
          rawJson: snapshot.raw as Prisma.InputJsonValue,
          sourceRunId,
        },
        create: {
          websitePageId: page.id,
          strategy: strategyEnum,
          timegrain: currentBucket.timegrain,
          periodStart: currentBucket.periodStart,
          fetchedAt,
          pageDataScope: snapshot.pageDataScope,
          lcpMs: snapshot.lcpMs,
          inpMs: snapshot.inpMs,
          cls: snapshot.cls,
          lcpCategory: snapshot.lcpCategory,
          inpCategory: snapshot.inpCategory,
          clsCategory: snapshot.clsCategory,
          requestedUrl: snapshot.requestedUrl,
          finalUrl: snapshot.finalUrl,
          rawJson: snapshot.raw as Prisma.InputJsonValue,
          sourceRunId,
        },
      });

      if (page.key === "home" && strategy === "mobile") {
        await upsertLegacyWebsiteSpeedObservation({
          observedAt: fetchedAt,
          lcpMs: snapshot.lcpMs,
          sourceRunId,
          rawJson: {
            pageKey: page.key,
            strategy,
            lcpMs: snapshot.lcpMs,
            inpMs: snapshot.inpMs,
            cls: snapshot.cls,
            pageDataScope: snapshot.pageDataScope,
            raw: snapshot.raw as Prisma.InputJsonValue,
          } as Prisma.JsonObject,
        });
      }

      await prisma.sourceRun.update({
        where: { id: sourceRunId },
        data: {
          status: SourceRunStatus.SUCCEEDED,
          completedAt: new Date(),
          observationCount: 1,
          errorMessage: null,
        },
      });

      results.push({
        page: {
          id: page.id,
          key: page.key,
          label: page.label,
          url: page.url,
        },
        strategy,
        fetchedAt: fetchedAt.toISOString(),
        status: existingSnapshot ? "updated" : "created",
        pageDataScope: snapshot.pageDataScope,
      });

      if (existingSnapshot) {
        updatedCount += 1;
      } else {
        syncedCount += 1;
      }

      successCount += 1;
    } catch (error) {
      if (sourceRunId) {
        await prisma.sourceRun
          .update({
            where: { id: sourceRunId },
            data: {
              status: SourceRunStatus.FAILED,
              completedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : "Unknown sync error.",
            },
          })
          .catch(() => undefined);
      }

      const reason = error instanceof Error ? error.message : "Unknown sync error.";
      results.push({
        page: {
          id: page.id,
          key: page.key,
          label: page.label,
          url: page.url,
        },
        strategy,
        status: "failed",
        reason,
      });
      failedCount += 1;
    }
  }

  if (successCount > 0) {
    revalidateTag(DASHBOARD_CACHE_TAG, "max");
    revalidateTag(WEBSITE_HEALTH_REPORT_CACHE_TAG, "max");
  }

  return {
    ok: successCount > 0,
    syncedCount,
    updatedCount,
    failedCount,
    cleanupDeletedCount,
    results,
    statusCode: successCount > 0 ? 200 : 502,
  };
}

async function getWebsiteHealthReportUncached(query: WebsiteHealthReportQuery) {
  const pageWhere = query.pageId ? { id: query.pageId } : { isActive: true };
  const pages = await prisma.websitePage.findMany({
    where: pageWhere,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (query.pageId && pages.length === 0) {
    const error = new Error("Website page not found.");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const strategyFilter =
    query.strategy === "all"
      ? undefined
      : {
          strategy: toWebsitePerformanceStrategy(query.strategy),
        };

  const snapshots = await prisma.websiteHealthSnapshot.findMany({
    where: {
      websitePageId: { in: pages.map((page) => page.id) },
      timegrain: websiteHealthCompatTimegrain,
      periodStart: websiteHealthCompatPeriodStart,
      ...strategyFilter,
    },
    orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      websitePage: {
        select: {
          id: true,
          key: true,
          label: true,
          url: true,
          isActive: true,
          sortOrder: true,
        },
      },
    },
  });

  const capturedAt = snapshots.length > 0 ? snapshots[0]?.fetchedAt.toISOString() ?? null : null;

  return {
    strategy: query.strategy as WebsiteHealthReportStrategy,
    capturedAt,
    pages: pages.map((page) => ({
      id: page.id,
      key: page.key,
      label: page.label,
      url: page.url,
      isActive: page.isActive,
      sortOrder: page.sortOrder,
    })),
    rows: buildWebsiteHealthReportRows(
      pages.map((page) => ({
        id: page.id,
        key: page.key,
        label: page.label,
        url: page.url,
        isActive: page.isActive,
        sortOrder: page.sortOrder,
      })),
      snapshots,
      query.strategy as WebsiteHealthReportStrategy,
    ),
  };
}

const getCachedWebsiteHealthReport = unstable_cache(
  async (strategy: WebsiteHealthReportQuery["strategy"], pageId?: string) =>
    getWebsiteHealthReportUncached({ strategy, pageId }),
  [WEBSITE_HEALTH_REPORT_CACHE_TAG],
  {
    revalidate: WEBSITE_HEALTH_REPORT_CACHE_REVALIDATE_SECONDS,
    tags: [WEBSITE_HEALTH_REPORT_CACHE_TAG],
  },
);

export async function getWebsiteHealthReport(query: WebsiteHealthReportQuery) {
  return getCachedWebsiteHealthReport(query.strategy, query.pageId);
}
