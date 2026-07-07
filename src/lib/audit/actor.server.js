import "server-only";

import { normalizeUserRole } from "@/lib/auth/roles";
import { mcpAuthStorage } from "@/lib/cms/auth";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

/**
 * @param {string} uid
 * @returns {Promise<import('./schema.js').AuditActor>}
 */
export async function getActorFromUid(uid) {
  const db = getFirebaseAdminFirestore();
  if (!db) {
    return { uid, role: "admin" };
  }

  const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
  const data = snap.exists ? snap.data() : {};

  return {
    uid,
    email: typeof data?.email === "string" ? data.email : undefined,
    displayName: typeof data?.displayName === "string" ? data.displayName : undefined,
    role: normalizeUserRole(data?.role),
  };
}

/**
 * @param {import('firebase-admin/auth').DecodedIdToken} decoded
 * @returns {Promise<import('./schema.js').AuditActor>}
 */
export async function getActorFromDecodedToken(decoded) {
  const actor = await getActorFromUid(decoded.uid);
  if (!actor.email && typeof decoded.email === "string") {
    actor.email = decoded.email;
  }
  if (!actor.displayName && typeof decoded.name === "string") {
    actor.displayName = decoded.name;
  }
  return actor;
}

/**
 * @param {import('./schema.js').AuditActor} [explicitActor]
 * @returns {Promise<import('./schema.js').AuditActor | null>}
 */
export async function resolveServerActor(explicitActor) {
  if (explicitActor?.uid) {
    return normalizeActor(explicitActor);
  }

  const mcpCtx = mcpAuthStorage.getStore();
  if (mcpCtx?.uid) {
    return getActorFromUid(mcpCtx.uid);
  }

  return null;
}

/**
 * @param {import('./schema.js').AuditActor} actor
 */
function normalizeActor(actor) {
  return {
    uid: actor.uid,
    email: actor.email,
    displayName: actor.displayName,
    role: actor.role ? normalizeUserRole(actor.role) : undefined,
  };
}

/**
 * @returns {import('./schema.js').AuditSource}
 */
export function resolveServerAuditSource() {
  if (mcpAuthStorage.getStore()) {
    return "mcp";
  }
  return "api";
}

/**
 * @returns {string | undefined}
 */
export function resolveMcpToolName() {
  const mcpCtx = mcpAuthStorage.getStore();
  return typeof mcpCtx?.toolName === "string" ? mcpCtx.toolName : undefined;
}
