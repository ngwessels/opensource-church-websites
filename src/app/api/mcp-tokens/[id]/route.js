import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { revokeMcpConnection } from "@/lib/mcp/connections";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function DELETE(request, { params }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const user = await getAdminUserFromRequest(request);
    const { id } = await params;
    const result = await revokeMcpConnection(user.uid, id);
    return NextResponse.json({ connection: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("not found") ? 404 : message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
