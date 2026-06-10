import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { PUBLIC_CACHE_TAGS } from "./tags";

function publicPathForSlug(slug) {
  const normalized = (slug || "").replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

/** Invalidate one public page and its cached Firestore payload. */
export function revalidatePublicPage(slug) {
  const normalized = slug ?? "";
  revalidateTag(PUBLIC_CACHE_TAGS.page(normalized), "max");
  revalidatePath(publicPathForSlug(normalized));
}

/** Invalidate shared site data (nav, design, header/footer) on every public page. */
export function revalidatePublicSite() {
  revalidateTag(PUBLIC_CACHE_TAGS.siteConfig, "max");
  revalidateTag(PUBLIC_CACHE_TAGS.nav, "max");
  revalidateTag(PUBLIC_CACHE_TAGS.hiddenPages, "max");
  revalidateTag(PUBLIC_CACHE_TAGS.bulletins, "max");
  revalidatePath("/", "layout");
}

/** Page publish: refresh the page plus shared chrome that may reference it. */
export function revalidateAfterPagePublish(slug) {
  revalidatePublicPage(slug);
  revalidateTag(PUBLIC_CACHE_TAGS.nav, "max");
  revalidateTag(PUBLIC_CACHE_TAGS.hiddenPages, "max");
}
