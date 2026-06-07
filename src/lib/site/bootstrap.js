import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { DEFAULT_FOOTER_STYLES } from "@/lib/site/footer-styles";
import { normalizeDesign } from "@/lib/design/design-utils";
import { getThemeById } from "@/lib/design/themes";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { generateId, generatePageId } from "@/lib/sitemap/tree";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

export async function ensureSiteBootstrapped(db, user) {
  const siteRef = doc(db, COLLECTIONS.site, SITE_CONFIG_ID);
  const siteSnap = await getDoc(siteRef);

  if (siteSnap.exists()) {
    return false;
  }

  const now = new Date().toISOString();
  const pageId = generatePageId();
  const homeNavId = generateId();
  const batch = writeBatch(db);

  batch.set(siteRef, {
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
  });

  batch.set(doc(db, COLLECTIONS.pages, pageId), {
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
  });

  batch.set(doc(db, COLLECTIONS.navNodes, homeNavId), {
    id: homeNavId,
    type: "page",
    title: "Home",
    slug: "",
    parentId: null,
    order: 0,
    isQuickLink: false,
    pageId,
  });

  batch.set(doc(db, COLLECTIONS.mediaFolders, DEFAULT_MEDIA_FOLDERS.pictures), {
    name: "Pictures",
    type: "pictures",
    parentId: null,
    order: 0,
    createdAt: now,
  });

  batch.set(doc(db, COLLECTIONS.mediaFolders, DEFAULT_MEDIA_FOLDERS.documents), {
    name: "Documents",
    type: "documents",
    parentId: null,
    order: 1,
    createdAt: now,
  });

  batch.set(doc(db, COLLECTIONS.mediaFolders, DEFAULT_MEDIA_FOLDERS.unused), {
    name: "Unused Pictures",
    type: "pictures",
    parentId: null,
    order: 2,
    createdAt: now,
  });

  batch.set(doc(db, COLLECTIONS.users, user.uid), {
    email: user.email || "",
    displayName: user.displayName || "",
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
  return true;
}

export async function ensureUserProfile(db, user) {
  const userRef = doc(db, COLLECTIONS.users, user.uid);
  const userSnap = await getDoc(userRef);
  const now = new Date().toISOString();

  if (!userSnap.exists()) {
    const pagesSnap = await getDocs(collection(db, COLLECTIONS.pages));
    const isFirstUser = pagesSnap.empty;

    await setDoc(userRef, {
      email: user.email || "",
      displayName: user.displayName || "",
      role: isFirstUser ? "admin" : "member",
      createdAt: now,
      updatedAt: now,
    });

    if (isFirstUser) {
      await ensureSiteBootstrapped(db, user);
    }
  }
}
