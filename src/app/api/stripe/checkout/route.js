import { NextResponse } from "next/server";

import { sanitizeReturnPath } from "@/lib/donations/schema";
import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/stripe/server";

/** @type {Record<string, "week" | "month">} */
const RECURRING_INTERVALS = {
  weekly: "week",
  monthly: "month",
};

const VALID_FREQUENCIES = ["once", "weekly", "monthly"];

/**
 * @param {string} frequency
 * @param {string} fundLabel
 */
function getProductName(frequency, fundLabel) {
  if (frequency === "weekly") return `Weekly donation — ${fundLabel}`;
  if (frequency === "monthly") return `Monthly donation — ${fundLabel}`;
  return `Donation — ${fundLabel}`;
}

export async function POST(request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local." },
      { status: 503 },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { amountCents, frequency, fundId, fundLabel, returnPath } = body;

  if (!amountCents || typeof amountCents !== "number" || amountCents < 100) {
    return NextResponse.json(
      { error: "amountCents must be at least 100 (one dollar)." },
      { status: 400 },
    );
  }

  if (!VALID_FREQUENCIES.includes(frequency)) {
    return NextResponse.json(
      { error: "frequency must be 'once', 'weekly', or 'monthly'." },
      { status: 400 },
    );
  }

  if (!fundId || typeof fundId !== "string" || !fundId.trim()) {
    return NextResponse.json({ error: "fundId is required." }, { status: 400 });
  }

  if (!fundLabel || typeof fundLabel !== "string" || !fundLabel.trim()) {
    return NextResponse.json({ error: "fundLabel is required." }, { status: 400 });
  }

  const safeReturnPath = sanitizeReturnPath(returnPath);
  const trimmedFundLabel = fundLabel.trim();
  const recurringInterval = RECURRING_INTERVALS[frequency];

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const lineItem = {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: amountCents,
      product_data: {
        name: getProductName(frequency, trimmedFundLabel),
        description: "Parish donation",
      },
      ...(recurringInterval ? { recurring: { interval: recurringInterval } } : {}),
    },
  };

  const session = await stripe.checkout.sessions.create({
    mode: recurringInterval ? "subscription" : "payment",
    line_items: [lineItem],
    success_url: `${appUrl}${safeReturnPath}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${safeReturnPath}?status=cancelled`,
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    metadata: {
      frequency,
      fundId: fundId.trim(),
      fundLabel: trimmedFundLabel,
      returnPath: safeReturnPath,
    },
  });

  return NextResponse.json({ url: session.url });
}
