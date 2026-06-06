#!/usr/bin/env node
/**
 * Migrate exact content from visitationfg.org (one page at a time, low memory).
 *
 * Cloudflare blocks headless Playwright — use headed mode (default) or one shared
 * browser session via --apply-all.
 *
 *   node scripts/migrate-visitation-content.mjs --path /about-us --dry-run --apply
 *   node scripts/migrate-visitation-content.mjs --path /about-us --apply --publish
 *   node scripts/migrate-visitation-content.mjs --apply-all --apply --publish
 *   node scripts/migrate-visitation-content.mjs --from-manifest scripts/.visitation-content-manifest.json --apply
 *
 * Cloudflare blocks Playwright's bundled Chromium — use one of these instead:
 *
 *   A) Connect to your real Chrome (recommended):
 *      /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *        --remote-debugging-port=9222 --user-data-dir="$HOME/.visitation-scrape-chrome"
 *      Open visitationfg.org and pass Cloudflare once, then:
 *      node scripts/migrate-visitation-content.mjs --connect 9222 --apply-all
 *
 *   B) Headed mode uses installed Google Chrome + saved profile (default when not --headless)
 *
 *   C) Manual: paste scripts/ecatholic-page-extract.js in your browser console, then:
 *      node scripts/migrate-visitation-content.mjs --import-json /tmp/page.json --apply
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = "https://www.visitationfg.org";
const ECATHOLIC_CDN = "https://files.ecatholic.com/24159";
const MANIFEST_PATH = join(__dirname, ".visitation-content-manifest.json");
const STORAGE_STATE_PATH = join(__dirname, ".ecatholic-storage.json");
const CHROME_PROFILE_PATH = join(__dirname, ".chrome-profile");
const PICTURES_FOLDER = "pictures-root";
const IMAGE_DELAY_MS = 400;
const PAGE_DELAY_MS = 500;
const CONTENT_WAIT_MS = 45_000;
const CLOUDFLARE_WAIT_MS = 120_000;
const PARISH_ID = "24159";

/** eCatholic path -> Firestore pageId */
const PAGE_MAP = {
  "/": "page_1780708317956_ldt10go",
  "/church-audio": "page_mig_church_audio",
  "/about-us": "page_1780716357093_56b2yvf",
  "/staff": "page_1780724526317_i3btgpv",
  "/new-parishioner-form": "page_mig_new_parishioner",
  "/parish-history": "page_mig_parish_history",
  "/the-visitation": "page_mig_the_visitation",
  "/live-streaming": "page_mig_live_streaming",
  "/baptism": "page_mig_baptism",
  "/reconciliation": "page_mig_reconciliation",
  "/first-holy-communion": "page_mig_fhc",
  "/confirmation": "page_mig_confirmation",
  "/marriage": "page_mig_marriage",
  "/anointing-of-the-sick": "page_mig_anointing",
  "/holy-orders": "page_mig_holy_orders",
  "/altar-society": "page_mig_altar_society",
  "/formed": "page_mig_formed",
  "/high-school-youth-group": "page_mig_hs_youth",
  "/liturgical-ministers": "page_mig_liturgical",
  "/middle-school-youth-group": "page_mig_ms_youth",
  "/music-choirs": "page_mig_music",
  "/ocia": "page_mig_ocia",
  "/religious-ed-sacramental-prep": "page_mig_religious_ed",
  "/shalom-world-tv": "page_mig_shalom",
  "/altar-server": "page_mig_altar_server",
  "/parish-picnic": "page_mig_picnic",
  "/school-auction": "page_mig_auction",
  "/administrative-finance-council": "page_mig_admin_council",
  "/cyo": "page_mig_cyo",
  "/knights-of-columbus": "page_mig_kofc",
  "/pastoral-council": "page_mig_pastoral",
  "/calendar-1": "page_mig_calendar",
  "/giving": "page_mig_support",
  "/scrip-program": "page_mig_scrip",
};

const SKIP_PAGE_IDS = new Set(["page_1780716360182_5gnkzid"]);

const SIDEBAR_LEFT_PAGES = new Set(
  Object.values(PAGE_MAP).filter(
    (id) =>
      id.startsWith("page_mig_") &&
      !["page_mig_calendar", "page_mig_church_audio"].includes(id),
  ),
);

