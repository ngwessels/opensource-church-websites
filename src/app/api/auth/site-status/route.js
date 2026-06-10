import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSiteInitialized } from "@/lib/site/site-status.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ initialized: false, adminConfigured: false });
    }

    const initialized = await isSiteInitialized();
    return NextResponse.json({ initialized, adminConfigured: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read site status";
    console.error("[auth/site-status]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
