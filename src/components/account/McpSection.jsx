"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, MAX_MCP_CONNECTIONS, MCP_SUBCOLLECTION } from "@/lib/firestore/paths";
import { buildCursorMcpConfig } from "@/lib/mcp/tokens";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function McpSection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminReady, setAdminReady] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const activeConnections = connections.filter((c) => !c.revokedAt);

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
      "x-app-url": typeof window !== "undefined" ? window.location.origin : "",
    };
  }, [user]);

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create connection");
      setCreated(data.connection);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create connection");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(connectionId) {
    if (!confirm("Revoke this MCP connection? The token will stop working immediately.")) return;
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

  function copyConfigSnippet(conn) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const config = buildCursorMcpConfig({
      configKey: conn.configKey,
      appUrl,
      token: "YOUR_SAVED_TOKEN_HERE",
    });
    copyText(JSON.stringify(config, null, 2));
  }

  function closeDialog() {
    setDialogOpen(false);
    setCreated(null);
    setError(null);
    setName("");
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>MCP Connections</CardTitle>
          <CardDescription>
            Connect Cursor or other MCP clients to edit your site. Each connection gets its own
            token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!adminReady && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              MCP requires Firebase Admin credentials on the server. Set{" "}
              <code className="text-xs">FIREBASE_ADMIN_*</code> in your environment (e.g. Vercel
              project settings).
            </p>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {activeConnections.length} of {MAX_MCP_CONNECTIONS} active connections
            </p>
            <Button
              type="button"
              disabled={!adminReady || activeConnections.length >= MAX_MCP_CONNECTIONS}
              onClick={() => setDialogOpen(true)}
            >
              Add MCP connection
            </Button>
          </div>

          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCP connections yet.</p>
          ) : (
            <ul className="divide-y rounded-md border border-border">
              {connections.map((conn) => (
                <li key={conn.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{conn.name}</span>
                      <Badge variant={conn.revokedAt ? "secondary" : "default"}>
                        {conn.revokedAt ? "Revoked" : "Active"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {conn.tokenPrefix}… · Created {formatDate(conn.createdAt)}
                      {conn.lastUsedAt ? ` · Last used ${formatDate(conn.lastUsedAt)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Config key: {conn.configKey}</p>
                  </div>
                  {!conn.revokedAt && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyConfigSnippet(conn)}
                      >
                        Copy config
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revokingId === conn.id}
                        onClick={() => handleRevoke(conn.id)}
                      >
                        {revokingId === conn.id ? "Revoking…" : "Revoke"}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle>Connection created</DialogTitle>
                <DialogDescription>
                  Copy your token and Cursor config now. You will not be able to see the token
                  again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Token</Label>
                  <div className="mt-1 flex gap-2">
                    <Input readOnly value={created.token} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => copyText(created.token)}>
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Cursor config</Label>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(created.cursorConfig, null, 2)}
                  </pre>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyText(JSON.stringify(created.cursorConfig, null, 2))}
                  >
                    Copy config
                  </Button>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Open Cursor Settings → MCP</li>
                  <li>Paste the config into your MCP settings file</li>
                  <li>Restart Cursor if the server does not appear</li>
                </ol>
              </div>
              <DialogFooter>
                <Button type="button" onClick={closeDialog}>
                  Done
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreated(null);
                    setName("");
                  }}
                >
                  Add another
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add MCP connection</DialogTitle>
                <DialogDescription>
                  Give this connection a name so you can tell your devices apart.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mcp-name">Connection name</Label>
                  <Input
                    id="mcp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Work MacBook"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !name.trim()}>
                    {creating ? "Creating…" : "Create connection"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
