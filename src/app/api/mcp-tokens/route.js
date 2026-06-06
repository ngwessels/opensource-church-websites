import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listMcpConnections } from "@/lib/mcp/connections";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const user = await getAdminUserFromRequest(request);
    const connections = await listMcpConnections(user.uid);
    return NextResponse.json({ connections });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
