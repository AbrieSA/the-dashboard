import { NextResponse } from "next/server";
import { getWebsiteHealthReport } from "@/lib/website-health-service";
import { websiteHealthReportQuerySchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = websiteHealthReportQuerySchema.parse({
    timegrain: url.searchParams.get("timegrain") ?? undefined,
    strategy: url.searchParams.get("strategy") ?? undefined,
    pageId: url.searchParams.get("pageId") ?? undefined,
  });

  try {
    const report = await getWebsiteHealthReport(query);
    return NextResponse.json(report);
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load website health report.",
      },
      { status },
    );
  }
}
