import Link from "next/link";

import { AppShellHeader } from "@/components/AppShellHeader";
import { WebsiteHealthPage } from "@/components/WebsiteHealthPage";
import { getWebsiteHealthReport } from "@/lib/website-health-service";
import type { WebsiteHealthReportResult } from "@/lib/website-health";
import { websiteHealthReportQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type WebsiteHealthRouteProps = {
  searchParams: Promise<{ strategy?: string; pageId?: string }>;
};

export default async function WebsiteHealthRoute({ searchParams }: WebsiteHealthRouteProps) {
  const params = await searchParams;
  const query = websiteHealthReportQuerySchema.parse({
    strategy: params.strategy,
    pageId: params.pageId,
  });

  let report: WebsiteHealthReportResult | null = null;
  let runtimeMessage: string | null = null;

  try {
    report = await getWebsiteHealthReport(query);
  } catch (error) {
    runtimeMessage = "Website health data is temporarily unavailable. Refresh in a few seconds to retry.";
    console.error("Website health report failed", {
      strategy: query.strategy,
      pageId: query.pageId ?? null,
      error,
    });
  }

  return (
    <main className="dashboard-app">
      <AppShellHeader activePage="website-health" hasRuntimeError={Boolean(runtimeMessage)}>
        <div className="toolbar">
          <Link
            className={query.strategy === "all" ? "button" : "button-secondary"}
            href="/website-health?strategy=all"
          >
            All
          </Link>
          <Link
            className={query.strategy === "mobile" ? "button" : "button-secondary"}
            href="/website-health?strategy=mobile"
          >
            Mobile
          </Link>
          <Link
            className={query.strategy === "desktop" ? "button" : "button-secondary"}
            href="/website-health?strategy=desktop"
          >
            Desktop
          </Link>
        </div>
      </AppShellHeader>

      <div className="dashboard-page shell page-grid">
        <WebsiteHealthPage
          report={report}
          runtimeMessage={runtimeMessage}
          strategy={query.strategy}
        />
      </div>
    </main>
  );
}
