export type DashboardMetricView = {
  key: string;
  label: string;
  unit: string;
  category: string;
  subcategory: string | null;
  segment: string | null;
  sourceSystem: string;
  latestValue: number | null;
  latestObservedAt: string | null;
  priorValue: number | null;
  delta: number | null;
  targets: {
    current: number | null;
    standard: number | null;
    desired: number | null;
  };
  sparkline: Array<{ label: string; value: number }>;
};

export type DashboardGroupView = {
  key: string;
  label: string;
  description: string | null;
  metrics: DashboardMetricView[];
};

export type DashboardRuntimeStatus = "live" | "error";
