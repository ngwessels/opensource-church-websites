import "server-only";

import { getStripe } from "@/lib/stripe/server";

/**
 * @param {string} subscriptionId
 * @param {{ atPeriodEnd?: boolean }} [options]
 */
export async function cancelDonorSubscription(subscriptionId, options = {}) {
  const stripe = getStripe();
  const atPeriodEnd = options.atPeriodEnd !== false;

  if (atPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * @param {import("stripe").Stripe.Subscription} subscription
 * @param {{ amountCents: number, frequency: 'weekly' | 'monthly' }}
 */
export async function updateDonorSubscription(subscription, { amountCents, frequency }) {
  const stripe = getStripe();
  const item = subscription.items.data[0];
  if (!item) {
    throw new Error("Subscription has no items.");
  }

  const productId =
    typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  const interval = frequency === "weekly" ? "week" : "month";

  const newPrice = await stripe.prices.create({
    unit_amount: amountCents,
    currency: subscription.currency || "usd",
    recurring: { interval },
    product: productId,
  });

  return stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: newPrice.id }],
    proration_behavior: "none",
    metadata: {
      ...subscription.metadata,
      frequency,
    },
  });
}

/**
 * @param {string} customerId
 * @param {string} returnUrl
 */
export async function createDonorBillingPortalSession(customerId, returnUrl) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
