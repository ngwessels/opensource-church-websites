import {
  persistDonationFromCheckoutSession,
  persistDonationFromInvoice,
  persistDonationFromPaymentIntent,
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
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @param {{ created: number, skipped: number, errors: string[] }} bucket
 */
async function importCheckoutSession(db, session, bucket) {
  if (!isDonationCheckoutSession(session)) {
    bucket.skipped += 1;
    return;
  }
  try {
    const existing = await db.collection("donations").doc(session.id).get();
    await persistDonationFromCheckoutSession(db, session);
    if (existing.exists) bucket.skipped += 1;
    else bucket.created += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout sync failed";
    bucket.errors.push(`${session.id}: ${message}`);
  }
}

/**
 * Pull recent Stripe Checkout completions, one-time PaymentIntents, and renewals into Firestore.
 * Safe to re-run (docs overwrite / skip duplicates).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("stripe").Stripe} stripe
 * @param {{ lookbackDays?: number }} [options]
 */
export async function syncDonationsFromStripe(db, stripe, options = {}) {
  const createdGte = resolveCreatedGte(options.lookbackDays);

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
      await importCheckoutSession(db, session, summary.checkouts);
    }

    if (!page.has_more || page.data.length === 0) break;
    checkoutStartingAfter = page.data[page.data.length - 1]?.id;
    if (!checkoutStartingAfter) break;
  }

  let paymentStartingAfter;
  for (;;) {
    const page = await stripe.paymentIntents.list({
      limit: PAGE_LIMIT,
      created: { gte: createdGte },
      ...(paymentStartingAfter ? { starting_after: paymentStartingAfter } : {}),
    });

    for (const paymentIntent of page.data) {
      if (paymentIntent.status !== "succeeded") {
        summary.payments.skipped += 1;
        continue;
      }

      try {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntent.id,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          // Prefer Checkout Session docs (`cs_…`) when a session exists.
          await importCheckoutSession(db, session, summary.payments);
          continue;
        }

        const result = await persistDonationFromPaymentIntent(db, stripe, paymentIntent);
        if (result.persisted) summary.payments.created += 1;
        else summary.payments.skipped += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "PaymentIntent sync failed";
        summary.payments.errors.push(`${paymentIntent.id}: ${message}`);
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    paymentStartingAfter = page.data[page.data.length - 1]?.id;
    if (!paymentStartingAfter) break;
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
