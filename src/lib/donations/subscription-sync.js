import { COLLECTIONS } from "../firestore/paths.js";
import { normalizeDonorEmail } from "../donors/email.js";

/**
 * @param {string | undefined} interval
 * @returns {'weekly' | 'monthly'}
 */
export function donationFrequencyFromStripeInterval(interval) {
  if (interval === "week") return "weekly";
  return "monthly";
}

/**
 * @param {import("stripe").Stripe.Subscription} subscription
 * @param {{ donorUid?: string, donorEmail?: string }} [options]
 */
export function buildSubscriptionRecord(subscription, options = {}) {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const metadata = subscription.metadata ?? {};
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const stripeProductId =
    typeof price?.product === "string" ? price.product : price?.product?.id;
  const donorEmail =
    options.donorEmail ?? normalizeDonorEmail(metadata.donorEmail) ?? undefined;

  const now = new Date().toISOString();

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    status: subscription.status,
    amountCents: price?.unit_amount ?? 0,
    currency: subscription.currency ?? "usd",
    frequency:
      metadata.frequency === "weekly" || metadata.frequency === "monthly"
        ? metadata.frequency
        : donationFrequencyFromStripeInterval(price?.recurring?.interval),
    ...(metadata.fundId ? { fundId: metadata.fundId } : {}),
    ...(metadata.fundLabel ? { fundLabel: metadata.fundLabel } : {}),
    ...(stripeProductId ? { stripeProductId } : {}),
    ...(item?.id ? { stripeSubscriptionItemId: item.id } : {}),
    ...(subscription.current_period_end
      ? { currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString() }
      : {}),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    ...(options.donorUid ? { donorUid: options.donorUid } : {}),
    ...(donorEmail ? { donorEmail } : {}),
    updatedAt: now,
    createdAt: subscription.created
      ? new Date(subscription.created * 1000).toISOString()
      : now,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe.Subscription} subscription
 * @param {{ donorUid?: string, donorEmail?: string }} [options]
 */
export async function upsertSubscriptionFromStripe(db, subscription, options = {}) {
  const record = buildSubscriptionRecord(subscription, options);
  await db
    .collection(COLLECTIONS.subscriptions)
    .doc(subscription.id)
    .set(record, { merge: true });
  return record;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string | undefined} email
 * @returns {Promise<string | undefined>}
 */
export async function resolveDonorUidByEmail(db, email) {
  const normalized = normalizeDonorEmail(email);
  if (!normalized) return undefined;

  const snap = await db
    .collection(COLLECTIONS.users)
    .where("email", "==", normalized)
    .limit(1)
    .get();

  if (snap.empty) {
    const rawSnap = await db
      .collection(COLLECTIONS.users)
      .where("email", "==", email?.trim())
      .limit(1)
      .get();
    if (rawSnap.empty) return undefined;
    const role = rawSnap.docs[0].data()?.role;
    if (role === "donor" || role === "admin" || role === "finance") {
      return rawSnap.docs[0].id;
    }
    return undefined;
  }

  const role = snap.docs[0].data()?.role;
  if (role === "donor" || role === "admin" || role === "finance") {
    return snap.docs[0].id;
  }

  return undefined;
}
