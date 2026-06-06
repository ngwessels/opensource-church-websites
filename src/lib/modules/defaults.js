/** @param {import('@/types/firestore').ModuleType} type */
export function getDefaultConfig(type) {
  switch (type) {
    case "text":
      return { title: "New Section", html: "<p>Enter your content here.</p>" };
    case "links":
      return { title: "Links", items: [{ label: "Link", href: "/" }] };
    case "buttons":
      return { items: [{ label: "Learn More", href: "/" }] };
    case "image":
      return { title: "Image", src: "", alt: "", caption: "" };
    case "slideshow":
      return {
        slides: [
          {
            src: "https://images.unsplash.com/photo-1507692049794-5218e5217951?w=1600",
            alt: "Church",
            caption: "Welcome to our parish",
          },
        ],
      };
    case "carousel":
      return {
        title: "Photo Carousel",
        slides: [
          {
            src: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1200",
            alt: "Church",
            caption: "",
          },
        ],
      };
    case "gallery":
      return { title: "Gallery", images: [] };
    case "video":
      return { title: "Video", source: "youtube", url: "", embedUrl: "", src: "" };
    case "zoom":
      return {
        title: "Live Streaming",
        meetingId: "",
        password: "",
        joinUrl: "",
        instructions: "",
        schedule: [{ id: "sched_default", day: "sunday", time: "10:00" }],
      };
    case "mass_times":
      return { title: "Mass Times", useSiteDefaults: true };
    case "daily_readings":
      return { title: "Daily Readings", showUsccbLink: true };
    case "people":
      return { title: "Staff", people: [] };
    case "documents":
      return { title: "Documents", items: [] };
    case "calendar":
      return { title: "Upcoming Events", source: "manual", events: [], maxEvents: 15 };
    default:
      return {};
  }
}
