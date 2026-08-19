import { NextResponse } from "next/server";

import { handleStripeWebhookEvent } from "@/lib/donations/stripe-webhook";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const db = getFirebaseAdminFirestore();

  if (!db) {
    console.error("[stripe/webhook] Firebase Admin not configured — refusing so Stripe retries.", event.type);
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503 },
    );
  }

  try {
    const result = await handleStripeWebhookEvent(db, stripe, event);
    console.info("[stripe/webhook]", event.type, event.id, result);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    console.error("[stripe/webhook]", event.type, event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