const ALL_PATHS = Object.keys(PAGE_MAP);

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
  let fromManifest = null;
  if (fromManifestIdx >= 0) {
    const next = argv[fromManifestIdx + 1];
    fromManifest = next && !next.startsWith("-") ? next : MANIFEST_PATH;
  }

  return {
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply") || argv.includes("--apply-all"),
    applyAll: argv.includes("--apply-all"),
    /** Headed by default — uses real Google Chrome, not Playwright Chromium. */
    headed: !argv.includes("--headless"),
    publish: argv.includes("--publish"),
    path: pathIdx >= 0 ? argv[pathIdx + 1] : null,
    fromManifest,
    /** Attach to Chrome started with --remote-debugging-port (avoids Cloudflare bot detection). */
    connect: connectIdx >= 0 ? argv[connectIdx + 1] : null,
    chromeProfile: profileIdx >= 0 ? argv[profileIdx + 1] : CHROME_PROFILE_PATH,
    importJson: importIdx >= 0 ? argv[importIdx + 1] : null,
    /** Re-scrape paths that already exist in the manifest. */
    force: argv.includes("--force"),
    uploadImages: argv.includes("--upload-images"),
    applyOnly: argv.includes("--apply-only"),
    /** Keep going when a page times out (default for --apply-all). */
    continueOnError:
      argv.includes("--continue-on-error") ||
      (argv.includes("--apply-all") && !argv.includes("--fail-fast")),
  };
}

function printHelp() {
  console.log(`Migrate exact content from visitationfg.org into the parish CMS.

Usage:
  node scripts/migrate-visitation-content.mjs --connect 9222 --apply-all
  node scripts/migrate-visitation-content.mjs --path /about-us --apply --publish
  node scripts/migrate-visitation-content.mjs --from-manifest --apply
  node scripts/migrate-visitation-content.mjs --import-json page.json --apply

Options:
  --connect <port|url>   Attach to real Chrome (best for Cloudflare)
  --path <path>          Scrape one eCatholic path (e.g. /about-us)
  --apply-all            Scrape all mapped paths
  --apply                Write manifest entries to Firestore
  --publish              Publish after apply
  --from-manifest [file] Apply from manifest without scraping
  --apply-only           Skip scrape; apply + publish from manifest only
  --import-json <file>   Merge one manual console extract into manifest
  --force                Re-scrape paths already in manifest
  --upload-images        Download images to Firebase Storage (use with --connect for photo albums)
  --headless             Use Playwright Chromium (usually blocked by Cloudflare)
  --dry-run              Preview without writing
  --continue-on-error    Skip failed pages during batch scrape

Cloudflare workaround — start Chrome separately, then connect:

  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
    --remote-debugging-port=9222 \\
    --user-data-dir="$HOME/.visitation-scrape-chrome"

Open https://www.visitationfg.org in that window, pass Cloudflare once, then:

  node scripts/migrate-visitation-content.mjs --connect 9222 --apply-all

Keep that Chrome window open while the script runs. If the script exits immediately,
port 9222 is not reachable — start Chrome with the command above first.

Faster re-runs (skip scrape, apply manifest only):

  node scripts/migrate-visitation-content.mjs --apply-only --apply-all --force --publish

Manual fallback: paste scripts/ecatholic-page-extract.js in the browser console on each page.
`);
}

