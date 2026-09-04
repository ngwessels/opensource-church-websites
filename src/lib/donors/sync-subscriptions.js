import { COLLECTIONS } from "../firestore/paths.js";
import { normalizeDonorEmail } from "./email.js";
import { collectStripeCustomerIdsForEmail } from "./link.js";
import { upsertSubscriptionFromStripe } from "../donations/subscription-sync.js";

const PAGE_LIMIT = 100;

/**
 * @param {import("stripe").Stripe} stripe
 * @param {string} customerId
 * @returns {Promise<import("stripe").Stripe.Subscription[]>}
 */
async function listSubscriptionsForCustomer(stripe, customerId) {
  /** @type {import("stripe").Stripe.Subscription[]} */
  const subscriptions = [];
  let startingAfter;

  for (;;) {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: PAGE_LIMIT,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subscriptions.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return subscriptions;
}

/**
 * Import a donor's Stripe subscriptions into Firestore and attach donorUid.
 *
 * Recurring gifts created as guests often land in Stripe without donorUid/email
 * on the Firestore subscription doc, so the My Giving query cannot see them.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {{ uid: string, email?: string, stripeCustomerIds?: string[] }} options
 */
export async function syncDonorSubscriptionsFromStripe(db, stripe, options) {
  const { uid, email } = options;
  const normalized = normalizeDonorEmail(email);
  const stripeCustomerIds = new Set(
    (options.stripeCustomerIds ?? []).filter((id) => typeof id === "string" && id),
  );

  if (email) {
    for (const id of await collectStripeCustomerIdsForEmail(db, email)) {
      stripeCustomerIds.add(id);
    }
  }

  if (normalized) {
    const customers = await stripe.customers.list({
      email: normalized,
      limit: PAGE_LIMIT,
    });
    for (const customer of customers.data) {
      stripeCustomerIds.add(customer.id);
    }
  }

  /** @type {Array<{ id: string } & Record<string, unknown>>} */
  const records = [];

  for (const customerId of stripeCustomerIds) {
    const subscriptions = await listSubscriptionsForCustomer(stripe, customerId);
    for (const subscription of subscriptions) {
      const record = await upsertSubscriptionFromStripe(db, subscription, {
        donorUid: uid,
        donorEmail: normalized,
      });
      records.push({ id: subscription.id, ...record });
    }
  }

  const knownSubscriptionIds = new Set(records.map((record) => record.id));
  if (normalized) {
    const donationSnap = await db
      .collection(COLLECTIONS.donations)
      .where("donorEmailNormalized", "==", normalized)
      .get();
    for (const doc of donationSnap.docs) {
      const subscriptionId = doc.data()?.stripeSubscriptionId;
      if (
        typeof subscriptionId !== "string" ||
        !subscriptionId ||
        knownSubscriptionIds.has(subscriptionId)
      ) {
        continue;
      }
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const record = await upsertSubscriptionFromStripe(db, subscription, {
          donorUid: uid,
          donorEmail: normalized,
        });
        records.push({ id: subscription.id, ...record });
        knownSubscriptionIds.add(subscription.id);
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (customerId) stripeCustomerIds.add(customerId);
      } catch {
        // The Stripe subscription may have been deleted.
      }
    }
  }

  const mergedIds = [...stripeCustomerIds];
  await db.collection(COLLECTIONS.users).doc(uid).set(
    {
      stripeCustomerIds: mergedIds,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  records.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return {
    subscriptions: records,
    stripeCustomerIds: mergedIds,
  };
}
