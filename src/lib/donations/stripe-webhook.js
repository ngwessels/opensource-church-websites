import { normalizeDonorEmail } from "../donors/email.js";
import { stripUndefined } from "../firestore/serialize.js";
import { getStripe } from "../stripe/server.js";
import {
  resolveDonorUidByEmail,
  upsertSubscriptionFromStripe,
} from "./subscription-sync.js";
import { donorFromStripeCustomer, donorFromStripeSession } from "./schema.js";

/**
 * Firestore rejects `undefined` field values (guest checkouts have no customer).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} docId
 * @param {Record<string, unknown>} data
 */
async function setDonationDoc(db, docId, data) {
  await db.collection("donations").doc(docId).set(stripUndefined(data));
}

/**
 * Checkout Session docs use `cs_…` ids; Charge fallbacks use the PaymentIntent id.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string | undefined} paymentIntentId
 * @param {Set<string>} [knownPaymentIntentIds]
 */
async function findDonationForPaymentIntent(db, paymentIntentId, knownPaymentIntentIds) {
  if (!paymentIntentId) return null;
  if (knownPaymentIntentIds?.has(paymentIntentId)) {
    return { id: paymentIntentId };
  }
  const byId = await db.collection("donations").doc(paymentIntentId).get();
  if (byId.exists) return { id: paymentIntentId };
  const querySnap = await db
    .collection("donations")
    .where("stripePaymentIntentId", "==", paymentIntentId)
    .limit(1)
    .get();
  if (!querySnap.empty) {
    return { id: querySnap.docs[0].id };
  }
  return null;
}

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
 * @param {import("stripe").Stripe} [stripeClient]
 */
