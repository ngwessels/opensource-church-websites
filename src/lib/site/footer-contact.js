import { isSyncedQuickLinksColumn } from "../sitemap/tree.js";

export const CONTACT_COLUMN_TITLE = "Contact";

/** @typedef {{ street: string, cityLine: string, phone: string, email: string }} FooterContactFields */

export const EMPTY_CONTACT_FIELDS = {
  street: "",
  cityLine: "",
  phone: "",
  email: "",
};

/**
 * @param {string | null | undefined} html
 * @returns {FooterContactFields}
 */
export function parseContactHtml(html) {
  if (!html?.trim()) return { ...EMPTY_CONTACT_FIELDS };

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    street: lines[0] || "",
    cityLine: lines[1] || "",
    phone: lines[2] || "",
    email: lines[3] || "",
  };
}

/**
 * @param {Partial<FooterContactFields> | null | undefined} fields
 * @returns {string}
 */
export function buildContactHtml(fields) {
  const lines = [fields?.street, fields?.cityLine, fields?.phone, fields?.email]
    .map((line) => (line || "").trim())
    .filter(Boolean);

  if (!lines.length) return "";
  return `<p>${lines.join("<br/>")}</p>`;
}

/**
 * @param {{ title?: string, html?: string, source?: string } | null | undefined} column
 */
export function isContactColumn(column) {
  if (!column || isSyncedQuickLinksColumn(column)) return false;
  if ((column.title || "").trim().toLowerCase() === CONTACT_COLUMN_TITLE.toLowerCase()) {
    return true;
  }
  return column.html != null;
}

/**
 * @param {object[] | null | undefined} columns
 * @returns {number}
 */
export function findContactColumnIndex(columns) {
  if (!columns?.length) return -1;

  const byTitle = columns.findIndex(
    (col) =>
      !isSyncedQuickLinksColumn(col) &&
      (col.title || "").trim().toLowerCase() === CONTACT_COLUMN_TITLE.toLowerCase(),
  );
  if (byTitle >= 0) return byTitle;

  return columns.findIndex((col) => isContactColumn(col));
}

/**
 * @param {object[] | null | undefined} columns
 * @returns {FooterContactFields}
 */
export function parseContactFromColumns(columns) {
  const index = findContactColumnIndex(columns);
  if (index < 0) return { ...EMPTY_CONTACT_FIELDS };
  return parseContactHtml(columns[index]?.html);
}

/**
 * @param {object[] | null | undefined} columns
 * @param {string} html
 * @returns {object[]}
 */
export function upsertContactColumn(columns, html) {
  const next = [...(columns || [])];
  const index = findContactColumnIndex(next);

  if (index >= 0) {
    next[index] = { ...next[index], title: next[index].title || CONTACT_COLUMN_TITLE, html };
    return next;
  }

  return [{ title: CONTACT_COLUMN_TITLE, html }, ...next];
}
