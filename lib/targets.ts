import { SourceSystem, TargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchTargetRows } from "@/lib/sheets";

export async function syncTargetsFromGoogleSheet(url: string) {
  const rows = await fetchTargetRows(url);
  const now = new Date();
  const metricKeys = [...new Set(rows.map((row) => row.metricKey))];
  const definitions = await prisma.metricDefinition.findMany({
    where: {
      key: {
        in: metricKeys,
      },
    },
    select: {
      id: true,
      key: true,
    },
  });
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition.id]));
  const targetRows = rows
    .map((row) => {
      const metricDefinitionId = definitionByKey.get(row.metricKey);
      if (!metricDefinitionId) {
        return null;
      }

      return {
        metricDefinitionId,
        targetType: row.targetType as TargetType,
        targetValue: row.targetValue,
        effectiveFrom: new Date(`${row.effectiveFrom}T00:00:00.000Z`),
        effectiveTo: row.effectiveTo ? new Date(`${row.effectiveTo}T23:59:59.999Z`) : null,
        notes: row.notes,
        sourceSystem: SourceSystem.GOOGLE_SHEETS,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (targetRows.length > 0) {
    await prisma.metricTarget.createMany({
      data: targetRows,
    });
  }

  return {
    synced: targetRows.length,
    syncedAt: now.toISOString(),
  };
}
