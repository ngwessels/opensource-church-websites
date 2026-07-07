# Developer Guide

Technical reference for running, developing, and maintaining Open Source Church Websites locally. For production deployment instructions aimed at parish staff, see [README.md](README.md).

## Prerequisites

- Node.js 20+
- npm
- A [Firebase](https://console.firebase.google.com/) project
- A [Stripe](https://dashboard.stripe.com/) account (optional — for donations)

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in Firebase credentials (and Stripe if testing donations)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sign up at `/signup` — the **first** user becomes admin and bootstraps the site with a Home page. After that, public signup is closed; additional users must be invited by an admin (Builder → Admin → Admin Users).

Builder: [http://localhost:3000/builder/edit](http://localhost:3000/builder/edit) (admin role required)

**Security:** Deploy Firestore and Storage rules before going to production (see [README.md — Step 3](README.md#step-3--deploy-security-rules-required)). CMS data is writable only by users with the `admin` role in Firestore `users/{uid}`.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in values.

| Variable | Required locally | Notes |
|----------|------------------|-------|
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | Yes | From Firebase Console → Project settings → Your apps |
| `FIREBASE_ADMIN_*` (3 vars) | Yes | Service account JSON; required for server routes and MCP |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Yes | Use `http://localhost:3000` locally |
| `STRIPE_*` | No | For testing `/give` |
| `MAILGUN_*` | No | Form email notifications |
| `NEXT_PUBLIC_RECAPTCHA_*`, `RECAPTCHA_SECRET_KEY` | No | Bot protection |
| `MCP_OAUTH_COOKIE_SECRET` | No | Cursor MCP OAuth login |
| `CRON_SECRET` | No | Vercel cron auth for `/api/cron/*` routes |

## Firebase setup (local / advanced)

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a **Web app** and copy config into `.env.local` (`NEXT_PUBLIC_FIREBASE_*`).
3. Enable **Authentication** (Email/Password + Google), **Cloud Firestore**, and **Storage**.
4. Create a **service account** and add `FIREBASE_ADMIN_*` credentials (escape newlines in private key as `\n`).
5. Deploy security rules:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use --add YOUR_PROJECT_ID
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

If you previously had open/temporary rules and unauthorized accounts gained admin access, demote them in Firestore (`users/{uid}.role = "member"`) before or after deploying.

### SMS multi-factor authentication (optional)

To allow users to enroll in SMS two-factor authentication:

- **Authentication → Sign-in method → Phone** — enable (used for MFA SMS codes, not primary phone sign-in)
- **Authentication → Sign-in method → Advanced → SMS Multi-factor Authentication** — enable
- **Authentication → Settings → Authorized domains** — add `127.0.0.1` and your production domain

**Local dev:** Phone MFA does **not** work on `http://localhost:3000`. Use `http://127.0.0.1:3000` instead, or add [test phone numbers](https://firebase.google.com/docs/auth/web/phone-auth#test-with-fictional-phone-numbers) in the Firebase Console.

## Firestore schema (single-tenant)

Each deployment is a single parish. Data lives in one Firebase project.

| Collection | Purpose |
|------------|---------|
| `site/config` | Site name, design, mass times, domain |
| `navNodes/{id}` | Sitemap navigation (unlimited) |
| `pages/{id}` | Page content and modules |
| `media/{id}` | File metadata |
| `mediaFolders/{id}` | File folders |
| `users/{uid}` | Admin, finance, member, and donor roles |
| `donations/{id}` | Stripe donation records |
| `subscriptions/{id}` | Active recurring gift state (synced from Stripe webhooks) |
| `formSubmissions/{id}` | CMS form responses |

## Donor accounts (My Giving)

Parishioners can create a **donor account** separate from staff builder access:

- Sign up / sign in: `/give/account/signup`, `/give/account/login`
- Portal: `/give/account` — donation history, cancel/edit recurring gifts, update card

Staff signup at `/signup` remains first-user / invite-only. Donor signup is always open.

When a donor signs in, past gifts with the same email are linked automatically (`donorUid`, `stripeCustomerIds`).

### Stripe setup for donor self-service

1. Enable **Customer Portal** in the Stripe Dashboard (payment method updates).
2. Configure webhook events on `/api/stripe/webhook`:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

Recurring amount/frequency changes use the Stripe Subscriptions API (dynamic Price creation per update). Deploy Firestore indexes (`firestore.indexes.json`) for donor portal queries.

## Stripe (local webhook testing)

Forward Stripe webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET` in `.env.local`. Test donations at `/give`.

Configure your Stripe webhook endpoint to listen for `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, and subscription lifecycle events (`customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`).

Prefer a restricted API key (`rk_test_...`) for `STRIPE_SECRET_KEY` in development.

## reCAPTCHA v3 (local)

1. Register a **reCAPTCHA v3** site at [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin).
2. Add domains: `localhost`, `127.0.0.1`, and your production domain.
3. Set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` in `.env.local`.
4. Optionally tune `RECAPTCHA_SCORE_THRESHOLD` (default `0.5`; higher is stricter).

When both keys are unset, donations and forms work without verification.

## MCP OAuth (Cursor integration)

Enables OAuth-based login for Cursor MCP clients (no API keys to copy).

Generate a cookie secret:

```bash
openssl rand -base64 32
```

Set in `.env.local`:

| Variable | Purpose |
|----------|---------|
| `MCP_OAUTH_COOKIE_SECRET` | Signs OAuth session cookies |
| `MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS` | Default `3600` |
| `MCP_OAUTH_CODE_TTL_SECONDS` | Default `600` |

Requires `FIREBASE_ADMIN_*` on the server. On Firebase App Hosting, uncomment the MCP block in [`apphosting.yaml`](apphosting.yaml) and create the `mcpOauthCookieSecret` secret.

See [AGENTS.md](AGENTS.md) for MCP tool capabilities.

## Project structure

```
src/
├── app/
│   ├── (public)/[[...slug]]/   # Public church site
│   ├── (builder)/builder/      # Edit, Design, Files, Admin, Site Map
│   ├── (auth)/                 # Login / signup
│   └── api/                    # Stripe, forms, MCP, auth, etc.
├── components/
│   ├── builder/                # Builder shell, toolbar, modules drawer
│   ├── sitemap/                # Drag-and-drop sitemap editor
│   ├── design/                 # Theme and color editors
│   ├── files/                  # Media library
│   ├── admin/                  # Admin tabs
│   └── modules/                # Page content modules
├── hooks/
└── lib/                        # Firebase, Stripe, sitemap, media, calendar
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (webpack) |
| `npm run dev:turbo` | Start dev server (Turbopack) |
| `npm run dev:clean` | Clear `.next` cache and start dev |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |
| `npm run import:bulletins` | Import bulletins from eCatholic scrape data |
| `npm run import:bulletins:dry` | Dry-run bulletin import |

## Production deployment

Parish deployment guides (Vercel and Firebase App Hosting) are in [README.md](README.md).

Key technical notes:

- **Vercel:** All variables from `.env.example` including `FIREBASE_ADMIN_*`. [`vercel.json`](vercel.json) sets longer timeouts for MCP routes.
- **Firebase App Hosting:** Secrets via [`apphosting.yaml`](apphosting.yaml) and Cloud Secret Manager. `FIREBASE_ADMIN_*` optional (ADC). **Do not** duplicate those variables as plaintext in the Firebase Console — Console overrides win, and the preparer step logs resolved values in Cloud Build (`Final app hosting schema`). Keep server secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MCP_OAUTH_COOKIE_SECRET`, `RECAPTCHA_SECRET_KEY`, Mailgun, etc.) on `RUNTIME` only in `apphosting.yaml`.
- Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` to the canonical production domain.
- Stripe webhook: `https://yourdomain.org/api/stripe/webhook`

## Contributing

See [AGENTS.md](AGENTS.md) for AI assistant and MCP tooling conventions used in this repository.

## License

MIT — see [LICENSE](LICENSE).
