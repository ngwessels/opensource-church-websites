import { NextResponse } from "next/server";

import { getCachedGoogleCalendarEvents } from "@/lib/calendar/cached";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendarId")?.trim();
  const maxParam = searchParams.get("max");
  const max = maxParam ? Math.min(Math.max(parseInt(maxParam, 10) || 15, 1), 50) : 15;

  if (!calendarId) {
    return NextResponse.json(
      { error: "calendarId is required.", events: [] },
      { status: 400 },
    );
  }

  try {
    const events = await getCachedGoogleCalendarEvents(calendarId, max);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch calendar.";
    return NextResponse.json({ error: message, events: [] }, { status: 502 });
  }
}
