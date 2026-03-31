import { Activity, ArrowDownRight, ArrowUpRight, Gauge, Minus, Target } from "lucide-react";

import { TrendChart } from "@/components/TrendChart";
import type { DashboardMetricView } from "@/lib/dashboard-types";
import { formatDelta, formatMetricValue } from "@/lib/format";
import { getMetricStatus } from "@/lib/metric-status";

type MetricCardProps = {
  tone: "blue" | "violet" | "green" | "amber";
  metric: DashboardMetricView;
  onSelect?: () => void;
  selected?: boolean;
  mode?: "simple" | "detailed";
};

export function MetricCard({ metric, tone, onSelect, selected = false, mode = "detailed" }: MetricCardProps) {
  const status = getMetricStatus(metric);
  const StatusIcon =
    status.tone === "success"
      ? ArrowUpRight
      : status.tone === "danger"
        ? ArrowDownRight
        : metric.latestValue === null
          ? Minus
          : ArrowUpRight;
  const CardIcon = tone === "green" ? Target : tone === "amber" ? Gauge : Activity;
  const isSimple = mode === "simple";

  const content = (
    <>
      <div className="metric-top">
        <div>
          <div className="metric-label">{metric.category}</div>
          <h3 className="metric-title">{metric.label}</h3>
        </div>
        <div className={`metric-icon tone-${tone}`}>
          <CardIcon size={18} />
        </div>
      </div>

      <div>
        <div className="metric-value">
          <strong>{formatMetricValue(metric.latestValue, metric.unit)}</strong>
          <span className="metric-subvalue">{metric.subcategory ?? "Core metric"}</span>
        </div>
        {!isSimple ? (
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
            {metric.latestObservedAt
              ? `Latest update ${new Date(metric.latestObservedAt).toLocaleString()}`
              : "No observations loaded yet"}
          </p>
        ) : null}
      </div>

      <span className={`status ${status.tone}`}>
        <StatusIcon size={16} />
        {status.label} · {formatDelta(metric.delta, metric.unit)}
      </span>

      {!isSimple ? <TrendChart data={metric.sparkline} /> : null}

      {!isSimple ? (
        <div className="target-stack">
          <div className="target-row">
            <span>Current</span>
            <span>{formatMetricValue(metric.targets.current, metric.unit)}</span>
          </div>
          <div className="target-row">
            <span>Standard</span>
            <span>{formatMetricValue(metric.targets.standard, metric.unit)}</span>
          </div>
          <div className="target-row">
            <span>Desired</span>
            <span>{formatMetricValue(metric.targets.desired, metric.unit)}</span>
          </div>
        </div>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={`metric-card metric-button tone-${tone} ${selected ? "is-selected" : ""}`}
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return <article className={`metric-card tone-${tone}`}>{content}</article>;
}
