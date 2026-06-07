import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizePageRegions } from "@/lib/pages/regions";

import { normalizeFormConfig } from "./schema.js";

/**
 * Find a published form module by formId across all published pages.
 * @param {string} formId
 * @returns {Promise<{ pageId: string, pageTitle: string, moduleId: string, config: import('./schema.js').FormModuleConfig } | null>}
 */
export async function findPublishedFormByFormId(formId) {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;

  const snap = await db.collection(COLLECTIONS.pages).get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.hidden) continue;

    const snapshot = data.status === "published" ? data.publishedSnapshot : null;
    if (!snapshot?.regions) continue;

    const page = normalizePageRegions({ ...data, regions: snapshot.regions });
    for (const region of page.regions || []) {
      for (const mod of region.modules || []) {
        if (mod.type !== "form") continue;
        const config = normalizeFormConfig(mod.config);
        if (config.formId === formId) {
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
