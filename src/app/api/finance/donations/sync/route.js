import { NextResponse } from "next/server";

import { getFinanceOrAdminUserFromRequest } from "@/lib/cms/auth";
import { syncDonationsFromStripe } from "@/lib/donations/stripe-sync";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export const runtime = "nodejs";

/** POST — backfill donations from Stripe Checkout sessions and renewal invoices */
export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    await getFinanceOrAdminUserFromRequest(request);

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    let lookbackDays;
    try {
      const body = await request.json();
      if (body && typeof body.lookbackDays === "number") {
        lookbackDays = body.lookbackDays;
      }
    } catch {
      // empty body is fine
    }

    const summary = await syncDonationsFromStripe(db, getStripe(), { lookbackDays });
    const created =
      summary.checkouts.created + summary.payments.created + summary.renewals.created;
    const errors = [
      ...summary.checkouts.errors,
      ...summary.payments.errors,
      ...summary.renewals.errors,
    ];

    console.info("[finance/donations/sync]", {
      created,
      checkouts: summary.checkouts,
      payments: summary.payments,
      renewals: summary.renewals,
    });

    return NextResponse.json({
      ok: errors.length === 0,
      created,
      summary,
      ...(errors.length > 0 ? { errorCount: errors.length } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync donations";
    const status =
      message.includes("authorization") ||
      message.includes("Finance or admin") ||
      message.includes("Admin access")
        ? 403
        : 500;
    console.error("[finance/donations/sync POST]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
