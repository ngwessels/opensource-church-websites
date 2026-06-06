import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { toBuilderHref } from "@/lib/builder/navigation";
import { isExternalHref, resolveNavHref } from "@/lib/sitemap/tree";

export function SectionNav({ items, activeNodeId, navNodes, editing = false }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Section navigation">
      {editing && (
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Section navigation
        </p>
      )}
      <ul id="content2" className="region moduleRegion divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
        {items.map((node) => {
          const href = toBuilderHref(resolveNavHref(navNodes, node), editing);
          const isExternal = node.type === "link" && isExternalHref(href);
          const isActive = node.id === activeNodeId;
          const className = `flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
            isActive
              ? "bg-[var(--site-primary,#7f1d1d)] font-medium text-white"
              : "text-zinc-700 hover:text-[var(--site-accent,var(--site-primary))]"
          }`;

          const inner = (
            <>
              <span>{node.title}</span>
              {!isActive && <ChevronRight className="h-4 w-4 text-zinc-400" />}
            </>
          );

          return (
            <li key={node.id}>
              {isExternal ? (
                <a
                  href={href}
                  className={className}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {inner}
                </a>
              ) : node.type === "link" ? (
                <a href={href} className={className}>
                  {inner}
                </a>
              ) : (
                <Link href={href} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
