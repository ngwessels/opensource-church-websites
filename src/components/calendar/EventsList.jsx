import { Calendar, ExternalLink, MapPin } from "lucide-react";

import {
  formatEventBadgeTime,
  formatEventDateBadge,
  formatEventTime,
} from "@/lib/calendar/schema";

/**
 * @param {string} [text]
 * @returns {string}
 */
function plainText(text = "") {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * @param {Object} props
 * @param {string} [props.title]
 * @param {import('@/lib/calendar/types').CalendarEvent[]} props.events
 * @param {boolean} [props.loading]
 * @param {string} [props.error]
 */
export function EventsList({ title = "Upcoming Events", events = [], loading = false, error = "" }) {
  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--site-primary)]" />
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse py-1">
              <div className="h-11 w-11 shrink-0 rounded-md bg-zinc-100" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <div className="h-3.5 w-2/3 rounded bg-zinc-100" />
                <div className="h-3 w-1/4 rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!events.length && !error) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--site-primary)]" />
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        </div>
        <p className="text-sm text-zinc-500">No upcoming events.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-[var(--site-primary)]" />
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      </div>

      {error && (
        <p className="mb-2 text-sm text-amber-700">
          Could not load calendar events. {error}
        </p>
      )}

      <ul className="divide-y divide-zinc-100">
        {events.map((event) => {
          const badge = formatEventDateBadge(event.date);
          const badgeTime = formatEventBadgeTime(event);
          const timeLabel = formatEventTime(event);
          const description = plainText(event.description);
          const hasMeta = Boolean(event.location || description);

          return (
            <li key={event.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-center leading-none">
                <span className="text-[8px] font-semibold tracking-wide text-[var(--site-primary)]">
                  {badge.month}
                </span>
                <span className="text-sm font-bold text-zinc-900">{badge.day}</span>
                <span className="text-[8px] text-zinc-500">
                  {badgeTime || badge.weekday}
                </span>
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug text-zinc-900">{event.title}</h3>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap text-xs font-medium text-zinc-600">
                      {timeLabel}
                    </span>
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--site-primary)] hover:text-[var(--site-primary)]/80"
                        aria-label="Event details"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {hasMeta && (
                  <div className="mt-0.5 space-y-0.5">
                    {event.location && (
                      <p className="flex items-center gap-1 text-xs text-zinc-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    )}
                    {description && (
                      <p className="line-clamp-1 text-xs text-zinc-400">{description}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
