"use client";

import Link from "next/link";
import { ChevronRight, ChevronsUpDown, CircleHelp, ExternalLink, Menu } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_TOOLBAR_HEIGHT } from "@/lib/design/admin-tokens";
import { BUILDER_DESTINATION_ICONS } from "@/lib/design/builder-nav-icons";
import { cn } from "@/lib/utils";

function initials(email) {
  if (!email) return "?";
  const part = email.split("@")[0] || "";
  return part.slice(0, 2).toUpperCase();
}

/**
 * Single-row builder chrome: site switcher, breadcrumb wayfinding, and account
 * actions. Destinations live in `BuilderRail` from `lg` up and in the menu
 * button here on narrower screens.
 */
export function BuilderTopBar({
  siteName,
  destinations,
  activeDestination,
  sections = [],
  activeSection,
  utilityLabel,
  userEmail,
  helpHref,
  searchSlot,
  onLogOut,
}) {
  const contextLabel = activeDestination?.label || utilityLabel;

  return (
    <header
      className="relative z-50 flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4"
      style={{ height: ADMIN_TOOLBAR_HEIGHT }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {destinations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 text-muted-foreground lg:hidden"
                aria-label="Builder menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Go to</DropdownMenuLabel>
              {destinations.map((destination) => {
                const Icon = BUILDER_DESTINATION_ICONS[destination.id];
                const active = destination.id === activeDestination?.id;
                return (
                  <DropdownMenuItem key={destination.id} asChild>
                    <Link href={destination.href} className={cn(active && "font-medium text-foreground")}>
                      {Icon && <Icon className="h-4 w-4" />}
                      {destination.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          CS
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <span className="max-w-[9rem] truncate text-sm font-semibold text-foreground sm:max-w-[14rem]">
              {siteName}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Website</DropdownMenuLabel>
            <DropdownMenuItem disabled className="opacity-100">
              <span className="truncate font-medium text-foreground">{siteName}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                View live site
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {contextLabel && (
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 md:flex">
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            <span
              className={cn(
                "truncate text-sm",
                activeSection ? "text-muted-foreground" : "font-medium text-foreground",
              )}
            >
              {contextLabel}
            </span>
            {activeSection && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                <span className="truncate text-sm font-medium text-foreground">
                  {activeSection.label}
                </span>
              </>
            )}
          </nav>
        )}

        {sections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 max-w-[12rem] gap-1.5 truncate md:hidden"
              >
                <span className="truncate">{activeSection?.label || "Sections"}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>{activeDestination?.label}</DropdownMenuLabel>
              {sections.map((section) => (
                <DropdownMenuItem key={section.id} asChild>
                  <Link
                    href={section.href}
                    className={cn(section.id === activeSection?.id && "font-medium text-foreground")}
                  >
                    {section.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {searchSlot}

        {helpHref && (
          <Link
            href={helpHref}
            className="hidden rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
            aria-label="Documentation"
            title="Site documentation"
          >
            <CircleHelp className="h-5 w-5" />
          </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                {initials(userEmail)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {userEmail}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/" target="_blank" rel="noreferrer">
                View live site
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/builder/account">Account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogOut}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
