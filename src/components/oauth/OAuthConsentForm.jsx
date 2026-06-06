"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function OAuthConsentForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/oauth/login");
      return;
    }

    async function loadPending() {
      try {
        const res = await fetch("/api/oauth/pending");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No pending authorization");
        setPending(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load authorization request");
      } finally {
        setLoading(false);
      }
    }

    loadPending();
  }, [user, authLoading, router]);

  async function handleConsent(action) {
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Consent failed");

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setError("Missing redirect URL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consent failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return <p className="text-sm text-muted-foreground">Loading authorization request…</p>;
  }

  if (error && !pending) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Authorization unavailable</h1>
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-sm text-muted-foreground">
          Start the connection again from your MCP client (e.g. Cursor).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Authorize MCP access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>{pending?.clientName || "An MCP client"}</strong> is requesting permission to
          manage your church website on your behalf.
        </p>
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
        <p className="font-medium text-foreground">Signed in as</p>
        <p className="text-muted-foreground">{user?.email}</p>
        <p className="mt-3 font-medium text-foreground">Permissions</p>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {(pending?.scopes || ["site:admin"]).map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={submitting}
          onClick={() => handleConsent("deny")}
        >
          Reject
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={submitting}
          onClick={() => handleConsent("accept")}
        >
          {submitting ? "Authorizing…" : "Accept"}
        </Button>
      </div>
    </div>
  );
}
