"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { DesignPreviewGate } from "@/app/(public)/DesignPreviewGate";
import { PublicSite } from "@/components/site/PublicSite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client gate for password-protected pages.
 * Keeps the public RSC static (no cookies() there); unlock cookie is checked via API.
 *
 * @param {{ pageId: string, pageTitle?: string, slug: string }} props
 */
export function PasswordProtectedPage({ pageId, pageTitle, slug }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [siteProps, setSiteProps] = useState(null);

  const loadUnlockedView = async () => {
    const res = await fetch(`/api/pages/unlocked-view?slug=${encodeURIComponent(slug || "")}`, {
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.props) {
      setSiteProps(data.props);
      setError(null);
      return true;
    }
    setSiteProps(null);
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadUnlockedView();
      } catch {
        // Stay on password form.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per slug
  }, [slug]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pages/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pageId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Incorrect password.");
        return;
      }
      const ok = await loadUnlockedView();
      if (!ok) {
        setError("Password accepted, but the page could not be loaded. Try refreshing.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (siteProps) {
    return (
      <DesignPreviewGate slug={slug}>
        <PublicSite {...siteProps} />
      </DesignPreviewGate>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-foreground">
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">{pageTitle || "Protected page"}</h1>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter the page password to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-password">Password</Label>
            <Input
              id="page-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !password.trim()}>
            {submitting ? "Checking…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
