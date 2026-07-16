import { normalizeDonorEmail } from "../donors/email.js";
import {
  resolveDonorUidByEmail,
  upsertSubscriptionFromStripe,
} from "./subscription-sync.js";
import { donorFromStripeCustomer, donorFromStripeSession } from "./schema.js";

/**
 * Stripe API 2025-03-31+ removed top-level `invoice.subscription` in favor of
 * `invoice.parent.subscription_details.subscription`.
 *
 * @param {import("stripe").Stripe.Invoice | Record<string, unknown>} invoice
 * @returns {string | undefined}
 */
export function getInvoiceSubscriptionId(invoice) {
  const legacy = /** @type {{ subscription?: string | { id?: string } }} */ (invoice).subscription;
  if (typeof legacy === "string" && legacy) return legacy;
  if (legacy && typeof legacy === "object" && typeof legacy.id === "string") return legacy.id;

  const parent = /** @type {{ parent?: { type?: string, subscription_details?: { subscription?: string | { id?: string } } } }} */ (
    invoice
  ).parent;
  const details = parent?.subscription_details;
  const subscription = details?.subscription;
  if (typeof subscription === "string" && subscription) return subscription;
  if (subscription && typeof subscription === "object" && typeof subscription.id === "string") {
    return subscription.id;
  }
  return undefined;
}

/**
 * Immutable subscription metadata snapshot from the invoice parent (Basil+),
 * when present.
 *
 * @param {import("stripe").Stripe.Invoice | Record<string, unknown>} invoice
 * @returns {Record<string, string>}
 */
export function getInvoiceSubscriptionMetadata(invoice) {
  const parent = /** @type {{ parent?: { subscription_details?: { metadata?: Record<string, string> | null } } }} */ (
    invoice
  ).parent;
  const metadata = parent?.subscription_details?.metadata;
  return metadata && typeof metadata === "object" ? { ...metadata } : {};
}

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
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const donor = donorFromStripeSession(
    session.customer_details,
    session.customer_email ?? undefined,
  );
  const donorEmail = donor?.email ?? session.customer_details?.email ?? session.customer_email ?? undefined;
  const donorEmailNormalized = normalizeDonorEmail(donorEmail);
  const donorUid =
    metadataDonorUid ||
    (donorEmail ? await resolveDonorUidByEmail(db, donorEmail) : undefined);

  const createdAt =
    typeof session.created === "number" && session.created > 0
      ? new Date(session.created * 1000).toISOString()
      : new Date().toISOString();

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
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
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
 * @param {string | null | undefined} description
 */
export function isSubscriptionPaymentDescription(description) {
  return typeof description === "string" && /^subscription\b/i.test(description.trim());
}

/**
 * True when a PaymentIntent is clearly a subscription invoice charge (not a one-time gift).
 * @param {import("stripe").Stripe.PaymentIntent | Record<string, unknown>} paymentIntent
 */
export function isSubscriptionPaymentIntent(paymentIntent) {
  const invoice = /** @type {{ invoice?: string | { id?: string } | null }} */ (paymentIntent).invoice;
  if (typeof invoice === "string" && invoice) return true;
  if (invoice && typeof invoice === "object" && invoice.id) return true;
  return isSubscriptionPaymentDescription(
    typeof paymentIntent.description === "string" ? paymentIntent.description : undefined,
  );
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} docId
 * @param {Set<string>} [knownPaymentIntentIds]
 */
async function donationDocExists(db, docId, knownPaymentIntentIds) {
  if (knownPaymentIntentIds?.has(docId)) return true;
  const existing = await db.collection("donations").doc(docId).get();
  return existing.exists;
}

/**
 * Persist a one-time gift from a succeeded Stripe Charge (Payments dashboard row).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.Charge} charge
 * @param {{ knownPaymentIntentIds?: Set<string> }} [options]
 * @returns {Promise<{ persisted: boolean; reason?: string; id?: string }>}
 */
