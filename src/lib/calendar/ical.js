/**
 * Minimal iCal VEVENT parser for Google Calendar public feeds.
 * Avoids node-ical (temporal polyfill breaks under Next.js webpack).
 */

/**
 * @param {string} text
 * @returns {string}
 */
function decodeIcalText(text) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Unfold RFC 5545 continuation lines.
 * @param {string} text
 * @returns {string}
 */
function unfoldIcal(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

/**
 * @param {string} block
 * @returns {Record<string, string>}
 */
function parsePropertyBlock(block) {
  /** @type {Record<string, string>} */
  const props = {};
  const lines = unfoldIcal(block).split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const keyPart = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const key = keyPart.split(";")[0].toUpperCase();
    props[key] = value;
  }

  return props;
}

/**
 * @param {string} value
 * @param {string} [keyPart] - full key including params e.g. DTSTART;VALUE=DATE
 * @returns {{ date: string, startTime: string, endTime: string, allDay: boolean }}
 */
function parseIcalDateTime(value, keyPart = "") {
  const allDay = keyPart.toUpperCase().includes("VALUE=DATE") || /^\d{8}$/.test(value);

  if (allDay && /^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { date: `${y}-${m}-${d}`, startTime: "", endTime: "", allDay: true };
  }

  // 20250907T180000Z or 20250907T180000
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!match) {
    return { date: "", startTime: "", endTime: "", allDay: false };
  }

  const [, y, mo, d, h, mi] = match;
  const utc = value.endsWith("Z");
  let date;
  let hours = Number(h);
  let minutes = Number(mi);

  if (utc) {
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), hours, minutes));
    date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    hours = dt.getHours();
    minutes = dt.getMinutes();
  } else {
    date = `${y}-${mo}-${d}`;
  }

  const startTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { date, startTime, endTime: "", allDay: false };
}

/**
 * @param {string} icsText
 * @returns {Array<{ uid: string, summary: string, description: string, location: string, url: string, dtstart: string, dtstartKey: string, dtend: string, dtendKey: string }>}
 */
export function parseVevents(icsText) {
  const unfolded = unfoldIcal(icsText);
  const parts = unfolded.split("BEGIN:VEVENT");
  /** @type {ReturnType<typeof parseVevents>} */
  const events = [];

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split("END:VEVENT")[0];
    const props = parsePropertyBlock(block);

    if (!props.DTSTART) continue;

    events.push({
      uid: props.UID || "",
      summary: props.SUMMARY || "",
      description: props.DESCRIPTION || "",
      location: props.LOCATION || "",
      url: props.URL || "",
      dtstart: props.DTSTART,
      dtstartKey: block.match(/^(DTSTART[^\n:]*)/m)?.[1] || "DTSTART",
      dtend: props.DTEND || "",
      dtendKey: block.match(/^(DTEND[^\n:]*)/m)?.[1] || "DTEND",
    });
  }

  return events;
}

/**
 * @param {ReturnType<typeof parseVevents>[number]} vevent
 * @param {import('./types').CalendarEvent | null} base
 */
export function veventToCalendarEvent(vevent, base = null) {
  const title = decodeIcalText(vevent.summary);
  if (!title) return null;

  const start = parseIcalDateTime(vevent.dtstart, vevent.dtstartKey);
  if (!start.date) return null;

  let endDate = "";
  let endTime = "";

  if (vevent.dtend) {
    const end = parseIcalDateTime(vevent.dtend, vevent.dtendKey);
    if (end.allDay) {
      const [y, m, d] = end.date.split("-").map(Number);
      const adjusted = new Date(y, m - 1, d);
      adjusted.setDate(adjusted.getDate() - 1);
      const adjIso = `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, "0")}-${String(adjusted.getDate()).padStart(2, "0")}`;
      endDate = adjIso !== start.date ? adjIso : "";
    } else {
      endTime = end.startTime;
      if (end.date !== start.date) endDate = end.date;
    }
  }

  return {
    id: vevent.uid || base?.id || "",
    title,
    date: start.date,
    startTime: start.allDay ? "" : start.startTime,
    endTime: start.allDay ? "" : endTime,
    endDate,
    location: decodeIcalText(vevent.location),
    description: decodeIcalText(vevent.description),
    url: vevent.url.trim(),
  };
}
