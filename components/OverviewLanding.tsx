import Link from "next/link";

import type { DashboardGroupView, DashboardRuntimeStatus } from "@/lib/dashboard-types";
import { getMetricStatus } from "@/lib/metric-status";
import styles from "@/components/OverviewLanding.module.css";

type OverviewLandingProps = {
  groups: DashboardGroupView[];
  runtimeStatus?: DashboardRuntimeStatus;
  runtimeMessage?: string | null;
};

type OverviewSignal = {
  label: string;
  tone: "good" | "warn" | "bad";
};

function mapMetricToneToSignalTone(metricTone: "success" | "warning" | "danger"): OverviewSignal["tone"] {
  if (metricTone === "success") {
    return "good";
  }

  if (metricTone === "warning") {
    return "warn";
  }

  return "bad";
}

function buildSignals(
  group: DashboardGroupView | undefined,
  fallbackLabels: string[],
  count: number,
): OverviewSignal[] {
  const labels = fallbackLabels.slice(0, count);

  if (!group || group.metrics.length === 0) {
    return labels.map((label) => ({
      label,
      tone: "warn",
    }));
  }

  const tones = group.metrics
    .slice(0, count)
    .map((metric) => mapMetricToneToSignalTone(getMetricStatus(metric).tone));

  return labels.map((label, index) => ({
    label,
    tone: tones[index] ?? "warn",
  }));
}

function SignalItem({ signal }: { signal: OverviewSignal }) {
  return (
    <div className={styles.signalItem}>
      <span className={styles.signalLabel}>{signal.label}</span>
      <span className={`${styles.diamond} ${styles[signal.tone]}`} />
    </div>
  );
}

function TwoColumnTile({
  title,
  href,
  signals,
}: {
  title: string;
  href: string;
  signals: OverviewSignal[];
}) {
  const leftSignals = signals.slice(0, 2);
  const rightSignals = signals.slice(2, 4);

  return (
    <Link className={styles.tile} href={href}>
      <h2 className={styles.tileTitle}>{title}</h2>
      <div className={styles.twoColumnSignals}>
        <div className={styles.signalColumn}>
          {leftSignals.map((signal) => (
            <SignalItem key={`${title}-left-${signal.label}`} signal={signal} />
          ))}
        </div>
        <div className={styles.signalColumn}>
          {rightSignals.map((signal) => (
            <SignalItem key={`${title}-right-${signal.label}`} signal={signal} />
          ))}
        </div>
      </div>
    </Link>
  );
}

function SingleColumnTile({
  title,
  href,
  signals,
}: {
  title: string;
  href: string;
  signals: OverviewSignal[];
}) {
  return (
    <Link className={`${styles.tile} ${styles.singleColumnTile}`} href={href}>
      <h2 className={styles.tileTitle}>{title}</h2>
      <div className={styles.singleColumnSignals}>
        {signals.map((signal) => (
          <SignalItem key={`${title}-${signal.label}`} signal={signal} />
        ))}
      </div>
    </Link>
  );
}

export function OverviewLanding({
  groups,
  runtimeStatus = "live",
  runtimeMessage = null,
}: OverviewLandingProps) {
  const followUpGroup = groups.find((group) => group.key === "follow_up_health");
  const sourcesGroup = groups.find((group) => group.key === "prospect_source_health");
  const websiteGroup = groups.find((group) => group.key === "website_health");

  const followUpSignals = buildSignals(
    followUpGroup,
    ["DTS Interests", "DTS Applicants", "Outreach Interests", "Outreach Applicants"],
    4,
  );
  const sourceSignals = buildSignals(sourcesGroup, ["Google Ads", "Organic", "Meta", "Tiktok"], 4);
  const websiteSignals = buildSignals(websiteGroup, ["Performance", "Functionality"], 2);

  return (
    <section className={styles.wrap}>
      <div className={styles.headerBlock}>
        <h1>The Dashboard</h1>
        <p>Overview</p>
      </div>

      {runtimeStatus === "error" ? (
        <p className={styles.runtimeWarning}>
          {runtimeMessage ?? "Live data is temporarily unavailable. Tiles are still available to navigate."}
        </p>
      ) : null}

      <div className={styles.topRow}>
        <TwoColumnTile href="/follow-up" signals={followUpSignals} title="Follow Up" />
        <TwoColumnTile href="/sources" signals={sourceSignals} title="Sources" />
      </div>

      <div className={styles.bottomRow}>
        <SingleColumnTile href="/website-health?strategy=all" signals={websiteSignals} title="Website" />
      </div>
    </section>
  );
}
