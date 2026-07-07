const VISITOR_ID_KEY = "parish_analytics_visitor";
const SESSION_ID_KEY = "parish_analytics_session";
const SESSION_LAST_KEY = "parish_analytics_session_last";
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * @param {Storage} storage
 * @param {string} key
 */
function readUuid(storage, key) {
  try {
    const value = storage.getItem(key);
    if (value && /^[0-9a-f-]{36}$/i.test(value)) return value;
  } catch {
    // ignore
  }
  return null;
}

/**
 * @param {Storage} storage
 * @param {string} key
 * @param {string} value
 */
function writeUuid(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getOrCreateVisitorId() {
  const existing = readUuid(localStorage, VISITOR_ID_KEY);
  if (existing) return { visitorId: existing, isNewVisitor: false };
  const visitorId = crypto.randomUUID();
  writeUuid(localStorage, VISITOR_ID_KEY, visitorId);
  return { visitorId, isNewVisitor: true };
}

export function getOrCreateSessionId() {
  const now = Date.now();
  const lastActive = Number(sessionStorage.getItem(SESSION_LAST_KEY) || 0);
  const existing = readUuid(sessionStorage, SESSION_ID_KEY);
  if (existing && lastActive && now - lastActive < SESSION_TIMEOUT_MS) {
    sessionStorage.setItem(SESSION_LAST_KEY, String(now));
    return existing;
  }
  const sessionId = crypto.randomUUID();
  writeUuid(sessionStorage, SESSION_ID_KEY, sessionId);
  sessionStorage.setItem(SESSION_LAST_KEY, String(now));
  return sessionId;
}
