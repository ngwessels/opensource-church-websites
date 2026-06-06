/**
 * Paste this in the browser console on any eCatholic page (after the page loads normally).
 * Copies a manifest entry to the clipboard — save to scripts/.visitation-content-manifest.json
 * or run: node scripts/migrate-visitation-content.mjs --import-json /tmp/page.json --apply
 */
(() => {
  const SKIP_MODULE =
    ".massTimes, .calendar, .dailyReadings, .liveStream, .sectionNav, iframe[src*='google.com/calendar']";

  const h1 = document.querySelector("#core h1, #content1 h1, h1");
  const title =
    h1?.textContent?.trim() || document.title.replace(/\s*\|\s*.+$/, "").trim();

  const modules = [];
  const content1 = document.querySelector("#content1");
  if (!content1) {
    console.error("No #content1 found — are you on an eCatholic content page?");
    return;
  }

  const isImageOnly = (el) => {
    const imgs = [...el.querySelectorAll("img")].filter((img) => {
      const src = img.getAttribute("src") || "";
      return src && !/logo|icon|spacer|pixel|ecatholic-logo|powered-by-ecatholic/i.test(src);
    });
    const clone = el.cloneNode(true);
    clone.querySelectorAll("img").forEach((n) => n.remove());
    const text = clone.textContent.replace(/\s+/g, " ").trim();
    return { imgs, text };
  };

  for (const li of content1.querySelectorAll(":scope > li")) {
    if (li.querySelector(SKIP_MODULE)) continue;

    const moduleTitle =
      li.querySelector(".moduleTitle, h2.moduleTitle, h2.moduleName, .customModuleTitle")
        ?.textContent?.trim() || "";

    const docRoot = li.querySelector(".documentModule, .documentList");
    if (docRoot) {
      const items = [];
      const seen = new Set();
      li.querySelectorAll(
        ".documentList a[href], .documentModule a[href], .moduleBody a[href]",
      ).forEach((a) => {
        const href = a.href || a.getAttribute("href") || "";
        if (!href) return;
        if (!/\.pdf($|\?|#)/i.test(href) && !href.includes("/documents/")) return;
        const label =
          a.textContent.trim() ||
          a.querySelector(".documentName, .name")?.textContent?.trim() ||
          href.split("/").pop();
        const key = `${href}|${label}`;
        if (label && !seen.has(key)) {
          seen.add(key);
          items.push({ label, url: href });
        }
      });
      if (items.length) {
        modules.push({
          type: "documents",
          title: moduleTitle || "Documents",
          items,
        });
        continue;
      }
    }

    const mediaInner = li.querySelector(
      ".moduleInner.youtubeModule, .moduleInner.vimeoModule, .youtubeModule, .vimeoModule",
    );
    if (mediaInner) {
      let embedUrl = "";
      let source = mediaInner.classList.contains("vimeoModule") ? "vimeo" : "youtube";

      const iframe = mediaInner.querySelector(
        'iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[data-src*="youtube"], iframe[data-src*="vimeo"]',
      );
      const iframeSrc = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
      if (iframeSrc) {
        embedUrl = iframeSrc;
        if (/vimeo/i.test(iframeSrc)) source = "vimeo";
      }

      if (!embedUrl) {
        const ytEl = mediaInner.querySelector("[data-youtube-id]");
        const ytId = ytEl?.dataset?.youtubeId || mediaInner.dataset?.youtubeId;
        if (ytId) embedUrl = `https://www.youtube.com/embed/${ytId}`;
      }

      if (!embedUrl) {
        const vimeoEl = mediaInner.querySelector("[data-vimeo-id]");
        const vimeoId = vimeoEl?.dataset?.vimeoId || mediaInner.dataset?.vimeoId;
        if (vimeoId) {
          embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
          source = "vimeo";
        }
      }

      if (!embedUrl) {
        const link = mediaInner.querySelector(
          'a[href*="youtube.com"], a[href*="youtu.be"], a[href*="vimeo.com"]',
        );
        const href = link?.href || "";
        const ytMatch = href.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
        const vimeoMatch = href.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (ytMatch) {
          embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
          source = "youtube";
        } else if (vimeoMatch) {
          embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
          source = "vimeo";
        }
      }

      if (!embedUrl) {
        const html = mediaInner.innerHTML || "";
        const ytMatch = html.match(
          /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/|data-youtube-id=["'])([\w-]{6,})/,
        );
        const vimeoMatch = html.match(/(?:vimeo\.com\/(?:video\/)?|data-vimeo-id=["'])(\d+)/);
        if (ytMatch) {
          embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
          source = "youtube";
        } else if (vimeoMatch) {
          embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
          source = "vimeo";
        }
      }

      if (embedUrl) {
        modules.push({
          type: "video",
          title: moduleTitle || "Video",
          source,
          embedUrl,
        });
        continue;
      }
    }

    const moduleInner = li.querySelector(".moduleInner");
    if (moduleInner) {
      if (moduleInner.classList.contains("facebookModule")) {
        const iframe = moduleInner.querySelector("iframe");
        const src = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
        const pageLink = moduleInner.querySelector('a[href*="facebook.com"]');
        modules.push({
          type: "facebook",
          title: moduleTitle || "Facebook",
          pageUrl: pageLink?.href || "",
          embedUrl: src,
          width: 500,
          height: 500,
        });
        continue;
      }

      if (moduleInner.classList.contains("googleMapsModule")) {
        const iframe = moduleInner.querySelector("iframe");
        const src = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
        if (src) {
          modules.push({
            type: "google_maps",
            title: moduleTitle || "Map",
            embedUrl: src,
            height: 450,
          });
          continue;
        }
      }

      if (moduleInner.classList.contains("instagramModule")) {
        const iframe = moduleInner.querySelector("iframe");
        const src = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
        const postLink = moduleInner.querySelector('a[href*="instagram.com"]');
        modules.push({
          type: "instagram",
          title: moduleTitle || "Instagram",
          postUrl: postLink?.href || "",
          embedUrl: src,
          height: 480,
        });
        continue;
      }

      if (moduleInner.classList.contains("rssModule")) {
        const feedInput =
          moduleInner.querySelector('input[name*="feed"], input[name*="rss"], input[type="url"]') ||
          moduleInner.querySelector("[data-feed-url]");
        const feedUrl =
          feedInput?.value ||
          feedInput?.getAttribute("value") ||
          feedInput?.dataset?.feedUrl ||
          "";
        const link = moduleInner.querySelector('a[href*=".xml"], a[href*="feed"], a[href*="rss"]');
        modules.push({
          type: "rss",
          title: moduleTitle || "RSS Feed",
          feedUrl: feedUrl || link?.href || "",
          maxItems: 10,
        });
        continue;
      }

      if (moduleInner.classList.contains("customHTMLModule") || moduleInner.classList.contains("htmlModule")) {
        const body = moduleInner.querySelector(".moduleBody, .customHTML, .htmlContent") || moduleInner;
        const html = body.innerHTML?.trim() || "";
        if (html) {
          modules.push({
            type: "embed",
            title: moduleTitle || "Embed",
            html,
            embedUrl: "",
            height: 400,
          });
          continue;
        }
      }
    }

    const view = li.querySelector(".fr-element.fr-view, .moduleBody .fr-view, .fr-view");
    if (!view) continue;

    const { imgs: viewImgs, text: viewText } = isImageOnly(view);
    if (viewImgs.length && !viewText) {
      for (const img of viewImgs) {
        modules.push({ type: "image", src: img.getAttribute("src"), alt: img.alt || "" });
      }
      continue;
    }

    const childParts = [];
    for (const node of view.childNodes) {
      if (node.nodeName === "IMG") {
        const src = node.getAttribute("src");
        if (src && !/logo|icon|spacer|pixel|ecatholic-logo|powered-by-ecatholic/i.test(src)) {
          childParts.push({ kind: "image", src, alt: node.alt || "" });
        }
      } else if (node.nodeType === 1) {
        const { imgs, text } = isImageOnly(node);
        if (text) {
          const nodeClone = node.cloneNode(true);
          nodeClone.querySelectorAll("img").forEach((el) => el.remove());
          childParts.push({ kind: "text", html: nodeClone.innerHTML.trim(), title: moduleTitle });
        }
        for (const img of imgs) {
          childParts.push({ kind: "image", src: img.getAttribute("src"), alt: img.alt || "" });
        }
      }
    }

    if (childParts.length === 0) {
      const { imgs, text } = isImageOnly(view);
      if (imgs.length && !text) {
        for (const img of imgs) {
          modules.push({ type: "image", src: img.getAttribute("src"), alt: img.alt || "" });
        }
      } else if (text) {
        const clone = view.cloneNode(true);
        clone.querySelectorAll("img").forEach((el) => el.remove());
        modules.push({ type: "text", title: moduleTitle, html: clone.innerHTML.trim() });
      }
      continue;
    }

    for (const part of childParts) {
      if (part.kind === "image") {
        modules.push({ type: "image", src: part.src, alt: part.alt });
      } else if (part.kind === "text" && part.html) {
        modules.push({ type: "text", title: part.title || moduleTitle, html: part.html });
      }
    }
  }

  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const entry = { path, title, modules };
  const json = JSON.stringify(entry, null, 2);

  if (typeof copy === "function") {
    copy(json);
    console.log(`Copied ${modules.length} modules for ${path} to clipboard.`);
  } else {
    console.log(json);
    console.log(`(${modules.length} modules for ${path} — copy the JSON above)`);
  }
  return entry;
})();
