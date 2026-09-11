import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { PUBLIC_CACHE_EXPIRE_NOW, PUBLIC_CACHE_TAGS } from "./tags";

/** Optional catch-all that renders every public URL. */
const PUBLIC_PAGE_ROUTE = "/(public)/[[...slug]]";

function publicPathForSlug(slug) {
  const normalized = (slug || "").replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

function expireTag(tag) {
  revalidateTag(tag, PUBLIC_CACHE_EXPIRE_NOW);
}

function revalidatePublicHtml(slug) {
  revalidatePath(publicPathForSlug(slug));
  revalidatePath(PUBLIC_PAGE_ROUTE, "page");
  revalidatePath("/", "layout");
}

/** Invalidate one public page and its cached Firestore payload. */
export function revalidatePublicPage(slug) {
  const normalized = slug ?? "";
  expireTag(PUBLIC_CACHE_TAGS.page(normalized));
  revalidatePublicHtml(normalized);
}

/** Invalidate cached bulletin list and all public pages that render it. */
export function revalidatePublicBulletins() {
  expireTag(PUBLIC_CACHE_TAGS.bulletins);
  revalidatePath(PUBLIC_PAGE_ROUTE, "page");
  revalidatePath("/", "layout");
}

/** Invalidate shared site data (nav, design, header/footer) on every public page. */
export function revalidatePublicSite() {
  expireTag(PUBLIC_CACHE_TAGS.siteConfig);
  expireTag(PUBLIC_CACHE_TAGS.nav);
  expireTag(PUBLIC_CACHE_TAGS.hiddenPages);
  expireTag(PUBLIC_CACHE_TAGS.bulletins);
  revalidatePath(PUBLIC_PAGE_ROUTE, "page");
  revalidatePath("/", "layout");
}

/** Page publish: refresh the page plus shared chrome that may reference it. */
export function revalidateAfterPagePublish(slug) {
  revalidatePublicPage(slug);
  expireTag(PUBLIC_CACHE_TAGS.nav);
  expireTag(PUBLIC_CACHE_TAGS.hiddenPages);
}
