import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "@/lib/firebase/admin-auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  DonorSignupNotAllowedError,
  ensureDonorProfileServer,
} from "@/lib/site/donor-bootstrap.server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing_authorization" }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const decoded = await verifyFirebaseIdToken(idToken);

    const result = await ensureDonorProfileServer({
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DonorSignupNotAllowedError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 403 });
    }

    const message = err instanceof Error ? err.message : "Donor profile bootstrap failed";
    console.error("[auth/ensure-donor-profile]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
