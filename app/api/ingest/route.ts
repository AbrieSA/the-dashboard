import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { Prisma, SourceRunStatus, Timegrain } from "@prisma/client";
import { DASHBOARD_CACHE_TAG } from "@/lib/deployment";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ingestionPayloadSchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== getEnv().INGESTION_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const payload = ingestionPayloadSchema.parse(raw);

  const existing = await prisma.sourceRun.findUnique({
    where: {
      sourceSystem_externalRunId: {
        sourceSystem: payload.source,
        externalRunId: payload.externalRunId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      sourceRunId: existing.id,
    });
  }

  const metricKeys = [...new Set(payload.observations.map((item) => item.metricKey))];
  const definitions = await prisma.metricDefinition.findMany({
    where: { key: { in: metricKeys } },
  });
  const definitionsByKey = new Map(definitions.map((item) => [item.key, item]));
  const unknownMetrics = metricKeys.filter((key) => !definitionsByKey.has(key));

  if (unknownMetrics.length > 0) {
    const failedRun = await prisma.sourceRun.create({
      data: {
        sourceSystem: payload.source,
        externalRunId: payload.externalRunId,
        status: SourceRunStatus.FAILED,
        payloadJson: raw,
        errorMessage: `Unknown metric keys: ${unknownMetrics.join(", ")}`,
      },
    });

    return NextResponse.json(
      {
        error: "Unknown metric keys in payload.",
        unknownMetrics,
        sourceRunId: failedRun.id,
      },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const sourceRun = await tx.sourceRun.create({
      data: {
        sourceSystem: payload.source,
        externalRunId: payload.externalRunId,
        status: SourceRunStatus.PENDING,
        payloadJson: raw,
      },
    });

    const created = await Promise.all(
      payload.observations.map((observation) =>
        tx.metricObservation.create({
          data: {
            metricDefinitionId: definitionsByKey.get(observation.metricKey)!.id,
            observedValue: observation.value,
            observedAt: new Date(observation.timestamp),
            timegrain: observation.timegrain as Timegrain,
            sourceSystem: payload.source,
            segmentKey: observation.segmentKey,
            segmentValue: observation.segmentValue,
            notes: observation.notes,
            metadataJson: observation.metadata as Prisma.InputJsonValue | undefined,
            sourceRunId: sourceRun.id,
          },
        }),
      ),
    );

    const completed = await tx.sourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: SourceRunStatus.SUCCEEDED,
        completedAt: new Date(),
        observationCount: created.length,
      },
    });

    return completed;
  });

  revalidateTag(DASHBOARD_CACHE_TAG, "max");

  return NextResponse.json({
    ok: true,
    sourceRunId: result.id,
    observationCount: result.observationCount,
  });
}
