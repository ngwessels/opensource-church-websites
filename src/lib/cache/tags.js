/** Shared cache tags for public site data. */
export const PUBLIC_CACHE_TAGS = {
  siteConfig: "public:site-config",
  nav: "public:nav",
  hiddenPages: "public:hidden-pages",
  bulletins: "public:bulletins",
  page: (slug) => `public:page:${slug || "home"}`,
  googleCalendar: (calendarId) => `public:google-calendar:${calendarId}`,
};
