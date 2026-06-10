#!/usr/bin/env node
/**
 * Migrate content from an eCatholic parish site into Firestore (one page at a time).
 *
 *   node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --path /about-us --apply --publish
 *   node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --apply-all --apply --upload-images --publish
 *   node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --connect 9222 --apply-all --apply
 *
 * Full transfer (--apply-all, --apply-only, or --from-manifest --apply) also scrapes bulletin
 * PDFs and uploads them to Firebase Storage when /bulletins is in the page map.
 * Pass --skip-import-bulletins to omit bulletin import.
 *
 * Cloudflare blocks headless Playwright — use headed mode (default) or connect to real Chrome:
 *
 *   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *     --remote-debugging-port=9222 --user-data-dir="$HOME/.ecatholic-scrape-chrome"
 *   Open the parish site in that window, pass Cloudflare once, then:
 *   node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --connect 9222 --apply-all --apply
 *
 * Manual fallback: paste scripts/ecatholic-page-extract.js in the browser console, then:
 *   node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --import-json /tmp/page.json --apply
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createMigrationContext,
  defaultPageMapPath,
  detectParishIdFromHtml,
  discoverEcatholicPaths,
  extractPageSeoInBrowser,
  loadFirestorePageMap,
  loadPageMapFile,
  manifestPathForDomain,
  normalizeDomain,
  normalizeScrapedSeo,
  pageIdForPath,
  pathToSlug,
  readManifestFile,
  resolveEntryTitle,
  resolvePageId,
  resolveMigratedHref,
  scrapeEcatholicNavInBrowser,
  slugifyNavTitle,
  linkGroupSlug,
  linkGroupUsesLandingPage,
  writeManifestFile,
} from "./lib/ecatholic-migration-context.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STORAGE_STATE_PATH = join(__dirname, ".ecatholic-storage.json");
const CHROME_PROFILE_PATH = join(__dirname, ".chrome-profile");
const PICTURES_FOLDER = "pictures-root";
const DOCUMENTS_FOLDER = "documents-root";
const FILE_DELAY_MS = 400;
const PAGE_DELAY_MS = 500;
const CONTENT_WAIT_MS = 45_000;
const CLOUDFLARE_WAIT_MS = 120_000;

/** @type {ReturnType<typeof createMigrationContext> | null} */
let migrationCtx = null;

function ctx() {
  if (!migrationCtx) {
    throw new Error("--domain is required (e.g. --domain www.yourparish.org)");
  }
  return migrationCtx;
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const pathIdx = argv.indexOf("--path");
  const connectIdx = argv.indexOf("--connect");
  const importIdx = argv.indexOf("--import-json");
  const profileIdx = argv.indexOf("--chrome-profile");
  const fromManifestIdx = argv.indexOf("--from-manifest");
  const domainIdx = argv.indexOf("--domain");
  const parishIdIdx = argv.indexOf("--parish-id");
  const pageMapIdx = argv.indexOf("--page-map");
  const manifestIdx = argv.indexOf("--manifest");
  let fromManifest = null;
  if (fromManifestIdx >= 0) {
    const next = argv[fromManifestIdx + 1];
    fromManifest = next && !next.startsWith("-") ? next : null;
  }

  return {
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply") || argv.includes("--apply-all"),
    applyAll: argv.includes("--apply-all"),
    /** Headed by default — uses real Google Chrome, not Playwright Chromium. */
    headed: !argv.includes("--headless"),
    publish: argv.includes("--publish"),
    path: pathIdx >= 0 ? argv[pathIdx + 1] : null,
    domain: domainIdx >= 0 ? argv[domainIdx + 1] : null,
    parishId: parishIdIdx >= 0 ? argv[parishIdIdx + 1] : null,
    pageMapPath: pageMapIdx >= 0 ? argv[pageMapIdx + 1] : null,
    manifestPath: manifestIdx >= 0 ? argv[manifestIdx + 1] : null,
    fromManifest,
    discoverPaths: argv.includes("--discover-paths"),
    /** Attach to Chrome started with --remote-debugging-port (avoids Cloudflare bot detection). */
    connect: connectIdx >= 0 ? argv[connectIdx + 1] : null,
    chromeProfile: profileIdx >= 0 ? argv[profileIdx + 1] : CHROME_PROFILE_PATH,
    importJson: importIdx >= 0 ? argv[importIdx + 1] : null,
    /** Re-scrape paths that already exist in the manifest. */
    force: argv.includes("--force"),
    uploadImages: argv.includes("--upload-images"),
    applyOnly: argv.includes("--apply-only"),
    importNavOnly: argv.includes("--import-nav-only"),
    importBulletinsOnly: argv.includes("--import-bulletins-only"),
    importBulletins:
      argv.includes("--import-bulletins") ||
      argv.includes("--import-bulletins-only"),
    skipImportBulletins: argv.includes("--skip-import-bulletins"),
    skipImportNav: argv.includes("--skip-import-nav"),
    /** Keep going when a page times out (default for --apply-all). */
    continueOnError:
      argv.includes("--continue-on-error") ||
      (argv.includes("--apply-all") && !argv.includes("--fail-fast")),
  };
}

function printHelp() {
  console.log(`Migrate content from an eCatholic parish site into Firestore.

Usage:
  node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --connect 9222 --apply-all --apply
  node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --path /about-us --apply --publish
  node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --from-manifest --apply
  node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --import-json page.json --apply

Required:
  --domain <host>        eCatholic site (e.g. www.yourparish.org or https://www.yourparish.org)

Options:
  --connect <port|url>   Attach to real Chrome (best for Cloudflare)
  --path <path>          Scrape one eCatholic path (e.g. /about-us)
  --apply-all            Scrape all mapped or discovered paths
  --discover-paths       Discover paths from site nav (used automatically when no page map)
  --apply                Write manifest entries to Firestore
  --publish              Publish after apply
  --from-manifest [file] Apply from manifest without scraping
  --manifest <file>      Manifest file path (default: scripts/.ecatholic-migration-<domain>.json)
  --apply-only           Skip scrape; apply + publish from manifest only
  --import-nav-only      Re-import eCatholic navigation only (requires --connect)
  --import-bulletins-only  Import bulletin PDFs only (no page content)
  --skip-import-bulletins  Skip bulletin PDF import during batch apply
  --import-bulletins     Force bulletin PDF import (also runs automatically on batch apply)
  --import-json <file>   Merge one manual console extract into manifest
  --page-map <file>      JSON mapping eCatholic paths to Firestore page IDs
  --parish-id <id>       eCatholic parish ID (auto-detected from page HTML if omitted)
  --force                Re-scrape paths already in manifest
  --upload-images        Upload images, documents, and photo albums to Firebase
  --skip-import-nav      Skip replacing nav with eCatholic site navigation
  --headless             Use Playwright Chromium (usually blocked by Cloudflare)
  --dry-run              Preview without writing
  --continue-on-error    Skip failed pages during batch scrape

SEO:
  Scrapes meta description (meta description, Open Graph, Twitter) and meta title
  from each page and writes them to page seo.title / seo.description on apply.
  Re-scrape with --force to refresh SEO on pages already in the manifest.

Page map:
  Optional JSON file mapping paths to Firestore page IDs. If omitted, the script looks for
  scripts/ecatholic-migration/<domain>.json, then matches Firestore pages by slug on apply.

Cloudflare workaround — start Chrome separately, then connect:

  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
    --remote-debugging-port=9222 \\
    --user-data-dir="$HOME/.ecatholic-scrape-chrome"

Open your parish site in that window, pass Cloudflare once, then:

  node scripts/migrate-ecatholic-content.mjs --domain www.yourparish.org --connect 9222 --apply-all --apply --upload-images --publish

Batch apply also imports bulletin PDFs when /bulletins is in the page map (use --skip-import-bulletins to skip).

Manual fallback: paste scripts/ecatholic-page-extract.js in the browser console on each page.
`);
}

function printCloudflareHelp(siteBase) {
  console.error(`
Cloudflare is blocking the automated browser (Verify Human loops forever in Playwright Chromium).

Use real Chrome instead:

  1. Quit Chrome completely
  2. Start Chrome with remote debugging:
     /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
       --remote-debugging-port=9222 \\
       --user-data-dir="$HOME/.ecatholic-scrape-chrome"
  3. In that window, open ${siteBase} and browse normally (no bot check loop)
  4. Re-run with --connect 9222

Or extract one page manually: paste scripts/ecatholic-page-extract.js in the browser console,
save the JSON, then: node scripts/migrate-ecatholic-content.mjs --domain ${new URL(siteBase).hostname} --import-json page.json --apply
`);
}

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function logProgress(message) {
  process.stdout.write(`${message}\n`);
}

const CHROME_DEBUG_LAUNCH = `/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
  --remote-debugging-port=9222 \\
  --user-data-dir="$HOME/.ecatholic-scrape-chrome"`;

async function assertChromeDebugPort(connect, siteBase) {
  const endpoint = connect.startsWith("http") ? connect : `http://127.0.0.1:${connect}`;
  const versionUrl = `${endpoint.replace(/\/$/, "")}/json/version`;
  try {
    const res = await fetch(versionUrl, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();
    logProgress(`[migrate] Chrome debug port OK (${info.Browser || "Chrome"})`);
  } catch {
    throw new Error(
      `Cannot reach Chrome debug port at ${endpoint}.\n\n` +
        `Start Chrome in a separate terminal and leave it running:\n\n` +
        `  ${CHROME_DEBUG_LAUNCH}\n\n` +
        `Then open ${siteBase} in that window before running this script.`,
    );
  }
}

async function initFirebase({ uploadImages = false } = {}) {
  loadEnvFile(join(ROOT, ".env.local"));
  loadEnvFile(join(ROOT, ".env"));
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials missing from .env.local");
  }

  logProgress("[migrate] Connecting to Firestore (REST)…");
  const { createFirestoreRest } = await import("./lib/firestore-rest.mjs");
  const db = await createFirestoreRest({ projectId, clientEmail, privateKey });
  logProgress(`[migrate] Firestore ready (${projectId}).`);

  let storage = null;
  if (uploadImages) {
    if (!storageBucket) {
      throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required for --upload-images");
    }
    logProgress("[migrate] Connecting to Cloud Storage (REST)…");
    const { createGcsRest } = await import("./lib/gcs-rest.mjs");
    storage = await createGcsRest({ clientEmail, privateKey, bucketName: storageBucket });
    logProgress("[migrate] Cloud Storage ready.");
  }

  return { db, storage };
}

function pickScrapePage(context, hostname) {
  const pages = context.pages();
  const onSite = pages.find((p) => {
    try {
      return p.url().includes(hostname);
    } catch {
      return false;
    }
  });
  return onSite || pages[0] || null;
}

