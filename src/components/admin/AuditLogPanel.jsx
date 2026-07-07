"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { diffSnapshots } from "@/lib/audit/diff";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/schema";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * @param {object} props
 * @param {Array<{ id: string, email?: string, displayName?: string }>} props.users
 */
export function AuditLogPanel({ users = [] }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actorUid, setActorUid] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const authHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user]);

  const loadEvents = useCallback(
    async ({ cursor, append = false } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (actorUid) params.set("actorUid", actorUid);
        if (action) params.set("action", action);
        if (resourceType) params.set("resourceType", resourceType);
        if (query.trim()) params.set("q", query.trim());
        if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
        if (dateTo) params.set("dateTo", new Date(`${dateTo}T23:59:59`).toISOString());
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "50");

        const res = await fetch(`/api/admin/audit?${params.toString()}`, {
          headers: await authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load audit log");

        setEvents((prev) => (append ? [...prev, ...data.events] : data.events));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit log");
      } finally {
        setLoading(false);
      }
    },
    [actorUid, action, resourceType, query, dateFrom, dateTo, authHeaders],
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadDetail = async (eventId) => {
    setSelectedId(eventId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/audit/${eventId}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load event detail");
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const changes = useMemo(() => {
    if (!detail?.snapshots) return [];
    return diffSnapshots(detail.snapshots.before, detail.snapshots.after);
  }, [detail]);

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Search</Label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Summary, email, resource…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Actor</Label>
              <Select value={actorUid || "all"} onValueChange={(v) => setActorUid(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={action || "all"} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {AUDIT_ACTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resource</Label>
              <Select
                value={resourceType || "all"}
                onValueChange={(v) => setResourceType(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {AUDIT_RESOURCE_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={() => loadEvents()} disabled={loading}>
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActorUid("");
                setAction("");
                setResourceType("");
                setQuery("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Who</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className={`cursor-pointer border-b hover:bg-muted/40 ${selectedId === event.id ? "bg-muted/60" : ""}`}
                    onClick={() => loadDetail(event.id)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{event.actor.email || event.actor.uid}</td>
                    <td className="px-3 py-2">{event.action}</td>
                    <td className="px-3 py-2">{event.resource.type}</td>
                    <td className="px-3 py-2">{event.source}</td>
                    <td className="px-3 py-2">{event.summary}</td>
                  </tr>
                ))}
                {!loading && events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => loadEvents({ cursor: nextCursor, append: true })}
            >
              Load more
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedId && (
            <p className="text-sm text-muted-foreground">Select an event to view snapshots and changes.</p>
          )}
          {detailLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {detail?.event && (
            <>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Summary:</span> {detail.event.summary}
                </p>
                <p>
                  <span className="font-medium">Actor:</span>{" "}
                  {detail.event.actor.email || detail.event.actor.uid}
                  {detail.event.actor.role ? ` (${detail.event.actor.role})` : ""}
                </p>
                {detail.event.context?.builderPath && (
                  <p>
                    <span className="font-medium">Where:</span> {detail.event.context.builderPath}
                    {detail.event.context.section ? ` · ${detail.event.context.section}` : ""}
                  </p>
                )}
              </div>

              {changes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Changes</h3>
                  <div className="max-h-48 overflow-auto rounded border bg-muted/20 p-2 text-xs">
                    {changes.slice(0, 100).map((change) => (
                      <div key={change.path} className="border-b border-border/50 py-1">
                        <div className="font-mono text-muted-foreground">{change.path}</div>
                        <div className="text-red-700 line-through">
                          {truncate(JSON.stringify(change.before))}
                        </div>
                        <div className="text-green-700">{truncate(JSON.stringify(change.after))}</div>
                      </div>
                    ))}
                    {changes.length > 100 && (
                      <p className="pt-2 text-muted-foreground">
                        Showing first 100 of {changes.length} changes.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                {detail.snapshots.before !== undefined && (
                  <SnapshotBlock title="Before" data={detail.snapshots.before} />
                )}
                {detail.snapshots.after !== undefined && (
                  <SnapshotBlock title="After" data={detail.snapshots.after} />
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {unknown} props.data
 */
function SnapshotBlock({ title, data }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <pre className="max-h-64 overflow-auto rounded border bg-muted/20 p-2 text-xs whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/**
 * @param {string} value
 */
function truncate(value) {
  if (value.length <= 160) return value;
  return `${value.slice(0, 160)}…`;
}
