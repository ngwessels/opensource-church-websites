"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { BUILDER_RAIL_WIDTH } from "@/lib/design/admin-tokens";
import { BUILDER_DESTINATION_ICONS } from "@/lib/design/builder-nav-icons";
import { cn } from "@/lib/utils";

/**
 * Persistent vertical rail of builder destinations. Hidden below `lg`, where
 * `BuilderTopBar` exposes the same destinations in a menu.
 */
export function BuilderRail({ destinations, activeDestinationId }) {
  if (destinations.length === 0) return null;

  return (
    <nav
      aria-label="Builder destinations"
      className="hidden shrink-0 flex-col border-r border-border bg-card lg:flex"
      style={{ width: BUILDER_RAIL_WIDTH }}
    >
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
        {destinations.map((destination) => {
          const Icon = BUILDER_DESTINATION_ICONS[destination.id];
          const active = destination.id === activeDestinationId;
          return (
            <li key={destination.id}>
              <Link
                href={destination.href}
                aria-current={active ? "page" : undefined}
                title={destination.description}
                className={cn(
                  "group relative flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-center transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r bg-[var(--admin-accent)]"
                    aria-hidden
                  />
                )}
                {Icon && <Icon className="h-5 w-5" aria-hidden />}
                <span className="text-[10px] font-medium leading-tight">
                  {destination.shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border p-1.5">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Open the published site in a new tab"
        >
          <ExternalLink className="h-5 w-5" aria-hidden />
          <span className="text-[10px] font-medium leading-tight">Live Site</span>
        </a>
      </div>
    </nav>
  );
}
