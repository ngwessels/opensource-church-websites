import { NextResponse } from "next/server";

import { processScheduledPublishesAdmin } from "@/lib/cms/pages";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503 },
    );
  }

  try {
    const result = await processScheduledPublishesAdmin();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process scheduled publishes.";
    console.error("[cron/publish-scheduled]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
