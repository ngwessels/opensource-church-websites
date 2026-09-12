import { NextResponse } from "next/server";

import { getAdminActorFromRequest } from "@/lib/cms/auth";
import { buildBulletinCampaign } from "@/lib/email-list/bulletin-email.server";
import { listCampaigns, sendCampaign, sendCampaignTest } from "@/lib/email-list/campaigns.server";
import { normalizeCampaignKind, validateCampaignInput } from "@/lib/email-list/schema";
import { getSubscriberStats } from "@/lib/email-list/subscribers.server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isMailgunConfigured } from "@/lib/mailgun/settings.server";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sends to the emailing list.
 *
 * GET  — recent campaigns and whether sending is currently possible
 * POST — { action: "send" | "send_test", subject, html, attachments, kind, bulletinId }
 *
 * A `bulletin` campaign only needs `bulletinId` and an optional `html` intro:
 * the subject, the link, and the PDF attachment are composed on the server.
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminActorFromRequest(request);

    const limitParam = Number(new URL(request.url).searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;

    return NextResponse.json({
      campaigns: await listCampaigns({ limit }),
      stats: await getSubscriberStats(),
      mailgunConfigured: await isMailgunConfigured(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);

    if (!(await isMailgunConfigured())) {
      return NextResponse.json(
        { error: "Connect Mailgun under Admin → Email before sending to the list." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const kind = normalizeCampaignKind(body.kind);
    const composed = await composeMessage(body, kind);

    const validation = validateCampaignInput({
      subject: composed.subject,
      html: composed.bodyHtml,
      attachments: composed.attachments,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    switch (body.action) {
      case "send_test": {
        const to = typeof body.testTo === "string" && body.testTo.trim() ? body.testTo.trim() : actor.email;
        if (!to) {
          return NextResponse.json({ error: "Enter an address to send the test to." }, { status: 400 });
        }
        const result = await sendCampaignTest({
          to,
          subject: composed.subject,
          bodyHtml: composed.bodyHtml,
          attachments: composed.attachments,
        });
        if (!result.sent) {
          return NextResponse.json({ error: result.error || "Test send failed." }, { status: 400 });
        }
        return NextResponse.json({ sent: true, to, messageId: result.messageId });
      }

      case "send": {
        const campaign = await sendCampaign({
          subject: composed.subject,
          bodyHtml: composed.bodyHtml,
          kind,
          attachments: composed.attachments,
          bulletinId: composed.bulletinId,
          bulletinUrl: composed.bulletinUrl,
          actor,
          auditSource: "ui",
        });
        return NextResponse.json({ campaign });
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * @param {Record<string, any>} body
 * @param {import('@/lib/email-list/schema.js').EmailCampaignKind} kind
 * @returns {Promise<{
 *   subject: string,
 *   bodyHtml: string,
 *   attachments: Array<Record<string, unknown>>,
 *   bulletinId: string,
 *   bulletinUrl: string,
 * }>}
 */
async function composeMessage(body, kind) {
  const introHtml = typeof body.html === "string" ? body.html : "";
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  switch (kind) {
    case "bulletin": {
      const bulletin = await buildBulletinCampaign({
        bulletinId: body.bulletinId,
        introHtml,
        attachPdf: body.attachPdf !== false,
      });
      return {
        subject:
          typeof body.subject === "string" && body.subject.trim()
            ? body.subject.trim()
            : bulletin.subject,
        bodyHtml: bulletin.bodyHtml,
        attachments: [...bulletin.attachments, ...attachments],
        bulletinId: String(body.bulletinId || ""),
        bulletinUrl: bulletin.bulletinUrl,
      };
    }

    case "newsletter":
    default:
      return {
        subject: typeof body.subject === "string" ? body.subject.trim() : "",
        bodyHtml: introHtml,
        attachments,
        bulletinId: "",
        bulletinUrl: "",
      };
  }
}

/** @param {unknown} err */
function errorResponse(err) {
  const message = err instanceof Error ? err.message : "Request failed";
  if (message === "Missing authorization" || message === "Admin access required") {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  if (message === "Bulletin not found.") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
