/** @typedef {'facebook' | 'instagram' | 'youtube' | 'x'} SocialPlatform */

/**
 * @typedef {object} SocialMediaItem
 * @property {SocialPlatform} platform
 * @property {string} url
 */

/**
 * @typedef {object} SocialMediaConfig
 * @property {boolean} [showInHeader]
 * @property {boolean} [showInFooter]
 * @property {SocialMediaItem[]} [items]
 */

export const SOCIAL_PLATFORMS = /** @type {const} */ ([
  "facebook",
  "instagram",
  "youtube",
  "x",
]);

/** @type {Record<SocialPlatform, { label: string }>} */
export const SOCIAL_PLATFORM_META = {
  facebook: { label: "Facebook" },
  instagram: { label: "Instagram" },
  youtube: { label: "YouTube" },
  x: { label: "X" },
};

export const DEFAULT_SOCIAL_MEDIA = {
  showInHeader: true,
  showInFooter: true,
  items: [],
};

/**
 * @param {string} url
 * @returns {string}
 */
export function normalizeSocialUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isValidSocialUrl(url) {
  const normalized = normalizeSocialUrl(url);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {SocialMediaConfig | null | undefined} config
 * @returns {SocialMediaItem[]}
 */
export function resolveSocialItems(config) {
  const items = config?.items || [];
  return items
    .map((item) => ({
      platform: item.platform,
      url: normalizeSocialUrl(item.url),
    }))
    .filter((item) => SOCIAL_PLATFORMS.includes(item.platform) && isValidSocialUrl(item.url));
}

/**
 * @param {SocialMediaConfig | null | undefined} current
 * @param {SocialMediaConfig | null | undefined} patch
 * @returns {SocialMediaConfig}
 */
export function mergeSocialMedia(current, patch) {
  if (!patch) return { ...DEFAULT_SOCIAL_MEDIA, ...current };
  return {
    ...DEFAULT_SOCIAL_MEDIA,
    ...current,
    ...patch,
    items: patch.items !== undefined ? patch.items : current?.items || [],
  };
}

/**
 * @param {SocialMediaConfig | null | undefined} config
 * @returns {Record<SocialPlatform, string>}
 */
export function socialItemsToDraft(config) {
  const draft = /** @type {Record<SocialPlatform, string>} */ ({
    facebook: "",
    instagram: "",
    youtube: "",
    x: "",
  });
  for (const item of config?.items || []) {
    if (SOCIAL_PLATFORMS.includes(item.platform)) {
      draft[item.platform] = item.url || "";
    }
  }
  return draft;
}

/**
 * @param {Record<SocialPlatform, string>} draft
 * @param {{ showInHeader?: boolean, showInFooter?: boolean }} options
 * @returns {SocialMediaConfig}
 */
export function draftToSocialItems(draft, options = {}) {
  const items = SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    url: normalizeSocialUrl(draft[platform] || ""),
  })).filter((item) => isValidSocialUrl(item.url));

  return {
    showInHeader: options.showInHeader !== false,
    showInFooter: options.showInFooter !== false,
    items,
  };
}

/**
 * @param {SocialMediaConfig | null | undefined} config
 * @returns {SocialMediaConfig}
 */
export function sanitizeSocialMediaConfig(config) {
  return {
    ...DEFAULT_SOCIAL_MEDIA,
    ...config,
    items: resolveSocialItems(config),
  };
}
