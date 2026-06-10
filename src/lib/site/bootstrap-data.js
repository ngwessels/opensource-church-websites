import { DEFAULT_FOOTER_STYLES } from "@/lib/site/footer-styles";
import { DEFAULT_SOCIAL_MEDIA } from "@/lib/site/social-media";
import { normalizeDesign } from "@/lib/design/design-utils";
import { getThemeById } from "@/lib/design/themes";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { generateId, generatePageId } from "@/lib/sitemap/tree";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

/**
 * Build Firestore writes for a fresh site bootstrap (site config, home page, nav, folders).
 * Does not include the admin user profile — that is created separately.
 *
 * @returns {{ siteConfig: object, pageId: string, homeNavId: string, page: object, navNode: object, mediaFolders: Array<{ id: string, data: object }> }}
 */
export function buildSiteBootstrapData() {
  const now = new Date().toISOString();
  const pageId = generatePageId();
  const homeNavId = generateId();

  const siteConfig = {
    name: "My Parish",
    tagline: "",
    canonicalDomain: process.env.NEXT_PUBLIC_SITE_URL || "",
    seo: { title: "My Parish", description: "", faviconUrl: "" },
    design: normalizeDesign({ themeId: "verona" }, getThemeById("verona")),
    headerConfig: {
      showTagline: true,
      showLogo: false,
      logoUrl: "",
      layout: "centered",
      styles: {
        headerBackground: "",
        navBackground: "",
        titleColor: "#ffffff",
        taglineColor: "rgba(255, 255, 255, 0.9)",
        navTextColor: "#ffffff",
        titleFont: "",
        taglineFont: "",
        navFont: "",
        titleFontWeight: "700",
        titleFontSize: "",
        navFontSize: "",
      },
    },
    socialMedia: { ...DEFAULT_SOCIAL_MEDIA },
    footerConfig: {
      text: "",
      styles: {
        ...DEFAULT_FOOTER_STYLES,
      },
      columns: [
        {
          title: "Contact",
          html: "<p>123 Main Street<br/>City, ST 12345<br/>555-555-5555</p>",
        },
        {
          title: "Quick Links",
          source: "quickLinks",
          links: [],
        },
      ],
    },
    massTimes: {
      weekly: {
        saturday: ["5:00 PM"],
        sunday: ["8:00 AM", "10:00 AM"],
        weekday: ["8:00 AM Mon, Tue, Thu", "8:30 AM Fri School Mass"],
      },
      holidays: [
        {
          id: generateId(),
          name: "Christmas",
          date: "2026-12-25",
          times: ["10:00 AM", "12:00 PM Midnight Mass"],
          notes: "",
        },
      ],
      special: [],
      confession: ["Saturday 4:00 PM – 4:30 PM or by appointment"],
    },
    createdAt: now,
    updatedAt: now,
  };

  const page = {
    slug: "",
    title: "Home",
    status: "published",
    layout: "sidebar-left",
    contentColumns: 1,
    maxModulesPerRegion: 10,
    heroSlideshowEnabled: true,
    regions: [
      {
        id: "features",
        modules: [],
      },
      {
        id: "content-1",
        modules: [
          {
            id: generateId(),
            type: "text",
            region: "content-1",
            order: 0,
            config: {
              title: "Welcome",
              html: "<p>Welcome to our parish website. Use the builder to edit this content.</p>",
            },
          },
        ],
      },
      {
        id: "sidebar",
        modules: [
          {
            id: generateId(),
            type: "links",
            region: "sidebar",
            order: 0,
            config: {
              title: "Links",
              items: [{ label: "Contact Us", href: "/contact" }],
            },
          },
        ],
      },
    ],
    seo: { title: "Home" },
    publishedAt: now,
    updatedAt: now,
  };

  const navNode = {
    id: homeNavId,
    type: "page",
    title: "Home",
    slug: "",
    parentId: null,
    order: 0,
    isQuickLink: false,
    pageId,
  };

  const mediaFolders = [
    {
      id: DEFAULT_MEDIA_FOLDERS.pictures,
      data: { name: "Pictures", type: "pictures", parentId: null, order: 0, createdAt: now },
    },
    {
      id: DEFAULT_MEDIA_FOLDERS.documents,
      data: { name: "Documents", type: "documents", parentId: null, order: 1, createdAt: now },
    },
    {
      id: DEFAULT_MEDIA_FOLDERS.unused,
      data: { name: "Unused Pictures", type: "pictures", parentId: null, order: 2, createdAt: now },
    },
  ];

  return {
    collections: { site: COLLECTIONS.site, pages: COLLECTIONS.pages, navNodes: COLLECTIONS.navNodes, mediaFolders: COLLECTIONS.mediaFolders },
    siteConfigId: SITE_CONFIG_ID,
    siteConfig,
    pageId,
    homeNavId,
    page,
    navNode,
    mediaFolders,
  };
}

/**
 * @param {{ email?: string, displayName?: string }} user
 * @param {"admin" | "member"} role
 */
export function buildUserProfileData(user, role) {
  const now = new Date().toISOString();
  return {
    email: user.email || "",
    displayName: user.displayName || "",
    role,
    createdAt: now,
    updatedAt: now,
  };
}
