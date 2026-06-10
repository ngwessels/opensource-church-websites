import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { revalidateAfterPagePublish, revalidatePublicSite } from "@/lib/cache/revalidate-public";

export const runtime = "nodejs";

/**
 * POST { scope: "page" | "site", slug?: string }
 * Purges cached public pages after a publish or site-wide change.
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const body = await request.json();
    const scope = body?.scope === "site" ? "site" : "page";
    const slug = typeof body?.slug === "string" ? body.slug : "";

    if (scope === "site") {
      revalidatePublicSite();
    } else {
      revalidateAfterPagePublish(slug);
    }

    return NextResponse.json({ revalidated: true, scope, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revalidation failed";
    const status = message === "Missing authorization" || message === "Admin access required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
