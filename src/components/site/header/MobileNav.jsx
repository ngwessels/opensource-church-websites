"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toBuilderHref } from "@/lib/builder/navigation";
import { mobileNavTriggerVisibilityClass } from "@/lib/pages/viewports";
import { isExternalHref, resolveNavHref } from "@/lib/sitemap/tree";
import { cn } from "@/lib/utils";

import { NavItem } from "./NavItem";

function MobileQuickLinks({ quickLinks, navNodes, editing, onNavigate }) {
  if (!quickLinks?.length) return null;

  return (
    <div className="site-mobile-nav-quick-links">
      <p className="site-mobile-nav-section-label">Quick links</p>
      <ul className="site-mobile-nav-quick-list">
        {quickLinks.map((link) => {
          const href = toBuilderHref(resolveNavHref(navNodes, link), editing);
          const external = link.type === "link" && isExternalHref(href);
          const className = "site-mobile-nav-quick-link";

          return (
            <li key={link.id}>
              {external ? (
                <a
                  href={href}
                  className={className}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                >
                  {link.title}
                </a>
              ) : link.type === "link" ? (
                <a href={href} className={className} onClick={onNavigate}>
                  {link.title}
                </a>
              ) : (
                <Link href={href} className={className} onClick={onNavigate}>
                  {link.title}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MobileNav({
  displayNavTree,
  navNodes,
  headerStyles,
  editing,
  siteName = "Parish",
  quickLinks,
  previewViewport = null,
}) {
  const [open, setOpen] = useState(false);

  const closeNav = () => setOpen(false);

  const headerStyle = {
    backgroundColor: headerStyles.navBackground,
    color: headerStyles.navTextColor,
    fontFamily: headerStyles.navFont,
    "--site-mobile-nav-close": headerStyles.navTextColor,
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "site-mobile-nav-trigger items-center gap-2",
          mobileNavTriggerVisibilityClass(previewViewport),
        )}
        style={{ color: headerStyles.navTextColor, fontFamily: headerStyles.navFont }}
        aria-label="Open menu"
      >
        <span>Menu</span>
        <Menu className="h-5 w-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="site-mobile-nav w-full max-w-[min(100vw,22rem)] gap-0 p-0 sm:max-w-sm"
        style={{
          fontFamily: headerStyles.navFont,
          ...(headerStyles.navFontSize ? { fontSize: headerStyles.navFontSize } : {}),
        }}
      >
        <SheetHeader className="site-mobile-nav-header" style={headerStyle}>
          <SheetTitle className="site-mobile-nav-title">{siteName}</SheetTitle>
          <SheetDescription className="site-mobile-nav-subtitle">Navigation</SheetDescription>
        </SheetHeader>

        <div className="site-mobile-nav-body">
          <MobileQuickLinks
            quickLinks={quickLinks}
            navNodes={navNodes}
            editing={editing}
            onNavigate={closeNav}
          />

          <nav aria-label="Main navigation">
            <ul className="site-mobile-nav-list">
              {displayNavTree.map((node) => (
                <NavItem
                  key={node.id}
                  node={node}
                  navNodes={navNodes}
                  mobile
                  editing={editing}
                  onNavigate={closeNav}
                />
              ))}
            </ul>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
