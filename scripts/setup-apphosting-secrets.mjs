#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const parishes = [
  {
    projectId: "visitation-fg-site",
    backend: "visitationfg",
    secrets: {
      firebaseApiKey: "AIzaSyChCnIwjZKAyX4Ulp-cSSZ5bxtERP9ZnIo",
      firebaseAuthDomain: "visitation-fg-site.firebaseapp.com",
      firebaseProjectId: "visitation-fg-site",
      firebaseStorageBucket: "visitation-fg-site.firebasestorage.app",
      firebaseMessagingSenderId: "352953409004",
      firebaseAppId: "1:352953409004:web:79020c99f1b60654dbf4c9",
    },
  },
  {
    projectId: "st-edward-np-site",
    backend: "stedwardnp",
    secrets: {
      firebaseApiKey: "AIzaSyBGeqd2qHrxpr3totNVm7LuekQY95224eU",
      firebaseAuthDomain: "st-edward-np-site.firebaseapp.com",
      firebaseProjectId: "st-edward-np-site",
      firebaseStorageBucket: "st-edward-np-site.firebasestorage.app",
      firebaseMessagingSenderId: "889996307131",
      firebaseAppId: "1:889996307131:web:8df6e36f782602c423179e",
    },
  },
  {
    projectId: "sfa-roy-parish-site",
    backend: "sfaroy",
    secrets: {
      firebaseApiKey: "AIzaSyB0Y1HsufM7feIuRz_sfRP-1GOeakkWpJA",
      firebaseAuthDomain: "sfa-roy-parish-site.firebaseapp.com",
      firebaseProjectId: "sfa-roy-parish-site",
      firebaseStorageBucket: "sfa-roy-parish-site.firebasestorage.app",
      firebaseMessagingSenderId: "899938360166",
      firebaseAppId: "1:899938360166:web:b9612265dc902ae1d646a7",
    },
  },
];

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
  if (!res.ok && res.status !== 409) {
    throw new Error(`${res.status} ${url}\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}`);
  }
  return body;
}

async function ensureSecret(projectId, secretId, value) {
  try {
    await api(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets?secretId=${secretId}`, {
      method: "POST",
      body: JSON.stringify({ replication: { automatic: {} } }),
    });
  } catch (err) {
    if (!String(err.message).includes("Already exists") && !String(err.message).includes("409")) {
      throw err;
    }
  }

  await api(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${secretId}:addVersion`,
    {
      method: "POST",
      body: JSON.stringify({
        payload: { data: Buffer.from(value, "utf8").toString("base64") },
      }),
    },
  );
  console.log(`  ✓ ${secretId}`);
}

async function main() {
  for (const parish of parishes) {
    console.log(`Secrets for ${parish.projectId}...`);
    for (const [name, value] of Object.entries(parish.secrets)) {
      await ensureSecret(parish.projectId, name, value);
    }

    const names = Object.keys(parish.secrets).join(",");
    execSync(
      `npx -y firebase-tools@latest apphosting:secrets:grantaccess ${names} --project ${parish.projectId} --backend ${parish.backend} --location us-central1`,
      { stdio: "inherit" },
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
