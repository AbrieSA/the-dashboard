import { NextResponse } from "next/server";

import { createSession, isAllowedEmail } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const { INTERNAL_DASHBOARD_PASSWORD, APP_BASE_URL } = getEnv();
  const baseUrl = APP_BASE_URL ?? new URL(request.url).origin;

  const loginUrl = new URL("/login", baseUrl);
  loginUrl.searchParams.set("next", next);

  if (!email || !password || !isAllowedEmail(email) || password !== INTERNAL_DASHBOARD_PASSWORD) {
    loginUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(loginUrl);
  }

  await createSession(email);
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", baseUrl));
}
