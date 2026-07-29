import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, MCP_SUBCOLLECTION } from "@/lib/firestore/paths";
import { createOAuthConnection, updateOAuthConnectionTokens } from "@/lib/mcp/connections";
import { verifyPkceS256 } from "@/lib/oauth/pkce";
import { consumeAuthorizationCode } from "@/lib/oauth/codes";
import { getOAuthClient } from "@/lib/oauth/clients";
import {
  getAccessTokenTtlSeconds,
  getRefreshTokenTtlSeconds,
} from "@/lib/oauth/config";
import {
  generateOAuthAccessToken,
  generateOAuthRefreshToken,
  hashMcpToken,
} from "@/lib/mcp/tokens.server";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function buildTokenPair(scopes = []) {
  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();
  const expiresIn = getAccessTokenTtlSeconds();
  const accessExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const refreshExpiresAt = new Date(
    Date.now() + getRefreshTokenTtlSeconds() * 1000,
  ).toISOString();

  return {
    access,
    refresh,
    expiresIn,
    accessExpiresAt,
    refreshExpiresAt,
    scope: scopes.join(" "),
  };
}

async function storeTokenLookups({
  uid,
  connectionId,
  clientId,
  access,
  refresh,
  accessExpiresAt,
  refreshExpiresAt,
}) {
  const db = getDb();
  const batch = db.batch();

  batch.set(db.collection(COLLECTIONS.mcpTokenLookup).doc(access.tokenHash), {
    uid,
    connectionId,
    authMethod: "oauth",
    tokenType: "access",
    clientId,
    expiresAt: accessExpiresAt,
    revokedAt: null,
  });

  batch.set(db.collection(COLLECTIONS.mcpTokenLookup).doc(refresh.tokenHash), {
    uid,
    connectionId,
    authMethod: "oauth",
    tokenType: "refresh",
    clientId,
    expiresAt: refreshExpiresAt,
    revokedAt: null,
  });

  await batch.commit();
}

function buildTokenResponse({ access, refresh, expiresIn, scope }) {
  return {
    access_token: access.token,
    refresh_token: refresh.token,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope,
  };
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

  const scopes = authCode.scopes || [];
  const pair = buildTokenPair(scopes);

  const connection = await createOAuthConnection(authCode.uid, {
    clientId,
    clientName: client.clientName,
    scopes,
    tokenHash: pair.access.tokenHash,
    tokenPrefix: pair.access.tokenPrefix,
    expiresAt: pair.accessExpiresAt,
    refreshTokenHash: pair.refresh.tokenHash,
    refreshTokenPrefix: pair.refresh.tokenPrefix,
    refreshExpiresAt: pair.refreshExpiresAt,
  });

  await storeTokenLookups({
    uid: authCode.uid,
    connectionId: connection.id,
    clientId,
    access: pair.access,
    refresh: pair.refresh,
    accessExpiresAt: pair.accessExpiresAt,
    refreshExpiresAt: pair.refreshExpiresAt,
  });

  return buildTokenResponse(pair);
}

async function revokeTokenHashes(tokenHashes, revokedAt) {
  const db = getDb();
  const batch = db.batch();
  for (const tokenHash of tokenHashes) {
    if (!tokenHash) continue;
    batch.update(db.collection(COLLECTIONS.mcpTokenLookup).doc(tokenHash), { revokedAt });
  }
  await batch.commit();
}

export async function refreshAccessToken({ refreshToken, clientId }) {
  const client = await getOAuthClient(clientId);
  if (!client) {
    throw new Error("invalid_client");
  }

  if (!refreshToken?.startsWith("mcp_ort_")) {
    throw new Error("invalid_grant");
  }

  const db = getDb();
  const refreshHash = hashMcpToken(refreshToken);
  const lookupSnap = await db.collection(COLLECTIONS.mcpTokenLookup).doc(refreshHash).get();
  if (!lookupSnap.exists) {
    throw new Error("invalid_grant");
  }

  const lookup = lookupSnap.data();
  if (
    lookup.revokedAt ||
    lookup.tokenType !== "refresh" ||
    lookup.clientId !== clientId ||
    (lookup.expiresAt && new Date(lookup.expiresAt).getTime() < Date.now())
  ) {
    throw new Error("invalid_grant");
  }

  const { uid, connectionId } = lookup;
  const connRef = db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(MCP_SUBCOLLECTION)
    .doc(connectionId);
  const connSnap = await connRef.get();
  if (!connSnap.exists || connSnap.data()?.revokedAt) {
    throw new Error("invalid_grant");
  }

  const conn = connSnap.data();
  if (conn.refreshTokenHash !== refreshHash) {
    throw new Error("invalid_grant");
  }

  const scopes = conn.scopes || [];
  const pair = buildTokenPair(scopes);
  const revokedAt = new Date().toISOString();

  await revokeTokenHashes([conn.tokenHash, conn.refreshTokenHash], revokedAt);

  await updateOAuthConnectionTokens(uid, connectionId, {
    tokenHash: pair.access.tokenHash,
    tokenPrefix: pair.access.tokenPrefix,
    expiresAt: pair.accessExpiresAt,
    refreshTokenHash: pair.refresh.tokenHash,
    refreshTokenPrefix: pair.refresh.tokenPrefix,
    refreshExpiresAt: pair.refreshExpiresAt,
  });

  await storeTokenLookups({
    uid,
    connectionId,
    clientId,
    access: pair.access,
    refresh: pair.refresh,
    accessExpiresAt: pair.accessExpiresAt,
    refreshExpiresAt: pair.refreshExpiresAt,
  });

  return buildTokenResponse(pair);
}

export async function revokeOAuthToken(token) {
  const tokenHash = hashMcpToken(token);
  const db = getDb();
  const lookupSnap = await db.collection(COLLECTIONS.mcpTokenLookup).doc(tokenHash).get();
  if (!lookupSnap.exists) return;

  const lookup = lookupSnap.data();
  const { uid, connectionId } = lookup;
  const revokedAt = new Date().toISOString();
  const batch = db.batch();
  batch.update(lookupSnap.ref, { revokedAt });

  if (uid && connectionId) {
    const connRef = db
      .collection(COLLECTIONS.users)
      .doc(uid)
      .collection(MCP_SUBCOLLECTION)
      .doc(connectionId);
    const connSnap = await connRef.get();
    const conn = connSnap.exists ? connSnap.data() : null;

    batch.update(connRef, { revokedAt });

    if (conn?.tokenHash && conn.tokenHash !== tokenHash) {
      batch.update(db.collection(COLLECTIONS.mcpTokenLookup).doc(conn.tokenHash), { revokedAt });
    }
    if (conn?.refreshTokenHash && conn.refreshTokenHash !== tokenHash) {
      batch.update(db.collection(COLLECTIONS.mcpTokenLookup).doc(conn.refreshTokenHash), {
        revokedAt,
      });
    }
  }

  await batch.commit();
}
