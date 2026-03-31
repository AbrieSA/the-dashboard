import { Prisma, SourceRunStatus, SourceSystem, Timegrain } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { DASHBOARD_CACHE_TAG } from "@/lib/deployment";
import { fetchPageSpeedSnapshot } from "@/lib/pagespeed";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteHealthExternalRunId,
  buildWebsiteHealthReportRows,
  fromWebsitePerformanceStrategy,
  getNextWebsitePageSortOrder,
  getWebsiteHealthPeriodStart,
  slugifyWebsitePageKey,
  toWebsitePerformanceStrategy,
  type WebsiteHealthReportStrategy,
  type WebsiteHealthStrategyParam,
  type WebsiteHealthTimegrain,
} from "@/lib/website-health";
import type {
  WebsiteHealthReportQuery,
  WebsiteHealthSyncRequest,
  WebsitePageCreateInput,
  WebsitePageUpdateInput,
} from "@/lib/validation";

type WebsitePageRecord = Awaited<ReturnType<typeof prisma.websitePage.findFirstOrThrow>>;

function serializeSyncPayload(input: Record<string, unknown>) {
  return input as Prisma.InputJsonValue;
}

async function upsertLegacyWebsiteSpeedObservation(args: {
  periodStart: Date;
  timegrain: WebsiteHealthTimegrain;
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
      timegrain: args.timegrain as Timegrain,
      observedAt: args.periodStart,
      segmentKey: "website_page",
      segmentValue: "home_mobile",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const data = {
    observedValue: args.lcpMs,
    observedAt: args.periodStart,
    timegrain: args.timegrain as Timegrain,
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

  return prisma.websitePage.create({
    data: {
      key,
      label: input.label,
      url: input.url,
      sortOrder,
    },
  });
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

  return prisma.websitePage.update({
    where: { id },
    data: input,
  });
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
  const timegrains = input.timegrains ?? (input.timegrain ? [input.timegrain] : ["WEEK", "MONTH"]);

  return {
    pageIds: input.pageIds,
    strategies,
    timegrains,
    observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
    notes: input.notes,
  } satisfies {
    pageIds?: string[];
    strategies: WebsiteHealthStrategyParam[];
    timegrains: WebsiteHealthTimegrain[];
    observedAt: Date;
    notes?: string;
  };
}

export async function syncWebsiteHealth(input: WebsiteHealthSyncRequest) {
  const normalized = normalizeSyncInput(input);
  const pages = await getRequestedWebsitePages(normalized.pageIds);
  const pageStrategyRequests = pages.flatMap((page) =>
    normalized.strategies.map((strategy) => ({
      page,
      strategy,
    })),
  );
  const fetchedSnapshots = await Promise.all(
    pageStrategyRequests.map(async ({ page, strategy }) => {
      try {
        const snapshot = await fetchPageSpeedSnapshot(page.url, strategy);
        return {
          page,
          strategy,
          snapshot,
          error: null,
        } as const;
      } catch (error) {
        return {
          page,
          strategy,
          snapshot: null,
          error: error instanceof Error ? error.message : "Unknown PageSpeed error.",
        } as const;
      }
    }),
  );

  const results: Array<{
    page: { id: string; key: string; label: string; url: string };
    strategy: WebsiteHealthStrategyParam;
    timegrain: WebsiteHealthTimegrain;
    periodStart: string;
    status: "created" | "updated" | "failed";
    reason?: string;
    pageDataScope?: "PAGE" | "ORIGIN";
  }> = [];

  let syncedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let successCount = 0;

  for (const { page, strategy, snapshot, error } of fetchedSnapshots) {
    if (!snapshot) {
      for (const timegrain of normalized.timegrains) {
        const periodStart = getWebsiteHealthPeriodStart(normalized.observedAt, timegrain);
        results.push({
          page: {
            id: page.id,
            key: page.key,
            label: page.label,
            url: page.url,
          },
          strategy,
          timegrain,
          periodStart: periodStart.toISOString(),
          status: "failed",
          reason: error ?? "Unknown PageSpeed error.",
        });
        failedCount += 1;
      }
      continue;
    }

    for (const timegrain of normalized.timegrains) {
      const periodStart = getWebsiteHealthPeriodStart(normalized.observedAt, timegrain);
      const externalRunId = buildWebsiteHealthExternalRunId(page.key, strategy, timegrain, periodStart);
      const strategyEnum = toWebsitePerformanceStrategy(strategy);
      const payloadJson = serializeSyncPayload({
        pageId: page.id,
        pageKey: page.key,
        pageUrl: page.url,
        strategy,
        timegrain,
        periodStart: periodStart.toISOString(),
        notes: normalized.notes,
      });
      let sourceRunId: string | null = null;

      try {
        const existingSnapshot = await prisma.websiteHealthSnapshot.findUnique({
          where: {
            websitePageId_strategy_timegrain_periodStart: {
              websitePageId: page.id,
              strategy: strategyEnum,
              timegrain: timegrain as Timegrain,
              periodStart,
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
              timegrain: timegrain as Timegrain,
              periodStart,
            },
          },
          update: {
            fetchedAt: new Date(snapshot.fetchedAt),
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
            timegrain: timegrain as Timegrain,
            periodStart,
            fetchedAt: new Date(snapshot.fetchedAt),
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
            periodStart,
            timegrain,
            lcpMs: snapshot.lcpMs,
            sourceRunId,
            rawJson: {
              pageKey: page.key,
              strategy,
              timegrain,
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
          timegrain,
          periodStart: periodStart.toISOString(),
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
          timegrain,
          periodStart: periodStart.toISOString(),
          status: "failed",
          reason,
        });
        failedCount += 1;
      }
    }
  }

  if (successCount > 0) {
    revalidateTag(DASHBOARD_CACHE_TAG, "max");
  }

  return {
    ok: successCount > 0,
    syncedCount,
    updatedCount,
    failedCount,
    results,
    statusCode: successCount > 0 ? 200 : 502,
  };
}

export async function getWebsiteHealthReport(query: WebsiteHealthReportQuery) {
  const periodStart = getWebsiteHealthPeriodStart(new Date(), query.timegrain);
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
      timegrain: query.timegrain as Timegrain,
      periodStart,
      ...strategyFilter,
    },
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

  return {
    timegrain: query.timegrain,
    periodStart: periodStart.toISOString(),
    strategy: query.strategy as WebsiteHealthReportStrategy,
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
