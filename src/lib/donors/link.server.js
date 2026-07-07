import "server-only";

import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeDonorEmail } from "@/lib/donors/email";

/**
 * Collect Stripe customer IDs from past donations for an email address.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} email
 * @returns {Promise<string[]>}
 */
export async function collectStripeCustomerIdsForEmail(db, email) {
  const normalized = normalizeDonorEmail(email);
  if (!normalized) return [];

  const ids = new Set();

  const byNormalized = await db
    .collection(COLLECTIONS.donations)
    .where("donorEmailNormalized", "==", normalized)
    .get();

  for (const doc of byNormalized.docs) {
    const customerId = doc.data()?.stripeCustomerId;
    if (typeof customerId === "string" && customerId) {
      ids.add(customerId);
    }
  }

  if (email.trim() !== normalized) {
    const byRaw = await db
      .collection(COLLECTIONS.donations)
      .where("donorEmail", "==", email.trim())
      .get();

    for (const doc of byRaw.docs) {
      const customerId = doc.data()?.stripeCustomerId;
      if (typeof customerId === "string" && customerId) {
        ids.add(customerId);
      }
    }
  }

  return [...ids];
}

/**
 * Link donations and subscriptions to a donor account and merge Stripe customer IDs.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} uid
 * @param {string} email
 * @param {string[]} [existingCustomerIds]
 * @returns {Promise<string[]>}
 */
export async function linkDonorRecordsByEmail(db, uid, email, existingCustomerIds = []) {
  const normalized = normalizeDonorEmail(email);
  if (!normalized) return existingCustomerIds;

  const stripeCustomerIds = new Set(existingCustomerIds);
  for (const id of await collectStripeCustomerIdsForEmail(db, email)) {
    stripeCustomerIds.add(id);
  }

  const batch = db.batch();
  let writes = 0;

  const donationQueries = [
    db.collection(COLLECTIONS.donations).where("donorEmailNormalized", "==", normalized),
  ];
  if (email.trim() !== normalized) {
    donationQueries.push(
      db.collection(COLLECTIONS.donations).where("donorEmail", "==", email.trim()),
    );
  }

  const donationDocs = new Map();
  for (const query of donationQueries) {
    const snap = await query.get();
    for (const doc of snap.docs) {
      donationDocs.set(doc.id, doc);
    }
  }

  for (const doc of donationDocs.values()) {
    const data = doc.data();
    if (data.donorUid !== uid) {
      batch.update(doc.ref, {
        donorUid: uid,
        donorEmailNormalized: normalized,
        ...(data.donorEmail ? {} : { donorEmail: email.trim() }),
      });
      writes += 1;
    }
  }

  const subscriptionSnap = await db
    .collection(COLLECTIONS.subscriptions)
    .where("donorEmail", "==", normalized)
    .get();

  for (const doc of subscriptionSnap.docs) {
    if (doc.data()?.donorUid !== uid) {
      batch.update(doc.ref, { donorUid: uid });
      writes += 1;
    }
  }

  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const mergedIds = [...stripeCustomerIds];
  batch.set(
    userRef,
    {
      stripeCustomerIds: mergedIds,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  writes += 1;

  if (writes > 0) {
    await batch.commit();
  }

  return mergedIds;
}
