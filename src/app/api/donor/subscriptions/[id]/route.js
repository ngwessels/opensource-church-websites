import { NextResponse } from "next/server";

import { upsertSubscriptionFromStripe } from "@/lib/donations/subscription-sync";
import { assertDonorOwnsSubscription, getDonorPortalUserFromRequest } from "@/lib/donors/auth.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { updateDonorSubscription } from "@/lib/stripe/subscriptions";

export const runtime = "nodejs";

const VALID_FREQUENCIES = ["weekly", "monthly"];

/**
 * @param {import("next/server").Request} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function PATCH(request, context) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const { id } = await context.params;
    const { uid } = await getDonorPortalUserFromRequest(request);
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server not configured." }, { status: 503 });
    }

    await assertDonorOwnsSubscription(db, uid, id);

    const body = await request.json();
    const { amountCents, frequency } = body;

    if (!amountCents || typeof amountCents !== "number" || amountCents < 100) {
      return NextResponse.json({ error: "amountCents must be at least 100." }, { status: 400 });
    }

    if (!VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: "frequency must be weekly or monthly." }, { status: 400 });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(id);
    const updated = await updateDonorSubscription(subscription, { amountCents, frequency });
    await upsertSubscriptionFromStripe(db, updated, { donorUid: uid });

    return NextResponse.json({ ok: true, subscriptionId: updated.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("authorization") || message.includes("access")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
