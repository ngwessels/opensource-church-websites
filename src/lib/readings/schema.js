/** @typedef {'FR' | 'PS' | 'SR' | 'GSP'} ReadingContentCode */

/**
 * @typedef {object} DailyReadingSection
 * @property {string} title
 * @property {string} citation
 * @property {string} text
 */

/**
 * @typedef {object} DailyReadings
 * @property {string} date - YYYY-MM-DD
 * @property {string} liturgicalTitle
 * @property {string} [saint]
 * @property {DailyReadingSection[]} readings
 * @property {string} usccbUrl
 * @property {string} [commentary]
 */

/**
 * @typedef {object} DailyReadingsModuleConfig
 * @property {string} [title]
 * @property {boolean} [showUsccbLink]
 */

/**
 * @param {unknown} config
 * @returns {DailyReadingsModuleConfig}
 */
export function normalizeDailyReadingsConfig(config) {
  const raw = /** @type {DailyReadingsModuleConfig} */ (config || {});
  return {
    title: typeof raw.title === "string" ? raw.title : "Daily Readings",
    showUsccbLink: raw.showUsccbLink !== false,
  };
}

/**
 * @param {Date | string} [input]
 * @returns {string} YYYY-MM-DD
 */
export function toIsoDate(input = new Date()) {
  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
    return toIsoDate(new Date());
  }

  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} isoDate - YYYY-MM-DD
 * @returns {string} YYYYMMDD
 */
export function toEvangelizoDate(isoDate) {
  return isoDate.replace(/-/g, "");
}

/**
 * @param {string} isoDate - YYYY-MM-DD
 * @returns {string}
 */
export function toUsccbReadingsUrl(isoDate) {
  const [year, month, day] = isoDate.split("-");
  const yy = year.slice(-2);
  return `https://bible.usccb.org/bible/readings/${month}${day}${yy}.cfm`;
}

/**
 * @param {string} isoDate - YYYY-MM-DD
 * @returns {boolean}
 */
export function isWithinEvangelizoWindow(isoDate) {
  const target = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(target.getTime())) return false;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 30);

  const min = new Date(today);
  min.setDate(min.getDate() - 1);

  return target >= min && target <= max;
}
