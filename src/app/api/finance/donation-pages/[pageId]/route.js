import { NextResponse } from "next/server";

import { getFinanceOrAdminActorFromRequest } from "@/lib/cms/auth";
import { recordAuditEvent } from "@/lib/audit/record.server";
import { isDonationPageData } from "@/lib/finance/donation-pages";
import {
  normalizeDonationConfig,
  validateDonationConfig,
} from "@/lib/donations/schema";
import { revalidateAfterPagePublish } from "@/lib/cache/revalidate-public";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

export const runtime = "nodejs";

/** PATCH { donationConfig } — update donation page configuration */
export async function PATCH(request, { params }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const actor = await getFinanceOrAdminActorFromRequest(request);

    const { pageId } = await params;
    if (!pageId || typeof pageId !== "string") {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    const body = await request.json();
    if (!body?.donationConfig || typeof body.donationConfig !== "object") {
      return NextResponse.json({ error: "donationConfig is required" }, { status: 400 });
    }

    const check = validateDonationConfig(body.donationConfig);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const donationConfig = normalizeDonationConfig(body.donationConfig);

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const pageRef = db.collection(COLLECTIONS.pages).doc(pageId);
    const pageSnap = await pageRef.get();
    if (!pageSnap.exists) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const pageData = pageSnap.data();
    const before = { id: pageId, ...pageData };
    if (!isDonationPageData(pageData)) {
      return NextResponse.json({ error: "Page is not a donation page" }, { status: 400 });
    }

    const now = new Date().toISOString();
    await pageRef.update({ donationConfig, updatedAt: now });

    const afterSnap = await pageRef.get();
    const after = { id: pageId, ...afterSnap.data() };

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: {
        type: "donation_page",
        id: pageId,
        slug: pageData.slug,
        apiRoute: "/api/finance/donation-pages",
      },
      summary: `Updated donation page ${pageData.title || pageId}`,
      before,
      after,
    });

    const slug = pageData.slug ?? "";
    revalidateAfterPagePublish(slug);

    return NextResponse.json({
      id: pageId,
      slug,
      title: pageData.title ?? "",
      donationConfig,
      updatedAt: now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update donation page";
    const status =
      message.includes("authorization") ||
      message.includes("Finance or admin") ||
      message.includes("Admin access")
        ? 403
        : 500;
    console.error("[finance/donation-pages PATCH]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
