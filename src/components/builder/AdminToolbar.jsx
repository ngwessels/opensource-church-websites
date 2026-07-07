"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, HelpCircle, Menu } from "lucide-react";

import { SiteContentSearchDialog, SiteContentSearchTrigger } from "@/components/builder/SiteContentSearch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_TOOLBAR_HEIGHT } from "@/lib/design/admin-tokens";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const ADMIN_TABS = [
  { href: "/builder/edit", label: "Edit Website" },
  { href: "/builder/design", label: "Design" },
  { href: "/builder/files", label: "Files" },
  { href: "/builder/admin", label: "Admin" },
  { href: "/builder/sitemap", label: "Site Map" },
  { href: "/builder/analytics", label: "Analytics" },
];

const FINANCE_TABS = [{ href: "/builder/donations", label: "Donations" }];

function initials(email) {
  if (!email) return "?";
  const part = email.split("@")[0] || "";
  return part.slice(0, 2).toUpperCase();
}

export function AdminToolbar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();
  const { isFinance } = useUserProfile();
  const { config } = useSiteConfig({ enabled: !isFinance });
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const tabs = isFinance ? FINANCE_TABS : ADMIN_TABS;
  const activeTab = tabs.find((tab) => pathname.startsWith(tab.href)) ?? tabs[0];
  const siteName = isFinance ? "Donations" : config?.name || "My Parish";

  useEffect(() => {
    if (isFinance) return;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFinance]);

  return (
    <header
      className="relative z-50 flex min-w-0 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-border bg-card px-3 sm:gap-3 sm:px-4"
      style={{ height: ADMIN_TOOLBAR_HEIGHT }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            CS
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden items-center gap-1 text-sm font-semibold text-foreground hover:text-foreground sm:flex">
              Websites
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled>{siteName}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="hidden h-full items-stretch xl:flex">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center px-3 text-sm font-medium transition-colors lg:px-4",
                  active
                    ? "admin-tab-active text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-[min(100%,12rem)] gap-1.5 truncate xl:hidden"
            >
              <Menu className="h-4 w-4 shrink-0" />
              <span className="truncate">{activeTab.label}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <DropdownMenuItem key={tab.href} asChild>
                  <Link
                    href={tab.href}
                    className={cn(active && "font-medium text-foreground")}
                  >
                    {tab.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {!isFinance && <SiteContentSearchTrigger onClick={openSearch} />}
        {!isFinance && <SiteContentSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />}

        <DropdownMenu>
          <DropdownMenuTrigger className="hidden max-w-[10rem] items-center gap-1 truncate text-sm text-foreground hover:text-foreground md:flex">
            <span className="truncate">{siteName}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/">View live site</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className="hidden rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                {initials(user?.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="md:hidden">
              <Link href="/">View live site</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/builder/account">Account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logOut()}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
