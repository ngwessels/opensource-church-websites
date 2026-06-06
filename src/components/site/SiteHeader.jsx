"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SectionOverlay } from "@/components/builder/SectionOverlay";
import {
  filterNavTreeForDisplay,
  isExternalHref,
  resolveNavHref,
} from "@/lib/sitemap/tree";
import { resolveHeaderStyles } from "@/lib/site/header-styles";

const HeaderStylesContext = createContext(null);

function useHeaderStyles() {
  return useContext(HeaderStylesContext);
}

const NAV_LINK_CLASS = "site-nav-link";

function navLinkStyle(depth, mobile, headerStyles) {
  if (mobile) {
    return { className: "block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50" };
  }

  return {
    className:
      depth > 0
        ? `${NAV_LINK_CLASS} block px-4 py-2 text-sm`
        : `${NAV_LINK_CLASS} block px-3 py-2.5 text-sm font-medium`,
    style: headerStyles.navFontSize ? { fontSize: headerStyles.navFontSize } : undefined,
  };
}

function NavItem({ node, navNodes, depth = 0, mobile = false }) {
  const headerStyles = useHeaderStyles();
  const href = resolveNavHref(navNodes, node);
  const isExternal = node.type === "link" && isExternalHref(href);

  if (node.type === "group") {
    const hasLanding = node.pageId && href !== "#";
    const groupLinkStyle = mobile
      ? { className: "block px-3 py-2 text-sm font-semibold text-zinc-900" }
      : {
          className: `${NAV_LINK_CLASS} block px-3 py-2.5 text-sm font-medium`,
          style: headerStyles?.navFontSize ? { fontSize: headerStyles.navFontSize } : undefined,
        };

    if (mobile) {
      return (
        <li>
          {hasLanding ? (
            <Link href={href} className={groupLinkStyle.className}>
              {node.title}
            </Link>
          ) : (
            <span className={groupLinkStyle.className}>{node.title}</span>
          )}
          <ul className="pl-3">
            {node.children?.map((child) => (
              <NavItem key={child.id} node={child} navNodes={navNodes} depth={depth + 1} mobile />
            ))}
          </ul>
        </li>
      );
    }

    return (
      <li className="group relative">
        {hasLanding ? (
          <Link href={href} className={groupLinkStyle.className} style={groupLinkStyle.style}>
            {node.title}
          </Link>
        ) : (
          <span className={groupLinkStyle.className} style={groupLinkStyle.style}>
            {node.title}
          </span>
        )}
        {node.children?.length > 0 && (
          <ul
            className="absolute left-0 top-full z-20 hidden min-w-[220px] rounded-md py-1 shadow-lg group-hover:block"
            style={{
              backgroundColor: headerStyles?.navBackground,
              fontFamily: headerStyles?.navFont,
            }}
          >
            {node.children.map((child) => (
              <NavItem key={child.id} node={child} navNodes={navNodes} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const { className, style } = navLinkStyle(depth, mobile, headerStyles || {});

  if (node.type === "link") {
    return (
      <li>
        <a
          href={href}
          className={className}
          style={style}
          target={isExternal ? "_blank" : "_self"}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {node.title}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className={className} style={style}>
        {node.title}
      </Link>
    </li>
  );
}

export function SiteHeader({
  siteConfig,
  navTree,
  navNodes = [],
  quickLinks,
  navStyle = "solid",
  editing = false,
  onHeaderSettings,
}) {
  const name = siteConfig?.name || "Parish";
  const tagline = siteConfig?.tagline || "";
  const headerConfig = siteConfig?.headerConfig || {};
  const headerStyles = resolveHeaderStyles(headerConfig, siteConfig?.design);
  const showTagline = headerConfig.showTagline !== false;
  const showLogo = headerConfig.showLogo && headerConfig.logoUrl;
  const layout = headerConfig.layout || "centered";

  const navClass = navStyle === "transparent" ? "bg-transparent" : "shadow-sm";
  const displayNavTree = filterNavTreeForDisplay(navTree);

  function QuickLinkAnchor({ link, href }) {
    const external = link.type === "link" && isExternalHref(href);
    if (external) {
      return (
        <a href={href} className="hover:underline" target="_blank" rel="noopener noreferrer">
          {link.title}
        </a>
      );
    }
    if (link.type === "link") {
      return (
        <a href={href} className="hover:underline" target="_self">
          {link.title}
        </a>
      );
    }
    return (
      <Link href={href} className="hover:underline">
        {link.title}
      </Link>
    );
  }

  const navStyleProps = {
    "--site-nav-text": headerStyles.navTextColor,
    "--site-nav-bg": headerStyles.navBackground,
    ...(headerStyles.navFontSize ? { "--site-nav-font-size": headerStyles.navFontSize } : {}),
    fontFamily: headerStyles.navFont,
    ...(navStyle === "transparent" ? {} : { backgroundColor: headerStyles.navBackground }),
  };

  return (
    <HeaderStylesContext.Provider value={headerStyles}>
      <header id="header" className="relative">
        {quickLinks?.length > 0 && (
          <nav
            id="quickLinks"
            aria-label="Quick links"
            className="absolute top-0 right-0 left-0 z-10 px-4 py-1 text-sm"
            style={{
              color: headerStyles.titleColor,
              fontFamily: headerStyles.navFont,
              fontSize: headerStyles.navFontSize || undefined,
            }}
          >
            <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-start gap-x-1 gap-y-1">
              {quickLinks.map((link, i) => {
                const href = resolveNavHref(navNodes, link);
                return (
                  <li key={link.id} className="inline-flex items-center">
                    {i > 0 && <span className="mx-2 opacity-50" aria-hidden="true">|</span>}
                    <QuickLinkAnchor link={link} href={href} />
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div
          className={`relative px-4 py-8 ${layout === "logoLeft" ? "text-left" : "text-center"}`}
          style={{ backgroundColor: headerStyles.headerBackground }}
        >
          {editing && (
            <SectionOverlay
              label="TITLE"
              onClick={() => onHeaderSettings?.("title")}
            />
          )}
          <div
            className={`mx-auto flex max-w-6xl items-center gap-6 ${
              layout === "logoLeft" ? "flex-row" : "flex-col justify-center"
            }`}
          >
            {showLogo && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-white/10">
                <Image src={headerConfig.logoUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            )}
            <div>
              <h1
                className={headerStyles.titleFontSize ? "" : "text-3xl tracking-wide md:text-4xl"}
                style={{
                  color: headerStyles.titleColor,
                  fontFamily: headerStyles.titleFont,
                  fontWeight: headerStyles.titleFontWeight,
                  fontSize: headerStyles.titleFontSize || undefined,
                }}
              >
                {name}
              </h1>
              {showTagline && tagline && (
                <p
                  className={headerStyles.titleFontSize ? "mt-2" : "mt-2 text-sm md:text-base"}
                  style={{
                    color: headerStyles.taglineColor,
                    fontFamily: headerStyles.taglineFont,
                  }}
                >
                  {tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav
        className={navClass}
        id="navBackground"
        aria-label="Main navigation"
        style={navStyleProps}
      >
        {editing && (
          <SectionOverlay
            label="NAV"
            onClick={() => onHeaderSettings?.("nav")}
          />
        )}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-2">
          <ul className="hidden flex-wrap items-center justify-center gap-1 md:flex">
            {displayNavTree.map((node) => (
              <NavItem key={node.id} node={node} navNodes={navNodes} />
            ))}
          </ul>

          <Sheet>
            <SheetTrigger
              className="ml-auto p-3 md:hidden"
              style={{ color: headerStyles.navTextColor }}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <nav aria-label="Main navigation">
                <ul className="space-y-1">
                  {displayNavTree.map((node) => (
                    <NavItem key={node.id} node={node} navNodes={navNodes} mobile />
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </HeaderStylesContext.Provider>
  );
}
