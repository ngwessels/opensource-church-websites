import { getPublishedPagesServer } from "@/lib/firestore/server";
import { getAppUrl } from "@/lib/stripe/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export default async function sitemap() {
  const baseUrl = getAppUrl();

  if (!isFirebaseAdminConfigured()) {
    return [{ url: baseUrl, lastModified: new Date() }];
  }

  const pages = await getPublishedPagesServer();

  return pages.map((page) => ({
    url: page.slug ? `${baseUrl}/${page.slug}` : baseUrl,
    lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
    changeFrequency: "weekly",
    priority: page.slug === "" ? 1 : 0.8,
  }));
}
