#!/usr/bin/env node
/**
 * Import bulletin PDFs from an eCatholic parish site into Firestore + Firebase Storage.
 *
 * First-time setup:
 *   npm install
 *   npx playwright install chromium
 *
 * Usage:
 *   npm run import:bulletins:dry
 *   npm run import:bulletins
 *   node scripts/import-ecatholic-bulletins.mjs --headed
 *   node scripts/import-ecatholic-bulletins.mjs --from-manifest scripts/.bulletin-manifest.json
 *
 * If Cloudflare blocks headless scraping, use --headed or paste this on the bulletins page:
 *   copy(JSON.stringify([...document.querySelectorAll('a[href*="/bulletins/"][href$=".pdf"]')].map(a => ({ title: a.textContent.trim(), url: a.href })), null, 2))
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_SOURCE_URL = "https://www.visitationfg.org/bulletins";
const DEFAULT_MANIFEST_PATH = join(__dirname, ".bulletin-manifest.json");
const DOCUMENTS_FOLDER = "documents-root";
const COLLECTIONS = { bulletins: "bulletins", media: "media" };

function parseArgs(argv) {
  const options = {
    dryRun: false,
    headed: false,
    fromManifest: null,
    limit: null,
    sourceUrl: DEFAULT_SOURCE_URL,
    manifestPath: DEFAULT_MANIFEST_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--headed") options.headed = true;
    else if (arg === "--from-manifest") {
      options.fromManifest = argv[i + 1] ?? DEFAULT_MANIFEST_PATH;
      i += 1;
    } else if (arg === "--limit") {
      options.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--source-url") {
      options.sourceUrl = argv[i + 1];
      i += 1;
    } else if (arg === "--manifest-path") {
      options.manifestPath = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/import-ecatholic-bulletins.mjs [options]

Options:
  --dry-run                 List bulletins without writing to Firebase
  --headed                  Show browser window (helps pass Cloudflare)
  --from-manifest <path>    Import from JSON instead of scraping
  --limit <n>               Import only the first N bulletins
  --source-url <url>        eCatholic bulletins page (default: ${DEFAULT_SOURCE_URL})
  --manifest-path <path>    Where to write scraped manifest (default: scripts/.bulletin-manifest.json)
`);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function initFirebaseAdmin() {
  loadEnvFile(join(ROOT, ".env.local"));
  loadEnvFile(join(ROOT, ".env"));

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials missing from .env.local");
  }
  if (!storageBucket) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET missing from .env.local");
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
          projectId,
          storageBucket,
        });

  return {
    db: getFirestore(app),
    storage: getStorage(app),
    bucketName: storageBucket,
  };
}

function parseDateFromPdfUrl(url) {
  const match = url.match(/\/bulletins\/(\d{8})\.pdf/i);
  if (!match) return null;
  const raw = match[1];
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function normalizeBulletinEntry(entry) {
  const url = entry.url?.split("?")[0];
  const date = parseDateFromPdfUrl(url);
  if (!date) return null;

  const title = entry.title?.trim() ?? "";
  const looksLikeDate =
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(
      title,
    );

  return {
    date,
    url,
    title: looksLikeDate ? undefined : title || undefined,
  };
}

function dedupeBulletins(entries) {
  const byDate = new Map();
  for (const entry of entries) {
    const normalized = normalizeBulletinEntry(entry);
    if (!normalized) continue;
    if (!byDate.has(normalized.date)) {
      byDate.set(normalized.date, normalized);
    }
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function readManifest(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Manifest must be a JSON array: ${path}`);
  }
  return dedupeBulletins(parsed);
}

async function scrapeBulletins(sourceUrl, { headed }) {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    console.log(`Scraping ${sourceUrl} ...`);
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });

    if (headed) {
      console.log("If Cloudflare appears, complete the challenge in the browser window.");
    }

    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("a")].some((anchor) =>
            /files\.ecatholic\.com\/\d+\/bulletins\/\d{8}\.pdf/i.test(anchor.href),
          ),
        { timeout: headed ? 180_000 : 60_000 },
      )
      .catch(() => {});

    const yearHeaders = page.locator(
      '#background a, .bulletinArchive a, [class*="archive"] a, li a',
    ).filter({ hasText: /^\d{4}$/ });
    const yearCount = await yearHeaders.count();
    for (let i = 0; i < yearCount; i += 1) {
      await yearHeaders.nth(i).click({ timeout: 5_000 }).catch(() => {});
    }

    await page.waitForTimeout(1_500);

    const entries = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="files.ecatholic.com"][href*="/bulletins/"]')]
        .filter((anchor) => /\.pdf/i.test(anchor.href))
        .map((anchor) => ({
          title: anchor.textContent.trim(),
          url: anchor.href,
        })),
    );

    const title = await page.title();
    if (entries.length === 0) {
      const hint =
        /just a moment/i.test(title) || /challenge/i.test(await page.content())
          ? "Cloudflare blocked headless scraping."
          : "No bulletin PDF links were found on the page.";
      throw new Error(
        `${hint} Try --headed or create a manifest with the browser console snippet in the script header.`,
      );
    }

    return dedupeBulletins(entries);
  } finally {
    await browser.close();
  }
}

async function bulletinExistsForDate(db, date) {
  const snap = await db.collection(COLLECTIONS.bulletins).where("date", "==", date).limit(1).get();
  return !snap.empty;
}

function generateBulletinId() {
  return `bulletin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function uploadBulletinPdf(db, storage, bucketName, buffer, date) {
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const filename = `bulletin-${date}.pdf`;
  const storagePath = `media/${DOCUMENTS_FOLDER}/${mediaId}_${filename}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType: "application/pdf" },
    public: true,
  });
  await file.makePublic();

  const downloadUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
  const now = new Date().toISOString();
  const mediaRecord = {
    name: filename,
    folderId: DOCUMENTS_FOLDER,
    mimeType: "application/pdf",
    sizeBytes: buffer.length,
    storagePath,
    downloadUrl,
    usedOnPageIds: [],
    createdAt: now,
  };

  await db.collection(COLLECTIONS.media).doc(mediaId).set(mediaRecord);
  return { mediaId, downloadUrl, now };
}

async function importBulletins(bulletins, { dryRun, limit, db, storage, bucketName }) {
  const selected = limit ? bulletins.slice(0, limit) : bulletins;
  const summary = { imported: 0, skipped: 0, failed: 0 };

  for (const bulletin of selected) {
    const label = `${bulletin.date}${bulletin.title ? ` (${bulletin.title})` : ""}`;

    if (dryRun) {
      console.log(`[dry-run] would import ${label} <- ${bulletin.url}`);
      summary.imported += 1;
      continue;
    }

    try {
      if (await bulletinExistsForDate(db, bulletin.date)) {
        console.log(`[skipped-duplicate] ${label}`);
        summary.skipped += 1;
        continue;
      }

      const response = await fetch(bulletin.url);
      if (!response.ok) {
        throw new Error(`download failed: HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const { mediaId, downloadUrl, now } = await uploadBulletinPdf(
        db,
        storage,
        bucketName,
        buffer,
        bulletin.date,
      );

      const bulletinId = generateBulletinId();
      const record = {
        date: bulletin.date,
        mediaId,
        downloadUrl,
        createdAt: now,
        updatedAt: now,
      };
      if (bulletin.title) record.title = bulletin.title;

      await db.collection(COLLECTIONS.bulletins).doc(bulletinId).set(record);
      console.log(`[imported] ${label}`);
      summary.imported += 1;
    } catch (error) {
      console.error(`[failed] ${label}: ${error.message}`);
      summary.failed += 1;
    }
  }

  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let bulletins;

  if (options.fromManifest) {
    const manifestPath = resolve(options.fromManifest);
    console.log(`Loading manifest from ${manifestPath}`);
    bulletins = readManifest(manifestPath);
  } else {
    bulletins = await scrapeBulletins(options.sourceUrl, { headed: options.headed });
    writeFileSync(options.manifestPath, `${JSON.stringify(bulletins, null, 2)}\n`);
    console.log(`Wrote manifest (${bulletins.length} bulletins) to ${options.manifestPath}`);
  }

  console.log(`Found ${bulletins.length} unique bulletin dates.`);

  let firebase = null;
  if (!options.dryRun) {
    firebase = initFirebaseAdmin();
  }

  const summary = await importBulletins(bulletins, {
    dryRun: options.dryRun,
    limit: options.limit,
    db: firebase?.db,
    storage: firebase?.storage,
    bucketName: firebase?.bucketName,
  });

  console.log(
    `\nDone. imported=${summary.imported} skipped=${summary.skipped} failed=${summary.failed}`,
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
