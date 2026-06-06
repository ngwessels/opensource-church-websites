import "server-only";

import { z } from "zod";

import * as nav from "@/lib/cms/nav";
import * as pages from "@/lib/cms/pages";
import * as site from "@/lib/cms/site";
import * as media from "@/lib/cms/media";

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

async function run(fn) {
  try {
    const result = await fn();
    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : "Unknown error");
  }
}

const moduleTypeSchema = z.enum([
  "text",
  "links",
  "buttons",
  "image",
  "gallery",
  "slideshow",
  "carousel",
  "video",
  "zoom",
  "mass_times",
  "calendar",
  "documents",
  "people",
]);

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

const siteDesignSchema = z.object({
  themeId: z.string().optional(),
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
    .optional(),
});

/** @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server */
export function registerMcpTools(server) {
  server.registerTool(
    "list_pages",
    { description: "List all site pages", inputSchema: {} },
    async () => run(() => pages.listPagesAdmin()),
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
    async ({ pageId, slug }) => run(() => pages.getPageAdmin({ pageId, slug })),
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
          .describe("Horizontal margin for page content (none, sm, md, lg, xl)."),
        contentColumns: z.number().int().min(1).max(4).optional(),
        maxModulesPerRegion: z.number().int().min(1).optional(),
        seo: z.record(z.unknown()).optional(),
        regions: z.array(z.record(z.unknown())).optional(),
      },
    },
    async ({ pageId, ...updates }) => run(() => pages.updatePageAdmin(pageId, updates)),
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
    async (args) => run(() => pages.addModuleAdmin(args.pageId, args)),
  );

  server.registerTool(
    "update_module",
    {
      description: "Update a module config on a page",
      inputSchema: {
        pageId: z.string(),
        moduleId: z.string(),
        config: z.record(z.unknown()),
      },
    },
    async ({ pageId, moduleId, config }) =>
      run(() => pages.updateModuleAdmin(pageId, moduleId, config)),
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
    async (args) => run(() => pages.moveModuleAdmin(args.pageId, args)),
  );

  server.registerTool(
    "remove_module",
    {
      description: "Remove a module from a page",
      inputSchema: { pageId: z.string(), moduleId: z.string() },
    },
    async ({ pageId, moduleId }) => run(() => pages.removeModuleAdmin(pageId, moduleId)),
  );

  server.registerTool(
    "publish_page",
    {
      description: "Publish a page draft to the live site",
      inputSchema: { pageId: z.string() },
    },
    async ({ pageId }) => run(() => pages.publishPageAdmin(pageId)),
  );

  server.registerTool(
    "revert_page",
    {
      description: "Revert a page draft to the last published snapshot",
      inputSchema: { pageId: z.string() },
    },
    async ({ pageId }) => run(() => pages.revertPageAdmin(pageId)),
  );

  server.registerTool(
    "list_nav_nodes",
    { description: "List all navigation nodes (flat)", inputSchema: {} },
    async () => run(() => nav.listNavNodesAdmin()),
  );

  server.registerTool(
    "get_nav_tree",
    { description: "Get hierarchical navigation tree", inputSchema: {} },
    async () => run(() => nav.getNavTreeAdmin()),
  );

  server.registerTool(
    "save_sitemap",
    {
      description: "Save the full sitemap as a flat array of nav nodes",
      inputSchema: {
        nodes: z.array(z.record(z.unknown())),
      },
    },
    async ({ nodes }) =>
      run(async () => {
        const existing = await nav.listNavNodesAdmin();
        return nav.saveSitemapAdmin(
          nodes,
          existing.map((n) => n.id),
          existing.map((n) => n.pageId),
        );
      }),
  );

  server.registerTool(
    "get_site_config",
    { description: "Get site configuration", inputSchema: {} },
    async () => run(() => site.getSiteConfigAdmin()),
  );

  server.registerTool(
    "update_site_design",
    {
      description:
        "Update site-wide design theme, colors, and fonts. Merges with existing design. Use update_header_styles for header-specific overrides.",
      inputSchema: { design: siteDesignSchema },
    },
    async ({ design }) => run(() => site.updateSiteDesignAdmin(design)),
  );

  server.registerTool(
    "update_site_settings",
    {
      description: "Update site name, tagline, or canonical domain",
      inputSchema: {
        name: z.string().optional(),
        tagline: z.string().optional(),
        canonicalDomain: z.string().optional(),
      },
    },
    async (args) => run(() => site.updateSiteSettingsAdmin(args)),
  );

  server.registerTool(
    "update_header_config",
    {
      description:
        "Update header layout and display options (logo, tagline visibility, layout). Merges with existing headerConfig.",
      inputSchema: { headerConfig: headerConfigSchema },
    },
    async ({ headerConfig }) => run(() => site.updateHeaderConfigAdmin(headerConfig)),
  );

  server.registerTool(
    "update_header_styles",
    {
      description:
        "Update header colors and fonts: title/tagline/nav text colors, header and nav background colors, and font families/sizes. Merges with existing headerConfig.styles.",
      inputSchema: { styles: headerStylesSchema },
    },
    async ({ styles }) => run(() => site.updateHeaderStylesAdmin(styles)),
  );

  server.registerTool(
    "get_header_config",
    {
      description:
        "Get header configuration including resolved-friendly styles (name, tagline, layout, colors, fonts).",
      inputSchema: {},
    },
    async () =>
      run(async () => {
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
    "update_footer_config",
    {
      description: "Update footer configuration",
      inputSchema: { footerConfig: z.record(z.unknown()) },
    },
    async ({ footerConfig }) => run(() => site.updateFooterConfigAdmin(footerConfig)),
  );

  server.registerTool(
    "update_mass_times",
    {
      description:
        "Update mass times: { weekly: { saturday, sunday, weekday }, holidays: [{ name, date, times, notes }], special: [{ name, date, endDate?, times, notes }], confession }",
      inputSchema: { massTimes: z.record(z.unknown()) },
    },
    async ({ massTimes }) => run(() => site.updateMassTimesAdmin(massTimes)),
  );

  server.registerTool(
    "list_media",
    {
      description:
        "List media files with metadata (name, description, alt, tags, downloadUrl), optionally filtered by folderId",
      inputSchema: { folderId: z.string().optional() },
    },
    async ({ folderId }) => run(() => media.listMediaAdmin({ folderId })),
  );

  server.registerTool(
    "get_media",
    {
      description: "Get a single media file by mediaId, including description, alt, and tags",
      inputSchema: { mediaId: z.string() },
    },
    async ({ mediaId }) => run(() => media.getMediaAdmin(mediaId)),
  );

  server.registerTool(
    "list_media_folders",
    { description: "List media folders", inputSchema: {} },
    async () => run(() => media.listMediaFoldersAdmin()),
  );

  server.registerTool(
    "upload_media",
    {
      description:
        "Upload media via base64 (max ~3MB) or sourceUrl. Optional description, alt, and tags help identify the file later.",
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
    async (args) => run(() => media.uploadMediaAdmin(args)),
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
    async ({ mediaId, ...fields }) => run(() => media.updateMediaAdmin(mediaId, fields)),
  );

  server.registerTool(
    "delete_media",
    {
      description: "Delete a media record",
      inputSchema: { mediaId: z.string() },
    },
    async ({ mediaId }) => run(() => media.deleteMediaAdmin(mediaId)),
  );

  server.registerTool(
    "get_builder_capabilities",
    {
      description: "Get module types, layouts, and region rules for the builder",
      inputSchema: {},
    },
    async () => run(() => site.getBuilderCapabilities()),
  );

  server.registerTool(
    "get_site_summary",
    {
      description: "Quick overview of site pages, nav, and design",
      inputSchema: {},
    },
    async () => run(() => site.getSiteSummaryAdmin()),
  );
}
