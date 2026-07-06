import {
  Calendar,
  Camera,
  ClipboardList,
  Code,
  FileText,
  Images,
  Image,
  LayoutGrid,
  LayoutPanelTop,
  Link2,
  MapPin,
  MousePointerClick,
  FileStack,
  Rss,
  Share2,
  Users,
  Church,
  BookOpen,
  Presentation,
  Video,
  Radio,
} from "lucide-react";

export const ADMIN_TOOLBAR_HEIGHT = 65;
export const ADMIN_PAGE_NAV_HEIGHT = 60;
export const MODULE_TRAY_HEIGHT = 320;

/** Minimum browser width (px) required to use the website builder. */
export const BUILDER_MIN_VIEWPORT_WIDTH = 1024;

export const ADMIN_Z = {
  toolbar: 50,
  sectionTab: 40,
  moduleTray: 45,
  pageNav: 50,
  overlay: 60,
  errorBanner: 55,
  /** Portaled menus (select, dropdown) above module editor overlays */
  popover: 70,
};

export const MODULE_META = {
  text: { label: "Text / HTML", color: "bg-emerald-600", icon: FileText },
  links: { label: "Links", color: "bg-amber-500", icon: Link2 },
  buttons: { label: "Buttons", color: "bg-sky-600", icon: MousePointerClick },
  documents: { label: "Documents", color: "bg-zinc-500", icon: FileStack },
  people: { label: "People", color: "bg-red-600", icon: Users },
  mass_times: { label: "Mass Times", color: "bg-amber-800", icon: Church },
  daily_readings: { label: "Daily Readings", color: "bg-rose-800", icon: BookOpen },
  calendar: { label: "Calendar", color: "bg-amber-600", icon: Calendar },
  form: { label: "Forms", color: "bg-teal-600", icon: ClipboardList },
  image: { label: "Image", color: "bg-blue-600", icon: Image },
  gallery: { label: "Gallery", color: "bg-indigo-600", icon: LayoutGrid },
  photo_albums: { label: "Photo Albums", color: "bg-indigo-700", icon: Images },
  slideshow: { label: "Slideshow", color: "bg-violet-600", icon: Presentation },
  feature_tiles: { label: "Feature Tiles", color: "bg-rose-700", icon: LayoutPanelTop },
  carousel: { label: "Carousel", color: "bg-purple-600", icon: Images },
  video: { label: "Video", color: "bg-red-600", icon: Video },
  zoom: { label: "Zoom Live", color: "bg-sky-700", icon: Radio },
  embed: { label: "Embed", color: "bg-slate-600", icon: Code },
  facebook: { label: "Facebook", color: "bg-blue-700", icon: Share2 },
  google_maps: { label: "Google Maps", color: "bg-green-700", icon: MapPin },
  instagram: { label: "Instagram", color: "bg-pink-600", icon: Camera },
  rss: { label: "RSS", color: "bg-orange-600", icon: Rss },
};

export const MODULE_TILE_COLORS = Object.fromEntries(
  Object.entries(MODULE_META).map(([k, v]) => [k, v.color]),
);

export const MODULE_LABELS = Object.fromEntries(
  Object.entries(MODULE_META).map(([k, v]) => [k, v.label]),
);
