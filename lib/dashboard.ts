import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DashboardGroupView } from "@/lib/dashboard-types";
import {
  buildMetricSparkline,
  calculateMetricValue,
  getCalculationDependencyKeys,
} from "@/lib/metric-calculations";
import { type DashboardTimegrain, getTimeWindow } from "@/lib/timegrain";
import { DashboardQuery } from "@/lib/validation";

type ObservationPoint = {
  observedAt: Date;
  observedValue: number;
  timegrain: DashboardTimegrain;
};

function decimalToNumber(value: Prisma.Decimal | null) {
  return value ? Number(value) : null;
}

async function getActiveTargets(metricDefinitionId: string, end: Date) {
  const targets = await prisma.metricTarget.findMany({
    where: {
      metricDefinitionId,
      effectiveFrom: { lte: end },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  return {
    current: decimalToNumber(targets.find((item) => item.targetType === "CURRENT")?.targetValue ?? null),
    standard: decimalToNumber(targets.find((item) => item.targetType === "STANDARD")?.targetValue ?? null),
    desired: decimalToNumber(targets.find((item) => item.targetType === "DESIRED")?.targetValue ?? null),
  };
}

function buildObservationsByKey(
  definitions: Array<{
    key: string;
    observations: Array<{
      observedAt: Date;
      observedValue: Prisma.Decimal;
      timegrain: DashboardTimegrain;
    }>;
  }>,
) {
  return new Map<string, ObservationPoint[]>(
    definitions.map((definition) => [
      definition.key,
      definition.observations.map((observation) => ({
        observedAt: observation.observedAt,
        observedValue: Number(observation.observedValue),
        timegrain: observation.timegrain,
      })),
    ]),
  );
}

export async function getDashboardSnapshot(query: DashboardQuery): Promise<DashboardGroupView[]> {
  const window = getTimeWindow(query.timegrain, query.asOf);
  const groups = await prisma.dashboardGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      metrics: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const activeMetricKeys = groups.flatMap((group) => group.metrics.map((metric) => metric.key));
  const dependencyKeys = getCalculationDependencyKeys(activeMetricKeys);

  const sourceDefinitions = await prisma.metricDefinition.findMany({
    where: { key: { in: dependencyKeys } },
    include: {
      observations: {
        where: {
          observedAt: {
            gte: window.previousStart,
            lte: window.currentEnd,
          },
        },
        orderBy: {
          observedAt: "asc",
        },
      },
    },
  });

  const observationsByKey = buildObservationsByKey(sourceDefinitions);

  return Promise.all(
    groups.map(async (group) => ({
      key: group.key,
      label: group.label,
      description: group.description,
      metrics: await Promise.all(
        group.metrics.map(async (metric) => {
          const current = calculateMetricValue(metric.key, observationsByKey, query.timegrain, {
            start: window.currentStart,
            end: new Date(window.currentEnd.getTime() + 1),
          });
          const previous = calculateMetricValue(metric.key, observationsByKey, query.timegrain, {
            start: window.previousStart,
            end: window.previousEnd,
          });
          const targets = await getActiveTargets(metric.id, window.currentEnd);

          return {
            key: metric.key,
            label: metric.label,
            unit: metric.unit,
            category: metric.category,
            subcategory: metric.subcategory,
            segment: metric.segment,
            sourceSystem: metric.sourceSystem,
            latestValue: current.value,
            latestObservedAt: current.latestObservedAt,
            priorValue: previous.value,
            delta:
              current.value !== null && previous.value !== null ? current.value - previous.value : null,
            targets,
            sparkline: buildMetricSparkline(metric.key, observationsByKey, {
              timegrain: query.timegrain,
              currentRange: {
                start: window.currentStart,
                end: new Date(window.currentEnd.getTime() + 1),
              },
            }),
          };
        }),
      ),
    })),
  );
}
