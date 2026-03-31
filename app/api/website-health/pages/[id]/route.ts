import { NextResponse } from "next/server";
import { updateWebsitePage } from "@/lib/website-health-service";
import { websitePageUpdateSchema } from "@/lib/validation";

export const preferredRegion = "hnd1";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const raw = await request.json();
  const payload = websitePageUpdateSchema.parse(raw);

  try {
    const page = await updateWebsitePage(id, payload);
    return NextResponse.json({ ok: true, page });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
    const conflictField =
      error instanceof Error && "conflictField" in error && typeof error.conflictField === "string"
        ? error.conflictField
        : undefined;

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update website page.",
        conflictField,
      },
      { status },
    );
  }
}
