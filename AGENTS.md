<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Verification

Do **not** run `npm run build` as a routine check after every change. Running production builds repeatedly interferes with local development (locks, stale output, and conflicts with `next dev`).

Prefer lighter verification instead:

- **Lint / typecheck** when available (e.g. `npm run lint`, or the IDE linter on edited files).
- **Targeted checks** — curl or fetch a specific route, run a focused script, or inspect the changed module.
- **`next dev`** — if the dev server is already running, confirm behavior in the browser or via API requests.
- **`npm run build`** — only when the user explicitly asks for a production build, or when validating a release/deploy-specific issue that cannot be checked another way.

## MCP (`parish-site`)

When the `parish-site` server is enabled in `~/.cursor/mcp.json`, use its tools to manage the live church site (same content capabilities as the builder UI). Tool definitions live in `src/lib/mcp/server.js`; implementation is in `src/lib/cms/*`.

Call `get_site_summary` or `get_builder_capabilities` first when exploring an unfamiliar site. The capabilities response includes design playbooks, module schemas, and media folder IDs.

**Pages & modules**

- `list_pages`, `get_page`, `update_page` — page metadata, layout, regions, SEO, `pageType`, `heroSlideshowEnabled`, `donationConfig`
- `add_module`, `add_modules_batch`, `update_module`, `move_module`, `remove_module` — content modules
- `publish_page`, `publish_all_pages`, `revert_page` — draft/publish workflow

**Navigation / sitemap**

- `list_nav_nodes`, `get_nav_tree`, `save_sitemap` — full sitemap read/write
- `add_nav_page`, `delete_nav_node` — add or remove a single page without rebuilding the full tree

**Site settings & design**

- `get_site_config`, `update_site_settings` — name, tagline, canonical domain, social media, SEO
- `list_design_themes`, `apply_design_theme`, `update_site_design` — theme gallery and design
- `get_header_config`, `update_header_config`, `update_header_styles` — header layout, logo, colors, fonts
- `get_footer_config`, `update_footer_config` — footer columns and styles
- `update_mass_times` — mass times schedule

**Media library**

- `list_media`, `get_media`, `list_media_folders` — browse files
- `upload_media`, `upload_media_batch` — prefer `sourceUrl` (≤10 MB); single-shot base64 ≤**1 MB** and **requires `expectedSizeBytes`**
- `begin_media_upload` → `upload_media_chunk` → `complete_media_upload` — **required for local files over ~100KB**
- `update_media`, `delete_media` — metadata and removal

Folders: `pictures-root` (images), `documents-root` (PDFs), `unused-pictures` (staging). Use returned `downloadUrl` in module configs.

**Vercel payload limits**

The MCP server is hosted on Vercel. Each tool call is an HTTP request with a **~4.5 MB body limit**. Large base64 in one `upload_media` call will 413 or get truncated by the client — that produced the corrupt undersized files.

| Method | Limit | Notes |
|--------|-------|--------|
| `sourceUrl` | 10 MB | **Preferred** — server fetches; not limited by request body |
| Single-shot `base64` | ~1 MB decoded | Requires `expectedSizeBytes` |
| Chunked upload | 10 MB total | ~**96 KB** binary per chunk (~128 KB base64) |

**Reliable local file upload (chunked)**

1. Measure the file → `expectedSizeBytes`
2. `begin_media_upload` with `folderId`, `filename`, `mimeType`, `expectedSizeBytes`
3. Split the **raw binary** into ~96KB chunks; base64-encode **each chunk separately**
4. `upload_media_chunk` for `chunkIndex` 0, 1, 2… until `remainingBytes` is 0
5. `complete_media_upload` → verify returned `sizeBytes` matches the original

If the file is already on the public web, use `upload_media` with `sourceUrl` instead.

**Bulletins**

- `list_bulletins`, `create_bulletin`, `delete_bulletin`
- Workflow: set page `pageType: "bulletins"` → chunked upload or `upload_media` (documents-root) → `create_bulletin` → `publish_page` if needed

**Admin documentation**

- `get_admin_documentation`, `save_admin_documentation`, `upsert_admin_documentation_note`, `delete_admin_documentation_note`
- Shared operational notes for admins (domain registrar, hosting account, where passwords are kept, etc.). Editable in the builder under **Admin → Documentation**.
- Workflow: `get_admin_documentation` before operational changes → `upsert_admin_documentation_note` to add a fact → `save_admin_documentation` to reorder the full list

**Audit log**

- Immutable `auditEvents` collection records admin create/update/delete/publish actions with actor (`uid`, `email`, `role`), timestamp, source (`ui` | `mcp` | `api`), resource, optional builder context, and full before/after snapshots in `auditEvents/{id}/snapshots/{before|after}`.
- Browse in the builder under **Admin → Audit Log**, or via `GET /api/admin/audit` and `GET /api/admin/audit/{eventId}`.
- Server mutations log through `src/lib/audit/record.server.js` (`lib/cms/*`, API routes). Builder UI logs through `POST /api/admin/audit` after each Firestore write (no client write to `auditEvents`).

