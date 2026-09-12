import { NextResponse } from "next/server";

import { getAdminActorFromRequest } from "@/lib/cms/auth";
import { parseSubscriberInput, summarizeSubscribers } from "@/lib/email-list/schema";
import {
  addSubscribers,
  listSubscribers,
  removeSubscriber,
  updateSubscriber,
} from "@/lib/email-list/subscribers.server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isMailgunConfigured } from "@/lib/mailgun/settings.server";

export const runtime = "nodejs";

/**
 * Emailing list members.
 *
 * GET    — every subscriber plus counts and whether sending is possible
 * POST   — { text } pasted addresses, or { entries: [{ email, name }] }
 * PATCH  — { id, name?, status? }
 * DELETE — ?id=
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminActorFromRequest(request);

    const subscribers = await listSubscribers();
    return NextResponse.json({
      subscribers,
      stats: summarizeSubscribers(subscribers),
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
    const body = await request.json().catch(() => ({}));

    const parsed =
      typeof body.text === "string"
        ? parseSubscriberInput(body.text)
        : { entries: Array.isArray(body.entries) ? body.entries : [], invalid: [] };

    if (parsed.entries.length === 0) {
      return NextResponse.json(
        {
          error:
            parsed.invalid.length > 0
              ? `No valid addresses found. Check: ${parsed.invalid.slice(0, 3).join(", ")}`
              : "Enter at least one email address.",
        },
        { status: 400 },
      );
    }

    const result = await addSubscribers(parsed.entries, {
      source: body.source,
      resubscribe: body.resubscribe === true,
      actor,
      auditSource: "ui",
    });

    const subscribers = await listSubscribers();
    return NextResponse.json({
      ...result,
      invalid: [...parsed.invalid, ...result.invalid],
      subscribers,
      stats: summarizeSubscribers(subscribers),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);
    const body = await request.json().catch(() => ({}));

    if (!body.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const subscriber = await updateSubscriber(
      body.id,
      { name: body.name, status: body.status, note: body.note },
      { actor, auditSource: "ui" },
    );

    return NextResponse.json({ subscriber });
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

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const result = await removeSubscriber(id, { actor, auditSource: "ui" });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

/** @param {unknown} err */
function errorResponse(err) {
  const message = err instanceof Error ? err.message : "Request failed";
  if (message === "Missing authorization" || message === "Admin access required") {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  if (message === "Subscriber not found.") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
