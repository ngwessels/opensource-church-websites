import "server-only";

import { getBulletinLabel } from "@/lib/bulletins/schema";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { getSiteBaseUrl } from "@/lib/seo/site-url";

import { buildBulletinBodyHtml } from "./html.js";

/**
 * @typedef {import('./schema.js').EmailCampaignAttachment} EmailCampaignAttachment
 */

/**
 * Compose the bulletin email: the admin's optional note, a link that opens the
 * bulletin on the parish site when there is a bulletins page (the PDF itself
 * otherwise), and the PDF as an attachment when the admin asked for it.
 *
 * @param {{ bulletinId: string, introHtml?: string, attachPdf?: boolean }} input
 * @returns {Promise<{
 *   subject: string,
 *   bodyHtml: string,
 *   bulletinUrl: string,
 *   attachments: EmailCampaignAttachment[],
 * }>}
 */
export async function buildBulletinCampaign({ bulletinId, introHtml = "", attachPdf = true }) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const id = String(bulletinId || "").trim();
  if (!id) throw new Error("bulletinId is required.");

  const snap = await db.collection(COLLECTIONS.bulletins).doc(id).get();
  if (!snap.exists) throw new Error("Bulletin not found.");

  const bulletin = { id: snap.id, ...snap.data() };
  const label = getBulletinLabel(bulletin);
  const bulletinUrl = await resolveBulletinUrl(bulletin);

  /** @type {EmailCampaignAttachment[]} */
  const attachments = [];
  if (attachPdf && bulletin.downloadUrl) {
    attachments.push({
      name: `${label.replace(/[^\w .-]+/g, " ").trim() || "Bulletin"}.pdf`,
      url: bulletin.downloadUrl,
      mimeType: "application/pdf",
      sizeBytes: await bulletinPdfSize(bulletin.mediaId),
    });
  }

  return {
    subject: `Bulletin — ${label}`,
    bodyHtml: buildBulletinBodyHtml({
      introHtml,
      bulletinLabel: label,
      bulletinUrl,
      attached: attachments.length > 0,
    }),
    bulletinUrl,
    attachments,
  };
}

/**
 * @param {{ date?: string, downloadUrl?: string }} bulletin
 * @returns {Promise<string>}
 */
async function resolveBulletinUrl(bulletin) {
  const db = getFirebaseAdminFirestore();
  if (!db) return bulletin.downloadUrl || "";

  const siteSnap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  const baseUrl = getSiteBaseUrl(siteSnap.exists ? siteSnap.data() : null);

  const pagesSnap = await db
    .collection(COLLECTIONS.pages)
    .where("pageType", "==", "bulletins")
    .limit(1)
    .get();

  if (pagesSnap.empty) return bulletin.downloadUrl || "";

  const page = pagesSnap.docs[0].data();
  if (page.status !== "published" || page.hidden === true || page.passwordProtected === true) {
    return bulletin.downloadUrl || "";
  }

  const slug = typeof page.slug === "string" ? page.slug.replace(/^\/+/, "") : "";
  const path = slug ? `${baseUrl}/${slug}` : baseUrl;
  return bulletin.date ? `${path}?date=${encodeURIComponent(bulletin.date)}` : path;
}

/**
 * @param {string} [mediaId]
 * @returns {Promise<number>}
 */
async function bulletinPdfSize(mediaId) {
  const db = getFirebaseAdminFirestore();
  if (!db || !mediaId) return 0;

  const snap = await db.collection(COLLECTIONS.media).doc(mediaId).get();
  const size = snap.exists ? Number(snap.data()?.sizeBytes) : 0;
  return Number.isFinite(size) && size > 0 ? size : 0;
}
