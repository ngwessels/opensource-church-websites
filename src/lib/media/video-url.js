/**
 * @typedef {'youtube' | 'vimeo' | 'direct'} VideoProvider
 */

/**
 * @typedef {object} ParsedVideo
 * @property {VideoProvider | null} provider
 * @property {string} [videoId]
 * @property {string} [embedUrl]
 * @property {string} [src]
 * @property {string} [url]
 */

/**
 * @param {'youtube' | 'vimeo'} provider
 * @param {string} videoId
 * @returns {string}
 */
export function buildEmbedUrl(provider, videoId) {
  if (provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  if (provider === "vimeo") {
    return `https://player.vimeo.com/video/${videoId}`;
  }
  return "";
}

/**
 * @param {string} input
 * @returns {ParsedVideo}
 */
export function parseVideoUrl(input) {
  const trimmed = input?.trim() || "";
  if (!trimmed) {
    return { provider: null, url: "" };
  }

  const youtubePatterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: "youtube",
        videoId,
        embedUrl: buildEmbedUrl("youtube", videoId),
        url: trimmed,
      };
    }
  }

  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of vimeoPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        provider: "vimeo",
        videoId,
        embedUrl: buildEmbedUrl("vimeo", videoId),
        url: trimmed,
      };
    }
  }

  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(trimmed) || trimmed.startsWith("blob:")) {
    return {
      provider: "direct",
      src: trimmed,
      url: trimmed,
    };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return {
      provider: "direct",
      src: trimmed,
      url: trimmed,
    };
  }

  return { provider: null, url: trimmed };
}

/**
 * Normalize video module config for storage.
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
export function normalizeVideoConfig(config = {}) {
  const title = typeof config.title === "string" ? config.title : "Video";
  const source = config.source || "youtube";

  if (source === "upload") {
    return {
      title,
      source: "upload",
      src: typeof config.src === "string" ? config.src : "",
      mediaId: typeof config.mediaId === "string" ? config.mediaId : "",
      url: "",
      embedUrl: "",
    };
  }

  if (source === "url") {
    const url = typeof config.url === "string" ? config.url : "";
    const parsed = parseVideoUrl(url);
    return {
      title,
      source: "url",
      url,
      embedUrl: parsed.embedUrl || "",
      src: parsed.src || url,
      provider: parsed.provider,
      videoId: parsed.videoId || "",
    };
  }

  const url = typeof config.url === "string" ? config.url : "";
  const parsed = parseVideoUrl(url);
  const provider = parsed.provider === "vimeo" ? "vimeo" : "youtube";

  if (parsed.provider === "youtube" || parsed.provider === "vimeo") {
    return {
      title,
      source: provider,
      url,
      embedUrl: parsed.embedUrl || "",
      videoId: parsed.videoId || "",
      src: "",
    };
  }

  return {
    title,
    source: provider,
    url,
    embedUrl: "",
    src: "",
  };
}
