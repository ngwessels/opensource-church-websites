import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { registerOAuthClient } from "@/lib/oauth/clients";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    if (!isFirebaseAdminConfigured()) {
      console.warn("[oauth:register] rejected: firebase admin not configured");
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }

    body = await request.json();
    const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
    console.info("[oauth:register] attempt", {
      clientName: body?.client_name || "MCP Client",
      redirectUriCount: redirectUris.length,
      redirectUris,
    });

    const client = await registerOAuthClient(body);
    console.info("[oauth:register] created", { clientId: client.client_id, clientName: client.client_name });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "registration_failed";
    console.warn("[oauth:register] rejected", {
      error: message,
      clientName: body?.client_name,
      redirectUris: Array.isArray(body?.redirect_uris) ? body.redirect_uris : undefined,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
