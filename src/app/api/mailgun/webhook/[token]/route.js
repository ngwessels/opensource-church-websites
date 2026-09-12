import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeMailgunWebhookEvent } from "@/lib/mailgun/events";
import { recordMailgunEvent } from "@/lib/mailgun/messages.server";
import { getMailgunSettings } from "@/lib/mailgun/settings.server";
import { timingSafeCompare, verifyMailgunSignature } from "@/lib/mailgun/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mailgun delivery events (delivered, opened, clicked, failed, …).
 *
 * The URL carries a per-site secret that Mailgun echoes back on every call, and
 * the payload signature is verified as well when the operator supplied an HTTP
 * webhook signing key.
 *
 * @param {Request} request
 * @param {{ params: Promise<{ token: string }> }} context
 */
export async function POST(request, { params }) {
  const { token } = await params;

  if (!isFirebaseAdminConfigured()) {
    // 503 so Mailgun retries once the server is configured.
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  }

  const settings = await getMailgunSettings();

  if (!settings.webhook.secret || !timingSafeCompare(settings.webhook.secret, token)) {
    return NextResponse.json({ error: "Unknown webhook token." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Webhook payload must be JSON." }, { status: 400 });
  }

  if (settings.webhookSigningKey) {
    const verified = verifyMailgunSignature(body?.signature, settings.webhookSigningKey);
    if (!verified.ok) {
      console.warn("[mailgun/webhook] rejected:", verified.error);
      return NextResponse.json({ error: verified.error }, { status: 401 });
    }
  }

  const normalized = normalizeMailgunWebhookEvent(body);
  if (!normalized.ok) {
    // 200 so Mailgun stops retrying an event we will never be able to use.
    console.warn("[mailgun/webhook] ignored:", normalized.error);
    return NextResponse.json({ ignored: true, reason: normalized.error });
  }

  try {
    const result = await recordMailgunEvent(normalized.event);
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      event: normalized.event.type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record the event.";
    console.error("[mailgun/webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
