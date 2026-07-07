import { NextResponse } from "next/server";

import { assertDonorOwnsSubscription, getDonorPortalUserFromRequest } from "@/lib/donors/auth.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { cancelDonorSubscription } from "@/lib/stripe/subscriptions";
import { upsertSubscriptionFromStripe } from "@/lib/donations/subscription-sync";

export const runtime = "nodejs";

/**
 * @param {import("next/server").Request} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const { uid } = await getDonorPortalUserFromRequest(request);
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server not configured." }, { status: 503 });
    }

    await assertDonorOwnsSubscription(db, uid, id);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const atPeriodEnd = body.immediate !== true;
    const subscription = await cancelDonorSubscription(id, { atPeriodEnd });
    await upsertSubscriptionFromStripe(db, subscription, { donorUid: uid });

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      status: subscription.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("authorization") || message.includes("access")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
