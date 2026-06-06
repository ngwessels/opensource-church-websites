"use client";

import { useMemo, useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizeVideoConfig, parseVideoUrl } from "@/lib/media/video-url";

const overlayZ = { zIndex: ADMIN_Z.overlay };

/**
 * @param {Object} props
 * @param {{ config?: Record<string, unknown> }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function VideoModuleEditor({ module, onSave, onClose }) {
  const initial = normalizeVideoConfig(module?.config);

  const [title, setTitle] = useState(initial.title || "Video");
  const [source, setSource] = useState(
    initial.source === "upload" || initial.source === "url" ? initial.source : "embed",
  );
  const [embedUrl, setEmbedUrl] = useState(
    initial.source === "youtube" || initial.source === "vimeo" ? initial.url : "",
  );
  const [directUrl, setDirectUrl] = useState(initial.source === "url" ? initial.url : "");
  const [uploadSrc, setUploadSrc] = useState(initial.source === "upload" ? initial.src : "");
  const [mediaId, setMediaId] = useState(initial.source === "upload" ? initial.mediaId : "");
  const [showPicker, setShowPicker] = useState(false);

  const parsedEmbed = useMemo(() => parseVideoUrl(embedUrl), [embedUrl]);

  const handleSave = () => {
    if (source === "upload") {
      onSave(
        normalizeVideoConfig({
          title,
          source: "upload",
          src: uploadSrc,
          mediaId,
        }),
      );
      return;
    }

    if (source === "url") {
      onSave(
        normalizeVideoConfig({
          title,
          source: "url",
          url: directUrl,
        }),
      );
      return;
    }

    onSave(
      normalizeVideoConfig({
        title,
        source: parsedEmbed.provider === "vimeo" ? "vimeo" : "youtube",
        url: embedUrl,
      }),
    );
  };

  const applyMediaFile = (file) => {
    if (file.downloadUrl) setUploadSrc(file.downloadUrl);
    if (file.id) setMediaId(file.id);
    setShowPicker(false);
  };

  if (showPicker) {
    return (
      <div className="fixed inset-0 flex flex-col bg-card" style={overlayZ}>
        <MediaPicker
          fullscreen
          title="Choose video"
          mediaFilter="videos"
          onSelect={applyMediaFile}
          onCancel={() => setShowPicker(false)}
        />
      </div>
    );
  }

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
          <Tabs value={source} onValueChange={setSource}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="embed" className="flex-1">
                YouTube / Vimeo
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1">
                Media library
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1">
                Direct URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="embed" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Paste a YouTube or Vimeo link. Short links and embed URLs are supported.
              </p>
              <div className="space-y-2">
                <Label htmlFor="embed-url">Video URL</Label>
                <Input
                  id="embed-url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              {parsedEmbed.provider && (
                <div className="rounded border border-border bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium capitalize">{parsedEmbed.provider}</span>
                  {parsedEmbed.videoId && (
                    <span className="ml-2 text-muted-foreground">ID: {parsedEmbed.videoId}</span>
                  )}
                </div>
              )}
              {embedUrl && !parsedEmbed.provider && (
                <p className="text-xs text-red-600">Could not parse video URL. Check the link format.</p>
              )}
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Select an uploaded video from your media library or upload a new one.
              </p>
              {uploadSrc && (
                <video src={uploadSrc} controls className="max-h-40 w-full rounded border" />
              )}
              <Button type="button" variant="outline" onClick={() => setShowPicker(true)}>
                Browse media
              </Button>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Paste a direct link to an .mp4, .webm, or other hosted video file.
              </p>
              <div className="space-y-2">
                <Label htmlFor="direct-url">Video file URL</Label>
                <Input
                  id="direct-url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                />
              </div>
            </TabsContent>
          </Tabs>
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
