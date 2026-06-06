import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { registerOAuthClient } from "@/lib/oauth/clients";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }
    const body = await request.json();
    const client = await registerOAuthClient(body);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "registration_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
