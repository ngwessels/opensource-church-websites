"use client";

import { Download, Mail, Paperclip, Plus, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RichEmailEditor } from "@/components/email/RichEmailEditor";
import { MediaPicker } from "@/components/media/MediaPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { campaignStatusLabel, formatBytes, subscriberStatusLabel } from "@/lib/email-list/schema";
import { emailStatusLabel, headlineDeliveryCounts } from "@/lib/mailgun/events";
import { cn } from "@/lib/utils";

const SUBSCRIBERS_ENDPOINT = "/api/admin/email-list/subscribers";
const CAMPAIGNS_ENDPOINT = "/api/admin/email-list/campaigns";

/** @param {unknown} value */
function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** @param {unknown} value */
function formatShortDateTime(value) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** @param {string} status */
function subscriberStatusVariant(status) {
  switch (status) {
    case "subscribed":
      return "default";
    case "unsubscribed":
      return "secondary";
    case "bounced":
      return "destructive";
    default:
      return "outline";
  }
}

/** @param {string} status */
function deliveryStatusVariant(status) {
  switch (status) {
    case "opened":
    case "clicked":
      return "default";
    case "failed":
    case "rejected":
    case "complained":
      return "destructive";
    case "queued":
    case "accepted":
      return "secondary";
    case "delivered":
    case "unsubscribed":
    default:
      return "outline";
  }
}

/**
 * @param {{ onOpenSettings?: () => void }} props
 */
