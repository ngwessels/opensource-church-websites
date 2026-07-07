"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePages } from "@/hooks/usePages";

const PRESETS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
];

/**
 * @param {number} days
 */
function formatDateInput(days) {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {number} ms
 */
function formatEngagement(ms) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

/**
 * @param {number} rate
 */
function formatPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DataTable({ title, rows, columns }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-muted-foreground">
                  No data for this range.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id || index} className="border-b border-border/60 last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-2">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SiteAnalyticsPanel() {
  const { user } = useAuth();
  const { pages } = usePages();
  const [preset, setPreset] = useState("30d");
  const [dateFrom, setDateFrom] = useState(formatDateInput(30));
  const [dateTo, setDateTo] = useState(todayInput());
  const [pageFilter, setPageFilter] = useState("all");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageOptions = useMemo(() => {
    return pages
      .filter((page) => page.slug !== undefined)
      .map((page) => {
        const path = page.slug ? `/${String(page.slug).replace(/^\/+/, "")}` : "/";
        return { id: page.id, path, title: page.title || path };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [pages]);

  const loadReport = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const selected = pageOptions.find((page) => page.id === pageFilter);
      if (selected && pageFilter !== "all") {
        params.set("pagePath", selected.path);
      }

      const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load analytics");
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [user, dateFrom, dateTo, pageFilter, pageOptions]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function applyPreset(nextPreset) {
    const match = PRESETS.find((item) => item.id === nextPreset);
    if (!match) return;
    setPreset(nextPreset);
    setDateFrom(formatDateInput(match.days));
    setDateTo(todayInput());
  }

  const summary = report?.summary;

  return (
    <Card className="mx-auto max-w-7xl">
      <CardHeader>
        <CardTitle>Site Analytics</CardTitle>
        <CardDescription>
          First-party traffic for public parish pages. Runs alongside Firebase Analytics and does
          not replace it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="analytics-preset">Range</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger id="analytics-preset" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analytics-from">From</Label>
            <Input
              id="analytics-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPreset("custom");
                setDateFrom(event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="analytics-to">To</Label>
            <Input
              id="analytics-to"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPreset("custom");
                setDateTo(event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="analytics-page">Page</Label>
            <Select value={pageFilter} onValueChange={setPageFilter}>
              <SelectTrigger id="analytics-page" className="w-[240px]">
                <SelectValue placeholder="All pages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pages</SelectItem>
                {pageOptions.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.title} ({page.path})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={loadReport} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {summary && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Page views" value={summary.pageViews} />
            <StatCard label="Visitors" value={summary.visitors} />
            <StatCard label="Sessions" value={summary.sessions} />
            <StatCard label="Bounce rate" value={formatPercent(summary.bounceRate)} />
            <StatCard label="Avg engagement" value={formatEngagement(summary.avgEngagementMs)} />
          </div>
        )}

        {report && (
          <div className="grid gap-6 xl:grid-cols-2">
            <DataTable
              title="Daily trend"
              rows={report.dailyTrend}
              columns={[
                { key: "date", label: "Date", render: (row) => row.date },
                { key: "views", label: "Views", render: (row) => row.pageViews },
                { key: "visitors", label: "Visitors", render: (row) => row.visitors },
                { key: "sessions", label: "Sessions", render: (row) => row.sessions },
              ]}
            />

            <DataTable
              title="Top pages"
              rows={report.topPages}
              columns={[
                { key: "path", label: "Path", render: (row) => row.pagePath },
                { key: "title", label: "Title", render: (row) => row.pageTitle },
                { key: "views", label: "Views", render: (row) => row.pageViews },
                { key: "visitors", label: "Visitors", render: (row) => row.visitors },
              ]}
            />

            <DataTable
              title="Referrers"
              rows={report.referrers}
              columns={[
                { key: "label", label: "Source", render: (row) => row.label },
                { key: "count", label: "Views", render: (row) => row.count },
              ]}
            />

            <DataTable
              title="Devices"
              rows={report.devices}
              columns={[
                { key: "label", label: "Device", render: (row) => row.label },
                { key: "count", label: "Views", render: (row) => row.count },
              ]}
            />

            <DataTable
              title="Browsers"
              rows={report.browsers}
              columns={[
                { key: "label", label: "Browser", render: (row) => row.label },
                { key: "count", label: "Views", render: (row) => row.count },
              ]}
            />

            <DataTable
              title="Countries"
              rows={report.countries}
              columns={[
                { key: "label", label: "Country", render: (row) => row.label },
                { key: "count", label: "Views", render: (row) => row.count },
              ]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
