"use client";

import { useCallback, useEffect, useState } from "react";

import { EventsList } from "@/components/calendar/EventsList";
import { filterUpcoming, normalizeCalendarConfig, sortEventsByDate } from "@/lib/calendar/schema";

/**
 * @param {string} calendarId
 * @param {number} max
 * @returns {Promise<import('@/lib/calendar/types').CalendarEvent[]>}
 */
async function fetchGoogleEvents(calendarId, max) {
  const params = new URLSearchParams({
    calendarId,
    max: String(max),
  });

  const res = await fetch(`/api/calendar/google?${params}`);
  const data = await res.json();
  if (data.error && !data.events?.length) {
    throw new Error(data.error);
  }
  return data.events || [];
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.calendarId
 * @param {number} props.maxEvents
 * @param {number} props.previewCount
 * @param {import('@/lib/calendar/types').CalendarEvent[] | undefined} props.prefetchedEvents
 */
function GoogleCalendarEvents({ title, calendarId, maxEvents, previewCount, prefetchedEvents }) {
  const [events, setEvents] = useState(prefetchedEvents ?? []);
  const [loading, setLoading] = useState(
    prefetchedEvents === undefined && !!calendarId,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [fullyLoaded, setFullyLoaded] = useState(
    prefetchedEvents !== undefined || maxEvents <= previewCount,
  );

  useEffect(() => {
    if (prefetchedEvents !== undefined || !calendarId) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    const initialMax = Math.min(previewCount, maxEvents);

    fetchGoogleEvents(calendarId, initialMax)
      .then((fetched) => {
        if (cancelled) return;
        setEvents(filterUpcoming(fetched, initialMax));
        setFullyLoaded(initialMax >= maxEvents);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load events.");
        setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarId, maxEvents, previewCount, prefetchedEvents]);

  const handleLoadMore = useCallback(() => {
    if (fullyLoaded || !calendarId || prefetchedEvents !== undefined) return;

    setLoadingMore(true);
    setError("");

    fetchGoogleEvents(calendarId, maxEvents)
      .then((fetched) => {
        setEvents(filterUpcoming(fetched, maxEvents));
        setFullyLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load events.");
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [calendarId, fullyLoaded, maxEvents, prefetchedEvents]);

  if (!calendarId) {
    return <EventsList title={title} events={[]} previewCount={previewCount} />;
  }

  return (
    <EventsList
      title={title}
      events={events}
      previewCount={previewCount}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      hasMoreToLoad={!fullyLoaded && maxEvents > previewCount}
      onLoadMore={handleLoadMore}
    />
  );
}

/**
 * @param {Object} props
 * @param {{ config?: import('@/lib/calendar/types').CalendarModuleConfig }} props.module
 * @param {import('@/lib/calendar/types').CalendarEvent[] | undefined} [props.prefetchedEvents]
 */
export function CalendarModule({ module, prefetchedEvents }) {
  const config = normalizeCalendarConfig(module?.config);
  const title = config.title || "Upcoming Events";
  const maxEvents = config.maxEvents || 15;
  const previewCount = config.previewCount || 5;

  if (config.source === "google") {
    return (
      <GoogleCalendarEvents
        title={title}
        calendarId={config.googleCalendarId || ""}
        maxEvents={maxEvents}
        previewCount={previewCount}
        prefetchedEvents={prefetchedEvents}
      />
    );
  }

  const manualEvents = filterUpcoming(
    sortEventsByDate(config.events || []).filter((e) => e.title && e.date),
    maxEvents,
  );

  return (
    <EventsList title={title} events={manualEvents} previewCount={previewCount} />
  );
}
