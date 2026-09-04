"use client";

import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/lib/media/upload-link-constants";

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function resultJson(data) {
  return JSON.stringify(
    {
      status: data.status || "complete",
      mediaId: data.mediaId || data.media?.id || null,
      downloadUrl: data.downloadUrl || data.media?.downloadUrl || null,
      sizeBytes: data.sizeBytes ?? data.media?.sizeBytes ?? null,
      filename: data.filename || data.media?.name || null,
    },
    null,
    2,
  );
}

function CompleteResult({ data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="size-5" aria-hidden />
          Upload complete
        </CardTitle>
        <CardDescription>
          You can close this tab. The assistant can finish attaching the file to the site.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <section id="status" data-status="complete">
          <pre
            id="result"
            className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed text-foreground"
          >
            {resultJson(data)}
          </pre>
        </section>
      </CardContent>
    </Card>
  );
}

/**
 * Styled dropzone for MCP browser upload links. File input stays visible so
 * AI browser tools can target #file and #upload.
 *
 * @param {{ token: string, initialInfo: Record<string, unknown> }} props
 */
export function McpUploadDropzone({ token, initialInfo }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initialInfo?.status === "complete" ? initialInfo : null);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const info = initialInfo;

  async function uploadFile(file) {
    setBusy(true);
    setError("");
    setProgress("");
    try {
      const maxBytes = Number(info?.maxFileBytes) || MAX_MEDIA_UPLOAD_BYTES;
      if (file.size > maxBytes) {
        throw new Error(`File is larger than ${formatBytes(maxBytes)}`);
      }

      setProgress("Preparing upload…");
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
      const prepare = await prepareRes.json().catch(() => ({}));
      if (!prepareRes.ok) throw new Error(prepare.error || prepare.message || "Could not prepare upload");

      setProgress(`Uploading ${formatBytes(file.size)}…`);
      const putRes = await fetch(prepare.signedUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": prepare.contentType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Storage upload failed (${putRes.status}). Try again or use a smaller file.`);
      }

      setProgress("Finalizing…");
      const finalRes = await fetch(`/api/mcp-upload/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize_signed" }),
      });
      const finalData = await finalRes.json().catch(() => ({}));
      if (!finalRes.ok) throw new Error(finalData.error || finalData.message || "Finalize failed");
      if (!finalData.uploadVerified && finalData.status !== "complete") {
        throw new Error(finalData.agentInstructions || finalData.message || "Upload not verified");
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

  function onSubmit(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : null;
    if (!file) {
      setError("Choose a file, then click Upload.");
      return;
    }
    void uploadFile(file);
  }

  function onFileChange(event) {
    const file = event.currentTarget.files?.[0];
    if (file) void uploadFile(file);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  const status = done
    ? "complete"
    : busy
      ? "uploading"
      : error
        ? "error"
        : info?.status || "waiting";

  if (done) {
    return <CompleteResult data={done} />;
  }

  if (info?.status === "expired") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload link expired</CardTitle>
          <CardDescription>{info.message || "Ask for a new upload link."}</CardDescription>
        </CardHeader>
        <section id="status" data-status="expired" className="sr-only">
          expired
        </section>
      </Card>
    );
  }

  if (info?.status === "not_found" || info?.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload link not found</CardTitle>
          <CardDescription>{info.message || "This upload link is invalid."}</CardDescription>
        </CardHeader>
        <section id="status" data-status="error" className="sr-only">
          error
        </section>
      </Card>
    );
  }

  const maxLabel = formatBytes(Number(info?.maxFileBytes) || MAX_MEDIA_UPLOAD_BYTES);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a file</CardTitle>
        <CardDescription>
          PDF or image, up to {maxLabel}. Drop it on the box or use Choose file — upload starts right away.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="upload-form" className="space-y-4" onSubmit={onSubmit}>
          {info?.purpose ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Requested for:</span> {String(info.purpose)}
            </p>
          ) : null}
          {info?.filenameHint ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Expected file:</span> {String(info.filenameHint)}
            </p>
          ) : null}

          <p id="status" data-status={status} className="text-sm font-medium">
            Status: {status}
            {progress ? ` — ${progress}` : ""}
          </p>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:bg-muted/70",
              busy ? "pointer-events-none opacity-70" : "",
            ].join(" ")}
          >
            {busy ? (
              <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
            ) : (
              <Upload className="size-10 text-primary" aria-hidden />
            )}
            <span className="text-base font-semibold">Drop a file here</span>
            <span className="text-sm text-muted-foreground">or click Choose file</span>
            <input
              id="file"
              name="file"
              type="file"
              required
              disabled={busy}
              accept={
                typeof info?.mimeTypeHint === "string" && info.mimeTypeHint
                  ? info.mimeTypeHint
                  : "application/pdf,image/*"
              }
              className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={onFileChange}
            />
          </label>

          <Button id="upload" type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <FileUp aria-hidden />
                Upload
              </>
            )}
          </Button>

          {error ? (
            <p
              id="error"
              data-status="error"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
