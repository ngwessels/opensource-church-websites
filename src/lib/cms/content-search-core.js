/** @param {string} html */
export function stripHtml(html) {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} query */
export function normalizeSearchQuery(query) {
  return String(query || "").trim().toLowerCase();
}

/** @param {unknown} text @param {string} query */
export function textMatchesQuery(text, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return false;
  const normalized = stripHtml(String(text ?? "")).toLowerCase();
  return normalized.includes(q);
}

/** @param {unknown} text @param {string} query @param {number} [maxLen] */
export function makeSnippet(text, query, maxLen = 140) {
  const plain = stripHtml(String(text ?? ""));
  const lower = plain.toLowerCase();
  const q = normalizeSearchQuery(query);
  const idx = lower.indexOf(q);
  if (idx === -1) return plain.slice(0, maxLen);
  const start = Math.max(0, idx - 50);
  const end = Math.min(plain.length, idx + q.length + 50);
  let snippet = plain.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < plain.length) snippet = `${snippet}…`;
  return snippet;
}

const SKIP_SEARCH_KEYS = new Set(["id", "formId", "mediaId", "honeypotFieldName"]);

/**
 * @param {unknown} value
 * @param {string} [path]
 * @returns {Array<{ path: string, text: string }>}
 */
export function collectSearchableStrings(value, path = "") {
  /** @type {Array<{ path: string, text: string }>} */
  const results = [];
  if (value == null) return results;

  if (typeof value === "string") {
    if (value.trim()) results.push({ path: path || "value", text: value });
    return results;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    results.push({ path: path || "value", text: String(value) });
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPath = path ? `${path}[${index}]` : `[${index}]`;
      results.push(...collectSearchableStrings(item, nextPath));
    });
    return results;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      if (SKIP_SEARCH_KEYS.has(key) || key.endsWith("Id")) continue;
      const nextPath = path ? `${path}.${key}` : key;
      results.push(...collectSearchableStrings(val, nextPath));
    }
  }

  return results;
}

/** @param {string} [slug] */
export function builderEditUrl(slug) {
  if (!slug) return "/builder/edit";
  const path = slug.startsWith("/") ? slug : `/${slug}`;
  return `/builder/edit${path}`;
}

/**
 * @param {object} params
 * @param {string} params.query
 * @param {object[]} [params.pages]
 * @param {object} [params.siteConfig]
 * @param {object[]} [params.navNodes]
 * @param {object[]} [params.bulletins]
 * @param {object[]} [params.media]
 * @param {object} [params.adminDocumentation]
 * @param {number} [params.limit]
 */
