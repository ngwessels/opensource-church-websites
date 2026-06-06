import { generateId } from "@/lib/sitemap/tree";

/** @typedef {'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'} ZoomDay */

/**
 * @typedef {object} ZoomScheduleEntry
 * @property {string} id
 * @property {ZoomDay} day
 * @property {string} time - HH:MM (24-hour)
 */

export const ZOOM_DAY_OPTIONS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
];

const DAY_ORDER = Object.fromEntries(ZOOM_DAY_OPTIONS.map((d, i) => [d.value, i]));

const DAY_LABELS = Object.fromEntries(ZOOM_DAY_OPTIONS.map((d) => [d.value, d.label]));

/** @type {Record<ZoomDay, number>} */
const JS_DAY = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const ZOOM_JOIN_LEAD_MINUTES = 15;
export const ZOOM_STREAM_DURATION_MINUTES = 90;

/** @returns {string} */
export function generateScheduleId() {
  return generateId();
}

/**
 * @param {unknown} entry
 * @returns {ZoomScheduleEntry}
 */
export function normalizeScheduleEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return { id: generateScheduleId(), day: "sunday", time: "10:00" };
  }

  const e = /** @type {Record<string, unknown>} */ (entry);
  const day = ZOOM_DAY_OPTIONS.some((d) => d.value === e.day) ? e.day : "sunday";

  return {
    id: typeof e.id === "string" ? e.id : generateScheduleId(),
    day: /** @type {ZoomDay} */ (day),
    time: typeof e.time === "string" ? e.time : "",
  };
}

/**
 * @param {unknown} schedule
 * @returns {ZoomScheduleEntry[]}
 */
export function normalizeZoomSchedule(schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule.map(normalizeScheduleEntry).filter((e) => e.day && e.time);
}

/**
 * @param {ZoomScheduleEntry[]} schedule
 * @returns {ZoomScheduleEntry[]}
 */
export function sortZoomSchedule(schedule) {
  return [...schedule].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0);
    if (dayDiff !== 0) return dayDiff;
    return a.time.localeCompare(b.time);
  });
}

/**
 * Format 24-hour HH:MM as 12-hour display (e.g. "10:00 AM").
 * @param {string} time24
 * @returns {string}
 */
export function formatScheduleTime(time24) {
  if (!time24) return "";
  const match = time24.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time24;

  const hour = Number(match[1]);
  const minute = match[2];
  if (Number.isNaN(hour)) return time24;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

/**
 * @param {ZoomDay} day
 * @returns {string}
 */
export function formatScheduleDay(day) {
  return DAY_LABELS[day] || day;
}

/**
 * @param {ZoomScheduleEntry} entry
 * @returns {string}
 */
export function formatScheduleEntry(entry) {
  return `${formatScheduleDay(entry.day)} at ${formatScheduleTime(entry.time)}`;
}

/**
 * This week's local occurrence of a recurring schedule entry.
 * @param {ZoomScheduleEntry} entry
 * @param {Date} [now]
 * @returns {Date | null}
 */
export function getScheduleOccurrence(entry, now = new Date()) {
  const targetDay = JS_DAY[entry.day];
  if (targetDay === undefined) return null;

  const match = entry.time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const occurrence = new Date(now);
  occurrence.setSeconds(0, 0);
  occurrence.setHours(hours, minutes, 0, 0);

  const dayDiff = targetDay - occurrence.getDay();
  occurrence.setDate(occurrence.getDate() + dayDiff);

  return occurrence;
}

/**
 * Whether the join window is open for a single schedule entry.
 * @param {ZoomScheduleEntry} entry
 * @param {Date} [now]
 * @param {{ leadMinutes?: number, durationMinutes?: number }} [options]
 */
export function isScheduleEntryJoinOpen(entry, now = new Date(), options = {}) {
  const leadMinutes = options.leadMinutes ?? ZOOM_JOIN_LEAD_MINUTES;
  const durationMinutes = options.durationMinutes ?? ZOOM_STREAM_DURATION_MINUTES;
  const occurrence = getScheduleOccurrence(entry, now);
  if (!occurrence) return false;

  const windowStart = new Date(occurrence.getTime() - leadMinutes * 60 * 1000);
  const windowEnd = new Date(occurrence.getTime() + durationMinutes * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
}

/**
 * Join button is always available when no schedule is set.
 * @param {ZoomScheduleEntry[]} schedule
 * @param {Date} [now]
 * @param {{ leadMinutes?: number, durationMinutes?: number }} [options]
 */
export function isZoomJoinVisible(schedule, now = new Date(), options = {}) {
  if (!schedule?.length) return true;
  return schedule.some((entry) => isScheduleEntryJoinOpen(entry, now, options));
}

/**
 * Extract meeting ID from a Zoom join URL.
 * @param {string} input
 * @returns {string}
 */
export function parseZoomMeetingId(input) {
  const trimmed = input?.trim() || "";
  if (!trimmed) return "";

  const urlMatch = trimmed.match(/zoom\.us\/j\/(\d+)/i);
  if (urlMatch?.[1]) return urlMatch[1];

  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

/**
 * Format meeting ID with spaces for readability (e.g. 993 4497 4745).
 * @param {string} meetingId
 * @returns {string}
 */
export function formatMeetingId(meetingId) {
  const digits = meetingId.replace(/\D/g, "");
  if (!digits) return meetingId;

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}

/**
 * @param {Record<string, unknown>} config
 */
export function normalizeZoomConfig(config = {}) {
  const joinUrl = typeof config.joinUrl === "string" ? config.joinUrl.trim() : "";
  let meetingId = typeof config.meetingId === "string" ? config.meetingId.trim() : "";

  if (!meetingId && joinUrl) {
    meetingId = parseZoomMeetingId(joinUrl);
  }

  return {
    title: typeof config.title === "string" ? config.title : "Live Streaming",
    meetingId,
    password: typeof config.password === "string" ? config.password : "",
    joinUrl,
    instructions: typeof config.instructions === "string" ? config.instructions : "",
    schedule: normalizeZoomSchedule(config.schedule),
  };
}
