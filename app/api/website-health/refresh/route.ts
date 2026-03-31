import { NextResponse } from "next/server";

import { syncWebsiteHealth } from "@/lib/website-health-service";
import { websiteHealthSyncRequestSchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => ({}));
  const payload = websiteHealthSyncRequestSchema.parse(raw);
  const result = await syncWebsiteHealth(payload);

  return NextResponse.json(
    {
      ok: result.ok,
      syncedCount: result.syncedCount,
      updatedCount: result.updatedCount,
      failedCount: result.failedCount,
      results: result.results,
    },
    { status: result.statusCode },
  );
}
