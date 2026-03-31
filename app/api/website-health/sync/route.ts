import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma, SourceRunStatus, SourceSystem, Timegrain } from "@prisma/client";
import { DASHBOARD_CACHE_TAG } from "@/lib/deployment";
import { getEnv } from "@/lib/env";
import { fetchPageSpeedSnapshot } from "@/lib/pagespeed";
import { prisma } from "@/lib/prisma";
import type { DashboardTimegrain } from "@/lib/timegrain";
import { startOfTimegrain } from "@/lib/timegrain";
import { websiteHealthSyncRequestSchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

const DEFAULT_PAGESPEED_URL = "https://www.ywamships.org/";

function buildExternalRunId(url: string, strategy: string, timegrain: Timegrain, observedAt: Date) {
  const periodStart = startOfTimegrain(observedAt, timegrain as DashboardTimegrain);
  const target = new URL(url);
  return `pagespeed:${target.hostname}${target.pathname}:${strategy}:${timegrain}:${periodStart.toISOString()}`;
}

export async function POST(request: Request) {
  const env = getEnv();
  const key = request.headers.get("x-sync-key");
  const expectedKey = env.WEBSITE_HEALTH_SYNC_KEY ?? env.GOOGLE_TARGETS_SYNC_KEY;

  if (key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const payload = websiteHealthSyncRequestSchema.parse(raw);
  const targetUrl = payload.url ?? env.PAGESPEED_DEFAULT_URL ?? DEFAULT_PAGESPEED_URL;
  const observedAt = payload.observedAt ? new Date(payload.observedAt) : new Date();
  const externalRunId = buildExternalRunId(
    targetUrl,
    payload.strategy,
    payload.timegrain as Timegrain,
    observedAt,
  );

  const existing = await prisma.sourceRun.findUnique({
    where: {
      sourceSystem_externalRunId: {
        sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
        externalRunId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      sourceRunId: existing.id,
      externalRunId,
    });
  }

  const websiteSpeedDefinition = await prisma.metricDefinition.findUnique({
    where: { key: "website_speed" },
  });

  if (!websiteSpeedDefinition) {
    return NextResponse.json(
      { error: "Metric definition 'website_speed' is not configured." },
      { status: 500 },
    );
  }

  if (!websiteSpeedDefinition.isActive) {
    await prisma.metricDefinition.update({
      where: { id: websiteSpeedDefinition.id },
      data: { isActive: true },
    });
  }

  const snapshot = await fetchPageSpeedSnapshot(targetUrl, payload.strategy);
  if (snapshot.largestContentfulPaintMs === null) {
    return NextResponse.json(
      { error: "PageSpeed did not return a Largest Contentful Paint value.", snapshot },
      { status: 502 },
    );
  }
  const largestContentfulPaintMs = snapshot.largestContentfulPaintMs;

  const result = await prisma.$transaction(async (tx) => {
    const sourceRun = await tx.sourceRun.create({
      data: {
        sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
        externalRunId,
        status: SourceRunStatus.PENDING,
        payloadJson: raw as Prisma.InputJsonValue,
      },
    });

    await tx.metricObservation.create({
      data: {
        metricDefinitionId: websiteSpeedDefinition.id,
        observedValue: largestContentfulPaintMs,
        observedAt,
        timegrain: payload.timegrain as Timegrain,
        sourceSystem: SourceSystem.WEBSITE_PERFORMANCE,
        notes: payload.notes,
        metadataJson: {
          requestedUrl: snapshot.requestedUrl,
          finalUrl: snapshot.finalUrl,
          strategy: snapshot.strategy,
          fetchedAt: snapshot.fetchedAt,
          performanceScore: snapshot.performanceScore,
          largestContentfulPaintMs: snapshot.largestContentfulPaintMs,
          firstContentfulPaintMs: snapshot.firstContentfulPaintMs,
          speedIndexMs: snapshot.speedIndexMs,
          totalBlockingTimeMs: snapshot.totalBlockingTimeMs,
          cumulativeLayoutShift: snapshot.cumulativeLayoutShift,
          loadingExperienceCategory: snapshot.loadingExperienceCategory,
          originLoadingExperienceCategory: snapshot.originLoadingExperienceCategory,
        } satisfies Prisma.JsonObject,
        sourceRunId: sourceRun.id,
      },
    });

    return tx.sourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: SourceRunStatus.SUCCEEDED,
        completedAt: new Date(),
        observationCount: 1,
      },
    });
  });

  revalidateTag(DASHBOARD_CACHE_TAG, "max");

  return NextResponse.json({
    ok: true,
    sourceRunId: result.id,
    externalRunId,
    metricKey: "website_speed",
    observedValue: largestContentfulPaintMs,
    observedUnit: "milliseconds",
    strategy: snapshot.strategy,
    targetUrl: snapshot.finalUrl,
    fetchedAt: snapshot.fetchedAt,
    performanceScore: snapshot.performanceScore,
  });
}
