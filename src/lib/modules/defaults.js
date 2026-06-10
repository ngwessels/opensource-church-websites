import { generateId } from "@/lib/sitemap/tree";

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
      return { title: "Image", src: "", alt: "", caption: "", size: "small" };
    case "slideshow":
      return {
        slides: [
          {
            src: "https://images.unsplash.com/photo-1507692049794-5218e5217951?w=1600",
            alt: "Church",
            caption: "Welcome to our parish",
            title: "Welcome to Our Parish",
            subtitle: "Join us for worship and community",
            ctaLabel: "Learn More",
            ctaHref: "/",
          },
        ],
      };
    case "feature_tiles":
      return {
        items: [
          {
            label: "About Us",
            href: "/about",
            imageSrc: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=600",
          },
          {
            label: "Mass Times",
            href: "/mass-times",
            imageSrc: "https://images.unsplash.com/photo-1507692049794-5218e5217951?w=600",
          },
          {
            label: "Ministries",
            href: "/ministries",
            imageSrc: "https://images.unsplash.com/photo-1519491050282-cf00bc3695f6?w=600",
          },
          {
            label: "Contact",
            href: "/contact",
            imageSrc: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600",
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
    case "photo_albums":
      return {
        title: "Photo Albums",
        albums: [{ label: "Album", href: "/", imageSrc: "", photoCount: 0 }],
      };
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
      return {
        title: "Upcoming Events",
        source: "manual",
        events: [],
        maxEvents: 15,
        previewCount: 5,
      };
    case "form":
      return {
        formId: generateId(),
        title: "Contact Form",
        description: "",
        submitLabel: "Submit",
        successMessage: "Thank you! Your submission has been received.",
        notificationEmails: [],
        fields: [
          { id: generateId(), type: "text", label: "Name", required: true },
          { id: generateId(), type: "email", label: "Email", required: true },
          { id: generateId(), type: "textarea", label: "Message", required: true },
        ],
        honeypotFieldName: `_hp_${Math.random().toString(36).slice(2, 10)}`,
      };
    case "embed":
      return { title: "Embed", embedUrl: "", html: "", height: 400 };
    case "facebook":
      return { title: "Facebook", pageUrl: "", embedUrl: "", width: 500, height: 500 };
    case "google_maps":
      return { title: "Map", embedUrl: "", height: 450 };
    case "instagram":
      return { title: "Instagram", postUrl: "", embedUrl: "" };
    case "rss":
      return { title: "RSS Feed", feedUrl: "", maxItems: 10 };
    default:
      return {};
  }
}
