"use client";

import { useCallback, useEffect, useState } from "react";

const MULTIPART_MAX = Math.floor(3.5 * 1024 * 1024);

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * @param {{ token: string }} props
 */
export function McpUploadDropzone({ token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [progress, setProgress] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/mcp-upload/${token}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load upload link");
    setInfo(data);
    if (data.status === "complete" && data.mediaId) {
      setDone({ id: data.mediaId, status: "complete" });
    }
  }, [token]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function uploadFile(file) {
    setBusy(true);
    setError("");
    setProgress("");
    try {
      if (file.size <= MULTIPART_MAX) {
        setProgress("Uploading…");
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/mcp-upload/${token}`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        if (!data.uploadVerified) throw new Error(data.agentInstructions || "Upload not verified");
        setDone(data);
        setProgress("");
        return;
      }

      setProgress("Preparing direct upload…");
      const prepareRes = await fetch(`/api/mcp-upload/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare_signed",
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const prepare = await prepareRes.json();
      if (!prepareRes.ok) throw new Error(prepare.error || "Could not prepare upload");

      setProgress(`Uploading ${formatBytes(file.size)} directly to storage…`);
      const putRes = await fetch(prepare.signedUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": prepare.contentType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Storage upload failed (${putRes.status}). Try a smaller file or Builder → Files.`);
      }

      setProgress("Finalizing…");
      const finalRes = await fetch(`/api/mcp-upload/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize_signed" }),
      });
      const finalData = await finalRes.json();
      if (!finalRes.ok) throw new Error(finalData.error || "Finalize failed");
      if (!finalData.uploadVerified) {
        throw new Error(finalData.agentInstructions || "Upload not verified");
      }
      setDone(finalData);
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  if (done?.uploadVerified || done?.status === "complete") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <p className="text-lg font-semibold">Upload complete</p>
        <p className="mt-2 text-sm">
          You can close this tab and return to the chat. The assistant can finish attaching the file to
          the site.
        </p>
        {done.sizeBytes != null && (
          <p className="mt-3 text-sm text-emerald-800">Saved size: {formatBytes(done.sizeBytes)}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {info?.purpose && (
        <p className="text-sm text-muted-foreground">
          Requested for: <span className="text-foreground">{info.purpose}</span>
        </p>
      )}
      {info?.filenameHint && (
        <p className="text-sm text-muted-foreground">
          Expected file: <span className="text-foreground">{info.filenameHint}</span>
        </p>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-12 text-center transition hover:bg-muted/70">
        <span className="text-base font-medium">Choose a document or photo</span>
        <span className="text-sm text-muted-foreground">
          PDF or image · up to {formatBytes(info?.maxFileBytes || 10 * 1024 * 1024)}
        </span>
        <input
          type="file"
          className="sr-only"
          disabled={busy || !info}
          accept={info?.mimeTypeHint || "application/pdf,image/*"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
      </label>

      {busy && <p className="text-sm text-muted-foreground">{progress || "Working…"}</p>}
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
