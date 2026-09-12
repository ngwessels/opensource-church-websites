import {
  BookOpen,
  ChartColumn,
  Church,
  Download,
  FolderOpen,
  HandCoins,
  Heart,
  History,
  LayoutDashboard,
  Mail,
  Network,
  Newspaper,
  Palette,
  Settings,
  SlidersHorizontal,
  SquarePen,
  Users,
} from "lucide-react";

/** Icons for `BUILDER_DESTINATIONS`, keyed by destination id. */
export const BUILDER_DESTINATION_ICONS = {
  edit: SquarePen,
  design: Palette,
  sitemap: Network,
  files: FolderOpen,
  analytics: ChartColumn,
  donations: HandCoins,
  admin: Settings,
};

/** Icons for `ADMIN_SECTIONS`, keyed by section id. */
export const ADMIN_SECTION_ICONS = {
  overview: LayoutDashboard,
  settings: SlidersHorizontal,
  email: Mail,
  mass: Church,
  bulletins: Newspaper,
  users: Users,
  prayer: Heart,
  donations: HandCoins,
  documentation: BookOpen,
  audit: History,
  export: Download,
};
