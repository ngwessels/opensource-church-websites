import { NextResponse } from "next/server";

import {
  persistDonationFromCheckoutSession,
  persistDonationFromInvoice,
  persistInvoicePaymentFailed,
  persistSubscriptionLifecycleEvent,
} from "@/lib/donations/stripe-webhook";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe/server";

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
    console.warn("[stripe/webhook] Firebase Admin not configured — donation not persisted.", event.type);
    return NextResponse.json({ received: true, persisted: false });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await persistDonationFromCheckoutSession(db, session);
    return NextResponse.json({ received: true, persisted: true });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const result = await persistDonationFromInvoice(db, stripe, invoice);
    return NextResponse.json({ received: true, ...result });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    await persistSubscriptionLifecycleEvent(db, subscription);
    return NextResponse.json({ received: true, persisted: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    await persistInvoicePaymentFailed(db, invoice);
    return NextResponse.json({ received: true, persisted: true });
  }

  return NextResponse.json({ received: true });
}
