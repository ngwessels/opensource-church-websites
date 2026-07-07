import { formatDonorAddress } from "./schema.js";

/** @typedef {import('@/types/firestore').DonationRecord} DonationRecord */

/**
 * @typedef {object} DonationFilters
 * @property {string} personQuery
 * @property {string} dateFrom
 * @property {string} dateTo
 * @property {string} amountMin
 * @property {string} amountMax
 * @property {"all" | "one-time" | "recurring"} giftType
 * @property {"all" | "once" | "weekly" | "monthly"} frequency
 * @property {string} fund
 * @property {"all" | "has" | "none" | "contains"} commentFilter
 * @property {string} commentQuery
 */

/** @typedef {DonationRecord & { id: string }} DonationRow */

/**
 * @param {DonationRow} donation
 */
export function getDonorName(donation) {
  return donation.donor?.name || "—";
}

/**
 * @param {DonationRow} donation
 */
export function getDonorEmail(donation) {
  return donation.donor?.email || donation.donorEmail || "—";
}

/**
 * @param {DonationRow} donation
 */
export function getDonorPhone(donation) {
  return donation.donor?.phone || "—";
}

/** @returns {DonationFilters} */
export function emptyDonationFilters() {
  return {
    personQuery: "",
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    giftType: "all",
    frequency: "all",
    fund: "all",
    commentFilter: "all",
    commentQuery: "",
  };
}

/**
 * @param {DonationFilters} filters
 */
export function hasActiveDonationFilters(filters) {
  return (
    filters.personQuery.trim() !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.amountMin.trim() !== "" ||
    filters.amountMax.trim() !== "" ||
    filters.giftType !== "all" ||
    filters.frequency !== "all" ||
    filters.fund !== "all" ||
    filters.commentFilter !== "all" ||
    (filters.commentFilter === "contains" && filters.commentQuery.trim() !== "")
  );
}

/**
 * @param {string} dollarInput
 * @returns {number | undefined}
 */
