import { OverviewLanding } from "@/components/OverviewLanding";
import { getDashboardSnapshot } from "@/lib/dashboard";
import type { DashboardGroupView, DashboardRuntimeStatus } from "@/lib/dashboard-types";
import { dashboardQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type HomePageProps = {
  searchParams: Promise<{ timegrain?: string; asOf?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = dashboardQuerySchema.parse({
    timegrain: params.timegrain,
    asOf: params.asOf,
  });
  let groups: DashboardGroupView[] = [];
  let runtimeStatus: DashboardRuntimeStatus = "live";
  let runtimeMessage: string | null = null;

  try {
    groups = await getDashboardSnapshot(query);
  } catch (error) {
    runtimeStatus = "error";
    runtimeMessage = "Live data is temporarily unavailable. Refresh in a few seconds to retry.";
    console.error("Dashboard snapshot failed", {
      timegrain: query.timegrain,
      asOf: query.asOf ?? null,
      error,
    });
  }

  return (
    <main className="dashboard-app">
      <div className="dashboard-page shell page-grid">
        <OverviewLanding
          groups={groups}
          runtimeStatus={runtimeStatus}
          runtimeMessage={runtimeMessage}
        />
      </div>
    </main>
  );
}
