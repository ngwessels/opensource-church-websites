"use client";

import { filterNavTreeForDisplay } from "@/lib/sitemap/tree";
import { resolveDesignTheme } from "@/lib/design/themes";
import { inlineMobileNavRowClass } from "@/lib/pages/viewports";
import { resolveHeaderStyles } from "@/lib/site/header-styles";
import { cn } from "@/lib/utils";

import { HeaderStylesContext } from "./header/header-context";
import { MobileNav } from "./header/MobileNav";
import { renderHeaderVariant } from "./header/HeaderVariants";

export function SiteHeader({
  siteConfig,
  navTree,
  navNodes = [],
  quickLinks,
  navStyle = "solid",
  headerVariant = "centeredBanner",
  quickLinksVariant = "inline",
  editing = false,
  onHeaderSettings,
  previewViewport = null,
}) {
  const headerConfig = siteConfig?.headerConfig || {};
  const { structure } = resolveDesignTheme(siteConfig?.design);
  const headerStyles = resolveHeaderStyles(headerConfig, {
    ...siteConfig?.design,
    structure,
  });
  const displayNavTree = filterNavTreeForDisplay(navTree);
  const isInlineNav = headerVariant === "inlineNav";

  const sharedProps = {
    siteConfig,
    navNodes,
    quickLinks,
    headerStyles,
    displayNavTree,
    navStyle,
    quickLinksVariant,
    editing,
    onHeaderSettings,
    previewViewport,
  };

  return (
    <HeaderStylesContext.Provider value={headerStyles}>
      {renderHeaderVariant(headerVariant, sharedProps)}
      {isInlineNav && (
        <div className={cn(inlineMobileNavRowClass(previewViewport))}>
          <div
            className="flex items-center justify-end border-t px-2"
            style={{ backgroundColor: headerStyles.navBackground }}
          >
            <MobileNav
              displayNavTree={displayNavTree}
              navNodes={navNodes}
              headerStyles={headerStyles}
              editing={editing}
              siteName={siteConfig?.name || "Parish"}
              quickLinks={quickLinks}
              previewViewport={previewViewport}
            />
          </div>
        </div>
      )}
    </HeaderStylesContext.Provider>
  );
}
