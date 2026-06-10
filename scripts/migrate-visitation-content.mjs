#!/usr/bin/env node
/**
 * Backward-compatible wrapper for Visitation FG migration.
 * Prefer: node scripts/migrate-ecatholic-content.mjs --domain www.visitationfg.org ...
 *
 * Full transfer (pages + nav + bulletin PDFs):
 *   node scripts/migrate-visitation-content.mjs --connect 9222 --apply-all --apply --upload-images --publish
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = join(__dirname, "migrate-ecatholic-content.mjs");
const argv = process.argv.slice(2);

if (!argv.includes("--domain") && !argv.some((a, i) => argv[i - 1] === "--domain")) {
  argv.unshift("www.visitationfg.org");
  argv.unshift("--domain");
}

const result = spawnSync(process.execPath, [script, ...argv], { stdio: "inherit" });
process.exit(result.status ?? 1);