export async function persistDonationFromCheckoutSession(db, session, stripeClient) {
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

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
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

  await setDonationDoc(db, session.id, {
    amountCents,
    currency: session.currency ?? "usd",
    frequency,
    status: "completed",
    stripeSessionId: session.id,
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    ...(donor ? { donor } : {}),
    ...(donorEmail ? { donorEmail } : {}),
    ...(donorEmailNormalized ? { donorEmailNormalized } : {}),
    ...(donorUid ? { donorUid } : {}),
    ...(fundId ? { fundId } : {}),
    ...(fundLabel ? { fundLabel } : {}),
    ...(returnPath ? { returnPath } : {}),
    ...(donorComment ? { donorComment } : {}),
    createdAt,
  });

  if (stripePaymentIntentId && stripePaymentIntentId !== session.id) {
    const piRef = db.collection("donations").doc(stripePaymentIntentId);
    const piSnap = await piRef.get();
    if (piSnap.exists) {
      await piRef.delete();
    }
  }

  if (stripeSubscriptionId && session.subscription) {
    const stripe = stripeClient || getStripe();
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
  const existingByPaymentIntent = await findDonationForPaymentIntent(
    db,
    paymentIntentId,
    options.knownPaymentIntentIds,
  );
  if (existingByPaymentIntent) {
    return { persisted: false, reason: "duplicate", id: existingByPaymentIntent.id };
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

  await setDonationDoc(db, docId, {
    amountCents: typeof charge.amount === "number" ? charge.amount : 0,
    currency: charge.currency ?? "usd",
    frequency,
    status: "completed",
    stripeChargeId: charge.id,
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(donor ? { donor } : {}),
    ...(donorEmail ? { donorEmail } : {}),
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
 * Live Charge events should prefer the Checkout Session row (same as manual sync).
 * If Checkout persist fails, fall through to the Charge document so the gift still lands.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.Charge} charge
 * @param {{ knownPaymentIntentIds?: Set<string> }} [options]
 * @returns {Promise<{ persisted: boolean; reason?: string; id?: string }>}
 */
export async function persistChargeOrCheckoutDonation(db, stripe, charge, options = {}) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (paymentIntentId) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      const session = sessions.data[0];
      if (
        session &&
        session.status === "complete" &&
        (session.payment_status === "paid" || session.payment_status === "no_payment_required")
      ) {
        try {
          const existing = await db.collection("donations").doc(session.id).get();
          await persistDonationFromCheckoutSession(db, session, stripe);
          options.knownPaymentIntentIds?.add(session.id);
          options.knownPaymentIntentIds?.add(paymentIntentId);
          return {
            persisted: !existing.exists,
            reason: existing.exists ? "duplicate" : undefined,
            id: session.id,
          };
        } catch {
          // Guest Checkout writes used to throw; Charge persist is the fallback.
        }
      }
    } catch {
      // Charge billing details are enough when Checkout lookup fails.
    }
  }

  return persistDonationFromCharge(db, stripe, charge, options);
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
    return persistChargeOrCheckoutDonation(db, stripe, charge, {
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

  await setDonationDoc(db, paymentIntentId, {
    amountCents: paymentIntent.amount_received || paymentIntent.amount || 0,
    currency: paymentIntent.currency ?? "usd",
    frequency,
    status: "completed",
    stripePaymentIntentId: paymentIntentId,
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(donor ? { donor } : {}),
    ...(donorEmail ? { donorEmail } : {}),
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

  await setDonationDoc(db, invoiceId, {
    amountCents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    frequency,
    status: "completed",
    stripeInvoiceId: invoiceId,
    stripeSubscriptionId: subscriptionId,
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(donor ? { donor } : {}),
    ...(donorEmail ? { donorEmail } : {}),
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
 * Guest Checkout does not put donorEmail on subscription metadata. Resolve it
 * from the Stripe Customer so the gift can be linked to a later donor account.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.Subscription} subscription
 */
export async function persistSubscriptionLifecycleEvent(db, stripe, subscription) {
  const metadata = subscription.metadata ?? {};
  let donorEmail = normalizeDonorEmail(metadata.donorEmail);
  let donorUid = typeof metadata.donorUid === "string" ? metadata.donorUid.trim() : "";

  if (!donorEmail) {
    const customer = subscription.customer;
    if (customer && typeof customer === "object" && "email" in customer && !customer.deleted) {
      donorEmail = normalizeDonorEmail(customer.email);
    } else {
      const customerId = typeof customer === "string" ? customer : customer?.id;
      if (customerId) {
        try {
          const retrieved = await stripe.customers.retrieve(customerId);
          if (!retrieved.deleted) {
            donorEmail = normalizeDonorEmail(retrieved.email);
          }
        } catch {
          // Metadata-only donor fields are enough when customer retrieval fails.
        }
      }
    }
  }

  if (!donorUid && donorEmail) {
    donorUid = (await resolveDonorUidByEmail(db, donorEmail)) || "";
  }

  await upsertSubscriptionFromStripe(db, subscription, {
    ...(donorUid ? { donorUid } : {}),
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

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.Event} event
 * @returns {Promise<{ handled: boolean, persisted?: boolean, reason?: string, id?: string }>}
 */
export async function handleStripeWebhookEvent(db, stripe, event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = /** @type {import("stripe").Stripe.Checkout.Session} */ (event.data.object);
      await persistDonationFromCheckoutSession(db, session, stripe);
      return { handled: true, persisted: true, id: session.id };
    }
    case "charge.succeeded": {
      const charge = /** @type {import("stripe").Stripe.Charge} */ (event.data.object);
      const result = await persistChargeOrCheckoutDonation(db, stripe, charge);
      return { handled: true, ...result };
    }
    case "payment_intent.succeeded": {
      const paymentIntent = /** @type {import("stripe").Stripe.PaymentIntent} */ (event.data.object);
      const result = await persistDonationFromPaymentIntent(db, stripe, paymentIntent);
      return { handled: true, ...result };
    }
    case "invoice.paid": {
      const invoice = /** @type {import("stripe").Stripe.Invoice} */ (event.data.object);
      const result = await persistDonationFromInvoice(db, stripe, invoice);
      return { handled: true, ...result };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = /** @type {import("stripe").Stripe.Subscription} */ (event.data.object);
      await persistSubscriptionLifecycleEvent(db, stripe, subscription);
      return { handled: true, persisted: true, id: subscription.id };
    }
    case "invoice.payment_failed": {
      const invoice = /** @type {import("stripe").Stripe.Invoice} */ (event.data.object);
      await persistInvoicePaymentFailed(db, invoice);
      return { handled: true, persisted: true };
    }
    default:
      return { handled: false };
  }
}
