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
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  const donor = donorFromStripeSession(
    session.customer_details,
    session.customer_email ?? undefined,
  );

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
      donorEmail: donor?.email ?? session.customer_details?.email ?? session.customer_email ?? undefined,
      ...(fundId ? { fundId } : {}),
      ...(fundLabel ? { fundLabel } : {}),
      ...(returnPath ? { returnPath } : {}),
      ...(donorComment ? { donorComment } : {}),
      createdAt: new Date().toISOString(),
    });
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
      donorEmail: donor?.email ?? undefined,
      ...(fundId ? { fundId } : {}),
      ...(fundLabel ? { fundLabel } : {}),
      ...(returnPath ? { returnPath } : {}),
      ...(donorComment ? { donorComment } : {}),
      createdAt,
    });

  return { persisted: true };
}
