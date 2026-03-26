import crypto from "node:crypto";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";

const SESSION_COOKIE = "dashboard_session";

function createSignature(value: string) {
  const { SESSION_SECRET } = getEnv();
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export async function isAuthenticated() {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) {
    return false;
  }

  const separatorIndex = session.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === session.length - 1) {
    store.delete(SESSION_COOKIE);
    return false;
  }

  const email = session.slice(0, separatorIndex);
  const signature = session.slice(separatorIndex + 1);
  const expected = createSignature(email);
  if (signature.length !== expected.length) {
    store.delete(SESSION_COOKIE);
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function createSession(email: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, `${email}.${createSignature(email)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function isAllowedEmail(email: string) {
  const { INTERNAL_DASHBOARD_EMAILS } = getEnv();
  const allowList = INTERNAL_DASHBOARD_EMAILS.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length === 0) {
    return true;
  }

  return allowList.includes(email.trim().toLowerCase());
}
