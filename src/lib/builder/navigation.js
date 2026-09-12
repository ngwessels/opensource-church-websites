import { isExternalHref } from "@/lib/sitemap/tree";

/** Slug segment from `/builder/edit` or `/builder/edit/foo/bar` (empty string for home). */
export function slugFromBuilderEditPath(pathname) {
  if (!pathname?.startsWith("/builder/edit")) return "";
  const rest = pathname.slice("/builder/edit".length);
  return rest.replace(/^\/+/, "");
}

/**
 * Top-level builder destinations, in rail order. Icons are attached in
 * `@/components/builder/nav-icons` so server code can import this registry.
 */
export const BUILDER_DESTINATIONS = [
  {
    id: "edit",
    label: "Edit Website",
    shortLabel: "Edit",
    href: "/builder/edit",
    description: "Add and arrange page content",
    roles: ["admin"],
  },
  {
    id: "design",
    label: "Design",
    shortLabel: "Design",
    href: "/builder/design",
    description: "Themes, colors, and fonts",
    roles: ["admin"],
  },
  {
    id: "sitemap",
    label: "Site Map",
    shortLabel: "Pages",
    href: "/builder/sitemap",
    description: "Pages and navigation structure",
    roles: ["admin"],
  },
  {
    id: "files",
    label: "Files",
    shortLabel: "Files",
    href: "/builder/files",
    description: "Pictures and documents",
    roles: ["admin"],
  },
  {
    id: "analytics",
    label: "Analytics",
    shortLabel: "Analytics",
    href: "/builder/analytics",
    description: "Visitors, pages, and heatmaps",
    roles: ["admin"],
  },
  {
    id: "donations",
    label: "Donations",
    shortLabel: "Giving",
    href: "/builder/donations",
    description: "Donation reports and donors",
    roles: ["finance"],
  },
  {
    id: "admin",
    label: "Admin",
    shortLabel: "Admin",
    href: "/builder/admin",
    description: "Settings, people, and records",
    roles: ["admin"],
    hasSections: true,
  },
];

/** Sidebar groups for the Admin destination, in display order. */
export const ADMIN_SECTION_GROUPS = [
  { id: "site", label: "Site" },
  { id: "people", label: "People & Community" },
  { id: "giving", label: "Giving" },
  { id: "records", label: "Records & Data" },
];

/**
 * Admin sections. `id` is the stable identifier used by audit context and by
 * legacy `?tab=` links; `slug` is the URL segment (empty for the landing page).
 */
export const ADMIN_SECTIONS = [
  {
    id: "overview",
    slug: "",
    label: "Overview",
    description: "Deployment, domain, and storage at a glance",
    group: null,
  },
  {
    id: "settings",
    slug: "settings",
    label: "Site Settings",
    description: "Name, domain, timezone, search appearance, and social links",
    group: "site",
  },
  {
    id: "email",
    slug: "email",
    label: "Email",
    description: "Mailgun delivery settings and webhook status",
    group: "site",
  },
  {
    id: "mass",
    slug: "mass-times",
    label: "Sacraments & Mass Times",
    description: "Weekly schedule shown on the public site",
    group: "site",
  },
  {
    id: "users",
    slug: "users",
    label: "Admin Users",
    description: "Who can sign in to the builder",
    group: "people",
  },
  {
    id: "prayer",
    slug: "prayer-intentions",
    label: "Prayer Intentions",
    description: "Review submissions and prayer group digests",
    group: "people",
  },
  {
    id: "donations",
    slug: "donations",
    label: "Donations",
    description: "Giving reports and payout records",
    group: "giving",
  },
  {
    id: "documentation",
    slug: "documentation",
    label: "Documentation",
    description: "Shared operational notes for admins",
    group: "records",
  },
  {
    id: "audit",
    slug: "audit-log",
    label: "Audit Log",
    description: "Every admin change, with before and after",
    group: "records",
  },
  {
    id: "export",
    slug: "data-export",
    label: "Data Export",
    description: "Download a copy of the site content",
    group: "records",
  },
];

/** Builder pages reachable from menus rather than the destination rail. */
export const BUILDER_UTILITY_PAGES = [
  { id: "account", label: "Account", href: "/builder/account" },
  { id: "bulletins", label: "Bulletins", href: "/builder/bulletins" },
];

export const ADMIN_ROOT_HREF = "/builder/admin";
const DEFAULT_ADMIN_SECTION_ID = "overview";

/** @param {string} [role] Builder role (`admin`, `finance`). */
export function builderDestinationsForRole(role) {
  if (!role) return [];
  return BUILDER_DESTINATIONS.filter((destination) => destination.roles.includes(role));
}

/** Destination owning `pathname`, or undefined for non-destination builder pages. */
export function findBuilderDestination(pathname) {
  if (!pathname) return undefined;
  return BUILDER_DESTINATIONS.find(
    (destination) =>
      pathname === destination.href || pathname.startsWith(`${destination.href}/`),
  );
}

export function findAdminSectionById(sectionId) {
  return ADMIN_SECTIONS.find((section) => section.id === sectionId);
}

/** @param {string} [idOrSlug] Section id (`mass`) or URL slug (`mass-times`). */
export function adminSectionHref(idOrSlug) {
  const section =
    ADMIN_SECTIONS.find((item) => item.id === idOrSlug) ??
    ADMIN_SECTIONS.find((item) => item.slug && item.slug === idOrSlug);
  if (!section?.slug) return ADMIN_ROOT_HREF;
  return `${ADMIN_ROOT_HREF}/${section.slug}`;
}

/** @param {string} [tab] Legacy admin panel tab id (e.g. documentation, settings). */
export function adminPanelHref(tab) {
  return adminSectionHref(tab);
}

export const ADMIN_DOCUMENTATION_HREF = adminSectionHref("documentation");

/**
 * Resolve the admin section for the `[[...section]]` route segments.
 * Returns `undefined` when the URL does not match a known section.
 *
 * @param {string[]} [segments]
 */
export function resolveAdminSection(segments) {
  if (!segments || segments.length === 0) {
    return findAdminSectionById(DEFAULT_ADMIN_SECTION_ID);
  }
  if (segments.length > 1) return undefined;
  return ADMIN_SECTIONS.find((section) => section.slug === segments[0]);
}

/** Admin section id for a builder pathname, or undefined when outside Admin. */
export function adminSectionIdFromPath(pathname) {
  if (!pathname?.startsWith(ADMIN_ROOT_HREF)) return undefined;
  const rest = pathname.slice(ADMIN_ROOT_HREF.length).replace(/^\/+/, "");
  const segments = rest ? rest.split("/") : [];
  return resolveAdminSection(segments)?.id;
}

/** Rewrite internal site paths to stay in the builder when editing. */
export function toBuilderHref(href, editing = false) {
  if (!editing || !href || href === "#" || isExternalHref(href)) {
    return href;
  }
  if (href.startsWith("/builder/")) {
    return href;
  }
  if (href === "/") {
    return "/builder/edit";
  }
  return `/builder/edit${href.startsWith("/") ? href : `/${href}`}`;
}
