import { NextResponse } from "next/server";

import { donorFromStripeSession } from "@/lib/donations/schema";
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const db = getFirebaseAdminFirestore();

    if (!db) {
      console.warn("[stripe/webhook] Firebase Admin not configured — donation not persisted.", session.id);
      return NextResponse.json({ received: true, persisted: false });
    }

    const frequency = session.metadata?.frequency ?? "once";
    const amountCents = session.amount_total ?? 0;
    const fundId = session.metadata?.fundId;
    const fundLabel = session.metadata?.fundLabel;
    const returnPath = session.metadata?.returnPath;

    const donor = donorFromStripeSession(
      session.customer_details,
      session.customer_email ?? undefined,
    );

    await db.collection("donations").doc(session.id).set({
      amountCents,
      currency: session.currency ?? "usd",
      frequency,
      status: "completed",
      stripeSessionId: session.id,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
      ...(donor ? { donor } : {}),
      donorEmail: donor?.email ?? session.customer_details?.email ?? session.customer_email ?? undefined,
      ...(fundId ? { fundId } : {}),
      ...(fundLabel ? { fundLabel } : {}),
      ...(returnPath ? { returnPath } : {}),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ received: true, persisted: true });
  }

  return NextResponse.json({ received: true });
}
