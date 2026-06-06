import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  MAX_MCP_CONNECTIONS,
  MCP_SUBCOLLECTION,
} from "@/lib/firestore/paths";
import { buildCursorMcpConfig, slugifyConfigKey } from "@/lib/mcp/tokens";
import { generateMcpToken } from "@/lib/mcp/tokens.server";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

function connectionsRef(uid) {
  return getDb().collection(COLLECTIONS.users).doc(uid).collection(MCP_SUBCOLLECTION);
}

export async function listMcpConnections(uid, { includeRevoked = false } = {}) {
  const snap = await connectionsRef(uid).orderBy("createdAt", "desc").get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!includeRevoked) {
    items = items.filter((c) => !c.revokedAt);
  }
  return items;
}

async function countActiveConnections(uid) {
  const items = await listMcpConnections(uid);
  return items.length;
}

async function isNameTaken(uid, name, excludeId) {
  const items = await listMcpConnections(uid);
  const normalized = name.trim().toLowerCase();
  return items.some(
    (c) => c.id !== excludeId && c.name.trim().toLowerCase() === normalized,
  );
}

export async function createMcpConnection(uid, { name, appUrl }) {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Connection name is required");

  const active = await countActiveConnections(uid);
  if (active >= MAX_MCP_CONNECTIONS) {
    throw new Error(`Maximum of ${MAX_MCP_CONNECTIONS} active connections reached`);
  }

  if (await isNameTaken(uid, trimmed)) {
    throw new Error("A connection with this name already exists");
  }

  const { token, tokenHash, tokenPrefix } = generateMcpToken();
  const configKey = slugifyConfigKey(trimmed);
  const connectionId = `mcpconn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ts = now();

  const connection = {
    name: trimmed,
    configKey,
    tokenHash,
    tokenPrefix,
    createdAt: ts,
    lastUsedAt: null,
    revokedAt: null,
  };

  const db = getDb();
  const batch = db.batch();
  batch.set(connectionsRef(uid).doc(connectionId), connection);
  batch.set(db.collection(COLLECTIONS.mcpTokenLookup).doc(tokenHash), {
    uid,
    connectionId,
    revokedAt: null,
  });
  await batch.commit();

  const cursorConfig = buildCursorMcpConfig({
    configKey,
    appUrl: appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    token,
  });

  return {
    id: connectionId,
    ...connection,
    token,
    cursorConfig,
  };
}

export async function revokeMcpConnection(uid, connectionId) {
  const db = getDb();
  const connRef = connectionsRef(uid).doc(connectionId);
  const snap = await connRef.get();
  if (!snap.exists) throw new Error("Connection not found");

  const data = snap.data();
  const revokedAt = now();
  const batch = db.batch();
  batch.update(connRef, { revokedAt });
  if (data.tokenHash) {
    batch.update(db.collection(COLLECTIONS.mcpTokenLookup).doc(data.tokenHash), { revokedAt });
  }
  await batch.commit();
  return { id: connectionId, revokedAt };
}

export async function renameMcpConnection(uid, connectionId, name) {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Connection name is required");
  if (await isNameTaken(uid, trimmed, connectionId)) {
    throw new Error("A connection with this name already exists");
  }

  const connRef = connectionsRef(uid).doc(connectionId);
  const snap = await connRef.get();
  if (!snap.exists) throw new Error("Connection not found");
  if (snap.data()?.revokedAt) throw new Error("Cannot rename a revoked connection");

  const configKey = slugifyConfigKey(trimmed);
  await connRef.update({ name: trimmed, configKey });
  const updated = await connRef.get();
  return { id: updated.id, ...updated.data() };
}
