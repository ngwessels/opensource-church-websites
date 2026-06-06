/**
 * @param {string} [iso]
 * @returns {string}
 */
export function toDatetimeLocalValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Default schedule: next whole hour at least 1 hour from now.
 * @returns {string} datetime-local value
 */
export function defaultScheduleDatetimeLocal() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getTime() <= Date.now()) {
    d.setHours(d.getHours() + 1);
  }
  return toDatetimeLocalValue(d.toISOString());
}

/**
 * @param {string} datetimeLocal
 * @returns {string} ISO timestamp
 */
export function fromDatetimeLocalValue(datetimeLocal) {
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date and time.");
  }
  return d.toISOString();
}

/**
 * @param {string} publishAtIso
 */
export function assertFuturePublishDate(publishAtIso) {
  const publishDate = new Date(publishAtIso);
  if (Number.isNaN(publishDate.getTime())) {
    throw new Error("Invalid publish date.");
  }
  if (publishDate.getTime() <= Date.now()) {
    throw new Error("Publish date must be in the future.");
  }
  return publishAtIso;
}

/**
 * @param {string} [iso]
 * @returns {string}
 */
export function formatScheduledPublishAt(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
