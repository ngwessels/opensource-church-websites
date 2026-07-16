import {
  persistDonationFromCharge,
  persistDonationFromCheckoutSession,
  persistDonationFromInvoice,
} from "./stripe-webhook.js";

const DEFAULT_LOOKBACK_DAYS = 90;
const MAX_LOOKBACK_DAYS = 365;
const PAGE_LIMIT = 100;

/**
 * @param {number} [lookbackDays]
 * @returns {number}
 */
function resolveCreatedGte(lookbackDays = DEFAULT_LOOKBACK_DAYS) {
  const days = Math.min(
    Math.max(Number.isFinite(lookbackDays) ? Math.floor(lookbackDays) : DEFAULT_LOOKBACK_DAYS, 1),
    MAX_LOOKBACK_DAYS,
  );
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

/**
 * Only import Checkout sessions that look like parish giving checkouts.
 * @param {import("stripe").Stripe.Checkout.Session} session
 */
export function isDonationCheckoutSession(session) {
  if (session.status !== "complete") return false;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return false;
  }
  const metadata = session.metadata ?? {};
  if (metadata.fundId || metadata.fundLabel || metadata.frequency) return true;

  // Paid one-time Checkout without metadata (legacy / Payment Link style sessions).
  return session.mode === "payment";
}

/**
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @param {Set<string>} knownPaymentIntentIds
 */
function rememberSessionPaymentIntent(session, knownPaymentIntentIds) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (paymentIntentId) knownPaymentIntentIds.add(paymentIntentId);
  knownPaymentIntentIds.add(session.id);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @param {{ created: number, skipped: number, errors: string[] }} bucket
 * @param {Set<string>} knownPaymentIntentIds
 * @returns {Promise<'created' | 'duplicate' | 'skipped' | 'error'>}
 */
async function importCheckoutSession(db, session, bucket, knownPaymentIntentIds) {
  if (!isDonationCheckoutSession(session)) {
    bucket.skipped += 1;
    return "skipped";
  }
  try {
    const existing = await db.collection("donations").doc(session.id).get();
    await persistDonationFromCheckoutSession(db, session);
    rememberSessionPaymentIntent(session, knownPaymentIntentIds);
    if (existing.exists) {
      bucket.skipped += 1;
      return "duplicate";
    }
    bucket.created += 1;
    return "created";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout sync failed";
    bucket.errors.push(`${session.id}: ${message}`);
    return "error";
  }
}

/**
 * Pull recent Stripe Checkout completions, Charges (Payments dashboard), and renewals.
 * Safe to re-run (docs overwrite / skip duplicates).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {{ lookbackDays?: number }} [options]
 */
export async function syncDonationsFromStripe(db, stripe, options = {}) {
  const createdGte = resolveCreatedGte(options.lookbackDays);
  /** @type {Set<string>} */
  const knownPaymentIntentIds = new Set();

  /** @type {{ checkouts: { created: number, skipped: number, errors: string[] }, payments: { created: number, skipped: number, errors: string[] }, renewals: { created: number, skipped: number, errors: string[] } }} */
  const summary = {
    checkouts: { created: 0, skipped: 0, errors: [] },
    payments: { created: 0, skipped: 0, errors: [] },
    renewals: { created: 0, skipped: 0, errors: [] },
  };

  let checkoutStartingAfter;
  for (;;) {
    const page = await stripe.checkout.sessions.list({
      limit: PAGE_LIMIT,
      created: { gte: createdGte },
      ...(checkoutStartingAfter ? { starting_after: checkoutStartingAfter } : {}),
    });

    for (const session of page.data) {
      await importCheckoutSession(db, session, summary.checkouts, knownPaymentIntentIds);
    }

    if (!page.has_more || page.data.length === 0) break;
    checkoutStartingAfter = page.data[page.data.length - 1]?.id;
    if (!checkoutStartingAfter) break;
  }

  // Mirror Stripe Dashboard → Payments: import succeeded Charges that are not subscription invoices.
  let chargeStartingAfter;
  for (;;) {
    const page = await stripe.charges.list({
      limit: PAGE_LIMIT,
      created: { gte: createdGte },
      ...(chargeStartingAfter ? { starting_after: chargeStartingAfter } : {}),
    });

    for (const charge of page.data) {
      if (charge.status !== "succeeded" || charge.paid === false) {
        summary.payments.skipped += 1;
        continue;
      }

      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;

      try {
        if (paymentIntentId) {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
          });
          const session = sessions.data[0];
          if (session) {
            const outcome = await importCheckoutSession(
              db,
              session,
              summary.payments,
              knownPaymentIntentIds,
            );
            // Only skip Charge import when the Checkout Session actually landed (or already exists).
            if (outcome === "created" || outcome === "duplicate") {
              continue;
            }
          }
        }

        const result = await persistDonationFromCharge(db, stripe, charge, {
          knownPaymentIntentIds,
        });
        if (result.persisted) summary.payments.created += 1;
        else summary.payments.skipped += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Charge sync failed";
        summary.payments.errors.push(`${charge.id}: ${message}`);
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    chargeStartingAfter = page.data[page.data.length - 1]?.id;
    if (!chargeStartingAfter) break;
  }

  let invoiceStartingAfter;
  for (;;) {
    const page = await stripe.invoices.list({
      limit: PAGE_LIMIT,
      status: "paid",
      created: { gte: createdGte },
      ...(invoiceStartingAfter ? { starting_after: invoiceStartingAfter } : {}),
    });

    for (const invoice of page.data) {
      try {
        const result = await persistDonationFromInvoice(db, stripe, invoice);
        if (result.persisted) summary.renewals.created += 1;
        else summary.renewals.skipped += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invoice sync failed";
        summary.renewals.errors.push(`${invoice.id}: ${message}`);
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    invoiceStartingAfter = page.data[page.data.length - 1]?.id;
    if (!invoiceStartingAfter) break;
  }

  return summary;
}
