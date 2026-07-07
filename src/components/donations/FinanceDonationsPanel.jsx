"use client";

import Link from "next/link";
import { ExternalLink, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DonationSettingsSheet } from "@/components/builder/DonationSettingsSheet";
import { DonationsManager } from "@/components/donations/DonationsManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { requestPublicRevalidate } from "@/lib/cache/revalidate-client";

const TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "giving-pages", label: "Giving pages" },
];

/**
 * @typedef {{
 *   id: string,
 *   slug: string,
 *   title: string,
 *   donationConfig: object,
 *   updatedAt: string | null,
 * }} DonationPageSummary
 */

export function FinanceDonationsPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState("ledger");
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError, setPagesError] = useState(null);
  const [editingPage, setEditingPage] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadPages = useCallback(async () => {
    if (!user) return;

    setPagesLoading(true);
    setPagesError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/finance/donation-pages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load giving pages");
      setPages(data.pages || []);
    } catch (err) {
      setPagesError(err instanceof Error ? err.message : "Failed to load giving pages");
      setPages([]);
    } finally {
      setPagesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (tab === "giving-pages") {
      loadPages();
    }
  }, [tab, loadPages]);

  async function handleSaveDonationConfig(donationConfig) {
    if (!editingPage || !user) return;

    const token = await user.getIdToken();
    const res = await fetch(`/api/finance/donation-pages/${editingPage.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ donationConfig }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save donation settings");

    await requestPublicRevalidate({
      getIdToken: () => user.getIdToken(),
      scope: "page",
      slug: editingPage.slug,
    });

    setPages((current) =>
      current.map((page) => (page.id === editingPage.id ? { ...page, ...data } : page)),
    );
    setEditingPage((current) => (current ? { ...current, ...data } : current));
  }

  function openSettings(page) {
    setEditingPage(page);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setEditingPage(null);
  }

  return (
    <div className="flex h-full flex-col bg-muted">
      <div className="flex border-b border-border bg-card">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-6 py-3 text-sm font-medium ${
              tab === item.id
                ? "admin-tab-active text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === "ledger" && <DonationsManager />}

        {tab === "giving-pages" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Giving pages</CardTitle>
                <CardDescription>
                  Configure funds, preset amounts, and form text for each online giving page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pagesLoading && (
                  <p className="text-sm text-muted-foreground">Loading giving pages…</p>
                )}
                {pagesError && <p className="text-sm text-destructive">{pagesError}</p>}
                {!pagesLoading && !pagesError && pages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No donation pages yet. Ask a site admin to create a page with type Donation in
                    the site map.
                  </p>
                )}
                {pages.map((page) => {
                  const href = page.slug ? `/${page.slug}` : "/";
                  return (
                    <div
                      key={page.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{page.title || "Give"}</p>
                        <p className="truncate text-sm text-muted-foreground">{href}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openSettings(page)}
                        >
                          <Settings2 className="mr-1.5 h-4 w-4" />
                          Configure
                        </Button>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={href} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1.5 h-4 w-4" />
                            View live
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <DonationSettingsSheet
        open={settingsOpen}
        page={editingPage}
        onClose={closeSettings}
        onSave={handleSaveDonationConfig}
      />
    </div>
  );
}
