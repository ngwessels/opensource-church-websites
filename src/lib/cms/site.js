import "server-only";

import { revalidatePublicSite } from "@/lib/cache/revalidate-public";
import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { mergeFooterConfig } from "@/lib/site/footer-styles";
import { mergeHeaderConfig } from "@/lib/site/header-styles";
import { mergeSocialMedia } from "@/lib/site/social-media";
import { getThemeById, THEMES } from "@/lib/design/themes";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";
import { MODULE_CATEGORIES } from "@/types/firestore";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function configRef() {
  return getDb().collection(COLLECTIONS.site).doc(SITE_CONFIG_ID);
}

function now() {
  return new Date().toISOString();
}

export async function getSiteConfigAdmin() {
  const snap = await configRef().get();
  if (!snap.exists) throw new Error("Site config not found");
  return snap.data();
}

export async function updateSiteConfigAdmin(partial, { audit = true, summary = "Updated site configuration" } = {}) {
  const before = await getSiteConfigAdmin();
  await configRef().update({ ...partial, updatedAt: now() });
  revalidatePublicSite();
  const after = await getSiteConfigAdmin();

  if (audit) {
    await recordAuditEvent({
      action: "update",
      resource: { type: "site_config", id: SITE_CONFIG_ID, path: "site/config" },
      summary,
      before,
      after,
    });
  }

  return after;
}

function mergeDesign(current = {}, patch = {}) {
  return {
    ...current,
    ...patch,
    colors: { ...current.colors, ...patch.colors },
    fonts: { ...current.fonts, ...patch.fonts },
    layout: { ...current.layout, ...patch.layout },
    structure: { ...current.structure, ...patch.structure },
    tokens: {
      ...current.tokens,
      ...patch.tokens,
      typography: { ...current.tokens?.typography, ...patch.tokens?.typography },
      spacing: { ...current.tokens?.spacing, ...patch.tokens?.spacing },
      shape: { ...current.tokens?.shape, ...patch.tokens?.shape },
    },
  };
}

export async function updateSiteDesignAdmin(design) {
  const current = await getSiteConfigAdmin();
  return updateSiteConfigAdmin(
    { design: mergeDesign(current.design, design) },
    { summary: "Updated site design" },
  );
}

export async function updateSiteSettingsAdmin({
  name,
  tagline,
  canonicalDomain,
  timezone,
  seo,
  socialMedia,
}) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (tagline !== undefined) patch.tagline = tagline;
  if (canonicalDomain !== undefined) patch.canonicalDomain = canonicalDomain;
  if (timezone !== undefined) patch.timezone = timezone;
  if (seo !== undefined) {
    const current = await getSiteConfigAdmin();
    patch.seo = { ...(current.seo || {}), ...seo };
  }
  if (socialMedia !== undefined) {
    const current = await getSiteConfigAdmin();
    patch.socialMedia = mergeSocialMedia(current.socialMedia, socialMedia);
  }
  return updateSiteConfigAdmin(patch, { summary: "Updated site settings" });
}

export async function updateSocialMediaAdmin(socialMedia) {
  const current = await getSiteConfigAdmin();
  return updateSiteConfigAdmin({
    socialMedia: mergeSocialMedia(current.socialMedia, socialMedia),
  });
}

export async function updateHeaderConfigAdmin(headerConfig) {
  const current = await getSiteConfigAdmin();
  return updateSiteConfigAdmin({
    headerConfig: mergeHeaderConfig(current.headerConfig, headerConfig),
  });
}

export async function updateHeaderStylesAdmin(styles) {
  return updateHeaderConfigAdmin({ styles });
}

export async function updateFooterConfigAdmin(footerConfig) {
  const current = await getSiteConfigAdmin();
  return updateSiteConfigAdmin({
    footerConfig: mergeFooterConfig(current.footerConfig, footerConfig),
  });
}

export async function updateMassTimesAdmin(massTimes) {
  return updateSiteConfigAdmin({ massTimes });
}

export function listDesignThemes() {
  return {
    themes: THEMES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      colors: t.colors,
      fonts: t.fonts,
      structure: t.structure,
      meta: t.meta,
    })),
  };
}

