import { ExternalLink, FileText, FolderOpen, Lock } from "lucide-react";

export const NAV_TYPE_META = {
  page: {
    label: "Page",
    icon: FileText,
    rootClass: "bg-primary text-primary-foreground",
    childClass: "border-l-[3px] border-l-emerald-500 bg-card text-foreground",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    tileClass: "bg-primary text-primary-foreground",
  },
  secure_page: {
    label: "Secure",
    icon: Lock,
    rootClass: "bg-red-700 text-white",
    childClass: "border-l-[3px] border-l-red-500 bg-card text-foreground",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    tileClass: "bg-red-700 text-white",
  },
  link: {
    label: "Link",
    icon: ExternalLink,
    rootClass: "bg-primary/90 text-primary-foreground",
    childClass: "border-l-[3px] border-l-sky-500 bg-card text-foreground",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    tileClass: "bg-primary/85 text-primary-foreground",
  },
  group: {
    label: "Group",
    icon: FolderOpen,
    rootClass: "border-2 border-dashed border-primary/50 bg-primary/5 text-primary",
    childClass: "border-2 border-dashed border-primary/30 bg-primary/5 text-primary",
    badgeClass: "bg-primary/10 text-primary",
    tileClass: "border-2 border-dashed border-primary/40 bg-primary/5 text-primary",
  },
};

export const NAV_TEMPLATE_TYPES = ["page", "secure_page", "link", "group"];
