import { isExternalCalendarInvite, parseVevents, veventToCalendarEvent } from "./ical";
import { filterUpcoming, generateEventId, googleCalendarIcalUrl, parseGoogleCalendarId } from "./schema";

/**
 * @param {string} calendarId
 * @param {number} [max]
 * @returns {Promise<import('./types').CalendarEvent[]>}
 */
export async function fetchGoogleCalendarEvents(calendarId, max = 15) {
  const normalizedId = parseGoogleCalendarId(calendarId);
  if (!normalizedId) return [];

  const icalUrl = googleCalendarIcalUrl(normalizedId);
  const response = await fetch(icalUrl, { next: { revalidate: 300 } });

  if (!response.ok) {
    throw new Error(`Google Calendar returned ${response.status} ${response.statusText}`);
  }

  const icsText = await response.text();
  const vevents = parseVevents(icsText);

  const events = vevents
    .filter((vevent) => !isExternalCalendarInvite(vevent, normalizedId))
    .map((vevent) => {
      const event = veventToCalendarEvent(vevent);
      if (event && !event.id) event.id = generateEventId();
      return event;
    })
    .filter(Boolean);

  return filterUpcoming(/** @type {import('./types').CalendarEvent[]} */ (events), max);
}
