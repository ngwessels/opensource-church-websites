import { COLLECTIONS } from "../firestore/paths.js";
import { normalizeDonorEmail } from "./email.js";

const FIRESTORE_IN_LIMIT = 30;

/**
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
function chunkArray(items, size) {
  /** @type {T[][]} */
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} field
 * @param {string[]} values
 */
async function querySubscriptionsByValues(db, field, values) {
  /** @type {Map<string, import("firebase-admin/firestore").QueryDocumentSnapshot>} */
  const docs = new Map();
  const unique = [...new Set(values.filter((value) => typeof value === "string" && value))];
  for (const group of chunkArray(unique, FIRESTORE_IN_LIMIT)) {
    if (group.length === 0) continue;
    const snap =
      group.length === 1
        ? await db.collection(COLLECTIONS.subscriptions).where(field, "==", group[0]).get()
        : await db.collection(COLLECTIONS.subscriptions).where(field, "in", group).get();
    for (const doc of snap.docs) {
      docs.set(doc.id, doc);
    }
  }
  return docs;
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

  /** @type {string[]} */
  const subscriptionIdsFromDonations = [];

  for (const doc of donationDocs.values()) {
    const data = doc.data();
    if (typeof data.stripeSubscriptionId === "string" && data.stripeSubscriptionId) {
      subscriptionIdsFromDonations.push(data.stripeSubscriptionId);
    }
    if (data.donorUid !== uid) {
      batch.update(doc.ref, {
        donorUid: uid,
        donorEmailNormalized: normalized,
        ...(data.donorEmail ? {} : { donorEmail: email.trim() }),
      });
      writes += 1;
    }
  }

  const subscriptionDocs = new Map();

  const emailValues = [normalized];
  if (email.trim() !== normalized) emailValues.push(email.trim());
  for (const [id, doc] of await querySubscriptionsByValues(db, "donorEmail", emailValues)) {
    subscriptionDocs.set(id, doc);
  }

  for (const [id, doc] of await querySubscriptionsByValues(db, "stripeCustomerId", [
    ...stripeCustomerIds,
  ])) {
    subscriptionDocs.set(id, doc);
  }

  for (const subscriptionId of subscriptionIdsFromDonations) {
    if (subscriptionDocs.has(subscriptionId)) continue;
    const snap = await db.collection(COLLECTIONS.subscriptions).doc(subscriptionId).get();
    if (snap.exists) {
      subscriptionDocs.set(subscriptionId, snap);
    }
  }

  for (const doc of subscriptionDocs.values()) {
    const data = doc.data() ?? {};
    if (data.donorUid === uid && data.donorEmail === normalized) continue;
    batch.update(doc.ref, {
      donorUid: uid,
      donorEmail: normalized,
    });
    writes += 1;
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
