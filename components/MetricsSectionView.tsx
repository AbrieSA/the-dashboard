import { Activity, BarChart3, Globe2, ShieldCheck } from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import type { DashboardGroupView, DashboardRuntimeStatus } from "@/lib/dashboard-types";

type MetricsSectionViewProps = {
  groups: DashboardGroupView[];
  runtimeStatus?: DashboardRuntimeStatus;
  runtimeMessage?: string | null;
  emptyTitle: string;
  emptyDescription: string;
};

function getTone(groupKey: string): "blue" | "violet" | "green" | "amber" {
  if (groupKey === "follow_up_health") return "blue";
  if (groupKey === "prospect_source_health") return "violet";
  if (groupKey === "website_health") return "green";
  return "amber";
}

function getGroupIcon(groupKey: string) {
  if (groupKey === "follow_up_health") return <Activity size={15} />;
  if (groupKey === "prospect_source_health") return <BarChart3 size={15} />;
  return <Globe2 size={15} />;
}

export function MetricsSectionView({
  groups,
  runtimeStatus = "live",
  runtimeMessage = null,
  emptyTitle,
  emptyDescription,
}: MetricsSectionViewProps) {
  const hasRuntimeError = runtimeStatus === "error";

  return (
    <section className="group-grid">
      {hasRuntimeError ? (
        <div className="empty-state">
          <ShieldCheck size={18} />
          <h2>Live data is temporarily unavailable</h2>
          <p>
            {runtimeMessage ??
              "The dashboard could not reach Supabase for this request. Refresh to retry."}
          </p>
        </div>
      ) : null}

      {!hasRuntimeError && groups.length === 0 ? (
        <div className="empty-state">
          <ShieldCheck size={18} />
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      ) : null}

      {!hasRuntimeError
        ? groups.map((group) => (
            <article className="group-card modern" key={group.key}>
              <div className="section-header">
                <div className={`section-icon tone-${getTone(group.key)}`}>{getGroupIcon(group.key)}</div>
                <div className="section-title">{group.label}</div>
                <div className="section-count">{group.metrics.length} matching</div>
              </div>
              {group.description ? <p className="group-copy">{group.description}</p> : null}
              <div className="metric-grid">
                {group.metrics.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} tone={getTone(group.key)} />
                ))}
              </div>
            </article>
          ))
        : null}
    </section>
  );
}
