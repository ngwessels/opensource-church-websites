import "server-only";

import { z } from "zod";

import * as nav from "@/lib/cms/nav";
import * as pages from "@/lib/cms/pages";
import * as site from "@/lib/cms/site";
import * as media from "@/lib/cms/media";
import * as bulletins from "@/lib/cms/bulletins";
import * as documentation from "@/lib/cms/documentation";
import * as analytics from "@/lib/cms/analytics";
import * as search from "@/lib/cms/content-search";
import { setMcpToolName } from "@/lib/cms/auth";
import { MODULE_TYPES } from "@/lib/modules/registry";

function jsonResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

async function run(toolName, fn) {
  try {
    if (toolName) setMcpToolName({ toolName });
    const result = await fn();
    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : "Unknown error");
  }
}

const moduleTypeSchema = z.enum(
  /** @type {[string, ...string[]]} */ (MODULE_TYPES),
);

const headerStylesSchema = z.object({
  headerBackground: z
    .string()
    .optional()
    .describe("Header banner background color (hex/rgb). Empty uses design.colors.primary."),
  navBackground: z
    .string()
    .optional()
    .describe("Navigation bar background color. Empty uses design.colors.secondary."),
  titleColor: z.string().optional().describe("Site title text color."),
  taglineColor: z.string().optional().describe("Tagline text color."),
  navTextColor: z.string().optional().describe("Navigation link text color."),
  titleFont: z.string().optional().describe("Title font family. Empty uses design.fonts.heading."),
  taglineFont: z.string().optional().describe("Tagline font family. Empty uses design.fonts.body."),
  navFont: z.string().optional().describe("Navigation font family. Empty uses design.fonts.body."),
  titleFontWeight: z.string().optional().describe("Title font weight, e.g. 400, 500, 600, 700."),
  titleFontSize: z.string().optional().describe("Title font size CSS value, e.g. 2.25rem."),
  navFontSize: z.string().optional().describe("Navigation font size CSS value, e.g. 0.875rem."),
});

const headerConfigSchema = z.object({
  showTagline: z.boolean().optional(),
  showLogo: z.boolean().optional(),
  logoUrl: z.string().optional(),
  layout: z.enum(["centered", "logoLeft"]).optional(),
  styles: headerStylesSchema.optional(),
});

const socialMediaSchema = z.object({
  showInHeader: z.boolean().optional().describe("Show social icon links in the site header."),
  showInFooter: z.boolean().optional().describe("Show social icon links in the site footer."),
  items: z
    .array(
      z.object({
        platform: z.enum(["facebook", "instagram", "youtube", "x"]),
        url: z.string().describe("Profile or page URL."),
      }),
    )
    .optional(),
});

