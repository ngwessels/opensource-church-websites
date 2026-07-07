import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { getSiteAnalyticsReport } from "@/lib/analytics/query";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&pagePath=&pageId= */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from")?.trim();
    const dateTo = searchParams.get("to")?.trim();
    const pagePath = searchParams.get("pagePath")?.trim() || undefined;
    const pageId = searchParams.get("pageId")?.trim() || undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    }

    const report = await getSiteAnalyticsReport({ dateFrom, dateTo, pagePath, pageId });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load analytics";
    const status =
      message === "Missing authorization" || message === "Admin access required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
