import { NextResponse } from "next/server";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { sendFormNotification } from "@/lib/mailgun/client";
import { getPrayerIntentionsSettings } from "@/lib/prayer-intentions/digest";
import { findPublishedPrayerIntentionsByInstanceId } from "@/lib/prayer-intentions/lookup";
import { moderatePrayerIntention } from "@/lib/prayer-intentions/moderate";
import {
  DEFAULT_SUCCESS_MESSAGE,
  validatePrayerIntentionSubmission,
} from "@/lib/prayer-intentions/schema";
import { getSubmissionIpGeoFromRequest } from "@/lib/request/ip-geo";
import { generateId } from "@/lib/sitemap/tree";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const moduleInstanceId = formData.get("moduleInstanceId");

    if (typeof moduleInstanceId !== "string" || !moduleInstanceId.trim()) {
      return NextResponse.json({ error: "moduleInstanceId is required." }, { status: 400 });
    }

    const found = await findPublishedPrayerIntentionsByInstanceId(moduleInstanceId.trim());
    if (!found) {
      return NextResponse.json({ error: "Prayer intentions form not found." }, { status: 404 });
    }

    const { config, pageId, pageTitle, moduleId } = found;

    const honeypot = formData.get(config.honeypotFieldName);
    if (typeof honeypot === "string" && honeypot.trim()) {
      return NextResponse.json({ success: true, message: DEFAULT_SUCCESS_MESSAGE });
    }

    const validation = validatePrayerIntentionSubmission({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      intention: formData.get("intention"),
    });
    if (!validation.ok) {
      return NextResponse.json({ error: "Validation failed.", errors: validation.errors }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const settings = await getPrayerIntentionsSettings();
    const intentionId = generateId();
    const submittedAt = new Date().toISOString();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";
    const { ipAddress, ipCountry, ipCity } = getSubmissionIpGeoFromRequest(request);
    const ref = db.collection(COLLECTIONS.prayerIntentions).doc(intentionId);

    // Persist first so AI failures never drop the submission from Admin.
    await ref.set({
      name: validation.values.name,
      email: validation.values.email,
      phone: validation.values.phone,
      intention: validation.values.intention,
      ipAddress,
      ipCountry,
      ipCity,
      status: "rejected",
      groupIds: [],
      moderation: {
        model,
        moderatedAt: submittedAt,
        isPrayerIntention: false,
        isSpam: false,
        hasNegativeImpact: false,
        reason: "Awaiting moderation.",
        error: "moderation_pending",
      },
      pageId,
      moduleId,
      moduleInstanceId: config.moduleInstanceId,
      pageTitle,
      submittedAt,
      reviewedBy: null,
      reviewedAt: null,
      includedInDigestAt: null,
    });

    let status = "rejected";
    let groupIds = /** @type {string[]} */ ([]);
    let moderation = {
      model,
      moderatedAt: submittedAt,
      isPrayerIntention: false,
      isSpam: false,
      hasNegativeImpact: false,
      reason: "Moderation unavailable; held for review.",
      error: "moderation_unavailable",
    };

    try {
      const result = await moderatePrayerIntention(validation.values, settings.groups);
      status = result.status;
      groupIds = result.groupIds;
      moderation = result.moderation;
      await ref.update({ status, groupIds, moderation });
    } catch (moderationErr) {
      console.error("[prayer-intentions/submit] moderation update failed:", moderationErr);
      try {
        await ref.update({ status: "rejected", groupIds: [], moderation });
      } catch (updateErr) {
        console.error("[prayer-intentions/submit] failed to mark moderation unavailable:", updateErr);
      }
    }

    if (status === "approved" && config.notificationEmails.length > 0) {
      const groupNames = settings.groups
        .filter((g) => groupIds.includes(g.id))
        .map((g) => g.name)
        .join(", ");
      await sendFormNotification({
        to: config.notificationEmails,
        formTitle: config.title || "Prayer Intentions",
        pageTitle,
        rows: [
          { label: "Name", value: validation.values.name },
          ...(validation.values.email
            ? [{ label: "Email", value: validation.values.email }]
            : []),
          ...(validation.values.phone
            ? [{ label: "Phone", value: validation.values.phone }]
            : []),
          { label: "Intention", value: validation.values.intention },
          { label: "Status", value: "Approved" },
          ...(groupNames ? [{ label: "Assigned groups", value: groupNames }] : []),
        ],
      });
    }

    return NextResponse.json({
      success: true,
      message: DEFAULT_SUCCESS_MESSAGE,
      intentionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed.";
    console.error("[prayer-intentions/submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
