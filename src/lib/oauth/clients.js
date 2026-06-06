import "server-only";

import { randomBytes } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

const CURSOR_REDIRECT_URI = "cursor://anysphere.cursor-mcp/oauth/callback";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

export function isAllowedRedirectUri(uri) {
  if (!uri) return false;
  if (uri === CURSOR_REDIRECT_URI) return true;
  if (uri.startsWith("http://127.0.0.1:") || uri.startsWith("http://localhost:")) return true;
  return false;
}

export async function registerOAuthClient(body) {
  const clientName = body?.client_name?.trim() || "MCP Client";
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];

  if (redirectUris.length === 0) {
    throw new Error("redirect_uris is required");
  }

  for (const uri of redirectUris) {
    if (!isAllowedRedirectUri(uri)) {
      throw new Error(`redirect_uri not allowed: ${uri}`);
    }
  }

  const clientId = `mcp_client_${randomBytes(16).toString("hex")}`;
  const record = {
    clientId,
    clientName,
    redirectUris,
    grantTypes: ["authorization_code"],
    tokenEndpointAuthMethod: "none",
    createdAt: now(),
  };

  await getDb().collection(COLLECTIONS.mcpOAuthClients).doc(clientId).set(record);

  return {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: record.grantTypes,
    token_endpoint_auth_method: record.tokenEndpointAuthMethod,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}

export async function getOAuthClient(clientId) {
  const snap = await getDb().collection(COLLECTIONS.mcpOAuthClients).doc(clientId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export function clientAllowsRedirectUri(client, redirectUri) {
  return client?.redirectUris?.includes(redirectUri);
}