export function searchInSiteData({
  query,
  pages = [],
  siteConfig = {},
  navNodes = [],
  bulletins = [],
  media = [],
  adminDocumentation = {},
  limit = 50,
}) {
  const q = normalizeSearchQuery(query);
  if (!q) {
    return { query: String(query || ""), total: 0, results: [] };
  }

  /** @type {object[]} */
  const matches = [];
  const pageById = new Map(pages.map((page) => [page.id, page]));

  const push = (match) => {
    matches.push(match);
  };

  const siteScalars = [
    ["name", siteConfig.name],
    ["tagline", siteConfig.tagline],
    ["seo.description", siteConfig.seo?.description],
    ["seo.title", siteConfig.seo?.title],
  ];
  for (const [field, text] of siteScalars) {
    if (text && textMatchesQuery(text, q)) {
      push({
        source: "site",
        field,
        snippet: makeSnippet(text, q),
        builderUrl: "/builder/admin",
      });
    }
  }

  if (siteConfig.massTimes) {
    const massText = collectSearchableStrings(siteConfig.massTimes, "massTimes")
      .map((item) => item.text)
      .join(" ");
    if (textMatchesQuery(massText, q)) {
      push({
        source: "site",
        field: "massTimes",
        snippet: makeSnippet(massText, q),
        builderUrl: "/builder/admin",
      });
    }
  }

  for (const column of siteConfig.footerConfig?.columns || []) {
    const text = column.html || column.text || "";
    if (text && textMatchesQuery(text, q)) {
      push({
        source: "site",
        field: `footer.${column.title || "column"}`,
        snippet: makeSnippet(text, q),
        builderUrl: "/builder/edit",
      });
    }
  }

  for (const node of navNodes) {
    if (node.title && textMatchesQuery(node.title, q)) {
      const page = node.pageId ? pageById.get(node.pageId) : null;
      push({
        source: "nav",
        field: "title",
        pageId: node.pageId,
        pageTitle: node.title,
        pageSlug: page?.slug ?? node.slug ?? "",
        snippet: makeSnippet(node.title, q),
        builderUrl: page ? builderEditUrl(page.slug) : "/builder/sitemap",
      });
    }
  }

  for (const page of pages) {
    const pageId = page.id;
    const pageTitle = page.title || "Untitled";
    const pageSlug = page.slug ?? "";
    const editUrl = builderEditUrl(pageSlug);

    if (page.title && textMatchesQuery(page.title, q)) {
      push({
        source: "page",
        pageId,
        pageTitle,
        pageSlug,
        field: "title",
        snippet: makeSnippet(page.title, q),
        builderUrl: editUrl,
      });
    }

    if (page.seo?.title && textMatchesQuery(page.seo.title, q)) {
      push({
        source: "page",
        pageId,
        pageTitle,
        pageSlug,
        field: "seo.title",
        snippet: makeSnippet(page.seo.title, q),
        builderUrl: editUrl,
      });
    }

    if (page.seo?.description && textMatchesQuery(page.seo.description, q)) {
      push({
        source: "page",
        pageId,
        pageTitle,
        pageSlug,
        field: "seo.description",
        snippet: makeSnippet(page.seo.description, q),
        builderUrl: editUrl,
      });
    }

    for (const region of page.regions || []) {
      for (const mod of region.modules || []) {
        for (const { path, text } of collectSearchableStrings(mod.config)) {
          if (!textMatchesQuery(text, q)) continue;
          push({
            source: "module",
            pageId,
            pageTitle,
            pageSlug,
            moduleId: mod.id,
            moduleType: mod.type,
            regionId: region.id,
            field: path,
            snippet: makeSnippet(text, q),
            builderUrl: editUrl,
          });
        }
      }
    }
  }

  for (const bulletin of bulletins) {
    const parts = [bulletin.title, bulletin.date].filter(Boolean);
    const combined = parts.join(" ");
    if (combined && textMatchesQuery(combined, q)) {
      push({
        source: "bulletin",
        bulletinId: bulletin.id,
        field: bulletin.title ? "title" : "date",
        snippet: makeSnippet(combined, q),
        builderUrl: "/builder/edit",
      });
    }
  }

  for (const item of media) {
    const parts = [item.name, item.description, item.alt, ...(item.tags || [])].filter(Boolean);
    const combined = parts.join(" ");
    if (combined && textMatchesQuery(combined, q)) {
      push({
        source: "media",
        mediaId: item.id,
        field: "metadata",
        snippet: makeSnippet(combined, q),
        builderUrl: "/builder/files",
      });
    }
  }

  for (const note of adminDocumentation.notes || []) {
    if (note.title && textMatchesQuery(note.title, q)) {
      push({
        source: "adminDocumentation",
        noteId: note.id,
        field: "title",
        snippet: makeSnippet(note.title, q),
        builderUrl: "/builder/admin",
      });
    }
    if (note.body && textMatchesQuery(note.body, q)) {
      push({
        source: "adminDocumentation",
        noteId: note.id,
        field: "body",
        snippet: makeSnippet(note.body, q),
        builderUrl: "/builder/admin",
      });
    }
  }

  return {
    query: String(query),
    total: matches.length,
    results: matches.slice(0, limit),
  };
}