/**
 * @param {{ themeId: string, colors?: object, fonts?: object, structure?: object }} input
 */
export async function applyDesignThemeAdmin({ themeId, colors, fonts, structure }) {
  const theme = getThemeById(themeId);
  const design = {
    themeId: theme.id,
    colors: { ...theme.colors, ...(colors || {}) },
    fonts: { ...theme.fonts, ...(fonts || {}) },
    layout: { ...theme.layout },
    structure: { ...theme.structure, ...(structure || {}) },
    tokens: {
      typography: { ...theme.tokens.typography },
      spacing: { ...theme.tokens.spacing },
      shape: { ...theme.tokens.shape },
    },
  };
  return updateSiteDesignAdmin(design);
}

export function getBuilderCapabilities() {
  return {
    moduleTypes: Object.values(MODULE_CATEGORIES).flat(),
    moduleCategories: MODULE_CATEGORIES,
    layouts: ["default", "full-width", "sidebar-left", "sidebar-right"],
    regions: {
      content: "content-N columns",
      features: "slideshow or feature_tiles (max 1 module)",
      sidebar: "sidebar layouts only",
    },
    socialMedia: {
      showInHeader: "boolean?",
      showInFooter: "boolean?",
      items: [{ platform: "facebook | instagram | youtube | x", url: "string" }],
      tools: ["update_site_settings"],
    },
    headerCustomization: {
      tools: ["get_header_config", "update_header_config", "update_header_styles", "update_site_settings", "update_site_design"],
      styleFields: [
        "headerBackground",
        "navBackground",
        "titleColor",
        "taglineColor",
        "navTextColor",
        "titleFont",
        "taglineFont",
        "navFont",
        "titleFontWeight",
        "titleFontSize",
        "navFontSize",
      ],
    },
    rules: [
      "Slideshow and feature_tiles modules must be placed in the features region",
      "Only slideshow or feature_tiles modules can be placed in the features region",
      "Each region has a max module count",
      "Single-column mobile/tablet module order uses contentStackOrderByViewport on update_page",
    ],
    pageTypes: {
      content: "Standard content page (default)",
      bulletins: "Bulletin archive page — pair with create_bulletin after upload_media",
      donation: "Online giving page — set donationConfig on update_page",
    },
    updatePageFields: [
      "pageType",
      "heroSlideshowEnabled",
      "donationConfig",
      "title",
      "slug",
      "layout",
      "hidden",
      "seo",
      "regions",
      "contentColumns",
      "contentColumnsByViewport",
      "contentStackOrderByViewport",
      "contentMarginX",
      "contentMarginXByViewport",
      "maxModulesPerRegion",
    ],
    navNodeSchema: {
      id: "string",
      type: "page | secure_page | link | group",
      title: "string",
      slug: "string? (page segments, empty for home)",
      externalUrl: "string? (link nodes)",
      parentId: "string|null",
      order: "number",
      pageId: "string? (page nodes)",
      isQuickLink: "boolean?",
      quickLinkOrder: "number?",
      hideInNav: "boolean?",
    },
    navTools: ["list_nav_nodes", "get_nav_tree", "save_sitemap", "add_nav_page", "delete_nav_node"],
    mediaFolders: {
      pictures: DEFAULT_MEDIA_FOLDERS.pictures,
      documents: DEFAULT_MEDIA_FOLDERS.documents,
      unused: DEFAULT_MEDIA_FOLDERS.unused,
    },
    mediaUpload: {
      tools: [
        "upload_media",
        "upload_media_batch",
        "begin_media_upload",
        "upload_media_chunk",
        "complete_media_upload",
      ],
      limits: {
        vercelRequestBodyMaxMb: 4.5,
        singleShotBase64MaxMb: 1,
        sourceUrlMaxMb: 10,
        chunkedUploadMaxMb: 10,
        recommendedChunkBytes: 96 * 1024,
        maxChunkBase64Chars: 350_000,
      },
      workflow:
        "MCP is hosted on Vercel (~4.5 MB request body). Prefer sourceUrl (server-side fetch, up to 10MB). For local files use chunked upload: begin_media_upload → upload_media_chunk (~96KB binary each) → complete_media_upload. Single-shot base64 max ~1MB and requires expectedSizeBytes. Upload images to pictures-root, PDFs to documents-root.",
    },
    designTools: ["list_design_themes", "apply_design_theme", "update_site_design"],
    batchTools: ["add_modules_batch", "upload_media_batch", "publish_all_pages"],
    search: {
      tool: "search_site_content",
      api: "GET /api/admin/search?q=...",
      searches: [
        "Page titles, SEO, and all module config text",
        "People names, calendar events, text HTML, links, form labels",
        "Site name, tagline, mass times, footer columns",
        "Navigation labels, bulletin titles/dates, media name/alt/tags",
        "Admin documentation note titles and bodies",
      ],
    },
    adminDocumentation: {
      tools: [
        "get_admin_documentation",
        "save_admin_documentation",
        "upsert_admin_documentation_note",
        "delete_admin_documentation_note",
      ],
      noteSchema: {
        id: "string",
        title: "string",
        body: "string",
        order: "number",
        createdAt: "string",
        updatedAt: "string",
      },
      workflow:
        "Use get_admin_documentation before operational changes. Add facts with upsert_admin_documentation_note (e.g. domain registrar, hosting account). Reorder via save_admin_documentation.",
    },
    playbooks: {
      fullParishSiteRedesign: [
        "get_site_summary + list_pages + get_nav_tree",
        "list_design_themes → apply_design_theme",
        "update_site_settings (name, tagline, social, SEO)",
        "update_header_config + update_footer_config + update_mass_times",
        "add_nav_page for each section (About, Mass Times, Contact, Ministries, Give, Bulletins)",
        "Per page: upload_media_batch → add_modules_batch → update_module for fine-tuning",
        "publish_all_pages",
      ],
      homepageFromScratch: [
        "update_page (home): layout, heroSlideshowEnabled: true, contentColumnsByViewport",
        "upload_media_batch for hero images",
        "add_modules_batch: slideshow in features, text/buttons in content, mass_times in sidebar",
        "update_module to set slide src to downloadUrl values",
        "publish_page",
      ],
      bulletinPosting: [
        "Ensure page with pageType bulletins exists",
        "upload_media folderId=documents-root (PDF)",
        "create_bulletin with mediaId + downloadUrl",
        "publish_page if page content changed",
      ],
    },
    moduleConfigSchemas: {
      text: {
        title: "string?",
        html: "string (HTML content)",
      },
      links: {
        title: "string",
        items: [{ label: "string", href: "string" }],
      },
      buttons: {
        items: [{ label: "string", href: "string" }],
      },
      image: {
        title: "string",
        src: "string (downloadUrl from upload_media)",
        alt: "string",
        caption: "string?",
        size: "small | medium | large | full",
      },
      gallery: {
        title: "string",
        images: [{ src: "string", alt: "string?", caption: "string?" }],
      },
      carousel: {
        title: "string",
        slides: [{ src: "string", alt: "string?", caption: "string?" }],
      },
      video: {
        title: "string",
        source: "youtube | vimeo | upload",
        url: "string?",
        embedUrl: "string?",
        src: "string?",
      },
      zoom: {
        title: "string",
        meetingId: "string",
        password: "string?",
        joinUrl: "string?",
        instructions: "string?",
        schedule: [{ id: "string", day: "string", time: "string" }],
      },
      calendar: {
        title: "string",
        source: "manual | google",
        events: [{ id: "string", title: "string", date: "string", time: "string?", location: "string?", description: "string?" }],
        maxEvents: "number",
        previewCount: "number",
        googleCalendarId: "string? (when source=google)",
      },
      mass_times: {
        title: "string",
        useSiteDefaults: "boolean (true = use site/config.massTimes)",
      },
      daily_readings: {
        title: "string",
        showUsccbLink: "boolean",
      },
      documents: {
        title: "string",
        items: [
          {
            label: "string",
            url: "string (downloadUrl from upload_media)",
            mediaId: "string? (required for displayMode inline)",
            displayMode: "link | inline (inline embeds PDF on page; library PDFs only)",
          },
        ],
        workflow: [
          "add_module type=documents",
          "upload_media folderId=documents-root",
          "update_module with items (set displayMode inline for embedded PDF viewer)",
          "publish_page",
        ],
      },
      people: {
        title: "string",
        people: [{ id: "string", name: "string", role: "string?", email: "string?", phone: "string?", photoUrl: "string?" }],
      },
      photo_albums: {
        title: "string",
        albums: [{ label: "string", href: "string", imageSrc: "string", photoCount: "number?" }],
      },
      feature_tiles: {
        items: [{ label: "string", href: "string", imageSrc: "string" }],
      },
      slideshow: {
        slides: [
          {
            src: "string",
            alt: "string?",
            caption: "string? (bottom gradient)",
            title: "string? (centered / overlay)",
            subtitle: "string?",
            ctaLabel: "string?",
            ctaHref: "string?",
            objectPositionByViewport: {
              mobile: "top-left | top | top-right | left | center | right | bottom-left | bottom | bottom-right",
              tablet: "same presets (falls back to mobile)",
              desktop: "same presets (falls back to tablet, then mobile)",
            },
          },
        ],
      },
      form: {
        formId: "string (stable ID, auto-generated on add_module)",
        title: "string?",
        description: "string?",
        submitLabel: "string",
        successMessage: "string",
        notificationEmails: ["string (comma-separated emails for Mailgun notifications)"],
        fields: [
          {
            id: "string",
            type: "heading | paragraph | text | email | phone | textarea | select | radio | checkbox | date | file",
            label: "string",
            placeholder: "string?",
            required: "boolean?",
            helpText: "string?",
            options: ["string (for select/radio/checkbox groups)"],
            accept: "string? (file field MIME/extensions)",
            maxFileSizeMb: "number? (file field, default 10)",
          },
        ],
        workflow: [
          "add_module type=form",
          "update_module with fields and notificationEmails",
          "publish_page",
          "Public submissions POST to /api/forms/submit with formId",
        ],
      },
      embed: {
        title: "string",
        embedUrl: "string?",
        html: "string?",
        height: "number",
      },
      facebook: {
        title: "string",
        pageUrl: "string?",
        embedUrl: "string?",
        width: "number",
        height: "number",
      },
      google_maps: {
        title: "string",
        embedUrl: "string (Google Maps embed URL)",
        height: "number",
      },
      instagram: {
        title: "string",
        postUrl: "string?",
        embedUrl: "string?",
        height: "number?",
      },
      rss: {
        title: "string",
        feedUrl: "string",
        maxItems: "number",
      },
      donationConfig: {
        title: "string",
        description: "string",
        funds: [{ id: "string", label: "string", description: "string?" }],
        presetAmountsCents: ["number (cents, e.g. 2500 = $25)"],
        comments: { enabled: "boolean", label: "string", placeholder: "string?" },
        tools: ["update_page with pageType donation"],
      },
    },
    designStructure: {
      headerVariant: "centeredBanner | logoLeftStack | inlineNav | minimalBar | heroBand | lightLogoLeft | lightCentered",
      navVariant: "barBelow | inlineHeader | underlineTabs | pillTabs | minimalText",
      footerVariant: "lightColumns | darkBand | minimalCenter | accentBar",
      moduleVariant: "classic | card | flatBar | bordered",
      quickLinksVariant: "inline | utilityBar | boxedCta",
      featuresVariant: "slideshow | tileGrid | none",
      heroCaptionVariant: "bottomGradient | centered | overlayBoxLeft",
      headerTone: "dark | light",
    },
  };
}

export async function getSiteSummaryAdmin() {
  const db = getDb();
  const [config, pagesSnap, navSnap] = await Promise.all([
    getSiteConfigAdmin(),
    db.collection(COLLECTIONS.pages).get(),
    db.collection(COLLECTIONS.navNodes).get(),
  ]);
  return {
    siteName: config.name,
    themeId: config.design?.themeId,
    pageCount: pagesSnap.size,
    navNodeCount: navSnap.size,
    canonicalDomain: config.canonicalDomain,
  };
}
