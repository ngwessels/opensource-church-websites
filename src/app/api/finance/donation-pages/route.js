import { NextResponse } from "next/server";

import { getFinanceOrAdminUserFromRequest } from "@/lib/cms/auth";
import { buildDonationPageSummary } from "@/lib/finance/donation-pages";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

export const runtime = "nodejs";

/** GET — list donation pages for finance/admin users */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getFinanceOrAdminUserFromRequest(request);

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const snap = await db.collection(COLLECTIONS.pages).where("pageType", "==", "donation").get();
    const pages = snap.docs
      .map((docSnap) => buildDonationPageSummary(docSnap))
      .sort((a, b) => (a.title || a.slug).localeCompare(b.title || b.slug));

    return NextResponse.json({ pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list donation pages";
    const status =
      message.includes("authorization") ||
      message.includes("Finance or admin") ||
      message.includes("Admin access")
        ? 403
        : 500;
    console.error("[finance/donation-pages GET]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
