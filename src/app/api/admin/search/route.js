import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { searchSiteContentAdmin } from "@/lib/cms/content-search";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** GET ?q=...&limit=50 — search all site content */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limitParam = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

    if (!query) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const result = await searchSiteContentAdmin({ query, limit });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    const status =
      message === "Missing authorization" || message === "Admin access required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
