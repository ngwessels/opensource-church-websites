import "server-only";

import { fetchGoogleCalendarEvents } from "./google";
import { normalizeCalendarConfig } from "./schema";

/**
 * Load Google Calendar events for all calendar modules on a page.
 * Called during static page generation so events ship with the cached HTML.
 *
 * @param {import('@/lib/pages/regions').Page | null | undefined} page
 * @param {string} [siteTimezone]
 * @returns {Promise<Record<string, import('./types').CalendarEvent[]>>}
 */
export async function prefetchPageCalendarEvents(page, siteTimezone = "") {
  /** @type {Record<string, import('./types').CalendarEvent[]>} */
  const byModuleId = {};

  if (!page?.regions) return byModuleId;

  const tasks = [];

  for (const region of page.regions) {
    for (const mod of region.modules || []) {
      if (mod.type !== "calendar") continue;

      const config = normalizeCalendarConfig(mod.config);
      if (config.source !== "google" || !config.googleCalendarId?.trim()) continue;

      const moduleId = mod.id;
      const calendarId = config.googleCalendarId;
      const maxEvents = config.maxEvents || 15;

      tasks.push(
        fetchGoogleCalendarEvents(calendarId, maxEvents, siteTimezone)
          .then((events) => {
            byModuleId[moduleId] = events;
          })
          .catch(() => {
            byModuleId[moduleId] = [];
          }),
      );
    }
  }

  await Promise.all(tasks);
  return byModuleId;
}
