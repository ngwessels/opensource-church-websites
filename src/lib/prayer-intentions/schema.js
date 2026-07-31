import { generateId } from "../sitemap/tree.js";

/**
 * @typedef {object} PrayerIntentionsModuleConfig
 * @property {string} moduleInstanceId
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} submitLabel
 * @property {string} successMessage Fixed public thank-you; never indicates approval.
 * @property {string[]} notificationEmails
 * @property {string} honeypotFieldName
 */

/**
 * @typedef {'approved' | 'rejected'} PrayerIntentionStatus
 */

/**
 * @typedef {object} PrayerIntentionModeration
 * @property {string} model
 * @property {string} moderatedAt
 * @property {boolean} isPrayerIntention
 * @property {boolean} isSpam
 * @property {boolean} hasNegativeImpact
 * @property {string} reason
 * @property {string} [error]
 */

/**
 * @typedef {object} PrayerGroup
 * @property {string} id
 * @property {string} name
 * @property {string[]} emails
 */

/**
 * @typedef {object} PrayerIntentionsSettings
 * @property {PrayerGroup[]} groups
 * @property {number} digestDayOfWeek
 * @property {number} digestHour
 * @property {string | null} lastDigestAt
 */

export const DEFAULT_PRAYER_INTENTION_DESCRIPTION =
  "It is a privilege to pray with you. Share your joys, sorrows, worries, and thanksgiving. Your intention will be prayed for by our clergy and parish ministries.";

/** Always shown after submit — must not reveal moderation outcome. */
export const DEFAULT_SUCCESS_MESSAGE = "Thank you.";

export const DEFAULT_PRAYER_GROUPS = [
  { id: "clergy", name: "Clergy" },
  { id: "staff", name: "Staff" },
  { id: "ppc-council", name: "PPC Council" },
  { id: "altar-society", name: "Altar Society" },
  { id: "womens-bible-study", name: "Women's Bible Study" },
  { id: "men-of-conviction", name: "Men of Conviction" },
  { id: "youth-group", name: "Youth Group" },
];

/** @param {unknown} value */
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

/** @param {unknown} value */
function parseEmails(value) {
  if (Array.isArray(value)) {
    return value
      .filter((e) => typeof e === "string")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
  }
  return [];
}

/**
 * @param {unknown} raw
 * @returns {PrayerIntentionsModuleConfig}
 */
export function normalizePrayerIntentionsConfig(raw) {
  const c = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const honeypot =
    typeof c.honeypotFieldName === "string" && c.honeypotFieldName.trim()
      ? c.honeypotFieldName.trim()
      : `_hp_${Math.random().toString(36).slice(2, 10)}`;

  return {
    moduleInstanceId:
      typeof c.moduleInstanceId === "string" && c.moduleInstanceId.trim()
        ? c.moduleInstanceId.trim()
        : generateId(),
    title: asString(c.title, "Prayer Intentions").trim() || "Prayer Intentions",
    description: asString(c.description, DEFAULT_PRAYER_INTENTION_DESCRIPTION),
    submitLabel: asString(c.submitLabel, "Submit intention").trim() || "Submit intention",
    // Never customize: a specific message would tip off submitters about filtering.
    successMessage: DEFAULT_SUCCESS_MESSAGE,
    notificationEmails: parseEmails(c.notificationEmails),
    honeypotFieldName: honeypot,
  };
}

/**
 * @param {unknown} raw
 * @returns {PrayerGroup}
 */
export function normalizePrayerGroup(raw) {
  const g = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    id: typeof g.id === "string" && g.id.trim() ? g.id.trim() : generateId(),
    name: asString(g.name, "Prayer Group").trim() || "Prayer Group",
    emails: parseEmails(g.emails),
  };
}

/**
 * @param {unknown} raw
 * @returns {PrayerIntentionsSettings}
 */
export function normalizePrayerIntentionsSettings(raw) {
  const c = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const groupsRaw = Array.isArray(c.groups) ? c.groups : null;
  const groups =
    groupsRaw && groupsRaw.length > 0
      ? groupsRaw.map(normalizePrayerGroup)
      : DEFAULT_PRAYER_GROUPS.map((g) => ({
          id: g.id,
          name: g.name,
          emails: [],
        }));

  const digestDayOfWeek =
    typeof c.digestDayOfWeek === "number" && c.digestDayOfWeek >= 0 && c.digestDayOfWeek <= 6
      ? Math.floor(c.digestDayOfWeek)
      : 1;
  const digestHour =
    typeof c.digestHour === "number" && c.digestHour >= 0 && c.digestHour <= 23
      ? Math.floor(c.digestHour)
      : 8;

  return {
    groups,
    digestDayOfWeek,
    digestHour,
    lastDigestAt: typeof c.lastDigestAt === "string" ? c.lastDigestAt : null,
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, values: { name: string, email: string, phone: string, intention: string } } | { ok: false, errors: Record<string, string> }}
 */
export function validatePrayerIntentionSubmission(body) {
  const b = body && typeof body === "object" ? /** @type {Record<string, unknown>} */ (body) : {};
  /** @type {Record<string, string>} */
  const errors = {};

  const name = asString(b.name).trim();
  const email = asString(b.email).trim();
  const phone = asString(b.phone).trim();
  const intention = asString(b.intention).trim();

  if (!name) errors.name = "Name is required.";
  if (!intention) errors.intention = "Prayer intention is required.";
  if (intention.length > 4000) errors.intention = "Prayer intention is too long.";
  if (!email && !phone) {
    errors.contact = "Please provide an email or phone number.";
  }
  if (email && !email.includes("@")) {
    errors.email = "Enter a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      name,
      email,
      phone,
      intention,
    },
  };
}

/**
 * @param {{ isPrayerIntention: boolean, isSpam: boolean, hasNegativeImpact: boolean }} decision
 * @returns {PrayerIntentionStatus}
 */
export function statusFromModerationDecision(decision) {
  if (!decision.isPrayerIntention || decision.isSpam || decision.hasNegativeImpact) {
    return "rejected";
  }
  return "approved";
}

/**
 * @param {unknown} raw
 * @returns {{ isPrayerIntention: boolean, isSpam: boolean, hasNegativeImpact: boolean, reason: string }}
 */
export function parseModerationResponse(raw) {
  let data = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = fenced ? fenced[1].trim() : trimmed;
    try {
      data = JSON.parse(jsonText);
    } catch {
      return {
        isPrayerIntention: false,
        isSpam: true,
        hasNegativeImpact: false,
        reason: "Could not parse moderation response.",
      };
    }
  }

  const d = data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {};
  return {
    isPrayerIntention: d.isPrayerIntention === true,
    isSpam: d.isSpam === true,
    hasNegativeImpact: d.hasNegativeImpact === true,
    reason: asString(d.reason, "No reason provided.").trim() || "No reason provided.",
  };
}
