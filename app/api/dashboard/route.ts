import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/dashboard";
import { dashboardQuerySchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = dashboardQuerySchema.parse({
    timegrain: url.searchParams.get("timegrain") ?? undefined,
    asOf: url.searchParams.get("asOf") ?? undefined,
  });
  const groups = await getDashboardSnapshot(query);

  return NextResponse.json({
    timegrain: query.timegrain,
    groups,
  });
}
