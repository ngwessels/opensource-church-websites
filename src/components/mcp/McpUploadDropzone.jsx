"use client";

import { useState } from "react";

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
    <section id="status" data-status="complete">
      <h2>Upload complete</h2>
      <p>You can close this tab and return to the chat. The assistant can finish attaching the file to the site.</p>
      <pre id="result">{resultJson(data)}</pre>
    </section>
  );
}

/**
 * Simple upload form for MCP browser upload links. Visible file input and
 * Upload button so AI browser tools can drive it.
 *
 * @param {{ token: string, initialInfo: Record<string, unknown> }} props
 */
export function McpUploadDropzone({ token, initialInfo }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(
    initialInfo?.status === "complete" ? initialInfo : null,
  );
  const [progress, setProgress] = useState("");
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
      setError("Choose a file and click Upload.");
      return;
    }
    void uploadFile(file);
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
      <section id="status" data-status="expired">
        <h2>Upload link expired</h2>
        <p>{info.message || "This upload link has expired. Ask for a new link."}</p>
      </section>
    );
  }

  if (info?.status === "not_found" || info?.status === "error") {
    return (
      <section id="status" data-status="error">
        <h2>Upload link not found</h2>
        <p>{info.message || "This upload link is invalid."}</p>
      </section>
    );
  }

  const maxLabel = formatBytes(Number(info?.maxFileBytes) || MAX_MEDIA_UPLOAD_BYTES);

  return (
    <form id="upload-form" onSubmit={onSubmit}>
      <ol>
        <li>Choose a file with the file input below.</li>
        <li>Click the Upload button.</li>
        <li>Wait until status is complete. The page will show JSON with mediaId and downloadUrl.</li>
      </ol>

      {info?.purpose ? <p>Requested for: {String(info.purpose)}</p> : null}
      {info?.filenameHint ? <p>Expected file: {String(info.filenameHint)}</p> : null}

      <p id="status" data-status={status}>
        Status: {status}
        {progress ? ` — ${progress}` : ""}
      </p>

      <p>
        <label htmlFor="file">File (PDF or image, up to {maxLabel})</label>
        <br />
        <input
          id="file"
          name="file"
          type="file"
          required
          disabled={busy}
          accept={typeof info?.mimeTypeHint === "string" && info.mimeTypeHint ? info.mimeTypeHint : "application/pdf,image/*"}
        />
      </p>

      <p>
        <button id="upload" type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </p>

      {error ? (
        <p id="error" data-status="error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
