import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { createMcpConnection, listMcpConnections } from "@/lib/mcp/connections";

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

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const user = await getAdminUserFromRequest(request);
    const body = await request.json();
    const appUrl =
      body.appUrl ||
      request.headers.get("x-app-url") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const connection = await createMcpConnection(user.uid, {
      name: body.name,
      appUrl,
    });

    return NextResponse.json({ connection });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status =
      message.includes("authorization") || message.includes("Admin access")
        ? 403
        : message.includes("Maximum") || message.includes("already exists")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
