"use client";

import Link from "next/link";

import { toBuilderHref } from "@/lib/builder/navigation";
import { isExternalHref, resolveNavHref } from "@/lib/sitemap/tree";

function QuickLinkAnchor({ link, href, className }) {
  const external = link.type === "link" && isExternalHref(href);
  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {link.title}
      </a>
    );
  }
  if (link.type === "link") {
    return (
      <a href={href} className={className} target="_self">
        {link.title}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {link.title}
    </Link>
  );
}

export function QuickLinks({ quickLinks, navNodes, headerStyles, editing, variant = "inline" }) {
  if (!quickLinks?.length) return null;

  const isUtility = variant === "utilityBar";
  const isBoxed = variant === "boxedCta";
  const linkClass = isBoxed ? "site-quick-link" : "hover:underline";

  return (
    <nav
      id="quickLinks"
      aria-label="Quick links"
      className={
        isUtility
          ? "relative z-10 px-4 py-1.5 text-sm"
          : isBoxed
            ? "absolute top-0 right-0 z-10 text-sm"
            : "absolute top-0 right-0 left-0 z-10 px-4 py-1 text-sm"
      }
      style={{
        color: isUtility || isBoxed ? headerStyles.navTextColor : headerStyles.titleColor,
        fontFamily: headerStyles.navFont,
        fontSize: headerStyles.navFontSize || undefined,
      }}
    >
      <ul
        className={`mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 ${
          isUtility ? "justify-start" : isBoxed ? "justify-end" : "justify-start"
        }`}
      >
        {quickLinks.map((link, i) => {
          const href = toBuilderHref(resolveNavHref(navNodes, link), editing);
          return (
            <li key={link.id} className="inline-flex items-center">
              {!isBoxed && i > 0 && (
                <span className="mx-2 opacity-50" aria-hidden="true">
                  |
                </span>
              )}
              <QuickLinkAnchor link={link} href={href} className={linkClass} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
