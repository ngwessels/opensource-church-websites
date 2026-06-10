"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SOCIAL_MEDIA,
  SOCIAL_PLATFORM_META,
  SOCIAL_PLATFORMS,
} from "@/lib/site/social-media";

export function SocialMediaEditor({ value, onChange }) {
  const config = { ...DEFAULT_SOCIAL_MEDIA, ...value };
  const urls = Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => [
      platform,
      config.items?.find((item) => item.platform === platform)?.url || "",
    ]),
  );

  const updateUrl = (platform, url) => {
    const nextItems = SOCIAL_PLATFORMS.map((p) => ({
      platform: p,
      url: p === platform ? url : urls[p] || "",
    }));
    onChange({ ...config, items: nextItems });
  };

  const updateToggle = (key, checked) => {
    onChange({ ...config, [key]: checked });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h4 className="mb-1 text-sm font-semibold">Social media</h4>
        <p className="text-xs text-muted-foreground">
          Add profile URLs to show icon links in the site header and footer.
        </p>
      </div>

      <div className="space-y-3">
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform} className="space-y-1">
            <Label htmlFor={`social-${platform}`}>{SOCIAL_PLATFORM_META[platform].label}</Label>
            <Input
              id={`social-${platform}`}
              type="url"
              value={urls[platform]}
              onChange={(e) => updateUrl(platform, e.target.value)}
              placeholder={`https://${platform === "x" ? "x.com" : platform === "youtube" ? "youtube.com" : `${platform}.com`}/yourpage`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="showSocialInHeader"
            type="checkbox"
            checked={config.showInHeader !== false}
            onChange={(e) => updateToggle("showInHeader", e.target.checked)}
          />
          <Label htmlFor="showSocialInHeader">Show in header</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="showSocialInFooter"
            type="checkbox"
            checked={config.showInFooter !== false}
            onChange={(e) => updateToggle("showInFooter", e.target.checked)}
          />
          <Label htmlFor="showSocialInFooter">Show in footer</Label>
        </div>
      </div>
    </div>
  );
}
