import { NextResponse } from "next/server";

import { getDonorPortalUserFromRequest } from "@/lib/donors/auth.server";
import { createDonorBillingPortalSession } from "@/lib/stripe/subscriptions";
import { isStripeConfigured, joinAppUrl } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const { profile } = await getDonorPortalUserFromRequest(request);
    const stripeCustomerIds = Array.isArray(profile?.stripeCustomerIds)
      ? profile.stripeCustomerIds
      : [];

    if (stripeCustomerIds.length === 0) {
      return NextResponse.json(
        { error: "No payment profile found. Make a donation first to set up billing." },
        { status: 400 },
      );
    }

    const session = await createDonorBillingPortalSession(
      stripeCustomerIds[0],
      joinAppUrl("/give/account"),
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Billing portal failed";
    const status =
      message.includes("authorization") || message.includes("access") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
