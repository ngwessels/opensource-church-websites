import "server-only";

import { revalidatePublicSite } from "@/lib/cache/revalidate-public";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { mergeFooterConfig } from "@/lib/site/footer-styles";
import { mergeHeaderConfig } from "@/lib/site/header-styles";
import { mergeSocialMedia } from "@/lib/site/social-media";
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

export async function updateSiteConfigAdmin(partial) {
  await configRef().update({ ...partial, updatedAt: now() });
  revalidatePublicSite();
  return getSiteConfigAdmin();
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
  return updateSiteConfigAdmin({ design: mergeDesign(current.design, design) });
}

export async function updateSiteSettingsAdmin({ name, tagline, canonicalDomain, seo, socialMedia }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (tagline !== undefined) patch.tagline = tagline;
  if (canonicalDomain !== undefined) patch.canonicalDomain = canonicalDomain;
  if (seo !== undefined) {
    const current = await getSiteConfigAdmin();
    patch.seo = { ...(current.seo || {}), ...seo };
  }
  if (socialMedia !== undefined) {
    const current = await getSiteConfigAdmin();
    patch.socialMedia = mergeSocialMedia(current.socialMedia, socialMedia);
  }
  return updateSiteConfigAdmin(patch);
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
    ],
    moduleConfigSchemas: {
      links: {
        title: "string",
        items: [{ label: "string", href: "string" }],
      },
      buttons: {
        items: [{ label: "string", href: "string" }],
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
