"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z, MODULE_LABELS } from "@/lib/design/admin-tokens";
import {
  facebookEmbedFromPageUrl,
  instagramEmbedFromPostUrl,
} from "@/lib/embed/urls";

const overlayZ = { zIndex: ADMIN_Z.overlay };

const EMBED_TYPES = new Set(["embed", "facebook", "google_maps", "instagram", "rss"]);

/**
 * @param {Object} props
 * @param {{ type: string, config?: Record<string, unknown> }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function EmbedModuleEditor({ module, onSave, onClose }) {
  const type = module.type;
  const initial = module.config || {};

  const [title, setTitle] = useState(String(initial.title || MODULE_LABELS[type] || "Embed"));
  const [embedUrl, setEmbedUrl] = useState(String(initial.embedUrl || ""));
  const [html, setHtml] = useState(String(initial.html || ""));
  const [height, setHeight] = useState(String(initial.height ?? ""));
  const [pageUrl, setPageUrl] = useState(String(initial.pageUrl || ""));
  const [postUrl, setPostUrl] = useState(String(initial.postUrl || ""));
  const [width, setWidth] = useState(String(initial.width ?? ""));
  const [feedUrl, setFeedUrl] = useState(String(initial.feedUrl || ""));
  const [maxItems, setMaxItems] = useState(String(initial.maxItems ?? 10));

  if (!EMBED_TYPES.has(type)) return null;

  const handleSave = () => {
    const base = { title: title.trim() || MODULE_LABELS[type] };

    if (type === "embed") {
      onSave({
        ...base,
        embedUrl: embedUrl.trim(),
        html: html.trim(),
        height: Number(height) || 400,
      });
      return;
    }

    if (type === "facebook") {
      onSave({
        ...base,
        pageUrl: pageUrl.trim(),
        embedUrl: embedUrl.trim(),
        width: Number(width) || 500,
        height: Number(height) || 500,
      });
      return;
    }

    if (type === "google_maps") {
      onSave({
        ...base,
        embedUrl: embedUrl.trim(),
        height: Number(height) || 450,
      });
      return;
    }

    if (type === "instagram") {
      onSave({
        ...base,
        postUrl: postUrl.trim(),
        embedUrl: embedUrl.trim(),
        height: Number(height) || 480,
      });
      return;
    }

    if (type === "rss") {
      onSave({
        ...base,
        feedUrl: feedUrl.trim(),
        maxItems: Math.min(Math.max(Number(maxItems) || 10, 1), 20),
      });
    }
  };

  const suggestFacebookEmbed = () => {
    const suggested = facebookEmbedFromPageUrl(pageUrl);
    if (suggested) setEmbedUrl(suggested);
  };

  const suggestInstagramEmbed = () => {
    const suggested = instagramEmbedFromPostUrl(postUrl);
    if (suggested) setEmbedUrl(suggested);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-card shadow-xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Edit {MODULE_LABELS[type] || type}</h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="embed-title">Title</Label>
            <Input
              id="embed-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Section title (optional)"
            />
          </div>

          {type === "embed" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="embed-url">Embed URL (iframe src)</Label>
                <Input
                  id="embed-url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://example.com/widget"
                />
                <p className="text-xs text-muted-foreground">
                  Use an HTTPS iframe URL, or paste custom HTML below instead.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="embed-html">Custom HTML / scripts</Label>
                <textarea
                  id="embed-html"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={8}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="<script>...</script> or embed code"
                />
                <p className="text-xs text-amber-700">
                  Admin-only: scripts and widgets (e.g. Shalom World TV) run on the public site.
                  HTML takes priority over embed URL when both are set.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="embed-height">Min height (px)</Label>
                <Input
                  id="embed-height"
                  type="number"
                  min={100}
                  max={2000}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="400"
                />
              </div>
            </>
          )}

          {type === "facebook" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fb-page-url">Facebook Page URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="fb-page-url"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    placeholder="https://www.facebook.com/yourpage"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={suggestFacebookEmbed}>
                    Build embed
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-embed-url">Embed URL</Label>
                <Input
                  id="fb-embed-url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://www.facebook.com/plugins/page.php?..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fb-width">Width (px)</Label>
                  <Input
                    id="fb-width"
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fb-height">Height (px)</Label>
                  <Input
                    id="fb-height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {type === "google_maps" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="maps-embed-url">Google Maps embed URL</Label>
                <Input
                  id="maps-embed-url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                />
                <p className="text-xs text-muted-foreground">
                  In Google Maps: Share → Embed a map → copy the iframe src URL.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maps-height">Height (px)</Label>
                <Input
                  id="maps-height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="450"
                />
              </div>
            </>
          )}

          {type === "instagram" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ig-post-url">Instagram post URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="ig-post-url"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={suggestInstagramEmbed}>
                    Build embed
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ig-embed-url">Embed URL</Label>
                <Input
                  id="ig-embed-url"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/.../embed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ig-height">Height (px)</Label>
                <Input
                  id="ig-height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="480"
                />
              </div>
            </>
          )}

          {type === "rss" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="rss-feed-url">Feed URL</Label>
                <Input
                  id="rss-feed-url"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                />
                <p className="text-xs text-muted-foreground">Must be an HTTPS RSS or Atom feed URL.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rss-max">Max items (1–20)</Label>
                <Input
                  id="rss-max"
                  type="number"
                  min={1}
                  max={20}
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
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
