import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { hashMcpToken } from "@/lib/mcp/tokens.server";
import { COLLECTIONS, MCP_SUBCOLLECTION } from "@/lib/firestore/paths";

export const mcpAuthStorage = new AsyncLocalStorage();

export function getMcpAuthContext() {
  const ctx = mcpAuthStorage.getStore();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}

export async function requireAdmin(uid) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists || snap.data()?.role !== "admin") {
    throw new Error("Admin access required");
  }
}

export async function validateMcpToken(bearerToken) {
  if (!bearerToken) {
    console.info("[mcp:auth] rejected: no bearer token");
    return undefined;
  }

  if (!bearerToken.startsWith("mcp_oat_")) {
    console.info("[mcp:auth] rejected: unexpected token prefix");
    return undefined;
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    console.warn("[mcp:auth] rejected: firebase admin not configured");
    return undefined;
  }

  const tokenHash = hashMcpToken(bearerToken);
  const lookupSnap = await db.collection(COLLECTIONS.mcpTokenLookup).doc(tokenHash).get();
  if (!lookupSnap.exists) {
    console.warn("[mcp:auth] rejected: token not found");
    return undefined;
  }

  const lookup = lookupSnap.data();
  if (lookup.revokedAt) {
    console.warn("[mcp:auth] rejected: token revoked", { connectionId: lookup.connectionId });
    return undefined;
  }

  if (lookup.expiresAt && new Date(lookup.expiresAt).getTime() < Date.now()) {
    console.warn("[mcp:auth] rejected: token expired", { connectionId: lookup.connectionId });
    return undefined;
  }

  const { uid, connectionId } = lookup;
  try {
    await requireAdmin(uid);
  } catch {
    console.warn("[mcp:auth] rejected: user is not admin", { uid, connectionId });
    return undefined;
  }

  const connSnap = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(MCP_SUBCOLLECTION)
    .doc(connectionId)
    .get();

  if (!connSnap.exists || connSnap.data()?.revokedAt) {
    console.warn("[mcp:auth] rejected: connection missing or revoked", { uid, connectionId });
    return undefined;
  }

  const expiresAt = lookup.expiresAt
    ? Math.floor(new Date(lookup.expiresAt).getTime() / 1000)
    : undefined;

  console.info("[mcp:auth] accepted", { uid, connectionId });

  return {
    token: bearerToken,
    clientId: uid,
    scopes: connSnap.data()?.scopes || ["site:admin"],
    expiresAt,
    extra: { uid, connectionId, tokenHash, authMethod: "oauth" },
  };
}

export async function touchMcpConnectionLastUsed(uid, connectionId) {
  const db = getFirebaseAdminFirestore();
  if (!db) return;

  const now = new Date().toISOString();
  await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(MCP_SUBCOLLECTION)
    .doc(connectionId)
    .update({ lastUsedAt: now });
}

export async function getAdminUserFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing authorization");
  }
  const idToken = authHeader.slice(7);
  const { verifyFirebaseIdToken } = await import("@/lib/firebase/admin-auth");
  const decoded = await verifyFirebaseIdToken(idToken);
  await requireAdmin(decoded.uid);
  return decoded;
}
