import { NextResponse } from "next/server";

import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/stripe/server";

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

  const { amountCents, frequency, email } = body;

  if (!amountCents || typeof amountCents !== "number" || amountCents < 100) {
    return NextResponse.json(
      { error: "amountCents must be at least 100 (one dollar)." },
      { status: 400 },
    );
  }

  if (frequency !== "once" && frequency !== "monthly") {
    return NextResponse.json(
      { error: "frequency must be 'once' or 'monthly'." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const lineItem = {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: amountCents,
      product_data: {
        name: frequency === "monthly" ? "Monthly donation" : "One-time donation",
        description: "Parish donation",
      },
      ...(frequency === "monthly" ? { recurring: { interval: "month" } } : {}),
    },
  };

  const session = await stripe.checkout.sessions.create({
    mode: frequency === "monthly" ? "subscription" : "payment",
    line_items: [lineItem],
    success_url: `${appUrl}/give?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/give?status=cancelled`,
    metadata: { frequency },
    ...(email ? { customer_email: email } : {}),
  });

  return NextResponse.json({ url: session.url });
}
