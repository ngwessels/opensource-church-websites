/**
 * @param {import('@/types/firestore').Bulletin & { id?: string }} bulletin
 */
export function formatBulletinDate(bulletin) {
  const dateStr = bulletin.date;
  if (!dateStr) return bulletin.title || "Bulletin";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * @param {import('@/types/firestore').Bulletin & { id?: string }} bulletin
 */
export function getBulletinLabel(bulletin) {
  return bulletin.title || formatBulletinDate(bulletin);
}

/**
 * @param {Array<import('@/types/firestore').Bulletin & { id?: string }>} bulletins
 */
export function sortBulletinsDesc(bulletins) {
  return [...bulletins].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * @param {Array<import('@/types/firestore').Bulletin & { id?: string }>} bulletins
 * @returns {Record<string, Array<import('@/types/firestore').Bulletin & { id?: string }>>}
 */
export function groupBulletinsByYear(bulletins) {
  const sorted = sortBulletinsDesc(bulletins);
  /** @type {Record<string, typeof sorted>} */
  const groups = {};
  for (const bulletin of sorted) {
    const year = bulletin.date?.slice(0, 4) || "Unknown";
    if (!groups[year]) groups[year] = [];
    groups[year].push(bulletin);
  }
  return groups;
}

/** @param {string} date - ISO date YYYY-MM-DD */
export function getBulletinMonthKey(date) {
  if (!date) return null;
  return date.slice(0, 7);
}

/**
 * @param {Array<import('@/types/firestore').Bulletin & { id?: string }>} bulletins
 * @returns {Record<string, Record<string, Array<import('@/types/firestore').Bulletin & { id?: string }>>>}
 */
export function groupBulletinsByYearMonth(bulletins) {
  const sorted = sortBulletinsDesc(bulletins);
  /** @type {Record<string, Record<string, typeof sorted>>} */
  const groups = {};
  for (const bulletin of sorted) {
    const year = bulletin.date?.slice(0, 4) || "Unknown";
    const month = bulletin.date?.slice(5, 7) || "01";
    if (!groups[year]) groups[year] = {};
    if (!groups[year][month]) groups[year][month] = [];
    groups[year][month].push(bulletin);
  }
  return groups;
}

/** @param {string} year @param {string} month - MM */
export function formatBulletinMonthLabel(year, month) {
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long" });
}

/**
 * @param {Array<import('@/types/firestore').Bulletin & { id?: string }>} bulletins
 * @param {string} [date] - ISO date YYYY-MM-DD
 */
export function findBulletinByDate(bulletins, date) {
  if (!date) return sortBulletinsDesc(bulletins)[0] || null;
  return bulletins.find((b) => b.date === date) || null;
}

export const DEFAULT_PAGE_TYPE = "content";

/**
 * @param {object} [page]
 */
export function getPageType(page) {
  return page?.pageType || DEFAULT_PAGE_TYPE;
}
