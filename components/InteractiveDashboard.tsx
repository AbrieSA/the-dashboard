"use client";

import { startTransition, useDeferredValue, useState } from "react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Filter,
  Globe2,
  Search,
  ShieldCheck,
} from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import type { DashboardGroupView, DashboardMetricView } from "@/lib/dashboard-types";
import { formatDelta, formatMetricValue } from "@/lib/format";
import { getMetricStatus } from "@/lib/metric-status";

type InteractiveDashboardProps = {
  groups: DashboardGroupView[];
  databaseUnavailable?: boolean;
};

type DashboardTab = "summary" | "follow_up_health" | "prospect_source_health" | "website_health";
type StatusFilter = "all" | "healthy" | "attention" | "no_data";

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: "summary", label: "Summary" },
  { key: "prospect_source_health", label: "Prospect Sources" },
  { key: "follow_up_health", label: "Follow-Up" },
  { key: "website_health", label: "Website" },
];

function getTone(groupKey: string): "blue" | "violet" | "green" | "amber" {
  if (groupKey === "follow_up_health") return "blue";
  if (groupKey === "prospect_source_health") return "violet";
  if (groupKey === "website_health") return "green";
  return "amber";
}

function metricMatchesStatus(metric: DashboardMetricView, statusFilter: StatusFilter) {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "no_data") {
    return metric.latestValue === null;
  }

  const status = getMetricStatus(metric);
  if (statusFilter === "healthy") {
    return status.tone === "success";
  }

  return status.tone === "danger" || status.tone === "warning";
}

