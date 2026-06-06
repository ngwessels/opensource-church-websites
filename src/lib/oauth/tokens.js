import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, MCP_SUBCOLLECTION } from "@/lib/firestore/paths";
import { createOAuthConnection } from "@/lib/mcp/connections";
import { verifyPkceS256 } from "@/lib/oauth/pkce";
import { consumeAuthorizationCode } from "@/lib/oauth/codes";
import { getOAuthClient } from "@/lib/oauth/clients";
import { getAccessTokenTtlSeconds } from "@/lib/oauth/config";
import { generateOAuthAccessToken } from "@/lib/mcp/tokens.server";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

export async function exchangeAuthorizationCode({
  code,
  clientId,
  redirectUri,
  codeVerifier,
}) {
  const client = await getOAuthClient(clientId);
  if (!client) {
    throw new Error("invalid_client");
  }

  const authCode = await consumeAuthorizationCode(code, clientId, redirectUri);
  if (!authCode) {
    throw new Error("invalid_grant");
  }

  if (!verifyPkceS256(codeVerifier, authCode.codeChallenge)) {
    throw new Error("invalid_grant");
  }

  const { token, tokenHash, tokenPrefix } = generateOAuthAccessToken();
  const expiresIn = getAccessTokenTtlSeconds();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const connection = await createOAuthConnection(authCode.uid, {
    clientId,
    clientName: client.clientName,
    scopes: authCode.scopes || [],
    tokenHash,
    tokenPrefix,
    expiresAt,
  });

  await getDb().collection(COLLECTIONS.mcpTokenLookup).doc(tokenHash).set({
    uid: authCode.uid,
    connectionId: connection.id,
    authMethod: "oauth",
    clientId,
    expiresAt,
    revokedAt: null,
  });

  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: (authCode.scopes || []).join(" "),
  };
}

export async function revokeOAuthToken(token) {
  const { hashMcpToken } = await import("@/lib/mcp/tokens.server");
  const tokenHash = hashMcpToken(token);
  const db = getDb();
  const lookupSnap = await db.collection(COLLECTIONS.mcpTokenLookup).doc(tokenHash).get();
  if (!lookupSnap.exists) return;

  const { uid, connectionId } = lookupSnap.data();
  const revokedAt = new Date().toISOString();
  const batch = db.batch();
  batch.update(lookupSnap.ref, { revokedAt });
  if (uid && connectionId) {
    batch.update(
      db.collection(COLLECTIONS.users).doc(uid).collection(MCP_SUBCOLLECTION).doc(connectionId),
      { revokedAt },
    );
  }
  await batch.commit();
}
