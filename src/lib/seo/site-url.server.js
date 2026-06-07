import "server-only";

import { getSiteConfigServer } from "@/lib/firestore/server";
import { getSiteBaseUrl } from "@/lib/seo/site-url";

/** @returns {Promise<string>} */
export async function getSiteBaseUrlServer() {
  const siteConfig = await getSiteConfigServer();
  return getSiteBaseUrl(siteConfig);
}
