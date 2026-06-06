"use client";

import { ExternalLink, Rss } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * @param {Object} props
 * @param {{ config?: { title?: string, feedUrl?: string, maxItems?: number } }} props.module
 */
export function RssModule({ module }) {
  const { title, feedUrl, maxItems = 10 } = module.config || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!feedUrl?.trim()) {
      setLoading(false);
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      url: feedUrl.trim(),
      limit: String(Math.min(Math.max(maxItems, 1), 20)),
    });

    fetch(`/api/rss?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load feed");
        return data;
      })
      .then((data) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load feed");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feedUrl, maxItems]);

  if (!feedUrl?.trim()) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-900">
        <Rss className="h-5 w-5 text-orange-600" aria-hidden />
        {title || "RSS Feed"}
      </h2>

      {loading && <p className="text-sm text-zinc-500">Loading feed…</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-zinc-500">No items in this feed.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={item.link || i}>
              <a
                href={item.link}
                className="flex items-start gap-2 text-sm text-zinc-700 hover:text-[var(--site-primary)]"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span>
                  <span className="font-medium">{item.title}</span>
                  {item.pubDate && (
                    <span className="mt-0.5 block text-xs text-zinc-500">{item.pubDate}</span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
