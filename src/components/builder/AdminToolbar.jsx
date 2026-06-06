"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, HelpCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_TOOLBAR_HEIGHT } from "@/lib/design/admin-tokens";
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const TABS = [
  { href: "/builder/edit", label: "Edit Website" },
  { href: "/builder/design", label: "Design" },
  { href: "/builder/files", label: "Files" },
  { href: "/builder/bulletins", label: "Bulletins" },
  { href: "/builder/admin", label: "Admin" },
  { href: "/builder/sitemap", label: "Site Map" },
];

function initials(email) {
  if (!email) return "?";
  const part = email.split("@")[0] || "";
  return part.slice(0, 2).toUpperCase();
}

export function AdminToolbar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();
  const { config } = useSiteConfig();

  return (
    <header
      className="relative z-50 flex shrink-0 items-center justify-between border-b border-border bg-card px-4"
      style={{ height: ADMIN_TOOLBAR_HEIGHT }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            CS
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-foreground">
              Websites
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled>{config?.name || "My Parish"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex h-full items-stretch">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center px-4 text-sm font-medium transition-colors ${
                  active
                    ? "admin-tab-active text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-foreground hover:text-foreground">
            {config?.name || "My Parish"}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/">View live site</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
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
