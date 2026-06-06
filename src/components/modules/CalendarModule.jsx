"use client";

import { useEffect, useState } from "react";

import { EventsList } from "@/components/calendar/EventsList";
import { filterUpcoming, normalizeCalendarConfig, sortEventsByDate } from "@/lib/calendar/schema";

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.calendarId
 * @param {number} props.maxEvents
 */
function GoogleCalendarEvents({ title, calendarId, maxEvents }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(!!calendarId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!calendarId) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      calendarId,
      max: String(maxEvents),
    });

    fetch(`/api/calendar/google?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error && !data.events?.length) {
          setError(data.error);
        }
        const fetched = data.events || [];
        setEvents(filterUpcoming(fetched, maxEvents));
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
  }, [calendarId, maxEvents]);

  if (!calendarId) {
    return <EventsList title={title} events={[]} />;
  }

  return <EventsList title={title} events={events} loading={loading} error={error} />;
}

/**
 * @param {Object} props
 * @param {{ config?: import('@/lib/calendar/types').CalendarModuleConfig }} props.module
 */
export function CalendarModule({ module }) {
  const config = normalizeCalendarConfig(module?.config);
  const title = config.title || "Upcoming Events";
  const maxEvents = config.maxEvents || 15;

  if (config.source === "google") {
    return (
      <GoogleCalendarEvents
        title={title}
        calendarId={config.googleCalendarId || ""}
        maxEvents={maxEvents}
      />
    );
  }

  const manualEvents = filterUpcoming(
    sortEventsByDate(config.events || []).filter((e) => e.title && e.date),
    maxEvents,
  );

  return <EventsList title={title} events={manualEvents} />;
}
