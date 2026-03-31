import Link from "next/link";

import { AppShellHeader } from "@/components/AppShellHeader";
import { MetricsSectionView } from "@/components/MetricsSectionView";
import { getDashboardSnapshot } from "@/lib/dashboard";
import type { DashboardGroupView, DashboardRuntimeStatus } from "@/lib/dashboard-types";
import { dashboardQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type FollowUpPageProps = {
  searchParams: Promise<{ timegrain?: string; asOf?: string }>;
};

export default async function FollowUpPage({ searchParams }: FollowUpPageProps) {
  const params = await searchParams;
  const query = dashboardQuerySchema.parse({
    timegrain: params.timegrain,
    asOf: params.asOf,
  });
  let groups: DashboardGroupView[] = [];
  let runtimeStatus: DashboardRuntimeStatus = "live";
  let runtimeMessage: string | null = null;

  try {
    const snapshot = await getDashboardSnapshot(query);
    groups = snapshot.filter((group) => group.key === "follow_up_health");
  } catch (error) {
    runtimeStatus = "error";
    runtimeMessage = "Follow up metrics are temporarily unavailable. Refresh in a few seconds.";
    console.error("Follow up dashboard snapshot failed", {
      timegrain: query.timegrain,
      asOf: query.asOf ?? null,
      error,
    });
  }

  return (
    <main className="dashboard-app">
      <AppShellHeader activePage="follow-up" hasRuntimeError={runtimeStatus === "error"}>
        <div className="toolbar">
          <Link
            className={query.timegrain === "WEEK" ? "button" : "button-secondary"}
            href="/follow-up?timegrain=WEEK"
          >
            Week View
          </Link>
          <Link
            className={query.timegrain === "MONTH" ? "button" : "button-secondary"}
            href="/follow-up?timegrain=MONTH"
          >
            Month View
          </Link>
          <Link
            className={query.timegrain === "YEAR" ? "button" : "button-secondary"}
            href="/follow-up?timegrain=YEAR"
          >
            Year View
          </Link>
        </div>
      </AppShellHeader>

      <div className="dashboard-page shell page-grid">
        <MetricsSectionView
          groups={groups}
          runtimeStatus={runtimeStatus}
          runtimeMessage={runtimeMessage}
          emptyTitle="No follow up metrics found"
          emptyDescription="Run Prisma migrations and the seed script to load the follow up dashboard group."
        />
      </div>
    </main>
  );
}
