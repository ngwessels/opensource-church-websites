import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listEventsForMessage, listRecentEmailMessages } from "@/lib/mailgun/messages.server";

export const runtime = "nodejs";

/**
 * Recent outbound email with its delivery status.
 *
 * `?messageId=` returns the individual Mailgun events recorded for one message.
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminUserFromRequest(request);

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId")?.trim() || "";

    if (messageId) {
      return NextResponse.json({ messageId, events: await listEventsForMessage(messageId) });
    }

    const limitParam = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
    const kind = searchParams.get("kind")?.trim() || undefined;

    return NextResponse.json({ messages: await listRecentEmailMessages({ limit, kind }) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
