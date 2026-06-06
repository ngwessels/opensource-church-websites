import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/cms/auth";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin-auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  MCP_OAUTH_COOKIE_NAME,
  parseOAuthPendingCookie,
} from "@/lib/oauth/cookie";
import { createAuthorizationCode } from "@/lib/oauth/codes";
import { buildOAuthRedirectUrl } from "@/lib/oauth/validate";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const decoded = await verifyFirebaseIdToken(idToken);

    const cookieStore = await cookies();
    const raw = cookieStore.get(MCP_OAUTH_COOKIE_NAME)?.value;
    const pending = parseOAuthPendingCookie(raw);

    if (!pending) {
      return NextResponse.json({ error: "no_pending_authorization" }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action;

    cookieStore.delete(MCP_OAUTH_COOKIE_NAME);

    if (action === "deny") {
      return NextResponse.json({
        redirectUrl: buildOAuthRedirectUrl(pending.redirectUri, {
          error: "access_denied",
          state: pending.state,
        }),
      });
    }

    if (action !== "accept") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    try {
      await requireAdmin(decoded.uid);
    } catch {
      return NextResponse.json({
        redirectUrl: buildOAuthRedirectUrl(pending.redirectUri, {
          error: "access_denied",
          error_description: "Admin access required",
          state: pending.state,
        }),
      });
    }

    const code = await createAuthorizationCode({
      uid: decoded.uid,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: pending.codeChallengeMethod,
      scopes: pending.scopes,
      state: pending.state,
    });

    return NextResponse.json({
      redirectUrl: buildOAuthRedirectUrl(pending.redirectUri, {
        code,
        state: pending.state,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "consent_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
