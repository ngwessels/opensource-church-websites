import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizePageRegions } from "@/lib/pages/regions";

import { normalizePrayerIntentionsConfig } from "./schema.js";

/**
 * Find a published prayer_intentions module by moduleInstanceId across published pages.
 * @param {string} moduleInstanceId
 * @returns {Promise<{ pageId: string, pageTitle: string, moduleId: string, config: import('./schema.js').PrayerIntentionsModuleConfig } | null>}
 */
export async function findPublishedPrayerIntentionsByInstanceId(moduleInstanceId) {
  const db = getFirebaseAdminFirestore();
  if (!db || !moduleInstanceId) return null;

  const snap = await db.collection(COLLECTIONS.pages).get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.hidden) continue;

    const snapshot = data.status === "published" ? data.publishedSnapshot : null;
    if (!snapshot?.regions) continue;

    const page = normalizePageRegions({ ...data, regions: snapshot.regions });
    for (const region of page.regions || []) {
      for (const mod of region.modules || []) {
        if (mod.type !== "prayer_intentions") continue;
        const config = normalizePrayerIntentionsConfig(mod.config);
        if (config.moduleInstanceId === moduleInstanceId) {
          return {
            pageId: doc.id,
            pageTitle: snapshot.title || data.title || "",
            moduleId: mod.id,
            config,
          };
        }
      }
    }
  }

  return null;
}
