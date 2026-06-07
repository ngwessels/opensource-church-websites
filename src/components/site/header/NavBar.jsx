"use client";

import { SectionOverlay } from "@/components/builder/SectionOverlay";
import { cn } from "@/lib/utils";
import {
  desktopNavListVisibilityClass,
  inlineNavVisibilityClass,
  navBarContainerJustifyClass,
} from "@/lib/pages/viewports";

import { MobileNav } from "./MobileNav";
import { NavItem } from "./NavItem";

export function NavBar({
  displayNavTree,
  navNodes,
  headerStyles,
  navStyle,
  editing,
  onHeaderSettings,
  inline = false,
  siteName,
  quickLinks,
  previewViewport = null,
}) {
  const navStyleProps = {
    "--site-nav-text": headerStyles.navTextColor,
    "--site-nav-bg": headerStyles.navBackground,
    ...(headerStyles.navFontSize ? { "--site-nav-font-size": headerStyles.navFontSize } : {}),
    fontFamily: headerStyles.navFont,
    ...(navStyle === "transparent" || inline ? {} : { backgroundColor: headerStyles.navBackground }),
  };

  if (inline) {
    return (
      <nav
        className={cn("site-nav-inline", inlineNavVisibilityClass(previewViewport))}
        aria-label="Main navigation"
        style={navStyleProps}
      >
        <ul className="flex flex-wrap items-center justify-end gap-1">
          {displayNavTree.map((node) => (
            <NavItem key={node.id} node={node} navNodes={navNodes} editing={editing} />
          ))}
        </ul>
      </nav>
    );
  }

  const navClass = navStyle === "transparent" ? "bg-transparent" : "shadow-sm";

  return (
    <nav
      className={navClass}
      id="navBackground"
      aria-label="Main navigation"
      style={navStyleProps}
    >
      {editing && (
        <SectionOverlay label="NAV" onClick={() => onHeaderSettings?.("nav")} />
      )}
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center px-2",
          navBarContainerJustifyClass(previewViewport),
        )}
      >
        <ul className={desktopNavListVisibilityClass(previewViewport)}>
          {displayNavTree.map((node) => (
            <NavItem key={node.id} node={node} navNodes={navNodes} editing={editing} />
          ))}
        </ul>
        <MobileNav
          displayNavTree={displayNavTree}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
          siteName={siteName}
          quickLinks={quickLinks}
          previewViewport={previewViewport}
        />
      </div>
    </nav>
  );
}
