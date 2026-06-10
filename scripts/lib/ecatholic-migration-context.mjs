import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function normalizeDomain(input) {
  if (!input?.trim()) throw new Error("Domain is required (e.g. --domain www.yourparish.org)");
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  return parsed.origin;
}

export function hostnameFromBase(base) {
  return new URL(base).hostname;
}

export function domainFileSlug(base) {
  return hostnameFromBase(base).replace(/^www\./, "").replace(/\./g, "-");
}

export function manifestPathForDomain(scriptsDir, base) {
  return join(scriptsDir, `.ecatholic-migration-${domainFileSlug(base)}.json`);
}

export function pathToSlug(path) {
  if (!path || path === "/") return "";
  return path.replace(/^\//, "").replace(/\/$/, "");
}

export function slugToPath(slug) {
  return slug === "" ? "/" : `/${slug}`;
}

export function detectParishIdFromHtml(html) {
  const match = html.match(/files\.ecatholic\.com\/(\d+)\//i);
  return match?.[1] || null;
}

export function detectParishIdFromUrl(url) {
  const match = url.match(/files\.ecatholic\.com\/(\d+)\//i);
  return match?.[1] || null;
}

export function ecatholicCdnUrl(parishId) {
  return parishId ? `https://files.ecatholic.com/${parishId}` : null;
}

export function loadPageMapFile(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const paths = raw.paths && typeof raw.paths === "object" ? raw.paths : raw;
  if (Array.isArray(paths)) {
    throw new Error("Page map must be an object mapping paths to page IDs");
  }
  return {
    paths,
    parishId: raw.parishId || null,
    skipPageIds: new Set(raw.skipPageIds || []),
    sidebarLeftPageIds: new Set(raw.sidebarLeftPageIds || []),
    defaultLayoutPageIds: new Set(raw.defaultLayoutPageIds || []),
    homePageId: raw.homePageId || paths["/"] || paths[""] || null,
  };
}

export function defaultPageMapPath(scriptsDir, base) {
  const hostname = hostnameFromBase(base);
  const candidates = [
    join(scriptsDir, "ecatholic-migration", `${hostname}.json`),
    join(scriptsDir, "ecatholic-migration", `${hostname.replace(/^www\./, "")}.json`),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

export function readManifestFile(manifestPath) {
  if (!existsSync(manifestPath)) return { meta: {}, entries: [] };
  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (Array.isArray(raw)) return { meta: {}, entries: raw };
  return {
    meta: raw.meta || {},
    entries: raw.pages || raw.entries || [],
  };
}

export function writeManifestFile({ meta, entries }) {
  const payload =
    meta && Object.keys(meta).length
      ? { meta, pages: entries }
      : entries;
  return JSON.stringify(payload, null, 2);
}

export function normalizeScrapedSeo({ seo, title } = {}) {
  const metaTitle = seo?.title?.trim() || title?.trim() || "";
  const description = seo?.description?.trim() || "";
  if (!metaTitle && !description) return null;
  return { title: metaTitle, description };
}

/** Runs in the browser during Playwright `page.evaluate`. */
export function extractPageSeoInBrowser() {
  const content = (selector) =>
    document.querySelector(selector)?.getAttribute("content")?.trim() || "";

  const description =
    content('meta[name="description"]') ||
    content('meta[property="og:description"]') ||
    content('meta[name="twitter:description"]');

  const docTitle = document.title.replace(/\s*\|\s*.+$/, "").trim();
  const title =
    content('meta[name="twitter:title"]') ||
    content('meta[property="og:title"]') ||
    docTitle;

  return { title, description };
}

export async function loadFirestorePageMap(db) {
  const docs = await db.collection("pages").listAll();
  const byPath = {};
  const bySlug = {};
  const existingIds = new Set();
  for (const { id, data } of docs) {
    existingIds.add(id);
    const slug = data.slug ?? "";
    const path = slugToPath(slug);
    byPath[path] = id;
    bySlug[slug] = id;
  }
  return { byPath, bySlug, existingIds };
}

export function titleFromPath(path) {
  if (!path || path === "/") return "Home";
  const segment = path.replace(/^\//, "").split("/").pop() || "";
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function resolveEntryTitle(entry) {
  const section = entry.pageSectionTitle?.trim();
  if (section) return section;

  const scraped = entry.title?.trim();
  const fromPath = titleFromPath(entry.path);

  if (entry.path === "/" || entry.path === "") {
    return scraped || "Home";
  }

  if (!scraped) return fromPath || "Page";

  if (entry.siteName && scraped === entry.siteName) {
    return fromPath || scraped;
  }

  return scraped;
}

export function slugifyNavTitle(title) {
  return (title || "section")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug for a link group — prefers section title unless the landing path already matches the title. */
export function linkGroupSlug(title, landingPath) {
  const titleSlug = slugifyNavTitle(title);
  if (!landingPath || landingPath === "/") return titleSlug;

  const pathSlug = pathToSlug(landingPath).split("/").filter(Boolean).pop() || "";
  if (!titleSlug) return pathSlug;
  if (!pathSlug) return titleSlug;
  if (pathSlug === titleSlug) return pathSlug;

  // about -> about-us, giving -> giving
  if (pathSlug.startsWith(titleSlug) || titleSlug.startsWith(pathSlug)) {
    return pathSlug.length >= titleSlug.length ? pathSlug : titleSlug;
  }

  // eCatholic menu headers often link to the first child page (annual-events -> /parish-picnic).
  return titleSlug;
}

/** True when the menu header path is a section landing page, not merely the first child page. */
export function linkGroupUsesLandingPage(title, landingPath) {
  if (!landingPath || landingPath === "/") return false;
  const titleSlug = slugifyNavTitle(title);
  const pathSlug = pathToSlug(landingPath).split("/").filter(Boolean).pop() || "";
  if (!titleSlug || !pathSlug) return Boolean(pathSlug);
  if (pathSlug === titleSlug) return true;
  if (pathSlug.startsWith(titleSlug) || titleSlug.startsWith(pathSlug)) return true;
  return false;
}

/** Runs in the browser during Playwright `page.evaluate`. */
export function scrapeEcatholicNavInBrowser() {
  const origin = location.origin;
  const siteName =
    document.querySelector("#siteName, #headerSiteName, .siteName")?.textContent?.trim() || "";

  const normalizePath = (href) => {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return null;
    }
    try {
      const u = new URL(href, origin);
      if (u.host !== location.host) return null;
      if (u.pathname.startsWith("/admin")) return null;
      if (/\.(pdf|jpe?g|png|gif|webp|docx?|xlsx?|pptx?)($|\?)/i.test(u.pathname)) return null;
      if (u.pathname.startsWith("/photoalbums/")) return null;
      if (u.pathname.startsWith("/bulletins/")) return null;
      return u.pathname.replace(/\/$/, "") || "/";
    } catch {
      return null;
    }
  };

  const resolveLinkTarget = (href) => {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return { path: null, externalUrl: null };
    }
    try {
      const u = new URL(href, origin);
      if (u.host !== location.host) {
        return { path: null, externalUrl: u.href };
      }
      return { path: normalizePath(href), externalUrl: null };
    } catch {
      return { path: null, externalUrl: null };
    }
  };

  const itemTitle = (li) => {
    const link =
      li.querySelector(":scope > a[href]") ||
      li.querySelector(":scope > .navName a[href]") ||
      li.querySelector(":scope > .name a[href]") ||
      li.querySelector(":scope > a") ||
      li.querySelector("a[href]");
    const text = (link?.textContent || li.textContent || "").replace(/\s+/g, " ").trim();
    return text;
  };

  const parseItem = (li) => {
    const childList = li.querySelector(":scope > ul");
    const childItems = childList
      ? [...childList.children]
          .filter((el) => el.tagName === "LI")
          .map(parseItem)
          .filter(Boolean)
      : [];

    const directLink = li.querySelector(":scope > a[href], :scope > .navName a[href], :scope > .name a[href]");
    const href = directLink ? directLink.getAttribute("href") || directLink.href : null;
    const { path, externalUrl } = resolveLinkTarget(href);
    const title = itemTitle(li);

    if (!title && !childItems.length) return null;

    if (childItems.length) {
      return { title: title || "Section", path, externalUrl: null, isGroup: true, children: childItems };
    }

    if (externalUrl) {
      return { title, path: null, externalUrl, isExternal: true, isGroup: false, children: [] };
    }

    if (!path) return null;
    return { title, path, externalUrl: null, isGroup: false, children: [] };
  };

  const navRoot = document.querySelector("#nav");
  if (!navRoot) return { siteName, items: [] };

  const topList =
    navRoot.tagName === "UL" ? navRoot : navRoot.querySelector(":scope > ul") || navRoot;
  const items = [...topList.children]
    .filter((el) => el.tagName === "LI")
    .map(parseItem)
    .filter(Boolean);

  return { siteName, items };
}

export function resolvePageId(ctx, path, entryPageId) {
  const mappedId = entryPageId || ctx.pageMap[path] || null;

  if (ctx.firestorePageMap?.byPath[path]) {
    return ctx.firestorePageMap.byPath[path];
  }

  if (mappedId) return mappedId;

  const slug = pathToSlug(path);
  if (ctx.firestorePageMap?.bySlug[slug]) return ctx.firestorePageMap.bySlug[slug];

  return null;
}

export function pageIdForPath(ctx, path) {
  return resolvePageId(ctx, path, null) || (pathToSlug(path) ? `page_mig_${pathToSlug(path).replace(/-/g, "_")}` : null);
}

export async function discoverEcatholicPaths(page, base) {
  const url = base.endsWith("/") ? base : `${base}/`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await new Promise((resolve) => setTimeout(resolve, 800));

  const paths = await page.evaluate((origin) => {
    const host = new URL(origin).host;
    const found = new Set(["/"]);

    const addPath = (href) => {
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const u = new URL(href, origin);
        if (u.host !== host) return;
        if (u.pathname.startsWith("/admin")) return;
        if (/\.(pdf|jpe?g|png|gif|webp|docx?|xlsx?|pptx?)($|\?)/i.test(u.pathname)) return;
        let path = u.pathname.replace(/\/$/, "") || "/";
        if (path.startsWith("/photoalbums/")) return;
        if (path.startsWith("/bulletins/")) return;
        found.add(path);
      } catch {
        /* ignore bad URLs */
      }
    };

    document
      .querySelectorAll(
        "#nav a[href], #quickLinks a[href], #footer a[href], .sectionNav a[href], #core .sectionNav a[href]",
      )
      .forEach((a) => addPath(a.getAttribute("href") || a.href));

    return [...found].sort((a, b) => a.localeCompare(b));
  }, url);

  return paths;
}

/**
 * Map an eCatholic path or same-site absolute URL to the migrated public path.
 * @param {string} href
 * @param {ReturnType<typeof createMigrationContext>} ctx
 */
export function resolveMigratedHref(href, ctx) {
  if (!href || typeof href !== "string") return href || "/";
  const trimmed = href.trim();
  if (!trimmed) return "/";

  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const base = new URL(ctx.base);
      const u = new URL(trimmed);
      const baseHost = base.hostname.replace(/^www\./, "");
      const linkHost = u.hostname.replace(/^www\./, "");
      if (linkHost !== baseHost) return trimmed;
      path = `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return trimmed;
    }
  }

  if (path.startsWith("#") || path.startsWith("mailto:") || path.startsWith("tel:")) {
    return path;
  }

  const queryHash = path.match(/([?#].*)$/)?.[1] || "";
  let pathname = path.slice(0, path.length - queryHash.length);
  pathname = pathname.replace(/\/$/, "") || "/";

  if (ctx.publicHrefByEcPath?.[pathname]) {
    return ctx.publicHrefByEcPath[pathname] + queryHash;
  }

  return pathname === "/" ? "/" : `${pathname}${queryHash}`;
}

export function createMigrationContext({
  domain,
  parishId = null,
  pageMapConfig = null,
  manifestPath,
  scriptsDir,
}) {
  const base = normalizeDomain(domain);
  const pageMap = pageMapConfig?.paths || {};
  const paths = Object.keys(pageMap).length ? Object.keys(pageMap).sort() : [];

  return {
    base,
    hostname: hostnameFromBase(base),
    parishId: parishId || pageMapConfig?.parishId || null,
    manifestPath: manifestPath || manifestPathForDomain(scriptsDir, base),
    pageMap,
    paths,
    skipPageIds: pageMapConfig?.skipPageIds || new Set(),
    sidebarLeftPageIds: pageMapConfig?.sidebarLeftPageIds || new Set(),
    defaultLayoutPageIds: pageMapConfig?.defaultLayoutPageIds || new Set(),
    homePageId: pageMapConfig?.homePageId || pageMap["/"] || pageMap[""] || null,
    firestorePageMap: null,
    publicHrefByEcPath: null,
    get ecatholicCdn() {
      return ecatholicCdnUrl(this.parishId);
    },
    setPaths(nextPaths) {
      this.paths = [...new Set(nextPaths)].sort((a, b) => a.localeCompare(b));
    },
    setFirestorePageMap(map) {
      this.firestorePageMap = map;
      if (map.byPath["/"]) {
        this.homePageId = map.byPath["/"];
      }
    },
    noteParishId(id) {
      if (id && !this.parishId) this.parishId = id;
    },
  };
}
