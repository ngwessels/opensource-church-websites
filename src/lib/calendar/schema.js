import { generateId } from "@/lib/sitemap/tree";

const DEFAULT_MAX_EVENTS = 15;
const DEFAULT_PREVIEW_COUNT = 5;

/** @returns {string} */
export function generateEventId() {
  return generateId();
}

/**
 * @param {unknown} event
 * @returns {import('./types').CalendarEvent}
 */
export function normalizeEvent(event) {
  if (!event || typeof event !== "object") {
    return {
      id: generateEventId(),
      title: "",
      date: "",
      startTime: "",
      endTime: "",
      endDate: "",
      location: "",
      description: "",
      url: "",
    };
  }
  const e = /** @type {Record<string, unknown>} */ (event);
  return {
    id: typeof e.id === "string" ? e.id : generateEventId(),
    title: typeof e.title === "string" ? e.title : "",
    date: typeof e.date === "string" ? e.date : "",
    startTime: typeof e.startTime === "string" ? e.startTime : "",
    endTime: typeof e.endTime === "string" ? e.endTime : "",
    endDate: typeof e.endDate === "string" ? e.endDate : "",
    location: typeof e.location === "string" ? e.location : "",
    description: typeof e.description === "string" ? e.description : "",
    url: typeof e.url === "string" ? e.url : "",
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./types').CalendarModuleConfig}
 */
export function normalizeCalendarConfig(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      title: "Upcoming Events",
      source: "manual",
      events: [],
      maxEvents: DEFAULT_MAX_EVENTS,
      previewCount: DEFAULT_PREVIEW_COUNT,
    };
  }
  const c = /** @type {Record<string, unknown>} */ (raw);
  const source = c.source === "google" ? "google" : "manual";
  const maxEvents =
    typeof c.maxEvents === "number" && c.maxEvents > 0
      ? Math.min(c.maxEvents, 50)
      : DEFAULT_MAX_EVENTS;
  const previewCount =
    typeof c.previewCount === "number" && c.previewCount > 0
      ? Math.min(c.previewCount, maxEvents)
      : Math.min(DEFAULT_PREVIEW_COUNT, maxEvents);

  const base = {
    title: typeof c.title === "string" ? c.title : "Upcoming Events",
    source,
    maxEvents,
    previewCount,
  };

  if (source === "google") {
    return {
      ...base,
      googleCalendarId:
        typeof c.googleCalendarId === "string"
          ? parseGoogleCalendarId(c.googleCalendarId)
          : "",
    };
  }

  return {
    ...base,
    events: Array.isArray(c.events) ? c.events.map(normalizeEvent) : [],
  };
}

/**
 * @param {import('./types').CalendarEvent} event
 * @returns {Date | null}
 */
export function eventStartDateTime(event) {
  if (!event.date) return null;
  const [year, month, day] = event.date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (event.startTime) {
    const [h, m] = event.startTime.split(":").map(Number);
    if (!Number.isNaN(h)) date.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

/**
 * @param {import('./types').CalendarEvent} event
 * @returns {Date | null}
 */
export function eventEndDateTime(event) {
  const endDate = event.endDate || event.date;
  if (!endDate) return null;

  const [year, month, day] = endDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  if (event.endTime) {
    const [h, m] = event.endTime.split(":").map(Number);
    if (!Number.isNaN(h)) date.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
  } else if (event.startTime) {
    // Timed event without explicit end — visible through end of that day
    date.setHours(23, 59, 59, 999);
  } else {
    // All-day event ends at end of the last day
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

/**
 * @param {import('./types').CalendarEvent[]} events
 * @returns {import('./types').CalendarEvent[]}
 */
export function sortEventsByDate(events) {
  return [...events].sort((a, b) => {
    const da = eventStartDateTime(a);
    const db = eventStartDateTime(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
}

/**
 * @param {import('./types').CalendarEvent[]} events
 * @param {number} [max]
 * @returns {import('./types').CalendarEvent[]}
 */
export function filterUpcoming(events, max = DEFAULT_MAX_EVENTS) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const upcoming = events.filter((event) => {
    const start = eventStartDateTime(event);
    const end = eventEndDateTime(event);
    if (!start || !end) return false;
    // Drop events that started before today (e.g. multi-day items from earlier in the month)
    if (start.getTime() < startOfToday.getTime()) return false;
    // Drop timed events today that have already ended
    return end.getTime() >= now.getTime();
  });

  return sortEventsByDate(upcoming).slice(0, max);
}

/**
 * @param {string} iso - YYYY-MM-DD
 * @returns {{ month: string, day: string, weekday: string }}
 */
export function formatEventDateBadge(iso) {
  if (!iso) return { month: "", day: "", weekday: "" };
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return { month: "", day: "", weekday: "" };
  const date = new Date(year, month - 1, day);
  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase(),
    day: String(day),
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
  };
}

/**
 * @param {string} time - HH:mm
 * @param {{ short?: boolean }} [options]
 * @returns {string}
 */
export function formatClockTime(time, options = {}) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const date = new Date(2000, 0, 1, h, Number.isNaN(m) ? 0 : m);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: options.short && m === 0 ? undefined : "2-digit",
  }).format(date);
}

/**
 * @param {string} iso - YYYY-MM-DD
 * @returns {string}
 */
function formatShortDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

/**
 * @param {import('./types').CalendarEvent} event
 * @returns {string}
 */
export function formatEventTime(event) {
  const hasTime = Boolean(event.startTime || event.endTime);

  if (!hasTime) {
    if (event.endDate && event.endDate !== event.date) {
      return `All day · ${formatShortDate(event.date)} – ${formatShortDate(event.endDate)}`;
    }
    return "All day";
  }

  let timeRange = "";
  if (event.startTime && event.endTime) {
    timeRange = `${formatClockTime(event.startTime)} – ${formatClockTime(event.endTime)}`;
  } else if (event.startTime) {
    timeRange = formatClockTime(event.startTime);
  } else {
    timeRange = formatClockTime(event.endTime);
  }

  if (event.endDate && event.endDate !== event.date) {
    return `${timeRange} · ${formatShortDate(event.date)} – ${formatShortDate(event.endDate)}`;
  }

  return timeRange;
}

/**
 * Compact time for the date badge (timed events only).
 * @param {import('./types').CalendarEvent} event
 * @returns {string}
 */
export function formatEventBadgeTime(event) {
  if (!event.startTime) return "";
  return formatClockTime(event.startTime, { short: true });
}

/**
 * Accept a bare calendar ID or a full Google iCal URL and return the ID.
 * @param {string} value
 * @returns {string}
 */
export function parseGoogleCalendarId(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/ical\/([^/]+)\/public\//i);
      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  } catch {
    // fall through to return trimmed value
  }

  return trimmed;
}

/**
 * Build Google Calendar public iCal URL.
 * @param {string} calendarId
 * @returns {string}
 */
export function googleCalendarIcalUrl(calendarId) {
  const id = parseGoogleCalendarId(calendarId);
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
}
