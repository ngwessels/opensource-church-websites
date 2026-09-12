"use client";

import { CheckCircle2, Circle, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { emailStatusLabel } from "@/lib/mailgun/events";
import { MAILGUN_REGIONS, MAILGUN_REGION_LABELS } from "@/lib/mailgun/settings";

const EMPTY_FORM = {
  alias: "",
  apiKey: "",
  region: "us",
  sendingDomain: "",
  webhookSigningKey: "",
  trackOpens: true,
  trackClicks: true,
  forwardTo: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {string} status
 * @returns {'default' | 'secondary' | 'outline' | 'destructive'}
 */
function statusVariant(status) {
  switch (status) {
    case "delivered":
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
    default:
      return "outline";
  }
}

/** @param {unknown} value */
function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** @param {unknown} kind */
function formatKind(kind) {
  switch (kind) {
    case "form_notification":
      return "Form notification";
    case "prayer_digest":
      return "Prayer digest";
    case "user_invite":
      return "Admin invite";
    case "test":
      return "Test email";
    default:
      return "Other";
  }
}

export function EmailIntegrationPanel() {
  const { user } = useAuth();
  const [status, setStatus] = useState(/** @type {Record<string, any> | null} */ (null));
  const [form, setForm] = useState(EMPTY_FORM);
  const [messages, setMessages] = useState(/** @type {Array<Record<string, any>>} */ ([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [testTo, setTestTo] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const getAuthHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user]);

  const loadStatus = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/email", { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load email settings.");
    setStatus(data);
    setForm((prev) => ({
      ...prev,
      apiKey: "",
      webhookSigningKey: "",
      alias: data.settings.source === "env" ? "" : data.settings.alias || "",
      region: data.settings.region || "us",
      sendingDomain: data.settings.sendingDomain || "",
      trackOpens: data.settings.trackOpens !== false,
      trackClicks: data.settings.trackClicks !== false,
      forwardTo: data.settings.forwardTo || "",
    }));
    return data;
  }, [getAuthHeaders]);

  const loadMessages = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/email/events?limit=25", { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load email activity.");
    setMessages(data.messages || []);
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadStatus();
        if (!cancelled) await loadMessages();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load email settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, loadStatus, loadMessages]);

  async function saveSettings() {
    const forwardTo = form.forwardTo.trim();
    if (forwardTo && !EMAIL_RE.test(forwardTo)) {
      setNotice("");
      setError("Enter a valid address in “Forward replies and inbound email to”, or leave it blank.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: form.alias,
          region: form.region,
          sendingDomain: form.sendingDomain,
          trackOpens: form.trackOpens,
          trackClicks: form.trackClicks,
          forwardTo,
          enabled: true,
          // Secrets are only sent when the admin typed a new value.
          ...(form.apiKey.trim() ? { apiKey: form.apiKey } : {}),
          ...(form.webhookSigningKey.trim() ? { webhookSigningKey: form.webhookSigningKey } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save email settings.");
      setStatus(data);
      setForm((prev) => ({ ...prev, apiKey: "", webhookSigningKey: "" }));
      const failed = data.registration?.failed || [];
      const lastError = data.settings?.webhook?.lastError || "";
      setNotice(
        [
          failed.length > 0
            ? `Saved. Mailgun accepted the key, but ${failed.length} webhook(s) could not be registered.${lastError ? ` ${lastError}` : ""}`
            : `Saved. Mailgun is connected and ${data.registration?.registered?.length ?? 0} webhooks are registered.`,
          data.forwarding?.summary,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (data.forwarding?.error) setError(data.forwarding.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save email settings.");
    } finally {
      setSaving(false);
    }
  }

  /** @param {'send_test' | 'register_webhooks'} action */
  async function runAction(action) {
    setBusyAction(action);
    setError("");
    setNotice("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(action === "send_test" ? { action, to: testTo } : { action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");

      switch (action) {
        case "send_test":
          setNotice(`Test email sent to ${data.to}. Its status will appear below shortly.`);
          await loadMessages();
          break;
        case "register_webhooks":
          setStatus(data);
          setNotice(
            [
              `Registered ${data.registration?.registered?.length ?? 0} Mailgun webhooks.`,
              data.forwarding?.summary,
            ]
              .filter(Boolean)
              .join(" "),
          );
          if (data.forwarding?.error) setError(data.forwarding.error);
          break;
        default:
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function disconnect() {
    setBusyAction("disconnect");
    setError("");
    setNotice("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/email", { method: "DELETE", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect Mailgun.");
      setStatus(data);
      setForm(EMPTY_FORM);
      setNotice("Mailgun disconnected. The site keeps working; email notifications are off.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Mailgun.");
    } finally {
      setBusyAction("");
    }
  }

  async function refreshActivity() {
    setBusyAction("refresh");
    try {
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load email activity.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading email settings…</p>;
  }

  const settings = status?.settings;
  const usingEnv = settings?.source === "env";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-foreground">Email (Mailgun)</h3>
          <Badge variant={settings?.configured ? "default" : "outline"}>
            {settings?.configured ? "Connected" : "Not configured"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Optional. Without it your site still works — contact forms are saved and shown under each
          page, but no notification emails are sent.
        </p>
        {settings?.configured && (
          <p className="text-sm text-foreground">
            Sending as <strong>{settings.alias}</strong> through <strong>{settings.domain}</strong>
            {usingEnv ? " (from MAILGUN_* environment variables)" : ""}.
          </p>
        )}
        {settings?.inboundRoute?.active && (
          <p className="text-sm text-foreground">
            Replies and inbound email are forwarded to{" "}
            <strong>{settings.inboundRoute.forwardTo}</strong>.
          </p>
        )}
      </Card>

      {usingEnv && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            This site is using the legacy{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">MAILGUN_API_KEY</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">MAILGUN_DOMAIN</code>, and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">MAILGUN_FROM</code>{" "}
            environment variables. Saving an alias and API key below moves the settings into the app,
            where delivery tracking is available.
          </p>
        </Card>
      )}

      <Card className="space-y-4 p-4">
        <div>
          <h3 className="font-medium text-foreground">Connect your Mailgun account</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Create a free account at{" "}
              <a className="underline" href="https://www.mailgun.com" target="_blank" rel="noreferrer">
                mailgun.com
              </a>{" "}
              and add (or verify) your sending domain.
            </li>
            <li>
              Copy your private API key from <strong>Mailgun → API keys</strong>.
            </li>
            <li>Enter the alias you want email to come from, paste the key, and save.</li>
          </ol>
        </div>

        <div>
          <Label htmlFor="mailgun-alias">Alias (from address)</Label>
          <Input
            id="mailgun-alias"
            value={form.alias}
            onChange={(e) => setForm({ ...form, alias: e.target.value })}
            placeholder="Parish Office &lt;parish@mg.yourparish.org&gt;"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Either{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">parish@mg.yourparish.org</code> or{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              Name &lt;parish@mg.yourparish.org&gt;
            </code>
            . The sending domain is taken from this address.
          </p>
        </div>

        <div>
          <Label htmlFor="mailgun-key">Mailgun API key</Label>
          <Input
            id="mailgun-key"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={settings?.hasApiKey ? `Saved (${settings.apiKeyPreview}) — leave blank to keep` : "key-…"}
            autoComplete="off"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="mailgun-region">Mailgun region</Label>
          <Select value={form.region} onValueChange={(region) => setForm({ ...form, region })}>
            <SelectTrigger id="mailgun-region" className="mt-1 w-full">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {MAILGUN_REGIONS.map((region) => (
                <SelectItem key={region} value={region}>
                  {MAILGUN_REGION_LABELS[region]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Advanced</summary>
          <div className="mt-3 space-y-4">
            <div>
              <Label htmlFor="mailgun-domain">Sending domain override</Label>
              <Input
                id="mailgun-domain"
                value={form.sendingDomain}
                onChange={(e) => setForm({ ...form, sendingDomain: e.target.value })}
                placeholder="mg.yourparish.org"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Only needed when the alias domain differs from the Mailgun domain.
              </p>
            </div>
            <div>
              <Label htmlFor="mailgun-forward-to">Forward replies and inbound email to</Label>
              <Input
                id="mailgun-forward-to"
                type="email"
                value={form.forwardTo}
                onChange={(e) => setForm({ ...form, forwardTo: e.target.value })}
                placeholder="Optional — office@yourparish.org"
                autoComplete="off"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank for no forwarding. With an address here, Mailgun forwards everything sent
                to <strong>{settings?.domain || "your sending domain"}</strong> — replies to email the
                site sent, and brand-new messages — on to that mailbox. Inbound mail only reaches
                Mailgun once the sending domain&apos;s MX records point at it, and the address has to be
                outside the sending domain so mail cannot loop.
              </p>
            </div>
            <div>
              <Label htmlFor="mailgun-signing-key">Webhook signing key</Label>
              <Input
                id="mailgun-signing-key"
                type="password"
                value={form.webhookSigningKey}
                onChange={(e) => setForm({ ...form, webhookSigningKey: e.target.value })}
                placeholder={settings?.hasWebhookSigningKey ? "Saved — leave blank to keep" : "Optional"}
                autoComplete="off"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional extra check. Inbound events are already authenticated by the secret in the
                webhook URL; adding the key from <strong>Mailgun → Webhooks</strong> also verifies each
                payload signature.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.trackOpens}
                onChange={(e) => setForm({ ...form, trackOpens: e.target.checked })}
              />
              Track opens
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.trackClicks}
                onChange={(e) => setForm({ ...form, trackClicks: e.target.checked })}
              />
              Track link clicks
            </label>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Saving…" : "Save and connect"}
          </Button>
          {settings?.configured && settings.source === "settings" && (
            <Button variant="outline" onClick={disconnect} disabled={busyAction === "disconnect"}>
              {busyAction === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="font-medium text-foreground">Delivery tracking</h3>
        <ul className="space-y-2 text-sm">
          <CheckItem done={Boolean(settings?.configured)} label="Mailgun connected" />
          <CheckItem
            done={Boolean(settings?.webhook?.registered)}
            label="Webhooks registered"
            detail={(settings?.webhook?.events?.length ? settings.webhook.events : status?.webhookEvents || []).join(", ")}
          />
          <CheckItem
            done={Boolean(settings?.configured && settings?.trackOpens)}
            label="Open tracking enabled"
          />
          <CheckItem
            done={Boolean(settings?.configured && settings?.trackClicks)}
            label="Click tracking enabled"
          />
          {settings?.forwardTo && (
            <CheckItem
              done={Boolean(settings?.inboundRoute?.active)}
              label={`Inbound email forwarded to ${settings.forwardTo}`}
              detail={
                settings?.inboundRoute?.active
                  ? `Mailgun route ${settings.inboundRoute.expression}`
                  : "Save again to register the Mailgun route."
              }
            />
          )}
        </ul>
        {settings?.inboundRoute?.lastError && (
          <p className="text-sm text-destructive">
            Last forwarding error: {settings.inboundRoute.lastError}
          </p>
        )}
        {status?.webhookUrl && (
          <div>
            <Label htmlFor="mailgun-webhook-url">Webhook URL</Label>
            <Input id="mailgun-webhook-url" readOnly value={status.webhookUrl} className="mt-1 font-mono text-xs" />
            <p className="mt-1 text-xs text-muted-foreground">
              Registered with Mailgun automatically. Re-register it after changing your site domain.
            </p>
          </div>
        )}
        {settings?.webhook?.lastError && (
          <p className="text-sm text-destructive">Last webhook error: {settings.webhook.lastError}</p>
        )}
        {settings?.configured && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="mailgun-test-to">Send a test email to</Label>
              <Input
                id="mailgun-test-to"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={user?.email || "you@example.org"}
                className="mt-1"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => runAction("send_test")}
              disabled={busyAction === "send_test"}
            >
              <Send className="mr-2 h-4 w-4" />
              {busyAction === "send_test" ? "Sending…" : "Send test"}
            </Button>
            <Button
              variant="outline"
              onClick={() => runAction("register_webhooks")}
              disabled={busyAction === "register_webhooks"}
            >
              {busyAction === "register_webhooks" ? "Registering…" : "Re-register webhooks"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Recent email</h3>
          <Button variant="ghost" size="sm" onClick={refreshActivity} disabled={busyAction === "refresh"}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No email sent yet. Messages appear here with their delivery status once Mailgun reports
            back.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Sent</th>
                  <th className="py-2 pr-3 font-medium">To</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.sentAt)}
                    </td>
                    <td className="py-2 pr-3">{(row.to || []).join(", ")}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{formatKind(row.kind)}</td>
                    <td className="py-2 pr-3">{row.subject || "—"}</td>
                    <td className="py-2">
                      <Badge variant={statusVariant(String(row.status || "queued"))}>
                        {emailStatusLabel(String(row.status || "queued"))}
                      </Badge>
                      {row.failureReason && (
                        <p className="mt-1 text-xs text-destructive">{String(row.failureReason)}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** @param {{ done: boolean, label: string, detail?: string }} props */
function CheckItem({ done, label, detail }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-2 text-foreground">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${done ? "text-emerald-600" : "text-muted-foreground/40"}`} />
      <span>
        {label}
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </li>
  );
}
