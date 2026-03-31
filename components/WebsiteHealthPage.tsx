"use client";

import { Activity, ChevronDown, ChevronRight, Globe, LaptopMinimal, MonitorSmartphone, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type CSSProperties, useState, useTransition } from "react";

import type {
  WebsiteHealthMetricSlot,
  WebsiteHealthReportResult,
  WebsiteHealthReportRow,
  WebsiteHealthReportStrategy,
  WebsiteHealthStatus,
  WebsiteHealthTimegrain,
} from "@/lib/website-health";
import styles from "@/components/WebsiteHealthPage.module.css";

type WebsiteHealthPageProps = {
  report: WebsiteHealthReportResult | null;
  timegrain: WebsiteHealthTimegrain;
  strategy: WebsiteHealthReportStrategy;
  runtimeMessage?: string | null;
};

type VitalMetric = "lcpMs" | "inpMs" | "cls";

function formatVitalValue(metric: VitalMetric, value: number | null) {
  if (value === null) {
    return "No data";
  }

  if (metric === "cls") {
    return value.toFixed(2);
  }

  if (metric === "lcpMs") {
    return `${(value / 1000).toFixed(1)} s`;
  }

  return `${Math.round(value)} ms`;
}

function getVitalMarkerPercent(metric: VitalMetric, value: number | null) {
  if (value === null) {
    return 0;
  }

  const maxValue = metric === "lcpMs" ? 6000 : metric === "inpMs" ? 800 : 0.35;
  return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

function getAveragePerformanceScore(
  row: WebsiteHealthReportRow,
  strategy: WebsiteHealthReportStrategy,
) {
  const slots =
    strategy === "all"
      ? [row.mobile, row.desktop]
      : strategy === "mobile"
        ? [row.mobile]
        : [row.desktop];

  const scores = slots
    .map((slot) => slot?.performanceScore ?? null)
    .filter((value): value is number => value !== null);

  if (scores.length === 0) {
    return null;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function getPerformanceTone(score: number | null) {
  if (score === null) {
    return "muted";
  }

  if (score >= 90) {
    return "good";
  }

  if (score >= 50) {
    return "warn";
  }

  return "poor";
}

function getAssessmentLabel(status: WebsiteHealthStatus) {
  if (status === "GOOD") {
    return "Passed";
  }

  if (status === "NEEDS_IMPROVEMENT") {
    return "Needs improvement";
  }

  if (status === "POOR") {
    return "Failed";
  }

  return "No data yet";
}

function getAssessmentTone(status: WebsiteHealthStatus) {
  if (status === "GOOD") {
    return styles.goodText;
  }

  if (status === "NEEDS_IMPROVEMENT") {
    return styles.warnText;
  }

  if (status === "POOR") {
    return styles.poorText;
  }

  return styles.mutedText;
}

function getVitalToneClass(status: WebsiteHealthStatus | null) {
  if (status === "GOOD") {
    return styles.good;
  }

  if (status === "NEEDS_IMPROVEMENT") {
    return styles.warn;
  }

  if (status === "POOR") {
    return styles.poor;
  }

  return styles.muted;
}

function getScoreRingStyle(score: number | null): CSSProperties {
  const color =
    score === null ? "#c7d1e2" : score >= 90 ? "#1fa971" : score >= 50 ? "#e4a93a" : "#eb5757";
  const degrees = score === null ? 0 : score * 3.6;

  return {
    background: `conic-gradient(${color} ${degrees}deg, #e5edf8 ${degrees}deg 360deg)`,
  };
}

function metricLabel(metric: VitalMetric) {
  if (metric === "lcpMs") {
    return "Largest Contentful Paint (LCP)";
  }

  if (metric === "inpMs") {
    return "Interaction to Next Paint (INP)";
  }

  return "Cumulative Layout Shift (CLS)";
}

function DeviceVitalsCard({
  title,
  slot,
}: {
  title: string;
  slot: WebsiteHealthMetricSlot | null;
}) {
  const metrics: VitalMetric[] = ["lcpMs", "inpMs", "cls"];
  const Icon = title === "Desktop" ? LaptopMinimal : MonitorSmartphone;

  return (
    <section className={styles.deviceCard}>
      <div className={styles.deviceCardHeader}>
        <div>
          <div className={styles.deviceTitle}>
            <Icon size={16} />
            {title}
          </div>
          <div className={styles.deviceMeta}>
            {slot ? `${slot.pageDataScope === "PAGE" ? "Page" : "Origin"} data` : "Waiting for sync"}
          </div>
        </div>
        <div className={`${styles.deviceBadge} ${styles[getPerformanceTone(slot?.performanceScore ?? null)]}`}>
          {slot?.performanceScore ?? "--"}
        </div>
      </div>

      {slot ? (
        <div className={styles.vitalGrid}>
          {metrics.map((metric) => {
            const value = slot[metric];
            const markerLeft = `${getVitalMarkerPercent(metric, value)}%`;
            const status =
              metric === "lcpMs"
                ? slot.lcpStatus
                : metric === "inpMs"
                  ? slot.inpStatus
                  : slot.clsStatus;

            return (
              <div className={styles.vitalCard} key={metric}>
                <div className={styles.vitalTopline}>
                  <span className={styles.vitalLabel}>{metricLabel(metric)}</span>
                  <span className={`${styles.vitalValue} ${getVitalToneClass(status ?? null)}`}>
                    {formatVitalValue(metric, value)}
                  </span>
                </div>
                <div className={styles.vitalTrack}>
                  <div className={styles.vitalMarker} style={{ left: markerLeft }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.noDataCard}>No snapshot yet for this device view.</div>
      )}
    </section>
  );
}

export function WebsiteHealthPage({
  report,
  timegrain,
  strategy,
  runtimeMessage = null,
}: WebsiteHealthPageProps) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleExpanded(pageId: string) {
    setExpandedIds((current) =>
      current.includes(pageId) ? current.filter((item) => item !== pageId) : [...current, pageId],
    );
  }

  async function handleCreatePage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/website-health/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label,
          url,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; page?: { id: string } }
        | null;

      if (!response.ok) {
        setFormError(payload?.error ?? "Could not add that page yet.");
        return;
      }

      setLabel("");
      setUrl("");
      setIsFormOpen(false);
      setFormSuccess("Page added. It will appear in the list after refresh.");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.pageWrap}>
      <div className={styles.canvas}>
        <div className={styles.introRow}>
          <div>
            <p className={styles.eyebrow}>Website Health</p>
            <h1 className={styles.heading}>Track each monitored page the way the team will actually use it.</h1>
            <p className={styles.subcopy}>
              Rows stay compact until you need detail. Expand any page to inspect LCP, INP, and CLS for
              {strategy === "all" ? " both mobile and desktop." : ` the ${strategy} experience.`}
            </p>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.addButton}
              onClick={() => setIsFormOpen((current) => !current)}
              type="button"
            >
              <Plus size={16} />
              {isFormOpen ? "Close" : "Add page"}
            </button>
          </div>
        </div>

        {isFormOpen ? (
          <form className={styles.addCard} onSubmit={handleCreatePage}>
            <div className={styles.addFields}>
              <label className={styles.field}>
                <span>Page label</span>
                <input
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Ship Volunteer Page"
                  required
                  value={label}
                />
              </label>
              <label className={styles.field}>
                <span>Page URL</span>
                <input
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.ywamships.org/example-page/"
                  required
                  type="url"
                  value={url}
                />
              </label>
            </div>
            <div className={styles.formFooter}>
              <p className={styles.formHint}>New pages appear immediately. They will show scores after the next sync.</p>
              <button className={styles.saveButton} disabled={isSaving || isPending} type="submit">
                {isSaving || isPending ? "Adding..." : "Add page"}
              </button>
            </div>
            {formError ? <p className={`${styles.formMessage} ${styles.errorMessage}`}>{formError}</p> : null}
          </form>
        ) : null}

        {formSuccess ? <p className={`${styles.formMessage} ${styles.successMessage}`}>{formSuccess}</p> : null}
        {runtimeMessage ? <div className={styles.runtimeCard}>{runtimeMessage}</div> : null}

        <div className={styles.contextBar}>
          <span className={styles.contextPill}>{timegrain === "WEEK" ? "Weekly snapshots" : "Monthly snapshots"}</span>
          <span className={styles.contextPill}>
            {strategy === "all" ? "Mobile + Desktop" : strategy === "mobile" ? "Mobile only" : "Desktop only"}
          </span>
          <span className={styles.contextPill}>
            {report?.rows.length ?? 0} page{report?.rows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={styles.stack}>
          {report?.rows.map((row) => {
            const isExpanded = expandedIds.includes(row.page.id);
            const score = getAveragePerformanceScore(row, strategy);
            const tone = getPerformanceTone(score);
            const scoreLabel = score === null ? "--" : String(score);
            const assessmentLabel = getAssessmentLabel(row.healthSummary.status);

            return (
              <article className={`${styles.rowCard} ${isExpanded ? styles.rowCardExpanded : ""}`} key={row.page.id}>
                <div className={styles.rowSummary}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowIcon}>
                      <Globe size={18} />
                    </div>
                    <div className={styles.pageMeta}>
                      <button className={styles.pageTitleButton} onClick={() => toggleExpanded(row.page.id)} type="button">
                        {row.page.label}
                      </button>
                      <a className={styles.pageUrl} href={row.page.url} rel="noreferrer" target="_blank">
                        {row.page.url}
                      </a>
                    </div>
                    <span className={styles.matchPill}>LCP / INP / CLS</span>
                  </div>

                  <div className={styles.rowActions}>
                    <div className={`${styles.scoreCard} ${styles[tone]}`}>
                      <div className={styles.scoreRing} style={getScoreRingStyle(score)}>
                        <div className={styles.scoreInner}>{scoreLabel}</div>
                      </div>
                      <div className={styles.scoreCaption}>Performance</div>
                    </div>

                    <button className={styles.expandButton} onClick={() => toggleExpanded(row.page.id)} type="button">
                      {isExpanded ? "Collapse" : "Expand"}
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className={styles.expandedPanel}>
                    <div className={styles.assessmentBar}>
                      <div className={styles.assessmentTitle}>
                        <Activity size={18} />
                        <span>
                          Core Web Vitals Assessment:{" "}
                          <strong className={getAssessmentTone(row.healthSummary.status)}>{assessmentLabel}</strong>
                        </span>
                      </div>
                      <div className={styles.assessmentHint}>
                        {strategy === "all" ? "Showing both device categories" : `Showing ${strategy} data`}
                      </div>
                    </div>

                    <div className={styles.deviceGrid}>
                      {strategy !== "desktop" ? (
                        <DeviceVitalsCard slot={row.mobile} title="Mobile" />
                      ) : null}
                      {strategy !== "mobile" ? (
                        <DeviceVitalsCard slot={row.desktop} title="Desktop" />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {report && report.rows.length === 0 ? (
            <div className={styles.emptyCard}>No website pages are registered yet.</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
