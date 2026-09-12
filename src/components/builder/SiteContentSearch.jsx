"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_LABELS } from "@/lib/design/admin-tokens";
import {
  ADMIN_SECTION_ICONS,
  BUILDER_DESTINATION_ICONS,
} from "@/lib/design/builder-nav-icons";
import {
  ADMIN_SECTIONS,
  adminSectionHref,
  builderDestinationsForRole,
} from "@/lib/builder/navigation";

const SOURCE_LABELS = {
  site: "Site settings",
  nav: "Navigation",
  page: "Page",
  module: "Module",
  bulletin: "Bulletin",
  media: "Media library",
};

/** Every builder capability as a jump target, so nesting never hides a feature. */
const NAV_TARGETS = [
  ...builderDestinationsForRole("admin").map((destination) => ({
    id: `destination-${destination.id}`,
    label: destination.label,
    context: "Builder",
    href: destination.href,
    Icon: BUILDER_DESTINATION_ICONS[destination.id],
    keywords: `${destination.label} ${destination.description}`,
  })),
  ...ADMIN_SECTIONS.filter((section) => section.id !== "overview").map((section) => ({
    id: `admin-${section.id}`,
    label: section.label,
    context: "Admin",
    href: adminSectionHref(section.id),
    Icon: ADMIN_SECTION_ICONS[section.id],
    keywords: `${section.label} ${section.description}`,
  })),
];

function matchNavTargets(query) {
  const q = query.trim().toLowerCase();
  if (!q) return NAV_TARGETS;
  return NAV_TARGETS.filter((target) => target.keywords.toLowerCase().includes(q));
}

function formatResultMeta(result) {
  if (result.source === "module") {
    const typeLabel = MODULE_LABELS[result.moduleType] || result.moduleType;
    return `${result.pageTitle || "Page"} · ${typeLabel}`;
  }
  if (result.source === "page") {
    return result.pageTitle || "Page";
  }
  if (result.source === "nav") {
    return result.pageTitle || "Navigation";
  }
  if (result.source === "bulletin") {
    return "Bulletin archive";
  }
  if (result.source === "media") {
    return "Media library";
  }
  return SOURCE_LABELS[result.source] || result.source;
}

export function SiteContentSearchDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);

  const runSearch = useCallback(
    async (searchQuery) => {
      const q = searchQuery.trim();
      if (!q) {
        setResults([]);
        setTotal(0);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const token = await user?.getIdToken();
        const params = new URLSearchParams({ q, limit: "50" });
        const res = await fetch(`/api/admin/search?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Search failed");
        }
        setResults(data.results || []);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const resetSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setTotal(0);
    setError("");
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) resetSearch();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetSearch],
  );

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query, runSearch]);

  const navMatches = matchNavTargets(query);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Search &amp; jump to</DialogTitle>
          <DialogDescription>
            Go to any builder section, or find names, events, and text across pages, modules,
            settings, bulletins, and media.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a person, page title, or section…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 max-h-[50vh] flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-2 py-2">
            {navMatches.length > 0 && (
              <div className="mb-1">
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Jump to
                </p>
                <ul>
                  {navMatches.map((target) => (
                    <li key={target.id}>
                      <Link
                        href={target.href}
                        onClick={() => handleOpenChange(false)}
                        className="flex items-center gap-3 rounded-md px-4 py-2 hover:bg-muted"
                      >
                        {target.Icon && (
                          <target.Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="text-sm font-medium text-foreground">{target.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{target.context}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {!loading && error && (
              <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
            )}

            {!loading &&
              !error &&
              query.trim() &&
              results.length === 0 &&
              navMatches.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No matches for &ldquo;{query.trim()}&rdquo;
                </p>
              )}

            {!loading && !error && results.length > 0 && (
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Site content
              </p>
            )}

            {!loading && !error && results.length > 0 && (
              <ul className="divide-y">
                {results.map((result, index) => (
                  <li key={`${result.source}-${result.pageId || ""}-${result.moduleId || ""}-${result.field}-${index}`}>
                    <Link
                      href={result.builderUrl || "/builder/edit"}
                      onClick={() => handleOpenChange(false)}
                      className="block rounded-md px-4 py-3 hover:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{formatResultMeta(result)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{result.snippet}</p>
                          {result.field && (
                            <p className="mt-1 text-xs text-muted-foreground/80">{result.field}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {SOURCE_LABELS[result.source] || result.source}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </ScrollArea>
        </div>

        {!loading && !error && total > results.length && (
          <div className="border-t px-6 py-2 text-center text-xs text-muted-foreground">
            Showing {results.length} of {total} matches
          </div>
        )}

        <div className="flex justify-end border-t px-6 py-3">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SiteContentSearchTrigger({ onClick }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0 gap-2 px-2.5 sm:px-3"
      onClick={onClick}
      aria-label="Search site content"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search</span>
    </Button>
  );
}
