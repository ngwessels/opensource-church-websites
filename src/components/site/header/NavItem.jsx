"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { toBuilderHref } from "@/lib/builder/navigation";
import { isExternalHref, resolveNavHref } from "@/lib/sitemap/tree";

import { NAV_LINK_CLASS, useHeaderStyles } from "./header-context";

function isNavLinkActive(pathname, href) {
  if (!pathname || !href || href === "#") return false;
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

function navLinkStyle(depth, mobile, headerStyles) {
  if (mobile) {
    return {
      className: cn(
        "site-mobile-nav-link",
        depth > 0 && "site-mobile-nav-link--child",
      ),
    };
  }

  return {
    className:
      depth > 0
        ? `${NAV_LINK_CLASS} block px-4 py-2 text-sm`
        : `${NAV_LINK_CLASS} block px-3 py-2.5 text-sm font-medium`,
    style: headerStyles?.navFontSize ? { fontSize: headerStyles.navFontSize } : undefined,
  };
}

function MobileNavLink({ href, className, isExternal, isActive, onNavigate, children }) {
  const shared = {
    className,
    "aria-current": isActive ? "page" : undefined,
    onClick: onNavigate,
  };

  if (isExternal) {
    return (
      <a href={href} {...shared} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link href={href} {...shared}>
      {children}
    </Link>
  );
}

export function NavItem({
  node,
  navNodes,
  depth = 0,
  mobile = false,
  editing = false,
  onNavigate,
}) {
  const headerStyles = useHeaderStyles();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const href = toBuilderHref(resolveNavHref(navNodes, node), editing);
  const isExternal = node.type === "link" && isExternalHref(href);
  const isActive = isNavLinkActive(pathname, href);

  if (node.type === "group") {
    const hasLanding = node.pageId && href !== "#";
    const childCount = node.children?.length ?? 0;

    const groupLinkStyle = mobile
      ? { className: cn("site-mobile-nav-link", "site-mobile-nav-link--group") }
      : {
          className: `${NAV_LINK_CLASS} block px-3 py-2.5 text-sm font-medium`,
          style: headerStyles?.navFontSize ? { fontSize: headerStyles.navFontSize } : undefined,
        };

    if (mobile) {
      return (
        <li className="site-mobile-nav-item">
          <div className="site-mobile-nav-group-header">
            {hasLanding ? (
              <MobileNavLink
                href={href}
                className={cn(groupLinkStyle.className, isActive && "site-mobile-nav-link--active")}
                isExternal={false}
                isActive={isActive}
                onNavigate={onNavigate}
              >
                {node.title}
              </MobileNavLink>
            ) : (
              <span className={groupLinkStyle.className}>{node.title}</span>
            )}
            {childCount > 0 && (
              <button
                type="button"
                className="site-mobile-nav-group-toggle"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${node.title}`}
                onClick={() => setExpanded((value) => !value)}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {childCount > 0 && expanded && (
            <ul className="site-mobile-nav-children">
              {node.children.map((child) => (
                <NavItem
                  key={child.id}
                  node={child}
                  navNodes={navNodes}
                  depth={depth + 1}
                  mobile
                  editing={editing}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          )}
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
              <NavItem
                key={child.id}
                node={child}
                navNodes={navNodes}
                depth={depth + 1}
                editing={editing}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const { className, style } = navLinkStyle(depth, mobile, headerStyles || {});

  if (node.type === "link") {
    if (mobile) {
      return (
        <li className="site-mobile-nav-item">
          <MobileNavLink
            href={href}
            className={cn(className, isActive && "site-mobile-nav-link--active")}
            isExternal={isExternal}
            isActive={isActive}
            onNavigate={onNavigate}
          >
            {node.title}
          </MobileNavLink>
        </li>
      );
    }

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

  if (mobile) {
    return (
      <li className="site-mobile-nav-item">
        <MobileNavLink
          href={href}
          className={cn(className, isActive && "site-mobile-nav-link--active")}
          isExternal={false}
          isActive={isActive}
          onNavigate={onNavigate}
        >
          {node.title}
        </MobileNavLink>
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
