import { NextResponse } from "next/server";

import { normalizeHttpsUrl } from "@/lib/embed/urls";
import { fetchFeedItems } from "@/lib/rss/parse";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim();
  const limitParam = Number(searchParams.get("limit") ?? 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 10, 1), 20);

  if (!rawUrl) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  const feedUrl = normalizeHttpsUrl(rawUrl);
  if (!feedUrl) {
    return NextResponse.json({ error: "Feed URL must be HTTPS." }, { status: 400 });
  }

  try {
    const items = await fetchFeedItems(feedUrl, limit);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch feed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
