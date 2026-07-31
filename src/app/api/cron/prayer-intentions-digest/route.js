import { NextResponse } from "next/server";

import { sendPrayerIntentionsDigest } from "@/lib/prayer-intentions/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly Vercel Cron: Monday 15:00 UTC.
 * Auth: Authorization Bearer CRON_SECRET
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendPrayerIntentionsDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Digest failed";
    console.error("[cron/prayer-intentions-digest]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