async function resolveScrapePage(context, hostname) {
  const existing = pickScrapePage(context, hostname);
  if (existing) return existing;
  logProgress("[migrate] Opening a new Chrome tab for scraping…");
  return context.newPage();
}

function generateId() {
  return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function layoutFor(pageId) {
  const c = ctx();
  if (pageId === c.homePageId) return "full-width";
  if (c.defaultLayoutPageIds.has(pageId)) return "default";
  if (c.sidebarLeftPageIds.has(pageId)) return "sidebar-left";
  return "default";
}

function emptyRegions(pageId) {
  const layout = layoutFor(pageId);
  const c = ctx();
  if (pageId === c.homePageId) {
    return [
      { id: "features", modules: [] },
      { id: "content-1", modules: [] },
      { id: "content-2", modules: [] },
    ];
  }
  if (layout === "sidebar-left") {
    return [
      { id: "features", modules: [] },
      { id: "content-1", modules: [] },
      { id: "sidebar", modules: [] },
    ];
  }
  return [
    { id: "features", modules: [] },
    { id: "content-1", modules: [] },
  ];
}

function buildPublishedSnapshot(data) {
  const snapshot = {
    regions: data.regions,
    layout: data.layout,
    title: data.title,
    seo: data.seo,
  };
  if (data.contentMarginX !== undefined) snapshot.contentMarginX = data.contentMarginX;
  return snapshot;
}

function albumSlugFromHref(href) {
  try {
    const u = new URL(href, ctx().base);
    const match = u.pathname.match(/\/photoalbums\/([^/?#]+)/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function pageIdForAlbumSlug(slug) {
  const safe = slug.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();
  return `page_mig_album_${safe}`;
}

function internalAlbumHref(slug) {
  return `/photo-albums/${slug}`;
}

async function scrapePhotoAlbumImages(browserPage, albumHref) {
  const base = ctx().base;
  const url = albumHref.startsWith("http") ? albumHref : `${base}${albumHref}`;
  process.stdout.write(`  Scraping album ${url}...\n`);
  await browserPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await sleep(800);
  return browserPage.evaluate(() => {
    const seen = new Set();
    const images = [];
    const add = (rawHref, alt) => {
      if (!rawHref) return;
      let src = rawHref.startsWith("http") ? rawHref : new URL(rawHref, location.origin).href;
      src = src.replace(/\/thumb\/photoalbums\//gi, "/photoalbums/").split("?")[0];
      if (!/\.(jpe?g|png|gif|webp)$/i.test(src)) return;
      if (seen.has(src)) return;
      seen.add(src);
      images.push({ src, alt: alt || "" });
    };
    document.querySelectorAll('a[href*="/photoalbums/"]').forEach((a) => {
      add(a.href || a.getAttribute("href"), a.querySelector("img")?.alt);
    });
    if (!images.length) {
      document.querySelectorAll("img[src*='photoalbums']").forEach((img) => {
        add(img.src || img.getAttribute("src"), img.alt);
      });
    }
    return images;
  });
}

async function ensureAlbumPage(db, { pageId, slug, title, images, publish, dryRun }) {
  const regions = [
    {
      id: "content-1",
      modules: [
        {
          id: generateId(),
          type: "gallery",
          region: "content-1",
          order: 0,
          config: { title, images },
        },
      ],
    },
  ];

  const pageData = {
    slug,
    title,
    layout: "default",
    contentColumns: 1,
    maxModulesPerRegion: 15,
    contentMarginX: "md",
    regions,
    seo: { title },
    updatedAt: new Date().toISOString(),
    status: publish ? "published" : "draft",
  };

  if (publish) {
    pageData.publishedSnapshot = buildPublishedSnapshot(pageData);
    pageData.publishedAt = new Date().toISOString();
    pageData.scheduledPublishAt = null;
  }

  if (dryRun) {
    console.log(`  [dry-run] album page ${pageId} (${slug}): ${images.length} images`);
    return;
  }

  await db.collection("pages").doc(pageId).set(pageData);
  console.log(`  Created album page ${pageId} → /${slug} (${images.length} photos)`);
}

async function importPhotoAlbum(
  album,
  { db, storage, browserPage, publish, dryRun, albumPageCache, urlCache },
) {
  const slug = albumSlugFromHref(album.href);
  if (!slug) {
    console.warn(`  Could not parse album slug from ${album.href}`);
    return { href: album.href, imageSrc: album.imageSrc };
  }

  const internalHref = internalAlbumHref(slug);
  if (albumPageCache.has(slug)) {
    return albumPageCache.get(slug);
  }

  const pageId = pageIdForAlbumSlug(slug);
  const title = album.label || slug.replace(/-/g, " ");
  const scraped = browserPage ? await scrapePhotoAlbumImages(browserPage, album.href) : [];
  const sourceImages =
    scraped.length > 0
      ? scraped
      : album.imageSrc
        ? [{ src: resolveImageUrl(album.imageSrc) || album.imageSrc, alt: title }]
        : [];

  if (!sourceImages.length) {
    console.warn(`  No images found for album ${album.href}`);
    return { href: album.href, imageSrc: album.imageSrc };
  }

  const images = [];
  for (const img of sourceImages) {
    images.push({
      src: await resolveUploadedFileUrl(
        img.src,
        { dryRun, storage, uploadImages: true, page: browserPage, folder: PICTURES_FOLDER },
        urlCache,
      ),
      alt: img.alt || title,
    });
  }

  await ensureAlbumPage(db, {
    pageId,
    slug: `photo-albums/${slug}`,
    title,
    images,
    publish,
    dryRun,
  });

  const result = { href: internalHref, imageSrc: images[0]?.src || album.imageSrc, photoCount: images.length };
  albumPageCache.set(slug, result);
  return result;
}

/** Map site-relative paths to eCatholic CDN (works without Cloudflare). */
function upgradeEcatholicImageSrc(src) {
  if (!src?.trim()) return src;
  return src
    .trim()
    .replace(/\/thumb\/photoalbums\//gi, "/photoalbums/")
    .replace(/pictures-thumb/g, "pictures");
}

function resolveImageUrl(src) {
  if (!src) return null;
  const base = ctx().base;
  const ecatholicCdn = ctx().ecatholicCdn;
  const upgraded = upgradeEcatholicImageSrc(src);
  let path = upgraded;
  if (upgraded.startsWith("http")) {
    try {
      const u = new URL(upgraded);
      path = u.pathname;
      if (path.startsWith("/photoalbums/") && /\.(jpe?g|png|gif|webp)$/i.test(path)) {
        return `${u.origin}${path}`.split("?")[0];
      }
      if (path.startsWith("/pictures/") || path.startsWith("/documents/")) {
        if (ecatholicCdn) return `${ecatholicCdn}${path}`.split("?")[0];
        return `${u.origin}${path}`.split("?")[0];
      }
      return upgraded.split("?")[0];
    } catch {
      return upgraded.split("?")[0];
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.startsWith("/photoalbums/") && /\.(jpe?g|png|gif|webp)$/i.test(path)) {
    return `${base}${path}`.split("?")[0];
  }
  if (path.startsWith("/pictures/") || path.startsWith("/documents/")) {
    if (ecatholicCdn) return `${ecatholicCdn}${path}`.split("?")[0];
    return `${base}${path}`.split("?")[0];
  }
  if (upgraded.startsWith("http")) return upgraded.split("?")[0];
  return `${base}${path}`.split("?")[0];
}

function resolvePersonPhotoUrl(src) {
  if (!src?.trim()) return "";
  return resolveImageUrl(src) || upgradeEcatholicImageSrc(src).split("?")[0];
}

function isCssNoiseHtml(html) {
  if (!html?.trim()) return true;
  const stripped = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();
  if (!stripped) return true;
  if (/<img\b/i.test(stripped)) return false;
  const plain = stripped
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return true;
  return (
    /^p\.p\d|span\.s\d|margin:\s*0\.0px|font:\s*[\d.]+px/i.test(plain) &&
    !/<a\b/i.test(stripped)
  );
}

/** Merge split text blocks and drop duplicate images from legacy scrapes. */
function consolidateScrapedModules(modules) {
  const byRegion = new Map();
  for (const mod of modules) {
    const region = mod.region || "content-1";
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(mod);
  }

  const out = [];
  for (const [region, regionMods] of byRegion) {
    const seenImages = new Set();
    for (const mod of regionMods) {
      if (mod.type === "text" && isCssNoiseHtml(mod.html)) continue;

      if (mod.type === "image") {
        const modSrc = resolveImageUrl(mod.src) || mod.src || "";
        if (modSrc && seenImages.has(modSrc)) continue;
        if (modSrc) seenImages.add(modSrc);
      }
      out.push({ ...mod, region });
    }
  }
  return out;
}

function titleFromHtml(html) {
  if (!html?.trim()) return "";
  const heading = html.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
  if (!heading) return "";
  const text = heading[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= 120 ? text : "";
}

function titleFromPath(path) {
  if (!path || path === "/") return "";
  const segment = path.replace(/^\//, "").split("/").pop() || "";
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function fillMissingModuleTitles(entry) {
  const pageTitle = entry.pageSectionTitle || titleFromPath(entry.path);
  for (const mod of entry.modules || []) {
    if (mod.title?.trim()) continue;
    if (mod.type === "text" && mod.html) {
      const fromHtml = titleFromHtml(mod.html);
      if (fromHtml) {
        mod.title = fromHtml;
        continue;
      }
    }
    const pageTitleTypes = new Set(["text", "people", "documents", "links", "embed", "video"]);
    if (pageTitleTypes.has(mod.type) && pageTitle) mod.title = pageTitle;
    else if (mod.type === "people") mod.title = "Staff";
    else if (mod.type === "links") mod.title = "Links";
    else if (mod.type === "documents") mod.title = "Documents";
  }
  return entry;
}

function filenameFromUrl(url) {
  try {
    const name = new URL(url).pathname.split("/").pop();
    return name || "image.jpg";
  } catch {
    return "image.jpg";
  }
}

function mimeFromFilename(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const types = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    rtf: "application/rtf",
    csv: "text/csv",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return types[ext] || null;
}

async function downloadFileBytes(sourceUrl, { page } = {}) {
  const url = resolveImageUrl(sourceUrl) || sourceUrl;
  if (page) {
    const response = await page.request.get(url);
    if (response.ok()) {
      return {
        buffer: Buffer.from(await response.body()),
        contentType: response.headers()["content-type"] || "image/jpeg",
        url,
      };
    }

    const viaBrowser = await page.evaluate(async (imageUrl) => {
      const res = await fetch(imageUrl);
      if (!res.ok) return { ok: false, status: res.status };
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return {
        ok: true,
        contentType: res.headers.get("content-type") || "image/jpeg",
        base64: btoa(binary),
      };
    }, url);

    if (viaBrowser.ok) {
      return {
        buffer: Buffer.from(viaBrowser.base64, "base64"),
        contentType: viaBrowser.contentType,
        url,
      };
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/jpeg",
    url,
  };
}

async function uploadFile(storage, sourceUrl, { page, folder = PICTURES_FOLDER } = {}) {
  const { buffer, contentType, url } = await downloadFileBytes(sourceUrl, { page });
  if (buffer.length > 10 * 1024 * 1024) throw new Error(`File too large: ${url}`);

  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const filename = filenameFromUrl(url);
  const mimeType = contentType || mimeFromFilename(filename) || "application/octet-stream";
  const storagePath = `media/${folder}/${mediaId}_${filename}`;
  const downloadUrl = await storage.uploadPublicObject(storagePath, buffer, mimeType);

  return { downloadUrl, filename };
}

async function uploadImage(storage, sourceUrl, alt, { page } = {}) {
  const uploaded = await uploadFile(storage, sourceUrl, { page, folder: PICTURES_FOLDER });
  return { ...uploaded, alt: alt || "" };
}

async function resolveUploadedFileUrl(
  sourceUrl,
  { dryRun, storage, uploadImages, page, folder = PICTURES_FOLDER },
  urlCache,
) {
  const source = sourceUrl?.startsWith("http") ? sourceUrl : resolveImageUrl(sourceUrl) || sourceUrl;
  if (dryRun || !storage || !uploadImages || !source) return source;
  if (urlCache.has(source)) return urlCache.get(source);
  try {
    console.log(`  Uploading ${source}`);
    const uploaded = await uploadFile(storage, source, { page, folder });
    urlCache.set(source, uploaded.downloadUrl);
    await sleep(FILE_DELAY_MS);
    return uploaded.downloadUrl;
  } catch (err) {
    console.warn(`  Upload failed, using source URL: ${err.message}`);
    return source;
  }
}

async function resolveUploadedImageUrl(
  sourceUrl,
  alt,
  { dryRun, storage, uploadImages, page },
  imageUrlCache,
) {
  return resolveUploadedFileUrl(
    resolveImageUrl(sourceUrl) || sourceUrl,
    { dryRun, storage, uploadImages, page, folder: PICTURES_FOLDER },
    imageUrlCache,
  );
}

async function waitForPageContent(page, path) {
  let deadline = Date.now() + CONTENT_WAIT_MS;
  let cloudflareSeen = false;
  let broughtToFront = false;

  while (Date.now() < deadline) {
    const title = await page.title();
    const count = await page.locator("#content1").count();
    if (count > 0) return;

    if (title.includes("Just a moment") || title.includes("Attention Required")) {
      if (!cloudflareSeen) {
        cloudflareSeen = true;
        deadline = Date.now() + CLOUDFLARE_WAIT_MS;
        process.stdout.write(
          `  Cloudflare challenge on ${path} — complete it in the browser window (up to ${CLOUDFLARE_WAIT_MS / 1000}s)...\n`,
        );
      }
      if (!broughtToFront) {
        broughtToFront = true;
        try {
          await page.bringToFront();
        } catch {
          /* optional */
        }
      }
    } else {
      process.stdout.write(`  Waiting for #content1 on ${path} (${title})...\n`);
    }
    await sleep(1500);
  }

  throw new Error(
    `Timed out waiting for page content at ${path}. See --help for Cloudflare workarounds (--connect 9222).`,
  );
}

async function scrapePageDom(page, path) {
  return page.evaluate(({ pagePath }) => {
    const SKIP_MODULE =
      ".massTimes, .calendar, .dailyReadings, .liveStream, .sectionNav, iframe[src*='google.com/calendar']";
    const SKIP_WIDGET =
      ".massTimes, .massTimesModule, .calendar, .embedModule, .dailyReadings, .usccbReadingsModule, .newsVAModule, .confessionTimesModule, iframe[src*='google.com/calendar']";

    const cleanModuleTitle = (raw) => {
      const parts = (raw || "")
        .replace(/\t/g, " ")
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && s !== "No Subtitle" && s !== "No Title");
      return parts[0] || "";
    };

    const h1 = document.querySelector("#pageTitle h1, .pageTitle h1, #core h1, #content1 h1, h1");

    const siteName =
      document.querySelector("#siteName, #headerSiteName, .siteName")?.textContent?.trim() || "";

    const inferPageSectionTitle = () => {
      const fromDoc = document.title.replace(/\s*\|\s*.+$/, "").trim();
      const first = fromDoc.split(" - ")[0]?.trim() || "";
      if (first && first !== siteName) return first;

      const pageTitleEl = document.querySelector("#pageTitle h1, .pageTitle h1");
      if (pageTitleEl) {
        const text = pageTitleEl.textContent?.trim() || "";
        if (text && text !== siteName) return text;
      }

      for (const heading of document.querySelectorAll("#core h1, #content1 h1")) {
        if (heading.closest("#siteName, #header, #nav")) continue;
        const text = heading.textContent?.trim() || "";
        if (text && text !== siteName) return text;
      }

      return "";
    };

    const titleFromHtml = (html) => {
      if (!html?.trim()) return "";
      const doc = new DOMParser().parseFromString(html, "text/html");
      const heading = doc.querySelector("h2, h3, h4");
      const text = heading?.textContent?.replace(/\s+/g, " ").trim() || "";
      return text && text.length <= 120 ? text : "";
    };

    const isCssNoise = (html) => {
      if (!html?.trim()) return true;
      const stripped = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();
      if (!stripped) return true;
      if (/<img\b/i.test(stripped)) return false;
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

    const normalizeFrViewHtml = (view) => {
      const clone = view.cloneNode(true);
      clone.querySelectorAll("style").forEach((el) => el.remove());
      const isContentImage = (src) =>
        src && !/logo|icon|spacer|pixel|ecatholic-logo|powered-by-ecatholic/i.test(src);
      clone.querySelectorAll("img").forEach((img) => {
        let src = img.getAttribute("src") || img.getAttribute("data-src") || "";
        if (!isContentImage(src)) {
          img.remove();
          return;
        }
        if (!src.startsWith("http")) {
          src = new URL(src, location.origin).href;
        }
        src = src.replace(/pictures-thumb/g, "pictures");
        img.setAttribute("src", src);
        img.removeAttribute("data-src");
      });
      return clone.innerHTML.trim();
    };

    const pageSectionTitle = inferPageSectionTitle();

    const isDocumentModuleInner = (inner) =>
      inner?.classList.contains("documentsModule") ||
      inner?.classList.contains("documentModule") ||
      inner?.classList.contains("document.Module");

    const isDocumentHref = (href) =>
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv)($|\?|#)/i.test(href) ||
      href.includes("/documents/") ||
      href.includes("/files/");

    const extractDocumentItems = (li) => {
      const items = [];
      const seen = new Set();
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

      if (!items.length && isDocumentModuleInner(li.querySelector(".moduleInner"))) {
        li.querySelectorAll("a[href]").forEach(addLink);
      }

      return items;
    };

    const resolveModuleTitle = (mod) => {
      if (mod.title?.trim()) return mod;

      if (mod.type === "text" && mod.html) {
        const fromHtml = titleFromHtml(mod.html);
        if (fromHtml) {
          mod.title = fromHtml;
          return mod;
        }
      }

      const pageTitleTypes = new Set(["text", "people", "documents", "links", "embed", "video"]);
      if (pageTitleTypes.has(mod.type) && pageSectionTitle) {
        mod.title = pageSectionTitle;
        return mod;
      }

      if (mod.type === "people" && !mod.title) mod.title = "Staff";
      if (mod.type === "links" && !mod.title) mod.title = "Links";
      if (mod.type === "documents" && !mod.title) mod.title = "Documents";

      return mod;
    };

    const title =
      pageSectionTitle ||
      (pagePath === "/" || pagePath === "" ? siteName || "Home" : "") ||
      document.title.replace(/\s*\|\s*.+$/, "").trim();

    const scrapedModules = [];
    const isHome = pagePath === "/" || pagePath === "";
    const regionContainers = isHome
      ? [
          { selector: "#content1", region: "content-1", skip: SKIP_MODULE },
          { selector: "#content2", region: "content-2", skip: SKIP_WIDGET },
        ]
      : [{ selector: "#content1", region: "content-1", skip: SKIP_MODULE }];

    if (!document.querySelector("#content1")) {
      return { title, modules: scrapedModules, error: "no #content1" };
    }

    for (const { selector, region, skip } of regionContainers) {
      const container = document.querySelector(selector);
      if (!container) continue;

      for (const li of container.querySelectorAll(":scope > li")) {
        if (li.querySelector(skip)) continue;

        const moduleTitle = cleanModuleTitle(
          li.querySelector(
            ".moduleTitle, h2.moduleTitle, h2.moduleName, .customModuleTitle, .moduleName, header h2, header .moduleTitle, header .moduleName",
          )?.textContent,
        );

        const moduleInner = li.querySelector(".moduleInner");

        if (moduleInner?.classList.contains("linksModule")) {
          const items = [];
          const seen = new Set();
          li.querySelectorAll(".linkModule a[href], .moduleBody a[href], li.link a[href]").forEach((a) => {
            const label = a.textContent.trim();
            const href = a.href || a.getAttribute("href") || "";
            const key = `${href}|${label}`;
            if (label && href && !seen.has(key)) {
              seen.add(key);
              items.push({ label, href });
            }
          });
          if (items.length) {
            scrapedModules.push({ type: "links", title: moduleTitle, items, region });
            continue;
          }
        }

        if (
          isDocumentModuleInner(moduleInner) ||
          li.querySelector(".documentList, .documentsModule, .documentModule")
        ) {
          const items = extractDocumentItems(li);
          if (items.length) {
            scrapedModules.push({
              type: "documents",
              title: moduleTitle || "Documents",
              items,
              region,
            });
            continue;
          }
        }

        if (moduleInner?.classList.contains("photoAlbumsModule")) {
          const albums = [];
          const seen = new Set();
          const toFullSrc = (raw) => {
            if (!raw) return "";
            const abs = raw.startsWith("http") ? raw : new URL(raw, location.origin).href;
            return abs.replace(/\/thumb\/photoalbums\//gi, "/photoalbums/").replace(/pictures-thumb/g, "pictures");
          };
          li.querySelectorAll("li.photoAlbum").forEach((albumEl) => {
            const anchor = albumEl.querySelector("a.thumb[href*='photoalbums'], a.name[href*='photoalbums']");
            const href = anchor?.href || "";
            if (!href || seen.has(href)) return;
            const img = albumEl.querySelector("img.thumbImage, img");
            const rawSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.src || "";
            const imageSrc = toFullSrc(rawSrc);
            const label =
              albumEl.querySelector(".name, .albumName")?.textContent?.trim() ||
              img?.alt?.replace(/\s+photo album.*$/i, "").trim() ||
              "";
            const countMatch = albumEl.textContent.match(/(\d+)\s*Photos?/i);
            const photoCount = countMatch ? Number(countMatch[1]) : undefined;
            seen.add(href);
            albums.push({ label, href, imageSrc, photoCount });
          });
          if (albums.length) {
            scrapedModules.push({
              type: "photo_albums",
              title: moduleTitle || "Photo Albums",
              albums,
              region,
            });
            continue;
          }
        }

        if (moduleInner?.classList.contains("imageModule")) {
          const img = li.querySelector("img.thumbImage, img");
          const src = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (src && !/logo|icon|spacer|pixel|ecatholic-logo|powered-by-ecatholic/i.test(src)) {
            scrapedModules.push({
              type: "image",
              title: moduleTitle,
              src: src.replace(/pictures-thumb/g, "pictures"),
              alt: img?.alt || "",
              region,
            });
            continue;
          }
        }

        if (moduleInner?.classList.contains("embedModule")) {
          const iframe = moduleInner.querySelector("iframe");
          const embedUrl =
            iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
          const body = moduleInner.querySelector(".moduleBody");
          const html = body?.innerHTML?.trim() || "";
          const heightAttr = iframe?.getAttribute("height");
          const height = heightAttr ? parseInt(heightAttr, 10) || 400 : 400;
          if (embedUrl || html) {
            scrapedModules.push({
              type: "embed",
              title: moduleTitle || iframe?.getAttribute("title") || "Embed",
              embedUrl,
              html: embedUrl ? "" : html,
              height,
              region,
            });
            continue;
          }
        }

        if (moduleInner?.classList.contains("customModule")) {
          const view = li.querySelector(".fr-element.fr-view, .moduleBody .fr-view, .fr-view");
          if (view) {
            const html = normalizeFrViewHtml(view);
            if (html && !isCssNoise(html)) {
              scrapedModules.push({
                type: "text",
                title: moduleTitle,
                html,
                region,
              });
              continue;
            }
          }
        }

      /** eCatholic staff/people modules (.peopleModule) have no .fr-view */
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
          scrapedModules.push({
            type: "people",
            title: moduleTitle,
            people,
            region,
          });
          continue;
        }
      }

      /** eCatholic YouTube/Vimeo modules use .youtubeModule / .vimeoModule — no .fr-view */
      const mediaInner = li.querySelector(
        ".moduleInner.youtubeModule, .moduleInner.vimeoModule, .youtubeModule, .vimeoModule",
      );
      if (mediaInner) {
        let embedUrl = "";
        let source = mediaInner.classList.contains("vimeoModule") ? "vimeo" : "youtube";

        const iframe = mediaInner.querySelector(
          'iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[data-src*="youtube"], iframe[data-src*="vimeo"]',
        );
        const iframeSrc =
          iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
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
          scrapedModules.push({
            type: "video",
            title: moduleTitle || "Video",
            source,
            embedUrl,
            region,
          });
          continue;
        }
      }

      if (moduleInner) {
        if (moduleInner.classList.contains("facebookModule")) {
          const iframe = moduleInner.querySelector("iframe");
          const src = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
          const pageLink = moduleInner.querySelector('a[href*="facebook.com"]');
          scrapedModules.push({
            type: "facebook",
            title: moduleTitle || "Facebook",
            pageUrl: pageLink?.href || "",
            embedUrl: src,
            width: 500,
            height: 500,
            region,
          });
          continue;
        }

        if (moduleInner.classList.contains("googleMapsModule")) {
          const iframe = moduleInner.querySelector("iframe");
          const src = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
          if (src) {
            scrapedModules.push({
              type: "google_maps",
              title: moduleTitle || "Map",
              embedUrl: src,
              height: 450,
              region,
            });
            continue;
          }
        }

        if (moduleInner.classList.contains("instagramModule")) {
          const iframe = moduleInner.querySelector("iframe");
          const src = iframe?.getAttribute("src") || iframe?.getAttribute("data-src") || "";
          const postLink = moduleInner.querySelector('a[href*="instagram.com"]');
          scrapedModules.push({
            type: "instagram",
            title: moduleTitle || "Instagram",
            postUrl: postLink?.href || "",
            embedUrl: src,
            height: 480,
            region,
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
          scrapedModules.push({
            type: "rss",
            title: moduleTitle || "RSS Feed",
            feedUrl: feedUrl || link?.href || "",
            maxItems: 10,
            region,
          });
          continue;
        }

        if (moduleInner.classList.contains("customHTMLModule") || moduleInner.classList.contains("htmlModule")) {
          const body = moduleInner.querySelector(".moduleBody, .customHTML, .htmlContent") || moduleInner;
          const html = body.innerHTML?.trim() || "";
          if (html) {
            scrapedModules.push({
              type: "embed",
              title: moduleTitle || "Embed",
              html,
              embedUrl: "",
              height: 400,
              region,
            });
            continue;
          }
        }
      }

      const view = li.querySelector(".fr-element.fr-view, .moduleBody .fr-view, .fr-view");
      if (!view) continue;

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

      const { imgs: viewImgs, text: viewText } = isImageOnly(view);
      if (viewImgs.length && !viewText) {
        for (const img of viewImgs) {
          scrapedModules.push({
            type: "image",
            src: img.getAttribute("src"),
            alt: img.alt || "",
            region,
          });
        }
        continue;
      }

      const people = [];
      const seenPeople = new Set();
      li.querySelectorAll(".peopleModule .person, .peopleModule li.person, .staffMember, .staff-member, .person").forEach((row) => {
        const name =
          row.querySelector(".name span")?.textContent?.trim() ||
          row.querySelector(".name, .personName, h2, h3, strong")?.textContent?.trim() ||
          row.querySelector("a")?.textContent?.trim();
        if (!name || seenPeople.has(name)) return;
        seenPeople.add(name);

        const localMail = row.querySelector(".localMail")?.textContent?.trim() || "";
        const domainMail = row.querySelector(".domainMail")?.textContent?.trim() || "";
        let email = "";
        if (localMail && domainMail) {
          email = `${localMail}@${domainMail}`;
        } else {
          email =
            row.querySelector('a[href^="mailto:"]')?.getAttribute("href")?.replace(/^mailto:/i, "") ||
            row.querySelector('a[href^="mailto:"]')?.textContent?.trim() ||
            "";
        }

        people.push({
          name,
          role:
            row.querySelector(".role, .title, .position")?.textContent?.trim() || "",
          email,
          phone:
            row.querySelector(".phone")?.textContent?.trim() ||
            row.querySelector('a[href^="tel:"]')?.textContent?.trim() ||
            "",
          photo: (() => {
            const photoEl = row.querySelector("img.thumbImage, .thumb img, picture img, img");
            let src = photoEl?.getAttribute("src") || photoEl?.getAttribute("data-src") || "";
            if (!src || /spacer|blank\.gif|placeholder/i.test(src)) return "";
            return src.replace(/pictures-thumb/g, "pictures");
          })(),
        });
      });

      if (people.length) {
        scrapedModules.push({ type: "people", title: moduleTitle, people, region });
        continue;
      }

      const docLinks = [];
      view.querySelectorAll('a[href$=".pdf"], a[href*="/documents/"], a[href*=".doc"], a[href*=".docx"]').forEach((a) => {
        const label = a.textContent.trim();
        if (label && a.href) docLinks.push({ label, url: a.href });
      });
      if (docLinks.length) {
        scrapedModules.push({
          type: "documents",
          title: moduleTitle,
          items: docLinks,
          region,
        });
        continue;
      }

      const iframe = view.querySelector('iframe[src*="vimeo"], iframe[src*="youtube"]');
      if (iframe?.src) {
        scrapedModules.push({
          type: "video",
          title: moduleTitle,
          source: iframe.src.includes("vimeo") ? "vimeo" : "youtube",
          embedUrl: iframe.src,
          region,
        });
        continue;
      }

      const isContentImage = (src) =>
        src && !/logo|icon|spacer|pixel|ecatholic-logo|powered-by-ecatholic/i.test(src);

      const viewClone = view.cloneNode(true);
      viewClone.querySelectorAll("style").forEach((n) => n.remove());

      const seenImages = new Set();
      let textBuffer = [];

      const flushText = () => {
        if (!textBuffer.length) return;
        const combined = textBuffer.join("").trim();
        textBuffer = [];
        if (!isCssNoise(combined)) {
          scrapedModules.push({
            type: "text",
            title: moduleTitle,
            html: combined,
            region,
          });
        }
      };

      const pushImages = (imgs) => {
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (!isContentImage(src)) continue;
          const key = src.split("?")[0];
          if (seenImages.has(key)) continue;
          seenImages.add(key);
          scrapedModules.push({ type: "image", src, alt: img.alt || "", region });
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

      if (scrapedModules.length === 0) {
        const { imgs, text } = isImageOnly(viewClone);
        if (imgs.length && !text) {
          pushImages(imgs);
        } else if (text) {
          const clone = viewClone.cloneNode(true);
          clone.querySelectorAll("img").forEach((el) => el.remove());
          const html = clone.innerHTML.trim();
          if (!isCssNoise(html)) {
            scrapedModules.push({ type: "text", title: moduleTitle, html, region });
          }
        }
      }
    }
    }

    if (isHome) {
      const slides = [];
      const seenSlides = new Set();
      document
        .querySelectorAll("#featureSlideshow img, #featureSlideshow [data-src]")
        .forEach((el) => {
          let src = el.src || el.getAttribute("data-src") || "";
          src = src.replace(/pictures-thumb/g, "pictures");
          if (!src || seenSlides.has(src) || /spacer|blank/i.test(src)) return;
          seenSlides.add(src);
          slides.push({ src, alt: el.alt || "", caption: "" });
        });
      if (slides.length) {
        scrapedModules.unshift({ type: "slideshow", region: "features", slides });
      }
    }

    for (let i = 0; i < scrapedModules.length; i++) {
      scrapedModules[i] = resolveModuleTitle(scrapedModules[i]);
    }

    return { title, modules: scrapedModules, pageSectionTitle, siteName };
  }, { pagePath: path });
}

async function scrapePath(page, path) {
  const url = `${ctx().base}${path}`;
  process.stdout.write(`  Loading ${url} ...\n`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await waitForPageContent(page, path);
  const html = await page.content();
  ctx().noteParishId(detectParishIdFromHtml(html));
  /** YouTube/Vimeo iframes are often injected after initial paint */
  await page
    .locator('.youtubeModule iframe, .vimeoModule iframe, [data-youtube-id], [data-vimeo-id]')
    .first()
    .waitFor({ state: "attached", timeout: 8_000 })
    .catch(() => {});
  await sleep(800);
  const data = await scrapePageDom(page, path);
  if (data.error) throw new Error(`${path}: ${data.error}`);
  data.seo = normalizeScrapedSeo({
    seo: await page.evaluate(extractPageSeoInBrowser),
    title: data.title,
  });
  data.modules = consolidateScrapedModules(data.modules);
  return data;
}

function readManifest() {
  return readManifestFile(ctx().manifestPath).entries;
}

function readManifestMeta() {
  return readManifestFile(ctx().manifestPath).meta;
}

function writeManifestEntry(entry) {
  const { meta, entries } = readManifestFile(ctx().manifestPath);
  const nextMeta = {
    ...meta,
    domain: ctx().base,
    parishId: ctx().parishId || meta.parishId || null,
    siteName: entry.siteName || meta.siteName || null,
  };
  const manifest = entries.filter((e) => e.path !== entry.path);
  manifest.push(entry);
  writeFileSync(
    ctx().manifestPath,
    writeManifestFile({ meta: nextMeta, entries: manifest }),
  );
}

async function saveStorageState(context) {
  try {
    await context.storageState({ path: STORAGE_STATE_PATH });
  } catch {
    /* optional */
  }
}

function importJsonEntry(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const path = raw.path || raw.pathname;
  if (!path) throw new Error("--import-json file must include a path field");
  const pageId = resolvePageId(ctx(), path, raw.pageId);
  const entry = {
    path,
    pageId: pageId || null,
    scrapedAt: new Date().toISOString(),
    title: raw.title || "",
    seo: normalizeScrapedSeo({ seo: raw.seo, title: raw.title }),
    modules: raw.modules || [],
  };
  if (!entry.pageId) {
    console.warn(`  ⚠ ${path}: no page ID yet — will match Firestore slug on apply`);
  }
  writeManifestEntry(entry);
  console.log(`Imported ${path} (${entry.modules.length} modules) into manifest`);
  return entry;
}

async function createBrowserSession({ headed, connect, chromeProfile, siteBase, hostname }) {
  logProgress("[migrate] Starting browser session…");
  const { chromium } = await import("playwright");

  if (connect) {
    const endpoint = connect.startsWith("http") ? connect : `http://127.0.0.1:${connect}`;
    await assertChromeDebugPort(connect, siteBase);
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No browser context at ${endpoint} — open Chrome with remote debugging first`);
    const page = await resolveScrapePage(context, hostname);
    logProgress(`[migrate] Connected to Chrome at ${endpoint} (tab: ${page.url()})`);
    return {
      kind: "cdp",
      browser,
      context,
      page,
      async close() {
        try {
          await Promise.race([
            browser.close(),
            sleep(5_000).then(() => {
              logProgress("[migrate] Chrome disconnect timed out — continuing.");
            }),
          ]);
        } catch {
          /* optional */
        }
        logProgress("[migrate] Disconnected from Chrome (left running).");
      },
    };
  }

  if (headed) {
    process.stdout.write(`Launching Google Chrome (profile: ${chromeProfile})...\n`);
    process.stdout.write(
      "If this is your first run, pass Cloudflare once in the Chrome window — the profile is saved.\n",
    );
    const context = await chromium.launchPersistentContext(chromeProfile, {
      channel: "chrome",
      headless: false,
      viewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      args: ["--disable-blink-features=AutomationControlled"],
    });
    return {
      kind: "persistent",
      browser: context,
      context,
      page: context.pages()[0] || (await context.newPage()),
      async close() {
        await context.close();
        process.stdout.write("Chrome closed.\n");
      },
    };
  }

  const hasState = existsSync(STORAGE_STATE_PATH);
  process.stdout.write(
    `Launching Playwright Chromium (headless${hasState ? ", saved cookies" : ""}) — often blocked by Cloudflare.\n`,
  );
  const browser = await chromium.launch({ headless: true, timeout: 20_000 });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ...(hasState ? { storageState: STORAGE_STATE_PATH } : {}),
  });
  return {
    kind: "chromium",
    browser,
    context,
    page: await context.newPage(),
    async close() {
      await saveStorageState(context);
      await browser.close();
      process.stdout.write("Browser closed.\n");
    },
  };
}

async function withBrowser(paths, sessionOpts, fn) {
  const session = await createBrowserSession(sessionOpts);
  const { page, context } = session;

  if (sessionOpts.headed && !sessionOpts.connect) {
    /** Only block heavy assets for automated Chromium; real Chrome needs normal requests. */
  } else if (!sessionOpts.connect) {
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["font", "media"].includes(type)) return route.abort();
      return route.continue();
    });
  }

  try {
    return await fn(page, paths, context, session);
  } finally {
    await session.close();
  }
}

async function scrapePaths(paths, sessionOpts) {
  const { force, continueOnError } = sessionOpts;
  const manifest = readManifest();
  const scrapedPaths = new Set(manifest.map((e) => e.path));
  const toScrape = force ? paths : paths.filter((p) => !scrapedPaths.has(p));
  const skipped = paths.length - toScrape.length;
  if (skipped) {
    console.log(`Skipping ${skipped} path(s) already in manifest (use --force to re-scrape).`);
  }
  if (!toScrape.length) {
    console.log("Nothing to scrape.");
    return manifest.filter((e) => paths.includes(e.path));
  }

  return withBrowser(toScrape, sessionOpts, async (page, pathList, context, session) => {
    const results = [];
    const total = pathList.length;
    for (let i = 0; i < pathList.length; i++) {
      const path = pathList[i];
      logProgress(`[migrate] Scraping ${i + 1}/${total}: ${path}`);
      try {
        const data = await scrapePath(page, path);
        const entry = {
          path,
          pageId: resolvePageId(ctx(), path, null),
          scrapedAt: new Date().toISOString(),
          ...data,
        };
        if (!entry.pageId) {
          console.warn(`  ⚠ ${path}: no Firestore page match — scraped to manifest only`);
        }
        writeManifestEntry(entry);
        if (session.kind !== "cdp") await saveStorageState(context);
        console.log(`  → ${data.modules.length} modules saved to manifest`);
        results.push(entry);
        if (pathList.length > 1) await sleep(2500);
      } catch (err) {
        console.error(`  ✗ ${path}: ${err.message}`);
        if (/cloudflare|timed out|just a moment/i.test(err.message) && !sessionOpts.connect) {
          printCloudflareHelp(ctx().base);
        }
        if (!continueOnError) throw err;
      }
    }
    return results;
  });
}

async function scrapedToFirestoreModules(
  scrapedModules,
  storage,
  { dryRun, uploadImages, page, db, publish, albumPageCache },
) {
  const firestoreModules = [];
  const orderByRegion = {};
  const imageUrlCache = new Map();

  const nextOrder = (region) => {
    orderByRegion[region] = orderByRegion[region] ?? 0;
    return orderByRegion[region]++;
  };

  for (const mod of scrapedModules) {
    const region = mod.region || "content-1";

    if (mod.type === "text") {
      firestoreModules.push({
        id: generateId(),
        type: "text",
        region,
        order: nextOrder(region),
        config: { title: mod.title || "", html: mod.html },
      });
    } else if (mod.type === "links") {
      firestoreModules.push({
        id: generateId(),
        type: "links",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Links",
          items: (mod.items || []).map((item) => ({
            label: item.label,
            href: resolveMigratedHref(item.href || item.url || "/", migrationCtx),
          })),
        },
      });
    } else if (mod.type === "photo_albums") {
      const albums = [];
      for (const album of mod.albums || []) {
        if (uploadImages && db && page) {
          const imported = await importPhotoAlbum(album, {
            db,
            storage,
            browserPage: page,
            publish,
            dryRun,
            albumPageCache,
            urlCache: imageUrlCache,
          });
          albums.push({
            label: album.label || "",
            href: imported.href,
            imageSrc: imported.imageSrc,
            photoCount: imported.photoCount ?? album.photoCount,
          });
        } else {
          albums.push({
            label: album.label || "",
            href: album.href || "/",
            imageSrc: uploadImages
              ? await resolveUploadedImageUrl(
                  album.imageSrc,
                  album.label,
                  { dryRun, storage, uploadImages, page },
                  imageUrlCache,
                )
              : album.imageSrc,
            photoCount: album.photoCount,
          });
        }
      }
      firestoreModules.push({
        id: generateId(),
        type: "photo_albums",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Photo Albums",
          albums,
        },
      });
    } else if (mod.type === "gallery") {
      const images = [];
      for (const img of mod.images || []) {
        images.push({
          src: await resolveUploadedImageUrl(
            img.src,
            img.alt,
            { dryRun, storage, uploadImages, page },
            imageUrlCache,
          ),
          alt: img.alt || "",
        });
      }
      firestoreModules.push({
        id: generateId(),
        type: "gallery",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Gallery",
          images,
        },
      });
    } else if (mod.type === "slideshow") {
      const slides = [];
      for (const slide of mod.slides || []) {
        slides.push({
          src: await resolveUploadedImageUrl(
            slide.src,
            slide.alt,
            { dryRun, storage, uploadImages, page },
            imageUrlCache,
          ),
          alt: slide.alt || "",
          caption: slide.caption || "",
        });
      }
      firestoreModules.push({
        id: generateId(),
        type: "slideshow",
        region: "features",
        order: nextOrder("features"),
        config: { slides },
      });
    } else if (mod.type === "image") {
      const downloadUrl = await resolveUploadedImageUrl(
        mod.src,
        mod.alt,
        { dryRun, storage, uploadImages, page },
        imageUrlCache,
      );
      firestoreModules.push({
        id: generateId(),
        type: "image",
        region,
        order: nextOrder(region),
        config: { title: mod.alt || mod.title || "", src: downloadUrl, alt: mod.alt || "", caption: "" },
      });
    } else if (mod.type === "people") {
      firestoreModules.push({
        id: generateId(),
        type: "people",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Staff",
          people: mod.people.map((p) => {
            const person = {
              id: generateId(),
              name: p.name,
              role: p.role || "",
              email: p.email || "",
              phone: p.phone || "",
            };
            const photoUrl = resolvePersonPhotoUrl(p.photo || p.photoUrl);
            if (photoUrl) person.photoUrl = photoUrl;
            return person;
          }),
        },
      });
    } else if (mod.type === "documents") {
      const items = [];
      for (const item of mod.items || []) {
        items.push({
          label: item.label || "",
          url: await resolveUploadedFileUrl(
            item.url,
            { dryRun, storage, uploadImages, page, folder: DOCUMENTS_FOLDER },
            imageUrlCache,
          ),
        });
      }
      firestoreModules.push({
        id: generateId(),
        type: "documents",
        region,
        order: nextOrder(region),
        config: { title: mod.title || "Documents", items },
      });
    } else if (mod.type === "video") {
      firestoreModules.push({
        id: generateId(),
        type: "video",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Video",
          source: mod.source,
          embedUrl: mod.embedUrl,
          url: "",
        },
      });
    } else if (mod.type === "embed") {
      firestoreModules.push({
        id: generateId(),
        type: "embed",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Embed",
          embedUrl: mod.embedUrl || "",
          html: mod.html || "",
          height: mod.height || 400,
        },
      });
    } else if (mod.type === "facebook") {
      firestoreModules.push({
        id: generateId(),
        type: "facebook",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Facebook",
          pageUrl: mod.pageUrl || "",
          embedUrl: mod.embedUrl || "",
          width: mod.width || 500,
          height: mod.height || 500,
        },
      });
    } else if (mod.type === "google_maps") {
      firestoreModules.push({
        id: generateId(),
        type: "google_maps",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Map",
          embedUrl: mod.embedUrl || "",
          height: mod.height || 450,
        },
      });
    } else if (mod.type === "instagram") {
      firestoreModules.push({
        id: generateId(),
        type: "instagram",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "Instagram",
          postUrl: mod.postUrl || "",
          embedUrl: mod.embedUrl || "",
          height: mod.height || 480,
        },
      });
    } else if (mod.type === "rss") {
      firestoreModules.push({
        id: generateId(),
        type: "rss",
        region,
        order: nextOrder(region),
        config: {
          title: mod.title || "RSS Feed",
          feedUrl: mod.feedUrl || "",
          maxItems: mod.maxItems || 10,
        },
      });
    }
  }

  return firestoreModules;
}

function appendSpecialModules(pageId, modules) {
  if (pageId === "page_mig_live_streaming") {
    modules.push({
      id: generateId(),
      type: "zoom",
      region: "content-1",
      order: modules.length,
      config: {
        title: "Live Streaming",
        meetingId: "99344974746",
        password: "HolyMass",
        joinUrl:
          "https://us06web.zoom.us/j/99344974746?pwd=QXlJVWgxRTZDMnVpdzdNZWorQ0g0Zz09",
        instructions:
          "St. Edward/St. Francis of Assisi/Visitation is live streaming the 10 am Sunday Mass in Verboort every week.",
        schedule: [{ id: "sched_default", day: "sunday", time: "10:00" }],
      },
    });
  }

  if (pageId === "page_mig_calendar") {
    modules.length = 0;
    modules.push({
      id: generateId(),
      type: "calendar",
      region: "content-1",
      order: 0,
      config: {
        title: "Parish Calendar",
        source: "google",
        googleCalendarId: "churchsecretary@vcsknights.org",
        maxEvents: 30,
      },
    });
  }

  if (pageId === ctx().homePageId) {
    const col2Count = () => modules.filter((m) => m.region === "content-2").length;
    if (!modules.some((m) => m.type === "mass_times")) {
      modules.push({
        id: generateId(),
        type: "mass_times",
        region: "content-2",
        order: col2Count(),
        config: { title: "Mass Times", useSiteDefaults: true },
      });
    }
    if (!modules.some((m) => m.type === "calendar")) {
      modules.push({
        id: generateId(),
        type: "calendar",
        region: "content-2",
        order: col2Count(),
        config: {
          title: "Calendar",
          source: "google",
          googleCalendarId: "churchsecretary@vcsknights.org",
          maxEvents: 30,
        },
      });
    }
  }

  return modules;
}

const BULLETINS_PAGE_ID = "page_mig_bulletins";

async function ensureBulletinsPage(db) {
  const pagesSnap = await db.collection("pages").listAll();
  let bulletinsPageId = null;
  for (const { id, data } of pagesSnap) {
    if (data.pageType === "bulletins") {
      bulletinsPageId = id;
      break;
    }
  }

  const pageId = bulletinsPageId || BULLETINS_PAGE_ID;
  const now = new Date().toISOString();

  if (!bulletinsPageId) {
    const pageData = {
      slug: "bulletins",
      title: "Bulletins",
      pageType: "bulletins",
      status: "published",
      layout: "default",
      contentColumns: 1,
      maxModulesPerRegion: 15,
      contentMarginX: "md",
      regions: [{ id: "content-1", modules: [] }],
      seo: { title: "Bulletins" },
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      publishedSnapshot: {
        slug: "bulletins",
        layout: "default",
        title: "Bulletins",
        seo: { title: "Bulletins" },
        regions: [{ id: "content-1", modules: [] }],
      },
    };
    await db.collection("pages").doc(pageId).set(pageData);
    logProgress(`[migrate] Created bulletins page (${pageId}).`);
  }

  ctx().pageMap["/bulletins"] = pageId;
  notePageInContext("/bulletins", pageId);
  return pageId;
}

async function buildPublicHrefByEcPath(db) {
  const map = {};
  const ecPaths = new Set([...Object.keys(ctx().pageMap), "/bulletins"]);

  for (const ecPath of ecPaths) {
    const pageId =
      ctx().pageMap[ecPath] ||
      ctx().firestorePageMap?.byPath?.[ecPath] ||
      null;
    if (!pageId) continue;

    const snap = await db.collection("pages").doc(pageId).get();
    if (!snap.exists) continue;

    const slug = snap.data().slug ?? "";
    map[ecPath] = slug === "" ? "/" : `/${slug}`;
  }

  migrationCtx.publicHrefByEcPath = map;
  return map;
}

async function rewriteInternalLinkHrefs(db) {
  if (!migrationCtx.publicHrefByEcPath || !Object.keys(migrationCtx.publicHrefByEcPath).length) {
    await buildPublicHrefByEcPath(db);
  }

  const pages = await db.collection("pages").listAll();
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const { id, data } of pages) {
    const regions = JSON.parse(JSON.stringify(data.regions || []));
    let changed = false;

    for (const region of regions) {
      for (const mod of region.modules || []) {
        if (mod.type === "links" && mod.config?.items) {
          for (const item of mod.config.items) {
            const href = item.href || item.url || "";
            const next = resolveMigratedHref(href, migrationCtx);
            if (next && next !== href) {
              if (item.href !== undefined) item.href = next;
              else item.url = next;
              changed = true;
            }
          }
        }
        if (mod.type === "buttons" && mod.config?.items) {
          for (const item of mod.config.items) {
            const href = item.href || "/";
            const next = resolveMigratedHref(href, migrationCtx);
            if (next && next !== href) {
              item.href = next;
              changed = true;
            }
          }
        }
      }
    }

    if (!changed) continue;

    const patch = { regions, updatedAt: now };
    if (data.status === "published" && data.publishedSnapshot) {
      patch.publishedSnapshot = { ...data.publishedSnapshot, regions };
    }
    await db.collection("pages").doc(id).update(patch);
    updatedCount += 1;
  }

  if (updatedCount) {
    logProgress(`[migrate] Rewrote internal link hrefs on ${updatedCount} page(s).`);
  }
}

async function importEcatholicNav(db, sessionOpts) {
  logProgress("[migrate] Importing navigation from eCatholic…");
  await ensureBulletinsPage(db);

  return withBrowser([], sessionOpts, async (page) => {
    await page.goto(ctx().base, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await sleep(800);

    const scraped = await page.evaluate(scrapeEcatholicNavInBrowser);
    if (!scraped.items?.length) {
      console.warn("[migrate] No navigation items found in #nav — skipping nav import.");
      return 0;
    }

    const flatNodes = [];
    const usedPageIds = new Set();
    const usedPaths = new Set();

    const normalizeNavPath = (href) => {
      if (!href || href === "/") return href || "/";
      return href.replace(/\/$/, "") || "/";
    };

    /** Prefer real Firestore page IDs (never synthetic page_mig_* placeholders). */
    const resolveExistingPageId = (path) => {
      const existing = ctx().firestorePageMap?.existingIds;
      const candidates = [
        ctx().firestorePageMap?.byPath[path],
        ctx().pageMap[path],
        resolvePageId(ctx(), path, null),
      ].filter(Boolean);

      if (existing) {
        const match = candidates.find((id) => existing.has(id));
        if (match) return match;
        return null;
      }

      return candidates[0] || null;
    };

    const getNavFullSlug = (nodeId) => {
      const chain = [];
      let current = flatNodes.find((node) => node.id === nodeId);
      while (current) {
        chain.unshift(current);
        current = current.parentId
          ? flatNodes.find((node) => node.id === current.parentId)
          : null;
      }
      return chain
        .map((node) => node.slug)
        .filter((slug) => slug !== undefined && slug !== null && slug !== "")
        .join("/");
    };

    const addPageNode = (path, title, parentId, order) => {
      const normalizedPath = normalizeNavPath(path);
      if (usedPaths.has(normalizedPath)) return false;

      const pageId = resolveExistingPageId(normalizedPath);
      if (!pageId || usedPageIds.has(pageId)) return false;

      const sourceSlug = pathToSlug(normalizedPath);
      const parentPrefix = parentId ? getNavFullSlug(parentId) : "";

      let localSlug;
      if (normalizedPath === "/" || sourceSlug === "") {
        localSlug = "";
      } else if (parentPrefix && sourceSlug === parentPrefix) {
        localSlug = "";
      } else if (parentPrefix && sourceSlug.startsWith(`${parentPrefix}/`)) {
        localSlug = sourceSlug.slice(parentPrefix.length + 1);
      } else if (parentPrefix && !sourceSlug.includes("/")) {
        localSlug = sourceSlug;
      } else {
        localSlug = sourceSlug.includes("/") ? sourceSlug.split("/").pop() : sourceSlug;
      }

      flatNodes.push({
        id: generateId(),
        type: "page",
        title: title || titleFromPath(normalizedPath) || "Page",
        slug: localSlug,
        parentId,
        order,
        pageId,
        isQuickLink: false,
      });
      usedPageIds.add(pageId);
      usedPaths.add(normalizedPath);
      return true;
    };

    const addLinkNode = (externalUrl, title, parentId, order) => {
      const url = (externalUrl || "").trim();
      if (!url) return false;

      flatNodes.push({
        id: generateId(),
        type: "link",
        title: title || "Link",
        externalUrl: url,
        parentId,
        order,
        isQuickLink: false,
      });
      return true;
    };

    const homePageId =
      ctx().firestorePageMap?.byPath["/"] ||
      ctx().firestorePageMap?.bySlug[""] ||
      ctx().homePageId ||
      ctx().pageMap["/"] ||
      null;

    let homeNavId = null;
    let nextRootOrder = 0;

    const ensureHomeNavNodeInFlat = () => {
      if (
        !homePageId ||
        homeNavId ||
        !ctx().firestorePageMap?.existingIds?.has(homePageId)
      ) {
        return homeNavId;
      }

      homeNavId = generateId();
      flatNodes.push({
        id: homeNavId,
        type: "page",
        title: "Home",
        slug: "",
        parentId: null,
        order: nextRootOrder++,
        pageId: homePageId,
        isQuickLink: false,
      });
      usedPageIds.add(homePageId);
      usedPaths.add("/");
      return homeNavId;
    };

    const nextOrder = (parentId, localOrder) =>
      (parentId ?? null) === null ? nextRootOrder++ : localOrder;

    const countSectionPages = (items) => {
      let count = 0;
      for (const entry of items) {
        if (entry.isExternal && entry.externalUrl) {
          count += 1;
          continue;
        }
        if (entry.isGroup && entry.children?.length) {
          count += countSectionPages(entry.children);
          continue;
        }
        if (entry.path) count += 1;
      }
      return count;
    };

    const sectionContainsPath = (items, targetPath) => {
      for (const entry of items) {
        if (entry.path && normalizeNavPath(entry.path) === targetPath) return true;
        if (entry.isGroup && entry.children?.length && sectionContainsPath(entry.children, targetPath)) {
          return true;
        }
      }
      return false;
    };

    const walk = (items, parentId, startOrder = 0) => {
      let order = startOrder;
      for (const item of items) {
        const path = item.path || null;

        if (item.isGroup && item.children?.length) {
          const rawPath = path ? normalizeNavPath(path) : null;
          const landingPath = rawPath && rawPath !== "/" ? rawPath : null;

          // Nest eCatholic Home children (e.g. Church Sound System) under bootstrap Home.
          if (!parentId && rawPath === "/") {
            const homeId = ensureHomeNavNodeInFlat();
            walk(item.children, homeId);
            continue;
          }

          // eCatholic often wraps section pages in a title-only sub-group (no link).
          if (!landingPath && parentId) {
            const inferredPath = `/${slugifyNavTitle(item.title)}`;
            if (
              inferredPath !== "/" &&
              resolveExistingPageId(inferredPath) &&
              !usedPaths.has(inferredPath)
            ) {
              addPageNode(inferredPath, item.title, parentId, nextOrder(parentId, order++));
            }
            walk(item.children, parentId);
            continue;
          }

          const groupId = generateId();
          const groupSlug = landingPath
            ? linkGroupSlug(item.title, landingPath)
            : slugifyNavTitle(item.title);
          const sectionPageCount = countSectionPages(item.children);
          const attachLandingToGroup =
            landingPath &&
            linkGroupUsesLandingPage(item.title, landingPath) &&
            sectionPageCount <= 1;
          const landingPageId = attachLandingToGroup
            ? resolveExistingPageId(landingPath)
            : null;

          flatNodes.push({
            id: groupId,
            type: "group",
            title: item.title || "Section",
            slug: groupSlug,
            parentId,
            order: nextOrder(parentId, order++),
            pageId: landingPageId,
            isQuickLink: false,
          });

          if (landingPageId) {
            usedPageIds.add(landingPageId);
            usedPaths.add(landingPath);
          }

          let childOrder = 0;
          if (
            landingPath &&
            !attachLandingToGroup &&
            !sectionContainsPath(item.children, landingPath)
          ) {
            const landingPageIdForChild = resolveExistingPageId(landingPath);
            if (landingPageIdForChild && !usedPageIds.has(landingPageIdForChild)) {
              addPageNode(landingPath, item.title, groupId, childOrder++);
            }
          }

          const childItems =
            landingPath && attachLandingToGroup
              ? item.children.filter(
                  (child) => normalizeNavPath(child.path) !== landingPath,
                )
              : item.children;

          walk(childItems, groupId, childOrder);
          continue;
        }

        if (item.isExternal && item.externalUrl) {
          addLinkNode(item.externalUrl, item.title, parentId, nextOrder(parentId, order++));
          continue;
        }

        if (path) {
          addPageNode(path, item.title, parentId, nextOrder(parentId, order++));
        }
      }
    };

    walk(scraped.items, null);

    let nodesToWrite = flatNodes;
    if (homePageId && ctx().firestorePageMap?.existingIds?.has(homePageId) && !homeNavId) {
      nodesToWrite = ensureHomeNavNodes(flatNodes, homePageId);
    }

    const getFinalFullSlug = (nodeId) => {
      const chain = [];
      let current = nodesToWrite.find((node) => node.id === nodeId);
      while (current) {
        chain.unshift(current);
        current = current.parentId
          ? nodesToWrite.find((node) => node.id === current.parentId)
          : null;
      }
      return chain
        .map((node) => node.slug)
        .filter((slug) => slug !== undefined && slug !== null && slug !== "")
        .join("/");
    };

    const existing = await db.collection("navNodes").listAll();
    for (const { id } of existing) {
      await db.collection("navNodes").doc(id).delete();
    }

    for (const node of nodesToWrite) {
      await db.collection("navNodes").doc(node.id).set(node);
    }

    const now = new Date().toISOString();
    for (const node of nodesToWrite) {
      if (!node.pageId) continue;
      if (node.type !== "page" && node.type !== "group") continue;

      const fullSlug = getFinalFullSlug(node.id);
      const ref = db.collection("pages").doc(node.pageId);
      const snap = await ref.get();
      if (!snap.exists) continue;

      const data = snap.data();
      const patch = { slug: fullSlug, updatedAt: now };
      if (data.status === "published" && data.publishedSnapshot) {
        patch.publishedSnapshot = { ...data.publishedSnapshot, slug: fullSlug };
      }
      await ref.update(patch);

      const navPath = fullSlug === "" ? "/" : `/${fullSlug}`;
      if (migrationCtx.firestorePageMap) {
        migrationCtx.firestorePageMap.byPath[navPath] = node.pageId;
        migrationCtx.firestorePageMap.bySlug[fullSlug] = node.pageId;
      }
    }

    await buildPublicHrefByEcPath(db);
    await rewriteInternalLinkHrefs(db);

    logProgress(`[migrate] Navigation imported (${nodesToWrite.length} nodes, page slugs synced).`);
    return nodesToWrite.length;
  });
}

async function importEcatholicBulletinPdfs(opts, sessionOpts) {
  const { runEcatholicBulletinImport } = await import("./import-ecatholic-bulletins.mjs");
  const sourceUrl = `${ctx().base.replace(/\/$/, "")}/bulletins`;
  const manifestPath = join(
    __dirname,
    `.bulletin-manifest-${ctx().hostname.replace(/\./g, "-")}.json`,
  );

  logProgress("[migrate] Importing bulletin PDFs from eCatholic…");
  const summary = await runEcatholicBulletinImport({
    dryRun: opts.dryRun,
    headed: opts.headed,
    connect: opts.connect ?? sessionOpts.connect,
    sourceUrl,
    manifestPath,
    fromManifest: null,
    limit: null,
    writeManifest: true,
  });

  if (summary.failed > 0) {
    console.warn(`[migrate] Bulletin import finished with ${summary.failed} failure(s).`);
  }
  return summary;
}

/** @param {object[]} nodes @param {string} homePageId */
function ensureHomeNavNodes(nodes, homePageId) {
  let result = nodes.filter(
    (n) =>
      !(
        (n.parentId ?? null) === null &&
        n.type === "group" &&
        /^home$/i.test(n.title || "") &&
        !n.pageId
      ),
  );

  if (result.some((n) => n.type === "page" && (n.parentId ?? null) === null && (n.slug === "" || n.slug === undefined))) {
    return result;
  }

  result = result.map((n) =>
    (n.parentId ?? null) === null ? { ...n, order: (n.order ?? 0) + 1 } : n,
  );

  result.unshift({
    id: generateId(),
    type: "page",
    title: "Home",
    slug: "",
    parentId: null,
    order: 0,
    pageId: homePageId,
    isQuickLink: false,
  });

  return result;
}

function notePageInContext(path, pageId) {
  const slug = pathToSlug(path);
  if (!migrationCtx.firestorePageMap) {
    migrationCtx.firestorePageMap = { byPath: {}, bySlug: {}, existingIds: new Set() };
  }
  migrationCtx.firestorePageMap.byPath[path] = pageId;
  migrationCtx.firestorePageMap.bySlug[slug] = pageId;
  migrationCtx.firestorePageMap.existingIds.add(pageId);
  if (path === "/") {
    migrationCtx.homePageId = pageId;
  }
}

async function applyEntry(db, storage, entry, { dryRun, publish, mergeHome, uploadImages, page, albumPageCache }) {
  const mappedId = entry.pageId || ctx().pageMap[entry.path] || null;
  let pageId = resolvePageId(ctx(), entry.path, entry.pageId);
  if (!pageId) {
    pageId = pageIdForPath(ctx(), entry.path);
  }
  if (!pageId || ctx().skipPageIds.has(pageId)) {
    console.log(`Skipping ${entry.path}${pageId ? ` (${pageId})` : " — no page ID"}`);
    return;
  }

  if (
    mappedId &&
    pageId !== mappedId &&
    ctx().firestorePageMap?.existingIds?.has(pageId)
  ) {
    logProgress(`[migrate] ${entry.path}: using existing page ${pageId} (map referenced missing ${mappedId})`);
  }

  const layout = layoutFor(pageId);
  let regions = emptyRegions(pageId);
  const scraped = consolidateScrapedModules(fillMissingModuleTitles({ ...entry, modules: [...(entry.modules || [])] }).modules);
  let modules = await scrapedToFirestoreModules(scraped, storage, {
    dryRun,
    uploadImages,
    page,
    db,
    publish,
    albumPageCache,
  });
  modules = appendSpecialModules(pageId, modules);

  if (pageId === ctx().homePageId && mergeHome) {
    const ref = db.collection("pages").doc(pageId);
    const snap = await ref.get();
    const existing = snap.data()?.regions || [];
    const content1 = existing.find((r) => r.id === "content-1")?.modules || [];
    const sidebar = existing.find((r) => r.id === "sidebar")?.modules || [];
    const features = existing.find((r) => r.id === "features")?.modules || [];
    const content2 = existing.find((r) => r.id === "content-2")?.modules || [];
    regions = [
      { id: "sidebar", modules: sidebar },
      { id: "content-1", modules: [...content1] },
      { id: "features", modules: features },
      { id: "content-2", modules: content2 },
    ];
    for (const mod of modules) {
      const regionId = mod.region || "content-1";
      let region = regions.find((r) => r.id === regionId);
      if (!region) {
        region = { id: regionId, modules: [] };
        regions.push(region);
      }
      mod.order = region.modules.length;
      region.modules.push(mod);
    }
  } else {
    for (const mod of modules) {
      const regionId = mod.region || "content-1";
      let region = regions.find((r) => r.id === regionId);
      if (!region) {
        region = { id: regionId, modules: [] };
        regions.push(region);
      }
      mod.order = region.modules.length;
      region.modules.push(mod);
    }
  }

  const pageTitle = resolveEntryTitle(entry);

  const updates = {
    layout,
    contentColumns: pageId === ctx().homePageId ? 2 : 1,
    maxModulesPerRegion: 15,
    contentMarginX: "md",
    regions,
    updatedAt: new Date().toISOString(),
  };

  if (pageTitle && pageId !== ctx().homePageId) {
    updates.title = pageTitle;
  }

  const seo = normalizeScrapedSeo({ seo: entry.seo, title: pageTitle });
  if (seo) {
    updates.seo = seo;
  }

  if (dryRun) {
    console.log(`[dry-run] ${pageId} (${entry.path}): ${modules.length} modules`);
    if (seo) {
      console.log(`  seo title: ${seo.title || "(empty)"}`);
      if (seo.description) {
        const preview =
          seo.description.length > 120 ? `${seo.description.slice(0, 120)}…` : seo.description;
        console.log(`  seo description: ${preview}`);
      } else {
        console.log("  seo description: (empty)");
      }
    }
    for (const m of modules) {
      if (m.type === "text") {
        const preview = m.config.html.replace(/\s+/g, " ").slice(0, 100);
        console.log(`  text: ${preview}...`);
      } else {
        console.log(`  ${m.type}: ${m.config.src?.slice(0, 70) || m.config.title || ""}`);
      }
    }
    return;
  }

  const ref = db.collection("pages").doc(pageId);
  const exists = (await ref.get()).exists;
  const slug = pathToSlug(entry.path);
  const now = new Date().toISOString();

  if (!exists) {
    const pageData = {
      slug,
      title: pageTitle || titleFromPath(entry.path) || "Page",
      status: publish ? "published" : "draft",
      ...updates,
      createdAt: now,
    };
    if (publish) {
      pageData.publishedSnapshot = buildPublishedSnapshot(pageData);
      pageData.publishedAt = now;
      pageData.scheduledPublishAt = null;
    }
    await ref.set(pageData);
    notePageInContext(entry.path, pageId);
    console.log(
      `Created ${pageId} (${entry.path}): ${modules.length} modules${publish ? " [published]" : ""}`,
    );
    return;
  }

  await ref.update(updates);

  if (publish) {
    const data = (await ref.get()).data();
    await ref.update({
      status: "published",
      publishedSnapshot: buildPublishedSnapshot({ ...data, ...updates }),
      publishedAt: now,
      scheduledPublishAt: null,
    });
  }

  console.log(`Applied ${pageId} (${entry.path}): ${modules.length} modules${publish ? " [published]" : ""}`);
}

async function bootstrapMigrationContext(opts) {
  loadEnvFile(join(ROOT, ".env.local"));
  loadEnvFile(join(ROOT, ".env"));

  let domain = opts.domain || null;
  let manifestPath = opts.manifestPath || null;

  if (!domain && opts.fromManifest && typeof opts.fromManifest === "string") {
    const { meta } = readManifestFile(opts.fromManifest);
    domain = meta.domain || domain;
    manifestPath = manifestPath || opts.fromManifest;
  }

  if (!domain) {
    throw new Error(
      "Pass --domain www.yourparish.org (or --from-manifest <file> with meta.domain saved in the manifest)",
    );
  }

  const base = normalizeDomain(domain);
  manifestPath = manifestPath || manifestPathForDomain(__dirname, base);

  const pageMapPath =
    opts.pageMapPath || defaultPageMapPath(__dirname, base) || null;
  const pageMapConfig = pageMapPath ? loadPageMapFile(pageMapPath) : null;

  migrationCtx = createMigrationContext({
    domain: base,
    parishId: opts.parishId,
    pageMapConfig,
    manifestPath,
    scriptsDir: __dirname,
  });

  if (pageMapPath) {
    logProgress(`[migrate] Loaded page map from ${pageMapPath} (${migrationCtx.paths.length} paths)`);
  }

  const savedMeta = readManifestFile(migrationCtx.manifestPath).meta;
  if (savedMeta.parishId) migrationCtx.noteParishId(savedMeta.parishId);
  if (savedMeta.domain && !opts.domain) {
    logProgress(`[migrate] Using domain from manifest: ${savedMeta.domain}`);
  }

  logProgress(`[migrate] Site: ${migrationCtx.base}`);
  logProgress(`[migrate] Manifest: ${migrationCtx.manifestPath}`);

  return migrationCtx;
}

async function resolveScrapePathList(opts) {
  if (opts.path) return [opts.path];

  if (opts.applyAll && !opts.applyOnly) {
    if (migrationCtx.paths.length) return migrationCtx.paths;

    logProgress("[migrate] No page map paths — discovering from site navigation…");
    const discovered = await withBrowser([], {
      headed: opts.headed,
      connect: opts.connect,
      chromeProfile: opts.chromeProfile,
      siteBase: migrationCtx.base,
      hostname: migrationCtx.hostname,
      force: opts.force,
      continueOnError: opts.continueOnError,
    }, async (page) => discoverEcatholicPaths(page, migrationCtx.base));

    migrationCtx.setPaths(discovered);
    logProgress(`[migrate] Discovered ${discovered.length} path(s)`);
    return discovered;
  }

  return null;
}

/** Batch apply (full transfer): all pages, not a single --path run. */
function isBatchApply(opts) {
  return Boolean(
    opts.apply && !opts.path && (opts.applyAll || opts.applyOnly || opts.fromManifest),
  );
}

function shouldRunBulletinImport(opts) {
  if (opts.skipImportBulletins || opts.dryRun || !opts.apply) return false;
  if (!ctx().pageMap["/bulletins"]) return false;
  if (opts.importBulletins) return true;
  return isBatchApply(opts);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await bootstrapMigrationContext(opts);

  if (opts.applyOnly) {
    opts.fromManifest = opts.fromManifest || migrationCtx.manifestPath;
  }

  if (opts.importJson) {
    const entry = importJsonEntry(opts.importJson);
    if (!opts.apply && !opts.dryRun) {
      console.log("Imported. Re-run with --apply to write to Firestore.");
      return;
    }
    opts.fromManifest = migrationCtx.manifestPath;
    opts.path = entry.path;
  }

  const sessionOpts = {
    headed: opts.headed,
    connect: opts.connect,
    chromeProfile: opts.chromeProfile,
    siteBase: migrationCtx.base,
    hostname: migrationCtx.hostname,
    force: opts.force,
    continueOnError: opts.continueOnError,
  };

  if (opts.headless && !opts.connect) {
    console.warn(
      "Warning: --headless uses Playwright Chromium, which Cloudflare usually blocks. Prefer --connect 9222 or headed Chrome (default).",
    );
  }

  if (opts.importBulletinsOnly) {
    if (!opts.connect && opts.headless) {
      console.error(
        "[migrate] --import-bulletins-only requires --connect or headed Chrome (omit --headless).",
      );
      process.exit(1);
    }
    const { db } = await initFirebase();
    migrationCtx.setFirestorePageMap(await loadFirestorePageMap(db));
    await ensureBulletinsPage(db);
    await importEcatholicBulletinPdfs(opts, sessionOpts);
    logProgress("[migrate] Done.");
    return;
  }

  if (opts.importNavOnly) {
    if (!opts.connect) {
      console.error("[migrate] --import-nav-only requires --connect (Chrome with eCatholic site open).");
      process.exit(1);
    }
    const { db } = await initFirebase();
    migrationCtx.setFirestorePageMap(await loadFirestorePageMap(db));
    await importEcatholicNav(db, sessionOpts);
    logProgress("[migrate] Done.");
    return;
  }

  let entries = [];

  if (opts.fromManifest || opts.applyOnly) {
    const manifestFile = opts.fromManifest || migrationCtx.manifestPath;
    const { entries: manifestEntries } = readManifestFile(manifestFile);
    entries = manifestEntries;
    if (opts.path) entries = entries.filter((e) => e.path === opts.path);
    logProgress(
      `[migrate] Loaded ${entries.length} entries from manifest${shouldRunBulletinImport(opts) ? " (bulletin PDFs will be imported after apply)" : ""}`,
    );
  } else {
    const paths = await resolveScrapePathList(opts);
    if (!paths) {
      printHelp();
      process.exit(1);
    }

    logProgress(
      `[migrate] Will scrape ${paths.length} page(s)${opts.apply ? ", then apply to Firestore" : ""}${opts.publish ? " and publish" : ""}${shouldRunBulletinImport(opts) ? ", import bulletins" : ""}`,
    );
    entries = await scrapePaths(paths, sessionOpts);
  }

  if (!opts.apply && !opts.dryRun) {
    logProgress("[migrate] Scrape complete. Re-run with --apply to write to Firestore.");
    return;
  }

  const { db, storage } = opts.dryRun
    ? { db: null, storage: null }
    : await initFirebase({ uploadImages: opts.uploadImages });

  if (db && !opts.dryRun) {
    logProgress("[migrate] Loading Firestore pages for slug matching…");
    migrationCtx.setFirestorePageMap(await loadFirestorePageMap(db));
    const mapped = Object.keys(migrationCtx.firestorePageMap.byPath).length;
    logProgress(`[migrate] Found ${mapped} Firestore page(s)`);
  }

  let imageBrowser = null;
  if (opts.uploadImages && !opts.dryRun && storage) {
    logProgress("[migrate] Starting browser for media and photo album imports…");
    imageBrowser = await createBrowserSession(sessionOpts);
  }

  if (!opts.dryRun && !db) throw new Error("Firebase not configured");

  const albumPageCache = new Map();
  const homePageId = migrationCtx.homePageId;

  logProgress(`[migrate] Applying ${entries.length} page(s) to Firestore…`);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    logProgress(`[migrate] Apply ${i + 1}/${entries.length}: ${entry.path}`);
    const pageId = resolvePageId(migrationCtx, entry.path, entry.pageId);
    await applyEntry(db, storage, entry, {
      dryRun: opts.dryRun,
      publish: opts.publish,
      mergeHome: pageId === homePageId && !opts.force,
      uploadImages: opts.uploadImages,
      page: imageBrowser?.page,
      albumPageCache,
    });
    await sleep(PAGE_DELAY_MS);
  }

  if (imageBrowser) await imageBrowser.close();

  if (opts.apply && !opts.dryRun && !opts.skipImportNav && db) {
    try {
      await importEcatholicNav(db, sessionOpts);
    } catch (err) {
      console.warn(`[migrate] Navigation import failed: ${err.message}`);
    }
  }

  if (shouldRunBulletinImport(opts) && db) {
    try {
      await ensureBulletinsPage(db);
      await importEcatholicBulletinPdfs(opts, sessionOpts);
    } catch (err) {
      console.warn(`[migrate] Bulletin import failed: ${err.message}`);
    }
  }

  if (migrationCtx.parishId) {
    logProgress(`[migrate] eCatholic parish ID: ${migrationCtx.parishId}`);
  }

  logProgress("[migrate] Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
