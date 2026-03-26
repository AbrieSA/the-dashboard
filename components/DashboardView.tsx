import Link from "next/link";
import { Activity, BarChart3, Database, Globe2, Layers3 } from "lucide-react";

import { logoutAction } from "@/app/actions";
import { InteractiveDashboard } from "@/components/InteractiveDashboard";
import { type DashboardGroupView } from "@/lib/dashboard-types";

type DashboardViewProps = {
  groups: DashboardGroupView[];
  timegrain: "WEEK" | "MONTH" | "YEAR";
  databaseUnavailable?: boolean;
};

export function DashboardView({ groups, timegrain, databaseUnavailable = false }: DashboardViewProps) {
  const totalMetrics = groups.reduce((sum, group) => sum + group.metrics.length, 0);
  const metricsWithData = groups.reduce(
    (sum, group) => sum + group.metrics.filter((metric) => metric.latestValue !== null).length,
    0,
  );

  return (
    <main className="dashboard-app">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">DB</div>
          <div>
            <div className="brand-name">System Health Dashboard</div>
            <div className="brand-sub">Operational marketing and sales view</div>
          </div>
        </div>

        <div className="header-right">
          <div className={`status-pill ${databaseUnavailable ? "amber" : "green"}`}>
            <span className="pulse" />
            {databaseUnavailable ? "Preview Mode" : "Supabase Connected"}
          </div>
          <div className="toolbar">
            <Link className={timegrain === "WEEK" ? "button" : "button-secondary"} href="/?timegrain=WEEK">
              Week View
            </Link>
            <Link className={timegrain === "MONTH" ? "button" : "button-secondary"} href="/?timegrain=MONTH">
              Month View
            </Link>
            <Link className={timegrain === "YEAR" ? "button" : "button-secondary"} href="/?timegrain=YEAR">
              Year View
            </Link>
          </div>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="dashboard-page shell page-grid">
        <section className="hero hero-compact">
          <div>
            <p className="pill">Internal Dashboard</p>
            <h1>See what is healthy, what is drifting, and what needs attention.</h1>
            <p>
              Hourly snapshots from Salesforce, GA4, and website performance sources, structured in
              Postgres and rendered as an internal operational dashboard.
            </p>
          </div>
        </section>

        <section className="summary-grid">
          <article className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">Dashboard Sections</div>
                <div className="summary-value">{groups.length}</div>
              </div>
              <div className="summary-icon blue">
                <Layers3 size={18} />
              </div>
            </div>
            <div className="summary-foot">Follow Up, Sources, and Website health blocks</div>
          </article>

          <article className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">Tracked Metrics</div>
                <div className="summary-value">{totalMetrics}</div>
              </div>
              <div className="summary-icon violet">
                <BarChart3 size={18} />
              </div>
            </div>
            <div className="summary-foot">Seeded metric definitions ready for live observations</div>
          </article>

          <article className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">Metrics With Data</div>
                <div className="summary-value">{metricsWithData}</div>
              </div>
              <div className="summary-icon green">
                <Activity size={18} />
              </div>
            </div>
            <div className="summary-foot">This will rise as Zapier starts posting observations</div>
          </article>

          <article className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-label">Runtime Status</div>
                <div className="summary-value">{databaseUnavailable ? "Preview" : "Live"}</div>
              </div>
              <div className="summary-icon amber">
                {databaseUnavailable ? <Globe2 size={18} /> : <Database size={18} />}
              </div>
            </div>
            <div className="summary-foot">
              {databaseUnavailable
                ? "App is rendering without a working database connection"
                : "Dashboard is reading from the connected Supabase database"}
            </div>
          </article>
        </section>

        <section className="api-grid">
          <article className="api-card">
            <strong>Zapier ingestion</strong>
            <p>Post normalized hourly payloads to `/api/ingest` with `x-api-key` and a source run id.</p>
          </article>
          <article className="api-card">
            <strong>Targets sync</strong>
            <p>Keep editable benchmark values in a simple Google Sheet CSV and sync them into Postgres.</p>
          </article>
          <article className="api-card">
            <strong>Protected internal view</strong>
            <p>Private login, grouped metrics, live database reads, and week/month/year dashboard views.</p>
          </article>
        </section>

        <InteractiveDashboard groups={groups} databaseUnavailable={databaseUnavailable} />
      </div>
    </main>
  );
}
