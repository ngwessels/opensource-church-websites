"use client";

import { Download } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import {
  findBulletinByDate,
  formatBulletinDate,
  formatBulletinMonthLabel,
  getBulletinLabel,
  getBulletinMonthKey,
  groupBulletinsByYearMonth,
  sortBulletinsDesc,
} from "@/lib/bulletins/schema";

const BulletinPdfViewer = dynamic(
  () => import("./BulletinPdfViewer").then((m) => m.BulletinPdfViewer),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-sm text-zinc-500">Loading bulletin…</p>
    ),
  },
);

function BulletinArchive({
  bulletins,
  selectedDate,
  latestDate,
  onSelect,
  pageSlug,
}) {
  const groups = groupBulletinsByYearMonth(bulletins);
  const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a));
  const latestMonthKey = getBulletinMonthKey(latestDate);
  const selectedMonthKey = getBulletinMonthKey(selectedDate);

  return (
    <aside className="w-full lg:w-1/3">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        {years.map((year) => (
          <div key={year} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">Archive {year}</h3>
            <div className="space-y-1">
              {Object.keys(groups[year])
                .sort((a, b) => Number(b) - Number(a))
                .map((month) => {
                  const monthKey = `${year}-${month}`;
                  const isOpen =
                    monthKey === latestMonthKey || monthKey === selectedMonthKey;

                  return (
                    <details
                      key={monthKey}
                      open={isOpen}
                      className="group rounded border border-zinc-100"
                    >
                      <summary className="cursor-pointer list-none px-2 py-2 text-sm font-medium text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          {formatBulletinMonthLabel(year, month)}
                          <span
                            aria-hidden
                            className="text-xs text-zinc-400 transition-transform group-open:rotate-180"
                          >
                            ▼
                          </span>
                        </span>
                      </summary>
                      <ul className="space-y-1 border-t border-zinc-100 px-2 py-2">
                        {groups[year][month].map((bulletin) => {
                          const isSelected = bulletin.date === selectedDate;
                          const href = pageSlug
                            ? `${pageSlug}?date=${bulletin.date}`
                            : `?date=${bulletin.date}`;

                          return (
                            <li key={bulletin.id}>
                              <Link
                                href={href}
                                onClick={(e) => {
                                  e.preventDefault();
                                  onSelect(bulletin.date);
                                }}
                                className={`block rounded px-2 py-1 text-sm transition-colors ${
                                  isSelected
                                    ? "bg-[var(--site-primary)]/10 font-medium text-[var(--site-primary)]"
                                    : "text-zinc-700 hover:bg-zinc-50 hover:text-[var(--site-primary)]"
                                }`}
                              >
                                {formatBulletinDate(bulletin)}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function BulletinsPageView({
  page,
  bulletins = [],
  editing = false,
  pageSlug,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const sorted = useMemo(() => sortBulletinsDesc(bulletins), [bulletins]);
  const selected =
    findBulletinByDate(sorted, dateParam) || sorted[0] || null;
  const selectedDate = selected?.date;

  const slugPath = pageSlug ?? (page?.slug ? `/${page.slug}` : "");

  const handleSelect = (date) => {
    const base = slugPath || window.location.pathname;
    router.push(`${base}?date=${date}`, { scroll: false });
  };

  if (sorted.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {page?.title || "Bulletins"}
        </h1>
        <p className="mt-4 text-sm text-zinc-600">
          No bulletins have been published yet.
        </p>
        {editing && (
          <p className="mt-2 text-sm">
            <Link href="/builder/bulletins" className="text-[var(--site-primary)] underline">
              Add bulletins in the Bulletins tab
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <BulletinArchive
          bulletins={sorted}
          selectedDate={selectedDate}
          latestDate={sorted[0]?.date}
          onSelect={handleSelect}
          pageSlug={slugPath}
        />

        <div className="min-w-0 flex-1">
          <h1 className="mb-4 text-2xl font-semibold uppercase tracking-wide text-zinc-900">
            Bulletin
          </h1>
          {selected && (
            <>
              <p className="mb-4 text-sm text-zinc-600">{getBulletinLabel(selected)}</p>
              <div className="overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
                <BulletinPdfViewer
                  date={selected.date}
                  title={getBulletinLabel(selected)}
                />
              </div>
              <a
                href={selected.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--site-primary)] hover:underline"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
