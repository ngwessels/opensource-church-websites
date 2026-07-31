"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { Download, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  DEFAULT_PRAYER_GROUPS,
  normalizePrayerGroup,
  normalizePrayerIntentionsSettings,
} from "@/lib/prayer-intentions/schema";
import { generateId } from "@/lib/sitemap/tree";
import { cn } from "@/lib/utils";

/**
 * @param {Record<string, unknown>} row
 * @param {string} groupId
 */
function intentionMatchesGroup(row, groupId) {
  if (!groupId) return true;
  const ids = Array.isArray(row.groupIds)
    ? row.groupIds.filter((id) => typeof id === "string")
    : [];
  // Legacy approved rows without groupIds were treated as all groups.
  if (ids.length === 0) return row.status === "approved";
  return ids.includes(groupId);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} dateFrom
 * @param {string} dateTo
 */
function intentionMatchesDateRange(row, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const submittedMs = row.submittedAt ? new Date(String(row.submittedAt)).getTime() : NaN;
  if (!Number.isFinite(submittedMs)) return false;
  if (dateFrom) {
    const fromMs = new Date(`${dateFrom}T00:00:00`).getTime();
    if (Number.isFinite(fromMs) && submittedMs < fromMs) return false;
  }
  if (dateTo) {
    const toMs = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (Number.isFinite(toMs) && submittedMs > toMs) return false;
  }
  return true;
}

