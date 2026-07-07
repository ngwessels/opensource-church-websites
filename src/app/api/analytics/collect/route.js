import { NextResponse } from "next/server";

import { collectAnalyticsEvent } from "@/lib/analytics/collect";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Analytics is not configured" }, { status: 503 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8192) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const body = await request.json();
    const result = await collectAnalyticsEvent(request, body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to collect analytics";
    const status =
      message === "Rate limit exceeded"
        ? 429
        : message === "Path is not tracked" || message === "Invalid payload"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
