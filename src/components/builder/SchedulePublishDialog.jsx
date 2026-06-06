"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultScheduleDatetimeLocal,
  formatScheduledPublishAt,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/pages/scheduled-publish";

export function SchedulePublishDialog({
  open,
  onOpenChange,
  scheduledPublishAt,
  onSchedule,
  onCancelSchedule,
}) {
  const [datetimeLocal, setDatetimeLocal] = useState(defaultScheduleDatetimeLocal);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDatetimeLocal(
      scheduledPublishAt ? toDatetimeLocalValue(scheduledPublishAt) : defaultScheduleDatetimeLocal(),
    );
  }, [open, scheduledPublishAt]);

  const handleSchedule = async () => {
    setError(null);
    setSaving(true);
    try {
      const publishAt = fromDatetimeLocalValue(datetimeLocal);
      await onSchedule(publishAt);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule publish.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSchedule = async () => {
    setError(null);
    setSaving(true);
    try {
      await onCancelSchedule();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Schedule publish</DialogTitle>
          <DialogDescription>
            {scheduledPublishAt
              ? `Currently scheduled for ${formatScheduledPublishAt(scheduledPublishAt)}. Pick a new time or cancel the schedule.`
              : "Choose when this page draft should go live. Visitors will see the last published version until then."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="schedule-publish-at">Publish date & time</Label>
          <Input
            id="schedule-publish-at"
            type="datetime-local"
            value={datetimeLocal}
            min={toDatetimeLocalValue(new Date().toISOString())}
            onChange={(e) => setDatetimeLocal(e.target.value)}
            disabled={saving}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t-0 pt-0 sm:justify-between">
          {scheduledPublishAt ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleCancelSchedule}
              disabled={saving}
            >
              Cancel schedule
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Close
            </Button>
            <Button type="button" onClick={handleSchedule} disabled={saving}>
              {saving ? "Saving…" : scheduledPublishAt ? "Update schedule" : "Schedule publish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
