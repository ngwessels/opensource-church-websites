#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = readFileSync(join(process.cwd(), "apphosting.yaml"), "utf8");

const parishes = [
  {
    file: "apphosting.visitationfg.yaml",
    projectId: "visitation-fg-site",
    backend: "visitationfg",
    siteUrl: "https://www.visitationfg.org",
  },
  {
    file: "apphosting.stedwardnp.yaml",
    projectId: "st-edward-np-site",
    backend: "stedwardnp",
    siteUrl: "https://stedwardnp.org",
  },
  {
    file: "apphosting.sfaroy.yaml",
    projectId: "sfa-roy-parish-site",
    backend: "sfaroy",
    siteUrl: "https://sfaroyparish.org",
  },
];

const stripeBlock = `  # Stripe — server secrets are runtime-only (not needed during next build).
  - variable: STRIPE_SECRET_KEY
    secret: stripeSecretKey
    availability:
      - RUNTIME
  - variable: STRIPE_WEBHOOK_SECRET
    secret: stripeWebhookSecret
    availability:
      - RUNTIME
  - variable: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    secret: stripePublishableKey
    availability:
      - BUILD
      - RUNTIME`;

const stripeCommented = `  # Stripe — uncomment after creating secrets in ${"PROJECT"}:
  # - variable: STRIPE_SECRET_KEY
  #   secret: stripeSecretKey
  #   availability:
  #     - RUNTIME
  # - variable: STRIPE_WEBHOOK_SECRET
  #   secret: stripeWebhookSecret
  #   availability:
  #     - RUNTIME
  # - variable: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  #   secret: stripePublishableKey
  #   availability:
  #     - BUILD
  #     - RUNTIME`;

for (const parish of parishes) {
  let content = base
    .replace(
      "# Firebase App Hosting configuration.",
      `# Firebase App Hosting — ${parish.projectId} (backend: ${parish.backend}, region: us-central1)\n# Copy to apphosting.yaml before connecting this parish's GitHub backend, or set URLs in Console.`,
    )
    .replaceAll("https://www.yourparish.org", parish.siteUrl)
    .replace(stripeBlock, stripeCommented.replaceAll("PROJECT", parish.projectId));

  writeFileSync(join(process.cwd(), parish.file), content);
  console.log(`Wrote ${parish.file}`);
}
