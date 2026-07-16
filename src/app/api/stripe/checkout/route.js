import { NextResponse } from "next/server";

import {
  sanitizeDonorComment,
  sanitizeReturnPath,
  stripeCheckoutCustomerCollectionOptions,
} from "@/lib/donations/schema";
import { getDonorPortalUserFromRequest } from "@/lib/donors/auth.server";
import { RECAPTCHA_ACTIONS, RECAPTCHA_TOKEN_FIELD } from "@/lib/recaptcha/constants";
import { assertRecaptchaOrSkip } from "@/lib/recaptcha/server";
import { getStripe, isStripeConfigured, joinAppUrl } from "@/lib/stripe/server";

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

  const { amountCents, frequency, fundId, fundLabel, returnPath, donorComment } = body;

  const recaptchaResult = await assertRecaptchaOrSkip({
    token: body[RECAPTCHA_TOKEN_FIELD],
    expectedAction: RECAPTCHA_ACTIONS.donationCheckout,
  });
  if (!recaptchaResult.ok) {
    return NextResponse.json({ error: recaptchaResult.error }, { status: recaptchaResult.status });
  }

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
  const safeDonorComment = sanitizeDonorComment(donorComment);
  const recurringInterval = RECURRING_INTERVALS[frequency];

  let donorUid;
  let stripeCustomerId;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { decoded, profile } = await getDonorPortalUserFromRequest(request);
      donorUid = decoded.uid;
      if (Array.isArray(profile?.stripeCustomerIds) && profile.stripeCustomerIds.length > 0) {
        stripeCustomerId = profile.stripeCustomerIds[0];
      }
    } catch {
      // Continue as guest checkout when auth is invalid or not a donor portal user.
    }
  }

  const stripe = getStripe();
  const returnBase = joinAppUrl(safeReturnPath);
  const returnSeparator = returnBase.includes("?") ? "&" : "?";

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

  const donationMetadata = {
    frequency,
    fundId: fundId.trim(),
    fundLabel: trimmedFundLabel,
    returnPath: safeReturnPath,
    ...(safeDonorComment ? { donorComment: safeDonorComment } : {}),
    ...(donorUid ? { donorUid } : {}),
  };

  const session = await stripe.checkout.sessions.create({
    mode: recurringInterval ? "subscription" : "payment",
    line_items: [lineItem],
    success_url: `${returnBase}${returnSeparator}status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnBase}${returnSeparator}status=cancelled`,
    ...stripeCheckoutCustomerCollectionOptions(),
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
    metadata: donationMetadata,
    ...(recurringInterval
      ? { subscription_data: { metadata: donationMetadata } }
      : { payment_intent_data: { metadata: donationMetadata } }),
  });

  return NextResponse.json({ url: session.url });
}
