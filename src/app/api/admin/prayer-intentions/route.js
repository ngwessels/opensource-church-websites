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
 * GET — list intentions (optional ?status=approved|rejected&groupId=&dateFrom=&dateTo=&export=csv)
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
    const groupIdFilter = searchParams.get("groupId")?.trim() || "";
    const dateFromRaw = searchParams.get("dateFrom")?.trim() || "";
    const dateToRaw = searchParams.get("dateTo")?.trim() || "";
    const dateFromMs = dateFromRaw
      ? new Date(dateFromRaw.includes("T") ? dateFromRaw : `${dateFromRaw}T00:00:00`).getTime()
      : NaN;
    const dateToMs = dateToRaw
      ? new Date(dateToRaw.includes("T") ? dateToRaw : `${dateToRaw}T23:59:59.999`).getTime()
      : NaN;

    let query = db.collection(COLLECTIONS.prayerIntentions);
    if (statusFilter === "approved" || statusFilter === "rejected") {
      query = query.where("status", "==", statusFilter);
    }

    const snap = await query.get();
    const intentions = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((row) => {
        if (Number.isFinite(dateFromMs) || Number.isFinite(dateToMs)) {
          const submittedMs = row.submittedAt ? new Date(String(row.submittedAt)).getTime() : NaN;
          if (!Number.isFinite(submittedMs)) return false;
          if (Number.isFinite(dateFromMs) && submittedMs < dateFromMs) return false;
          if (Number.isFinite(dateToMs) && submittedMs > dateToMs) return false;
        }
        if (groupIdFilter) {
          const ids = Array.isArray(row.groupIds)
            ? row.groupIds.filter((id) => typeof id === "string")
            : [];
          // Legacy approved rows without groupIds were treated as all groups.
          if (ids.length === 0) return row.status === "approved";
          if (!ids.includes(groupIdFilter)) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));

    if (searchParams.get("export") === "csv") {
      const settings = await getPrayerIntentionsSettings();
      const groupNameById = new Map(settings.groups.map((g) => [g.id, g.name]));
      const header = [
        "Submitted At",
        "Status",
        "Name",
        "Email",
        "Phone",
        "IP Address",
        "IP Country",
        "IP City",
        "Intention",
        "Assigned Groups",
        "Moderation Reason",
        "Included In Digest At",
      ];
      const rows = intentions.map((row) => [
        row.submittedAt || "",
        row.status || "",
        row.name || "",
        row.email || "",
        row.phone || "",
        row.ipAddress || "",
        row.ipCountry || "",
        row.ipCity || "",
        row.intention || "",
        Array.isArray(row.groupIds)
          ? row.groupIds
              .filter((id) => typeof id === "string")
              .map((id) => groupNameById.get(id) || id)
              .join("; ")
          : "",
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
    const settings = await getPrayerIntentionsSettings();
    const allGroupIds = settings.groups.map((g) => g.id);

    for (const id of intentionIds) {
      if (typeof id !== "string") continue;
      const ref = db.collection(COLLECTIONS.prayerIntentions).doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const existing = snap.data() || {};
      beforeSnapshots.push({ id: snap.id, ...existing });

      /** @type {Record<string, unknown>} */
      const patch = {
        status,
        reviewedBy,
        reviewedAt,
      };

      if (status === "rejected") {
        patch.includedInDigestAt = null;
        patch.groupIds = [];
      } else {
        const existingGroups = Array.isArray(existing.groupIds)
          ? existing.groupIds.filter((g) => typeof g === "string")
          : [];
        // Human approve: keep AI groups if present, otherwise assign all groups.
        patch.groupIds = existingGroups.length > 0 ? existingGroups : allGroupIds;
      }

      await ref.update(patch);
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
