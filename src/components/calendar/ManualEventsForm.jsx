"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateEventId, normalizeEvent } from "@/lib/calendar/schema";

/**
 * @param {Object} props
 * @param {import('@/lib/calendar/types').CalendarEvent[]} props.events
 * @param {(events: import('@/lib/calendar/types').CalendarEvent[]) => void} props.onChange
 */
export function ManualEventsForm({ events, onChange }) {
  const normalized = events.map(normalizeEvent);

  const updateEvent = (index, field, value) => {
    onChange(
      normalized.map((event, i) => (i === index ? { ...event, [field]: value } : event)),
    );
  };

  const addEvent = () => {
    onChange([
      ...normalized,
      { id: generateEventId(), title: "", date: "", startTime: "", endTime: "", location: "", description: "", url: "" },
    ]);
  };

  const removeEvent = (index) => {
    onChange(normalized.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {normalized.length === 0 && (
        <p className="text-sm text-muted-foreground">No events yet. Add one below.</p>
      )}

      {normalized.map((event, i) => (
        <div key={event.id} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Event {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeEvent(i)}
              className="h-7 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`event-title-${event.id}`}>Title</Label>
            <Input
              id={`event-title-${event.id}`}
              value={event.title}
              onChange={(e) => updateEvent(i, "title", e.target.value)}
              placeholder="Event name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`event-date-${event.id}`}>Date</Label>
              <Input
                id={`event-date-${event.id}`}
                type="date"
                value={event.date}
                onChange={(e) => updateEvent(i, "date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`event-end-date-${event.id}`}>End date (optional)</Label>
              <Input
                id={`event-end-date-${event.id}`}
                type="date"
                value={event.endDate || ""}
                onChange={(e) => updateEvent(i, "endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`event-start-${event.id}`}>Start time</Label>
              <Input
                id={`event-start-${event.id}`}
                type="time"
                value={event.startTime || ""}
                onChange={(e) => updateEvent(i, "startTime", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`event-end-${event.id}`}>End time</Label>
              <Input
                id={`event-end-${event.id}`}
                type="time"
                value={event.endTime || ""}
                onChange={(e) => updateEvent(i, "endTime", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`event-location-${event.id}`}>Location</Label>
            <Input
              id={`event-location-${event.id}`}
              value={event.location || ""}
              onChange={(e) => updateEvent(i, "location", e.target.value)}
              placeholder="Parish hall, online, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`event-desc-${event.id}`}>Description</Label>
            <textarea
              id={`event-desc-${event.id}`}
              value={event.description || ""}
              onChange={(e) => updateEvent(i, "description", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Optional details"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`event-url-${event.id}`}>Link URL</Label>
            <Input
              id={`event-url-${event.id}`}
              type="url"
              value={event.url || ""}
              onChange={(e) => updateEvent(i, "url", e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addEvent} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add event
      </Button>
    </div>
  );
}
