/** @typedef {'create' | 'update' | 'delete' | 'publish' | 'revert' | 'publish_all'} AuditAction */

/** @typedef {'ui' | 'mcp' | 'api'} AuditSource */

/**
 * @typedef {'page' | 'module' | 'site_config' | 'nav' | 'media' | 'bulletin' | 'user' | 'admin_documentation' | 'donation_page' | 'form_submission'} AuditResourceType
 */

/**
 * @typedef {object} AuditActor
 * @property {string} uid
 * @property {string} [email]
 * @property {string} [displayName]
 * @property {import('@/types/firestore').UserRole} [role]
 */

/**
 * @typedef {object} AuditResource
 * @property {AuditResourceType} type
 * @property {string} [id]
 * @property {string} [path]
 * @property {string} [slug]
 * @property {string} [pageId]
 * @property {string} [moduleId]
 * @property {string} [toolName]
 * @property {string} [apiRoute]
 */

/**
 * @typedef {object} AuditContext
 * @property {string} [builderPath]
 * @property {string} [section]
 * @property {string} [label]
 */

/**
 * @typedef {object} AuditEventRecord
 * @property {string} id
 * @property {string} timestamp
 * @property {AuditAction} action
 * @property {AuditActor} actor
 * @property {AuditSource} source
 * @property {AuditResource} resource
 * @property {AuditContext} [context]
 * @property {string} summary
 * @property {boolean} [hasBeforeSnapshot]
 * @property {boolean} [hasAfterSnapshot]
 */

export const AUDIT_ACTIONS = /** @type {const} */ ([
  "create",
  "update",
  "delete",
  "publish",
  "revert",
  "publish_all",
]);

export const AUDIT_SOURCES = /** @type {const} */ (["ui", "mcp", "api"]);

export const AUDIT_RESOURCE_TYPES = /** @type {const} */ ([
  "page",
  "module",
  "site_config",
  "nav",
  "media",
  "bulletin",
  "user",
  "admin_documentation",
  "donation_page",
  "form_submission",
]);

/** Firestore document size guard (~900 KB JSON). */
export const AUDIT_SNAPSHOT_MAX_BYTES = 900 * 1024;

/**
 * @param {unknown} value
 * @returns {number}
 */
export function estimateSnapshotBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * @param {unknown} data
 * @returns {{ data: unknown, truncated: boolean, originalSizeBytes?: number }}
 */
export function prepareSnapshotPayload(data) {
  if (data === undefined) {
    return { data: null, truncated: false };
  }

  const originalSizeBytes = estimateSnapshotBytes(data);
  if (originalSizeBytes <= AUDIT_SNAPSHOT_MAX_BYTES) {
    return { data, truncated: false };
  }

  const serialized = JSON.stringify(data);
  const preview = serialized.slice(0, AUDIT_SNAPSHOT_MAX_BYTES - 256);

  return {
    data: {
      truncated: true,
      originalSizeBytes,
      preview,
      message: "Snapshot exceeded size limit and was truncated for storage.",
    },
    truncated: true,
    originalSizeBytes,
  };
}

/**
 * @param {unknown} action
 * @returns {AuditAction}
 */
export function normalizeAuditAction(action) {
  const value = String(action ?? "").trim();
  if (AUDIT_ACTIONS.includes(/** @type {AuditAction} */ (value))) {
    return /** @type {AuditAction} */ (value);
  }
  return "update";
}

/**
 * @param {unknown} source
 * @returns {AuditSource}
 */
export function normalizeAuditSource(source) {
  const value = String(source ?? "").trim();
  if (AUDIT_SOURCES.includes(/** @type {AuditSource} */ (value))) {
    return /** @type {AuditSource} */ (value);
  }
  return "api";
}

/**
 * @param {unknown} raw
 * @returns {AuditActor}
 */
export function normalizeAuditActor(raw) {
  const input = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const uid = typeof input.uid === "string" ? input.uid.trim() : "";
  if (!uid) {
    throw new Error("Audit actor uid is required");
  }

  const actor = /** @type {AuditActor} */ ({ uid });

  if (typeof input.email === "string" && input.email.trim()) {
    actor.email = input.email.trim();
  }
  if (typeof input.displayName === "string" && input.displayName.trim()) {
    actor.displayName = input.displayName.trim();
  }
  if (typeof input.role === "string" && input.role.trim()) {
    actor.role = /** @type {import('@/types/firestore').UserRole} */ (input.role.trim());
  }

  return actor;
}

/**
 * @param {unknown} raw
 * @returns {AuditResource}
 */
export function normalizeAuditResource(raw) {
  const input = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const type = String(input.type ?? "").trim();
  if (!AUDIT_RESOURCE_TYPES.includes(/** @type {AuditResourceType} */ (type))) {
    throw new Error("Audit resource type is required");
  }

  /** @type {AuditResource} */
  const resource = { type: /** @type {AuditResourceType} */ (type) };

  for (const key of ["id", "path", "slug", "pageId", "moduleId", "toolName", "apiRoute"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      resource[/** @type {keyof AuditResource} */ (key)] = value.trim();
    }
  }

  return resource;
}

/**
 * @param {unknown} raw
 * @returns {AuditContext | undefined}
 */
export function normalizeAuditContext(raw) {
  if (!raw || typeof raw !== "object") return undefined;

  const input = /** @type {Record<string, unknown>} */ (raw);
  /** @type {AuditContext} */
  const context = {};

  for (const key of ["builderPath", "section", "label"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      context[/** @type {keyof AuditContext} */ (key)] = value.trim();
    }
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

/**
 * @param {object} input
 * @param {string} input.id
 * @param {AuditAction} input.action
 * @param {AuditActor} input.actor
 * @param {AuditSource} input.source
 * @param {AuditResource} input.resource
 * @param {string} input.summary
 * @param {AuditContext} [input.context]
 * @param {boolean} [input.hasBeforeSnapshot]
 * @param {boolean} [input.hasAfterSnapshot]
 * @param {string} [input.timestamp]
 * @returns {AuditEventRecord}
 */
export function buildAuditEventRecord({
  id,
  action,
  actor,
  source,
  resource,
  summary,
  context,
  hasBeforeSnapshot,
  hasAfterSnapshot,
  timestamp,
}) {
  const record = {
    id,
    timestamp: timestamp ?? new Date().toISOString(),
    action: normalizeAuditAction(action),
    actor: normalizeAuditActor(actor),
    source: normalizeAuditSource(source),
    resource: normalizeAuditResource(resource),
    summary: String(summary ?? "").trim() || `${action} ${resource.type}`,
  };

  const normalizedContext = normalizeAuditContext(context);
  if (normalizedContext) {
    record.context = normalizedContext;
  }
  if (hasBeforeSnapshot) {
    record.hasBeforeSnapshot = true;
  }
  if (hasAfterSnapshot) {
    record.hasAfterSnapshot = true;
  }

  return record;
}

/**
 * @param {unknown} raw
 * @returns {AuditEventRecord}
 */
export function normalizeAuditEvent(raw) {
  const input = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) throw new Error("Audit event id is required");

  return buildAuditEventRecord({
    id,
    action: normalizeAuditAction(input.action),
    actor: input.actor,
    source: normalizeAuditSource(input.source),
    resource: input.resource,
    summary: typeof input.summary === "string" ? input.summary : "",
    context: input.context,
    hasBeforeSnapshot: Boolean(input.hasBeforeSnapshot),
    hasAfterSnapshot: Boolean(input.hasAfterSnapshot),
    timestamp: typeof input.timestamp === "string" ? input.timestamp : undefined,
  });
}
