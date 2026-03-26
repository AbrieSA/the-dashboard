import { SourceSystem, TargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchTargetRows } from "@/lib/sheets";

export async function syncTargetsFromGoogleSheet(url: string) {
  const rows = await fetchTargetRows(url);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    let synced = 0;

    for (const row of rows) {
      const definition = await tx.metricDefinition.findUnique({
        where: { key: row.metricKey },
      });

      if (!definition) {
        continue;
      }

      await tx.metricTarget.create({
        data: {
          metricDefinitionId: definition.id,
          targetType: row.targetType as TargetType,
          targetValue: row.targetValue,
          effectiveFrom: new Date(`${row.effectiveFrom}T00:00:00.000Z`),
          effectiveTo: row.effectiveTo ? new Date(`${row.effectiveTo}T23:59:59.999Z`) : null,
          notes: row.notes,
          sourceSystem: SourceSystem.GOOGLE_SHEETS,
        },
      });

      synced += 1;
    }

    return {
      synced,
      syncedAt: now.toISOString(),
    };
  });
}