export async function persistDonationFromCharge(db, stripe, charge, options = {}) {
  if (charge.status !== "succeeded" || charge.paid === false) {
    return { persisted: false, reason: "not_succeeded" };
  }
  if (isSubscriptionPaymentDescription(charge.description)) {
    return { persisted: false, reason: "subscription_payment" };
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  const docId = paymentIntentId || charge.id;
  if (!docId) {
    return { persisted: false, reason: "no_id" };
  }

  if (await donationDocExists(db, docId, options.knownPaymentIntentIds)) {
    return { persisted: false, reason: "duplicate", id: docId };
  }
  if (paymentIntentId && options.knownPaymentIntentIds?.has(paymentIntentId)) {
    return { persisted: false, reason: "duplicate", id: paymentIntentId };
  }

  /** @type {Record<string, string>} */
  let metadata = {};
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      metadata = paymentIntent.metadata ?? {};
      if (isSubscriptionPaymentIntent(paymentIntent)) {
        return { persisted: false, reason: "subscription_payment" };
      }
    } catch {
      // Charge billing details are enough when PaymentIntent retrieval fails.
    }
  }

  const frequency =
    metadata.frequency === "weekly" || metadata.frequency === "monthly"
      ? metadata.frequency
      : "once";
  const fundId = metadata.fundId?.trim() || undefined;
  const fundLabel = metadata.fundLabel?.trim() || undefined;
  const returnPath = metadata.returnPath?.trim() || undefined;
  const donorComment = metadata.donorComment?.trim() || undefined;
  const metadataDonorUid = metadata.donorUid?.trim() || undefined;

  let donor = donorFromStripeSession(
    charge.billing_details,
    charge.billing_details?.email || charge.receipt_email || undefined,
  );

  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!donor && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      donor = donorFromStripeCustomer(customer);
    }
  }

  const donorEmail = donor?.email || charge.receipt_email || undefined;
  const donorEmailNormalized = normalizeDonorEmail(donorEmail);
  const donorUid =
    metadataDonorUid ||
    (donorEmail ? await resolveDonorUidByEmail(db, donorEmail) : undefined);

  const createdAt =
    typeof charge.created === "number" && charge.created > 0
      ? new Date(charge.created * 1000).toISOString()
      : new Date().toISOString();

  await db
    .collection("donations")
    .doc(docId)
    .set({
      amountCents: typeof charge.amount === "number" ? charge.amount : 0,
      currency: charge.currency ?? "usd",
      frequency,
      status: "completed",
      stripeChargeId: charge.id,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
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

  options.knownPaymentIntentIds?.add(docId);
  if (paymentIntentId) options.knownPaymentIntentIds?.add(paymentIntentId);

  return { persisted: true, id: docId };
}

/**
 * Persist a one-time gift from a succeeded PaymentIntent that has no Checkout Session
 * (e.g. Stripe Payment Links / Link payments created outside `/api/stripe/checkout`).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.PaymentIntent} paymentIntent
 * @param {{ knownPaymentIntentIds?: Set<string>, charge?: import("stripe").Stripe.Charge }} [options]
 * @returns {Promise<{ persisted: boolean; reason?: string; id?: string }>}
 */
export async function persistDonationFromPaymentIntent(db, stripe, paymentIntent, options = {}) {
  if (paymentIntent.status !== "succeeded") {
    return { persisted: false, reason: "not_succeeded" };
  }
  if (isSubscriptionPaymentIntent(paymentIntent)) {
    return { persisted: false, reason: "subscription_payment" };
  }

  const paymentIntentId = paymentIntent.id;
  if (!paymentIntentId) {
    return { persisted: false, reason: "no_id" };
  }

  if (await donationDocExists(db, paymentIntentId, options.knownPaymentIntentIds)) {
    return { persisted: false, reason: "duplicate", id: paymentIntentId };
  }

  let charge = options.charge;
  if (!charge) {
    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;
    if (chargeId) {
      charge = await stripe.charges.retrieve(chargeId);
    }
  }

  if (charge) {
    return persistDonationFromCharge(db, stripe, charge, {
      knownPaymentIntentIds: options.knownPaymentIntentIds,
    });
  }

  const metadata = paymentIntent.metadata ?? {};
  const frequency =
    metadata.frequency === "weekly" || metadata.frequency === "monthly"
      ? metadata.frequency
      : "once";
  const fundId = metadata.fundId?.trim() || undefined;
  const fundLabel = metadata.fundLabel?.trim() || undefined;
  const returnPath = metadata.returnPath?.trim() || undefined;
  const donorComment = metadata.donorComment?.trim() || undefined;
  const metadataDonorUid = metadata.donorUid?.trim() || undefined;

  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  let donor;
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      donor = donorFromStripeCustomer(customer);
    }
  }

  const donorEmail = donor?.email || undefined;
  const donorEmailNormalized = normalizeDonorEmail(donorEmail);
  const donorUid =
    metadataDonorUid ||
    (donorEmail ? await resolveDonorUidByEmail(db, donorEmail) : undefined);

  const createdAt =
    typeof paymentIntent.created === "number" && paymentIntent.created > 0
      ? new Date(paymentIntent.created * 1000).toISOString()
      : new Date().toISOString();

  await db
    .collection("donations")
    .doc(paymentIntentId)
    .set({
      amountCents: paymentIntent.amount_received || paymentIntent.amount || 0,
      currency: paymentIntent.currency ?? "usd",
      frequency,
      status: "completed",
      stripePaymentIntentId: paymentIntentId,
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

  options.knownPaymentIntentIds?.add(paymentIntentId);
  return { persisted: true, id: paymentIntentId };
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

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return { persisted: false, reason: "no_subscription" };
  }

  const invoiceId = invoice.id;
  const existing = await db.collection("donations").doc(invoiceId).get();
  if (existing.exists) {
    return { persisted: false, reason: "duplicate" };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const invoiceMetadata = getInvoiceSubscriptionMetadata(invoice);
  const resolved = await resolveSubscriptionDonationMetadata(
    stripe,
    subscriptionId,
    { ...(subscription.metadata ?? {}), ...invoiceMetadata },
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
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  await db.collection("subscriptions").doc(subscriptionId).set(
    {
      status: "past_due",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
