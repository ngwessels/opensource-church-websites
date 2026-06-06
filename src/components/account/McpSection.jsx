"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, MCP_SUBCOLLECTION } from "@/lib/firestore/paths";
import { buildCursorMcpOAuthConfig } from "@/lib/mcp/tokens";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function McpSection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminReady, setAdminReady] = useState(true);
  const [error, setError] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const activeConnections = connections.filter((c) => !c.revokedAt);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  const cursorConfig = buildCursorMcpOAuthConfig({ appUrl });

  useEffect(() => {
    if (!user?.uid) return;

    const db = getFirebaseFirestore();
    const q = query(
      collection(db, COLLECTIONS.users, user.uid, MCP_SUBCOLLECTION),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setConnections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/mcp-tokens", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAdminReady(res.status !== 503);
      } catch {
        setAdminReady(false);
      }
    }
    checkAdmin();
  }, [user]);

  const getAuthHeaders = useCallback(async () => {
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [user]);

  async function handleRevoke(connectionId) {
    if (!confirm("Revoke this MCP connection? The client will need to authorize again.")) return;
    setRevokingId(connectionId);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/mcp-tokens/${connectionId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke connection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke connection");
    } finally {
      setRevokingId(null);
    }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MCP Connections</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading connections…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Connections</CardTitle>
        <CardDescription>
          Connect Cursor or other MCP clients via OAuth. You sign in and approve access in your
          browser — no API keys to copy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!adminReady && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            MCP requires Firebase Admin credentials on the server. Set{" "}
            <code className="text-xs">FIREBASE_ADMIN_*</code> and{" "}
            <code className="text-xs">MCP_OAUTH_COOKIE_SECRET</code> in your environment.
          </p>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">Connect in Cursor</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open Cursor Settings → MCP</li>
            <li>Add the configuration below (URL only — no token)</li>
            <li>When prompted, sign in and accept access in your browser</li>
          </ol>
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(cursorConfig, null, 2)}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText(JSON.stringify(cursorConfig, null, 2))}
          >
            Copy Cursor config
          </Button>
        </div>

        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No authorized connections yet. Add the server in Cursor and complete the OAuth flow to
            see connections here.
          </p>
        ) : (
          <ul className="divide-y rounded-md border border-border">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {conn.clientName || conn.name || "MCP Client"}
                    </span>
                    <Badge variant={conn.revokedAt ? "secondary" : "default"}>
                      {conn.revokedAt ? "Revoked" : "Active"}
                    </Badge>
                    {conn.authMethod === "oauth" && (
                      <Badge variant="outline">OAuth</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Authorized {formatDate(conn.createdAt)}
                    {conn.lastUsedAt ? ` · Last used ${formatDate(conn.lastUsedAt)}` : ""}
                    {conn.expiresAt ? ` · Expires ${formatDate(conn.expiresAt)}` : ""}
                  </p>
                </div>
                {!conn.revokedAt && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokingId === conn.id}
                    onClick={() => handleRevoke(conn.id)}
                  >
                    {revokingId === conn.id ? "Revoking…" : "Revoke"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
