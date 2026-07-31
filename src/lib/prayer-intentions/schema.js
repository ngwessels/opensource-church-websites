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
 * @property {string} description
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
  {
    id: "clergy",
    name: "Clergy",
    description:
      "Pastors and priests of the parish. Include intentions for the sick, dying, bereaved, sacramental needs, and general pastoral prayer.",
  },
  {
    id: "staff",
    name: "Staff",
    description:
      "Parish office and ministry staff. Include intentions related to parish life, administration support needs, and community concerns shared with staff prayer.",
  },
  {
    id: "ppc-council",
    name: "PPC Council",
    description:
      "Parish Pastoral Council. Include intentions about parish vision, leadership discernment, community wellbeing, and parish-wide concerns.",
  },
  {
    id: "altar-society",
    name: "Altar Society",
    description:
      "Altar Society members. Include intentions for liturgy, the altar, church care, and parishioners the society traditionally holds in prayer.",
  },
  {
    id: "womens-bible-study",
    name: "Women's Bible Study",
    description:
      "Women's Bible Study group. Include intentions relevant to women, families, spiritual growth, and concerns this group typically prays for together.",
  },
  {
    id: "men-of-conviction",
    name: "Men of Conviction",
    description:
      "Men's faith group. Include intentions relevant to men, fathers, husbands, spiritual leadership, and concerns this group typically prays for together.",
  },
  {
    id: "youth-group",
    name: "Youth Group",
    description:
      "Parish youth and young adults. Include intentions for young people, students, confirmation candidates, and youth/family concerns appropriate for youth prayer.",
  },
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
  const id = typeof g.id === "string" && g.id.trim() ? g.id.trim() : generateId();
  const defaultMatch = DEFAULT_PRAYER_GROUPS.find((d) => d.id === id);
  return {
    id,
    name: asString(g.name, defaultMatch?.name || "Prayer Group").trim() || "Prayer Group",
    description: asString(g.description, defaultMatch?.description || "").trim(),
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
          description: g.description,
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
  if (!email) {
    errors.email = "Email is required.";
  } else if (!email.includes("@")) {
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
 * @param {string[]} [allowedGroupIds]
 * @returns {{
 *   isPrayerIntention: boolean,
 *   isSpam: boolean,
 *   hasNegativeImpact: boolean,
 *   reason: string,
 *   groupIds: string[],
 * }}
 */
export function parseModerationResponse(raw, allowedGroupIds = []) {
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
        groupIds: [],
      };
    }
  }

  const d = data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {};
  const allowed = new Set(allowedGroupIds);
  const rawGroupIds = Array.isArray(d.groupIds) ? d.groupIds : [];
  const groupIds = rawGroupIds
    .filter((id) => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id && (allowed.size === 0 || allowed.has(id)));

  return {
    isPrayerIntention: d.isPrayerIntention === true,
    isSpam: d.isSpam === true,
    hasNegativeImpact: d.hasNegativeImpact === true,
    reason: asString(d.reason, "No reason provided.").trim() || "No reason provided.",
    groupIds,
  };
}

/**
 * If AI approved but picked no groups, fall back to all known groups.
 * @param {string[]} groupIds
 * @param {string[]} allGroupIds
 * @param {'approved' | 'rejected'} status
 */
export function resolveAssignedGroupIds(groupIds, allGroupIds, status) {
  if (status !== "approved") return [];
  if (groupIds.length > 0) return groupIds;
  return allGroupIds;
}
