import type { DashboardMetricView } from "@/lib/dashboard-types";

export type MetricStatus = {
  tone: "success" | "warning" | "danger";
  label: string;
};

export function getMetricStatus(metric: DashboardMetricView): MetricStatus {
  const { latestValue, targets } = metric;
  if (latestValue === null) {
    return { tone: "warning", label: "Waiting for data" };
  }

  if (targets.desired !== null && latestValue >= targets.desired) {
    return { tone: "success", label: "Desired target hit" };
  }

  if (targets.standard !== null && latestValue >= targets.standard) {
    return { tone: "warning", label: "Tracking to standard" };
  }

  return { tone: "danger", label: "Below target" };
}