export function EmailListPanel({ onOpenSettings }) {
  const { user } = useAuth();
  const [subscribers, setSubscribers] = useState(/** @type {Array<Record<string, any>>} */ ([]));
  const [stats, setStats] = useState({ total: 0, subscribed: 0, unsubscribed: 0, bounced: 0 });
  const [campaigns, setCampaigns] = useState(/** @type {Array<Record<string, any>>} */ ([]));
  const [mailgunConfigured, setMailgunConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [newPeople, setNewPeople] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [attachments, setAttachments] = useState(
    /** @type {Array<{ name: string, url: string, mimeType: string, sizeBytes: number }>} */ ([]),
  );
  const [pickingAttachment, setPickingAttachment] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [deliveryCampaign, setDeliveryCampaign] = useState(/** @type {Record<string, any> | null} */ (null));
  const [deliveryReport, setDeliveryReport] = useState(/** @type {{ summary: Record<string, number>, recipients: Array<Record<string, any>> } | null} */ (null));
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");

  const getAuthHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user]);

  async function openDeliveryReport(campaign) {
    setDeliveryCampaign(campaign);
    setDeliveryReport(null);
    setDeliveryError("");
    setLoadingDelivery(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${CAMPAIGNS_ENDPOINT}?campaignId=${encodeURIComponent(campaign.id)}`,
        { headers },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load delivery details.");
      setDeliveryReport(data);
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : "Could not load delivery details.");
    } finally {
      setLoadingDelivery(false);
    }
  }

  function closeDeliveryReport() {
    setDeliveryCampaign(null);
    setDeliveryReport(null);
    setDeliveryError("");
    setLoadingDelivery(false);
  }

  const loadSubscribers = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(SUBSCRIBERS_ENDPOINT, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load the email list.");
    setSubscribers(data.subscribers || []);
    setStats(data.stats || { total: 0, subscribed: 0, unsubscribed: 0, bounced: 0 });
    setMailgunConfigured(Boolean(data.mailgunConfigured));
  }, [getAuthHeaders]);

  const loadCampaigns = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(CAMPAIGNS_ENDPOINT, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load past sends.");
    setCampaigns(data.campaigns || []);
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadSubscribers();
        if (!cancelled) await loadCampaigns();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the email list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, loadSubscribers, loadCampaigns]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subscribers.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!term) return true;
      return `${row.email} ${row.name || ""}`.toLowerCase().includes(term);
    });
  }, [subscribers, search, statusFilter]);

  const attachmentBytes = attachments.reduce((sum, file) => sum + (file.sizeBytes || 0), 0);

  /**
   * @param {string} action
   * @param {() => Promise<string>} run
   */
  async function withBusy(action, run) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const message = await run();
      if (message) setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy("");
    }
  }

  function addPeople() {
    return withBusy("add", async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(SUBSCRIBERS_ENDPOINT, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPeople, source: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add those addresses.");

      setSubscribers(data.subscribers || []);
      setStats(data.stats || stats);
      setNewPeople("");

      const parts = [`Added ${data.added}`, `updated ${data.updated}`];
      if (data.skipped) parts.push(`left ${data.skipped} opted out`);
      if (data.invalid?.length) parts.push(`skipped ${data.invalid.length} invalid`);
      return `${parts.join(", ")}.`;
    });
  }

  /**
   * @param {Record<string, any>} subscriber
   * @param {'subscribed' | 'unsubscribed'} status
   */
  function setStatus(subscriber, status) {
    return withBusy(`status:${subscriber.id}`, async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(SUBSCRIBERS_ENDPOINT, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: subscriber.id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update that person.");
      await loadSubscribers();
      return `${subscriber.email} is now ${subscriberStatusLabel(status).toLowerCase()}.`;
    });
  }

  /** @param {Record<string, any>} subscriber */
  function remove(subscriber) {
    return withBusy(`remove:${subscriber.id}`, async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${SUBSCRIBERS_ENDPOINT}?id=${encodeURIComponent(subscriber.id)}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove that person.");
      await loadSubscribers();
      return `Removed ${subscriber.email} from the list.`;
    });
  }

  function exportCsv() {
    const header = ["Email", "Name", "Status", "Added", "Last sent"];
    const rows = subscribers.map((row) => [
      row.email,
      row.name || "",
      row.status || "",
      row.createdAt || "",
      row.lastSentAt || "",
    ]);
    const csv = [header, ...rows]
      .map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "email-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  /** @param {'send' | 'send_test'} action */
  function sendCampaign(action) {
    return withBusy(action, async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(CAMPAIGNS_ENDPOINT, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          kind: "newsletter",
          subject,
          html: bodyHtml,
          attachments,
          ...(action === "send_test" ? { testTo: testTo || user?.email || "" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed.");

      if (action === "send_test") {
        return `Test sent to ${data.to}.`;
      }

      setSubject("");
      setBodyHtml("");
      setAttachments([]);
      await loadCampaigns();
      await loadSubscribers();
      return `Sent "${data.campaign.subject}" to ${data.campaign.sentCount} of ${data.campaign.recipientCount} subscriber(s).`;
    });
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading the email list…</p>;
  }

  return (
    <div className="space-y-6">
      {(notice || error) && (
        <div
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800",
          )}
        >
          {error || notice}
        </div>
      )}

      {!mailgunConfigured && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You can build the list now, but sending needs Mailgun connected.{" "}
              {onOpenSettings ? (
                <button type="button" className="underline" onClick={onOpenSettings}>
                  Open email settings
                </button>
              ) : (
                "Open email settings from the gear icon above."
              )}{" "}
              to connect Mailgun, then write to everyone.
            </p>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Email list</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.subscribed} subscribed · {stats.unsubscribed} unsubscribed
              {stats.bounced > 0 ? ` · ${stats.bounced} bounced` : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-list-add">Add people</Label>
            <textarea
              id="email-list-add"
              rows={3}
              value={newPeople}
              onChange={(e) => setNewPeople(e.target.value)}
              placeholder={"anne@example.org\nBob Smith <bob@example.org>, carol@example.org"}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={addPeople} disabled={busy === "add" || !newPeople.trim()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {busy === "add" ? "Adding…" : "Add to list"}
              </Button>
              <p className="text-xs text-muted-foreground">
                One per line, or separated by commas. Names are optional.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label htmlFor="email-list-search">Search</Label>
              <Input
                id="email-list-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or address"
              />
            </div>
            <div className="w-48 space-y-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({stats.total})</SelectItem>
                  <SelectItem value="subscribed">Subscribed ({stats.subscribed})</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed ({stats.unsubscribed})</SelectItem>
                  <SelectItem value="bounced">Bounced ({stats.bounced})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {subscribers.length === 0
                ? "Nobody is on the list yet. Paste some addresses above to get started."
                : "No one matches this search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Address</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Last sent</th>
                    <th className="py-2 font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-t border-border align-middle">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-foreground">{row.email}</span>
                        {row.name && <span className="block text-xs text-muted-foreground">{row.name}</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={subscriberStatusVariant(String(row.status))}>
                          {subscriberStatusLabel(String(row.status))}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.lastSentAt)}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {row.status === "subscribed" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy === `status:${row.id}`}
                              onClick={() => setStatus(row, "unsubscribed")}
                            >
                              Unsubscribe
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy === `status:${row.id}`}
                              onClick={() => setStatus(row, "subscribed")}
                            >
                              Resubscribe
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${row.email}`}
                            disabled={busy === `remove:${row.id}`}
                            onClick={() => remove(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Write to the list</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Goes to everyone subscribed ({stats.subscribed}). Each person gets their own unsubscribe
            link at the bottom of the email.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-subject">Subject</Label>
            <Input
              id="campaign-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="This week at the parish"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Message</Label>
            <RichEmailEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((file) => (
                  <li
                    key={file.url}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span className="truncate">
                      {file.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setAttachments((prev) => prev.filter((f) => f.url !== file.url))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPickingAttachment(true)}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                Attach a file
              </Button>
              <p className="text-xs text-muted-foreground">
                PDFs and documents from your files. {formatBytes(attachmentBytes)} of 10.0 MB used.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="campaign-test-to">Send a test to</Label>
              <Input
                id="campaign-test-to"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={user?.email || "you@example.org"}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!mailgunConfigured || busy === "send_test"}
              onClick={() => sendCampaign("send_test")}
            >
              {busy === "send_test" ? "Sending…" : "Send test"}
            </Button>
            <Button
              type="button"
              disabled={!mailgunConfigured || stats.subscribed === 0 || busy === "send"}
              onClick={() => setConfirmingSend(true)}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {busy === "send" ? "Sending…" : `Send to ${stats.subscribed}`}
            </Button>
          </div>
          {!mailgunConfigured && (
            <p className="text-xs text-muted-foreground">
              Sending is off until Mailgun is connected.{" "}
              {onOpenSettings ? (
                <button type="button" className="underline" onClick={onOpenSettings}>
                  Open email settings
                </button>
              ) : (
                "Use the gear icon above to connect Mailgun."
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Past sends</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing sent yet. Delivery, opens, and clicks for each send also appear in email
              settings.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Sent</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Recipients</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(campaign.sentAt)}
                      </td>
                      <td className="py-2 pr-3">
                        {campaign.subject}
                        {campaign.kind === "bulletin" && (
                          <Badge variant="outline" className="ml-2">
                            Bulletin
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {campaign.sentCount} of {campaign.recipientCount}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => openDeliveryReport(campaign)}
                          title="View delivery details"
                        >
                          <Badge
                            variant={campaign.status === "failed" ? "destructive" : "outline"}
                            className="cursor-pointer hover:bg-accent"
                          >
                            {campaignStatusLabel(campaign.status)}
                          </Badge>
                        </button>
                        {campaign.error && (
                          <p className="mt-1 text-xs text-destructive">{campaign.error}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={pickingAttachment} onOpenChange={setPickingAttachment}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attach a file</DialogTitle>
          </DialogHeader>
          <div className="min-h-[380px]">
            <MediaPicker
              title="Choose a file"
              mediaFilter="all"
              acceptImagesOnly={false}
              onSelect={(file) => {
                if (file?.downloadUrl) {
                  setAttachments((prev) =>
                    prev.some((f) => f.url === file.downloadUrl)
                      ? prev
                      : [
                          ...prev,
                          {
                            name: file.name || "attachment",
                            url: file.downloadUrl,
                            mimeType: file.mimeType || "",
                            sizeBytes: Number(file.sizeBytes) || 0,
                          },
                        ],
                  );
                }
                setPickingAttachment(false);
              }}
              onCancel={() => setPickingAttachment(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingSend} onOpenChange={setConfirmingSend}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send to {stats.subscribed} subscriber(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &ldquo;{subject || "(no subject)"}&rdquo; goes out immediately and cannot be recalled.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmingSend(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmingSend(false);
                sendCampaign("send");
              }}
            >
              Send now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeliveryDetailsDialog
        campaign={deliveryCampaign}
        report={deliveryReport}
        loading={loadingDelivery}
        error={deliveryError}
        onOpenChange={(open) => {
          if (!open) closeDeliveryReport();
        }}
      />
    </div>
  );
}

/**
 * @param {{
 *   label: string,
 *   value: number,
 *   tone?: 'default' | 'danger',
 * }} props
 */
function DeliveryStat({ label, value, tone = "default" }) {
  const zero = value === 0;
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          zero && "text-muted-foreground",
          !zero && tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * @param {{
 *   campaign: Record<string, any> | null,
 *   report: { summary: Record<string, number>, recipients: Array<Record<string, any>> } | null,
 *   loading: boolean,
 *   error: string,
 *   onOpenChange: (open: boolean) => void,
 * }} props
 */
function DeliveryDetailsDialog({ campaign, report, loading, error, onOpenChange }) {
  const metrics = headlineDeliveryCounts(report?.summary);
  const recipientCount = report?.recipients.length ?? 0;

  return (
    <Dialog open={Boolean(campaign)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,44rem)] flex-col gap-5 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Delivery details
          </p>
          <DialogTitle className="text-lg leading-snug font-semibold">
            {campaign?.subject?.trim() ? campaign.subject : "(no subject)"}
          </DialogTitle>
          <DialogDescription>
            {campaign?.sentAt ? `Sent ${formatDateTime(campaign.sentAt)}` : "Sent time unavailable"}
            {campaign?.kind === "bulletin" ? " · Bulletin" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Loading delivery details…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {report && !loading && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <DeliveryStat label="Delivered" value={metrics.delivered} />
              <DeliveryStat label="Opened" value={metrics.opened} />
              <DeliveryStat label="Clicked" value={metrics.clicked} />
              <DeliveryStat label="Failed" value={metrics.failed} tone="danger" />
              <DeliveryStat label="Pending" value={metrics.pending} />
              {metrics.complained > 0 && (
                <DeliveryStat label="Marked as spam" value={metrics.complained} tone="danger" />
              )}
              {metrics.unsubscribed > 0 && (
                <DeliveryStat label="Unsubscribed" value={metrics.unsubscribed} />
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                Recipients
                {recipientCount > 0 ? (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {recipientCount}
                  </span>
                ) : null}
              </p>

              {recipientCount === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No per-recipient tracking yet. Details appear once Mailgun reports delivery
                  events.
                </div>
              ) : (
                <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-popover text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 font-medium">Recipient</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Opened</th>
                        <th className="px-3 py-2.5 font-medium">Clicked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.recipients.map((row) => (
                        <tr key={row.email} className="border-b border-border last:border-0">
                          <td className="px-3 py-2.5 align-top font-medium break-all">
                            {row.email}
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">
                            <Badge variant={deliveryStatusVariant(String(row.status))}>
                              {emailStatusLabel(String(row.status))}
                            </Badge>
                            {row.failureReason && (
                              <p className="mt-1 max-w-[16rem] text-xs leading-snug text-destructive">
                                {row.failureReason}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatShortDateTime(row.openedAt)}
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatShortDateTime(row.clickedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
