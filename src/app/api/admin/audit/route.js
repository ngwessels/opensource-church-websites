import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/record.server";
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

/** POST — record an audit event from the builder UI (Admin SDK, no client Firestore write). */
export async function POST(request) {
  try {
    const actor = await getAdminActorFromRequest(request);
    const body = await request.json();

    const eventId = await recordAuditEvent({
      actor,
      source: "ui",
      action: body?.action,
      resource: body?.resource,
      summary: body?.summary,
      context: body?.context,
      before: body?.before,
      after: body?.after,
    });

    return NextResponse.json({ eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record audit event";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
