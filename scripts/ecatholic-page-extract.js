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

    const moduleInner = li.querySelector(".moduleInner");
    const isDocumentModule =
      moduleInner?.classList.contains("documentsModule") ||
      moduleInner?.classList.contains("documentModule") ||
      moduleInner?.classList.contains("document.Module");
    if (isDocumentModule || li.querySelector(".documentList, .documentsModule, .documentModule")) {
      const items = [];
      const seen = new Set();
      const isDocumentHref = (href) =>
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv)($|\?|#)/i.test(href) ||
        href.includes("/documents/") ||
        href.includes("/files/");
      const addLink = (a) => {
        const href = a.href || a.getAttribute("href") || "";
        if (!href || href.includes("/admin/")) return;
        if (!isDocumentHref(href)) return;
        const label =
          a.textContent.trim() ||
          a.querySelector(".documentName, .name")?.textContent?.trim() ||
          decodeURIComponent(href.split("/").pop() || "");
        const key = `${href}|${label}`;
        if (label && !seen.has(key)) {
          seen.add(key);
          items.push({ label, url: href });
        }
      };
      li.querySelectorAll(
        ".documentList a[href], .documentModule a[href], .moduleBody a[href], li.document a[href]",
      ).forEach(addLink);
      if (!items.length && isDocumentModule) li.querySelectorAll("a[href]").forEach(addLink);
      if (items.length) {
        modules.push({
          type: "documents",
          title: moduleTitle || "Documents",
          items,
        });
        continue;
      }
    }

    if (li.querySelector(".peopleModule, .moduleInner.peopleModule")) {
      const people = [];
      const seen = new Set();
      li.querySelectorAll(".peopleModule .person, .peopleModule li.person").forEach((person) => {
        const name =
          person.querySelector(".name span")?.textContent?.trim() ||
          person.querySelector(".name")?.textContent?.trim() ||
          person.querySelector(".personName, h3, h4, strong")?.textContent?.trim() ||
          "";
        if (!name || seen.has(name)) return;
        seen.add(name);

        const role =
          person.querySelector(".role")?.textContent?.trim() ||
          person.querySelector(".title, .position, .personTitle")?.textContent?.trim() ||
          "";

        const localMail = person.querySelector(".localMail")?.textContent?.trim() || "";
        const domainMail = person.querySelector(".domainMail")?.textContent?.trim() || "";
        let email = "";
        if (localMail && domainMail) {
          email = `${localMail}@${domainMail}`;
        } else {
          email =
            person
              .querySelector('a[href^="mailto:"]')
              ?.getAttribute("href")
              ?.replace(/^mailto:/i, "") ||
            person.querySelector('a[href^="mailto:"]')?.textContent?.trim() ||
            "";
        }

        const phone =
          person.querySelector(".phone")?.textContent?.trim() ||
          person.querySelector('a[href^="tel:"]')?.textContent?.trim() ||
          "";

        const photoEl = person.querySelector("img.thumbImage, .thumb img, picture img, img");
        let photo = photoEl?.getAttribute("src") || photoEl?.getAttribute("data-src") || "";
        if (photo && /spacer|blank\.gif|placeholder/i.test(photo)) photo = "";
        if (photo) photo = photo.replace(/pictures-thumb/g, "pictures");

        people.push({ name, role, email, phone, photo });
      });

      if (people.length) {
        modules.push({
          type: "people",
          title: moduleTitle || "Staff",
          people,
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

      if (moduleInner.classList.contains("embedModule")) {
        const iframe = moduleInner.querySelector("iframe");
        const embedUrl =
          iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
        const body = moduleInner.querySelector(".moduleBody");
        const html = body?.innerHTML?.trim() || "";
        const heightAttr = iframe?.getAttribute("height");
        const height = heightAttr ? parseInt(heightAttr, 10) || 400 : 400;
        if (embedUrl || html) {
          modules.push({
            type: "embed",
            title: moduleTitle || iframe?.getAttribute("title") || "Embed",
            embedUrl,
            html: embedUrl ? "" : html,
            height,
          });
          continue;
        }
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

    const moduleStart = modules.length;

    const isContentImage = (src) =>
      src && !/logo|icon|spacer|pixel|ecatholic-logo|powered-by-ecatholic/i.test(src);

    const isCssNoise = (html) => {
      if (!html?.trim()) return true;
      const stripped = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();
      if (!stripped) return true;
      const plain = stripped
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!plain) return true;
      return (
        /^p\.p\d|span\.s\d|margin:\s*0\.0px|font:\s*[\d.]+px/i.test(plain) &&
        !/<a\b/i.test(stripped)
      );
    };

    const viewClone = view.cloneNode(true);
    viewClone.querySelectorAll("style").forEach((n) => n.remove());

    const seenImages = new Set();
    let textBuffer = [];

    const flushText = () => {
      if (!textBuffer.length) return;
      const combined = textBuffer.join("").trim();
      textBuffer = [];
      if (!isCssNoise(combined)) {
        modules.push({ type: "text", title: moduleTitle, html: combined });
      }
    };

    const pushImages = (imgs) => {
      for (const img of imgs) {
        const src = img.getAttribute("src");
        if (!isContentImage(src)) continue;
        const key = src.split("?")[0];
        if (seenImages.has(key)) continue;
        seenImages.add(key);
        modules.push({ type: "image", src, alt: img.alt || "" });
      }
    };

    for (const node of viewClone.childNodes) {
      if (node.nodeName === "IMG") {
        flushText();
        pushImages([node]);
      } else if (node.nodeType === 1) {
        if (node.nodeName === "STYLE") continue;
        const { imgs, text } = isImageOnly(node);
        if (imgs.length && !text) {
          flushText();
          pushImages(imgs);
        } else if (text) {
          const inlineImgs = [...node.querySelectorAll("img")].filter((img) =>
            isContentImage(img.getAttribute("src")),
          );
          if (inlineImgs.length) {
            flushText();
            pushImages(inlineImgs);
          }
          const nodeClone = node.cloneNode(true);
          nodeClone.querySelectorAll("img, style").forEach((el) => el.remove());
          const html = nodeClone.innerHTML.trim();
          if (!isCssNoise(html)) textBuffer.push(html);
        }
      }
    }
    flushText();

    if (modules.length === moduleStart) {
      const { imgs, text } = isImageOnly(viewClone);
      if (imgs.length && !text) {
        pushImages(imgs);
      } else if (text) {
        const clone = viewClone.cloneNode(true);
        clone.querySelectorAll("img").forEach((el) => el.remove());
        const html = clone.innerHTML.trim();
        if (!isCssNoise(html)) {
          modules.push({ type: "text", title: moduleTitle, html });
        }
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
