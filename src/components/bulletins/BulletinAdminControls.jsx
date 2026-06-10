"use client";

import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { requestPublicRevalidate } from "@/lib/cache/revalidate-client";
import { getDefaultBulletinDate } from "@/lib/bulletins/schema";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

function generateBulletinId() {
  return `bulletin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function deleteBulletin(bulletinId) {
  const db = getFirebaseFirestore();
  await deleteDoc(doc(db, COLLECTIONS.bulletins, bulletinId));
}

export function BulletinAdminControls({ onChange }) {
  const { user } = useAuth();
  const [date, setDate] = useState(getDefaultBulletinDate);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
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

      const now = new Date().toISOString();
      const bulletinId = generateBulletinId();
      await setDoc(doc(db, COLLECTIONS.bulletins, bulletinId), {
        date,
        title: title.trim() || undefined,
        mediaId: media.id,
        downloadUrl: media.downloadUrl,
        createdAt: now,
        updatedAt: now,
      });

      setDate(getDefaultBulletinDate());
      setTitle("");
      await requestPublicRevalidate({
        getIdToken: () => user?.getIdToken(),
        scope: "site",
      });
      await onChange?.();
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
