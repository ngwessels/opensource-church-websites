import { getPageType } from "../bulletins/schema.js";
import { getDonationConfig } from "../donations/schema.js";

/**
 * @param {FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot} docSnap
 */
export function buildDonationPageSummary(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    slug: data?.slug ?? "",
    title: data?.title ?? "",
    donationConfig: getDonationConfig(data),
    updatedAt: data?.updatedAt ?? null,
  };
}

/** @param {object | undefined | null} pageData */
export function isDonationPageData(pageData) {
  return getPageType(pageData) === "donation";
}
