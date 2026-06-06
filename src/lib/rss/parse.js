/**
 * Minimal RSS 2.0 / Atom feed parser (no external dependency).
 * @param {string} xml
 * @returns {{ title: string, link: string, pubDate: string }[]}
 */
export function parseFeedXml(xml) {
  const items = [];

  const rssItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  for (const match of rssItems) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || extractAttr(block, "link", "href");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "dc:date");
    if (title && link) {
      items.push({ title: decodeEntities(title), link: link.trim(), pubDate: pubDate.trim() });
    }
  }

  if (items.length) return items;

  const atomEntries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  for (const match of atomEntries) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link =
      extractAttr(block, 'link[^>]*rel="alternate"[^>]*', "href") ||
      extractAttr(block, "link", "href") ||
      extractTag(block, "id");
    const pubDate = extractTag(block, "updated") || extractTag(block, "published");
    if (title && link) {
      items.push({ title: decodeEntities(title), link: link.trim(), pubDate: pubDate.trim() });
    }
  }

  return items;
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function extractAttr(block, tagPattern, attr) {
  const tagRe = new RegExp(`<${tagPattern}[^>]*${attr}=["']([^"']+)["']`, "i");
  const m = block.match(tagRe);
  return m ? m[1].trim() : "";
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/**
 * @param {string} url
 * @param {number} limit
 */
export async function fetchFeedItems(url, limit = 10) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Feed returned ${res.status}`);
    }

    const text = await res.text();
    if (text.length > 2 * 1024 * 1024) {
      throw new Error("Feed too large");
    }

    return parseFeedXml(text).slice(0, limit);
  } finally {
    clearTimeout(timeout);
  }
}
