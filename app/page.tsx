import { DashboardView } from "@/components/DashboardView";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { dashboardQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ timegrain?: string; asOf?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = dashboardQuerySchema.parse({
    timegrain: params.timegrain,
    asOf: params.asOf,
  });
  const groups = await getDashboardSnapshot(query).catch(() => null);

  return (
    <DashboardView
      groups={groups ?? []}
      timegrain={query.timegrain}
      databaseUnavailable={groups === null}
    />
  );
}
