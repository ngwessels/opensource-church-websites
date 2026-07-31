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

  const intentions = pending.map((row) => ({
    name: String(row.name || "Anonymous"),
    intention: String(row.intention || ""),
  }));

  let sent = 0;
  for (const group of groupsWithEmail) {
    const result = await sendPrayerIntentionsDigestEmail({
      to: group.emails,
      groupName: group.name,
      intentions,
      siteName,
    });
    if (result.sent) sent += 1;
  }

  if (sent === 0) {
    return {
      sent: 0,
      skipped: true,
      intentionCount: pending.length,
      groupCount: groupsWithEmail.length,
      reason: "Mailgun failed to send digests.",
    };
  }

  const digestedAt = new Date().toISOString();
  const batch = db.batch();
  for (const row of pending) {
    batch.update(db.collection(COLLECTIONS.prayerIntentions).doc(row.id), {
      includedInDigestAt: digestedAt,
    });
  }
  await batch.commit();

  await updatePrayerIntentionsSettingsPatch(settings, { lastDigestAt: digestedAt });

  return {
    sent,
    skipped: false,
    intentionCount: pending.length,
    groupCount: groupsWithEmail.length,
  };
}
