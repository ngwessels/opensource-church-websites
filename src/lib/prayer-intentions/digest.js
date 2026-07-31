import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { sendPrayerIntentionsDigestEmail } from "@/lib/mailgun/client";

import { normalizePrayerIntentionsSettings } from "./schema.js";

/**
 * @returns {Promise<import('./schema.js').PrayerIntentionsSettings>}
 */
export async function getPrayerIntentionsSettings() {
  const db = getFirebaseAdminFirestore();
  if (!db) return normalizePrayerIntentionsSettings(null);

  const snap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  const data = snap.exists ? snap.data() : {};
  return normalizePrayerIntentionsSettings(data?.prayerIntentions);
}

/**
 * @param {import('./schema.js').PrayerIntentionsSettings} settings
 * @param {{ lastDigestAt?: string | null }} [patch]
 */
export async function updatePrayerIntentionsSettingsPatch(settings, patch = {}) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Server is not configured.");

  const next = {
    ...settings,
    ...patch,
  };

  await db
    .collection(COLLECTIONS.site)
    .doc(SITE_CONFIG_ID)
    .set(
      {
        prayerIntentions: next,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  return next;
}

/**
 * @returns {Promise<{ sent: number, skipped: boolean, intentionCount: number, groupCount: number, reason?: string }>}
 */
export async function sendPrayerIntentionsDigest() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Server is not configured.");

  const settings = await getPrayerIntentionsSettings();
  const groupsWithEmail = settings.groups.filter((g) => g.emails.length > 0);

  const configSnap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  const siteName = configSnap.exists ? String(configSnap.data()?.name || "Parish") : "Parish";

  const snap = await db
    .collection(COLLECTIONS.prayerIntentions)
    .where("status", "==", "approved")
    .get();

  const pending = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((row) => !row.includedInDigestAt)
    .sort((a, b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")));

  if (pending.length === 0) {
    return {
      sent: 0,
      skipped: true,
      intentionCount: 0,
      groupCount: groupsWithEmail.length,
      reason: "No approved intentions pending digest.",
    };
  }

  if (groupsWithEmail.length === 0) {
    return {
      sent: 0,
      skipped: true,
      intentionCount: pending.length,
      groupCount: 0,
      reason: "No prayer groups have recipient emails configured.",
    };
  }

  let sent = 0;
  /** @type {Set<string>} */
  const digestedIds = new Set();

  for (const group of groupsWithEmail) {
    const forGroup = pending.filter((row) => {
      const ids = Array.isArray(row.groupIds) ? row.groupIds.map(String) : [];
      // Legacy approved rows without groupIds go to every configured group.
      if (ids.length === 0) return true;
      return ids.includes(group.id);
    });

    if (forGroup.length === 0) continue;

    const intentions = forGroup.map((row) => ({
      name: String(row.name || "Anonymous"),
      intention: String(row.intention || ""),
    }));

    const result = await sendPrayerIntentionsDigestEmail({
      to: group.emails,
      groupName: group.name,
      intentions,
      siteName,
    });
    if (result.sent) {
      sent += 1;
      for (const row of forGroup) digestedIds.add(row.id);
    }
  }

  if (sent === 0) {
    return {
      sent: 0,
      skipped: true,
      intentionCount: pending.length,
      groupCount: groupsWithEmail.length,
      reason: "Mailgun failed to send digests, or no groups matched pending intentions.",
    };
  }

  const digestedAt = new Date().toISOString();
  const batch = db.batch();
  for (const id of digestedIds) {
    batch.update(db.collection(COLLECTIONS.prayerIntentions).doc(id), {
      includedInDigestAt: digestedAt,
    });
  }
  await batch.commit();

  await updatePrayerIntentionsSettingsPatch(settings, { lastDigestAt: digestedAt });

  return {
    sent,
    skipped: false,
    intentionCount: digestedIds.size,
    groupCount: groupsWithEmail.length,
  };
}
