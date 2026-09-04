import { NextResponse } from "next/server";

import { getDonorPortalUserFromRequest } from "@/lib/donors/auth.server";
import { syncDonorSubscriptionsFromStripe } from "@/lib/donors/sync-subscriptions";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { uid, profile, decoded } = await getDonorPortalUserFromRequest(request);
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server not configured." }, { status: 503 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const stripeCustomerIds = Array.isArray(profile?.stripeCustomerIds)
      ? profile.stripeCustomerIds
      : [];
    const email = decoded.email || profile?.email;

    const result = await syncDonorSubscriptionsFromStripe(db, getStripe(), {
      uid,
      email,
      stripeCustomerIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Subscription sync failed";
    const status =
      message.includes("authorization") || message.includes("access") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
