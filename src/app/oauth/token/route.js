import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { exchangeAuthorizationCode } from "@/lib/oauth/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }

    const contentType = request.headers.get("content-type") || "";
    let body;
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    }

    if (body.grant_type !== "authorization_code") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    }

    const token = await exchangeAuthorizationCode({
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });

    return NextResponse.json(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
