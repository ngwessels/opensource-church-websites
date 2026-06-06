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

When the `parish-site` server is enabled in `~/.cursor/mcp.json`, use its tools to manage the live church site (same capabilities as the builder UI). Tool definitions live in `src/lib/mcp/server.js`; implementation is in `src/lib/cms/*`.

**Pages & modules**

- `list_pages`, `get_page`, `update_page` — page metadata, layout, regions, SEO
- `add_module`, `update_module`, `move_module`, `remove_module` — content modules (`text`, `links`, `buttons`, `image`, `gallery`, `slideshow`, `carousel`, `video`, `zoom`, `mass_times`, `daily_readings`, `calendar`, `documents`, `people`, `embed`, `facebook`, `google_maps`, `instagram`, `rss`)
- `publish_page`, `revert_page` — draft/publish workflow

**Navigation / sitemap**

- `list_nav_nodes`, `get_nav_tree`, `save_sitemap` — flat or hierarchical nav; save full sitemap

**Site settings & design**

- `get_site_config`, `update_site_settings` — name, tagline, canonical domain
- `update_site_design` — theme, colors, fonts, layout
- `get_header_config`, `update_header_config`, `update_header_styles` — header layout, logo, tagline, colors, fonts
- `update_footer_config`, `update_mass_times` — footer and mass times schedule

**Media library**

- `list_media`, `get_media`, `list_media_folders` — browse files with description, alt, tags
- `upload_media` — base64 or `sourceUrl` (max ~3MB); optional description, alt, tags
- `update_media`, `delete_media` — metadata and removal

**Discovery**

- `get_builder_capabilities` — module types, layouts, region rules, and `moduleConfigSchemas`
- `get_site_summary` — quick overview of pages, nav, and design

**Buttons module**

Config shape: `{ items: [{ label, href }] }`. No section title. Use sitemap paths (e.g. `/about`) or full URLs for `href`.

**Documents module**

Config shape: `{ title, items: [{ label, url }] }`. Items use `url` (not `href`).

1. `add_module` with `type: "documents"`
2. `upload_media` with `folderId: "documents-root"` (returns `downloadUrl`)
3. `update_module` with `config: { title, items: [{ label, url: downloadUrl }] }`
4. `publish_page`

External URLs can be used directly in `url` without uploading. Call `get_builder_capabilities` for full schema details.

Prefer MCP tools when the user wants site content or design changed from Cursor. Call `get_site_summary` or `get_builder_capabilities` first when unsure of current structure.
