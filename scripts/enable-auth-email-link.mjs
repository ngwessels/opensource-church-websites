#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const parishes = [
  {
    projectId: "visitation-fg-site",
    domains: [
      "visitation-fg-site.firebaseapp.com",
      "visitation-fg-site.web.app",
      "localhost",
      "www.visitationfg.org",
      "visitationfg.org",
    ],
  },
  {
    projectId: "st-edward-np-site",
    domains: [
      "st-edward-np-site.firebaseapp.com",
      "st-edward-np-site.web.app",
      "localhost",
      "stedwardnp.org",
      "www.stedwardnp.org",
    ],
  },
  {
    projectId: "sfa-roy-parish-site",
    domains: [
      "sfa-roy-parish-site.firebaseapp.com",
      "sfa-roy-parish-site.web.app",
      "localhost",
      "sfaroyparish.org",
      "www.sfaroyparish.org",
    ],
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
  if (!res.ok) {
    throw new Error(`${res.status} ${url}\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}`);
  }
  return body;
}

async function setupProject(projectId, domains) {
  await api(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`, {
    method: "POST",
    body: "{}",
  }).catch(() => {});

  await api(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,
    {
      method: "PATCH",
      body: JSON.stringify({
        signIn: {
          email: {
            enabled: true,
            passwordRequired: true,
          },
        },
        authorizedDomains: domains,
      }),
    },
  );

  const config = await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`);
  console.log(`${projectId}: email enabled=${config.signIn?.email?.enabled}, domains=${config.authorizedDomains?.join(", ")}`);
}

async function main() {
  for (const parish of parishes) {
    await setupProject(parish.projectId, parish.domains);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
