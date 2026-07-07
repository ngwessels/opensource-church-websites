/** @typedef {'admin' | 'finance' | 'member'} UserRole */

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
 * Per-viewport module order when a viewport uses a single content column.
 * Desktop column placement remains in `regions`.
 * @typedef {object} ResponsiveContentStackOrder
 * @property {string[]} [mobile]
 * @property {string[]} [tablet]
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
 * @property {string} [stripeSessionId]
 * @property {string} [stripeInvoiceId]
 * @property {string} [stripeSubscriptionId]
 * @property {string} [stripeCustomerId]
 * @property {string} [fundId]
 * @property {string} [fundLabel]
 * @property {string} [returnPath]
 * @property {DonorInfo} [donor]
 * @property {string} [donorEmail] - legacy flat field
 * @property {string} [donorComment]
 * @property {string} createdAt
 */

/**
 * @typedef {object} DonationCommentsConfig
 * @property {boolean} enabled
 * @property {string} label
 * @property {string} placeholder
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
 * @property {DonationCommentsConfig} [comments]
 */

/**
 * @typedef {object} AdminDocumentationUpdatedBy
 * @property {string} [uid]
 * @property {string} [email]
 * @property {"ui" | "mcp"} [source]
 */

/**
 * @typedef {object} AdminDocumentationNote
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {number} order
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {AdminDocumentationUpdatedBy} [updatedBy]
 */

/**
 * @typedef {object} AdminDocumentationRecord
 * @property {AdminDocumentationNote[]} notes
 * @property {string} updatedAt
 */

/** @typedef {'page_view' | 'engagement' | 'heatmap_batch'} AnalyticsEventType */

/**
 * @typedef {object} AnalyticsEventRecord
 * @property {AnalyticsEventType} type
 * @property {string} timestamp
 * @property {string} date
 * @property {string} pagePath
 * @property {string} [pageTitle]
 * @property {string} [pageId]
 * @property {PageType} [pageType]
 * @property {string} sessionId
 * @property {string} visitorId
 * @property {boolean} [isNewVisitor]
 * @property {string} [referrer]
 * @property {string} [utmSource]
 * @property {string} [utmMedium]
 * @property {string} [utmCampaign]
 * @property {string} [utmTerm]
 * @property {string} [utmContent]
 * @property {'mobile' | 'tablet' | 'desktop'} [deviceType]
 * @property {string} [browser]
 * @property {string} [os]
 * @property {string} [language]
 * @property {string} [country]
 * @property {number} [screenWidth]
 * @property {number} [screenHeight]
 * @property {number} [engagementMs]
 */

/** @typedef {'mobile' | 'tablet' | 'desktop'} HeatmapDeviceType */

/**
 * @typedef {object} AnalyticsHeatmapRollupRecord
 * @property {string} date
 * @property {string} pagePath
 * @property {string} [pageId]
 * @property {HeatmapDeviceType} deviceType
 * @property {number} gridSize
 * @property {Record<string, number>} [clicks]
 * @property {Record<string, number>} [scrollBuckets]
 * @property {number} [sessions]
 * @property {string} updatedAt
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
