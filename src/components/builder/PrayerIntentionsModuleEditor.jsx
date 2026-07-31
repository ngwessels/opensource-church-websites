"use client";

import { useMemo, useState } from "react";

import { PrayerIntentionsModule } from "@/components/modules/PrayerIntentionsModule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizePrayerIntentionsConfig } from "@/lib/prayer-intentions/schema";

const overlayZ = { zIndex: ADMIN_Z.overlay };

const textareaClassName =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * @param {object} props
 * @param {{ config?: import('@/lib/prayer-intentions/schema').PrayerIntentionsModuleConfig }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function PrayerIntentionsModuleEditor({ module, onSave, onClose }) {
  const initial = normalizePrayerIntentionsConfig(module?.config);

  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [submitLabel, setSubmitLabel] = useState(initial.submitLabel);
  const [notificationEmails, setNotificationEmails] = useState(
    initial.notificationEmails.join(", "),
  );
  const [moduleInstanceId] = useState(initial.moduleInstanceId);
  const [honeypotFieldName] = useState(initial.honeypotFieldName);

  const previewModule = useMemo(
    () => ({
      config: normalizePrayerIntentionsConfig({
        moduleInstanceId,
        title,
        description,
        submitLabel,
        notificationEmails,
        honeypotFieldName,
      }),
    }),
    [moduleInstanceId, title, description, submitLabel, notificationEmails, honeypotFieldName],
  );

  const handleSave = () => {
    onSave(
      normalizePrayerIntentionsConfig({
        moduleInstanceId,
        title,
        description,
        submitLabel,
        notificationEmails,
        honeypotFieldName,
      }),
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Prayer Intentions</div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Collects name, email or phone, and a prayer intention. Submissions are moderated by AI and
              reviewed under Admin → Prayer Intentions. Submitters always see “Thank you.” only — never
              whether the intention was approved.
            </p>

            <div className="space-y-2">
              <Label htmlFor="prayer-title">Title</Label>
              <Input
                id="prayer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Prayer Intentions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prayer-description">Introduction</Label>
              <textarea
                id="prayer-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={textareaClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prayer-submit-label">Submit button label</Label>
              <Input
                id="prayer-submit-label"
                value={submitLabel}
                onChange={(e) => setSubmitLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prayer-notify">Notification emails (approved only)</Label>
              <Input
                id="prayer-notify"
                value={notificationEmails}
                onChange={(e) => setNotificationEmails(e.target.value)}
                placeholder="pastor@parish.org, office@parish.org"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Comma-separated. Only notified when AI approves an intention.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <PrayerIntentionsModule module={previewModule} editing preview />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
