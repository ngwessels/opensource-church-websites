import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CACHE_TAGS } from "@/lib/cache/tags";

import { fetchGoogleCalendarEvents } from "./google";
import { parseGoogleCalendarId } from "./schema";

/**
 * Cached Google Calendar fetch for API routes and revalidation passes.
 * Public pages prefetch events at render time instead of calling this from the client.
 */
export function getCachedGoogleCalendarEvents(calendarId, max = 15) {
  const normalizedId = parseGoogleCalendarId(calendarId) || calendarId.trim();
  return unstable_cache(
    async () => fetchGoogleCalendarEvents(calendarId, max),
    ["google-calendar-events", normalizedId, String(max)],
    {
      tags: [PUBLIC_CACHE_TAGS.googleCalendar(normalizedId)],
      revalidate: 300,
    },
  )();
}
