import type { DashboardTimegrain } from "@/lib/timegrain";
import { getBucketKey, getBucketLabel } from "@/lib/timegrain";

type ObservationPoint = {
  observedAt: Date;
  observedValue: number;
  timegrain: DashboardTimegrain;
};

type MetricRange = {
  start: Date;
  end: Date;
};

type CalculationContext = {
  timegrain: DashboardTimegrain;
  currentRange: MetricRange;
};

type MetricCalculation = {
  dependencies: string[];
  calculate: (inputs: Record<string, number | null>) => number | null;
};

const ratio = (numerator: number | null, denominator: number | null) => {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
};

const direct = (metricKey: string): MetricCalculation => ({
  dependencies: [metricKey],
  calculate: (inputs) => inputs[metricKey] ?? null,
});

export const metricCalculations: Record<string, MetricCalculation> = {
  prospects_to_applications: {
    dependencies: ["follow_up_prospects", "follow_up_applications"],
    calculate: (inputs) => ratio(inputs.follow_up_applications, inputs.follow_up_prospects),
  },
  estimated_prospect_calls: direct("estimated_prospect_calls"),
  processed_to_approved: {
    dependencies: ["follow_up_processing_applications", "follow_up_approved_applications"],
    calculate: (inputs) =>
      ratio(inputs.follow_up_approved_applications, inputs.follow_up_processing_applications),
  },
  approved_to_confirmed: {
    dependencies: ["follow_up_approved_applications", "follow_up_confirmed_applications"],
    calculate: (inputs) =>
      ratio(inputs.follow_up_confirmed_applications, inputs.follow_up_approved_applications),
  },
  applications_to_arrival: {
    dependencies: ["follow_up_applications", "follow_up_arrived_students"],
    calculate: (inputs) => ratio(inputs.follow_up_arrived_students, inputs.follow_up_applications),
  },
  google_ads_clicks: direct("google_ads_clicks"),
  google_ads_ctr: {
    dependencies: ["google_ads_clicks", "google_ads_prospects"],
    calculate: (inputs) => ratio(inputs.google_ads_prospects, inputs.google_ads_clicks),
  },
  google_ads_prospects: direct("google_ads_prospects"),
  google_ads_prospects_to_applications: {
    dependencies: ["google_ads_prospects", "google_ads_applications"],
    calculate: (inputs) => ratio(inputs.google_ads_applications, inputs.google_ads_prospects),
  },
  google_ads_prospects_to_arrival: {
    dependencies: ["google_ads_prospects", "google_ads_arrived_students"],
    calculate: (inputs) => ratio(inputs.google_ads_arrived_students, inputs.google_ads_prospects),
  },
};

export function getCalculationDependencyKeys(metricKeys: string[]) {
  const keys = new Set<string>();

  for (const metricKey of metricKeys) {
    keys.add(metricKey);

    const calculation = metricCalculations[metricKey];
    if (!calculation) {
      continue;
    }

    for (const dependency of calculation.dependencies) {
      keys.add(dependency);
    }
  }

  return [...keys];
}

export function filterObservationsForTimegrain(
  observations: ObservationPoint[] = [],
  timegrain: DashboardTimegrain,
  range: MetricRange,
) {
  return observations.filter(
    (observation) =>
      observation.timegrain === timegrain &&
      observation.observedAt >= range.start &&
      observation.observedAt < range.end,
  );
}

export function getLatestObservation(observations: ObservationPoint[] = []) {
  if (observations.length === 0) {
    return null;
  }

  return observations.reduce((latest, item) =>
    item.observedAt > latest.observedAt ? item : latest,
  );
}

function calculateForInputs(metricKey: string, inputs: Record<string, number | null>) {
  const calculation = metricCalculations[metricKey];
  if (!calculation) {
    return inputs[metricKey] ?? null;
  }

  return calculation.calculate(inputs);
}

export function calculateMetricValue(
  metricKey: string,
  observationsByKey: Map<string, ObservationPoint[]>,
  timegrain: DashboardTimegrain,
  range: MetricRange,
) {
  const calculation = metricCalculations[metricKey];
  const dependencyKeys = calculation?.dependencies ?? [metricKey];
  const inputs: Record<string, number | null> = {};
  const timestamps: Date[] = [];

  for (const dependencyKey of dependencyKeys) {
    const latest = getLatestObservation(
      filterObservationsForTimegrain(observationsByKey.get(dependencyKey), timegrain, range),
    );
    inputs[dependencyKey] = latest?.observedValue ?? null;
    if (latest) {
      timestamps.push(latest.observedAt);
    }
  }

  const value = calculateForInputs(metricKey, inputs);
  const latestObservedAt =
    timestamps.length > 0
      ? timestamps.reduce((latest, item) => (item > latest ? item : latest)).toISOString()
      : null;

  return { value, latestObservedAt };
}

export function buildMetricSparkline(
  metricKey: string,
  observationsByKey: Map<string, ObservationPoint[]>,
  context: CalculationContext,
) {
  const calculation = metricCalculations[metricKey];
  const dependencyKeys = calculation?.dependencies ?? [metricKey];
  const buckets = new Map<
    string,
    {
      label: string;
      values: Record<string, number>;
    }
  >();

  for (const dependencyKey of dependencyKeys) {
    const observations = filterObservationsForTimegrain(
      observationsByKey.get(dependencyKey),
      context.timegrain,
      context.currentRange,
    );

    for (const observation of observations) {
      const bucketKey = getBucketKey(observation.observedAt, context.timegrain);
      const existing = buckets.get(bucketKey) ?? {
        label: getBucketLabel(observation.observedAt, context.timegrain),
        values: {},
      };

      existing.values[dependencyKey] = observation.observedValue;
      buckets.set(bucketKey, existing);
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, bucket]) => ({
      label: bucket.label,
      value: calculateForInputs(metricKey, bucket.values),
    }))
    .filter((item) => item.value !== null) as Array<{ label: string; value: number }>;
}
