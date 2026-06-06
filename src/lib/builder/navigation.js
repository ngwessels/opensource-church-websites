import { isExternalHref } from "@/lib/sitemap/tree";

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
