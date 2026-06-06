"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateScheduleId,
  normalizeScheduleEntry,
  ZOOM_DAY_OPTIONS,
} from "@/lib/zoom/parse";

/**
 * @param {Object} props
 * @param {import('@/lib/zoom/parse').ZoomScheduleEntry[]} props.schedule
 * @param {(schedule: import('@/lib/zoom/parse').ZoomScheduleEntry[]) => void} props.onChange
 */
export function ZoomScheduleForm({ schedule, onChange }) {
  const entries = schedule.map(normalizeScheduleEntry);

  const updateEntry = (index, field, value) => {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  };

  const addEntry = () => {
    onChange([...entries, { id: generateScheduleId(), day: "sunday", time: "10:00" }]);
  };

  const removeEntry = (index) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Recurring schedule</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          When does this live stream happen each week?
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No schedule set. Add a day and time below.</p>
      )}

      {entries.map((entry, i) => (
        <div key={entry.id} className="flex items-end gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`zoom-day-${entry.id}`} className="sr-only">
              Day
            </Label>
            <select
              id={`zoom-day-${entry.id}`}
              value={entry.day}
              onChange={(e) => updateEntry(i, "day", e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ZOOM_DAY_OPTIONS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`zoom-time-${entry.id}`}>Time</Label>
            <Input
              id={`zoom-time-${entry.id}`}
              type="time"
              value={entry.time}
              onChange={(e) => updateEntry(i, "time", e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeEntry(i)}
            className="mb-0.5 h-9 shrink-0 text-destructive hover:text-destructive"
            aria-label="Remove schedule entry"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add day & time
      </Button>
    </div>
  );
}