export function PrayerIntentionsPanel() {
  const { user } = useAuth();
  const { config: siteConfig } = useSiteConfig();
  const [intentions, setIntentions] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [filter, setFilter] = useState(/** @type {'all' | 'approved' | 'rejected'} */ ("all"));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const liveSettings = useMemo(
    () => normalizePrayerIntentionsSettings(siteConfig?.prayerIntentions),
    [siteConfig?.prayerIntentions],
  );
  const [draftSettings, setDraftSettings] = useState(
    /** @type {import('@/lib/prayer-intentions/schema').PrayerIntentionsSettings | null} */ (null),
  );
  const settings = draftSettings ?? liveSettings;
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirebaseFirestore();
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.prayerIntentions),
      (snap) => {
        setError("");
        setIntentions(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""))),
        );
      },
      (err) => {
        console.error("[prayer-intentions] inbox listen failed:", err);
        setError(
          err?.code === "permission-denied"
            ? "Cannot read prayer intentions. Deploy updated Firestore rules that allow admin read on prayerIntentions."
            : err?.message || "Failed to load prayer intentions.",
        );
      },
    );
    return () => unsub();
  }, [user?.uid]);

  const scoped = useMemo(() => {
    return intentions.filter(
      (row) =>
        intentionMatchesDateRange(row, dateFrom, dateTo) &&
        intentionMatchesGroup(row, groupFilter),
    );
  }, [intentions, dateFrom, dateTo, groupFilter]);

  const filtered = useMemo(() => {
    if (filter === "all") return scoped;
    return scoped.filter((row) => row.status === filter);
  }, [filter, scoped]);

  const hasExtraFilters = Boolean(dateFrom || dateTo || groupFilter);

  const counts = useMemo(() => {
    return {
      all: scoped.length,
      approved: scoped.filter((r) => r.status === "approved").length,
      rejected: scoped.filter((r) => r.status === "rejected").length,
      pendingDigest: intentions.filter((r) => r.status === "approved" && !r.includedInDigestAt)
        .length,
    };
  }, [scoped, intentions]);

  async function getAuthHeaders() {
    const token = await user?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function setStatus(intentionIds, status) {
    setBusyId(intentionIds[0] || "batch");
    setError("");
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/prayer-intentions", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ intentionIds, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage(`Marked ${data.updated} intention(s) as ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    setError("");
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ export: "csv" });
      if (filter !== "all") params.set("status", filter);
      if (groupFilter) params.set("groupId", groupFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/admin/prayer-intentions?${params}`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prayer-intentions.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  function clearExtraFilters() {
    setDateFrom("");
    setDateTo("");
    setGroupFilter("");
  }

  async function saveSettings() {
    setSavingSettings(true);
    setError("");
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/prayer-intentions", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setDraftSettings(null);
      setMessage("Prayer group settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function sendDigestNow() {
    setSendingDigest(true);
    setError("");
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/prayer-intentions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_digest" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Digest failed");
      if (data.skipped) {
        setMessage(data.reason || "Digest skipped.");
      } else {
        setMessage(
          `Digest sent: ${data.intentionCount} intention(s) to ${data.sent} group(s).`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Digest failed");
    } finally {
      setSendingDigest(false);
    }
  }

  function updateGroup(index, patch) {
    setDraftSettings((prev) => {
      const base = prev ?? liveSettings;
      return {
        ...base,
        groups: base.groups.map((g, i) => (i === index ? normalizePrayerGroup({ ...g, ...patch }) : g)),
      };
    });
  }

  function addGroup() {
    setDraftSettings((prev) => {
      const base = prev ?? liveSettings;
      return {
        ...base,
        groups: [
          ...base.groups,
          { id: generateId(), name: "New group", description: "", emails: [] },
        ],
      };
    });
  }

  function removeGroup(index) {
    setDraftSettings((prev) => {
      const base = prev ?? liveSettings;
      return {
        ...base,
        groups: base.groups.filter((_, i) => i !== index),
      };
    });
  }

  function resetDefaultGroups() {
    setDraftSettings((prev) => {
      const base = prev ?? liveSettings;
      return {
        ...base,
        groups: DEFAULT_PRAYER_GROUPS.map((g) => {
          const existing = base.groups.find((x) => x.id === g.id || x.name === g.name);
          return {
            id: g.id,
            name: g.name,
            description: existing?.description || g.description,
            emails: existing?.emails || [],
          };
        }),
      };
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {(message || error) && (
        <div
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800",
          )}
        >
          {error || message}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Prayer intention inbox</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              AI auto-rejects spam and harmful intentions; rejected entries stay here for audit. You can
              override any decision.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", `All (${counts.all})`],
                ["approved", `Approved (${counts.approved})`],
                ["rejected", `Rejected (${counts.rejected})`],
              ]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(/** @type {'all' | 'approved' | 'rejected'} */ (id))}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  filter === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="prayer-date-from">From</Label>
              <Input
                id="prayer-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prayer-date-to">To</Label>
              <Input
                id="prayer-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label>Prayer group</Label>
              <Select
                value={groupFilter || "all"}
                onValueChange={(v) => setGroupFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {liveSettings.groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!hasExtraFilters}
                onClick={clearExtraFilters}
              >
                Clear filters
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {intentions.length === 0
                ? "No prayer intentions yet."
                : "No prayer intentions match these filters."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => {
                const moderation = /** @type {Record<string, unknown>} */ (row.moderation || {});
                const isApproved = row.status === "approved";
                const assignedGroupIds = Array.isArray(row.groupIds)
                  ? row.groupIds.map(String)
                  : [];
                const assignedNames = settings.groups
                  .filter((g) => assignedGroupIds.includes(g.id))
                  .map((g) => g.name);
                return (
                  <article key={String(row.id)} className="rounded-lg border bg-card">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{String(row.name || "Anonymous")}</p>
                          <Badge variant={isApproved ? "default" : "secondary"}>
                            {isApproved ? "Approved" : "Rejected"}
                          </Badge>
                          {row.includedInDigestAt ? (
                            <Badge variant="outline">In digest</Badge>
                          ) : isApproved ? (
                            <Badge variant="outline">Pending digest</Badge>
                          ) : null}
                          {assignedNames.map((name) => (
                            <Badge key={name} variant="outline">
                              {name}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[row.email, row.phone].filter(Boolean).join(" · ") || "No contact"}
                          {" · "}
                          {row.submittedAt
                            ? new Date(String(row.submittedAt)).toLocaleString()
                            : "Unknown time"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!isApproved && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => setStatus([String(row.id)], "approved")}
                          >
                            Approve
                          </Button>
                        )}
                        {isApproved && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() => setStatus([String(row.id)], "rejected")}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm">{String(row.intention || "")}</p>
                      {moderation.reason ? (
                        <p className="text-xs text-muted-foreground">
                          AI: {String(moderation.reason)}
                          {moderation.error ? ` (${String(moderation.error)})` : ""}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prayer groups & weekly digest</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved intentions are emailed weekly (Monday 15:00 UTC) to matching groups with recipients.
            AI uses each group&apos;s description to decide which groups should pray for an intention.
            Pending digest: {counts.pendingDigest}.
            {settings.lastDigestAt
              ? ` Last sent ${new Date(settings.lastDigestAt).toLocaleString()}.`
              : " No digest sent yet."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {settings.groups.map((group, index) => (
              <div key={group.id} className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <div className="space-y-1">
                    <Label>Group name</Label>
                    <Input
                      value={group.name}
                      onChange={(e) => updateGroup(index, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Emails</Label>
                    <Input
                      value={group.emails.join(", ")}
                      onChange={(e) => updateGroup(index, { emails: e.target.value })}
                      placeholder="person@parish.org, other@parish.org"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGroup(index)}
                      aria-label="Remove group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Description (for AI routing)</Label>
                  <textarea
                    value={group.description || ""}
                    onChange={(e) => updateGroup(index, { description: e.target.value })}
                    rows={2}
                    placeholder="What this group prays for, so AI can assign relevant intentions…"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addGroup}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add group
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetDefaultGroups}>
              Reset default groups
            </Button>
            <Button type="button" size="sm" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving…" : "Save groups"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={sendDigestNow}
              disabled={sendingDigest}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sendingDigest ? "Sending…" : "Send digest now"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
