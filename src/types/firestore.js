/** @typedef {'admin' | 'member'} UserRole */

/** @typedef {'page' | 'link' | 'group' | 'secure_page'} NavNodeType */

/**
 * @typedef {object} NavNode
 * @property {string} id
 * @property {NavNodeType} type
 * @property {string} title
 * @property {string} [slug] - Local URL segment on this node (e.g. `bulletins`). Full page path is computed from ancestors.
 * @property {string} [externalUrl]
 * @property {string|null} [parentId]
 * @property {number} order
 * @property {boolean} [isQuickLink]
 * @property {number} [quickLinkOrder]
 * @property {string} [pageId]
 * @property {boolean} [hideInNav] - Omit from main navigation (e.g. header-only link bucket)
 */

/** @typedef {'draft' | 'published'} PageStatus */

/**
 * @typedef {object} PageRecord
 * @property {PageStatus} status
 * @property {string} [scheduledPublishAt] - ISO timestamp when draft should auto-publish
 * @property {string} [publishedAt]
 */

/** @typedef {'content' | 'bulletins'} PageType */

/** @typedef {'default' | 'full-width' | 'sidebar-left' | 'sidebar-right'} PageLayout */

/**
 * @typedef {object} Bulletin
 * @property {string} date - ISO date YYYY-MM-DD (Sunday publish date)
 * @property {string} [title] - Optional display title; defaults to formatted date
 * @property {string} mediaId
 * @property {string} downloadUrl
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} MediaRecord
 * @property {string} name
 * @property {string} folderId
 * @property {string} mimeType
 * @property {number} sizeBytes
 * @property {string} storagePath
 * @property {string} downloadUrl
 * @property {string[]} [usedOnPageIds]
 * @property {string} [description] - Human/AI-readable summary (max 500 chars)
 * @property {string} [alt] - Image alt text (max 200 chars)
 * @property {string[]} [tags] - Keywords for search and MCP tools
 * @property {string} createdAt
 * @property {string} [updatedAt]
 */

/** @typedef {'once' | 'monthly'} DonationFrequency */

/** @typedef {'completed' | 'pending' | 'failed'} DonationStatus */

/** @typedef {'text' | 'links' | 'image' | 'gallery' | 'slideshow' | 'carousel' | 'video' | 'zoom' | 'mass_times' | 'daily_readings' | 'calendar' | 'documents' | 'people' | 'buttons' | 'embed' | 'facebook' | 'google_maps' | 'instagram' | 'rss'} ModuleType */

export const SITE_CONFIG_DOC = "site/config";
export const DEFAULT_MEDIA_FOLDERS = {
  pictures: "pictures-root",
  documents: "documents-root",
  unused: "unused-pictures",
};

export const MODULE_CATEGORIES = {
  Core: ["text", "links", "buttons", "documents", "people", "calendar"],
  "Images & Video": ["image", "gallery", "slideshow", "carousel", "video", "zoom"],
  Embed: ["embed", "facebook", "google_maps", "instagram", "rss"],
  Catholic: ["mass_times", "daily_readings"],
};
