"use client";

import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { Grid, List, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { formatBytes, uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

import { FileDetailsSheet } from "./FileDetailsSheet";
import { FileGrid } from "./FileGrid";
import { FolderTree } from "./FolderTree";

export function FileManager() {
  const [tab, setTab] = useState("pictures");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(DEFAULT_MEDIA_FOLDERS.pictures);
  const [view, setView] = useState("grid");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detailsFile, setDetailsFile] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const unsub = onSnapshot(collection(db, COLLECTIONS.mediaFolders), (snap) => {
      setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const q = query(collection(db, COLLECTIONS.media), where("folderId", "==", selectedFolder));
    const unsub = onSnapshot(q, (snap) => {
      setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedFolder]);

  const totalBytes = files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    setUploading(true);
    const db = getFirebaseFirestore();

    try {
      for (const file of fileList) {
        await uploadMediaFile(db, file, selectedFolder, setProgress);
      }
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId) => {
    const db = getFirebaseFirestore();
    await deleteDoc(doc(db, COLLECTIONS.media, fileId));
  };

  const storageLimit = 5 * 1024 * 1024 * 1024;
  const storagePct = Math.min(100, (totalBytes / storageLimit) * 100);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex border-b border-border">
        {["pictures", "documents"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setSelectedFolder(
                t === "pictures" ? DEFAULT_MEDIA_FOLDERS.pictures : DEFAULT_MEDIA_FOLDERS.documents,
              );
            }}
            className={`px-6 py-3 text-sm font-medium capitalize ${
              tab === t ? "admin-tab-active text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 px-4">
          <div className="hidden w-40 sm:block">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Storage</span>
              <span>{formatBytes(totalBytes)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--admin-accent)]"
                style={{ width: `${storagePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 shrink-0 border-r p-4">
          <FolderTree
            folders={folders.filter((f) => f.type === tab.slice(0, -1) || f.type === tab)}
            selectedId={selectedFolder}
            onSelect={setSelectedFolder}
            onAddSubfolder={() => {}}
          />
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? `Uploading ${progress}%` : `Upload ${tab === "pictures" ? "Pictures" : "Documents"}`}
            </button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <div className="flex gap-1">
              <button type="button" onClick={() => setView("grid")} className={`rounded p-2 ${view === "grid" ? "bg-muted" : ""}`}>
                <Grid className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView("list")} className={`rounded p-2 ${view === "list" ? "bg-muted" : ""}`}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <FileGrid
              files={files}
              view={view}
              onDelete={handleDelete}
              onEdit={setDetailsFile}
            />
          </div>
        </div>
      </div>

      <FileDetailsSheet
        file={detailsFile}
        open={!!detailsFile}
        onClose={() => setDetailsFile(null)}
      />
    </div>
  );
}
