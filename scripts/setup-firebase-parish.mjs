#!/usr/bin/env node
/**
 * One-time parish Firebase setup helpers (billing, storage bucket, email link auth, admin key).
 * Usage: node scripts/setup-firebase-parish.mjs <projectId>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BILLING_ACCOUNT = "billingAccounts/01E55C-97D976-D6330C";
const LOCATION = "US-WEST1";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: node scripts/setup-firebase-parish.mjs <projectId>");
  process.exit(1);
}

function getAccessToken() {
  const config = JSON.parse(
    readFileSync(join(homedir(), ".config/configstore/firebase-tools.json"), "utf8"),
  );
  return config.tokens.access_token;
}

async function api(url, options = {}) {
  const token = getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${url}\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}`);
  }
  return body;
}

async function linkBilling() {
  try {
    await api(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      method: "PUT",
      body: JSON.stringify({ billingAccountName: BILLING_ACCOUNT, billingEnabled: true }),
    });
    console.log(`✓ Billing linked for ${projectId}`);
  } catch (err) {
    if (String(err.message).includes("already has billing enabled")) {
      console.log(`✓ Billing already enabled for ${projectId}`);
      return;
    }
    throw err;
  }
}

async function createDefaultBucket() {
  try {
    await api(
      `https://firebasestorage.googleapis.com/v1alpha/projects/${projectId}/defaultBucket?key=`,
      {
        method: "POST",
        body: JSON.stringify({ location: LOCATION }),
      },
    );
    console.log(`✓ Default storage bucket created (${LOCATION}) for ${projectId}`);
  } catch (err) {
    if (String(err.message).includes("ALREADY_EXISTS") || String(err.message).includes("already exists")) {
      console.log(`✓ Default storage bucket already exists for ${projectId}`);
      return;
    }
    throw err;
  }
}

async function enableEmailLinkAuth() {
  const config = await api(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
  );
  const signIn = config.signIn || {};
  const email = signIn.email || {};
  await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,signIn.email.passwordlessEnabled`, {
    method: "PATCH",
    body: JSON.stringify({
      signIn: {
        email: {
          enabled: true,
          passwordRequired: true,
          passwordlessEnabled: true,
        },
      },
    }),
  });
  console.log(`✓ Email/password + email link auth enabled for ${projectId}`);
}

async function listAdminServiceAccounts() {
  const data = await api(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`,
  );
  return (data.accounts || []).filter((a) => a.email?.includes("firebase-adminsdk"));
}

async function createAdminKey() {
  const accounts = await listAdminServiceAccounts();
  if (!accounts.length) {
    throw new Error(`No firebase-adminsdk service account found for ${projectId}`);
  }
  const email = accounts[0].email;
  const key = await api(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${encodeURIComponent(email)}/keys`,
    {
      method: "POST",
      body: JSON.stringify({
        keyAlgorithm: "KEY_ALG_RSA_2048",
        privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
      }),
    },
  );
  const privateKeyData = key.privateKeyData;
  const json = JSON.parse(Buffer.from(privateKeyData, "base64").toString("utf8"));
  const outDir = join(process.cwd(), ".firebase-keys");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${projectId}-admin.json`);
  writeFileSync(outPath, JSON.stringify(json, null, 2), { mode: 0o600 });
  console.log(`✓ Admin key written to ${outPath}`);
  return { email: json.client_email, privateKey: json.private_key, projectId: json.project_id };
}

async function main() {
  console.log(`Setting up ${projectId}...`);
  await linkBilling();
  await createDefaultBucket();
  await enableEmailLinkAuth();
  const admin = await createAdminKey();
  console.log(JSON.stringify({ projectId, adminEmail: admin.email }));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