const siteDesignSchema = z.object({
  themeId: z
    .string()
    .optional()
    .describe("Design theme id (e.g. verona, calvary, condit). Replaces legacy color-swap ids."),
  colors: z
    .object({
      primary: z.string().optional().describe("Default header background when headerBackground is unset."),
      secondary: z.string().optional().describe("Default nav background when navBackground is unset."),
      accent: z.string().optional(),
    })
    .optional(),
  fonts: z
    .object({
      heading: z.string().optional().describe("Default title font when titleFont is unset."),
      body: z.string().optional().describe("Default tagline/nav font when those are unset."),
    })
    .optional(),
  layout: z
    .object({
      header: z.enum(["centered", "logoLeft"]).optional(),
      nav: z.enum(["solid", "transparent"]).optional(),
    })
    .optional()
    .describe("Legacy layout flags; prefer structure when setting a full theme."),
  structure: z
    .object({
      headerVariant: z
        .enum([
          "centeredBanner",
          "logoLeftStack",
          "inlineNav",
          "minimalBar",
          "heroBand",
          "lightLogoLeft",
          "lightCentered",
        ])
        .optional(),
      navVariant: z
        .enum(["barBelow", "inlineHeader", "underlineTabs", "pillTabs", "minimalText"])
        .optional(),
      footerVariant: z
        .enum(["lightColumns", "darkBand", "minimalCenter", "accentBar"])
        .optional(),
      moduleVariant: z.enum(["classic", "card", "flatBar", "bordered"]).optional(),
      quickLinksVariant: z.enum(["inline", "utilityBar", "boxedCta"]).optional(),
      featuresVariant: z.enum(["slideshow", "tileGrid", "none"]).optional(),
      heroCaptionVariant: z.enum(["bottomGradient", "centered", "overlayBoxLeft"]).optional(),
      headerTone: z.enum(["dark", "light"]).optional(),
    })
    .optional(),
  tokens: z
    .object({
      typography: z
        .object({
          titleSize: z.string().optional(),
          navUppercase: z.boolean().optional(),
          headingWeight: z.string().optional(),
          letterSpacing: z.string().optional(),
        })
        .optional(),
      spacing: z
        .object({
          contentMaxWidth: z.string().optional(),
          headerPaddingY: z.string().optional(),
        })
        .optional(),
      shape: z
        .object({
          moduleRadius: z.string().optional(),
          buttonRadius: z.string().optional(),
          moduleShadow: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const donationConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  funds: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  presetAmountsCents: z.array(z.number().int().min(100)).optional(),
  comments: z
    .object({
      enabled: z.boolean().optional(),
      label: z.string().optional(),
      placeholder: z.string().optional(),
    })
    .optional(),
});

const mediaUploadFileSchema = z.object({
  folderId: z.string(),
  filename: z.string(),
  mimeType: z.string().optional(),
  base64: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  description: z.string().max(500).optional(),
  alt: z.string().max(200).optional(),
  tags: z.array(z.string()).max(20).optional(),
});

/** @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server */
export function registerMcpTools(server) {
  server.registerTool(
    "list_pages",
    { description: "List all site pages", inputSchema: {} },
    async () => run("list_pages", () => pages.listPagesAdmin()),
  );

  server.registerTool(
    "get_page",
    {
      description: "Get a page by pageId or slug",
      inputSchema: {
        pageId: z.string().optional(),
        slug: z.string().optional(),
      },
    },
    async ({ pageId, slug }) => run("null", () => pages.getPageAdmin({ pageId, slug })),
  );

  server.registerTool(
    "update_page",
    {
      description: "Update page metadata, layout, or regions",
      inputSchema: {
        pageId: z.string(),
        title: z.string().optional(),
        slug: z.string().optional(),
        layout: z.enum(["default", "full-width", "sidebar-left", "sidebar-right"]).optional(),
        contentMarginX: z
          .enum(["none", "sm", "md", "lg", "xl"])
          .optional()
          .describe("Horizontal margin for page content (none, sm, md, lg, xl). Desktop default."),
        contentMarginXByViewport: z
          .object({
            mobile: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
            tablet: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
            desktop: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
          })
          .optional()
          .describe("Per-viewport horizontal margin overrides."),
        contentColumns: z.number().int().min(1).max(4).optional(),
        contentColumnsByViewport: z
          .object({
            mobile: z.number().int().min(1).max(3).optional(),
            tablet: z.number().int().min(1).max(3).optional(),
            desktop: z.number().int().min(1).max(3).optional(),
          })
          .optional()
          .describe(
            "Per-viewport content column counts. When a viewport has 1 column, module order is controlled by contentStackOrderByViewport.",
          ),
        contentStackOrderByViewport: z
          .object({
            mobile: z.array(z.string()).optional(),
            tablet: z.array(z.string()).optional(),
          })
          .optional()
          .describe(
            "Per-viewport module order for single-column viewports (mobile/tablet). Desktop placement uses regions. move_module edits regions only.",
          ),
        maxModulesPerRegion: z.number().int().min(1).optional(),
        seo: z.record(z.unknown()).optional(),
        regions: z.array(z.record(z.unknown())).optional(),
        hidden: z
          .boolean()
          .optional()
          .describe("When true, page is hidden from the public site and navigation."),
        pageType: z
          .enum(["content", "bulletins", "donation"])
          .optional()
          .describe("Page type: content (default), bulletins (archive), or donation (online giving)."),
        heroSlideshowEnabled: z
          .boolean()
          .optional()
          .describe("When true, enables the hero/features region for slideshow modules."),
        donationConfig: donationConfigSchema
          .optional()
          .describe("Donation page configuration (use with pageType donation)."),
      },
    },
    async ({ pageId, ...updates }) => run("null", () => pages.updatePageAdmin(pageId, updates)),
  );

  server.registerTool(
    "add_module",
    {
      description: "Add a module to a page region",
      inputSchema: {
        pageId: z.string(),
        type: moduleTypeSchema,
        region: z.string().default("content-1"),
        insertIndex: z.number().int().min(0).optional(),
      },
    },
    async (args) => run("null", () => pages.addModuleAdmin(args.pageId, args)),
  );

  server.registerTool(
    "add_modules_batch",
    {
      description:
        "Add multiple modules to a page in one call. Each module can include an optional config merged with defaults. Validates all placement rules before committing.",
      inputSchema: {
        pageId: z.string(),
        modules: z.array(
          z.object({
            type: moduleTypeSchema,
            region: z.string().optional(),
            insertIndex: z.number().int().min(0).optional(),
            config: z.record(z.unknown()).optional(),
          }),
        ),
      },
    },
    async ({ pageId, modules }) => run("null", () => pages.addModulesBatchAdmin(pageId, modules)),
  );

  server.registerTool(
    "update_module",
    {
      description:
        "Update a module config on a page. Common types: links {title, items: [{label, href}]}; buttons {items: [{label, href}]}; photo_albums {title, albums: [{label, href, imageSrc, photoCount?}]}; documents {title, items: [{label, url, mediaId?, displayMode?: link|inline}]} — upload PDFs via upload_media with folderId documents-root, set url to downloadUrl and mediaId to returned id; use displayMode inline to embed PDF on page (library PDFs only); people {title, people: [{id, name, role?, email?, phone?, photoUrl?}]}. Embed types: embed {title, embedUrl, html, height}; facebook {title, pageUrl, embedUrl, width, height}; google_maps {title, embedUrl, height}; instagram {title, postUrl, embedUrl, height}; rss {title, feedUrl, maxItems}.",
      inputSchema: {
        pageId: z.string(),
        moduleId: z.string(),
        config: z.record(z.unknown()),
      },
    },
    async ({ pageId, moduleId, config }) =>
      run("null", () => pages.updateModuleAdmin(pageId, moduleId, config)),
  );

  server.registerTool(
    "move_module",
    {
      description: "Move a module to another region or position",
      inputSchema: {
        pageId: z.string(),
        moduleId: z.string(),
        toRegionId: z.string(),
        insertIndex: z.number().int().min(0),
      },
    },
    async (args) => run("null", () => pages.moveModuleAdmin(args.pageId, args)),
  );

  server.registerTool(
    "remove_module",
    {
      description: "Remove a module from a page",
      inputSchema: { pageId: z.string(), moduleId: z.string() },
    },
    async ({ pageId, moduleId }) => run("null", () => pages.removeModuleAdmin(pageId, moduleId)),
  );

  server.registerTool(
    "publish_page",
    {
      description: "Publish a page draft to the live site",
      inputSchema: { pageId: z.string() },
    },
    async ({ pageId }) => run("null", () => pages.publishPageAdmin(pageId)),
  );

  server.registerTool(
    "publish_all_pages",
    {
      description: "Publish all pages to the live site (use after a site-wide redesign)",
      inputSchema: {},
    },
    async () => run("null", () => pages.publishAllPagesAdmin()),
  );

  server.registerTool(
    "revert_page",
    {
      description: "Revert a page draft to the last published snapshot",
      inputSchema: { pageId: z.string() },
    },
    async ({ pageId }) => run("null", () => pages.revertPageAdmin(pageId)),
  );

  server.registerTool(
    "list_nav_nodes",
    { description: "List all navigation nodes (flat)", inputSchema: {} },
    async () => run("null", () => nav.listNavNodesAdmin()),
  );

  server.registerTool(
    "get_nav_tree",
    { description: "Get hierarchical navigation tree", inputSchema: {} },
    async () => run("null", () => nav.getNavTreeAdmin()),
  );

  server.registerTool(
    "save_sitemap",
    {
      description:
        "Save the full sitemap as a flat array of nav nodes. Node shape: { id, type (page|secure_page|link|group), title, slug?, externalUrl?, parentId, order, pageId?, isQuickLink?, quickLinkOrder?, hideInNav? }. Prefer add_nav_page for single-page additions.",
      inputSchema: {
        nodes: z.array(z.record(z.unknown())),
      },
    },
    async ({ nodes }) =>
      run("null", async () => {
        const existing = await nav.listNavNodesAdmin();
        return nav.saveSitemapAdmin(
          nodes,
          existing.map((n) => n.id),
          existing.map((n) => n.pageId),
        );
      }),
  );

  server.registerTool(
    "add_nav_page",
    {
      description:
        "Add a single page to the sitemap without rebuilding the full nav tree. Creates nav node and page record.",
      inputSchema: {
        title: z.string(),
        slug: z.string().optional(),
        parentId: z.string().nullable().optional(),
        type: z.enum(["page", "secure_page", "link", "group"]).optional(),
        isQuickLink: z.boolean().optional(),
      },
    },
    async (args) => run("null", () => nav.addNavPageAdmin(args)),
  );

  server.registerTool(
    "delete_nav_node",
    {
      description:
        "Remove a nav node and all descendants from the sitemap. Does not delete orphaned page records.",
      inputSchema: { nodeId: z.string() },
    },
    async ({ nodeId }) => run("null", () => nav.deleteNavNodeAdmin(nodeId)),
  );

  server.registerTool(
    "get_site_config",
    { description: "Get site configuration", inputSchema: {} },
    async () => run("null", () => site.getSiteConfigAdmin()),
  );

  server.registerTool(
    "update_site_design",
    {
      description:
        "Update site-wide design theme, colors, and fonts. Merges with existing design. Use update_header_styles for header-specific overrides.",
      inputSchema: { design: siteDesignSchema },
    },
    async ({ design }) => run("null", () => site.updateSiteDesignAdmin(design)),
  );

  server.registerTool(
    "list_design_themes",
    {
      description:
        "List available design themes (id, name, description, colors, fonts, structure). Use before apply_design_theme.",
      inputSchema: {},
    },
    async () => run("null", () => site.listDesignThemes()),
  );

  server.registerTool(
    "apply_design_theme",
    {
      description:
        "Apply a catalog theme in one call (like selecting a theme in the Design panel). Optional color/font/structure overrides merge on top.",
      inputSchema: {
        themeId: z.string(),
        colors: siteDesignSchema.shape.colors.optional(),
        fonts: siteDesignSchema.shape.fonts.optional(),
        structure: siteDesignSchema.shape.structure.optional(),
      },
    },
    async (args) => run("null", () => site.applyDesignThemeAdmin(args)),
  );

  server.registerTool(
    "update_site_settings",
    {
      description:
        "Update site name, tagline, canonical domain, timezone, site-wide SEO settings, or global social media links",
      inputSchema: {
        name: z.string().optional(),
        tagline: z.string().optional(),
        canonicalDomain: z.string().optional(),
        timezone: z.string().optional(),
        seo: z
          .object({
            description: z.string().optional(),
            faviconUrl: z.string().optional(),
          })
          .optional(),
        socialMedia: socialMediaSchema.optional(),
      },
    },
    async (args) => run("null", () => site.updateSiteSettingsAdmin(args)),
  );

  server.registerTool(
    "update_header_config",
    {
      description:
        "Update header layout and display options (logo, tagline visibility, layout). Merges with existing headerConfig.",
      inputSchema: { headerConfig: headerConfigSchema },
    },
    async ({ headerConfig }) => run("null", () => site.updateHeaderConfigAdmin(headerConfig)),
  );

  server.registerTool(
    "update_header_styles",
    {
      description:
        "Update header colors and fonts: title/tagline/nav text colors, header and nav background colors, and font families/sizes. Merges with existing headerConfig.styles.",
      inputSchema: { styles: headerStylesSchema },
    },
    async ({ styles }) => run("null", () => site.updateHeaderStylesAdmin(styles)),
  );

  server.registerTool(
    "get_header_config",
    {
      description:
        "Get header configuration including resolved-friendly styles (name, tagline, layout, colors, fonts).",
      inputSchema: {},
    },
    async () =>
      run("null", async () => {
        const config = await site.getSiteConfigAdmin();
        return {
          name: config.name,
          tagline: config.tagline,
          headerConfig: config.headerConfig,
          design: config.design,
        };
      }),
  );

  server.registerTool(
    "get_footer_config",
    {
      description: "Get footer configuration (columns, copyright text, styles).",
      inputSchema: {},
    },
    async () =>
      run("null", async () => {
        const config = await site.getSiteConfigAdmin();
        return {
          name: config.name,
          tagline: config.tagline,
          footerConfig: config.footerConfig,
        };
      }),
  );

  server.registerTool(
    "update_footer_config",
    {
      description:
        "Update footer configuration: copyright text, columns, and styles (footerBackground, headingColor, textColor, linkColor, copyrightColor, fonts, sizes).",
      inputSchema: { footerConfig: z.record(z.unknown()) },
    },
    async ({ footerConfig }) => run("null", () => site.updateFooterConfigAdmin(footerConfig)),
  );

  server.registerTool(
    "update_mass_times",
    {
      description:
        "Update mass times: { weekly: { saturday, sunday, weekday }, holidays: [{ name, date, times, notes }], special: [{ name, date, endDate?, times, notes }], holyDays: string[], adoration: string[], confession: string[] }",
      inputSchema: { massTimes: z.record(z.unknown()) },
    },
    async ({ massTimes }) => run("null", () => site.updateMassTimesAdmin(massTimes)),
  );

  server.registerTool(
    "list_media",
    {
      description:
        "List media files with metadata (name, description, alt, tags, downloadUrl), optionally filtered by folderId",
      inputSchema: { folderId: z.string().optional() },
    },
    async ({ folderId }) => run("null", () => media.listMediaAdmin({ folderId })),
  );

  server.registerTool(
    "get_media",
    {
      description: "Get a single media file by mediaId, including description, alt, and tags",
      inputSchema: { mediaId: z.string() },
    },
    async ({ mediaId }) => run("null", () => media.getMediaAdmin(mediaId)),
  );

  server.registerTool(
    "list_media_folders",
    { description: "List media folders", inputSchema: {} },
    async () => run("null", () => media.listMediaFoldersAdmin()),
  );

  server.registerTool(
    "upload_media",
    {
      description:
        "Upload media via base64 (max ~3MB) or sourceUrl. Optional description, alt, and tags help identify the file later. For documents modules, use folderId documents-root, set item url to the returned downloadUrl and mediaId to the returned id; use displayMode inline on the item to embed PDFs on the page.",
      inputSchema: {
        folderId: z.string(),
        filename: z.string(),
        mimeType: z.string().optional(),
        base64: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        description: z.string().max(500).optional(),
        alt: z.string().max(200).optional(),
        tags: z.array(z.string()).max(20).optional(),
      },
    },
    async (args) => run("null", () => media.uploadMediaAdmin(args)),
  );

  server.registerTool(
    "upload_media_batch",
    {
      description:
        "Upload multiple files in one call. Each file uses base64 (max ~3MB) or sourceUrl (max ~10MB). Returns uploaded records and per-file errors (partial success allowed). Use pictures-root for images, documents-root for PDFs.",
      inputSchema: {
        files: z.array(mediaUploadFileSchema),
      },
    },
    async ({ files }) => run("null", () => media.uploadMediaBatchAdmin({ files })),
  );

  server.registerTool(
    "update_media",
    {
      description: "Update media metadata: description, alt, and/or tags",
      inputSchema: {
        mediaId: z.string(),
        description: z.string().max(500).optional(),
        alt: z.string().max(200).optional(),
        tags: z.array(z.string()).max(20).optional(),
      },
    },
    async ({ mediaId, ...fields }) => run("null", () => media.updateMediaAdmin(mediaId, fields)),
  );

  server.registerTool(
    "delete_media",
    {
      description: "Delete a media record",
      inputSchema: { mediaId: z.string() },
    },
    async ({ mediaId }) => run("null", () => media.deleteMediaAdmin(mediaId)),
  );

  server.registerTool(
    "list_bulletins",
    {
      description: "List bulletin archive sorted by date (newest first)",
      inputSchema: {},
    },
    async () => run("null", () => bulletins.listBulletinsAdmin()),
  );

  server.registerTool(
    "create_bulletin",
    {
      description:
        "Create a bulletin record. Upload PDF first via upload_media (folderId documents-root), then pass mediaId and downloadUrl.",
      inputSchema: {
        date: z.string().describe("Publish date YYYY-MM-DD"),
        title: z.string().optional(),
        mediaId: z.string(),
        downloadUrl: z.string(),
      },
    },
    async (args) => run("null", () => bulletins.createBulletinAdmin(args)),
  );

  server.registerTool(
    "delete_bulletin",
    {
      description: "Delete a bulletin by bulletinId",
      inputSchema: { bulletinId: z.string() },
    },
    async ({ bulletinId }) => run("null", () => bulletins.deleteBulletinAdmin(bulletinId)),
  );

  const adminDocumentationNoteSchema = z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    order: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  });

  server.registerTool(
    "get_admin_documentation",
    {
      description:
        "Get shared admin documentation notes (domain registrar, hosting account, password locations, etc.) visible to all admins.",
      inputSchema: {},
    },
    async () => run("null", () => documentation.getAdminDocumentationAdmin()),
  );

  server.registerTool(
    "save_admin_documentation",
    {
      description:
        "Replace the full admin documentation notes list. Use for reordering or bulk updates after get_admin_documentation.",
      inputSchema: {
        notes: z.array(adminDocumentationNoteSchema),
      },
    },
    async ({ notes }) =>
      run("null", () =>
        documentation.saveAdminDocumentationAdmin({
          notes,
          updatedBy: { source: "mcp" },
        }),
      ),
  );

  server.registerTool(
    "upsert_admin_documentation_note",
    {
      description:
        "Add or update a single admin documentation note. Omit id to create; pass id to update an existing note.",
      inputSchema: {
        id: z.string().optional(),
        title: z.string(),
        body: z.string(),
        order: z.number().optional(),
      },
    },
    async (args) =>
      run("null", () =>
        documentation.upsertAdminDocumentationNoteAdmin({
          ...args,
          updatedBy: { source: "mcp" },
        }),
      ),
  );

  server.registerTool(
    "delete_admin_documentation_note",
    {
      description: "Delete a single admin documentation note by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => run("null", () => documentation.deleteAdminDocumentationNoteAdmin({ id })),
  );

  server.registerTool(
    "search_site_content",
    {
      description:
        "Search all site content for text: page titles, module content (text, people, calendar events, links, etc.), site settings, mass times, footer, navigation labels, bulletins, and media metadata. Returns snippets with page/module context and builderUrl for editing.",
      inputSchema: {
        query: z.string().describe("Text to search for (person name, event title, phrase, etc.)"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 50)"),
      },
    },
    async ({ query, limit }) => run("null", () => search.searchSiteContentAdmin({ query, limit })),
  );

  server.registerTool(
    "get_builder_capabilities",
    {
      description: "Get module types, layouts, and region rules for the builder",
      inputSchema: {},
    },
    async () => run("null", () => site.getBuilderCapabilities()),
  );

  server.registerTool(
    "get_site_summary",
    {
      description: "Quick overview of site pages, nav, and design",
      inputSchema: {},
    },
    async () => run("null", () => site.getSiteSummaryAdmin()),
  );

  server.registerTool(
    "get_site_analytics",
    {
      description:
        "Site-wide analytics report for a date range: page views, visitors, sessions, bounce rate, engagement, top pages, referrers, devices, and countries. Public parish pages only.",
      inputSchema: {
        dateFrom: z.string().describe("Start date (YYYY-MM-DD or ISO)"),
        dateTo: z.string().describe("End date (YYYY-MM-DD or ISO)"),
        pagePath: z.string().optional().describe("Optional page path filter (e.g. /about)"),
      },
    },
    async ({ dateFrom, dateTo, pagePath }) =>
      run("null", () => analytics.getSiteAnalyticsAdmin({ dateFrom, dateTo, pagePath })),
  );

  server.registerTool(
    "get_page_analytics",
    {
      description:
        "Per-page analytics report for a date range. Requires pagePath or pageId.",
      inputSchema: {
        dateFrom: z.string().describe("Start date (YYYY-MM-DD or ISO)"),
        dateTo: z.string().describe("End date (YYYY-MM-DD or ISO)"),
        pagePath: z.string().optional(),
        pageId: z.string().optional(),
      },
    },
    async ({ dateFrom, dateTo, pagePath, pageId }) =>
      run("null", () => analytics.getPageAnalyticsAdmin({ dateFrom, dateTo, pagePath, pageId })),
  );

  server.registerTool(
    "get_page_heatmap",
    {
      description:
        "Per-page click/tap and scroll-depth heatmap for a date range. Returns grid clicks, scroll buckets, and top hotspots (document-relative percentages, not element IDs). Requires pagePath or pageId.",
      inputSchema: {
        dateFrom: z.string().describe("Start date (YYYY-MM-DD or ISO)"),
        dateTo: z.string().describe("End date (YYYY-MM-DD or ISO)"),
        pagePath: z.string().optional().describe("Public page path (e.g. /about)"),
        pageId: z.string().optional(),
        deviceType: z
          .enum(["mobile", "tablet", "desktop"])
          .optional()
          .describe("Device bucket; omit to merge all devices"),
      },
    },
    async ({ dateFrom, dateTo, pagePath, pageId, deviceType }) =>
      run("null", () =>
        analytics.getPageHeatmapAdmin({ dateFrom, dateTo, pagePath, pageId, deviceType }),
      ),
  );
}
