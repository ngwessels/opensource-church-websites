"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { BulletinEmailPrompt } from "@/components/bulletins/BulletinEmailPrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultBulletinDate } from "@/lib/bulletins/schema";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

export async function deleteBulletin(bulletinId, { getIdToken } = {}) {
  if (!getIdToken) {
    throw new Error("You must be signed in to delete a bulletin.");
  }

  const token = await getIdToken();
  const res = await fetch(`/api/bulletins?id=${encodeURIComponent(bulletinId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to delete bulletin.");
  }
}

/**
 * Number of people a new bulletin could be emailed to, or 0 when email is not
 * set up. A failure here never blocks the upload that just succeeded.
 *
 * @param {string} idToken
 * @returns {Promise<number>}
 */
async function loadEmailAudience(idToken) {
  try {
    const res = await fetch("/api/admin/email-list/subscribers", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.mailgunConfigured ? Number(data.stats?.subscribed) || 0 : 0;
  } catch {
    return 0;
  }
}

export function BulletinAdminControls({ onChange }) {
  const { user } = useAuth();
  const [date, setDate] = useState(getDefaultBulletinDate);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [emailPrompt, setEmailPrompt] = useState(
    /** @type {{ bulletin: Record<string, any>, subscriberCount: number } | null} */ (null),
  );
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!date) {
      setError("Please select a publish date.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!user) {
      setError("You must be signed in to upload a bulletin.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const db = getFirebaseFirestore();
    const duplicate = await getDocs(
      query(collection(db, COLLECTIONS.bulletins), where("date", "==", date)),
    );
    if (!duplicate.empty) {
      setError("A bulletin already exists for this date.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const media = await uploadMediaFile(
        db,
        file,
        DEFAULT_MEDIA_FOLDERS.documents,
        setProgress,
      );

      const token = await user.getIdToken();
      const res = await fetch("/api/bulletins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          title: title.trim() || undefined,
          mediaId: media.id,
          downloadUrl: media.downloadUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save bulletin.");
      }

      setDate(getDefaultBulletinDate());
      setTitle("");
      await onChange?.();

      const audience = await loadEmailAudience(token);
      if (audience) {
        setEmailPrompt({ bulletin: data.bulletin, subscriberCount: audience });
      }
    } catch (err) {
      setError(err.message || "Failed to upload bulletin.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mb-4 border-b border-zinc-200 pb-4">
      {emailPrompt && (
        <BulletinEmailPrompt
          bulletin={emailPrompt.bulletin}
          subscriberCount={emailPrompt.subscriberCount}
          onDismiss={() => setEmailPrompt(null)}
        />
      )}
      <h3 className="mb-3 text-sm font-semibold text-zinc-900">Add bulletin</h3>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="bulletin-date" className="text-xs text-zinc-600">
            Publish date
          </Label>
          <Input
            id="bulletin-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bulletin-title" className="text-xs text-zinc-600">
            Title (optional)
          </Label>
          <Input
            id="bulletin-title"
            type="text"
            placeholder="e.g. Pentecost Sunday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? `Uploading ${progress}%` : "Upload PDF"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
