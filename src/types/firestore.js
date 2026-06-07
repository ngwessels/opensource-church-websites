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
 * @property {string} [publishedAt]
 * @property {boolean} [hidden] - When true, page is omitted from public site and navigation
 */

/** @typedef {'content' | 'bulletins' | 'donation'} PageType */

/** @typedef {'default' | 'full-width' | 'sidebar-left' | 'sidebar-right'} PageLayout */

/** @typedef {'none' | 'sm' | 'md' | 'lg' | 'xl'} ContentMarginX */

/**
 * @typedef {object} SeoSettings
 * @property {string} [title] - Meta title (page or site)
 * @property {string} [description] - Meta description fallback
 * @property {string} [faviconUrl] - Site favicon URL (site config only)
 */

/**
 * @typedef {object} ResponsiveContentMarginX
 * @property {ContentMarginX} [mobile]
 * @property {ContentMarginX} [tablet]
 * @property {ContentMarginX} [desktop]
 */

/**
 * @typedef {object} ResponsiveContentColumns
 * @property {number} [mobile]
 * @property {number} [tablet]
 * @property {number} [desktop]
 */

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

/** @typedef {'once' | 'weekly' | 'monthly'} DonationFrequency */

/** @typedef {'completed' | 'pending' | 'failed'} DonationStatus */

/**
 * @typedef {object} DonorAddress
 * @property {string} line1
 * @property {string} [line2]
 * @property {string} city
 * @property {string} state
 * @property {string} postalCode
 */

/**
 * @typedef {object} DonorInfo
 * @property {string} name
 * @property {string} email
 * @property {string} [phone]
 * @property {DonorAddress} [address]
 */

/**
 * @typedef {object} DonationRecord
 * @property {number} amountCents
 * @property {string} currency
 * @property {DonationFrequency} frequency
 * @property {DonationStatus} status
 * @property {string} stripeSessionId
 * @property {string} [stripeCustomerId]
 * @property {string} [fundId]
 * @property {string} [fundLabel]
 * @property {string} [returnPath]
 * @property {DonorInfo} [donor]
 * @property {string} [donorEmail] - legacy flat field
 * @property {string} createdAt
 */

/**
 * @typedef {object} DonationFund
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 */

/**
 * @typedef {object} DonationPageConfig
 * @property {string} [title]
 * @property {string} [description]
 * @property {DonationFund[]} funds
 * @property {number[]} [presetAmountsCents]
 */

/** @typedef {'text' | 'links' | 'image' | 'gallery' | 'photo_albums' | 'slideshow' | 'feature_tiles' | 'carousel' | 'video' | 'zoom' | 'mass_times' | 'daily_readings' | 'calendar' | 'documents' | 'people' | 'buttons' | 'form' | 'embed' | 'facebook' | 'google_maps' | 'instagram' | 'rss'} ModuleType */

export const SITE_CONFIG_DOC = "site/config";
export const DEFAULT_MEDIA_FOLDERS = {
  pictures: "pictures-root",
  documents: "documents-root",
  unused: "unused-pictures",
};

export const MODULE_CATEGORIES = {
  Core: ["text", "links", "buttons", "documents", "people", "calendar", "form"],
  "Images & Video": ["image", "gallery", "photo_albums", "slideshow", "feature_tiles", "carousel", "video", "zoom"],
  Embed: ["embed", "facebook", "google_maps", "instagram", "rss"],
  Catholic: ["mass_times", "daily_readings"],
};
