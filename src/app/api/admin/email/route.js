import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { getAdminActorFromRequest } from "@/lib/cms/auth";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { sendMailgunTestEmail } from "@/lib/mailgun/client";
import { MAILGUN_WEBHOOK_IDS } from "@/lib/mailgun/events";
import { describeMailgunForwardingAction } from "@/lib/mailgun/forwarding";
import {
  deleteMailgunForwardingRoute,
  syncMailgunForwardingRoute,
} from "@/lib/mailgun/forwarding.server";
import {
  buildMailgunWebhookUrl,
  confirmWebhooksManually,
  describeMailgunSettings,
  mergeWebhookRegistrationResult,
  normalizeMailgunSettings,
  resolveMailgunConfig,
  validateMailgunSettings,
} from "@/lib/mailgun/settings";
import {
  deleteMailgunSettings,
  getMailgunSettings,
  saveMailgunSettings,
} from "@/lib/mailgun/settings.server";
import { generateWebhookSecret } from "@/lib/mailgun/signature";
import {
  deleteMailgunWebhooks,
  registerMailgunWebhooks,
  verifyMailgunDomain,
} from "@/lib/mailgun/webhooks.server";
import { getSiteBaseUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Mailgun integration settings.
 *
 * GET    — current status (secrets masked)
 * PUT    — save alias + API key, verify with Mailgun, register webhooks and the
 *          inbound forwarding route
 * POST   — { action: "send_test" | "register_webhooks" | "confirm_webhooks" }
 * DELETE — disconnect and remove the webhooks and route we registered
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminActorFromRequest(request);

    const settings = await getMailgunSettings();
    return NextResponse.json(await buildStatusResponse(settings));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);
    const body = await request.json();

    const current = await getMailgunSettings();
    const candidate = normalizeMailgunSettings({
      ...current,
      ...pickDefined(body, [
        "alias",
        "region",
        "sendingDomain",
        "trackOpens",
        "trackClicks",
        "forwardTo",
        "enabled",
      ]),
      // A blank secret means "keep the stored one" so admins can edit the alias
      // without retyping their key.
      apiKey: keepOrReplaceSecret(current.apiKey, body.apiKey),
      webhookSigningKey: keepOrReplaceSecret(current.webhookSigningKey, body.webhookSigningKey),
      webhook: { ...current.webhook, secret: current.webhook.secret || generateWebhookSecret() },
    });

    const validation = validateMailgunSettings(candidate);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const config = resolveMailgunConfig(candidate, {});
    const verification = await verifyMailgunDomain(config);
    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const webhookUrl = buildMailgunWebhookUrl(await siteBaseUrl(), candidate.webhook.secret);
    const registration = candidate.enabled
      ? await registerMailgunWebhooks(config, webhookUrl)
      : { registered: [], failed: [] };

    // Clearing the address removes the route, so forwarding stops as soon as
    // the field is emptied.
    const forwarding = await syncMailgunForwardingRoute(config, {
      forwardTo: candidate.forwardTo,
      route: current.inboundRoute,
    });

    const saved = await saveMailgunSettings(
      {
        ...candidate,
        webhook: mergeWebhookRegistrationResult(current.webhook, registration, webhookUrl),
        inboundRoute: forwarding.route,
      },
      { actorEmail: actor.email },
    );

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: {
        type: "email_integration",
        id: "mailgun",
        path: "integrations/mailgun",
        apiRoute: "/api/admin/email",
      },
      summary: [
        `Updated Mailgun email settings (${saved.alias})`,
        describeMailgunForwardingAction(forwarding.plan),
      ]
        .filter(Boolean)
        .join(" — "),
      before: auditSnapshot(current),
      after: auditSnapshot(saved),
      context: { builderPath: "/builder/admin", section: "email" },
    });

    return NextResponse.json({
      ...(await buildStatusResponse(saved)),
      domainState: verification.state,
      registration,
      forwarding: {
        action: forwarding.plan.action,
        summary: describeMailgunForwardingAction(forwarding.plan),
        error: forwarding.error,
      },
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
    const body = await request.json().catch(() => ({}));
    const settings = await getMailgunSettings();
    const config = resolveMailgunConfig(settings, process.env);

    if (!config.configured) {
      return NextResponse.json({ error: "Mailgun is not configured." }, { status: 400 });
    }

    switch (body.action) {
      case "send_test": {
        const to = typeof body.to === "string" ? body.to.trim() : actor.email;
        if (!to) {
          return NextResponse.json({ error: "Enter an address to send the test to." }, { status: 400 });
        }
        const result = await sendMailgunTestEmail({ to, siteName: await siteName() });
        if (!result.sent) {
          return NextResponse.json({ error: result.error || "Test send failed." }, { status: 400 });
        }
        return NextResponse.json({ sent: true, to, messageId: result.messageId });
      }

      case "register_webhooks": {
        const secret = settings.webhook.secret || generateWebhookSecret();
        const webhookUrl = buildMailgunWebhookUrl(await siteBaseUrl(), secret);
        const registration = await registerMailgunWebhooks(config, webhookUrl);
        // Re-registering is the repair button, so push the forwarding route
        // back out even when nothing about it changed.
        const forwarding = await syncMailgunForwardingRoute(config, {
          forwardTo: settings.forwardTo,
          route: settings.inboundRoute,
          force: true,
        });
        const saved = await saveMailgunSettings(
          {
            webhook: {
              secret,
              ...mergeWebhookRegistrationResult(settings.webhook, registration, webhookUrl),
            },
            inboundRoute: forwarding.route,
          },
          { actorEmail: actor.email },
        );
        return NextResponse.json({
          ...(await buildStatusResponse(saved)),
          registration,
          forwarding: {
            action: forwarding.plan.action,
            summary: describeMailgunForwardingAction(forwarding.plan),
            error: forwarding.error,
          },
        });
      }

      case "confirm_webhooks": {
        const secret = settings.webhook.secret || generateWebhookSecret();
        const webhookUrl = buildMailgunWebhookUrl(await siteBaseUrl(), secret);
        const saved = await saveMailgunSettings(
          {
            webhook: {
              secret,
              ...confirmWebhooksManually(settings.webhook, webhookUrl),
            },
          },
          { actorEmail: actor.email },
        );
        await recordAuditEvent({
          action: "update",
          actor,
          source: "api",
          resource: {
            type: "email_integration",
            id: "mailgun",
            path: "integrations/mailgun",
            apiRoute: "/api/admin/email",
          },
          summary: "Marked Mailgun delivery webhooks as registered manually",
          before: auditSnapshot(settings),
          after: auditSnapshot(saved),
          context: { builderPath: "/builder/admin", section: "email" },
        });
        return NextResponse.json({
          ...(await buildStatusResponse(saved)),
          confirmed: true,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);

    const current = await getMailgunSettings();
    const config = resolveMailgunConfig(current, {});
    if (config.configured) {
      await deleteMailgunWebhooks(config);
      if (current.inboundRoute.id) {
        await deleteMailgunForwardingRoute(config, current.inboundRoute.id).catch((err) => {
          console.warn(
            "[mailgun] Could not remove the forwarding route:",
            err instanceof Error ? err.message : err,
          );
        });
      }
    }
    await deleteMailgunSettings();

    await recordAuditEvent({
      action: "delete",
      actor,
      source: "api",
      resource: {
        type: "email_integration",
        id: "mailgun",
        path: "integrations/mailgun",
        apiRoute: "/api/admin/email",
      },
      summary: "Disconnected Mailgun email settings",
      before: auditSnapshot(current),
      context: { builderPath: "/builder/admin", section: "email" },
    });

    return NextResponse.json(await buildStatusResponse(null));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Copy only the keys the request actually sent, so a partial save keeps the
 * stored values for everything else.
 *
 * @param {Record<string, unknown>} body
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function pickDefined(body, keys) {
  /** @type {Record<string, unknown>} */
  const picked = {};
  for (const key of keys) {
    if (body[key] !== undefined) picked[key] = body[key];
  }
  return picked;
}

/**
 * `""` clears a stored secret, a non-empty value replaces it, and `undefined`
 * leaves it untouched.
 *
 * @param {string} stored
 * @param {unknown} submitted
 * @returns {string}
 */
function keepOrReplaceSecret(stored, submitted) {
  if (typeof submitted !== "string") return stored;
  const trimmed = submitted.trim();
  if (trimmed) return trimmed;
  return submitted === "" ? "" : stored;
}

/**
 * @param {import('@/lib/mailgun/settings.js').MailgunSettings | null} settings
 */
async function buildStatusResponse(settings) {
  const status = describeMailgunSettings(settings, process.env);
  return {
    settings: status,
    webhookUrl: settings?.webhook?.secret
      ? buildMailgunWebhookUrl(await siteBaseUrl(), settings.webhook.secret)
      : "",
    webhookEvents: MAILGUN_WEBHOOK_IDS,
    envFallback: {
      active: status.source === "env",
      available: Boolean(
        process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN && process.env.MAILGUN_FROM,
      ),
    },
  };
}

/**
 * Audit snapshots must never contain the API key or signing key.
 *
 * @param {import('@/lib/mailgun/settings.js').MailgunSettings | null} settings
 */
function auditSnapshot(settings) {
  const status = describeMailgunSettings(settings, {});
  return { ...status, webhook: { ...status.webhook, url: status.webhook.url ? "[redacted]" : "" } };
}

async function siteConfig() {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  const snap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  return snap.exists ? snap.data() : null;
}

async function siteBaseUrl() {
  return getSiteBaseUrl(await siteConfig());
}

async function siteName() {
  const config = await siteConfig();
  return typeof config?.name === "string" && config.name ? config.name : "your church website";
}

/** @param {unknown} err */
function errorResponse(err) {
  const message = err instanceof Error ? err.message : "Request failed";
  const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}
