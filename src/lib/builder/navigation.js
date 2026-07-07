import { isExternalHref } from "@/lib/sitemap/tree";

/** Slug segment from `/builder/edit` or `/builder/edit/foo/bar` (empty string for home). */
export function slugFromBuilderEditPath(pathname) {
  if (!pathname?.startsWith("/builder/edit")) return "";
  const rest = pathname.slice("/builder/edit".length);
  return rest.replace(/^\/+/, "");
}

/** Rewrite internal site paths to stay in the builder when editing. */
export function toBuilderHref(href, editing = false) {
  if (!editing || !href || href === "#" || isExternalHref(href)) {
    return href;
  }
  if (href.startsWith("/builder/")) {
    return href;
  }
  if (href === "/") {
    return "/builder/edit";
  }
  return `/builder/edit${href.startsWith("/") ? href : `/${href}`}`;
}
