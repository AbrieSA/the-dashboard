import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { syncWebsiteHealth } from "@/lib/website-health-service";
import { websiteHealthSyncRequestSchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.WEBSITE_HEALTH_SYNC_KEY) {
    return NextResponse.json(
      { error: "WEBSITE_HEALTH_SYNC_KEY is not configured." },
      { status: 500 },
    );
  }

  const key = request.headers.get("x-sync-key");

  if (key !== env.WEBSITE_HEALTH_SYNC_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const payload = websiteHealthSyncRequestSchema.parse(raw);
  const result = await syncWebsiteHealth(payload);

  return NextResponse.json(
    {
      ok: result.ok,
      syncedCount: result.syncedCount,
      updatedCount: result.updatedCount,
      failedCount: result.failedCount,
      cleanupDeletedCount: result.cleanupDeletedCount,
      results: result.results,
    },
    { status: result.statusCode },
  );
}
