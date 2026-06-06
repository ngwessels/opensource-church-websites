import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { MCP_OAUTH_COOKIE_NAME, parseOAuthPendingCookie } from "@/lib/oauth/cookie";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MCP_OAUTH_COOKIE_NAME)?.value;
  const pending = parseOAuthPendingCookie(raw);

  if (!pending) {
    return NextResponse.json({ error: "no_pending_authorization" }, { status: 404 });
  }

  return NextResponse.json({
    clientId: pending.clientId,
    clientName: pending.clientName,
    scopes: pending.scopes,
    redirectUri: pending.redirectUri,
  });
}
