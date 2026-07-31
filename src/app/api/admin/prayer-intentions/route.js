import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { getAdminActorFromRequest, getAdminUserFromRequest } from "@/lib/cms/auth";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  getPrayerIntentionsSettings,
  sendPrayerIntentionsDigest,
  updatePrayerIntentionsSettingsPatch,
} from "@/lib/prayer-intentions/digest";
import { normalizePrayerIntentionsSettings } from "@/lib/prayer-intentions/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET — list intentions (optional ?status=approved|rejected&export=csv)
 * PATCH — { intentionIds, status } override moderation
 * PUT — { settings } save prayer groups / digest config
 * POST — { action: "send_digest" } send digest now
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminUserFromRequest(request);

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    let query = db.collection(COLLECTIONS.prayerIntentions);
    if (statusFilter === "approved" || statusFilter === "rejected") {
      query = query.where("status", "==", statusFilter);
    }

    const snap = await query.get();
    const intentions = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));

    if (searchParams.get("export") === "csv") {
      const header = [
        "Submitted At",
        "Status",
        "Name",
        "Email",
        "Phone",
        "Intention",
        "Moderation Reason",
        "Included In Digest At",
      ];
      const rows = intentions.map((row) => [
        row.submittedAt || "",
        row.status || "",
        row.name || "",
        row.email || "",
        row.phone || "",
        row.intention || "",
        row.moderation?.reason || "",
        row.includedInDigestAt || "",
      ]);
      const csv = [header, ...rows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="prayer-intentions.csv"',
        },
      });
    }

    const settings = await getPrayerIntentionsSettings();
    return NextResponse.json({ intentions, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);
    const body = await request.json();
    const intentionIds = Array.isArray(body.intentionIds) ? body.intentionIds : [];
    const status = body.status;

    if (intentionIds.length === 0) {
      return NextResponse.json({ error: "intentionIds is required." }, { status: 400 });
    }
    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "status must be approved or rejected." }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const reviewedAt = new Date().toISOString();
    const reviewedBy = { uid: actor.uid, email: actor.email || "" };
    const beforeSnapshots = [];
    const afterSnapshots = [];

    for (const id of intentionIds) {
      if (typeof id !== "string") continue;
      const ref = db.collection(COLLECTIONS.prayerIntentions).doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      beforeSnapshots.push({ id: snap.id, ...snap.data() });
      await ref.update({
        status,
        reviewedBy,
        reviewedAt,
        ...(status === "rejected" ? { includedInDigestAt: null } : {}),
      });
      const after = await ref.get();
      afterSnapshots.push({ id: after.id, ...after.data() });
    }

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: { type: "prayer_intention", apiRoute: "/api/admin/prayer-intentions" },
      summary: `Set ${beforeSnapshots.length} prayer intention(s) to ${status}`,
      before: beforeSnapshots,
      after: afterSnapshots,
    });

    return NextResponse.json({ updated: beforeSnapshots.length, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);
    const body = await request.json();
    const settings = normalizePrayerIntentionsSettings(body.settings ?? body);

    const before = await getPrayerIntentionsSettings();
    const after = await updatePrayerIntentionsSettingsPatch(settings, {
      lastDigestAt: before.lastDigestAt,
    });

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: { type: "site_config", id: "config", path: "site/config", apiRoute: "/api/admin/prayer-intentions" },
      summary: "Updated prayer intentions settings",
      before: { prayerIntentions: before },
      after: { prayerIntentions: after },
      context: { builderPath: "/builder/admin", section: "prayer" },
    });

    return NextResponse.json({ settings: after });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    const actor = await getAdminActorFromRequest(request);
    const body = await request.json().catch(() => ({}));

    if (body.action !== "send_digest") {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const result = await sendPrayerIntentionsDigest();

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: { type: "prayer_intention", apiRoute: "/api/admin/prayer-intentions" },
      summary: result.skipped
        ? `Prayer intentions digest skipped (${result.reason || "no send"})`
        : `Sent prayer intentions digest (${result.intentionCount} intention(s) to ${result.sent} group(s))`,
      after: result,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