function matchesSearch(metric: DashboardMetricView, search: string) {
  if (!search) {
    return true;
  }

  const haystack = [
    metric.label,
    metric.category,
    metric.subcategory,
    metric.segment,
    metric.sourceSystem,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function getGroupIcon(groupKey: string) {
  if (groupKey === "follow_up_health") return <Activity size={15} />;
  if (groupKey === "prospect_source_health") return <BarChart3 size={15} />;
  return <Globe2 size={15} />;
}

export function InteractiveDashboard({
  groups,
  databaseUnavailable = false,
}: InteractiveDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("summary");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search);

  const tabbedGroups =
    activeTab === "summary" ? groups : groups.filter((group) => group.key === activeTab);

  const visibleGroups = tabbedGroups
    .map((group) => ({
      ...group,
      metrics: group.metrics.filter(
        (metric) =>
          matchesSearch(metric, deferredSearch) && metricMatchesStatus(metric, statusFilter),
      ),
    }))
    .filter((group) => group.metrics.length > 0 || databaseUnavailable);

  const visibleMetrics = visibleGroups.flatMap((group) => group.metrics);
  const effectiveSelectedMetricKey =
    selectedMetricKey && visibleMetrics.some((metric) => metric.key === selectedMetricKey)
      ? selectedMetricKey
      : visibleMetrics[0]?.key ?? null;
  const selectedMetric =
    visibleMetrics.find((metric) => metric.key === effectiveSelectedMetricKey) ?? null;

  const totalMatchingMetrics = visibleMetrics.length;

  function toggleGroup(groupKey: string) {
    startTransition(() => {
      setCollapsedGroupKeys((current) =>
        current.includes(groupKey)
          ? current.filter((key) => key !== groupKey)
          : [...current, groupKey],
      );
    });
  }

  return (
    <>
      <section className="interactive-controls">
        <div className="tab-strip" role="tablist" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => {
                startTransition(() => {
                  setActiveTab(tab.key);
                });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <label className="search-box">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setSearch(nextValue);
                });
              }}
              placeholder="Search metrics, categories, or sources"
            />
          </label>

          <div className="status-filters">
            <span className="filter-label">
              <Filter size={14} />
              Filter
            </span>
            {[
              ["all", "All"],
              ["attention", "Needs attention"],
              ["healthy", "Healthy"],
              ["no_data", "No data"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-chip ${statusFilter === key ? "active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setStatusFilter(key as StatusFilter);
                  });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!databaseUnavailable && selectedMetric ? (
        <section className="detail-panel">
          <div className="detail-copy">
            <p className="pill">Selected Metric</p>
            <h2>{selectedMetric.label}</h2>
            <p>
              {selectedMetric.category}
              {selectedMetric.subcategory ? ` · ${selectedMetric.subcategory}` : ""}
              {selectedMetric.segment ? ` · ${selectedMetric.segment}` : ""}
            </p>
            <div className="detail-stats">
              <div className="detail-stat">
                <span>Latest</span>
                <strong>{formatMetricValue(selectedMetric.latestValue, selectedMetric.unit)}</strong>
              </div>
              <div className="detail-stat">
                <span>Period change</span>
                <strong>{formatDelta(selectedMetric.delta, selectedMetric.unit)}</strong>
              </div>
              <div className="detail-stat">
                <span>Status</span>
                <strong>{getMetricStatus(selectedMetric).label}</strong>
              </div>
            </div>
          </div>

          <div className="detail-meta">
            <div className="detail-badge">
              <span>Current</span>
              <strong>{formatMetricValue(selectedMetric.targets.current, selectedMetric.unit)}</strong>
            </div>
            <div className="detail-badge">
              <span>Standard</span>
              <strong>{formatMetricValue(selectedMetric.targets.standard, selectedMetric.unit)}</strong>
            </div>
            <div className="detail-badge">
              <span>Desired</span>
              <strong>{formatMetricValue(selectedMetric.targets.desired, selectedMetric.unit)}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="group-grid">
        {databaseUnavailable ? (
          <div className="empty-state">
            <ShieldCheck size={18} />
            <h2>Database not connected yet</h2>
            <p>
              The UI is live, but Postgres is not configured on this machine yet. Add a real
              `DATABASE_URL`, then run Prisma deploy and seed to load the dashboard data.
            </p>
          </div>
        ) : null}

        {!databaseUnavailable && groups.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={18} />
            <h2>No metric definitions found</h2>
            <p>Run Prisma migrations and the seed script to load the dashboard groups and metrics.</p>
          </div>
        ) : null}

        {!databaseUnavailable && groups.length > 0 && visibleGroups.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={18} />
            <h2>No metrics match this filter</h2>
            <p>Try a different search term or switch back to all statuses.</p>
          </div>
        ) : null}

        {visibleGroups.map((group) => (
          <article
            className={`group-card modern ${collapsedGroupKeys.includes(group.key) ? "is-collapsed" : ""}`}
            key={group.key}
          >
            <button
              type="button"
              className="section-toggle"
              aria-expanded={!collapsedGroupKeys.includes(group.key)}
              onClick={() => toggleGroup(group.key)}
            >
              <div className="section-header">
                <div className={`section-icon tone-${getTone(group.key)}`}>{getGroupIcon(group.key)}</div>
                <div className="section-title">{group.label}</div>
                <div className="section-count">{group.metrics.length} matching</div>
              </div>
              <div className="section-toggle-right">
                <span className="section-toggle-text">
                  {collapsedGroupKeys.includes(group.key) ? "Expand" : "Collapse"}
                </span>
                {collapsedGroupKeys.includes(group.key) ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </div>
            </button>

            {!collapsedGroupKeys.includes(group.key) ? (
              <>
                <p className="group-copy">{group.description}</p>
                <div className="metric-grid">
                  {group.metrics.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      tone={getTone(group.key)}
                      selected={selectedMetric?.key === metric.key}
                      onSelect={() => {
                        startTransition(() => {
                          setSelectedMetricKey(metric.key);
                        });
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </article>
        ))}
      </section>

      <section className="interaction-footer">
        <div>{totalMatchingMetrics} metrics currently match the current filters</div>
        <div>Everything on this page is now interactive on the frontend only.</div>
      </section>
    </>
  );
}
