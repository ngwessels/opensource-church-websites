import "server-only";

import { parseModerationResponse, statusFromModerationDecision } from "./schema.js";

const DEFAULT_MODEL = "gemini-flash-lite-latest";

const SYSTEM_INSTRUCTION = `You moderate prayer intention submissions for a Catholic parish website.

Decide three things about the submitter's prayer intention text:
1. isPrayerIntention — true if it is a genuine prayer, thanksgiving, concern, joy, sorrow, or request for prayer (even brief or informal).
2. isSpam — true if it is advertising, business promotion, gibberish, unrelated to prayer, or clearly not a prayer intention.
3. hasNegativeImpact — true if the intention would cause harm or negative impact on another person. This includes malice, wishing harm, targeting someone for harm, or petitions that ask for a pastor/priest/staff member to be removed, reassigned, punished, or criticized as the substance of the "prayer". Ordinary prayers for healing of a named person, conversion, reconciliation, or difficult situations are NOT negative impact.

Respond with JSON only matching the schema. Keep reason to one short sentence.`;

/**
 * @param {{ name: string, email: string, phone: string, intention: string }} submission
 * @returns {Promise<{
 *   status: 'approved' | 'rejected',
 *   moderation: import('./schema.js').PrayerIntentionModeration
 * }>}
 */
export async function moderatePrayerIntention(submission) {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  const moderatedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      status: "rejected",
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
      `Name: ${submission.name}`,
      submission.email ? `Email: ${submission.email}` : null,
      submission.phone ? `Phone: ${submission.phone}` : null,
      "",
      "Prayer intention:",
      submission.intention,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
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
            },
            required: ["isPrayerIntention", "isSpam", "hasNegativeImpact", "reason"],
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[prayer-intentions] Gemini error:", res.status, errText);
      return {
        status: "rejected",
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

    const decision = parseModerationResponse(text);
    return {
      status: statusFromModerationDecision(decision),
      moderation: {
        model,
        moderatedAt,
        ...decision,
      },
    };
  } catch (err) {
    console.error("[prayer-intentions] moderation failed:", err);
    return {
      status: "rejected",
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
