/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string} date - ISO YYYY-MM-DD
 * @property {string} [startTime] - HH:mm (24h)
 * @property {string} [endTime] - HH:mm (24h)
 * @property {string} [endDate] - ISO YYYY-MM-DD for multi-day events
 * @property {string} [location]
 * @property {string} [description]
 * @property {string} [url]
 */

/**
 * @typedef {'manual' | 'google'} CalendarSource
 */

/**
 * @typedef {Object} CalendarModuleConfig
 * @property {string} [title]
 * @property {CalendarSource} [source]
 * @property {CalendarEvent[]} [events]
 * @property {string} [googleCalendarId]
 * @property {number} [maxEvents]
 */

export {};
