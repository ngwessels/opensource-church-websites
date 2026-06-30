/** @typedef {{ value: string, label: string }} SiteTimezoneOption */

export const DEFAULT_SITE_TIMEZONE = "America/Los_Angeles";

/** @type {SiteTimezoneOption[]} */
export const SITE_TIMEZONE_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Phoenix", label: "Mountain — Arizona (no DST)" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "America/Anchorage", label: "Alaska — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Honolulu" },
];

/**
 * @param {string} iana
 * @returns {boolean}
 */
function isValidIanaTimezone(iana) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: iana }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSiteTimezone(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed && isValidIanaTimezone(trimmed)) return trimmed;
  return DEFAULT_SITE_TIMEZONE;
}

/**
 * @param {string} iana
 * @returns {string}
 */
export function formatTimezoneLabel(iana) {
  const normalized = normalizeSiteTimezone(iana);
  const match = SITE_TIMEZONE_OPTIONS.find((option) => option.value === normalized);
  return match?.label || normalized;
}