**Discovery**

- `get_builder_capabilities` — module types, layouts, region rules, `moduleConfigSchemas`, design playbooks
- `get_site_summary` — quick overview of pages, nav, and design
- `search_site_content` — find text across all pages, modules, settings, bulletins, media, and admin documentation notes

**Site content search**

Use `search_site_content` with `{ query: "Jane Doe" }` to find names, events, or phrases anywhere on the site. Results include `source`, `snippet`, `pageTitle`, `moduleType`, `field`, and `builderUrl` for editing. Also available in the builder via **Search** (⌘K / Ctrl+K) or `GET /api/admin/search?q=...`.

**Module types**

`text`, `links`, `buttons`, `image`, `gallery`, `photo_albums`, `slideshow`, `feature_tiles`, `carousel`, `video`, `zoom`, `mass_times`, `daily_readings`, `calendar`, `documents`, `people`, `form`, `embed`, `facebook`, `google_maps`, `instagram`, `rss`

**Buttons module**

Config shape: `{ items: [{ label, href }] }`. No section title. Use sitemap paths (e.g. `/about`) or full URLs for `href`.

**Documents module**

Config shape: `{ title, items: [{ label, url }] }`. Items use `url` (not `href`).

1. `add_module` with `type: "documents"`
2. Upload PDF via chunked upload (`begin_media_upload` → chunks → `complete_media_upload`) or `upload_media` with `sourceUrl` / base64+`expectedSizeBytes` (`folderId: "documents-root"`)
3. `update_module` with `config: { title, items: [{ label, url: downloadUrl }] }`
4. `publish_page`

**Slideshow module (hero)**

Config shape: `{ slides: [{ src, alt, caption, title, subtitle, ctaLabel, ctaHref, objectPositionByViewport }] }`.

Place in the `features` region. Set `src` to `downloadUrl` from `upload_media`.

Per-slide `objectPositionByViewport` controls image crop on different screen sizes: `{ mobile, tablet, desktop }` each set to a 9-point preset (`top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`). Unset viewports fall back: tablet → mobile, desktop → tablet → mobile (default `center`).

**Social media (global)**

Config shape on `site/config`: `{ showInHeader, showInFooter, items: [{ platform, url }] }`. Platforms: `facebook`, `instagram`, `youtube`, `x`. Use `update_site_settings` with a `socialMedia` object.

**Forms module**

Config shape: `{ formId, title, description, submitLabel, successMessage, notificationEmails, fields: [{ id, type, label, ... }] }`.

Field types: `heading`, `paragraph`, `text`, `email`, `phone`, `textarea`, `select`, `radio`, `checkbox`, `date`, `file`.

1. `add_module` with `type: "form"`
2. `update_module` with fields and `notificationEmails` (Mailgun recipients)
3. `publish_page` — public submissions go to `POST /api/forms/submit` with `formId`

Requires `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `MAILGUN_FROM` for email notifications.

**Donation pages**

1. `add_nav_page` or use existing page
2. `update_page` with `pageType: "donation"` and optional `donationConfig` (`title`, `description`, `funds`, `presetAmountsCents`, `comments`)
3. `publish_page`

**Site analytics**

First-party analytics for public parish pages (alongside optional Firebase Analytics). Data is stored in Firestore `analyticsEvents` (page views, engagement) and `analyticsHeatmapRollups` (click/scroll heatmaps).

- `get_site_analytics` — site-wide report for a date range (`dateFrom`, `dateTo`, optional `pagePath`)
- `get_page_analytics` — per-page report (`dateFrom`, `dateTo`, plus `pagePath` or `pageId`)
- `get_page_heatmap` — per-page click/tap and scroll-depth heatmap (`dateFrom`, `dateTo`, plus `pagePath` or `pageId`, optional `deviceType`: `mobile`, `tablet`, or `desktop`)

Reports include page views, visitors, sessions, bounce rate, average engagement, daily trend, top pages, referrers, traffic sources, devices, browsers, and countries. Builder UI: **Analytics** tab.

Heatmap responses include `totalClicks`, `totalSessions`, `clicks` (grid cells with `xPercent`/`yPercent`), `scrollBuckets` (depth reached per 10% step), and `hotspots` (top tap areas with verbal labels like `upper-right`). Coordinates are document-relative percentages, not pixel-perfect element IDs. The builder heatmap viewer overlays data on a live iframe of the published page.

**Full-site design playbook**

1. `get_site_summary` + `list_pages` + `get_nav_tree`
2. `list_design_themes` → `apply_design_theme` (optional color/font overrides)
3. `update_site_settings`, `update_header_config`, `update_footer_config`, `update_mass_times`
4. `add_nav_page` for each section
5. Per page: `upload_media_batch` → `add_modules_batch` → `update_module` for fine-tuning
6. `publish_all_pages`

Prefer MCP tools when the user wants site content or design changed from Cursor.
