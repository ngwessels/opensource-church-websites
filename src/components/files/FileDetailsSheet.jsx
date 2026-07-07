"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { buildClientAuditActor } from "@/lib/firestore/audited-mutation";
import { MAX_MEDIA_ALT_LENGTH, MAX_MEDIA_DESCRIPTION_LENGTH } from "@/lib/media/metadata";
import { updateMediaMetadata } from "@/lib/media/update";
import { formatBytes } from "@/lib/media/upload";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

export function FileDetailsSheet({ file, open, onClose, onSaved }) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [description, setDescription] = useState("");
  const [alt, setAlt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !file) return;
    setDescription(file.description || "");
    setAlt(file.alt || "");
    setTagsInput((file.tags || []).join(", "));
    setError(null);
  }, [open, file]);

  async function handleSave(event) {
    event.preventDefault();
    if (!file) return;

    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const actor = buildClientAuditActor(user, profile);
      await updateMediaMetadata(
        db,
        file.id,
        {
          description,
          alt,
          tags: tagsInput,
        },
        actor
          ? {
              actor,
              action: "update",
              resource: { type: "media", id: file.id },
              summary: `Updated media metadata for ${file.name}`,
              context: { builderPath: "/builder/files", section: "media" },
            }
          : undefined,
      );
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metadata.");
    } finally {
      setSaving(false);
    }
  }

  if (!file) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>File details</SheetTitle>
          <SheetDescription>
            Add a description and tags so AI tools can understand this file. {file.name} ·{" "}
            {formatBytes(file.sizeBytes)}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="space-y-4 px-1">
          <div className="space-y-2">
            <Label htmlFor="file-description">Description</Label>
            <textarea
              id="file-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_MEDIA_DESCRIPTION_LENGTH}
              rows={4}
              placeholder="e.g. Easter Sunday hero image for the homepage"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/{MAX_MEDIA_DESCRIPTION_LENGTH}
            </p>
          </div>

          {file.mimeType?.startsWith("image/") && (
            <div className="space-y-2">
              <Label htmlFor="file-alt">Alt text</Label>
              <Input
                id="file-alt"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                maxLength={MAX_MEDIA_ALT_LENGTH}
                placeholder="Accessible description of the image"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="file-tags">Tags</Label>
            <Input
              id="file-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="bulletin, 2026, lent"
            />
            <p className="text-xs text-muted-foreground">Comma-separated keywords</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
