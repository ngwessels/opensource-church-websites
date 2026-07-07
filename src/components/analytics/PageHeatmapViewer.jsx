"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * @param {number} count
 * @param {number} max
 */
function heatColor(count, max) {
  if (!max || count <= 0) return "rgba(0,0,0,0)";
  const intensity = Math.min(1, count / max);
  const alpha = 0.15 + intensity * 0.55;
  return `rgba(220, 38, 38, ${alpha})`;
}

/**
 * @param {object} props
 * @param {string} props.pagePath
 * @param {string} props.dateFrom
 * @param {string} props.dateTo
 * @param {'mobile' | 'tablet' | 'desktop' | 'all'} props.deviceType
 * @param {() => Promise<string>} props.getIdToken
 */
export function PageHeatmapViewer({ pagePath, dateFrom, dateTo, deviceType, getIdToken }) {
  const iframeRef = useRef(/** @type {HTMLIFrameElement | null} */ (null));
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [iframeReady, setIframeReady] = useState(false);

  const loadHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const params = new URLSearchParams({ from: dateFrom, to: dateTo, pagePath });
      if (deviceType !== "all") params.set("deviceType", deviceType);

      let res = await fetch(`/api/admin/analytics/heatmap?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        res = await fetch(`/api/admin/analytics/heatmap?${params.toString()}`, {
          headers: { Authorization: `Bearer ${await getIdToken(true)}` },
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load heatmap");
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, deviceType, getIdToken, pagePath]);

  useEffect(() => {
    loadHeatmap();
  }, [loadHeatmap]);

  const drawOverlay = useCallback(() => {
    const iframe = iframeRef.current;
    const canvas = canvasRef.current;
    if (!iframe || !canvas || !report?.clicks?.length) return;

    let doc;
    try {
      doc = iframe.contentDocument;
    } catch {
      return;
    }
    if (!doc) return;

    const width = Math.max(doc.documentElement.scrollWidth, doc.documentElement.clientWidth);
    const height = Math.max(doc.documentElement.scrollHeight, doc.documentElement.clientHeight);
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const maxCount = Math.max(...report.clicks.map((cell) => cell.count), 1);
    const gridSize = report.gridSize || 40;

    for (const cell of report.clicks) {
      const cellWidth = width / gridSize;
      const cellHeight = height / gridSize;
      const x = cell.col * cellWidth;
      const y = cell.row * cellHeight;
      ctx.fillStyle = heatColor(cell.count, maxCount);
      const radius = Math.max(cellWidth, cellHeight) * 0.9;
      ctx.beginPath();
      ctx.arc(x + cellWidth / 2, y + cellHeight / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [report]);

  useEffect(() => {
    if (!iframeReady || !report) return;
    drawOverlay();
  }, [iframeReady, report, drawOverlay]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function syncScroll() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.style.transform = `translateY(-${iframe.contentWindow?.scrollY || 0}px)`;
    }

    function onLoad() {
      setIframeReady(true);
      try {
        const doc = iframe.contentDocument;
        doc?.addEventListener("scroll", syncScroll, { passive: true });
      } catch {
        // ignore
      }
    }

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [pagePath]);

  const maxScrollSessions = Math.max(
    ...(report?.scrollBuckets || []).map((bucket) => bucket.sessions),
    1,
  );

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Page heatmap</h3>
          <p className="text-xs text-muted-foreground">
            Overlay uses the current published page layout. Historical clicks may not align if the
            page design changed.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={loadHeatmap} disabled={loading}>
          {loading ? "Loading…" : "Refresh heatmap"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && report && report.totalClicks === 0 && (
        <p className="text-sm text-muted-foreground">No click data for this page and date range.</p>
      )}

      <div className="flex gap-4">
        <div className="relative min-h-[480px] flex-1 overflow-auto rounded-md border border-border bg-muted/20">
          <iframe
            ref={iframeRef}
            title={`Heatmap preview ${pagePath}`}
            src={pagePath}
            className="block w-full min-h-[480px] border-0 bg-white"
          />
          <canvas
            ref={canvasRef}
            className={cn(
              "pointer-events-none absolute left-0 top-0",
              report?.totalClicks ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        <div className="w-40 shrink-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Scroll depth</p>
          {(report?.scrollBuckets || []).map((bucket) => (
            <div key={bucket.depthPercent} className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{bucket.depthPercent}%</span>
                <span>{bucket.sessions}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary/70"
                  style={{ width: `${(bucket.sessions / maxScrollSessions) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {!report?.scrollBuckets?.length && !loading && (
            <p className="text-xs text-muted-foreground">No scroll data yet.</p>
          )}
        </div>
      </div>

      {report?.hotspots?.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Top areas:{" "}
          {report.hotspots
            .slice(0, 5)
            .map((spot) => `${spot.label} (${spot.count})`)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