export function parseDollarInputToCents(dollarInput) {
  if (typeof dollarInput !== "string" || !dollarInput.trim()) return undefined;
  const parsed = Math.round(parseFloat(dollarInput.trim()) * 100);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * @param {string} dateInput YYYY-MM-DD
 * @param {"start" | "end"} bound
 */
function dateInputToTimestamp(dateInput, bound) {
  if (!dateInput) return undefined;
  const parts = dateInput.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [year, month, day] = parts;
  const date =
    bound === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  const time = date.getTime();
  return Number.isNaN(time) ? undefined : time;
}

/**
 * @param {DonationRow} donation
 */
function getDonorSearchText(donation) {
  return [
    getDonorName(donation),
    getDonorEmail(donation),
    getDonorPhone(donation),
    formatDonorAddress(donation.donor),
  ]
    .filter((part) => part && part !== "—")
    .join(" ")
    .toLowerCase();
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesPersonQuery(donation, filters) {
  const query = filters.personQuery.trim().toLowerCase();
  if (!query) return true;
  return getDonorSearchText(donation).includes(query);
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesDateRange(donation, filters) {
  const fromTs = dateInputToTimestamp(filters.dateFrom, "start");
  const toTs = dateInputToTimestamp(filters.dateTo, "end");
  if (fromTs === undefined && toTs === undefined) return true;

  const createdTs = new Date(donation.createdAt || "").getTime();
  if (Number.isNaN(createdTs)) return false;
  if (fromTs !== undefined && createdTs < fromTs) return false;
  if (toTs !== undefined && createdTs > toTs) return false;
  return true;
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesAmountRange(donation, filters) {
  const minCents = parseDollarInputToCents(filters.amountMin);
  const maxCents = parseDollarInputToCents(filters.amountMax);
  if (minCents === undefined && maxCents === undefined) return true;

  const amount = donation.amountCents ?? 0;
  if (minCents !== undefined && amount < minCents) return false;
  if (maxCents !== undefined && amount > maxCents) return false;
  return true;
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesGiftType(donation, filters) {
  if (filters.giftType === "all") return true;
  const frequency = donation.frequency || "once";
  if (filters.giftType === "one-time") return frequency === "once";
  return frequency === "weekly" || frequency === "monthly";
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesFrequency(donation, filters) {
  if (filters.frequency === "all") return true;
  return (donation.frequency || "once") === filters.frequency;
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesFund(donation, filters) {
  if (filters.fund === "all") return true;
  return (donation.fundLabel || "") === filters.fund;
}

/**
 * @param {DonationRow} donation
 * @param {DonationFilters} filters
 */
function matchesComment(donation, filters) {
  const comment = donation.donorComment?.trim() || "";

  if (filters.commentFilter === "all") return true;
  if (filters.commentFilter === "has") return comment.length > 0;
  if (filters.commentFilter === "none") return comment.length === 0;
  if (filters.commentFilter === "contains") {
    const query = filters.commentQuery.trim().toLowerCase();
    if (!query) return true;
    return comment.toLowerCase().includes(query);
  }

  return true;
}

/**
 * @param {DonationRow[]} donations
 * @param {DonationFilters} filters
 */
export function filterDonations(donations, filters) {
  return donations.filter(
    (donation) =>
      matchesPersonQuery(donation, filters) &&
      matchesDateRange(donation, filters) &&
      matchesAmountRange(donation, filters) &&
      matchesGiftType(donation, filters) &&
      matchesFrequency(donation, filters) &&
      matchesFund(donation, filters) &&
      matchesComment(donation, filters),
  );
}

/**
 * @param {DonationRow[]} donations
 */
export function sumDonationAmountCents(donations) {
  return donations.reduce((sum, donation) => sum + (donation.amountCents || 0), 0);
}

/**
 * @param {DonationRow[]} donations
 * @returns {string[]}
 */
export function getUniqueFundLabels(donations) {
  const labels = new Set();
  for (const donation of donations) {
    const label = donation.fundLabel?.trim();
    if (label) labels.add(label);
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {DonationFilters} filters
 */
export function describeDonationFilters(filters) {
  const parts = [];

  if (filters.personQuery.trim()) {
    parts.push(`Person: "${filters.personQuery.trim()}"`);
  }
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom && filters.dateTo) {
      parts.push(`Date: ${filters.dateFrom} to ${filters.dateTo}`);
    } else if (filters.dateFrom) {
      parts.push(`Date: from ${filters.dateFrom}`);
    } else {
      parts.push(`Date: through ${filters.dateTo}`);
    }
  }
  if (filters.amountMin.trim() || filters.amountMax.trim()) {
    if (filters.amountMin.trim() && filters.amountMax.trim()) {
      parts.push(`Amount: $${filters.amountMin.trim()} to $${filters.amountMax.trim()}`);
    } else if (filters.amountMin.trim()) {
      parts.push(`Amount: from $${filters.amountMin.trim()}`);
    } else {
      parts.push(`Amount: up to $${filters.amountMax.trim()}`);
    }
  }
  if (filters.giftType === "one-time") parts.push("Gift type: One-time");
  if (filters.giftType === "recurring") parts.push("Gift type: Recurring");
  if (filters.frequency !== "all") {
    const labels = { once: "One-time", weekly: "Weekly", monthly: "Monthly" };
    parts.push(`Frequency: ${labels[filters.frequency] || filters.frequency}`);
  }
  if (filters.fund !== "all") parts.push(`Fund: ${filters.fund}`);
  if (filters.commentFilter === "has") parts.push("Comments: Has comment");
  if (filters.commentFilter === "none") parts.push("Comments: No comment");
  if (filters.commentFilter === "contains" && filters.commentQuery.trim()) {
    parts.push(`Comments contain: "${filters.commentQuery.trim()}"`);
  }

  return parts.length > 0 ? parts.join("; ") : "All donations";
}
