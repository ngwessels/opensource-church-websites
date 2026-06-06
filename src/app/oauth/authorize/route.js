import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getAuthCodeTtlSeconds } from "@/lib/oauth/config";
import {
  MCP_OAUTH_COOKIE_NAME,
  oauthPendingCookieOptions,
  serializeOAuthPendingCookie,
} from "@/lib/oauth/cookie";
import { validateAuthorizeRequest } from "@/lib/oauth/validate";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const pending = await validateAuthorizeRequest(searchParams);

    const cookieStore = await cookies();
    cookieStore.set(
      MCP_OAUTH_COOKIE_NAME,
      serializeOAuthPendingCookie(pending),
      oauthPendingCookieOptions(getAuthCodeTtlSeconds()),
    );

    const consentUrl = new URL("/oauth/consent", request.url);
    return NextResponse.redirect(consentUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
