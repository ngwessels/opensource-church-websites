/**
 * @typedef {Object} MassHolidayEntry
 * @property {string} id
 * @property {string} name
 * @property {string} date - ISO YYYY-MM-DD
 * @property {string[]} times
 * @property {string} [notes]
 */

/**
 * @typedef {MassHolidayEntry & { endDate?: string }} MassSpecialEntry
 */

/**
 * @typedef {Object} MassTimesConfig
 * @property {{ saturday: string[], sunday: string[], weekday: string[] }} weekly
 * @property {MassHolidayEntry[]} holidays
 * @property {MassSpecialEntry[]} special
 * @property {string[]} confession
 */

export {};
