import { generateId } from "@/lib/sitemap/tree";

/** @returns {string} */
export function generateMassEntryId() {
  return generateId();
}

/** @returns {import('./types').MassTimesConfig} */
export function emptyMassTimes() {
  return {
    weekly: { saturday: [], sunday: [], weekday: [] },
    holidays: [],
    special: [],
    confession: [],
  };
}

/**
 * @param {string} iso - YYYY-MM-DD
 * @returns {string}
 */
export function formatMassDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * @param {string} date
 * @param {string} [endDate]
 * @returns {string}
 */
export function formatMassDateRange(date, endDate) {
  if (!endDate || endDate === date) return formatMassDate(date);
  return `${formatMassDate(date)} – ${formatMassDate(endDate)}`;
}

/**
 * @param {unknown} entry
 * @returns {import('./types').MassHolidayEntry}
 */
function normalizeHolidayEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return { id: generateMassEntryId(), name: "", date: "", times: [], notes: "" };
  }
  const e = /** @type {Record<string, unknown>} */ (entry);
  return {
    id: typeof e.id === "string" ? e.id : generateMassEntryId(),
    name: typeof e.name === "string" ? e.name : "",
    date: typeof e.date === "string" ? e.date : "",
    times: Array.isArray(e.times) ? e.times.filter((t) => typeof t === "string") : [],
    notes: typeof e.notes === "string" ? e.notes : "",
  };
}

/**
 * @param {unknown} entry
 * @returns {import('./types').MassSpecialEntry}
 */
function normalizeSpecialEntry(entry) {
  const base = normalizeHolidayEntry(entry);
  const e = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
  return {
    ...base,
    endDate: typeof e.endDate === "string" ? e.endDate : "",
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./types').MassTimesConfig}
 */
export function normalizeMassTimes(raw) {
  if (!raw || typeof raw !== "object") return emptyMassTimes();

  const data = /** @type {Record<string, unknown>} */ (raw);

  if (data.weekly && typeof data.weekly === "object") {
    const weekly = /** @type {Record<string, unknown>} */ (data.weekly);
    return {
      weekly: {
        saturday: Array.isArray(weekly.saturday) ? weekly.saturday : [],
        sunday: Array.isArray(weekly.sunday) ? weekly.sunday : [],
        weekday: Array.isArray(weekly.weekday) ? weekly.weekday : [],
      },
      holidays: Array.isArray(data.holidays) ? data.holidays.map(normalizeHolidayEntry) : [],
      special: Array.isArray(data.special) ? data.special.map(normalizeSpecialEntry) : [],
      confession: Array.isArray(data.confession) ? data.confession : [],
    };
  }

  return {
    weekly: {
      saturday: Array.isArray(data.saturday) ? data.saturday : [],
      sunday: Array.isArray(data.sunday) ? data.sunday : [],
      weekday: Array.isArray(data.weekday) ? data.weekday : [],
    },
    holidays: Array.isArray(data.holidays) ? data.holidays.map(normalizeHolidayEntry) : [],
    special: Array.isArray(data.special) ? data.special.map(normalizeSpecialEntry) : [],
    confession: Array.isArray(data.confession) ? data.confession : [],
  };
}

/**
 * @param {{ config?: { useSiteDefaults?: boolean, times?: unknown } }} module
 * @param {{ massTimes?: unknown } | null | undefined} siteConfig
 * @returns {import('./types').MassTimesConfig}
 */
export function resolveMassTimes(module, siteConfig) {
  const config = module?.config || {};
  if (config.useSiteDefaults === true || (config.useSiteDefaults === undefined && !config.times)) {
    return normalizeMassTimes(siteConfig?.massTimes || {});
  }
  return normalizeMassTimes(config.times || siteConfig?.massTimes || {});
}

/**
 * @param {import('./types').MassTimesConfig} times
 * @returns {import('./types').MassTimesConfig}
 */
export function sortMassTimes(times) {
  const sortByDate = (a, b) => (a.date || "").localeCompare(b.date || "");
  return {
    ...times,
    holidays: [...times.holidays].sort(sortByDate),
    special: [...times.special].sort(sortByDate),
  };
}
