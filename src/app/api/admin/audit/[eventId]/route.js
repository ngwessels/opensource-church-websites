import { NextResponse } from "next/server";

import { getAuditEventAdmin } from "@/lib/audit/query.server";
import { getAdminActorFromRequest } from "@/lib/cms/auth";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    await getAdminActorFromRequest(request);

    const { eventId } = await params;
    const result = await getAuditEventAdmin(eventId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load audit event";
    const status =
      message === "Audit event not found"
        ? 404
        : message.includes("authorization") || message.includes("Admin access")
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