function printCloudflareHelp() {
  console.error(`
Cloudflare is blocking the automated browser (Verify Human loops forever in Playwright Chromium).

Use real Chrome instead:

  1. Quit Chrome completely
  2. Start Chrome with remote debugging:
     /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
       --remote-debugging-port=9222 \\
       --user-data-dir="$HOME/.visitation-scrape-chrome"
  3. In that window, open https://www.visitationfg.org and browse normally (no bot check loop)
  4. Re-run: node scripts/migrate-visitation-content.mjs --connect 9222 --apply-all

Or extract one page manually: paste scripts/ecatholic-page-extract.js in the browser console,
save the JSON, then: node scripts/migrate-visitation-content.mjs --import-json page.json --apply
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
  --user-data-dir="$HOME/.visitation-scrape-chrome"`;

async function assertChromeDebugPort(connect) {
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
        `Then open https://www.visitationfg.org in that window before running this script.`,
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
  logProgress("[migrate] Firestore ready.");

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

function pickScrapePage(context) {
  const pages = context.pages();
  const onSite = pages.find((p) => {
    try {
      return p.url().includes("visitationfg.org");
    } catch {
      return false;
    }
  });
  return onSite || pages[0] || null;
}

async function resolveScrapePage(context) {
  const existing = pickScrapePage(context);
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
  if (pageId === "page_1780708317956_ldt10go") return "full-width";
  if (pageId === "page_mig_calendar" || pageId === "page_mig_church_audio") return "default";
  if (SIDEBAR_LEFT_PAGES.has(pageId) || pageId === "page_1780716357093_56b2yvf") return "sidebar-left";
  return "default";
}

function emptyRegions(pageId) {
  const layout = layoutFor(pageId);
  if (pageId === "page_1780708317956_ldt10go") {
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
        return `${ECATHOLIC_CDN}${path}`.split("?")[0];
      }
      return upgraded.split("?")[0];
    } catch {
      return upgraded.split("?")[0];
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.startsWith("/photoalbums/") && /\.(jpe?g|png|gif|webp)$/i.test(path)) {
    return `${BASE}${path}`.split("?")[0];
  }
  if (path.startsWith("/pictures/") || path.startsWith("/documents/")) {
    return `${ECATHOLIC_CDN}${path}`.split("?")[0];
  }
  if (upgraded.startsWith("http")) return upgraded.split("?")[0];
  return `${BASE}${path}`.split("?")[0];
}

function resolvePersonPhotoUrl(src) {
  if (!src?.trim()) return "";
  return resolveImageUrl(src) || upgradeEcatholicImageSrc(src).split("?")[0];
}

function isCssNoiseHtml(html) {
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

async function downloadImageBytes(sourceUrl, { page } = {}) {
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

async function uploadImage(storage, sourceUrl, alt, { page } = {}) {
  const { buffer, contentType, url } = await downloadImageBytes(sourceUrl, { page });
  if (buffer.length > 10 * 1024 * 1024) throw new Error(`Image too large: ${url}`);

  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const filename = filenameFromUrl(url);
  const mimeType = contentType || "image/jpeg";
  const storagePath = `media/${PICTURES_FOLDER}/${mediaId}_${filename}`;
  const downloadUrl = await storage.uploadPublicObject(storagePath, buffer, mimeType);

  return { downloadUrl, filename, alt: alt || "" };
}

async function resolveUploadedImageUrl(
  sourceUrl,
  alt,
  { dryRun, storage, uploadImages, page },
  imageUrlCache,
) {
  const source = resolveImageUrl(sourceUrl) || sourceUrl;
  if (dryRun || !storage || !uploadImages) return source;
  if (imageUrlCache.has(source)) return imageUrlCache.get(source);
  try {
    console.log(`  Uploading ${source}`);
    const uploaded = await uploadImage(storage, source, alt, { page });
    imageUrlCache.set(source, uploaded.downloadUrl);
    await sleep(IMAGE_DELAY_MS);
    return uploaded.downloadUrl;
  } catch (err) {
    console.warn(`  Upload failed, using source URL: ${err.message}`);
    return source;
  }
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

    const h1 = document.querySelector("#core h1, #content1 h1, h1");

    const inferPageSectionTitle = () => {
      const siteName = h1?.textContent?.trim() || "Visitation Parish";
      const fromDoc = document.title.replace(/\s*\|\s*.+$/, "").trim();
      const first = fromDoc.split(" - ")[0]?.trim() || "";
      if (!first || first === siteName) return "";
      return first;
    };

    const titleFromHtml = (html) => {
      if (!html?.trim()) return "";
      const doc = new DOMParser().parseFromString(html, "text/html");
      const heading = doc.querySelector("h2, h3, h4");
      const text = heading?.textContent?.replace(/\s+/g, " ").trim() || "";
      return text && text.length <= 120 ? text : "";
    };

    const pageSectionTitle = inferPageSectionTitle();

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
      h1?.textContent?.trim() || document.title.replace(/\s*\|\s*.+$/, "").trim();

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
            const clone = view.cloneNode(true);
            clone.querySelectorAll("img, style").forEach((el) => el.remove());
            const html = clone.innerHTML.trim();
            if (html) {
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

      /** eCatholic document modules have no .fr-view — links live in .documentList */
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
          scrapedModules.push({
            type: "documents",
            title: moduleTitle,
            items,
            region,
          });
          continue;
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
      view.querySelectorAll('a[href$=".pdf"], a[href*="/documents/"]').forEach((a) => {
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

    return { title, modules: scrapedModules, pageSectionTitle };
  }, { pagePath: path });
}

async function scrapePath(page, path) {
  const url = `${BASE}${path}`;
  process.stdout.write(`  Loading ${url} ...\n`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await waitForPageContent(page, path);
  /** YouTube/Vimeo iframes are often injected after initial paint */
  await page
    .locator('.youtubeModule iframe, .vimeoModule iframe, [data-youtube-id], [data-vimeo-id]')
    .first()
    .waitFor({ state: "attached", timeout: 8_000 })
    .catch(() => {});
  await sleep(800);
  const data = await scrapePageDom(page, path);
  if (data.error) throw new Error(`${path}: ${data.error}`);
  data.modules = consolidateScrapedModules(data.modules);
  return data;
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return [];
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return [];
  }
}

function writeManifestEntry(entry) {
  const manifest = readManifest().filter((e) => e.path !== entry.path);
  manifest.push(entry);
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
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
  const entry = {
    path,
    pageId: PAGE_MAP[path],
    scrapedAt: new Date().toISOString(),
    title: raw.title || "",
    modules: raw.modules || [],
  };
  if (!entry.pageId) throw new Error(`Unknown path ${path} — not in PAGE_MAP`);
  writeManifestEntry(entry);
  console.log(`Imported ${path} (${entry.modules.length} modules) into manifest`);
  return entry;
}

async function createBrowserSession({ headed, connect, chromeProfile }) {
  logProgress("[migrate] Starting browser session…");
  const { chromium } = await import("playwright");

  if (connect) {
    const endpoint = connect.startsWith("http") ? connect : `http://127.0.0.1:${connect}`;
    await assertChromeDebugPort(connect);
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No browser context at ${endpoint} — open Chrome with remote debugging first`);
    const page = await resolveScrapePage(context);
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
          pageId: PAGE_MAP[path],
          scrapedAt: new Date().toISOString(),
          ...data,
        };
        writeManifestEntry(entry);
        if (session.kind !== "cdp") await saveStorageState(context);
        console.log(`  → ${data.modules.length} modules saved to manifest`);
        results.push(entry);
        if (pathList.length > 1) await sleep(2500);
      } catch (err) {
        console.error(`  ✗ ${path}: ${err.message}`);
        if (/cloudflare|timed out|just a moment/i.test(err.message) && !sessionOpts.connect) {
          printCloudflareHelp();
        }
        if (!continueOnError) throw err;
      }
    }
    return results;
  });
}

async function scrapedToFirestoreModules(scrapedModules, storage, { dryRun, uploadImages, page }) {
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
            href: item.href || item.url || "/",
          })),
        },
      });
    } else if (mod.type === "photo_albums") {
      const albums = [];
      for (const album of mod.albums || []) {
        albums.push({
          label: album.label || "",
          href: album.href || "/",
          imageSrc: await resolveUploadedImageUrl(
            album.imageSrc,
            album.label,
            { dryRun, storage, uploadImages, page },
            imageUrlCache,
          ),
          photoCount: album.photoCount,
        });
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
      firestoreModules.push({
        id: generateId(),
        type: "documents",
        region,
        order: nextOrder(region),
        config: { title: mod.title || "Documents", items: mod.items },
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

  if (pageId === "page_1780708317956_ldt10go") {
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

async function applyEntry(db, storage, entry, { dryRun, publish, mergeHome, uploadImages, page }) {
  const pageId = entry.pageId || PAGE_MAP[entry.path];
  if (!pageId || SKIP_PAGE_IDS.has(pageId)) {
    console.log(`Skipping ${entry.path}`);
    return;
  }

  const layout = layoutFor(pageId);
  let regions = emptyRegions(pageId);
  const scraped = consolidateScrapedModules(fillMissingModuleTitles({ ...entry, modules: [...(entry.modules || [])] }).modules);
  let modules = await scrapedToFirestoreModules(scraped, storage, {
    dryRun,
    uploadImages,
    page,
  });
  modules = appendSpecialModules(pageId, modules);

  if (pageId === "page_1780708317956_ldt10go" && mergeHome) {
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

  const updates = {
    layout,
    contentColumns: pageId === "page_1780708317956_ldt10go" ? 2 : 1,
    maxModulesPerRegion: 15,
    contentMarginX: "md",
    regions,
    updatedAt: new Date().toISOString(),
  };

  if (entry.title && pageId !== "page_1780708317956_ldt10go") {
    updates.title = entry.title;
    updates.seo = { title: entry.title };
  }

  if (dryRun) {
    console.log(`[dry-run] ${pageId} (${entry.path}): ${modules.length} modules`);
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
  if (!(await ref.get()).exists) {
    console.warn(`Page not found: ${pageId}`);
    return;
  }

  await ref.update(updates);

  if (publish) {
    const data = (await ref.get()).data();
    await ref.update({
      status: "published",
      publishedSnapshot: buildPublishedSnapshot(data),
      publishedAt: new Date().toISOString(),
      scheduledPublishAt: null,
    });
  }

  console.log(`Applied ${pageId} (${entry.path}): ${modules.length} modules${publish ? " [published]" : ""}`);
}

async function main() {
  logProgress("[migrate] Visitation content migration");
  const opts = parseArgs(process.argv.slice(2));

  if (opts.applyOnly) {
    opts.fromManifest = opts.fromManifest || MANIFEST_PATH;
  }

  if (opts.importJson) {
    const entry = importJsonEntry(opts.importJson);
    if (!opts.apply && !opts.dryRun) {
      console.log("Imported. Re-run with --apply to write to Firestore.");
      return;
    }
    opts.fromManifest = MANIFEST_PATH;
    opts.path = entry.path;
  }

  const paths = opts.path ? [opts.path] : opts.applyAll && !opts.applyOnly ? ALL_PATHS : null;

  if (opts.headless && !opts.connect) {
    console.warn(
      "Warning: --headless uses Playwright Chromium, which Cloudflare usually blocks. Prefer --connect 9222 or headed Chrome (default).",
    );
  }

  let entries = [];

  if (opts.fromManifest || opts.applyOnly) {
    entries = JSON.parse(readFileSync(opts.fromManifest || MANIFEST_PATH, "utf8"));
    if (opts.path) entries = entries.filter((e) => e.path === opts.path);
    logProgress(`[migrate] Loaded ${entries.length} entries from manifest`);
  } else if (paths) {
    logProgress(
      `[migrate] Will scrape ${paths.length} page(s)${opts.apply ? ", then apply to Firestore" : ""}${opts.publish ? " and publish" : ""}`,
    );
    entries = await scrapePaths(paths, {
      headed: opts.headed,
      connect: opts.connect,
      chromeProfile: opts.chromeProfile,
      force: opts.force,
      continueOnError: opts.continueOnError,
    });
  } else {
    printHelp();
    process.exit(1);
  }

  if (!opts.apply && !opts.dryRun) {
    logProgress("[migrate] Scrape complete. Re-run with --apply to write to Firestore.");
    return;
  }

  const { db, storage } = opts.dryRun
    ? { db: null, storage: null }
    : await initFirebase({ uploadImages: opts.uploadImages });

  let imageBrowser = null;
  if (opts.uploadImages && !opts.dryRun && storage) {
    if (!opts.connect) {
      console.warn(
        "Warning: --upload-images without --connect may fail for Cloudflare-protected photo album URLs.",
      );
    } else {
      logProgress("[migrate] Connecting to Chrome for image downloads…");
      imageBrowser = await createBrowserSession({
        headed: opts.headed,
        connect: opts.connect,
        chromeProfile: opts.chromeProfile,
      });
    }
  }

  if (!opts.dryRun && !db) throw new Error("Firebase not configured");

  logProgress(`[migrate] Applying ${entries.length} page(s) to Firestore…`);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    logProgress(`[migrate] Apply ${i + 1}/${entries.length}: ${entry.path}`);
    await applyEntry(db, storage, entry, {
      dryRun: opts.dryRun,
      publish: opts.publish,
      mergeHome:
        entry.pageId === "page_1780708317956_ldt10go" && !opts.force,
      uploadImages: opts.uploadImages,
      page: imageBrowser?.page,
    });
    await sleep(PAGE_DELAY_MS);
  }

  if (imageBrowser) await imageBrowser.close();

  logProgress("[migrate] Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
