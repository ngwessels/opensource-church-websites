"use client";

import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { normalizeDailyReadingsConfig } from "@/lib/readings/schema";
import { cn } from "@/lib/utils";

const COLLAPSED_MAX_HEIGHT = "max-h-[11rem]";

/**
 * @param {string} isoDate
 */
function formatDisplayDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * @param {Object} props
 * @param {{ config?: import('@/lib/readings/schema').DailyReadingsModuleConfig }} props.module
 */
export function DailyReadingsModule({ module }) {
  const config = normalizeDailyReadingsConfig(module?.config);
  const title = config.title || "Daily Readings";

  const [readings, setReadings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch("/api/readings/daily")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error && !data.readings) {
          setError(data.error);
          setReadings(null);
          return;
        }
        setReadings(data.readings);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load readings.");
        setReadings(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[var(--site-primary)]" />
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-2/3 rounded bg-zinc-100" />
          <div className="h-3 w-1/2 rounded bg-zinc-100" />
          <div className="h-16 rounded bg-zinc-100" />
        </div>
      </section>
    );
  }

  if (!readings) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[var(--site-primary)]" />
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        </div>
        <p className="text-sm text-zinc-500">
          {error || "Readings are unavailable right now."}
        </p>
      </section>
    );
  }

  const subtitle = readings.saint || readings.liturgicalTitle;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[var(--site-primary)]" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
            <p className="text-sm text-zinc-500">{formatDisplayDate(readings.date)}</p>
          </div>
        </div>
        {config.showUsccbLink && readings.usccbUrl && (
          <a
            href={readings.usccbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--site-primary)] hover:underline"
          >
            View on USCCB
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {subtitle && (
        <p className="mb-4 text-sm font-medium text-zinc-700">{subtitle}</p>
      )}

      {readings.liturgicalTitle && readings.saint && (
        <p className="mb-4 text-sm text-zinc-500">{readings.liturgicalTitle}</p>
      )}

      <div className="relative">
        <div className={cn("space-y-5", !expanded && `${COLLAPSED_MAX_HEIGHT} overflow-hidden`)}>
          {readings.readings.map((section) => (
            <article key={`${section.title}-${section.citation}`}>
              <h3 className="text-sm font-semibold text-zinc-900">{section.title}</h3>
              {section.citation && (
                <p className="mt-0.5 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  {section.citation}
                </p>
              )}
              <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                {section.text}
              </div>
            </article>
          ))}
        </div>
        {!expanded && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent"
            aria-hidden
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--site-primary)] hover:underline"
      >
        {expanded ? (
          <>
            Show less
            <ChevronUp className="h-4 w-4" />
          </>
        ) : (
          <>
            Show more
            <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {expanded && (
        <p className="mt-4 border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-400">
          Scripture texts from the New American Bible, revised edition. Copyright © Confraternity of
          Christian Doctrine, Washington, D.C.
        </p>
      )}
    </section>
  );
}
