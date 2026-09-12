"use client";

import Link from "next/link";

import { ADMIN_SECTION_ICONS } from "@/lib/design/builder-nav-icons";
import { BUILDER_SECTION_NAV_WIDTH } from "@/lib/design/admin-tokens";
import { cn } from "@/lib/utils";

function sectionsInGroup(sections, groupId) {
  return sections.filter((section) => section.group === groupId);
}

function SectionLink({ section, active }) {
  const Icon = ADMIN_SECTION_ICONS[section.id];
  return (
    <Link
      href={section.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-card font-medium text-foreground shadow-xs ring-1 ring-border"
          : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
      )}
    >
      {Icon && (
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")}
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1 leading-snug">{section.label}</span>
    </Link>
  );
}

/**
 * Grouped sidebar for destinations that own sections (currently Admin). Renders
 * as a sidebar from `lg` up and as a scrollable pill row on narrower screens.
 */
export function BuilderSectionNav({ title, description, sections, groups, activeSectionId }) {
  if (sections.length === 0) return null;

  const ungrouped = sectionsInGroup(sections, null);

  return (
    <aside
      aria-label={`${title} sections`}
      className="hidden shrink-0 flex-col border-r border-border bg-muted/40 lg:flex"
      style={{ width: BUILDER_SECTION_NAV_WIDTH }}
    >
      <div className="border-b border-border/70 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
        {ungrouped.length > 0 && (
          <ul className="space-y-0.5">
            {ungrouped.map((section) => (
              <li key={section.id}>
                <SectionLink section={section} active={section.id === activeSectionId} />
              </li>
            ))}
          </ul>
        )}

        {groups.map((group) => {
          const groupSections = sectionsInGroup(sections, group.id);
          if (groupSections.length === 0) return null;
          return (
            <div key={group.id}>
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {groupSections.map((section) => (
                  <li key={section.id}>
                    <SectionLink section={section} active={section.id === activeSectionId} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/** Compact section switcher shown below the top bar on narrow screens. */
export function BuilderSectionPills({ sections, activeSectionId }) {
  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Sections"
      className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-muted/40 px-3 py-2 lg:hidden"
    >
      {sections.map((section) => {
        const active = section.id === activeSectionId;
        const Icon = ADMIN_SECTION_ICONS[section.id];
        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
