#!/usr/bin/env node
/** Publish all draft pages. Omits undefined snapshot fields (Firestore-safe). */

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function initDb() {
  loadEnvFile(join(ROOT, ".env.local"));
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin credentials missing");
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  return getFirestore(app);
}

function buildSnapshot(data) {
  const snapshot = {
    regions: data.regions,
    layout: data.layout,
    title: data.title,
    seo: data.seo,
  };
  if (data.contentMarginX !== undefined) snapshot.contentMarginX = data.contentMarginX;
  return snapshot;
}

async function main() {
  const db = initDb();
  const snap = await db.collection("pages").get();
  const ts = new Date().toISOString();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.status === "published") continue;
    await doc.ref.update({
      status: "published",
      publishedSnapshot: buildSnapshot(data),
      publishedAt: ts,
      scheduledPublishAt: null,
      updatedAt: ts,
    });
    console.log(`Published: ${data.title} (${data.slug || "home"})`);
    count += 1;
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done. Published ${count} pages.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
