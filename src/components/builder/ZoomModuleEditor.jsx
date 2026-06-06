"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizeZoomConfig, parseZoomMeetingId } from "@/lib/zoom/parse";

import { ZoomScheduleForm } from "./ZoomScheduleForm";

const overlayZ = { zIndex: ADMIN_Z.overlay };

/**
 * @param {Object} props
 * @param {{ config?: Record<string, unknown> }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function ZoomModuleEditor({ module, onSave, onClose }) {
  const initial = normalizeZoomConfig(module?.config);

  const [title, setTitle] = useState(initial.title || "Live Streaming");
  const [instructions, setInstructions] = useState(initial.instructions || "");
  const [joinUrl, setJoinUrl] = useState(initial.joinUrl || "");
  const [meetingId, setMeetingId] = useState(initial.meetingId || "");
  const [password, setPassword] = useState(initial.password || "");
  const [schedule, setSchedule] = useState(initial.schedule || []);

  const handleJoinUrlChange = (value) => {
    setJoinUrl(value);
    if (!meetingId.trim()) {
      const parsed = parseZoomMeetingId(value);
      if (parsed) setMeetingId(parsed);
    }
  };

  const handleSave = () => {
    onSave(
      normalizeZoomConfig({
        title,
        instructions,
        joinUrl,
        meetingId,
        password,
        schedule,
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

        <div className="flex-1 space-y-4 overflow-auto p-4">
          <div className="space-y-2">
            <Label htmlFor="zoom-instructions">Instructions (optional)</Label>
            <textarea
              id="zoom-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Masses are live-streamed on Zoom. Join using the details below."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoom-join-url">Join URL</Label>
            <Input
              id="zoom-join-url"
              value={joinUrl}
              onChange={(e) => handleJoinUrlChange(e.target.value)}
              placeholder="https://zoom.us/j/1234567890?pwd=..."
            />
            <p className="text-xs text-muted-foreground">
              Paste the full Zoom link. Meeting ID is auto-filled when possible.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoom-meeting-id">Meeting ID</Label>
            <Input
              id="zoom-meeting-id"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="993 4497 4745"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoom-password">Password (optional)</Label>
            <Input
              id="zoom-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="HolyMass"
            />
          </div>

          <ZoomScheduleForm schedule={schedule} onChange={setSchedule} />
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
