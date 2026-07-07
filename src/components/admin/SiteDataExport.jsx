"use client";

import { Download, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { downloadBlob } from "@/lib/donations/export";
import { formatBytes } from "@/lib/media/upload";

/**
 * @typedef {object} ExportPreview
 * @property {string} siteName
 * @property {Record<string, number>} collections
 * @property {{ fileCount: number, totalBytes: number }} storage
 * @property {number} firestoreBytes
 * @property {number} estimatedBytes
 * @property {Array<{ id: string, label: string, count: number }>} includedCollections
 * @property {Array<{ collection: string, reason: string }>} excludedCollections
 * @property {string[]} storagePrefixes
 */

/**
 * @param {object} [props]
 * @param {string} [props.siteName]
 */
export function SiteDataExport({ siteName = "" }) {
  const { user } = useAuth();
  const [preview, setPreview] = useState(/** @type {ExportPreview | null} */ (null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [exporting, setExporting] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/admin/export", { headers });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load export preview.");
        }
        if (!cancelled) {
          setPreview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load export preview.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [user, getAuthHeaders]);

  async function handleDownload() {
    setExporting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/export?download=1", { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed.");
      }

      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`site-export-${stamp}.zip`, blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const displayName = preview?.siteName || siteName || "Your site";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Download site data</CardTitle>
          <CardDescription>
            Export all Firestore documents and Firebase Storage files for {displayName} as a single ZIP
            archive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-foreground">Included in export</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Firestore: site configuration, pages, navigation, media metadata, bulletins, donations, form submissions, and admin user profiles</li>
              <li>Storage: all files under <code className="text-xs">media/</code> and <code className="text-xs">form-uploads/</code></li>
              <li>A <code className="text-xs">manifest.json</code> describing what was exported</li>
            </ul>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading export preview…</p>
          ) : preview ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">Preview</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {preview.includedCollections.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="font-medium text-foreground">{item.count}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-muted-foreground">Storage files</dt>
                  <dd className="font-medium text-foreground">{preview.storage.fileCount}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-muted-foreground">Estimated size</dt>
                  <dd className="font-medium text-foreground">{formatBytes(preview.estimatedBytes)}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Sensitive data</p>
              <p className="mt-1">
                This export includes donor information, form submissions, and admin email addresses. Store
                the ZIP securely and delete it when no longer needed.
              </p>
              <p className="mt-2 text-xs">
                Very large sites may take several minutes to download. Restore/import is not supported yet.
              </p>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="button" onClick={handleDownload} disabled={loading || exporting || !user}>
            <Download className="size-4" aria-hidden />
            {exporting ? "Preparing download…" : "Download ZIP"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
