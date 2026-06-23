"use client";

import { useState } from "react";

import { ManualEventsForm } from "@/components/calendar/ManualEventsForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizeCalendarConfig } from "@/lib/calendar/schema";

const overlayZ = { zIndex: ADMIN_Z.overlay };

/**
 * @param {Object} props
 * @param {{ config?: import('@/lib/calendar/types').CalendarModuleConfig }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function CalendarModuleEditor({ module, onSave, onClose }) {
  const initial = normalizeCalendarConfig(module?.config);

  const [title, setTitle] = useState(initial.title || "Upcoming Events");
  const [source, setSource] = useState(initial.source || "manual");
  const [events, setEvents] = useState(initial.events || []);
  const [googleCalendarId, setGoogleCalendarId] = useState(initial.googleCalendarId || "");
  const [maxEvents, setMaxEvents] = useState(initial.maxEvents || 15);
  const [previewCount, setPreviewCount] = useState(initial.previewCount || 5);

  const handleSave = () => {
    onSave(
      normalizeCalendarConfig({
        title,
        source,
        events: source === "manual" ? events : undefined,
        googleCalendarId: source === "google" ? googleCalendarId : undefined,
        maxEvents,
        previewCount,
      }),
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section title"
            className="w-full text-lg font-semibold outline-none"
          />
        </div>

        <div className="flex-1 overflow-auto p-4">
          <Tabs
            value={source}
            onValueChange={(value) => setSource(value === "google" ? "google" : "manual")}
          >
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="manual" className="flex-1">
                Manual Events
              </TabsTrigger>
              <TabsTrigger value="google" className="flex-1">
                Google Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
              <p className="mb-4 text-xs text-muted-foreground">
                Add events manually. Only upcoming events are shown on the public site.
              </p>
              <ManualEventsForm events={events} onChange={setEvents} />
            </TabsContent>

            <TabsContent value="google" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Paste your Calendar ID (e.g. <code className="text-xs">name@group.calendar.google.com</code>)
                or the full public iCal URL from Google Calendar settings. The calendar must be{" "}
                <strong>public</strong> (Settings → Integrate calendar). Use a dedicated parish calendar
                (not a personal inbox calendar) when possible.
              </p>
              <p className="text-xs text-muted-foreground">
                If spam invitations appear in Google Calendar, open each event → Report as spam (do not
                click Decline). In Google Calendar settings, set{" "}
                <strong>Add invitations to my calendar</strong> to{" "}
                <strong>Only if the sender is known</strong>.
              </p>

              <div className="space-y-2">
                <Label htmlFor="google-calendar-id">Calendar ID or iCal URL</Label>
                <Input
                  id="google-calendar-id"
                  value={googleCalendarId}
                  onChange={(e) => setGoogleCalendarId(e.target.value)}
                  placeholder="e.g. parish@group.calendar.google.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-events">Max upcoming events</Label>
                <Input
                  id="max-events"
                  type="number"
                  min={1}
                  max={50}
                  value={maxEvents}
                  onChange={(e) => {
                    const next = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 15));
                    setMaxEvents(next);
                    if (previewCount > next) setPreviewCount(next);
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 space-y-2 border-t pt-4">
            <Label htmlFor="preview-count">Events shown before &quot;Show more&quot;</Label>
            <Input
              id="preview-count"
              type="number"
              min={1}
              max={50}
              value={previewCount}
              onChange={(e) =>
                setPreviewCount(
                  Math.min(maxEvents, Math.max(1, parseInt(e.target.value, 10) || 5)),
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Visitors can expand the list to see up to {maxEvents} upcoming events.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
