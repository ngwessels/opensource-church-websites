import { normalizeDonorEmail } from "../donors/email.js";
import {
  resolveDonorUidByEmail,
  upsertSubscriptionFromStripe,
} from "./subscription-sync.js";
import { donorFromStripeCustomer, donorFromStripeSession } from "./schema.js";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe.Checkout.Session} session
 */
export async function persistDonationFromCheckoutSession(db, session) {
  const frequency = session.metadata?.frequency ?? "once";
  const amountCents = session.amount_total ?? 0;
  const fundId = session.metadata?.fundId;
  const fundLabel = session.metadata?.fundLabel;
  const returnPath = session.metadata?.returnPath;
  const donorComment = session.metadata?.donorComment?.trim();
  const metadataDonorUid = session.metadata?.donorUid?.trim();
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  const donor = donorFromStripeSession(
    session.customer_details,
    session.customer_email ?? undefined,
  );
  const donorEmail = donor?.email ?? session.customer_details?.email ?? session.customer_email ?? undefined;
  const donorEmailNormalized = normalizeDonorEmail(donorEmail);
  const donorUid =
    metadataDonorUid ||
    (donorEmail ? await resolveDonorUidByEmail(db, donorEmail) : undefined);

  await db
    .collection("donations")
    .doc(session.id)
    .set({
      amountCents,
      currency: session.currency ?? "usd",
      frequency,
      status: "completed",
      stripeSessionId: session.id,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
      ...(donor ? { donor } : {}),
      donorEmail,
      ...(donorEmailNormalized ? { donorEmailNormalized } : {}),
      ...(donorUid ? { donorUid } : {}),
      ...(fundId ? { fundId } : {}),
      ...(fundLabel ? { fundLabel } : {}),
      ...(returnPath ? { returnPath } : {}),
      ...(donorComment ? { donorComment } : {}),
      createdAt: new Date().toISOString(),
    });

  if (stripeSubscriptionId && session.subscription) {
    const stripe = (await import("../stripe/server.js")).getStripe();
    const subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    await upsertSubscriptionFromStripe(db, subscription, {
      donorUid,
      donorEmail: donorEmailNormalized,
    });
  }
}

/**
 * Resolve donation metadata for a subscription renewal.
 * @param {import("stripe").Stripe} stripe
 * @param {string} subscriptionId
 * @param {Record<string, string>} subscriptionMetadata
 */
async function resolveSubscriptionDonationMetadata(stripe, subscriptionId, subscriptionMetadata) {
  const metadata = { ...subscriptionMetadata };

  if (metadata.fundId && metadata.fundLabel) {
    return metadata;
  }

  const sessions = await stripe.checkout.sessions.list({
    subscription: subscriptionId,
    limit: 1,
  });
  const session = sessions.data[0];

  if (session?.metadata) {
    return {
      frequency: metadata.frequency || session.metadata.frequency || "once",
      fundId: metadata.fundId || session.metadata.fundId,
      fundLabel: metadata.fundLabel || session.metadata.fundLabel,
      returnPath: metadata.returnPath || session.metadata.returnPath,
      donorComment: metadata.donorComment || session.metadata.donorComment,
      donorUid: metadata.donorUid || session.metadata.donorUid,
      checkoutSession: session,
    };
  }

  return { ...metadata, checkoutSession: session };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.Invoice} invoice
 * @returns {Promise<{ persisted: boolean; reason?: string }>}
 */
export async function persistDonationFromInvoice(db, stripe, invoice) {
  if (invoice.billing_reason !== "subscription_cycle") {
    return { persisted: false, reason: "not_renewal" };
  }

  if (!invoice.subscription) {
    return { persisted: false, reason: "no_subscription" };
  }

  const invoiceId = invoice.id;
  const existing = await db.collection("donations").doc(invoiceId).get();
  if (existing.exists) {
    return { persisted: false, reason: "duplicate" };
  }

  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const resolved = await resolveSubscriptionDonationMetadata(
    stripe,
    subscriptionId,
    subscription.metadata ?? {},
  );

  const frequency = resolved.frequency ?? "once";
  const fundId = resolved.fundId;
  const fundLabel = resolved.fundLabel;
  const returnPath = resolved.returnPath;
  const donorComment = resolved.donorComment?.trim();

  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  let donor;
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      donor = donorFromStripeCustomer(customer);
    }
  }

  if (!donor && resolved.checkoutSession) {
    donor = donorFromStripeSession(
      resolved.checkoutSession.customer_details,
      resolved.checkoutSession.customer_email ?? undefined,
    );
  }

  const donorEmail = donor?.email ?? undefined;
  const donorEmailNormalized = normalizeDonorEmail(donorEmail);
  const donorUid =
    resolved.donorUid ||
    (donorEmail ? await resolveDonorUidByEmail(db, donorEmail) : undefined);

  const paidAt = invoice.status_transitions?.paid_at;
  const createdAt =
    typeof paidAt === "number" && paidAt > 0
      ? new Date(paidAt * 1000).toISOString()
      : new Date().toISOString();

  await db
    .collection("donations")
    .doc(invoiceId)
    .set({
      amountCents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "usd",
      frequency,
      status: "completed",
      stripeInvoiceId: invoiceId,
      stripeSubscriptionId: subscriptionId,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(donor ? { donor } : {}),
      donorEmail,
      ...(donorEmailNormalized ? { donorEmailNormalized } : {}),
      ...(donorUid ? { donorUid } : {}),
      ...(fundId ? { fundId } : {}),
      ...(fundLabel ? { fundLabel } : {}),
      ...(returnPath ? { returnPath } : {}),
      ...(donorComment ? { donorComment } : {}),
      createdAt,
    });

  await upsertSubscriptionFromStripe(db, subscription, {
    donorUid,
    donorEmail: donorEmailNormalized,
  });

  return { persisted: true };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe.Subscription} subscription
 */
export async function persistSubscriptionLifecycleEvent(db, subscription) {
  const donorEmail = normalizeDonorEmail(subscription.metadata?.donorEmail);
  const donorUid =
    subscription.metadata?.donorUid ||
    (donorEmail ? await resolveDonorUidByEmail(db, donorEmail) : undefined);

  await upsertSubscriptionFromStripe(db, subscription, {
    donorUid,
    donorEmail,
  });
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe.Invoice} invoice
 */
export async function persistInvoicePaymentFailed(db, invoice) {
  if (!invoice.subscription) return;

  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;

  await db.collection("subscriptions").doc(subscriptionId).set(
    {
      status: "past_due",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
