#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const parishes = [
  {
    locationName: "visitationfg",
    projectId: "visitation-fg-site",
    siteUrl: "https://www.visitationfg.org",
    apiKey: "AIzaSyChCnIwjZKAyX4Ulp-cSSZ5bxtERP9ZnIo",
    authDomain: "visitation-fg-site.firebaseapp.com",
    storageBucket: "visitation-fg-site.firebasestorage.app",
    messagingSenderId: "352953409004",
    appId: "1:352953409004:web:79020c99f1b60654dbf4c9",
  },
  {
    locationName: "stedwardnp",
    projectId: "st-edward-np-site",
    siteUrl: "https://stedwardnp.org",
    apiKey: "AIzaSyBGeqd2qHrxpr3totNVm7LuekQY95224eU",
    authDomain: "st-edward-np-site.firebaseapp.com",
    storageBucket: "st-edward-np-site.firebasestorage.app",
    messagingSenderId: "889996307131",
    appId: "1:889996307131:web:8df6e36f782602c423179e",
  },
  {
    locationName: "sfaroy",
    projectId: "sfa-roy-parish-site",
    siteUrl: "https://sfaroyparish.org",
    apiKey: "AIzaSyB0Y1HsufM7feIuRz_sfRP-1GOeakkWpJA",
    authDomain: "sfa-roy-parish-site.firebaseapp.com",
    storageBucket: "sfa-roy-parish-site.firebasestorage.app",
    messagingSenderId: "899938360166",
    appId: "1:899938360166:web:b9612265dc902ae1d646a7",
  },
];

function escapePrivateKey(key) {
  return key.replace(/\n/g, "\\n");
}

for (const parish of parishes) {
  const adminPath = join(process.cwd(), ".firebase-keys", `${parish.projectId}-admin.json`);
  const admin = JSON.parse(readFileSync(adminPath, "utf8"));

  const content = `# Firebase (client — ${parish.projectId})
NEXT_PUBLIC_FIREBASE_API_KEY=${parish.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${parish.authDomain}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${parish.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${parish.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${parish.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${parish.appId}
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (server — service account)
FIREBASE_ADMIN_PROJECT_ID=${admin.project_id}
FIREBASE_ADMIN_CLIENT_EMAIL=${admin.client_email}
FIREBASE_ADMIN_PRIVATE_KEY="${escapePrivateKey(admin.private_key)}"

# Stripe (prefer a restricted API key: rk_test_...)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App — canonical domain for ${parish.locationName}
NEXT_PUBLIC_SITE_URL=${parish.siteUrl}
NEXT_PUBLIC_APP_URL=${parish.siteUrl}

# MCP OAuth — generate: openssl rand -base64 32
MCP_OAUTH_COOKIE_SECRET=
MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS=3600
MCP_OAUTH_CODE_TTL_SECONDS=600

# Vercel Cron
CRON_SECRET=

# Mailgun — form submission notification emails
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM=noreply@mg.yourdomain.com
`;

  const outPath = join(process.cwd(), `.env.local.${parish.locationName}`);
  writeFileSync(outPath, content);
  console.log(`Wrote ${outPath}`);
}
