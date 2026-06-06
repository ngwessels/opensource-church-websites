import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  MAX_MCP_CONNECTIONS,
  MCP_SUBCOLLECTION,
} from "@/lib/firestore/paths";
import { slugifyConfigKey } from "@/lib/mcp/tokens";

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

export async function createOAuthConnection(
  uid,
  { clientId, clientName, scopes, tokenHash, tokenPrefix, expiresAt },
) {
  const active = await countActiveConnections(uid);
  if (active >= MAX_MCP_CONNECTIONS) {
    throw new Error(`Maximum of ${MAX_MCP_CONNECTIONS} active connections reached`);
  }

  const name = clientName || "MCP Client";
  const connectionId = `mcpconn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ts = now();

  const connection = {
    name,
    configKey: slugifyConfigKey(name),
    authMethod: "oauth",
    clientId,
    clientName: name,
    scopes: scopes || [],
    tokenHash,
    tokenPrefix,
    expiresAt,
    createdAt: ts,
    lastUsedAt: null,
    revokedAt: null,
  };

  await connectionsRef(uid).doc(connectionId).set(connection);
  return { id: connectionId, ...connection };
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
