"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useUserProfile } from "@/hooks/useUserProfile";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import {
  ADMIN_SECTION_GROUPS,
  ADMIN_SECTIONS,
  adminSectionHref,
  adminSectionIdFromPath,
  builderDestinationsForRole,
  BUILDER_UTILITY_PAGES,
  findBuilderDestination,
} from "@/lib/builder/navigation";

/**
 * Resolves the builder chrome navigation state: which destinations this role
 * can reach, where the user currently is, and the sections of the active
 * destination. Read once by `BuilderShell` and passed down as props so the
 * chrome components stay presentational.
 */
export function useBuilderNavigation() {
  const pathname = usePathname() || "";
  const { role, isFinance } = useUserProfile();
  const { config } = useSiteConfig({ enabled: !isFinance });

  const destinations = useMemo(() => builderDestinationsForRole(role), [role]);

  const activeDestination = useMemo(() => {
    const match = findBuilderDestination(pathname);
    if (!match) return undefined;
    return destinations.some((destination) => destination.id === match.id) ? match : undefined;
  }, [destinations, pathname]);

  const sections = useMemo(() => {
    if (activeDestination?.id !== "admin") return [];
    return ADMIN_SECTIONS.map((section) => ({
      ...section,
      href: adminSectionHref(section.id),
    }));
  }, [activeDestination]);

  const activeSectionId = activeDestination?.id === "admin" ? adminSectionIdFromPath(pathname) : undefined;
  const activeSection = sections.find((section) => section.id === activeSectionId);

  const utilityPage = BUILDER_UTILITY_PAGES.find((page) => pathname.startsWith(page.href));

  return {
    pathname,
    role,
    isFinance,
    siteName: isFinance ? "Donations" : config?.name || "My Parish",
    destinations,
    activeDestination,
    sections,
    sectionGroups: sections.length > 0 ? ADMIN_SECTION_GROUPS : [],
    activeSection,
    /** Label for the breadcrumb when the page is not a rail destination. */
    utilityLabel: activeDestination ? undefined : utilityPage?.label,
  };
}
