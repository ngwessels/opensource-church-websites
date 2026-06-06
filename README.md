# Open Source Church Websites

An open-source, self-hosted church website builder inspired by eCatholic. Each parish deploys their own instance with their own Firebase project, Stripe account, and custom domain.

## Features

- **Edit Website** — WYSIWYG page editing with content modules (text, links, images, mass times, and more)
- **Design** — Theme gallery, colors, fonts, responsive preview
- **Files** — Pictures and documents library with Firebase Storage
- **Admin** — Overview, settings, users, mass times editor
- **Account** — Profile, password, email verification, optional SMS two-factor authentication
- **Site Map** — Drag-and-drop navigation with unlimited pages, quick links, and 4-level depth
- **Donations** — Stripe Checkout for one-time and monthly giving

## Prerequisites

- Node.js 20+
- npm
- A [Firebase](https://console.firebase.google.com/) project
- A [Stripe](https://dashboard.stripe.com/) account (optional for donations)

## Getting started

```bash
npm install
cp .env.example .env.local
# Fill in Firebase and Stripe credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up at `/signup` — the first user becomes admin and bootstraps the site with a Home page.

Builder: [http://localhost:3000/builder/edit](http://localhost:3000/builder/edit)

## Firebase setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a **Web app** and copy config into `.env.local` (`NEXT_PUBLIC_FIREBASE_*`).
3. Enable **Authentication** (Email/Password + Google), **Cloud Firestore**, and **Storage**.
4. Enable **SMS multi-factor authentication** (optional for users; required in Firebase Console to enroll):
   - **Authentication → Sign-in method → Phone** — enable (used for MFA SMS codes, not primary phone sign-in).
   - **Authentication → Sign-in method → Advanced → SMS Multi-factor Authentication** — enable.
   - **Authentication → Settings → Authorized domains** — add `127.0.0.1` and your production domain (needed for reCAPTCHA).
   - **Local dev:** Phone MFA does **not** work on `http://localhost:3000`. Use `http://127.0.0.1:3000` instead, or add [test phone numbers](https://firebase.google.com/docs/auth/web/phone-auth#test-with-fictional-phone-numbers) in the Firebase Console.
5. Create a **service account** and add `FIREBASE_ADMIN_*` credentials (escape newlines in private key as `\n`).
6. Deploy security rules:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use --add <PROJECT_ID>
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

## Firestore schema (single-tenant)

| Collection | Purpose |
|------------|---------|
| `site/config` | Site name, design, mass times, domain |
| `navNodes/{id}` | Sitemap navigation (unlimited) |
| `pages/{id}` | Page content and modules |
| `media/{id}` | File metadata |
| `mediaFolders/{id}` | File folders |
| `users/{uid}` | Admin/member roles |
| `donations/{id}` | Stripe donation records |

## Custom domain deployment

Each church deploys their own copy to Vercel (or similar) with their own env vars:

1. Fork/clone this repo and create a Firebase project for your parish.
2. Set all `.env.local` variables; set `NEXT_PUBLIC_SITE_URL` to your canonical domain (e.g. `https://www.visitationfg.org`).
3. Deploy to [Vercel](https://vercel.com/) and add your custom domain in project settings.
4. Point DNS A/CNAME records per Vercel's instructions.
5. Configure Stripe webhook to `https://yourdomain.org/api/stripe/webhook`.

Admin → Settings shows environment checklist and domain setup steps.

## Stripe setup

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`. Test donations at `/give`.

## Project structure

```
src/
├── app/
│   ├── (public)/[[...slug]]/   # Public church site
│   ├── (builder)/builder/      # Edit, Design, Files, Admin, Site Map
│   ├── (auth)/                 # Login / signup
│   └── api/stripe/             # Checkout + webhook
├── components/
│   ├── builder/                # Builder shell, toolbar, modules drawer
│   ├── sitemap/                # Drag-and-drop sitemap editor
│   ├── design/                 # Theme and color editors
│   ├── files/                  # Media library
│   ├── admin/                  # Admin tabs
│   └── modules/                # Page content modules
├── hooks/
└── lib/                        # Firebase, Stripe, sitemap, media
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## License

MIT — see [LICENSE](LICENSE).
