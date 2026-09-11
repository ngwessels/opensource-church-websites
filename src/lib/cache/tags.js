/** Shared cache tags for public site data. */
export const PUBLIC_CACHE_TAGS = {
  siteConfig: "public:site-config",
  nav: "public:nav",
  hiddenPages: "public:hidden-pages",
  bulletins: "public:bulletins",
  page: (slug) => `public:page:${slug || "home"}`,
  googleCalendar: (calendarId) => `public:google-calendar:${calendarId}`,
};

/**
 * Safety-net TTL for public Firestore payloads and HTML.
 * Publish still expires caches immediately; this heals a missed revalidate.
 */
export const PUBLIC_CACHE_REVALIDATE_SECONDS = 60;

/**
 * Route-handler equivalent of `updateTag`: expire now so the next visitor
 * blocks on a fresh render instead of receiving stale-while-revalidate HTML.
 */
export const PUBLIC_CACHE_EXPIRE_NOW = { expire: 0 };
