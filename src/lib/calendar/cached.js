import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CACHE_TAGS } from "@/lib/cache/tags";

import { fetchGoogleCalendarEvents } from "./google";
import { parseGoogleCalendarId } from "./schema";
import { normalizeSiteTimezone } from "../site/timezone";

/**
 * Cached Google Calendar fetch for API routes and revalidation passes.
 * Public pages prefetch events at render time instead of calling this from the client.
 */
export function getCachedGoogleCalendarEvents(calendarId, max = 15, siteTimezone = "") {
  const normalizedId = parseGoogleCalendarId(calendarId) || calendarId.trim();
  const normalizedTimezone = normalizeSiteTimezone(siteTimezone);
  return unstable_cache(
    async () => fetchGoogleCalendarEvents(calendarId, max, normalizedTimezone),
    ["google-calendar-events", normalizedId, String(max), normalizedTimezone],
    {
      tags: [PUBLIC_CACHE_TAGS.googleCalendar(normalizedId)],
      revalidate: 300,
    },
  )();
}
