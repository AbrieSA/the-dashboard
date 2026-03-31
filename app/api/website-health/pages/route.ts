import { NextResponse } from "next/server";
import { createWebsitePage, listWebsitePages } from "@/lib/website-health-service";
import { websitePageCreateSchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

export async function GET() {
  const pages = await listWebsitePages();
  return NextResponse.json({ pages });
}

export async function POST(request: Request) {
  const raw = await request.json();
  const payload = websitePageCreateSchema.parse(raw);

  try {
    const page = await createWebsitePage(payload);
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
    const conflictField =
      error instanceof Error && "conflictField" in error && typeof error.conflictField === "string"
        ? error.conflictField
        : undefined;

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create website page.",
        conflictField,
      },
      { status },
    );
  }
}
