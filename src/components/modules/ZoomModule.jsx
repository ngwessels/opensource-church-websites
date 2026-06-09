"use client";

import { Copy, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  formatMeetingId,
  formatScheduleDay,
  formatScheduleTime,
  isZoomJoinVisible,
  sortZoomSchedule,
} from "@/lib/zoom/parse";

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      aria-label={`Copy ${label}`}
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ZoomModule({ module }) {
  const config = module?.config || {};
  const title = config.title || "Live Streaming";
  const meetingId = config.meetingId;
  const password = config.password;
  const joinUrl = config.joinUrl;
  const instructions = config.instructions;
  const schedule = useMemo(
    () => sortZoomSchedule(config.schedule || []),
    [JSON.stringify(config.schedule)],
  );
  const [joinVisible, setJoinVisible] = useState(() => isZoomJoinVisible(schedule));

  useEffect(() => {
    const update = () => setJoinVisible(isZoomJoinVisible(schedule));
    update();
    const intervalId = setInterval(update, 30_000);
    return () => clearInterval(intervalId);
  }, [schedule]);

  if (!meetingId && !joinUrl) return null;

  const displayMeetingId = meetingId ? formatMeetingId(meetingId) : "";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Radio className="h-5 w-5 text-[var(--site-primary)]" />
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      </div>

      {instructions && (
        <p className="mb-4 text-sm leading-relaxed text-zinc-600">{instructions}</p>
      )}

      {schedule.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Schedule
          </h3>
          <ul className="space-y-1 text-sm text-zinc-700">
            {schedule.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="min-w-[5.5rem] font-medium text-zinc-900">
                  {formatScheduleDay(entry.day)}
                </span>
                <span>{formatScheduleTime(entry.time)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="space-y-3 text-sm">
        {displayMeetingId && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <dt className="min-w-[6rem] font-medium text-zinc-500">Meeting ID</dt>
            <dd className="font-mono text-zinc-900">
              {displayMeetingId}
              <CopyButton value={meetingId.replace(/\D/g, "") || meetingId} label="meeting ID" />
            </dd>
          </div>
        )}
        {password && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <dt className="min-w-[6rem] font-medium text-zinc-500">Password</dt>
            <dd className="font-mono text-zinc-900">
              {password}
              <CopyButton value={password} label="password" />
            </dd>
          </div>
        )}
      </dl>

      {joinUrl && joinVisible && (
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-[var(--site-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          Join Live Stream
        </a>
      )}

      {joinUrl && !joinVisible && schedule.length > 0 && (
        <p className="mt-5 text-sm text-zinc-500">
          Join opens 15 minutes before each scheduled stream and stays available for 1 hour
          after.
        </p>
      )}
    </section>
  );
}
