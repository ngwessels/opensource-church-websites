import "server-only";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getSiteConfigServer } from "@/lib/firestore/server";

import { buildSiteIconsMetadata } from "./site-icons";

/** Site-wide favicon metadata for Next.js layouts/pages. */
export async function getSiteIconsMetadata() {
  if (!isFirebaseAdminConfigured()) return {};

  const site = await getSiteConfigServer();
  const icons = buildSiteIconsMetadata(site?.seo);
  return icons ? { icons } : {};
}
