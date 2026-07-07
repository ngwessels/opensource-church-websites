import { NextResponse } from "next/server";

import { listAuditEventsAdmin } from "@/lib/audit/query.server";
import { getAdminActorFromRequest } from "@/lib/cms/auth";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await getAdminActorFromRequest(request);

    const { searchParams } = new URL(request.url);
    const result = await listAuditEventsAdmin({
      actorUid: searchParams.get("actorUid") || undefined,
      action: searchParams.get("action") || undefined,
      resourceType: searchParams.get("resourceType") || undefined,
      query: searchParams.get("q") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      cursor: searchParams.get("cursor") || undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load audit log";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
