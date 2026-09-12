"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { RichEmailEditor } from "@/components/email/RichEmailEditor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { adminSectionHref } from "@/lib/builder/navigation";
import { getBulletinLabel } from "@/lib/bulletins/schema";

/**
 * Offered right after a bulletin upload: email it to the parish list with an
 * optional note. Rendered only when Mailgun is connected and somebody is
 * subscribed, so the sidebar stays quiet for sites that do not use email.
 *
 * @param {{
 *   bulletin: { id: string, date?: string, title?: string },
 *   subscriberCount: number,
 *   onDismiss: () => void,
 * }} props
 */
export function BulletinEmailPrompt({ bulletin, subscriberCount, onDismiss }) {
  const { user } = useAuth();
  const [introHtml, setIntroHtml] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const label = getBulletinLabel(bulletin);

  async function send() {
    setSending(true);
    setError("");
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/email-list/campaigns", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send",
          kind: "bulletin",
          bulletinId: bulletin.id,
          html: introHtml,
          attachPdf,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the bulletin.");
      setResult(
        `Sent to ${data.campaign.sentCount} of ${data.campaign.recipientCount} subscriber(s).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the bulletin.");
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <p>{result}</p>
        <button type="button" className="mt-1 underline" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  if (!mailgunConfigured) {
    return (
      <div className="mb-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs text-zinc-700">
          <strong>{label}</strong> is published. Connect Mailgun under{" "}
          <a className="underline" href={adminSectionHref("email")}>
            Admin → Email
          </a>{" "}
          before you can email bulletins to your list.
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (subscriberCount <= 0) {
    return (
      <div className="mb-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs text-zinc-700">
          <strong>{label}</strong> is published. Add people to your{" "}
          <a className="underline" href={adminSectionHref("emailList")}>
            email list
          </a>{" "}
          before you can email bulletins to everyone.
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs text-zinc-700">
        <strong>{label}</strong> is published. Email it to the {subscriberCount} people on your{" "}
        <a className="underline" href={adminSectionHref("emailList")}>
          email list
        </a>
        ?
      </p>

      {composing && (
        <div className="space-y-2">
          <RichEmailEditor
            value={introHtml}
            onChange={setIntroHtml}
            placeholder="Optional note to go above the bulletin link…"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={attachPdf}
              onChange={(e) => setAttachPdf(e.target.checked)}
            />
            Attach the bulletin PDF
          </label>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {composing ? (
          <Button type="button" size="sm" onClick={send} disabled={sending}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {sending ? "Sending…" : `Send to ${subscriberCount}`}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => setComposing(true)}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Email the bulletin
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss} disabled={sending}>
          Not now
        </Button>
      </div>
    </div>
  );
}
