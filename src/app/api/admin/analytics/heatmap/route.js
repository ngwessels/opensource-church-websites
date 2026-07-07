import { NextResponse } from "next/server";

import { getPageHeatmapReport } from "@/lib/analytics/heatmap-query";
import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** GET ?from=&to=&pagePath=&pageId=&deviceType= */
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
    const deviceType = searchParams.get("deviceType")?.trim() || undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    }

    const report = await getPageHeatmapReport({
      dateFrom,
      dateTo,
      pagePath,
      pageId,
      deviceType:
        deviceType === "mobile" || deviceType === "tablet" || deviceType === "desktop"
          ? deviceType
          : undefined,
    });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load heatmap";
    const status =
      message === "Missing authorization" || message === "Admin access required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
