"use client";

import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { formatBulletinDate, getBulletinLabel } from "@/lib/bulletins/schema";
import { uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";
import { useBulletins } from "@/hooks/useBulletins";

function generateBulletinId() {
  return `bulletin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function BulletinManager() {
  const { bulletins, loading, error: loadError, refresh } = useBulletins();
  const [date, setDate] = useState("");
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

      setDate("");
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to upload bulletin.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (bulletinId) => {
    const db = getFirebaseFirestore();
    await deleteDoc(doc(db, COLLECTIONS.bulletins, bulletinId));
    await refresh();
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Bulletins</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload weekly bulletin PDFs. They appear on any page set to the Bulletins type.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          <section className="rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Add bulletin</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulletin-date">Publish date</Label>
                <Input
                  id="bulletin-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulletin-title">Title (optional)</Label>
                <Input
                  id="bulletin-title"
                  type="text"
                  placeholder="e.g. Pentecost Sunday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? `Uploading ${progress}%` : "Upload PDF"}
                </Button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">All bulletins</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : loadError ? (
              <p className="text-sm text-red-600">{loadError}</p>
            ) : bulletins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bulletins yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {bulletins.map((bulletin) => (
                  <li
                    key={bulletin.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {getBulletinLabel(bulletin)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBulletinDate(bulletin)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={bulletin.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline"
                      >
                        View PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(bulletin.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                        aria-label="Delete bulletin"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
