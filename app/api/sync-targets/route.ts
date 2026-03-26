import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { DASHBOARD_CACHE_TAG } from "@/lib/deployment";
import { getEnv } from "@/lib/env";
import { syncTargetsFromGoogleSheet } from "@/lib/targets";

export const preferredRegion = "hnd1";

export async function POST(request: Request) {
  const key = request.headers.get("x-sync-key");
  const env = getEnv();

  if (key !== env.GOOGLE_TARGETS_SYNC_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.GOOGLE_TARGETS_CSV_URL) {
    return NextResponse.json({ error: "GOOGLE_TARGETS_CSV_URL is not configured." }, { status: 400 });
  }

  const result = await syncTargetsFromGoogleSheet(env.GOOGLE_TARGETS_CSV_URL);
  revalidateTag(DASHBOARD_CACHE_TAG, "max");
  return NextResponse.json({ ok: true, ...result });
}
