import "server-only";

import {
  parseModerationResponse,
  resolveAssignedGroupIds,
  statusFromModerationDecision,
} from "./schema.js";

const DEFAULT_MODEL = "gemini-flash-lite-latest";

/**
 * @param {import('./schema.js').PrayerGroup[]} groups
 */
function buildSystemInstruction(groups) {
  const groupLines =
    groups.length > 0
      ? groups
          .map(
            (g) =>
              `- id: "${g.id}" | name: ${g.name} | description: ${g.description || "(no description)"}`,
          )
          .join("\n")
      : "- (no groups configured)";

  return `You moderate prayer intention submissions for a Catholic parish website.

Contact fields (name, email, phone) are OPTIONAL. Anonymous submissions with only a prayer intention are normal and allowed. Never reject, mark as spam, or treat as incomplete solely because name/email/phone are missing or blank.

Decide these things about the submitter's prayer intention text:
1. isPrayerIntention — true if it is a genuine prayer, thanksgiving, concern, joy, sorrow, or request for prayer (even brief or informal).
2. isSpam — true if it is advertising, business promotion, gibberish, unrelated to prayer, or clearly not a prayer intention. Missing contact info is NOT spam.
3. hasNegativeImpact — true if the intention would cause harm or negative impact on another person. This includes malice, wishing harm, targeting someone for harm, or petitions that ask for a pastor/priest/staff member to be removed, reassigned, punished, or criticized as the substance of the "prayer". Ordinary prayers for healing of a named person, conversion, reconciliation, or difficult situations are NOT negative impact.
4. groupIds — if the intention should be approved (isPrayerIntention true, isSpam false, hasNegativeImpact false), choose one or more parish prayer group ids that should receive this intention, based on each group's description. Prefer relevant groups; include "clergy" for general pastoral intentions when appropriate. If rejecting, return an empty groupIds array. Only use ids from the list below.

Available prayer groups:
${groupLines}

Respond with JSON only matching the schema. Keep reason to one short sentence.`;
}

/**
 * @param {{ name: string, email: string, phone: string, intention: string }} submission
 * @param {import('./schema.js').PrayerGroup[]} [groups]
 * @returns {Promise<{
 *   status: 'approved' | 'rejected',
 *   groupIds: string[],
 *   moderation: import('./schema.js').PrayerIntentionModeration
 * }>}
 */
export async function moderatePrayerIntention(submission, groups = []) {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  const moderatedAt = new Date().toISOString();
  const allGroupIds = groups.map((g) => g.id);

  if (!apiKey) {
    return {
      status: "rejected",
      groupIds: [],
      moderation: {
        model,
        moderatedAt,
        isPrayerIntention: false,
        isSpam: false,
        hasNegativeImpact: false,
        reason: "Moderation unavailable; held for review.",
        error: "moderation_unavailable",
      },
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const userPrompt = [
      "Contact fields are optional. Blank contact means an anonymous submission.",
      `Name: ${submission.name.trim() || "(not provided — anonymous)"}`,
      `Email: ${submission.email.trim() || "(not provided)"}`,
      `Phone: ${submission.phone.trim() || "(not provided)"}`,
      "",
      "Prayer intention:",
      submission.intention,
    ].join("\n");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemInstruction(groups) }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              isPrayerIntention: { type: "BOOLEAN" },
              isSpam: { type: "BOOLEAN" },
              hasNegativeImpact: { type: "BOOLEAN" },
              reason: { type: "STRING" },
              groupIds: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["isPrayerIntention", "isSpam", "hasNegativeImpact", "reason", "groupIds"],
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[prayer-intentions] Gemini error:", res.status, errText);
      return {
        status: "rejected",
        groupIds: [],
        moderation: {
          model,
          moderatedAt,
          isPrayerIntention: false,
          isSpam: false,
          hasNegativeImpact: false,
          reason: "Moderation unavailable; held for review.",
          error: "moderation_unavailable",
        },
      };
    }

    const payload = await res.json();
    const text =
      payload?.candidates?.[0]?.content?.parts?.map((/** @type {{ text?: string }} */ p) => p.text || "").join("") ||
      "";

    const decision = parseModerationResponse(text, allGroupIds);
    const status = statusFromModerationDecision(decision);
    const groupIds = resolveAssignedGroupIds(decision.groupIds, allGroupIds, status);

    return {
      status,
      groupIds,
      moderation: {
        model,
        moderatedAt,
        isPrayerIntention: decision.isPrayerIntention,
        isSpam: decision.isSpam,
        hasNegativeImpact: decision.hasNegativeImpact,
        reason: decision.reason,
      },
    };
  } catch (err) {
    console.error("[prayer-intentions] moderation failed:", err);
    return {
      status: "rejected",
      groupIds: [],
      moderation: {
        model,
        moderatedAt,
        isPrayerIntention: false,
        isSpam: false,
        hasNegativeImpact: false,
        reason: "Moderation unavailable; held for review.",
        error: "moderation_unavailable",
      },
    };
  }
}
