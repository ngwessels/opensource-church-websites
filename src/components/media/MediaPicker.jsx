"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FileGrid } from "@/components/files/FileGrid";
import { FolderTree } from "@/components/files/FolderTree";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

/** @typedef {'images' | 'videos' | 'all'} MediaFilter */

export function MediaPicker({
  onSelect,
  onCancel,
  acceptImagesOnly = true,
  mediaFilter,
  fullscreen = false,
  title = "Choose media",
}) {
  const resolvedFilter = mediaFilter || (acceptImagesOnly ? "images" : "all");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(DEFAULT_MEDIA_FOLDERS.pictures);
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const pictureFolders = useMemo(
    () => folders.filter((f) => f.type === "picture" || f.type === "pictures"),
    [folders],
  );

  const visibleFiles = useMemo(() => {
    if (resolvedFilter === "all") return files;
    if (resolvedFilter === "videos") {
      return files.filter((f) => f.mimeType?.startsWith("video/"));
    }
    return files.filter((f) => f.mimeType?.startsWith("image/"));
  }, [files, resolvedFilter]);

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    setUploading(true);
    const db = getFirebaseFirestore();

    try {
      const file = fileList[0];
      const record = await uploadMediaFile(db, file, selectedFolder, setProgress);
      onSelect(record);
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSelect = (file) => {
    setSelectedId(file.id);
    onSelect(file);
  };

  const uploadAccept =
    resolvedFilter === "videos" ? "video/*" : resolvedFilter === "images" ? "image/*" : "image/*,video/*";
  const uploadLabel = uploading
    ? `Uploading ${progress}%`
    : resolvedFilter === "videos"
      ? "Upload video"
      : "Upload image";

  const browser = (
    <div className={`flex min-h-0 flex-1 overflow-hidden ${fullscreen ? "" : "gap-4"}`}>
      <aside
        className={`shrink-0 overflow-auto border-r ${
          fullscreen ? "w-48 border-border p-4" : "w-36 pr-3"
        }`}
      >
        <FolderTree
          folders={pictureFolders}
          selectedId={selectedFolder}
          onSelect={setSelectedFolder}
          onAddSubfolder={() => {}}
        />
      </aside>

      <div className={`min-h-0 flex-1 overflow-auto ${fullscreen ? "p-4" : ""}`}>
        <FileGrid
          files={visibleFiles}
          view="grid"
          selectable
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={uploadAccept}
      className="hidden"
      onChange={handleUpload}
    />
  );

  if (fullscreen) {
    return (
      <div className="flex h-full flex-col bg-card">
        <header className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to editor
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex shrink-0 items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploadLabel}
          </button>
          {fileInput}
        </header>
        {browser}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploadLabel}
        </button>
        {fileInput}
      </div>
      {browser}
    </div>
  );
}
